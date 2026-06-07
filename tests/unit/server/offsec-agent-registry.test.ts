import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Static guard against the B9 regression class: an offsec container defined in
 * docker-compose.yml that the management API can't address because it has no
 * typed AGENT_TYPES entry (so start/stop/tools fall back to a wrong/guessed
 * container name). Parses every `container_name: rtpi-<x>-agent` from compose
 * and asserts each appears as an explicit `containerName` in offsec-agents.ts.
 *
 * Pure file parsing — no DOM, DB, or Docker — so it runs reliably in CI.
 */

const ROOT = path.resolve(__dirname, "../../..");
const COMPOSE = path.join(ROOT, "docker-compose.yml");
const OFFSEC_AGENTS = path.join(ROOT, "server/api/v1/offsec-agents.ts");

/** Compose `container_name:` values that follow the offsec `rtpi-*-agent` shape. */
function composeOffsecContainers(): string[] {
  const src = readFileSync(COMPOSE, "utf-8");
  const out: string[] = [];
  const re = /container_name:\s*(rtpi-[a-z0-9-]+-agent)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return [...new Set(out)];
}

/** `containerName: "rtpi-…-agent"` literals declared in the AGENT_TYPES registry. */
function registeredContainerNames(): string[] {
  const src = readFileSync(OFFSEC_AGENTS, "utf-8");
  const out: string[] = [];
  const re = /containerName:\s*["'`](rtpi-[a-z0-9-]+-agent)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return [...new Set(out)];
}

describe("offsec agent registry coverage", () => {
  it("registers all 14 compose offsec containers", () => {
    const compose = composeOffsecContainers();
    // Sanity: the compose file really does define the expected fleet.
    expect(compose.length).toBeGreaterThanOrEqual(14);
  });

  it("every compose offsec container has a typed AGENT_TYPES entry", () => {
    const registered = new Set(registeredContainerNames());
    const missing = composeOffsecContainers().filter((c) => !registered.has(c));

    expect(
      missing,
      `Offsec container(s) defined in docker-compose.yml with no typed ` +
        `AGENT_TYPES.containerName entry (B9 regression):\n` +
        missing.map((c) => `  ${c}`).join("\n"),
    ).toEqual([]);
  });
});
