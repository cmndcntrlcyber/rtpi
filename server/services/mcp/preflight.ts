/**
 * v2.9.3 self-healing — preflight validator for MCP server spawns.
 *
 * Runs once before every `startServer()`. Catches common failure modes early
 * (missing command, missing filesystem root, disabled-by-default rows) so a
 * misconfigured row records a single actionable error instead of looping
 * through `maxRestarts` failed spawns. Auto-creates filesystem-root paths
 * for the `@modelcontextprotocol/server-filesystem` MCP server, which is the
 * single most common cause of "spawned but immediately broken" rows.
 *
 * The preflight is intentionally a *static check* — it never tries to
 * `npm view` a package or hit the network. That keeps it fast (sub-100ms)
 * and reliable in air-gapped deployments. Network-dependent failures
 * (npm 404, registry timeout) still surface through the spawn's exit code.
 */

import { promises as fs } from "fs";
import path from "path";
import { resolveMcpFsRoot } from "./catalog-sync";
import { createLogger } from '../../lib/logger';
const log = createLogger("preflight");

export type PreflightFailureKind =
  | "command_missing"
  | "path_unwritable"
  | "disabled_by_default"
  | "internal";

export type PreflightResult =
  | { ok: true }
  | { ok: false; kind: PreflightFailureKind; message: string };

export interface PreflightInput {
  command: string;
  args: readonly string[];
  lastError?: string | null;
}

const FILESYSTEM_SERVER_PACKAGE = "@modelcontextprotocol/server-filesystem";

/**
 * Resolve `which <command>` without shelling out (which would lose error
 * detail). Returns null when the command is not found in PATH.
 */
async function commandInPath(command: string): Promise<string | null> {
  // Absolute path — just check it's executable.
  if (path.isAbsolute(command)) {
    try {
      await fs.access(command, fs.constants.X_OK);
      return command;
    } catch {
      return null;
    }
  }

  const pathEnv = process.env.PATH ?? "";
  const separator = process.platform === "win32" ? ";" : ":";
  const dirs = pathEnv.split(separator).filter((d) => d.length > 0);
  for (const dir of dirs) {
    const candidate = path.join(dir, command);
    try {
      await fs.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // try next dir
    }
  }
  return null;
}

/**
 * For the MCP filesystem server, find the path arguments and ensure each one
 * exists. Creates missing directories with `recursive: true`. Returns the
 * first error encountered, or null on success.
 *
 * The filesystem server takes one or more directory paths after the package
 * arg (`npx -y @modelcontextprotocol/server-filesystem <dir1> <dir2> ...`).
 * Anything that doesn't look like a path (starts with `-` or doesn't contain
 * `/`) is skipped to avoid false positives on flag args.
 */
async function ensureFilesystemRoots(args: readonly string[]): Promise<string | null> {
  const pkgIndex = args.findIndex((a) => a === FILESYSTEM_SERVER_PACKAGE);
  if (pkgIndex < 0) return null;

  const pathArgs = args
    .slice(pkgIndex + 1)
    .filter((a) => !a.startsWith("-") && (a.startsWith("/") || a.startsWith(".") || a.includes(path.sep)));

  for (const dir of pathArgs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      // Also verify we can write — mkdir succeeds for read-only mounts on
      // some filesystems but the server will fail later.
      await fs.access(dir, fs.constants.W_OK);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `cannot create or write to filesystem root '${dir}': ${message}`;
    }
  }
  return null;
}

export async function preflightServer(input: PreflightInput): Promise<PreflightResult> {
  // 1. Disabled-by-default rows carry a `[disabled] ...` last_error. Refuse
  //    to start so the operator gets the message, not an opaque exit code.
  if (input.lastError && input.lastError.startsWith("[disabled]")) {
    return {
      ok: false,
      kind: "disabled_by_default",
      message: input.lastError.replace(/^\[disabled\]\s*/, ""),
    };
  }

  // 2. Command must exist in PATH (or be an absolute executable path).
  const resolved = await commandInPath(input.command);
  if (!resolved) {
    return {
      ok: false,
      kind: "command_missing",
      message: `command '${input.command}' not found in PATH`,
    };
  }

  // 3. Filesystem servers need their root directories to exist + be writable.
  const fsErr = await ensureFilesystemRoots(input.args);
  if (fsErr) {
    return { ok: false, kind: "path_unwritable", message: fsErr };
  }

  return { ok: true };
}

// Re-export so callers don't need a separate import.
export { resolveMcpFsRoot };

/**
 * Quick smoke test for the preflight in dev environments — not used in
 * production. Logs which commands resolve and which paths are creatable.
 */
export async function runDiagnostics(): Promise<void> {
  const tools = ["npx", "uvx", "node", "uv"];
  for (const tool of tools) {
    const found = await commandInPath(tool);
    log.info(`[preflight-diag] ${tool}: ${found ?? "MISSING"}`);
  }
  const fsRoot = resolveMcpFsRoot();
  try {
    await fs.mkdir(fsRoot, { recursive: true });
    log.info(`[preflight-diag] fs root ready: ${fsRoot}`);
  } catch (err) {
    log.error(`[preflight-diag] fs root FAILED: ${fsRoot} -> ${err}`);
  }
}

// Allow callers to detect the wrapper without instanceof checks.
export const PREFLIGHT_ERROR_PREFIX = "[preflight";

export function formatPreflightError(result: Extract<PreflightResult, { ok: false }>): string {
  return `${PREFLIGHT_ERROR_PREFIX} ${result.kind}] ${result.message}`;
}

// Bridge for the API layer: detect rows whose lastError came from preflight
// vs. from a real spawn failure (used by the future "view error" UI).
function _typeAssertExports(): void {
  // hint to TS that types are exported intentionally
  const _: PreflightFailureKind = "command_missing";
  void _;
}
void _typeAssertExports;
