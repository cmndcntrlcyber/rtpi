/**
 * Flag-ON smoke test for FF_AGENT_SCOPED_ATTACK_TREE.
 *
 * SAFE BY DESIGN: exercises the new wiring against the LIVE dev DB — resolves a
 * real agent's enabledTools into the scoped catalog and composes the per-agent
 * system prompt — but does NOT call loop.run(), so NO tool executes and NO AI
 * call fires. It verifies the integration seams (UUID->slug resolution, prompt
 * composition, synthetic-tool surfacing, flag read), not live exploitation.
 *
 *   npx tsx tools/harness-eval/smoke-scoped-attack-tree.ts
 */
import "dotenv/config";
import { db, client } from "../../server/db";
import { agents, securityTools } from "../../shared/schema";
import { eq } from "drizzle-orm";
import {
  ToolExecutionLoop,
  ATTACK_SYNTHETIC_TOOLS,
  type AgentToolScope,
} from "../../server/services/agents/tool-execution-loop";
import { readFeatureFlags } from "../../shared/feature-flags";

function ok(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  return cond;
}

async function main() {
  process.env.FF_AGENT_SCOPED_ATTACK_TREE = "true";
  let allPass = true;
  allPass = ok("flag agentScopedAttackTree reads true", readFeatureFlags(process.env).agentScopedAttackTree === true) && allPass;

  // Pick the agent with the most enabledTools so the catalog resolves real rows.
  const allAgents = await db.select().from(agents);
  const withTools = allAgents
    .map((a) => ({ a, tools: ((a.config as any)?.enabledTools as string[]) || [] }))
    .filter((x) => x.tools.length > 0)
    .sort((x, y) => y.tools.length - x.tools.length);

  if (withTools.length === 0) {
    console.log("FAIL  no agent has enabledTools — cannot smoke-test scope resolution");
    await client.end({ timeout: 2 });
    process.exit(1);
  }

  const { a: agent, tools: enabledToolIds } = withTools[0];
  const cfg = agent.config as any;
  console.log(`\nAgent under test: "${agent.name}" (${enabledToolIds.length} enabledTools)\n`);

  const [msf] = await db
    .select()
    .from(securityTools)
    .where(eq(securityTools.name, "Metasploit Framework"));

  const scope: AgentToolScope = {
    enabledToolIds,
    agentSystemPrompt: cfg.systemPrompt,
    targetValue: "192.0.2.10", // TEST-NET-1 documentation range — non-routable
    msfToolId: msf?.id,
    syntheticTools: ATTACK_SYNTHETIC_TOOLS.filter((t) => t.toolId !== "empire_task"),
  };

  const loop = new ToolExecutionLoop(
    agent.id, agent.name, "smoke-wf", "smoke-target", "smoke objective", {}, scope,
  );

  // --- exercise the new code paths (DB read only; no tool exec, no AI) ---
  const catalog: any[] = await (loop as any).getAvailableTools();
  const ids = catalog.map((t) => t.toolId);
  const realTools = ids.filter((id: string) => !["msf_search", "msf_run"].includes(id));

  console.log("Resolved catalog (" + catalog.length + "):");
  for (const t of catalog) console.log(`  - ${t.toolId} (${t.category}) [${t.containerName}]`);
  console.log("");

  allPass = ok("catalog resolved >=1 real registry tool (UUID->slug)", realTools.length >= 1) && allPass;
  allPass = ok("no raw UUIDs leaked into catalog (slugs only)", ids.every((id: string) => !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id))) && allPass;
  allPass = ok("synthetic msf_search surfaced", ids.includes("msf_search")) && allPass;
  allPass = ok("synthetic msf_run surfaced", ids.includes("msf_run")) && allPass;
  allPass = ok("empire_task omitted (no Empire server bound)", !ids.includes("empire_task")) && allPass;

  const prompt: string = (loop as any).buildSystemPrompt(catalog);
  const persona = (cfg.systemPrompt || "").trim().slice(0, 40);
  allPass = ok("prompt leads with agent persona", persona.length === 0 || prompt.includes(persona)) && allPass;
  allPass = ok("prompt carries '## Tool Skills' if agent has it", !(cfg.systemPrompt || "").includes("## Tool Skills") || prompt.includes("## Tool Skills")) && allPass;
  allPass = ok("prompt includes AVAILABLE TOOLS block", prompt.includes("AVAILABLE TOOLS:")) && allPass;
  allPass = ok("prompt includes SYNTHETIC TOOL USAGE", prompt.includes("SYNTHETIC TOOL USAGE")) && allPass;
  allPass = ok("prompt ends with JSON action contract", prompt.includes("RESPOND WITH VALID JSON ONLY")) && allPass;
  allPass = ok("msfToolId resolved (Metasploit securityTools row exists)", !!msf?.id) && allPass;

  console.log("\n--- composed system prompt (first 1400 chars) ---\n");
  console.log(prompt.slice(0, 1400));
  console.log("\n--- end prompt head ---");

  console.log(`\nSMOKE RESULT: ${allPass ? "ALL PASS" : "FAILURES PRESENT"}`);
  await client.end({ timeout: 2 });
  process.exit(allPass ? 0 : 1);
}

main().catch(async (e) => {
  console.error("SMOKE ERROR:", e);
  try { await client.end({ timeout: 2 }); } catch {}
  process.exit(2);
});
