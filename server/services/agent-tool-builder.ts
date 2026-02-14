import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs/promises";
import { db } from "../db";
import { agentToolBuilds, mcpServers, containers, agents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getOpenAIClient, getAnthropicClient } from "./ai-clients";
import { agentMCPConnector } from "./agent-mcp-connector";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoResearchResult {
  url: string;
  owner: string;
  repo: string;
  language: string | null;
  description: string | null;
  buildInstructions: string | null;
  searchResults: any[];
}

interface BuildRecord {
  id: string;
  name: string;
  mode: "install" | "create";
  agentId: string;
  githubUrls: string[];
  status: string;
  repoResearch: any;
  generatedDockerfile: string | null;
  dockerImageTag: string | null;
  containerName: string | null;
  mcpServerId: string | null;
  currentStep: string | null;
  buildLog: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Docker helpers (mirrored from offsec-agents.ts)
// ---------------------------------------------------------------------------

async function buildDockerImage(
  contextPath: string,
  dockerfile: string,
  tag: string
): Promise<string> {
  const fullPath = path.resolve(process.cwd(), contextPath);
  const { stdout, stderr } = await execAsync(
    `docker build -f ${fullPath}/${dockerfile} -t ${tag} ${fullPath}`,
    { maxBuffer: 50 * 1024 * 1024 }
  );
  return stdout + stderr;
}

async function startContainer(
  containerName: string,
  imageName: string,
  agentType: string
): Promise<void> {
  try {
    await execAsync(`docker rm -f ${containerName} 2>/dev/null`);
  } catch {
    // Container doesn't exist, that's fine
  }

  const cmd = [
    "docker run -d",
    `--name ${containerName}`,
    "-e AGENT_TYPE=" + agentType,
    "-v /var/run/docker.sock:/var/run/docker.sock:ro",
    "--network rtpi-network",
    "--restart unless-stopped",
    imageName,
  ].join(" ");

  await execAsync(cmd);
}

// ---------------------------------------------------------------------------
// Inline GitHub URL parser (avoids circular dep with github-tool-installer)
// ---------------------------------------------------------------------------

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

// ---------------------------------------------------------------------------
// AgentToolBuilder
// ---------------------------------------------------------------------------

class AgentToolBuilder {
  // -------------------------------------------------------------------------
  // Main pipeline
  // -------------------------------------------------------------------------

  async startBuild(buildId: string): Promise<void> {
    try {
      // Fetch the build record
      const [build] = await db
        .select()
        .from(agentToolBuilds)
        .where(eq(agentToolBuilds.id, buildId))
        .limit(1);

      if (!build) {
        throw new Error(`Build record ${buildId} not found`);
      }

      const sanitizedName = this.sanitizeName(build.name);
      const githubUrls = build.githubUrls as string[];

      // Step 1 — Research repos
      await this.updateBuildStatus(buildId, "researching", "Researching GitHub repositories", {
        startedAt: new Date(),
      });
      await this.appendBuildLog(buildId, `Starting build pipeline for "${build.name}" in ${build.mode} mode`);
      await this.appendBuildLog(buildId, `Researching ${githubUrls.length} GitHub repo(s)...`);

      const repoResearch = await this.researchRepos(githubUrls);
      await db
        .update(agentToolBuilds)
        .set({ repoResearch, updatedAt: new Date() })
        .where(eq(agentToolBuilds.id, buildId));

      await this.appendBuildLog(buildId, `Research complete for ${repoResearch.length} repo(s)`);

      // Step 2 — Generate Dockerfile
      await this.updateBuildStatus(buildId, "generating_dockerfile", "Generating Dockerfile via LLM");
      await this.appendBuildLog(buildId, "Generating Dockerfile...");

      // Determine agent type from the agent record
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, build.agentId))
        .limit(1);

      const agentType = agent?.type ?? "custom";

      const dockerfile = await this.generateDockerfile(
        build.mode,
        sanitizedName,
        repoResearch,
        agentType
      );

      const dockerImageTag =
        build.mode === "create"
          ? `rtpi/agent-tools-${sanitizedName}:latest`
          : (build.dockerImageTag ?? `rtpi/agent-tools-${sanitizedName}:latest`);

      const containerName =
        build.mode === "create"
          ? `rtpi-agent-tools-${sanitizedName}`
          : await this.resolveExistingContainerName(build.agentId, sanitizedName);

      const dockerfileName = `Dockerfile.agent-tools-${sanitizedName}`;

      await db
        .update(agentToolBuilds)
        .set({
          generatedDockerfile: dockerfile,
          dockerImageTag,
          containerName,
          updatedAt: new Date(),
        })
        .where(eq(agentToolBuilds.id, buildId));

      await this.appendBuildLog(buildId, "Dockerfile generated successfully");

      // Step 3 — Build Docker image (with automatic repair on failure)
      await this.updateBuildStatus(buildId, "building_image", "Building Docker image");
      await this.appendBuildLog(buildId, `Writing Dockerfile to docker/offsec-agents/${dockerfileName}`);

      const dockerDir = path.resolve(process.cwd(), "docker/offsec-agents");
      let currentDockerfile = dockerfile;
      await fs.writeFile(path.join(dockerDir, dockerfileName), currentDockerfile, "utf-8");

      let buildOutput = "";
      let buildSucceeded = false;
      const repairHistory: Array<{ attempt: number; error: string; fixApplied: boolean }> = [];

      for (let attempt = 0; attempt <= AgentToolBuilder.MAX_REPAIR_ATTEMPTS; attempt++) {
        try {
          await this.appendBuildLog(
            buildId,
            attempt === 0
              ? `Building image ${dockerImageTag}...`
              : `Rebuilding image ${dockerImageTag} (attempt ${attempt + 1})...`
          );
          buildOutput = await buildDockerImage("docker/offsec-agents", dockerfileName, dockerImageTag);
          await this.appendBuildLog(buildId, `Docker build output (last 500 chars): ${buildOutput.slice(-500)}`);
          buildSucceeded = true;
          break;
        } catch (buildError: any) {
          const errorMsg = buildError?.message || String(buildError);
          await this.appendBuildLog(buildId, `Docker build FAILED: ${errorMsg.slice(-1000)}`);

          if (attempt >= AgentToolBuilder.MAX_REPAIR_ATTEMPTS) {
            // Exhausted all repair attempts
            repairHistory.push({ attempt: attempt + 1, error: errorMsg.slice(-500), fixApplied: false });
            await db
              .update(agentToolBuilds)
              .set({ repairAttempts: attempt + 1, repairHistory, updatedAt: new Date() })
              .where(eq(agentToolBuilds.id, buildId));
            throw new Error(
              `Docker build failed after ${attempt + 1} repair attempt(s). Last error: ${errorMsg.slice(-500)}`
            );
          }

          // Attempt automatic repair
          await this.updateBuildStatus(
            buildId,
            "repairing",
            `Repairing Dockerfile (attempt ${attempt + 1} of ${AgentToolBuilder.MAX_REPAIR_ATTEMPTS})`
          );
          await this.appendBuildLog(
            buildId,
            `Attempting automatic repair (${attempt + 1}/${AgentToolBuilder.MAX_REPAIR_ATTEMPTS})...`
          );

          try {
            const repairedDockerfile = await this.repairDockerfile(
              currentDockerfile,
              errorMsg,
              repoResearch
            );

            currentDockerfile = repairedDockerfile;
            await fs.writeFile(path.join(dockerDir, dockerfileName), currentDockerfile, "utf-8");

            repairHistory.push({ attempt: attempt + 1, error: errorMsg.slice(-500), fixApplied: true });
            await db
              .update(agentToolBuilds)
              .set({
                generatedDockerfile: currentDockerfile,
                repairAttempts: attempt + 1,
                repairHistory,
                updatedAt: new Date(),
              })
              .where(eq(agentToolBuilds.id, buildId));

            await this.appendBuildLog(buildId, "Dockerfile repaired, retrying build...");
            await this.updateBuildStatus(
              buildId,
              "building_image",
              `Rebuilding Docker image (attempt ${attempt + 2})`
            );
          } catch (repairError: any) {
            repairHistory.push({ attempt: attempt + 1, error: errorMsg.slice(-500), fixApplied: false });
            await this.appendBuildLog(
              buildId,
              `Repair failed: ${repairError?.message || String(repairError)}`
            );
            await db
              .update(agentToolBuilds)
              .set({ repairAttempts: attempt + 1, repairHistory, updatedAt: new Date() })
              .where(eq(agentToolBuilds.id, buildId));
            throw new Error(
              `Docker build failed and automatic repair also failed: ${repairError?.message || String(repairError)}`
            );
          }
        }
      }

      if (!buildSucceeded) {
        throw new Error("Docker build failed after all repair attempts");
      }

      // Step 4 — Start container
      await this.updateBuildStatus(buildId, "starting_container", "Starting container");
      await this.appendBuildLog(buildId, `Starting container ${containerName}...`);

      await startContainer(containerName, dockerImageTag, sanitizedName);

      // Record in containers table
      const containerId = await this.getDockerContainerId(containerName);
      await db.insert(containers).values({
        containerId: containerId || containerName,
        name: containerName,
        image: dockerImageTag,
        status: "running",
        ports: JSON.parse("{}"),
        environment: { AGENT_TYPE: sanitizedName },
        created: new Date(),
        started: new Date(),
      }).onConflictDoUpdate({
        target: containers.containerId,
        set: {
          image: dockerImageTag,
          status: "running" as const,
          started: new Date(),
          lastChecked: new Date(),
        },
      });

      await this.appendBuildLog(buildId, `Container ${containerName} started`);

      // Step 5 — Register MCP server (create mode only)
      let mcpServerId: string | null = build.mcpServerId ?? null;

      if (build.mode === "create") {
        await this.updateBuildStatus(buildId, "registering_mcp", "Registering MCP server");
        await this.appendBuildLog(buildId, "Registering new MCP server entry...");

        const [mcpServer] = await db
          .insert(mcpServers)
          .values({
            name: `agent-tools-${sanitizedName}`,
            command: "node",
            args: ["/mcp/dist/index.js"],
            env: { AGENT_TYPE: sanitizedName, CONTAINER_NAME: containerName },
            status: "running",
            autoRestart: true,
            maxRestarts: 3,
            restartCount: 0,
          })
          .returning();

        mcpServerId = mcpServer.id;

        await db
          .update(agentToolBuilds)
          .set({ mcpServerId, updatedAt: new Date() })
          .where(eq(agentToolBuilds.id, buildId));

        await this.appendBuildLog(buildId, `MCP server registered with id ${mcpServerId}`);
      }

      // Step 6 — Attach agent to MCP
      await this.updateBuildStatus(buildId, "attaching_agent", "Attaching agent to MCP server");
      await this.appendBuildLog(buildId, `Attaching agent ${build.agentId} to MCP server ${mcpServerId}...`);

      if (mcpServerId) {
        await agentMCPConnector.attachAgentToMCP(build.agentId, mcpServerId, {
          priority: 10,
        });
        await this.appendBuildLog(buildId, "Agent attached to MCP server");
      } else {
        await this.appendBuildLog(buildId, "Warning: No MCP server ID available for attachment");
      }

      // Step 7 — Done
      await this.updateBuildStatus(buildId, "completed", "Build completed", {
        completedAt: new Date(),
      });
      await this.appendBuildLog(buildId, "Build pipeline completed successfully");
    } catch (error: any) {
      console.error(`[AgentToolBuilder] Build ${buildId} failed:`, error);
      await this.updateBuildStatus(buildId, "failed", "Build failed", {
        errorMessage: error?.message || String(error),
      });
      await this.appendBuildLog(buildId, `BUILD FAILED: ${error?.message || String(error)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Research repos via Tavily HTTP API
  // -------------------------------------------------------------------------

  async researchRepos(urls: string[]): Promise<RepoResearchResult[]> {
    const results: RepoResearchResult[] = [];

    for (const url of urls) {
      const parsed = parseGitHubUrl(url);
      if (!parsed) {
        results.push({
          url,
          owner: "unknown",
          repo: "unknown",
          language: null,
          description: null,
          buildInstructions: null,
          searchResults: [],
        });
        continue;
      }

      const { owner, repo } = parsed;

      try {
        const tavilyKey = process.env.TAVILY_API_KEY;
        if (!tavilyKey) {
          throw new Error("TAVILY_API_KEY not set");
        }

        const searchQuery = `github.com/${owner}/${repo} install build instructions language`;

        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery,
            api_key: tavilyKey,
            search_depth: "advanced",
            max_results: 5,
          }),
        });

        if (!response.ok) {
          throw new Error(`Tavily API responded with ${response.status}`);
        }

        const data = await response.json();
        const searchResults = data.results || [];

        // Attempt to extract language and build info from results
        const language = this.detectLanguage(searchResults, repo);
        const description = this.extractDescription(searchResults);
        const buildInstructions = this.extractBuildInstructions(searchResults);

        results.push({
          url,
          owner,
          repo,
          language,
          description,
          buildInstructions,
          searchResults,
        });
      } catch (err: any) {
        console.warn(`[AgentToolBuilder] Tavily research failed for ${url}:`, err.message);

        // Fallback: basic URL parsing only
        results.push({
          url,
          owner,
          repo,
          language: null,
          description: null,
          buildInstructions: null,
          searchResults: [],
        });
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Dockerfile generation via LLM with fallback
  // -------------------------------------------------------------------------

  async generateDockerfile(
    mode: "install" | "create",
    name: string,
    repoResearch: RepoResearchResult[],
    agentType: string
  ): Promise<string> {
    // Load the example Dockerfile to use as reference
    let exampleDockerfile = "";
    try {
      const examplePath = path.resolve(
        process.cwd(),
        "docker/offsec-agents/Dockerfile.fuzzing-tools"
      );
      exampleDockerfile = await fs.readFile(examplePath, "utf-8");
    } catch {
      console.warn("[AgentToolBuilder] Could not read Dockerfile.fuzzing-tools example");
    }

    const repoSummary = repoResearch
      .map((r) => {
        const lines = [`- ${r.url} (${r.owner}/${r.repo})`];
        if (r.language) lines.push(`  Language: ${r.language}`);
        if (r.description) lines.push(`  Description: ${r.description}`);
        if (r.buildInstructions) lines.push(`  Build: ${r.buildInstructions}`);
        return lines.join("\n");
      })
      .join("\n");

    let prompt: string;

    if (mode === "create") {
      prompt = `You are an expert at writing Dockerfiles for security tool containers.

Generate a complete Dockerfile that builds the following GitHub repositories into a single container image.

**Repositories to install:**
${repoSummary}

**${AgentToolBuilder.BASE_IMAGE_PACKAGES}**

**Requirements:**
- Base image: \`FROM rtpi/offsec-base:latest\`
- Set \`ENV AGENT_TYPE=${name}\`
- Set \`ENV TOOLS_PATH=/opt/tools\`
- Switch to root for installations
- Create \`/opt/tools/bin\` directory
- For each repository:
  - \`git clone --depth 1 <url>\` into \`/opt/tools\`
  - Build/install using the appropriate method for the detected language
  - Copy binaries to \`/opt/tools/bin/\` where applicable
  - Create a \`TOOL_INFO.txt\` with a short description
- Set \`ENV PATH="/opt/tools/bin:\${PATH}"\`
- Run \`chown -R rtpi-agent:rtpi-agent /opt/tools\`
- Switch to user \`rtpi-agent\`
- Set \`WORKDIR /mcp\` and run \`npm run build\`
- \`EXPOSE 9000\`
- \`ENTRYPOINT ["/usr/local/bin/mcp-entrypoint.sh"]\`

**Example Dockerfile for reference:**
\`\`\`dockerfile
${exampleDockerfile}
\`\`\`

Generate ONLY the Dockerfile content, no explanation or markdown fences.`;
    } else {
      // install mode — addendum RUN blocks only
      prompt = `You are an expert at writing Dockerfiles for security tool containers.

Generate ONLY the additional RUN commands needed to install the following GitHub repositories into an existing container that already has the base tools set up.

**Repositories to install:**
${repoSummary}

**${AgentToolBuilder.BASE_IMAGE_PACKAGES}**

**Requirements:**
- Produce only RUN instructions (no FROM, no ENTRYPOINT, etc.)
- For each repository:
  - \`git clone --depth 1 <url>\` into \`/opt/tools\`
  - Build/install using the appropriate method for the detected language
  - Copy binaries to \`/opt/tools/bin/\` where applicable
  - Create a \`TOOL_INFO.txt\` with a short description
- Use \`2>/dev/null || true\` for build commands that may fail on certain architectures
- End with \`RUN chown -R rtpi-agent:rtpi-agent /opt/tools\`

**Example Dockerfile for reference (showing style):**
\`\`\`dockerfile
${exampleDockerfile}
\`\`\`

Generate ONLY the RUN instructions, no explanation or markdown fences.`;
    }

    // Try Anthropic first
    const anthropic = getAnthropicClient();
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        });

        const textContent = response.content.find((block) => block.type === "text");
        if (textContent && textContent.type === "text") {
          const text = textContent.text.trim();
          if (mode === "install") return text;
          return text;
        }
      } catch (error) {
        console.error("[AgentToolBuilder] Anthropic Dockerfile generation failed:", error);
      }
    }

    // Try OpenAI
    const openai = getOpenAIClient();
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5.2-chat-latest",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content;
        if (content) return content.trim();
      } catch (error) {
        console.error("[AgentToolBuilder] OpenAI Dockerfile generation failed:", error);
      }
    }

    // Fallback to template
    console.warn("[AgentToolBuilder] No LLM available, using template fallback");
    return this.generateTemplateFallback(name, repoResearch);
  }

  // -------------------------------------------------------------------------
  // Dockerfile repair via LLM (automatic error troubleshooting)
  // -------------------------------------------------------------------------

  private static readonly MAX_REPAIR_ATTEMPTS = 3;

  private static readonly BASE_IMAGE_PACKAGES = `The base image (rtpi/offsec-base:latest, Ubuntu 22.04) already has these installed:
- Node.js LTS (via nodesource apt repo) + npm — do NOT apt-get install nodejs or npm
- Go 1.22 (in /usr/local/go) — do NOT apt-get install golang-go or golang
- Python 3 + pip3 + venv + python-is-python3 — do NOT apt-get install python3 or python3-pip
- Rust toolchain (rustup, cargo) for both root and rtpi-agent — do NOT apt-get install rustc or cargo
- build-essential, git, curl, wget, unzip, vim, nano, htop, sudo
- cmake, pkg-config, libssl-dev
- default-jdk (Java)
- AWS CLI v2
- net-tools, iputils-ping, dnsutils
- pipx`;

  async repairDockerfile(
    dockerfile: string,
    buildError: string,
    repoResearch: RepoResearchResult[]
  ): Promise<string> {
    const errorTail = buildError.slice(-3000);

    const prompt = `You are an expert Docker troubleshooter. A Dockerfile that builds security tools failed to build.

**Docker Build Error (last 3000 chars):**
\`\`\`
${errorTail}
\`\`\`

**Current (broken) Dockerfile:**
\`\`\`dockerfile
${dockerfile}
\`\`\`

**${AgentToolBuilder.BASE_IMAGE_PACKAGES}**

**Instructions:**
1. Analyze the build error and identify the root cause
2. Fix the Dockerfile to resolve the error
3. Do NOT reinstall packages that are already in the base image
4. If a package conflicts, remove the conflicting install line entirely
5. If a build step fails due to missing dependencies, add only the specific missing packages
6. Preserve all tool installation logic — only fix what's broken

Generate ONLY the fixed Dockerfile content, no explanation or markdown fences.`;

    // Try Anthropic
    const anthropic = getAnthropicClient();
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        });
        const textContent = response.content.find((block) => block.type === "text");
        if (textContent && textContent.type === "text") {
          return textContent.text.trim();
        }
      } catch (error) {
        console.error("[AgentToolBuilder] Anthropic repair failed:", error);
      }
    }

    // Try OpenAI
    const openai = getOpenAIClient();
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5.2-chat-latest",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4000,
        });
        const content = response.choices[0]?.message?.content;
        if (content) return content.trim();
      } catch (error) {
        console.error("[AgentToolBuilder] OpenAI repair failed:", error);
      }
    }

    // Fallback: heuristic regex-based repairs
    console.warn("[AgentToolBuilder] No LLM available for repair, applying heuristic fixes");
    return this.applyHeuristicRepairs(dockerfile, errorTail);
  }

  private applyHeuristicRepairs(dockerfile: string, errorOutput: string): string {
    let fixed = dockerfile;
    const lines = fixed.split("\n");
    const fixedLines: string[] = [];

    // Known conflict patterns: packages already in base image
    const conflictPackages = [
      "nodejs", "npm", "golang-go", "golang", "python3",
      "python3-pip", "rustc", "cargo", "build-essential",
    ];

    for (const line of lines) {
      let skip = false;

      // Check if this is an apt-get install line that installs conflicting packages
      if (line.match(/apt-get\s+install/)) {
        for (const pkg of conflictPackages) {
          // Check if the error mentions this package conflict
          if (errorOutput.includes(pkg) && line.includes(pkg)) {
            // Remove the conflicting package from the install line
            const cleaned = line.replace(new RegExp(`\\b${pkg}\\b`, "g"), "").replace(/\s+/g, " ");
            // If the line only had that package, skip it entirely
            if (cleaned.match(/apt-get\s+install\s*(-y\s*)?\\?\s*$/)) {
              skip = true;
            } else {
              fixedLines.push(cleaned);
              skip = true;
            }
          }
        }
      }

      if (!skip) {
        fixedLines.push(line);
      }
    }

    return fixedLines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Template fallback when no LLM is available
  // -------------------------------------------------------------------------

  generateTemplateFallback(
    name: string,
    repoResearch: RepoResearchResult[]
  ): string {
    const toolBlocks = repoResearch.map((r) => {
      const lang = (r.language || "").toLowerCase();
      const repoDir = r.repo;

      if (lang === "go" || lang === "golang") {
        return [
          `# ${r.repo} (Go)`,
          `RUN git clone --depth 1 ${r.url} /opt/tools/${repoDir} && \\`,
          `    cd /opt/tools/${repoDir} && \\`,
          `    go build -o /opt/tools/bin/${repoDir} . 2>/dev/null || true && \\`,
          `    echo "${r.repo}: ${r.description || "Go-based tool"}" > TOOL_INFO.txt`,
        ].join("\n");
      }

      if (lang === "python") {
        return [
          `# ${r.repo} (Python)`,
          `RUN git clone --depth 1 ${r.url} /opt/tools/${repoDir} && \\`,
          `    cd /opt/tools/${repoDir} && \\`,
          `    pip3 install . 2>/dev/null || true && \\`,
          `    echo "${r.repo}: ${r.description || "Python-based tool"}" > TOOL_INFO.txt`,
        ].join("\n");
      }

      if (lang === "rust") {
        return [
          `# ${r.repo} (Rust)`,
          `RUN git clone --depth 1 ${r.url} /opt/tools/${repoDir} && \\`,
          `    cd /opt/tools/${repoDir} && \\`,
          `    cargo build --release 2>/dev/null || true && \\`,
          `    cp target/release/${repoDir} /opt/tools/bin/ 2>/dev/null || true && \\`,
          `    echo "${r.repo}: ${r.description || "Rust-based tool"}" > TOOL_INFO.txt`,
        ].join("\n");
      }

      // Default: clone only
      return [
        `# ${r.repo}`,
        `RUN git clone --depth 1 ${r.url} /opt/tools/${repoDir} && \\`,
        `    echo "${r.repo}: ${r.description || "Security tool"}" > /opt/tools/${repoDir}/TOOL_INFO.txt`,
      ].join("\n");
    });

    return `# RTPI OffSec Agent: ${name}
# Auto-generated tool container (template fallback)

FROM rtpi/offsec-base:latest

ENV AGENT_TYPE=${name}
ENV TOOLS_PATH=/opt/tools

USER root

RUN mkdir -p /opt/tools/bin

WORKDIR /opt/tools

${toolBlocks.join("\n\n")}

# Permissions and PATH
ENV PATH="/opt/tools/bin:\${PATH}"
RUN chown -R rtpi-agent:rtpi-agent /opt/tools

# Generate tool documentation
RUN /usr/local/bin/generate-docs.sh || true
RUN find /opt/tools -name "TOOL_INFO.txt" -exec cat {} \\; > /docs/TOOLS_INDEX.md

USER rtpi-agent
WORKDIR /mcp
RUN npm run build

EXPOSE 9000

HEALTHCHECK --interval=60s --timeout=10s --retries=3 \\
    CMD pgrep -f "node.*mcp" || exit 1

ENTRYPOINT ["/usr/local/bin/mcp-entrypoint.sh"]
`;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async updateBuildStatus(
    buildId: string,
    status: string,
    currentStep?: string,
    extra?: Record<string, any>
  ): Promise<void> {
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };
    if (currentStep !== undefined) {
      updates.currentStep = currentStep;
    }
    if (extra) {
      Object.assign(updates, extra);
    }

    await db
      .update(agentToolBuilds)
      .set(updates)
      .where(eq(agentToolBuilds.id, buildId));
  }

  async appendBuildLog(buildId: string, message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;

    const [current] = await db
      .select({ buildLog: agentToolBuilds.buildLog })
      .from(agentToolBuilds)
      .where(eq(agentToolBuilds.id, buildId))
      .limit(1);

    const existingLog = (current?.buildLog as string) || "";

    await db
      .update(agentToolBuilds)
      .set({
        buildLog: existingLog + logLine,
        updatedAt: new Date(),
      })
      .where(eq(agentToolBuilds.id, buildId));
  }

  sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private detectLanguage(searchResults: any[], repoName: string): string | null {
    const text = searchResults
      .map((r: any) => `${r.title || ""} ${r.content || ""}`)
      .join(" ")
      .toLowerCase();

    if (text.includes("go.mod") || text.includes("golang") || text.includes("go install")) {
      return "Go";
    }
    if (text.includes("cargo.toml") || text.includes("rust") || text.includes("cargo build")) {
      return "Rust";
    }
    if (
      text.includes("setup.py") ||
      text.includes("requirements.txt") ||
      text.includes("pip install") ||
      text.includes("python")
    ) {
      return "Python";
    }
    if (text.includes("package.json") || text.includes("npm install") || text.includes("node")) {
      return "JavaScript";
    }
    if (text.includes("makefile") || text.includes("cmake") || text.includes(".c ") || text.includes(".cpp")) {
      return "C/C++";
    }

    return null;
  }

  private extractDescription(searchResults: any[]): string | null {
    if (searchResults.length === 0) return null;
    // Use the first result's title or content snippet as description
    const first = searchResults[0];
    return first?.title || first?.content?.slice(0, 200) || null;
  }

  private extractBuildInstructions(searchResults: any[]): string | null {
    const text = searchResults
      .map((r: any) => r.content || "")
      .join(" ");

    // Look for common build instruction patterns
    const patterns = [
      /(?:install|build|compile|setup)[\s:]+([^\n.]+)/i,
      /(?:go install|pip install|cargo install|npm install|make)\s+([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0].slice(0, 300);
    }

    return null;
  }

  private async getDockerContainerId(containerName: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(
        `docker inspect --format='{{.Id}}' ${containerName} 2>/dev/null`
      );
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  private async resolveExistingContainerName(
    agentId: string,
    sanitizedName: string
  ): Promise<string> {
    // Try to find the agent's existing container from its config
    try {
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      const config = agent?.config as Record<string, any> | null;
      if (config?.containerName) {
        return config.containerName as string;
      }

      // Try to find a matching container in the containers table
      const existingContainers = await db
        .select()
        .from(containers)
        .where(eq(containers.name, `rtpi-agent-tools-${sanitizedName}`))
        .limit(1);

      if (existingContainers.length > 0) {
        return existingContainers[0].name;
      }
    } catch (err: any) {
      console.warn("[AgentToolBuilder] Could not resolve existing container name:", err.message);
    }

    // Fallback to the standard naming convention
    return `rtpi-agent-tools-${sanitizedName}`;
  }
}

export const agentToolBuilder = new AgentToolBuilder();
