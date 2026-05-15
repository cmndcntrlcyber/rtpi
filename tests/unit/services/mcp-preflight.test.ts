/**
 * v2.9.3 self-healing — tests for preflight validator + helpers.
 *
 * The preflight is the single point of defense against the failure modes
 * that bit us on the first cut of v2.9.3:
 *   - command not in PATH (bare typo, missing tool install)
 *   - filesystem MCP server pointed at a non-existent path
 *   - row marked disabled-by-default
 *
 * These tests pin those branches so a future refactor can't silently regress
 * the spawn-fails-loudly-instead-of-looping behavior.
 */

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  preflightServer,
  formatPreflightError,
  PREFLIGHT_ERROR_PREFIX,
} from "../../../server/services/mcp/preflight";
import {
  resolveCatalogArgs,
  resolveMcpFsRoot,
} from "../../../server/services/mcp/catalog-sync";
import {
  DEFAULT_MCP_CATALOG,
  MCP_FS_ROOT_PLACEHOLDER,
} from "../../../server/services/mcp/default-servers-catalog";

let scratchDir: string;
let originalFsRoot: string | undefined;
let originalPath: string | undefined;

beforeAll(async () => {
  scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-preflight-"));
  originalFsRoot = process.env.MCP_FS_ROOT;
  originalPath = process.env.PATH;
});

afterAll(async () => {
  if (originalFsRoot === undefined) delete process.env.MCP_FS_ROOT;
  else process.env.MCP_FS_ROOT = originalFsRoot;
  if (originalPath !== undefined) process.env.PATH = originalPath;
  await fs.rm(scratchDir, { recursive: true, force: true });
});

describe("resolveMcpFsRoot()", () => {
  it("honors MCP_FS_ROOT when set and non-empty", () => {
    process.env.MCP_FS_ROOT = "/custom/mcp/root";
    expect(resolveMcpFsRoot()).toBe("/custom/mcp/root");
  });

  it("trims whitespace-only env values back to the cwd default", () => {
    process.env.MCP_FS_ROOT = "   ";
    expect(resolveMcpFsRoot()).toBe(path.resolve(process.cwd(), "mcp-workspace"));
  });

  it("falls back to <cwd>/mcp-workspace when env is unset", () => {
    delete process.env.MCP_FS_ROOT;
    expect(resolveMcpFsRoot()).toBe(path.resolve(process.cwd(), "mcp-workspace"));
  });
});

describe("resolveCatalogArgs()", () => {
  it("substitutes ${MCP_FS_ROOT} placeholder in args", () => {
    process.env.MCP_FS_ROOT = "/foo/bar";
    const out = resolveCatalogArgs(["-y", "@modelcontextprotocol/server-filesystem", MCP_FS_ROOT_PLACEHOLDER]);
    expect(out).toEqual(["-y", "@modelcontextprotocol/server-filesystem", "/foo/bar"]);
  });

  it("leaves args without the placeholder untouched", () => {
    const out = resolveCatalogArgs(["-y", "@modelcontextprotocol/server-fetch"]);
    expect(out).toEqual(["-y", "@modelcontextprotocol/server-fetch"]);
  });

  it("supports embedded ${MCP_FS_ROOT} substitution within larger strings", () => {
    process.env.MCP_FS_ROOT = "/abs";
    const out = resolveCatalogArgs(["--root=${MCP_FS_ROOT}/data"]);
    expect(out).toEqual(["--root=/abs/data"]);
  });
});

describe("preflightServer() — command resolution", () => {
  it("succeeds when the command exists in PATH (npx is always present in dev)", async () => {
    const result = await preflightServer({
      command: "npx",
      args: ["-y", "some-package"],
    });
    expect(result.ok).toBe(true);
  });

  it("fails with command_missing when the command is not in PATH", async () => {
    const result = await preflightServer({
      command: "this-command-does-not-exist-9z9z9",
      args: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("command_missing");
      expect(result.message).toContain("this-command-does-not-exist-9z9z9");
    }
  });

  it("succeeds for an absolute path that points at an executable", async () => {
    const result = await preflightServer({
      command: "/bin/sh",
      args: [],
    });
    expect(result.ok).toBe(true);
  });

  it("fails for an absolute path that does not exist", async () => {
    const result = await preflightServer({
      command: "/nonexistent/tool/zzzzzz",
      args: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("command_missing");
  });
});

describe("preflightServer() — filesystem root auto-creation", () => {
  it("creates a missing filesystem root for the @modelcontextprotocol/server-filesystem package", async () => {
    const target = path.join(scratchDir, "auto-created-root", "nested");
    // Sanity: doesn't exist yet
    await expect(fs.access(target)).rejects.toBeTruthy();

    const result = await preflightServer({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", target],
    });
    expect(result.ok).toBe(true);
    // Now it exists and is writable
    await expect(fs.access(target, fs.constants.W_OK)).resolves.toBeUndefined();
  });

  it("ignores flag-shaped args after the filesystem package (no false positives)", async () => {
    const result = await preflightServer({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "--debug"],
    });
    // No paths to create, command exists → should succeed.
    expect(result.ok).toBe(true);
  });

  it("does not auto-create paths for non-filesystem MCP servers", async () => {
    const target = path.join(scratchDir, "should-not-be-created");
    const result = await preflightServer({
      command: "npx",
      args: ["-y", "tavily-mcp@latest", target],
    });
    expect(result.ok).toBe(true);
    // Path should still be absent — preflight only auto-creates for the
    // filesystem MCP server, not arbitrary path-shaped args.
    await expect(fs.access(target)).rejects.toBeTruthy();
  });
});

describe("preflightServer() — disabled-by-default rows", () => {
  it("refuses to start a row whose lastError begins with [disabled]", async () => {
    const result = await preflightServer({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
      lastError: "[disabled] npm package missing",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("disabled_by_default");
      expect(result.message).toBe("npm package missing");
    }
  });

  it("ignores [disabled] markers when checking other rows (no false positives)", async () => {
    // A row whose lastError is some other prefix should still get full preflight.
    const result = await preflightServer({
      command: "npx",
      args: [],
      lastError: "Process exited with code 1",
    });
    // Should succeed (npx exists; no filesystem args) — the spawn-failure
    // history is ignored by preflight, only [disabled] is special.
    expect(result.ok).toBe(true);
  });
});

describe("formatPreflightError()", () => {
  it("uses the documented prefix so the API can pattern-match", () => {
    const formatted = formatPreflightError({
      ok: false,
      kind: "command_missing",
      message: "uvx not found",
    });
    expect(formatted.startsWith(PREFLIGHT_ERROR_PREFIX)).toBe(true);
    expect(formatted).toContain("command_missing");
    expect(formatted).toContain("uvx not found");
  });
});

describe("catalog post-repair invariants", () => {
  it("filesystem entry uses the placeholder so preflight can auto-create the path", () => {
    const fs = DEFAULT_MCP_CATALOG.find((e) => e.seedKey === "default:filesystem")!;
    expect(fs.args).toContain(MCP_FS_ROOT_PLACEHOLDER);
  });

  it("searchcode is marked disabledByDefault with a non-empty reason", () => {
    const sc = DEFAULT_MCP_CATALOG.find((e) => e.seedKey === "default:searchcode")!;
    expect(sc.disabledByDefault).toBe(true);
    expect((sc.disabledReason ?? "").length).toBeGreaterThan(0);
  });

  it("arxiv installs from the GitHub source via uvx --from", () => {
    const arx = DEFAULT_MCP_CATALOG.find((e) => e.seedKey === "default:arxiv")!;
    expect(arx.command).toBe("uvx");
    expect(arx.args).toContain("--from");
    expect(arx.args.some((a) => a.includes("blazickjp/arxiv-mcp-server"))).toBe(true);
  });
});
