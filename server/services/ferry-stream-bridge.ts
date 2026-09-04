/**
 * Ferry Stream Bridge — v3.10.3a Sprint 3.1
 *
 * Consumes SSE streams from the ferry gateway and translates
 * events into the existing WebSocket event bus via
 * agentWebSocketManager.broadcastEvent(). This bridges
 * real-time nexus-harness execution progress into the RTPI
 * frontend without any frontend transport changes.
 *
 * Forward-compatibility note: /ferry/approvals/stream and
 * /ferry/notifications SSE endpoints are coded in the ferry
 * gateway but their backing gRPC RPCs return Unimplemented
 * until v3.10.2. The bridge connections will establish cleanly
 * but receive no events until then — when the handlers activate,
 * events flow automatically with zero RTPI code changes.
 */

import { readFeatureFlags } from "@shared/feature-flags";
import { createLogger } from "../lib/logger";
const log = createLogger("ferry-stream-bridge");

let EventSourceImpl: typeof import("eventsource").default | null = null;

export class FerryStreamBridge {
  private sources: InstanceType<NonNullable<typeof EventSourceImpl>>[] = [];
  private ferryUrl: string;
  private started = false;

  constructor() {
    this.ferryUrl = process.env.NEXUS_FERRY_URL || "http://127.0.0.1:9100";
  }

  async start(): Promise<void> {
    if (this.started) return;

    if (!readFeatureFlags(process.env).ferryBridge) {
      log.info("Ferry stream bridge disabled (FF_FERRY_BRIDGE=false)");
      return;
    }
    if (!process.env.NEXUS_FERRY_URL) {
      log.info("Ferry stream bridge skipped (NEXUS_FERRY_URL not set)");
      return;
    }

    try {
      const mod = await import("eventsource");
      EventSourceImpl = mod.default || (mod as any);
    } catch {
      log.warn("eventsource package not installed — ferry stream bridge disabled. Run: npm install eventsource");
      return;
    }

    const { agentWebSocketManager } = await import("./agent-websocket-manager");

    this.connectSSE("/ferry/approvals/stream", (data) => {
      agentWebSocketManager.broadcastEvent({
        type: "approval_request",
        eventId: data.approval_id || `ferry-approval-${Date.now()}`,
        data: { ...data, source: "ferry" },
        timestamp: new Date().toISOString(),
      });
    });

    this.connectSSE("/ferry/notifications", (data) => {
      agentWebSocketManager.broadcastEvent({
        type: "agent_activity",
        eventId: data.id || `ferry-notification-${Date.now()}`,
        data: { ...data, source: "ferry" },
        timestamp: new Date().toISOString(),
      });
    });

    this.started = true;
    log.info(`Ferry stream bridge connected to ${this.ferryUrl}`);
  }

  private connectSSE(path: string, handler: (data: any) => void): void {
    if (!EventSourceImpl) return;

    const url = `${this.ferryUrl}${path}`;
    const source = new EventSourceImpl(url);

    source.onmessage = (evt: any) => {
      try {
        handler(JSON.parse(evt.data));
      } catch (e) {
        log.warn(`Parse error on ${path}: ${e}`);
      }
    };

    source.onerror = () => {
      log.debug(`SSE ${path} reconnecting (auto-handled by EventSource)`);
    };

    this.sources.push(source);
  }

  stop(): void {
    for (const s of this.sources) {
      s.close();
    }
    this.sources = [];
    this.started = false;
  }
}

export const ferryStreamBridge = new FerryStreamBridge();
