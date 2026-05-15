/**
 * /api/v1/research — Tavily-backed research → Workbench collection.
 *
 * POST /collect
 *   Drives the Research dialog in PlannerTab. Resolves the Tavily MCP server,
 *   runs a search (and optional URL extracts) for the given topic, then
 *   creates a Workbench collection that bundles the findings as a STIX
 *   Note attached to the collection's description.
 *
 * POST /groups
 *   Enum-pattern fallback for the catalog search. When the operator types an
 *   unknown threat actor name, the UI offers to register it; this handler
 *   creates a draft `intrusion-set` (Workbench Group) so future Planner runs
 *   can reference it.
 */

import { Router, Request, Response } from "express";
import { db } from "../../db";
import { mcpServers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { mcpInvoker } from "../../services/agents/mcp-invoker";
import { workbenchClient } from "../../services/attack-workbench-client";

const router = Router();

const TAVILY_SEED_KEY = "default:tavily";
const PER_TOPIC_QUERY_LIMIT = 5;

interface ResearchRequestBody {
  title?: string;
  type?: "tactic" | "group";
  objective?: string;
  referenceUrls?: string[];
}

interface TavilyResultArticle {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

/**
 * Locate the running Tavily MCP server. Returns null if it isn't seeded or
 * the server row is in an error state — callers should fall back to a
 * URL-only path.
 */
async function findTavilyServerId(): Promise<{ id: number; status: string } | null> {
  const rows = await db
    .select({ id: mcpServers.id, status: mcpServers.status })
    .from(mcpServers)
    .where(eq(mcpServers.seedKey, TAVILY_SEED_KEY))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Tavily MCP returns `content` as either a stringified JSON array or a list
 * of `{type:"text", text:"..."}` blocks. This collapses both shapes to a
 * normalized array of TavilyResultArticle.
 */
function parseTavilyResults(result: unknown): TavilyResultArticle[] {
  if (!result || typeof result !== "object") return [];
  const r = result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
  if (r.isError) return [];
  if (!Array.isArray(r.content)) return [];

  const articles: TavilyResultArticle[] = [];
  for (const block of r.content) {
    if (block.type !== "text" || typeof block.text !== "string") continue;
    try {
      const parsed = JSON.parse(block.text);
      if (Array.isArray(parsed?.results)) {
        for (const item of parsed.results) {
          if (item && typeof item === "object") {
            articles.push({
              title: typeof item.title === "string" ? item.title : undefined,
              url: typeof item.url === "string" ? item.url : undefined,
              content: typeof item.content === "string" ? item.content : undefined,
              score: typeof item.score === "number" ? item.score : undefined,
            });
          }
        }
      } else if (Array.isArray(parsed)) {
        for (const item of parsed) {
          articles.push({
            title: typeof item.title === "string" ? item.title : undefined,
            url: typeof item.url === "string" ? item.url : undefined,
            content: typeof item.content === "string" ? item.content : undefined,
            score: typeof item.score === "number" ? item.score : undefined,
          });
        }
      } else if (parsed && typeof parsed === "object") {
        articles.push({
          title: typeof parsed.title === "string" ? parsed.title : undefined,
          url: typeof parsed.url === "string" ? parsed.url : undefined,
          content: typeof parsed.content === "string" ? parsed.content : undefined,
        });
      }
    } catch {
      // Plain-text response — keep as a single content blob with no URL.
      articles.push({ content: block.text });
    }
  }
  return articles;
}

router.post("/collect", async (req: Request<unknown, unknown, ResearchRequestBody>, res: Response) => {
  const { title, type, objective, referenceUrls } = req.body ?? {};

  if (!title?.trim() || !objective?.trim()) {
    return res.status(400).json({ error: "title and objective are required" });
  }
  const researchType: "tactic" | "group" = type === "tactic" ? "tactic" : "group";
  const urls = Array.isArray(referenceUrls)
    ? referenceUrls.map((u) => String(u).trim()).filter((u) => /^https?:\/\//i.test(u)).slice(0, 20)
    : [];

  const tavily = await findTavilyServerId();

  // Build the search query. Group-typed research narrows on threat-actor TTPs;
  // tactic-typed research narrows on a kill-chain phase.
  const queryHints =
    researchType === "group"
      ? `${title.trim()} threat actor tradecraft TTPs recent campaigns ${objective.trim()}`
      : `${title.trim()} ATT&CK tactic ${objective.trim()}`;

  const articles: TavilyResultArticle[] = [];
  const errors: string[] = [];

  // 1. tavily_search for the topic — best-effort.
  if (tavily && tavily.status === "running") {
    try {
      const result = await mcpInvoker.callTool(tavily.id, "tavily_search", {
        query: queryHints,
        max_results: PER_TOPIC_QUERY_LIMIT,
        search_depth: "advanced",
      });
      articles.push(...parseTavilyResults(result));
    } catch (err) {
      errors.push(`tavily_search failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. tavily_extract on each user-provided URL so the operator's seed
    //    sources are included verbatim, not just discovered links.
    if (urls.length > 0) {
      try {
        const result = await mcpInvoker.callTool(tavily.id, "tavily_extract", {
          urls,
          extract_depth: "advanced",
        });
        articles.push(...parseTavilyResults(result));
      } catch (err) {
        errors.push(`tavily_extract failed: ${err instanceof Error ? err.message : String(err)}`);
        // Keep the URLs as raw references even if extract fails.
        for (const u of urls) articles.push({ url: u });
      }
    }
  } else {
    errors.push(
      tavily
        ? `Tavily MCP server is not running (status=${tavily.status})`
        : "Tavily MCP server is not seeded — check FF_DEFAULT_MCP_SERVERS and TAVILY_API_KEY."
    );
    for (const u of urls) articles.push({ url: u });
  }

  // Dedupe by URL.
  const dedupedByUrl = new Map<string, TavilyResultArticle>();
  for (const a of articles) {
    const key = a.url ?? `nourl:${(a.title ?? "").slice(0, 80)}:${(a.content ?? "").slice(0, 80)}`;
    if (!dedupedByUrl.has(key)) dedupedByUrl.set(key, a);
  }
  const finalArticles = Array.from(dedupedByUrl.values());

  // Write a Workbench collection. The findings live in the description as a
  // markdown bullet list of source links + summaries — Workbench's
  // STIX schema doesn't have a first-class "research note" surface, but
  // collections honor markdown in description and the Planner agent can
  // round-trip the text via getCollectionBundle.
  const summaryLines = [
    `## Objective`,
    objective.trim(),
    "",
    `## Sources (${finalArticles.length})`,
    ...finalArticles.map((a) => {
      const titleLine = a.title ?? a.url ?? "(untitled)";
      const urlLine = a.url ? ` — ${a.url}` : "";
      const snippet = a.content ? `\n  ${a.content.slice(0, 320).replace(/\s+/g, " ").trim()}` : "";
      return `- **${titleLine}**${urlLine}${snippet}`;
    }),
  ];
  if (errors.length > 0) {
    summaryLines.push("", "## Notes", ...errors.map((e) => `- ${e}`));
  }

  const collectionPayload = {
    stix: {
      id: `x-mitre-collection--${crypto.randomUUID()}`,
      type: "x-mitre-collection",
      name: title.trim(),
      description: summaryLines.join("\n"),
      x_mitre_version: "1.0",
      labels: [`rtpi:research`, `rtpi:research-${researchType}`],
    },
    workspace: {
      workflow: { state: "work-in-progress" },
    },
  };

  const created = await workbenchClient.createCollection(collectionPayload as any);

  return res.status(created ? 201 : 207).json({
    workbenchCollectionId: created?.stix?.id ?? null,
    articlesFound: finalArticles.length,
    techniqueIds: [], // populated later when CTI→technique extraction lands
    sources: finalArticles.map((a) => ({ title: a.title, url: a.url })).slice(0, 50),
    errors,
  });
});

router.post("/groups", async (req: Request<unknown, unknown, { name?: string; aliases?: string[] }>, res: Response) => {
  const { name, aliases } = req.body ?? {};
  if (!name?.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const payload = {
    stix: {
      id: `intrusion-set--${crypto.randomUUID()}`,
      type: "intrusion-set",
      name: name.trim(),
      aliases: Array.isArray(aliases) ? aliases.filter((a) => typeof a === "string") : [],
      labels: ["rtpi:user-registered"],
    },
    workspace: {
      workflow: { state: "work-in-progress" },
    },
  };
  const created = await workbenchClient.createGroup(payload as any);
  if (!created) {
    return res.status(502).json({ error: "Workbench rejected the new group" });
  }
  return res.status(201).json({ id: created.stix?.id ?? null, name: name.trim() });
});

export default router;
