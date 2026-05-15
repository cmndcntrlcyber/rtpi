/**
 * v2.9.3 Phase 5 — unit tests for the default MCP catalog.
 *
 * Covers:
 * - Catalog shape: every entry has a unique seedKey; every required-secret
 *   key is also declared in the entry's env so PATCH /:id/secrets always
 *   finds the column to write into.
 * - needsConfig() helper: covers all the missing/empty/whitespace cases plus
 *   the null env defensive path. The catalog and helper are pure data, so
 *   no DB mocks are required.
 *
 * The full syncDefaultCatalog() flow is exercised end-to-end via Playwright
 * (future Phase 5 expansion); mocking the Drizzle insert chain here would
 * mostly be brittle ceremony.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MCP_CATALOG,
  DefaultMcpEntry,
} from "../../../server/services/mcp/default-servers-catalog";
import { needsConfig } from "../../../server/services/mcp/catalog-sync";

describe("DEFAULT_MCP_CATALOG", () => {
  it("ships exactly 11 entries (matches v2.9.3 doc)", () => {
    expect(DEFAULT_MCP_CATALOG).toHaveLength(11);
  });

  it("has a unique seedKey on every entry", () => {
    const keys = DEFAULT_MCP_CATALOG.map((e) => e.seedKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("namespaces every seedKey under 'default:' so user rows can never collide", () => {
    for (const entry of DEFAULT_MCP_CATALOG) {
      expect(entry.seedKey.startsWith("default:")).toBe(true);
    }
  });

  it("declares each requiredSecret key in the entry's env so PATCH has a slot to write", () => {
    for (const entry of DEFAULT_MCP_CATALOG) {
      for (const secretKey of entry.requiredSecrets) {
        expect(entry.env).toHaveProperty(secretKey);
        // Must seed as empty string so needsConfig() flags it until set.
        expect(entry.env[secretKey]).toBe("");
      }
    }
  });

  it("uses non-empty command and at least one arg per entry", () => {
    for (const entry of DEFAULT_MCP_CATALOG) {
      expect(entry.command.trim().length).toBeGreaterThan(0);
      expect(entry.args.length).toBeGreaterThan(0);
    }
  });

  it("seeds servers needing API keys (github, tavily) and not the rest", () => {
    const withSecrets = DEFAULT_MCP_CATALOG
      .filter((e) => e.requiredSecrets.length > 0)
      .map((e) => e.seedKey)
      .sort();
    expect(withSecrets).toEqual(["default:github", "default:tavily"]);
  });
});

describe("needsConfig()", () => {
  const noSecrets: Pick<DefaultMcpEntry, "requiredSecrets"> = { requiredSecrets: [] };
  const oneSecret: Pick<DefaultMcpEntry, "requiredSecrets"> = {
    requiredSecrets: ["TAVILY_API_KEY"],
  };
  const twoSecrets: Pick<DefaultMcpEntry, "requiredSecrets"> = {
    requiredSecrets: ["GITHUB_PERSONAL_ACCESS_TOKEN", "GITHUB_HOST"],
  };

  it("returns false when the entry declares no secrets", () => {
    expect(needsConfig({}, noSecrets)).toBe(false);
    expect(needsConfig({ FOO: "bar" }, noSecrets)).toBe(false);
    expect(needsConfig(null, noSecrets)).toBe(false);
    expect(needsConfig(undefined, noSecrets)).toBe(false);
  });

  it("returns true when a required key is missing entirely", () => {
    expect(needsConfig({}, oneSecret)).toBe(true);
    expect(needsConfig({ OTHER: "value" }, oneSecret)).toBe(true);
  });

  it("returns true when a required key is an empty string", () => {
    expect(needsConfig({ TAVILY_API_KEY: "" }, oneSecret)).toBe(true);
  });

  it("returns true when a required key is whitespace-only", () => {
    expect(needsConfig({ TAVILY_API_KEY: "   " }, oneSecret)).toBe(true);
    expect(needsConfig({ TAVILY_API_KEY: "\n\t" }, oneSecret)).toBe(true);
  });

  it("returns true when a required key is non-string (defensive)", () => {
    expect(needsConfig({ TAVILY_API_KEY: 42 as unknown as string }, oneSecret)).toBe(true);
    expect(needsConfig({ TAVILY_API_KEY: null as unknown as string }, oneSecret)).toBe(true);
  });

  it("returns false only when every required key has a non-empty string value", () => {
    expect(needsConfig({ TAVILY_API_KEY: "tvly-abc" }, oneSecret)).toBe(false);
    expect(
      needsConfig(
        { GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_xxx", GITHUB_HOST: "github.com" },
        twoSecrets,
      ),
    ).toBe(false);
  });

  it("returns true when at least one of multiple required keys is unset", () => {
    expect(
      needsConfig({ GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_xxx" }, twoSecrets),
    ).toBe(true);
    expect(
      needsConfig(
        { GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_xxx", GITHUB_HOST: "" },
        twoSecrets,
      ),
    ).toBe(true);
  });

  it("handles null and undefined env arguments without throwing", () => {
    expect(needsConfig(null, oneSecret)).toBe(true);
    expect(needsConfig(undefined, oneSecret)).toBe(true);
  });
});
