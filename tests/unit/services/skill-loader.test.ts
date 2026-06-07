/**
 * Tests for skill-loader — the runtime read path that agent-prompt-generator
 * relies on to inject per-tool summaries into system prompts.
 *
 * Pins: file-not-found → null (never throws), malformed frontmatter → null,
 * and the happy path returns a fully populated summary including the repo-
 * relative skillPath.
 */

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadSkillBody, loadSkillSummary } from "../../../server/services/skills/skill-loader";

let scratchDir: string;
let originalRoot: string | undefined;

beforeAll(async () => {
  scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-loader-"));
  originalRoot = process.env.SKILL_DIR_ROOT;
  process.env.SKILL_DIR_ROOT = scratchDir;
  await fs.mkdir(path.join(scratchDir, "mcp"), { recursive: true });
});

afterEach(async () => {
  const dir = path.join(scratchDir, "mcp");
  for (const f of await fs.readdir(dir)) {
    await fs.unlink(path.join(dir, f));
  }
});

afterAll(async () => {
  if (originalRoot === undefined) delete process.env.SKILL_DIR_ROOT;
  else process.env.SKILL_DIR_ROOT = originalRoot;
  await fs.rm(scratchDir, { recursive: true, force: true });
});

describe("loadSkillSummary", () => {
  it("returns null when the file does not exist", async () => {
    const summary = await loadSkillSummary("mcp", "default:nonexistent");
    expect(summary).toBeNull();
  });

  it("returns parsed summary on the happy path", async () => {
    const fixture = [
      "---",
      "name: Tavily Search",
      "description: web search",
      "registry: mcp",
      "tool_id: default:tavily",
      "summary: Use for fresh web research queries.",
      "generated_at: 2026-05-19T00:00:00.000Z",
      "generated_by: anthropic",
      "source_hash: abc123",
      "---",
      "",
      "# Tavily",
      "Body content.",
    ].join("\n");
    await fs.writeFile(path.join(scratchDir, "mcp", "default-tavily.md"), fixture, "utf-8");

    const summary = await loadSkillSummary("mcp", "default:tavily");
    expect(summary).not.toBeNull();
    expect(summary?.name).toBe("Tavily Search");
    expect(summary?.summary).toBe("Use for fresh web research queries.");
    expect(summary?.skillPath).toBe("skills/tools/mcp/default-tavily.md");
    expect(summary?.frontmatter.tool_id).toBe("default:tavily");
  });

  it("returns null when frontmatter parsing fails", async () => {
    await fs.writeFile(
      path.join(scratchDir, "mcp", "default-broken.md"),
      "---\nname: [unterminated\n---\n\n# body\n",
      "utf-8",
    );
    expect(await loadSkillSummary("mcp", "default:broken")).toBeNull();
  });
});

describe("loadSkillBody", () => {
  it("returns the raw markdown body when present", async () => {
    await fs.writeFile(
      path.join(scratchDir, "mcp", "raw.md"),
      "raw markdown content",
      "utf-8",
    );
    expect(await loadSkillBody("mcp", "raw")).toBe("raw markdown content");
  });

  it("returns null for missing files", async () => {
    expect(await loadSkillBody("mcp", "missing")).toBeNull();
  });
});
