/**
 * GitHub Tool Auto-Installer Service
 * Analyzes GitHub repositories and automatically generates installation configurations
 */

import { Octokit } from '@octokit/rest';
import { db } from '../db';
import { githubToolInstallations } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type {
  GitHubRepoAnalysis,
  ToolDependency,
  InstallMethod
} from '../../shared/types/tool-config';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

/**
 * GitHub API client
 */
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

/**
 * Language to install method mapping
 */
const LANGUAGE_INSTALL_METHODS: Record<string, InstallMethod> = {
  'Python': 'pip',
  'JavaScript': 'npm',
  'TypeScript': 'npm',
  'Go': 'go-install',
  'Rust': 'cargo',
  'Ruby': 'manual',
  'Shell': 'manual',
  'C': 'manual',
  'C++': 'manual',
};

/**
 * Extract owner and repo from GitHub URL
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const owner = match[1];
  let repo = match[2];

  // Remove .git suffix if present
  repo = repo.replace(/\.git$/, '');

  return { owner, repo };
}

/**
 * Analyze a GitHub repository to detect language and dependencies
 */
export async function analyzeGitHubRepository(githubUrl: string): Promise<GitHubRepoAnalysis> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    throw new Error('Invalid GitHub URL');
  }

  const { owner, repo } = parsed;

  try {
    // Fetch repository information
    const { data: repoData } = await octokit.repos.get({ owner, repo });

    // Fetch repository languages
    const { data: languages } = await octokit.repos.listLanguages({ owner, repo });

    // Detect primary language
    const primaryLanguage = repoData.language || Object.keys(languages)[0] || 'unknown';

    // Fetch README
    let readme = '';
    try {
      const { data: readmeData } = await octokit.repos.getReadme({ owner, repo });
      readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
    } catch (error) {
      console.warn(`Could not fetch README for ${owner}/${repo}`);
    }

    // Detect dependencies by checking for specific files
    const dependencies = await detectDependencies(owner, repo, primaryLanguage);

    // Determine suggested install method
    const suggestedInstallMethod = LANGUAGE_INSTALL_METHODS[primaryLanguage] || 'manual';

    // Generate Dockerfile if applicable
    const suggestedDockerfile = await generateDockerfile(primaryLanguage, dependencies, repoData.name);

    // Generate build script
    const suggestedBuildScript = generateBuildScript(primaryLanguage, dependencies);

    // Check for tests
    const hasTests = await checkForTests(owner, repo);

    // Estimate build time based on language and dependencies
    const estimatedBuildTime = estimateBuildTime(primaryLanguage, dependencies.length);

    return {
      repoUrl: githubUrl,
      repoName: repoData.name,
      language: primaryLanguage,
      detectedDependencies: dependencies,
      suggestedInstallMethod,
      suggestedDockerfile,
      suggestedBuildScript,
      readme,
      license: repoData.license?.spdx_id || 'Unknown',
      hasTests,
      estimatedBuildTime,
    };
  } catch (error: any) {
    throw new Error(`Failed to analyze repository: ${error.message}`);
  }
}

/**
 * Detect dependencies from repository files
 */
async function detectDependencies(
  owner: string,
  repo: string,
  language: string
): Promise<ToolDependency[]> {
  const dependencies: ToolDependency[] = [];

  try {
    // Check for package managers and dependency files
    if (language === 'Python') {
      // Check for requirements.txt
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: 'requirements.txt',
        });
        if ('content' in data) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          const pythonDeps = parsePythonRequirements(content);
          dependencies.push(...pythonDeps);
        }
      } catch (error) {
        // File doesn't exist
      }

      // Check for setup.py
      try {
        await octokit.repos.getContent({ owner, repo, path: 'setup.py' });
        dependencies.push({
          type: 'package',
          name: 'setuptools',
          installCommand: 'pip install setuptools',
        });
      } catch (error) {
        // File doesn't exist
      }
    } else if (language === 'JavaScript' || language === 'TypeScript') {
      // Check for package.json
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: 'package.json',
        });
        if ('content' in data) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          const npmDeps = parsePackageJson(content);
          dependencies.push(...npmDeps);
        }
      } catch (error) {
        // File doesn't exist
      }
    } else if (language === 'Rust') {
      // Check for Cargo.toml
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: 'Cargo.toml',
        });
        if ('content' in data) {
          dependencies.push({
            type: 'package',
            name: 'cargo',
            installCommand: 'curl https://sh.rustup.rs -sSf | sh',
          });
        }
      } catch (error) {
        // File doesn't exist
      }
    } else if (language === 'Go') {
      // Check for go.mod
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: 'go.mod',
        });
        if ('content' in data) {
          dependencies.push({
            type: 'package',
            name: 'go',
            installCommand: 'apt-get install -y golang',
          });
        }
      } catch (error) {
        // File doesn't exist
      }
    }

    // Check for Dockerfile
    try {
      await octokit.repos.getContent({ owner, repo, path: 'Dockerfile' });
      dependencies.push({
        type: 'package',
        name: 'docker',
        installCommand: 'apt-get install -y docker.io',
      });
    } catch (error) {
      // File doesn't exist
    }

  } catch (error) {
    console.warn(`Error detecting dependencies: ${error}`);
  }

  return dependencies;
}

/**
 * Parse Python requirements.txt file
 */
function parsePythonRequirements(content: string): ToolDependency[] {
  const dependencies: ToolDependency[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse package==version or package>=version
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)(==|>=|<=|>|<)(.+)$/);
    if (match) {
      dependencies.push({
        type: 'package',
        name: match[1],
        version: match[3],
        installCommand: `pip install ${trimmed}`,
      });
    } else {
      // Simple package name without version
      dependencies.push({
        type: 'package',
        name: trimmed,
        installCommand: `pip install ${trimmed}`,
      });
    }
  }

  return dependencies;
}

/**
 * Parse package.json for npm dependencies
 */
function parsePackageJson(content: string): ToolDependency[] {
  const dependencies: ToolDependency[] = [];

  try {
    const packageJson = JSON.parse(content);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [name, version] of Object.entries(allDeps)) {
      dependencies.push({
        type: 'package',
        name,
        version: version as string,
        installCommand: `npm install ${name}`,
      });
    }
  } catch (error) {
    console.warn('Failed to parse package.json');
  }

  return dependencies;
}

/**
 * Generate Dockerfile based on detected language and dependencies
 */
async function generateDockerfile(
  language: string,
  _dependencies: ToolDependency[],
  repoName: string
): Promise<string> {
  let dockerfile = '';

  switch (language) {
    case 'Python':
      dockerfile = `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Install the tool
RUN pip install -e .

# Set entrypoint
ENTRYPOINT ["${repoName}"]
`;
      break;

    case 'JavaScript':
    case 'TypeScript':
      dockerfile = `FROM node:18-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY . .

# Build if TypeScript
${language === 'TypeScript' ? 'RUN npm run build' : ''}

# Set entrypoint
ENTRYPOINT ["node", "index.js"]
`;
      break;

    case 'Go':
      dockerfile = `FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install git for go modules
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/${repoName}

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/${repoName} .

ENTRYPOINT ["./${repoName}"]
`;
      break;

    case 'Rust':
      dockerfile = `FROM rust:1.74-slim AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \\
    pkg-config \\
    libssl-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY . .

# Build the application
RUN cargo build --release

# Final stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \\
    ca-certificates \\
    libssl3 \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/${repoName} .

ENTRYPOINT ["./${repoName}"]
`;
      break;

    default:
      dockerfile = `FROM ubuntu:22.04

WORKDIR /app

# Install common dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    build-essential \\
    curl \\
    wget \\
    && rm -rf /var/lib/apt/lists/*

# Copy application
COPY . .

# Manual installation steps required
# TODO: Add specific installation commands for this tool

ENTRYPOINT ["/bin/bash"]
`;
  }

  return dockerfile;
}

/**
 * Generate build script
 */
function generateBuildScript(language: string, _dependencies: ToolDependency[]): string {
  let script = '#!/bin/bash\n\n';
  script += 'set -e\n\n';
  script += 'echo "Building tool from GitHub repository..."\n\n';

  switch (language) {
    case 'Python':
      script += '# Install Python dependencies\n';
      script += 'if [ -f requirements.txt ]; then\n';
      script += '  pip install -r requirements.txt\n';
      script += 'fi\n\n';
      script += '# Install the tool\n';
      script += 'if [ -f setup.py ]; then\n';
      script += '  pip install -e .\n';
      script += 'fi\n';
      break;

    case 'JavaScript':
    case 'TypeScript':
      script += '# Install npm dependencies\n';
      script += 'npm install\n\n';
      if (language === 'TypeScript') {
        script += '# Build TypeScript\n';
        script += 'npm run build\n\n';
      }
      break;

    case 'Go':
      script += '# Download Go dependencies\n';
      script += 'go mod download\n\n';
      script += '# Build Go application\n';
      script += 'go build -o tool\n';
      break;

    case 'Rust':
      script += '# Build Rust application\n';
      script += 'cargo build --release\n';
      break;

    default:
      script += '# Manual build steps required\n';
      script += 'echo "Please add build steps for this language"\n';
  }

  script += '\necho "Build completed successfully!"\n';

  return script;
}

/**
 * Check for tests in repository
 */
async function checkForTests(owner: string, repo: string): Promise<boolean> {
  const testPaths = ['test', 'tests', '__tests__', 'spec', 'specs'];

  for (const path of testPaths) {
    try {
      await octokit.repos.getContent({ owner, repo, path });
      return true;
    } catch (error) {
      // Path doesn't exist, continue
    }
  }

  return false;
}

/**
 * Estimate build time in minutes
 */
function estimateBuildTime(language: string, dependencyCount: number): number {
  let baseTime = 2; // Base 2 minutes

  // Add time based on language complexity
  const languageTime: Record<string, number> = {
    'Python': 1,
    'JavaScript': 2,
    'TypeScript': 3,
    'Go': 5,
    'Rust': 10,
    'C++': 8,
    'C': 6,
  };

  baseTime += languageTime[language] || 3;

  // Add time based on dependencies (0.5 minutes per dependency)
  baseTime += Math.ceil(dependencyCount * 0.5);

  return baseTime;
}

/**
 * Install a tool from GitHub
 */
export async function installToolFromGitHub(
  githubUrl: string,
  _toolId?: string
): Promise<string> {
  try {
    // First, analyze the repository
    console.log(`Analyzing repository: ${githubUrl}`);
    const analysis = await analyzeGitHubRepository(githubUrl);

    // Create installation record
    const [installation] = await db.insert(githubToolInstallations).values({
      githubUrl,
      repoName: analysis.repoName,
      detectedLanguage: analysis.language,
      detectedDependencies: analysis.detectedDependencies,
      suggestedInstallMethod: analysis.suggestedInstallMethod,
      dockerfileGenerated: analysis.suggestedDockerfile,
      buildScriptGenerated: analysis.suggestedBuildScript,
      installStatus: 'pending',
      analyzedAt: new Date(),
    }).returning();

    console.log(`Repository analyzed. Installation ID: ${installation.id}`);
    console.log(`Detected language: ${analysis.language}`);
    console.log(`Dependencies: ${analysis.detectedDependencies.length}`);
    console.log(`Suggested install method: ${analysis.suggestedInstallMethod}`);

    // Update status to installing
    await db.update(githubToolInstallations)
      .set({ installStatus: 'installing' })
      .where(eq(githubToolInstallations.id, installation.id));

    // TODO: Actual installation logic will be implemented in Day 3-4
    // For now, we return the installation ID

    return installation.id;
  } catch (error: any) {
    console.error('Installation failed:', error);
    throw new Error(`Failed to install tool: ${error.message}`);
  }
}

/**
 * Get installation status
 */
export async function getInstallationStatus(installationId: string) {
  const [installation] = await db
    .select()
    .from(githubToolInstallations)
    .where(eq(githubToolInstallations.id, installationId));

  return installation;
}

/**
 * List all GitHub tool installations
 */
export async function listGitHubInstallations() {
  return await db
    .select()
    .from(githubToolInstallations)
    .orderBy(githubToolInstallations.createdAt);
}
