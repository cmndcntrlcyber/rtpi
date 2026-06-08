import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Static guard for the B6/N1 regression class: accessing a Drizzle row's
 * columns by their snake_case DB names. `db.select().from(rdArtifacts)` returns
 * camelCase JS properties (`artifactType`, `experimentId`, `projectId`), so a
 * snake_case access like `artifact.artifact_type` is silently `undefined` — the
 * exact bug that made every promote fail ("Got: undefined").
 *
 * This catches member accesses of the form `<obj>.<snake_case>` in the
 * promotion service. Pure file parsing — runs reliably in CI without a DB.
 */

const FILE = path.resolve(
  __dirname,
  "../../../server/services/rd-tool-promotion.ts",
);

describe("rd-tool-promotion field access", () => {
  it("never reads `artifact` Drizzle rows by snake_case property", () => {
    // Strip line + block comments so a benign doc reference like
    // `// Update tool_registry.rd_artifact_id` isn't mistaken for code.
    const src = readFileSync(FILE, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

    // The N1/B6 bug shape exactly: `artifact.<snake_case>` (the variable that
    // holds a Drizzle rd_artifacts row). Drizzle returns camelCase, so any such
    // access is silently undefined.
    const re = /\bartifact\.[a-z]+_[a-z][\w]*/g;
    const hits = src.match(re) ?? [];

    expect(
      hits,
      `snake_case access on a Drizzle artifact row (reads undefined — use ` +
        `camelCase, e.g. artifactType / experimentId / projectId):\n` +
        hits.map((h) => `  ${h}`).join("\n"),
    ).toEqual([]);
  });
});
