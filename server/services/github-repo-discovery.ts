/**
 * GitHub Repository Discovery Service
 *
 * Uses Tavily MCP to discover GitHub repositories for security tools.
 * Generates Dockerfile snippets and documentation for discovered tools.
 */

import { EventEmitter } from "events";

export interface DiscoveredRepo {
  name: string;
  fullName: string;
  url: string;
  description: string;
  stars: number;
  language: string;
  topics: string[];
  lastUpdated: string;
  category: string;
}

export interface DockerfileEntry {
  repoName: string;
  repoUrl: string;
  cloneCommand: string;
  buildCommands: string[];
  toolInfo: string;
}

export interface RepoDiscoveryResult {
  query: string;
  category: string;
  repos: DiscoveredRepo[];
  dockerfileEntries: DockerfileEntry[];
  timestamp: string;
}

// Search query templates for different agent types
const AGENT_SEARCH_QUERIES: Record<string, string[]> = {
  "maldev": [
    "rust malware development github",
    "binary exploitation framework github",
    "ROP chain generator tool github",
    "shellcode compiler rust github",
    "Windows reflective DLL injection github",
    "Ghidra plugin MCP github",
    "reverse engineering automation github",
  ],
  "azure-ad": [
    "EntraID enumeration tool github",
    "Active Directory attack tool github",
    "BloodHound alternative rust github",
    "Azure AD exploitation github",
    "AADInternals github",
    "RustHound github",
    "LDAP enumeration tool github",
  ],
  "burp-suite": [
    "Burp Suite extension github",
    "web crawler security github",
    "HTTP parameter discovery tool github",
    "web vulnerability scanner github",
    "XSS scanner github",
    "API security testing tool github",
  ],
  "empire-c2": [
    "C2 framework github",
    "payload generator github",
    "post exploitation framework github",
    "Cobalt Strike alternative github",
    "Sliver C2 github",
    "Empire PowerShell github",
    "EDR evasion payload github",
  ],
  "fuzzing": [
    "web fuzzer github",
    "directory bruteforce tool github",
    "ffuf alternative github",
    "subdomain enumeration github",
    "parameter fuzzing github",
    "DNS bruteforce github",
  ],
  "framework-security": [
    "technology detection github",
    "wappalyzer alternative github",
    "CMS vulnerability scanner github",
    "dependency vulnerability scanner github",
    "framework fingerprinting github",
    "security header checker github",
  ],
  "research": [
    "security research toolkit github",
    "exploit database github",
    "CVE PoC github",
    "penetration testing framework github",
    "OSINT tool github",
    "reconnaissance framework github",
  ],
};

// Language-specific build command templates
const BUILD_COMMANDS: Record<string, string[]> = {
  rust: ["cargo build --release"],
  go: ["go build -o /opt/tools/bin/${TOOL_NAME} ."],
  python: ["pip3 install -r requirements.txt", "pip3 install ."],
  javascript: ["npm install", "npm run build"],
  typescript: ["npm install", "npm run build"],
  ruby: ["bundle install"],
  csharp: ["dotnet build -c Release"],
  cpp: ["cmake -B build", "cmake --build build"],
  c: ["make"],
};

export class GitHubRepoDiscovery extends EventEmitter {
  private tavilyApiKey: string | null;
  private cache: Map<string, RepoDiscoveryResult> = new Map();
  private cacheExpiry: number = 3600000; // 1 hour

  constructor() {
    super();
    this.tavilyApiKey = process.env.TAVILY_API_KEY || null;
  }

  /**
   * Discover repositories for a specific agent type
   */
  async discoverReposForAgent(agentType: string): Promise<RepoDiscoveryResult> {
    const cacheKey = `agent:${agentType}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - new Date(cached.timestamp).getTime() < this.cacheExpiry) {
      return cached;
    }

    const queries = AGENT_SEARCH_QUERIES[agentType] || [];
    if (queries.length === 0) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const allRepos: DiscoveredRepo[] = [];

    for (const query of queries) {
      try {
        const repos = await this.searchGitHub(query, agentType);
        allRepos.push(...repos);
      } catch (error) {
        console.error(`Search failed for query "${query}":`, error);
      }
    }

    // Deduplicate by URL
    const uniqueRepos = this.deduplicateRepos(allRepos);

    // Generate Dockerfile entries
    const dockerfileEntries = uniqueRepos.map((repo) => this.generateDockerfileEntry(repo));

    const result: RepoDiscoveryResult = {
      query: queries.join("; "),
      category: agentType,
      repos: uniqueRepos,
      dockerfileEntries,
      timestamp: new Date().toISOString(),
    };

    this.cache.set(cacheKey, result);
    this.emit("discovery_complete", result);

    return result;
  }

  /**
   * Search GitHub via Tavily API
   */
  private async searchGitHub(query: string, category: string): Promise<DiscoveredRepo[]> {
    if (!this.tavilyApiKey) {
      console.warn("Tavily API key not set, using mock data");
      return this.getMockRepos(category);
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: this.tavilyApiKey,
          query,
          search_depth: "advanced",
          include_domains: ["github.com"],
          max_results: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseGitHubResults(data.results || [], category);
    } catch (error) {
      console.error("Tavily search failed:", error);
      return [];
    }
  }

  /**
   * Parse Tavily results into DiscoveredRepo format
   */
  private parseGitHubResults(results: any[], category: string): DiscoveredRepo[] {
    const repos: DiscoveredRepo[] = [];

    for (const result of results) {
      const url = result.url || "";
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);

      if (!match) continue;

      const [, owner, repoName] = match;
      const cleanRepoName = repoName.replace(/\/.*$/, "").replace(/[?#].*$/, "");

      repos.push({
        name: cleanRepoName,
        fullName: `${owner}/${cleanRepoName}`,
        url: `https://github.com/${owner}/${cleanRepoName}`,
        description: result.content?.slice(0, 300) || result.title || "",
        stars: 0, // Would need GitHub API for this
        language: this.detectLanguage(result.content || ""),
        topics: [],
        lastUpdated: new Date().toISOString(),
        category,
      });
    }

    return repos;
  }

  /**
   * Detect primary language from content
   */
  private detectLanguage(content: string): string {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes("rust") || lowerContent.includes("cargo.toml")) {
      return "rust";
    }
    if (lowerContent.includes("golang") || lowerContent.includes("go.mod")) {
      return "go";
    }
    if (lowerContent.includes("python") || lowerContent.includes("requirements.txt")) {
      return "python";
    }
    if (lowerContent.includes("typescript") || lowerContent.includes("tsconfig")) {
      return "typescript";
    }
    if (lowerContent.includes("javascript") || lowerContent.includes("package.json")) {
      return "javascript";
    }
    if (lowerContent.includes("c#") || lowerContent.includes(".csproj")) {
      return "csharp";
    }
    if (lowerContent.includes("c++") || lowerContent.includes("cmake")) {
      return "cpp";
    }
    if (lowerContent.includes("ruby") || lowerContent.includes("gemfile")) {
      return "ruby";
    }

    return "unknown";
  }

  /**
   * Deduplicate repositories by URL
   */
  private deduplicateRepos(repos: DiscoveredRepo[]): DiscoveredRepo[] {
    const seen = new Set<string>();
    return repos.filter((repo) => {
      if (seen.has(repo.url)) {
        return false;
      }
      seen.add(repo.url);
      return true;
    });
  }

  /**
   * Generate Dockerfile entry for a repository
   */
  generateDockerfileEntry(repo: DiscoveredRepo): DockerfileEntry {
    const buildCommands = BUILD_COMMANDS[repo.language] || [];
    const toolName = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    return {
      repoName: repo.name,
      repoUrl: repo.url,
      cloneCommand: `git clone --depth 1 ${repo.url}.git`,
      buildCommands: buildCommands.map((cmd) =>
        cmd.replace("${TOOL_NAME}", toolName)
      ),
      toolInfo: `${repo.name}: ${repo.description.slice(0, 100)}`,
    };
  }

  /**
   * Generate complete Dockerfile section for an agent
   */
  async generateDockerfileSection(agentType: string): Promise<string> {
    const result = await this.discoverReposForAgent(agentType);
    let dockerfile = `# =============================================================================\n`;
    dockerfile += `# AUTO-DISCOVERED TOOLS FOR ${agentType.toUpperCase()}\n`;
    dockerfile += `# Generated: ${result.timestamp}\n`;
    dockerfile += `# =============================================================================\n\n`;

    for (const entry of result.dockerfileEntries) {
      dockerfile += `# ${entry.repoName}\n`;
      dockerfile += `RUN cd /opt/tools && \\\n`;
      dockerfile += `    ${entry.cloneCommand}`;

      if (entry.buildCommands.length > 0) {
        dockerfile += ` && \\\n`;
        dockerfile += entry.buildCommands.map((cmd) => `    cd ${entry.repoName} && ${cmd}`).join(" && \\\n");
      }

      dockerfile += ` && \\\n`;
      dockerfile += `    echo "${entry.toolInfo}" > ${entry.repoName}/TOOL_INFO.txt\n\n`;
    }

    return dockerfile;
  }

  /**
   * Generate tool documentation for an agent
   */
  async generateToolDocumentation(agentType: string): Promise<string> {
    const result = await this.discoverReposForAgent(agentType);

    let doc = `# ${agentType.toUpperCase()} Agent Tools\n\n`;
    doc += `Generated: ${result.timestamp}\n\n`;
    doc += `## Discovered Repositories\n\n`;
    doc += `| Name | Language | Description |\n`;
    doc += `|------|----------|-------------|\n`;

    for (const repo of result.repos) {
      doc += `| [${repo.name}](${repo.url}) | ${repo.language} | ${repo.description.slice(0, 80)}... |\n`;
    }

    doc += `\n## Usage\n\n`;
    doc += `All tools are installed in \`/opt/tools/\` and exposed via MCP server.\n\n`;
    doc += `### Listing Tools\n`;
    doc += `\`\`\`\n`;
    doc += `# Via MCP\n`;
    doc += `list_tools\n`;
    doc += `\n`;
    doc += `# Direct\n`;
    doc += `ls /opt/tools/\n`;
    doc += `\`\`\`\n\n`;

    doc += `### Getting Help\n`;
    doc += `\`\`\`\n`;
    doc += `# Via MCP\n`;
    doc += `get_tool_help tool_name="${result.repos[0]?.name || 'tool_name'}"\n`;
    doc += `\`\`\`\n`;

    return doc;
  }

  /**
   * Get mock repositories for testing when Tavily API is not available
   */
  private getMockRepos(category: string): DiscoveredRepo[] {
    const mockRepos: Record<string, DiscoveredRepo[]> = {
      maldev: [
        {
          name: "RustChain",
          fullName: "trickster0/RustChain",
          url: "https://github.com/trickster0/RustChain",
          description: "ROP chain generator written in Rust",
          stars: 150,
          language: "rust",
          topics: ["rop", "exploitation", "rust"],
          lastUpdated: new Date().toISOString(),
          category: "maldev",
        },
        {
          name: "xgadget",
          fullName: "entropic-security/xgadget",
          url: "https://github.com/entropic-security/xgadget",
          description: "Fast ROP gadget search for binary exploitation",
          stars: 200,
          language: "rust",
          topics: ["rop", "security", "binary"],
          lastUpdated: new Date().toISOString(),
          category: "maldev",
        },
      ],
      "azure-ad": [
        {
          name: "RustHound-CE",
          fullName: "NH-RED-TEAM/RustHound-CE",
          url: "https://github.com/NH-RED-TEAM/RustHound-CE",
          description: "BloodHound collector written in Rust",
          stars: 300,
          language: "rust",
          topics: ["bloodhound", "active-directory", "rust"],
          lastUpdated: new Date().toISOString(),
          category: "azure-ad",
        },
      ],
      fuzzing: [
        {
          name: "ffuf",
          fullName: "ffuf/ffuf",
          url: "https://github.com/ffuf/ffuf",
          description: "Fast web fuzzer written in Go",
          stars: 8000,
          language: "go",
          topics: ["fuzzing", "security", "web"],
          lastUpdated: new Date().toISOString(),
          category: "fuzzing",
        },
      ],
    };

    return mockRepos[category] || [];
  }

  /**
   * Clear the discovery cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit("cache_cleared");
  }

  /**
   * Get all cached results
   */
  getCachedResults(): Map<string, RepoDiscoveryResult> {
    return new Map(this.cache);
  }
}

// Export singleton instance
export const githubRepoDiscovery = new GitHubRepoDiscovery();
