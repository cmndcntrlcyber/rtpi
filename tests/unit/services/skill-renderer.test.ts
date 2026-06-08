/**
 * Tests for skill-renderer — round-trips frontmatter + section ordering.
 *
 * The renderer's output shape is load-bearing: the loader greps frontmatter
 * from disk and injects it into agent prompts. If the renderer drops a
 * required heading or emits malformed YAML, the loader returns null and the
 * agent silently loses tool context.
 */

import { describe, expect, it } from "vitest";
import {
  REQUIRED_SECTIONS,
  renderSkillDocument,
  type SkillDocument,
} from "../../../server/services/skills/skill-renderer";
import { parseFrontmatter } from "../../../server/services/skills/skill-loader";

const baseDoc = (): SkillDocument => ({
  frontmatter: {
    name: "Tavily Search",
    description: "Web search backed by Tavily API",
    registry: "mcp",
    tool_id: "default:tavily",
    category: "research",
    tags: ["research", "web", "search"],
    mitre_techniques: [],
    summary: "Use for fresh web research queries.",
    sources: ["https://tavily.com/"],
    generated_at: "2026-05-19T00:00:00.000Z",
    generated_by: "anthropic",
    source_hash: "deadbeef",
  },
  sections: REQUIRED_SECTIONS.map((heading) => ({ heading, body: `body for ${heading}` })),
});

describe("renderSkillDocument", () => {
  it("emits every required heading in canonical order", () => {
    const md = renderSkillDocument(baseDoc());
    for (const heading of REQUIRED_SECTIONS) {
      expect(md).toContain(`## ${heading}`);
    }
    // Verify ordering: each heading should appear after the previous one.
    let lastIdx = -1;
    for (const heading of REQUIRED_SECTIONS) {
      const idx = md.indexOf(`## ${heading}`);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it("fills missing sections with a placeholder body", () => {
    const doc = baseDoc();
    doc.sections = [{ heading: "Overview", body: "real overview" }];
    const md = renderSkillDocument(doc);
    expect(md).toContain("real overview");
    expect(md).toContain("_No information available._");
  });

  it("round-trips frontmatter through the loader parser", () => {
    const md = renderSkillDocument(baseDoc());
    const fm = parseFrontmatter(md);
    expect(fm).not.toBeNull();
    expect(fm?.name).toBe("Tavily Search");
    expect(fm?.tool_id).toBe("default:tavily");
    expect(fm?.summary).toBe("Use for fresh web research queries.");
    expect(fm?.source_hash).toBe("deadbeef");
  });

  it("returns null from parser when frontmatter is missing required fields", () => {
    // A frontmatter block without name/summary is malformed for our purposes.
    const malformed = `---\ndescription: only this\n---\n\n# Body\n`;
    expect(parseFrontmatter(malformed)).toBeNull();
  });

  it("returns null when there is no frontmatter block at all", () => {
    expect(parseFrontmatter("# Just a title")).toBeNull();
  });
});
