/**
 * Tavily-backed research for tool skill generation.
 *
 * Uses the direct HTTPS API rather than the MCP server because the MCP boot
 * lifecycle is heavier and the generator runs in cron-like contexts where
 * we don't want to depend on stdio MCP being healthy.
 *
 * Reads TAVILY_API_KEY at call time (cached process.env, same pattern as
 * ai-clients). If missing or all queries fail, returns an empty result —
 * the synthesizer downstream knows how to render a SKILL.md without
 * external research (it just marks `sources: []`).
 */

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface TavilyResearchResult {
  snippets: TavilySearchResult[];
  sources: string[];
  errored: boolean;
}

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";

const MAX_SNIPPETS = 12;
const MAX_TOTAL_CHARS = 24000;

function getTavilyKey(): string | null {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key || key.toLowerCase().startsWith("your-")) return null;
  return key;
}

async function tavilySearch(
  apiKey: string,
  query: string,
): Promise<TavilySearchResult[]> {
  const res = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Tavily search ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { results?: TavilySearchResult[] };
  return json.results ?? [];
}

async function tavilyExtract(apiKey: string, urls: string[]): Promise<TavilySearchResult[]> {
  if (urls.length === 0) return [];
  const res = await fetch(TAVILY_EXTRACT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, urls }),
  });
  if (!res.ok) {
    throw new Error(`Tavily extract ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { results?: Array<{ url: string; raw_content: string }> };
  return (json.results ?? []).map((r) => ({
    title: r.url,
    url: r.url,
    content: r.raw_content,
  }));
}

export interface ToolResearchInput {
  name: string;
  category?: string | null;
  description?: string | null;
  command?: string | null;
  homepage?: string | null;
  githubUrl?: string | null;
  documentation?: string | null;
}

function buildQueries(input: ToolResearchInput): string[] {
  const queries: string[] = [];
  const base = input.name;
  queries.push(`${base} usage guide`);
  if (input.command) queries.push(`${base} command line options reference`);
  queries.push(`${base} red team OR penetration testing usage`);
  if (input.category) queries.push(`${base} ${input.category}`);
  return Array.from(new Set(queries.map((q) => q.trim())));
}

function dedupeByUrl(results: TavilySearchResult[]): TavilySearchResult[] {
  const seen = new Set<string>();
  const out: TavilySearchResult[] = [];
  for (const r of results) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push(r);
  }
  return out;
}

function truncateSnippets(results: TavilySearchResult[]): TavilySearchResult[] {
  const out: TavilySearchResult[] = [];
  let totalChars = 0;
  for (const r of results) {
    if (out.length >= MAX_SNIPPETS) break;
    const remaining = Math.max(0, MAX_TOTAL_CHARS - totalChars);
    if (remaining < 200) break;
    const content = (r.content ?? "").slice(0, Math.min(remaining, 3000));
    if (content.length === 0) continue;
    out.push({ ...r, content });
    totalChars += content.length;
  }
  return out;
}

export async function researchTool(input: ToolResearchInput): Promise<TavilyResearchResult> {
  const apiKey = getTavilyKey();
  if (!apiKey) {
    return { snippets: [], sources: [], errored: false };
  }

  const queries = buildQueries(input);
  const allResults: TavilySearchResult[] = [];
  let anyErrored = false;

  for (const q of queries) {
    try {
      const results = await tavilySearch(apiKey, q);
      allResults.push(...results);
    } catch (err) {
      anyErrored = true;
      console.error(`[tavily-researcher] search "${q}" failed:`, err);
    }
  }

  // Pull richer content from official URLs when present in the metadata.
  const officialUrls = [input.homepage, input.githubUrl, input.documentation]
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => u.length > 0)
    .slice(0, 2);
  if (officialUrls.length > 0) {
    try {
      const extracted = await tavilyExtract(apiKey, officialUrls);
      allResults.unshift(...extracted);
    } catch (err) {
      anyErrored = true;
      console.error(`[tavily-researcher] extract failed:`, err);
    }
  }

  const snippets = truncateSnippets(dedupeByUrl(allResults));
  const sources = snippets.map((s) => s.url);
  return { snippets, sources, errored: anyErrored && snippets.length === 0 };
}
