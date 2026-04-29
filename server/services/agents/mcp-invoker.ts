/**
 * MCP Invoker (v2.9.1 Phase 5, seam S3)
 *
 * Talks JSON-RPC 2.0 over stdio to the MCP servers managed by
 * mcp-server-manager. Replaces the TODO mock that previously lived in
 * server/api/v1/agent-mcp.ts:54-61.
 *
 * Surfaces:
 *   - listTools(serverId)   — calls `tools/list` (cached 60s per server)
 *   - callTool(serverId, name, args) — calls `tools/call`
 *   - probe(serverId)       — runs `initialize` and writes the result to
 *                              mcp_servers.last_probe_at / last_probe_ok
 *   - startProbeLoop()      — invoked once at boot; probes every 30s.
 *
 * The protocol matches the published Model Context Protocol spec at
 * https://spec.modelcontextprotocol.io/specification/. We implement only the
 * three methods listed above; advanced features (resources, prompts,
 * sampling) can be layered later.
 */

import type { ChildProcess } from "child_process";
import { db } from "../../db";
import { mcpServers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { mcpServerManager } from "../mcp-server-manager";

// --- Types ------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPCallResult {
  content?: Array<{ type: string; text?: string; data?: any }>;
  isError?: boolean;
}

export class MCPInvokerError extends Error {
  constructor(
    public code: "not_running" | "timeout" | "rpc_error" | "protocol_error",
    message: string,
    public rpcCode?: number,
  ) {
    super(message);
    this.name = "MCPInvokerError";
  }
}

// --- Per-server state -------------------------------------------------------

interface ServerState {
  /** Pending requests keyed by JSON-RPC id. */
  pending: Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }>;
  nextId: number;
  /** stdout line buffer (JSON-RPC messages are newline-delimited per MCP spec). */
  buffer: string;
  /** Last initialize result (cached after first probe). */
  initialized: boolean;
  /** Cached tools list for `listTools()`. */
  toolsCache?: { at: number; tools: MCPTool[] };
  /** True once stdout/stderr listeners have been attached for this process. */
  attached: boolean;
}

const TOOLS_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const PROBE_INTERVAL_MS = 30_000;

class MCPInvoker {
  private state = new Map<string, ServerState>();
  private probeInterval: NodeJS.Timeout | null = null;

  /**
   * Send `tools/list` to the MCP server. Cached 60s per server.
   */
  async listTools(serverId: string): Promise<MCPTool[]> {
    const state = this.attach(serverId);
    if (state.toolsCache && Date.now() - state.toolsCache.at < TOOLS_CACHE_TTL_MS) {
      return state.toolsCache.tools;
    }
    await this.ensureInitialized(serverId);
    const result = await this.request<{ tools?: MCPTool[] }>(serverId, "tools/list", {});
    const tools = Array.isArray(result.tools) ? result.tools : [];
    state.toolsCache = { at: Date.now(), tools };
    return tools;
  }

  /**
   * Send `tools/call` to the MCP server. Returns the structured result
   * (content blocks); throws MCPInvokerError on RPC failure.
   */
  async callTool(serverId: string, name: string, args: Record<string, unknown> = {}): Promise<MCPCallResult> {
    await this.ensureInitialized(serverId);
    const result = await this.request<MCPCallResult>(serverId, "tools/call", {
      name,
      arguments: args,
    });
    return result;
  }

  /**
   * Single liveness probe. Runs `initialize` if not yet done, otherwise
   * `tools/list` (which exercises the round-trip). Writes the result to
   * mcp_servers.last_probe_at / last_probe_ok.
   */
  async probe(serverId: string): Promise<boolean> {
    let ok = false;
    try {
      await this.ensureInitialized(serverId);
      // Use tools/list as a heartbeat — cheap and exercises the actual transport.
      await this.request(serverId, "tools/list", {}, { timeoutMs: 5_000 });
      ok = true;
    } catch {
      ok = false;
    }
    try {
      await db
        .update(mcpServers)
        .set({ lastProbeAt: new Date(), lastProbeOk: ok })
        .where(eq(mcpServers.id, serverId));
    } catch {
      // Probe state is best-effort; never let a DB error mask the result.
    }
    return ok;
  }

  /**
   * Start the periodic probe loop. Called once at module load — idempotent.
   * Skipped under NODE_ENV=test so unit tests don't see background traffic.
   */
  startProbeLoop(): void {
    if (this.probeInterval || process.env.NODE_ENV === "test") return;
    this.probeInterval = setInterval(() => {
      this.probeAll().catch((err) => {
        console.warn("[mcp-invoker] probe loop tick failed:", err);
      });
    }, PROBE_INTERVAL_MS);
    this.probeInterval.unref?.();
  }

  /** Probe every running MCP server once. */
  async probeAll(): Promise<void> {
    const servers = await db.select({ id: mcpServers.id, status: mcpServers.status }).from(mcpServers);
    await Promise.all(
      servers.filter((s) => s.status === "running").map((s) => this.probe(s.id)),
    );
  }

  // ---------------------------------------------------------------------
  // Internal: stdio attach + JSON-RPC framing
  // ---------------------------------------------------------------------

  private attach(serverId: string): ServerState {
    let state = this.state.get(serverId);
    if (!state) {
      state = {
        pending: new Map(),
        nextId: 1,
        buffer: "",
        initialized: false,
        attached: false,
      };
      this.state.set(serverId, state);
    }

    if (state.attached) return state;

    const proc = mcpServerManager.getChildProcess(serverId);
    if (!proc || !proc.stdout || !proc.stdin) {
      // Not running yet — leave state non-attached; ensureInitialized will throw.
      return state;
    }

    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => this.onData(serverId, chunk));
    proc.stdout.on("close", () => this.onClose(serverId));
    state.attached = true;
    return state;
  }

  private onData(serverId: string, chunk: string): void {
    const state = this.state.get(serverId);
    if (!state) return;
    state.buffer += chunk;

    // MCP servers emit one JSON-RPC message per line over stdout.
    let idx: number;
    while ((idx = state.buffer.indexOf("\n")) >= 0) {
      const line = state.buffer.slice(0, idx).trim();
      state.buffer = state.buffer.slice(idx + 1);
      if (!line) continue;

      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(line);
      } catch {
        // Skip non-JSON lines (some servers print banners on startup).
        continue;
      }

      if (typeof msg.id !== "number" && typeof msg.id !== "string") continue;
      const idNum = Number(msg.id);
      const pending = state.pending.get(idNum);
      if (!pending) continue;

      clearTimeout(pending.timer);
      state.pending.delete(idNum);

      if (msg.error) {
        pending.reject(
          new MCPInvokerError(
            "rpc_error",
            `MCP error: ${msg.error.message}`,
            msg.error.code,
          ),
        );
      } else {
        pending.resolve(msg.result);
      }
    }
  }

  private onClose(serverId: string): void {
    const state = this.state.get(serverId);
    if (!state) return;
    for (const { reject, timer } of state.pending.values()) {
      clearTimeout(timer);
      reject(new MCPInvokerError("not_running", "MCP server stdout closed before reply"));
    }
    state.pending.clear();
    state.initialized = false;
    state.attached = false;
    state.toolsCache = undefined;
  }

  private async request<T = any>(
    serverId: string,
    method: string,
    params: unknown,
    opts: { timeoutMs?: number } = {},
  ): Promise<T> {
    const state = this.attach(serverId);
    const proc = mcpServerManager.getChildProcess(serverId);
    if (!proc || !proc.stdin || !state.attached) {
      throw new MCPInvokerError("not_running", "MCP server is not running");
    }

    const id = state.nextId++;
    const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        state.pending.delete(id);
        reject(new MCPInvokerError("timeout", `${method} timed out after ${opts.timeoutMs ?? REQUEST_TIMEOUT_MS}ms`));
      }, opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
      timer.unref?.();

      state.pending.set(id, { resolve, reject, timer });

      const wrote = proc.stdin!.write(JSON.stringify(req) + "\n", (err) => {
        if (err) {
          clearTimeout(timer);
          state.pending.delete(id);
          reject(new MCPInvokerError("not_running", `Failed to write to MCP server: ${err.message}`));
        }
      });
      if (!wrote) {
        // Backpressure — node will queue, we just keep the pending entry.
      }
    });
  }

  private async ensureInitialized(serverId: string): Promise<void> {
    const state = this.state.get(serverId) ?? this.attach(serverId);
    if (state.initialized) return;
    // MCP `initialize` handshake. Minimum-viable params per spec rev 2025-06-18.
    await this.request(serverId, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "rtpi-orchestrator", version: "2.9.1" },
    });
    state.initialized = true;
  }
}

export const mcpInvoker = new MCPInvoker();
mcpInvoker.startProbeLoop();
