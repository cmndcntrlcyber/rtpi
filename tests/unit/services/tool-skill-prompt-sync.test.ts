/**
 * Tests for tool-skill-prompt-sync — the workflow that rewrites an agent's
 * system prompt to match its current toolset.
 *
 * Pins:
 *   - FF_TOOL_SKILL_GENERATION off → no DB read, returns flag_disabled
 *   - Missing agent → agent_not_found, no writes
 *   - No skills + no existing section → no-op
 *   - New skills + empty prompt → deterministic insert (no reasoning call)
 *   - Existing section + new skills → reasoning model rewrite when available;
 *     deterministic splice when the reasoning model fails
 *   - Empty desired section → removes the section
 */

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks so vi.mock factories can reach them.
const mocks = vi.hoisted(() => {
  const updateChain = {
    set: vi.fn(),
    where: vi.fn(),
  };
  const dbMock = {
    select: vi.fn(),
    update: vi.fn(() => updateChain),
  };
  const routeReasoningMock = vi.fn();
  class NoInferenceProviderAvailableMock extends Error {
    attempts: any[] = [];
    kind = "reasoning" as const;
  }
  return { updateChain, dbMock, routeReasoningMock, NoInferenceProviderAvailableMock };
});

vi.mock("../../../server/db", () => ({ db: mocks.dbMock }));
vi.mock("../../../server/services/inference/inference-router", () => ({
  routeReasoning: mocks.routeReasoningMock,
  NoInferenceProviderAvailable: mocks.NoInferenceProviderAvailableMock,
}));

const { updateChain, dbMock, routeReasoningMock, NoInferenceProviderAvailableMock } = mocks;

import {
  applySkillSectionDirect,
  loadAgentToolSkills,
  renderSkillSection,
  syncAgentPromptForToolset,
} from "../../../server/services/agents/tool-skill-prompt-sync";

let scratchDir: string;

beforeEach(async () => {
  scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), "tspsync-"));
  process.env.FF_TOOL_SKILL_GENERATION = "true";
  routeReasoningMock.mockReset();
  updateChain.set.mockReset().mockReturnValue(updateChain);
  updateChain.where.mockReset().mockResolvedValue(undefined);
  dbMock.select.mockReset();
  dbMock.update.mockReset().mockReturnValue(updateChain);
});

afterEach(async () => {
  await fs.rm(scratchDir, { recursive: true, force: true });
  delete process.env.FF_TOOL_SKILL_GENERATION;
});

/** Writes a skill file under the scratch dir and returns its absolute path. */
async function writeSkill(relPath: string, body: string): Promise<string> {
  const abs = path.join(scratchDir, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body, "utf-8");
  return abs;
}

/**
 * Set up the agent SELECT chain: db.select().from(agents).where(eq(id, ...))
 * yields [agent]. Every other SELECT for skill rows yields its own array.
 *
 * The implementation always reads the agent first via `select().from().where()`,
 * then conditionally pulls mcp/registry/security rows the same way.
 */
function mockSelectQueue(queue: Array<unknown[]>) {
  let i = 0;
  dbMock.select.mockImplementation(() => ({
    from: () => ({
      where: () => Promise.resolve(queue[i++] ?? []),
    }),
  }));
}

describe("flag gating", () => {
  it("returns flag_disabled and never touches the DB when FF is off", async () => {
    delete process.env.FF_TOOL_SKILL_GENERATION;
    const result = await syncAgentPromptForToolset("agent-1");
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("flag_disabled");
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("missing agent", () => {
  it("returns agent_not_found when the SELECT returns []", async () => {
    mockSelectQueue([[]]);
    const result = await syncAgentPromptForToolset("missing");
    expect(result.reason).toBe("agent_not_found");
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("no skills and no section", () => {
  it("returns no_skills without writing anything", async () => {
    mockSelectQueue([
      [{ id: "a1", config: { systemPrompt: "Base prompt with no skill section." } }],
    ]);
    const result = await syncAgentPromptForToolset("a1");
    expect(result.reason).toBe("no_skills");
    expect(result.changed).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("empty prompt + fresh skills", () => {
  it("uses the deterministic splice (skips reasoning) and persists", async () => {
    const skillPath = await writeSkill("skills/tools/mcp/abc.md", "Body of abc skill\n");

    mockSelectQueue([
      [{ id: "a2", config: { systemPrompt: "", mcpServerIds: ["abc"] } }],
      [{ id: "abc", name: "Abc Tool", skillPath }],
    ]);

    const result = await syncAgentPromptForToolset("a2");
    expect(result.reason).toBe("synced");
    expect(result.changed).toBe(true);
    expect(result.afterPrompt).toContain("## Tool Skills");
    expect(result.afterPrompt).toContain("Body of abc skill");
    expect(routeReasoningMock).not.toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalledTimes(1);
  });
});

describe("existing prompt + new skills → reasoning rewrite", () => {
  it("uses the reasoning model's output when available", async () => {
    const skillPath = await writeSkill("skills/tools/mcp/foo.md", "Foo body\n");

    mockSelectQueue([
      [
        {
          id: "a3",
          config: {
            systemPrompt: "# Role\n\nYou are a tester.\n\n## Tool Skills\n\nOLD\n",
            mcpServerIds: ["foo"],
          },
        },
      ],
      [{ id: "foo", name: "Foo", skillPath }],
    ]);
    routeReasoningMock.mockResolvedValueOnce({
      response: { text: "# Role\n\nYou are a tester.\n\n## Tool Skills\n\nNEW REWRITTEN\n" },
      provider: "anthropic",
      model: "test",
      source: "settings_kind",
      attempts: [],
    });

    const result = await syncAgentPromptForToolset("a3");
    expect(result.changed).toBe(true);
    expect(result.afterPrompt).toContain("NEW REWRITTEN");
    expect(result.afterPrompt).not.toContain("OLD");
    expect(routeReasoningMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to deterministic splice when reasoning model fails", async () => {
    const skillPath = await writeSkill("skills/tools/mcp/foo.md", "Foo body\n");

    mockSelectQueue([
      [
        {
          id: "a4",
          config: {
            systemPrompt: "# Role\n\nYou are a tester.\n\n## Tool Skills\n\nOLD\n",
            mcpServerIds: ["foo"],
          },
        },
      ],
      [{ id: "foo", name: "Foo", skillPath }],
    ]);
    routeReasoningMock.mockRejectedValueOnce(new NoInferenceProviderAvailableMock("exhausted"));

    const result = await syncAgentPromptForToolset("a4");
    expect(result.changed).toBe(true);
    // Deterministic splice preserves the prefix and swaps the section.
    expect(result.afterPrompt).toContain("# Role");
    expect(result.afterPrompt).toContain("You are a tester");
    expect(result.afterPrompt).toContain("Foo body");
    expect(result.afterPrompt).not.toContain("OLD");
  });
});

describe("desired section empty (toolset emptied)", () => {
  it("removes the existing Tool Skills section via deterministic splice", async () => {
    // No skills selected; existing section present → after-prompt drops it.
    mockSelectQueue([
      [
        {
          id: "a5",
          config: {
            systemPrompt: "# Role\n\n## Tool Skills\n\nold stuff\n\n## Other\n\nkeep me\n",
          },
        },
      ],
    ]);
    // Reasoning model returns the desired stripped form.
    routeReasoningMock.mockResolvedValueOnce({
      response: { text: "# Role\n\n## Other\n\nkeep me\n" },
      provider: "anthropic",
      model: "test",
      source: "settings_kind",
      attempts: [],
    });

    const result = await syncAgentPromptForToolset("a5");
    expect(result.changed).toBe(true);
    expect(result.afterPrompt).not.toContain("## Tool Skills");
    expect(result.afterPrompt).toContain("## Other");
    expect(result.afterPrompt).toContain("keep me");
  });
});

describe("renderSkillSection", () => {
  it("returns empty string when there are no entries", () => {
    expect(renderSkillSection([])).toBe("");
  });

  it("renders one block per entry with name and body inline", () => {
    const out = renderSkillSection([
      { registry: "mcp", rowId: "id1", name: "Tool One", skillPath: "skills/tools/mcp/id1.md", body: "Body 1" },
      { registry: "registry", rowId: "id2", name: "Tool Two", skillPath: "skills/tools/registry/id2.md", body: null },
    ]);
    expect(out).toContain("## Tool Skills");
    expect(out).toContain("### Tool One");
    expect(out).toContain("Body 1");
    expect(out).toContain("### Tool Two");
    // Missing body falls back to a pointer note rather than empty content.
    expect(out).toContain("skills/tools/registry/id2.md");
  });
});

describe("applySkillSectionDirect", () => {
  it("appends a Tool Skills section when none exists", () => {
    const out = applySkillSectionDirect("# Role\n\nDoer.", "## Tool Skills\n\nNew\n");
    expect(out).toContain("# Role");
    expect(out).toContain("## Tool Skills");
    expect(out).toContain("New");
  });

  it("replaces an existing Tool Skills section in place, preserving siblings", () => {
    const before = "# Role\n\n## Tool Skills\n\nOLD\n\n## Conduct\n\nBe nice.\n";
    const out = applySkillSectionDirect(before, "## Tool Skills\n\nNEW\n");
    expect(out).not.toContain("OLD");
    expect(out).toContain("NEW");
    expect(out).toContain("## Conduct");
    expect(out).toContain("Be nice.");
  });
});

describe("loadAgentToolSkills", () => {
  it("returns [] when neither mcpServerIds nor enabledTools are set", async () => {
    const out = await loadAgentToolSkills({});
    expect(out).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});
