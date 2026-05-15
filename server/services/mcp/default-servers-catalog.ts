/**
 * Default MCP server catalog (v2.9.3 Phase 2).
 *
 * Source-of-truth list of MCP servers that ship as built-in defaults when
 * FF_DEFAULT_MCP_SERVERS=true. Each entry has a stable `seedKey` so the
 * idempotent sync (catalog-sync.ts) can re-insert only missing rows on
 * subsequent boots without overwriting operator edits to existing rows.
 *
 * Servers needing API keys list them in `requiredSecrets`. The catalog
 * never reads env-var values — it only declares the *names* that the
 * Phase 3 `PATCH /:id/secrets` endpoint will write into the row's `env`
 * column. On install, those env entries are seeded as empty strings, the
 * row's status stays 'stopped', and the future UI surfaces a
 * "Needs configuration" badge based on `needsConfig()` from catalog-sync.ts.
 *
 * See docs/enhancements/2.9/v2.9.3-default-mcp-integrations.md.
 */

export interface DefaultMcpEntry {
  seedKey: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  requiredSecrets: string[];
  /**
   * Optional disable flag for entries whose upstream package is not currently
   * usable as published (404 on registry, broken executable, etc.). The row is
   * still seeded so the catalog UI surfaces the entry, but the API refuses to
   * start it and the panel renders a "Disabled" badge with the reason. Clears
   * itself when an operator manually edits command/args away from defaults.
   */
  disabledByDefault?: boolean;
  disabledReason?: string;
}

/**
 * Some catalog args reference filesystem paths that must exist on disk before
 * the MCP server can start. We declare them as `${MCP_FS_ROOT}` here and let
 * `resolveCatalogArgs()` (catalog-sync.ts) substitute the runtime path. The
 * preflight validator (preflight.ts) creates the directory if missing on every
 * `startServer()` so the spawn succeeds even when the workspace was wiped.
 */
export const MCP_FS_ROOT_PLACEHOLDER = "${MCP_FS_ROOT}";

export const DEFAULT_MCP_CATALOG: readonly DefaultMcpEntry[] = [
  {
    seedKey: "default:playwright",
    name: "Microsoft Playwright",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    env: {},
    requiredSecrets: [],
  },
  {
    seedKey: "default:fetch",
    name: "MCP Fetch",
    command: "uvx",
    args: ["mcp-server-fetch"],
    env: {},
    requiredSecrets: [],
  },
  {
    seedKey: "default:chrome-devtools",
    name: "Chrome DevTools",
    command: "npx",
    args: ["-y", "chrome-devtools-mcp@latest"],
    env: {},
    requiredSecrets: [],
  },
  {
    seedKey: "default:filesystem",
    name: "MCP Filesystem",
    command: "npx",
    // The placeholder is resolved at sync time (default: <cwd>/mcp-workspace)
    // and the directory is auto-created on every start by preflight, so the
    // path is always real before the server spawns. Operators can edit args
    // to add additional roots.
    args: ["-y", "@modelcontextprotocol/server-filesystem", MCP_FS_ROOT_PLACEHOLDER],
    env: {},
    requiredSecrets: [],
  },
  {
    seedKey: "default:sequential-thinking",
    name: "MCP Sequential Thinking",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    env: {},
    requiredSecrets: [],
  },
  {
    seedKey: "default:memory",
    name: "MCP Memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    env: {},
    requiredSecrets: [],
  },
  {
    seedKey: "default:github",
    name: "MCP GitHub",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
    requiredSecrets: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
  },
  {
    seedKey: "default:searchcode",
    name: "searchcode",
    command: "npx",
    args: ["-y", "searchcode-mcp"],
    env: {},
    requiredSecrets: [],
    // The npm package `searchcode-mcp` is not published (404 on the registry
    // as of 2026-05). The PulseMCP listing references it but no working
    // implementation exists upstream. We seed the row so the catalog UI is
    // complete, but the API refuses to start it until an operator edits the
    // command to a working alternative.
    disabledByDefault: true,
    disabledReason: "npm package 'searchcode-mcp' is not published — edit command to use a working searchcode integration",
  },
  {
    seedKey: "default:task-master",
    name: "Claude Task Master",
    command: "npx",
    args: ["-y", "task-master-ai"],
    env: {},
    // Task Master accepts model API keys via env (ANTHROPIC_API_KEY etc.) but
    // none are strictly required for its core task-tracking tools — the
    // server starts without them. Leave requiredSecrets empty; operators
    // wire in keys via the row's env column when they want LLM-backed flows.
    requiredSecrets: [],
  },
  {
    seedKey: "default:tavily",
    name: "Tavily Search",
    command: "npx",
    args: ["-y", "tavily-mcp@latest"],
    env: { TAVILY_API_KEY: "" },
    requiredSecrets: ["TAVILY_API_KEY"],
  },
  {
    seedKey: "default:arxiv",
    name: "arXiv",
    command: "uvx",
    // The PyPI package literally named `arxiv-mcp-server` is a different
    // project that ships an `arxiv-search` CLI (not an MCP server). The real
    // MCP server lives at github.com/blazickjp/arxiv-mcp-server — install it
    // directly from source so we get the right entry point.
    args: ["--from", "git+https://github.com/blazickjp/arxiv-mcp-server", "arxiv-mcp-server"],
    env: {},
    requiredSecrets: [],
  },
];
