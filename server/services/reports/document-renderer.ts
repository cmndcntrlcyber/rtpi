/**
 * Document Renderer (v2.9.1 Phase 3, seam S8)
 *
 * Connects to a chromedp/headless-shell sidecar via Chrome DevTools Protocol
 * and renders HTML to PDF. Uses puppeteer-core to avoid bundling Chromium
 * into the orchestrator image — the actual browser lives in the
 * `chromium-shell` compose service (started with `--profile pdf`).
 *
 * The connection is lazy: nothing is opened until the first `renderToPdf`
 * call, and a transient disconnect just causes the next call to reconnect.
 *
 * When CHROMIUM_WS_ENDPOINT is unset or the sidecar is unreachable, all
 * methods throw with a structured `RendererError` so callers can degrade
 * gracefully (e.g. fall back to writing HTML to disk).
 */

import puppeteer, { type Browser, type PDFOptions as PuppeteerPDFOptions } from "puppeteer-core";

// `puppeteer-core`'s Browser type uses an opaque `Browser` interface.
// We'll lean on its API surface and not try to model every nested type.

export type RendererErrorCode =
  | "not_configured"
  | "connect_failed"
  | "render_failed";

export class RendererError extends Error {
  constructor(public code: RendererErrorCode, message: string, public cause?: unknown) {
    super(message);
    this.name = "RendererError";
  }
}

export interface RenderOptions {
  format?: "A4" | "Letter";
  printBackground?: boolean;
  margin?: PuppeteerPDFOptions["margin"];
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  /** Extra page-load wait in ms after `setContent`. Useful for charts. */
  postLoadWaitMs?: number;
}

class DocumentRenderer {
  private browser: Browser | null = null;
  private connectPromise: Promise<Browser> | null = null;

  get configured(): boolean {
    return !!process.env.CHROMIUM_WS_ENDPOINT;
  }

  /**
   * Render the given HTML to a PDF buffer. Throws RendererError on any
   * failure; caller decides whether to retry, fall back, or surface to user.
   */
  async renderToPdf(html: string, opts: RenderOptions = {}): Promise<Buffer> {
    if (!this.configured) {
      throw new RendererError(
        "not_configured",
        "CHROMIUM_WS_ENDPOINT is not set. Start the sidecar with `docker compose --profile pdf up -d`.",
      );
    }

    const browser = await this.getBrowser();
    let page;
    try {
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });

      if (opts.postLoadWaitMs && opts.postLoadWaitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, opts.postLoadWaitMs));
      }

      const pdfBuffer = await page.pdf({
        format: opts.format ?? "A4",
        printBackground: opts.printBackground ?? true,
        displayHeaderFooter: opts.displayHeaderFooter ?? false,
        headerTemplate: opts.headerTemplate,
        footerTemplate: opts.footerTemplate,
        margin: opts.margin ?? {
          top: "80px",
          bottom: "80px",
          left: "60px",
          right: "60px",
        },
      });

      return Buffer.from(pdfBuffer);
    } catch (err) {
      throw new RendererError(
        "render_failed",
        err instanceof Error ? err.message : "Unknown render failure",
        err,
      );
    } finally {
      if (page) {
        await page.close().catch(() => {
          // Page close failures are non-fatal — the browser will recycle.
        });
      }
    }
  }

  /**
   * Force-close the connection. The next renderToPdf will reconnect.
   * Called from server shutdown handlers; safe to call when not connected.
   */
  async disconnect(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.disconnect();
      } catch {
        // Already closed or never connected — ignore.
      }
      this.browser = null;
    }
    this.connectPromise = null;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // De-dupe concurrent connect attempts.
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connect()
      .then((b) => {
        this.browser = b;
        b.on("disconnected", () => {
          // CDP socket closed — null out so the next call reconnects.
          if (this.browser === b) {
            this.browser = null;
          }
        });
        this.connectPromise = null;
        return b;
      })
      .catch((err) => {
        this.connectPromise = null;
        throw err;
      });

    return this.connectPromise;
  }

  private async connect(): Promise<Browser> {
    const endpoint = process.env.CHROMIUM_WS_ENDPOINT!;

    // The sidecar exposes both ws:// (browserWSEndpoint) and http:// (browserURL).
    // Accept either by routing through the right field; default to ws://.
    const useHttp = endpoint.startsWith("http://") || endpoint.startsWith("https://");

    try {
      return await puppeteer.connect(
        useHttp
          ? { browserURL: endpoint }
          : { browserWSEndpoint: endpoint },
      );
    } catch (err) {
      throw new RendererError(
        "connect_failed",
        `Failed to connect to Chromium sidecar at ${endpoint}. ` +
          "Is the chromium-shell service running? Try: docker compose --profile pdf ps",
        err,
      );
    }
  }
}

export const documentRenderer = new DocumentRenderer();
