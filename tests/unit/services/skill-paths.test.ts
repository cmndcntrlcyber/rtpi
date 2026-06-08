/**
 * Tests for skill-paths helpers — the on-disk layout of /skills/tools/.
 *
 * Pins the slug sanitization so MCP seedKeys ("default:tavily") and tool
 * names with spaces resolve to safe, deterministic paths. The agent prompt
 * builder reads SKILL.md by registry+id so the slug rules must round-trip.
 */

import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  skillFilePath,
  skillRelativePath,
  skillsRoot,
  slugifyId,
} from "../../../server/services/skills/skill-paths";

let originalSkillDirRoot: string | undefined;

beforeAll(() => {
  originalSkillDirRoot = process.env.SKILL_DIR_ROOT;
});

afterAll(() => {
  if (originalSkillDirRoot === undefined) delete process.env.SKILL_DIR_ROOT;
  else process.env.SKILL_DIR_ROOT = originalSkillDirRoot;
});

describe("slugifyId", () => {
  it("converts colons to dashes for MCP seedKeys", () => {
    expect(slugifyId("default:tavily")).toBe("default-tavily");
  });

  it("collapses spaces and slashes", () => {
    expect(slugifyId("Burp Suite/Pro")).toBe("burp-suite-pro");
  });

  it("strips unsafe characters", () => {
    expect(slugifyId("foo@bar!baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugifyId("---foo---")).toBe("foo");
  });

  it("collapses runs of dashes", () => {
    expect(slugifyId("a---b   c")).toBe("a-b-c");
  });
});

describe("skill paths", () => {
  it("honors SKILL_DIR_ROOT for test isolation", () => {
    process.env.SKILL_DIR_ROOT = "/tmp/test-skills";
    expect(skillsRoot()).toBe("/tmp/test-skills");
  });

  it("falls back to <cwd>/skills/tools when SKILL_DIR_ROOT is unset", () => {
    delete process.env.SKILL_DIR_ROOT;
    expect(skillsRoot()).toBe(path.resolve(process.cwd(), "skills", "tools"));
  });

  it("resolves skillFilePath under the registry subdir", () => {
    process.env.SKILL_DIR_ROOT = "/tmp/test-skills";
    expect(skillFilePath("mcp", "default:tavily")).toBe(
      "/tmp/test-skills/mcp/default-tavily.md",
    );
  });

  it("returns a forward-slash repo-relative path regardless of platform", () => {
    expect(skillRelativePath("registry", "nmap")).toBe("skills/tools/registry/nmap.md");
    expect(skillRelativePath("security", "Burp Suite")).toBe(
      "skills/tools/security/burp-suite.md",
    );
  });
});
