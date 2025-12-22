# OffSec Team R&D Integration - Tier 2/3 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🟡 Tier 2 (Foundation) / 🟢 Tier 3 (Advanced)  
**Timeline:** Week 3-4 (Foundation), Post-Beta (Full features)  
**Total Items:** 25  
**Last Updated:** December 4, 2025

---

## Overview

This document details the integration of offsec-team components as an internal **Offensive Security Research & Development Team** within RTPI. This creates a dedicated R&D lab environment for tool testing, vulnerability research, and advanced technique development.

**Source:** https://github.com/cmndcntrlcyber/offsec-team

### Purpose
- **Create internal R&D team** of specialized offensive security agents
- **Absorb useful tools** from offsec-team `tools/` directory
- **Extend agent capabilities** with advanced offensive security functions
- **Enable research workflows** for tool development and testing
- **Provide specialized agents** for Burp Suite, Empire C2, advanced fuzzing

### Integration Approach
✅ **Absorbed Components** - Take what's useful from offsec-team  
❌ **Discarded Components** - Ignore conflicting infrastructure (MCP servers, OpenWebUI bridge, gateway, workers)  
✅ **RTPI-Native** - Build using RTPI's existing architecture  
✅ **Compatible** - No breaking changes to current RTPI

### Success Criteria
- ✅ OffSec Team agents registered in RTPI agents table
- ✅ Tools from offsec-team integrated into RTPI tools system
- ✅ R&D workflow page operational
- ✅ No conflicts with existing RTPI functionality
- ✅ Advanced offensive capabilities available
- ✅ One complete POC from Reverse Engineering to Compiled binary & exe written in Rust


---

## Table of Contents

1. [Components to Absorb](#components-to-absorb)
2. [Components to Discard](#components-to-discard)
3. [OffSec Team Page (New)](#offsec-team-page-new)
4. [R&D Agents Integration](#rd-agents-integration)
5. [Tool Library Integration](#tool-library-integration)
6. [Research Workflows](#research-workflows)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Implementation Plan](#implementation-plan)
10. [Testing Requirements](#testing-requirements)

---

## Components to Absorb

### From offsec-team Repository

#### ✅ **Tools Directory** (Primary Focus)
**Location:** `tools/`  
**Purpose:** Offensive security agent implementations  
**Integration:** Import into RTPI as specialized agent types

**Tools to Extract:**
- Burp Suite orchestration agents
- Empire C2 management agents
- Web vulnerability testing agents
- Framework security analysis agents
- Advanced fuzzing tools
- Research and experimentation tools

#### ✅ **Useful Scripts**
**Location:** `scripts/`  
**Purpose:** Automation and helper scripts  
**Integration:** Adapt for RTPI's script directory

#### ✅ **Documentation**
**Location:** `docs/`  
**Purpose:** Tool usage and integration guides  
**Integration:** Reference for implementing features

#### ✅ **Configuration Patterns**
**Location:** `configs/`  
**Purpose:** Tool configuration examples  
**Integration:** Use as templates for RTPI tool configs

---

## Components to Discard

### ❌ Components NOT Being Integrated

#### **MCP Servers** (Attack-Node, RTPI-Pen, MCP-Nexus)
**Reason:** RTPI already has its own MCP server architecture  
**Alternative:** Use RTPI's existing MCP server manager and Tavily integration

#### **OpenWebUI Bridge**
**Reason:** RTPI has its own web UI (React-based)  
**Alternative:** Build features into RTPI's existing pages

#### **Gateway**
**Reason:** RTPI uses Express.js for routing  
**Alternative:** Add endpoints to RTPI's existing API (`server/api/v1/`)

#### **Infrastructure Layer**
**Reason:** RTPI has its own Docker/container management  
**Alternative:** Use RTPI's existing docker-executor service

#### **Workers**
**Reason:** Conflict with RTPI's architecture  
**Alternative:** Use RTPI's existing services and agent workflow orchestrator

---

## OffSec Team Page (New)

### Status: 🟡 Tier 2 - Medium Priority

### Description
New dedicated page for internal Offensive Security R&D team operations, tool testing, and research workflows.

### Page Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ OffSec Team R&D Lab                                              │
│ Internal offensive security research and development             │
├─────────────────────────────────────────────────────────────────┤
│ [R&D Agents] [Tool Lab] [Research Projects] [Experiments]       │
│ [Knowledge Base]                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                     [TAB CONTENT AREA]                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sidebar Navigation
```
┌──────────────────────────────┐
│ 🏠 Dashboard                 │
│ 🎯 Operations                │
│ ◉ Targets                    │
│ ⚠️ Vulnerabilities           │
│ 🤖 Agents                    │
│ 🖥️ Infrastructure            │
│ 🛠️ Tools                     │
│ 📊 Reports                   │
│ 📈 Surface Assessment        │
│ ⚔️ ATT&CK                    │
│ 🔬 OffSec Team R&D           │ ← NEW
│                              │
│ ADMINISTRATION               │
│ ⚙️ Settings                  │
│ 👤 Profile                   │
│ 👥 User Management           │
└──────────────────────────────┘
```

### Implementation Checklist

**Phase 1: Page Foundation (Days 1-2)**
- [ ] Create route `/offsec-rd` in `client/src/App.tsx`
- [ ] Create `client/src/pages/OffSecTeam.tsx` page component
- [ ] Add sidebar navigation entry with icon (🔬) to `client/src/components/layout/Sidebar.tsx`
- [ ] Implement tab navigation using Radix UI Tabs component
- [ ] Create base layout with header and tab containers

**Phase 2: Tab Components (Days 2-3)**
- [ ] Create `client/src/components/offsec-team/RDAgentsTab.tsx` - R&D agents management
- [ ] Create `client/src/components/offsec-team/ToolLabTab.tsx` - Tool testing and validation
- [ ] Create `client/src/components/offsec-team/ResearchProjectsTab.tsx` - Active research tracking
- [ ] Create `client/src/components/offsec-team/ExperimentsTab.tsx` - Experimental workflow execution
- [ ] Create `client/src/components/offsec-team/KnowledgeBaseTab.tsx` - Research documentation

**Phase 3: Agent Integration (Day 3)**
- [ ] Set up agent management for R&D team in existing agents system
- [ ] Create agent type filter/category "R&D" in agents table
- [ ] Implement agent card components for Burp Suite, Empire C2, Fuzzing agents
- [ ] Add agent configuration panels for specialized tools
- [ ] Integrate with existing agent workflow orchestrator

**Phase 4: Tool Library Integration (Day 3-4)**
- [ ] Create tool upload interface in Tool Lab tab
- [ ] Implement tool validation system (safety checks, signature verification)
- [ ] Add tool testing environment (sandboxed execution)
- [ ] Create tool metadata editor (name, description, author, version)
- [ ] Integrate with existing security tools table

**Phase 5: Research Workflows (Day 4)**
- [ ] Implement research project creation form
- [ ] Create project status tracking (draft, active, completed)
- [ ] Add experiment workflow execution interface
- [ ] Implement results capture and analysis components
- [ ] Create knowledge base article editor (Markdown support)

**Phase 6: Backend Integration (Throughout)**
- [ ] Create API endpoints for R&D agents (GET, POST, PUT, DELETE)
- [ ] Implement research projects API (`/api/v1/offsec-rd/projects`)
- [ ] Create experiments API (`/api/v1/offsec-rd/experiments`)
- [ ] Add tool library API (`/api/v1/offsec-rd/tools`)
- [ ] Implement knowledge base API (`/api/v1/offsec-rd/knowledge`)

**Phase 7: Database Schema (Day 1)**
- [ ] Create migration `0011_add_offsec_team.sql`
- [ ] Add `research_projects` table with foreign keys to users and agents
- [ ] Add `rd_experiments` table linking to projects and workflows
- [ ] Add `tool_library` table extending existing security_tools
- [ ] Add `knowledge_base` table for research documentation
- [ ] Create appropriate indexes for performance

**Phase 8: Security & Permissions (Day 4)**
- [ ] Implement role-based access control (RBAC) for R&D features
- [ ] Add permission checks: `offsec_rd:read`, `offsec_rd:write`, `offsec_rd:admin`
- [ ] Restrict dangerous tool execution to authorized users only
- [ ] Implement audit logging for all R&D activities
- [ ] Add sandboxing configuration for experimental code execution

**Phase 9: Testing & Validation (Throughout)**
- [ ] Write unit tests for R&D agents API endpoints
- [ ] Create E2E tests for research project workflows
- [ ] Test tool upload and validation system
- [ ] Verify experiment execution and results capture
- [ ] Test knowledge base CRUD operations

**Dependencies:**
- Radix UI Tabs component
- Existing agents system and workflow orchestrator
- Docker executor service for tool testing
- Markdown editor library (e.g., `react-markdown-editor-lite`)
- File upload library (existing from security tools)

**Integration Points:**
- Agents system: Extend existing agent types with R&D category
- Tools system: Extend security_tools table with R&D metadata
- Workflow system: Reuse agent-workflow-orchestrator for experiments
- Infrastructure: Use existing docker-executor for sandboxed tool testing
- Permissions: Extend existing RBAC system with R&D roles

### Estimated Effort
3-4 days

---

## R&D Agents Integration

### Status: 🟡 Tier 2 - High Priority

### Description
Import offsec-team agents as specialized agent types in RTPI's existing agent system.

### Agent Types from offsec-team

#### 1. **Burp Suite Agent**
**Purpose:** Orchestrate Burp Suite Professional scans  
**Capabilities:**
- Automated active/passive scanning
- Scan configuration management
- Result parsing and vulnerability extraction
- Integration with Burp REST API

**RTPI Integration:**
```typescript
// Add to existing agents table
const burpAgent = {
  name: "Burp Suite Orchestrator",
  type: "custom", // Use existing agent type enum
  status: "idle",
  config: {
    model: "gpt-4", // Or configured AI model
    systemPrompt: "You are a Burp Suite orchestration specialist...",
    capabilities: ["web_scanning", "vulnerability_detection", "burp_api"],
    toolSettings: {
      burpApiUrl: process.env.BURP_API_URL,
      burpApiKey: process.env.BURP_API_KEY,
      scanProfile: "comprehensive"
    }
  }
};
```

#### 2. **Empire C2 Agent**
**Purpose:** Manage Empire Command & Control operations  
**Capabilities:**
- Listener management
- Payload generation
- Agent coordination
- Post-exploitation automation

**RTPI Integration:**
```typescript
const empireAgent = {
  name: "Empire C2 Manager",
  type: "custom",
  config: {
    systemPrompt: "You are an Empire C2 framework specialist...",
    capabilities: ["c2_management", "payload_generation", "post_exploitation"],
    toolSettings: {
      empireUrl: process.env.EMPIRE_BASE_URL,
      empireToken: process.env.EMPIRE_API_TOKEN
    }
  }
};
```

#### 3. **Advanced Fuzzing Agent**
**Purpose:** Fuzzing and input validation testing  
**Capabilities:**
- FFUF integration
- Custom wordlist management
- Parameter discovery
- Fuzzing result analysis

#### 4. **Framework Security Agent**
**Purpose:** Framework and dependency vulnerability analysis  
**Capabilities:**
- Technology stack detection
- Framework version analysis
- Vulnerability matching
- Security advisory aggregation

#### 5. **Maldev Agent**
**Purpose:** Binary Analysis & Exploitation R&D  
**Capabilities:**
- Reverse engineering
- ROP (Return-Oriented Programming) development
- Proof-of-concept creation
- Prioritizes Rust-based development; converts other codebases to Rust

**Tool Repositories (44 total):**

**Reverse Engineering (17 repos):**
- mcp-windbg, x64dbgMCP, jaegis-RAVERSE
- oss-fuzz-gen, winafl, Jackalope
- objdiff, ACEshark, sl0ppy-UEFIScan
- COM-Fuzzer, docker-binaryexploitation
- GhidraMCP, BinaryAnalysisMCPs
- xgadget, rhabdomancer, Aplos, wtf

**ROP Development (8 repos):**
- Obfusk8, RustChain, Ropdump
- rop-tool, ropium, ROPgadget
- p0tools, jopcall

**Proof-of-concept (8 repos):**
- Shellcode-IDE, packer, PadZip-Evader
- ditto, Umbrella, OneNote-SVG-AutoRun-Bypass
- DarkLnk, hypervinject-poc

**Rust-Based Development (11 repos):**
- TamperETW, SHAPESHIFTER, SharpCall
- SysWhispers, SharpSploit, rustclr
- windows_reflective_loader, NSecSoftBYOVD
- ARM64-ReflectiveDLLInjection, C_To_Shellcode_NG
- SharpBypassUAC

#### 6. **Azure-AD Agent**
**Purpose:** Azure & Active Directory Attack Research  
**Capabilities:**
- EntraID abuse techniques
- Active Directory enumeration
- Privilege escalation research
- Persistence mechanisms
- Lateral movement techniques
- Prioritizes Rust & C++ development

**Tool Repositories (28 total):**

**EntraID Abuse (5 repos):**
- EntraMFACheck, linWinPwn
- AADInternals, AADInternals-Endpoints
- EntraOps

**(A)AD Initial Access (2 repos):**
- Chrome-App-Bound-Encryption-Decryption
- ScubaGear

**(A)AD Enumeration (5 repos):**
- ShareHound, BloodHound-MCP-AI
- NetworkHound, RustHound-CE
- linWinPwn

**(A)AD Privesc (3 repos):**
- Dumpert, DonPwner, linWinPwn

**(A)AD Persistence (3 repos):**
- Titanis, Dumpert, linWinPwn

**(A)AD Lateral Movement (3 repos):**
- rpc2efs, Titanis, linWinPwn

**Rust & C++ Development (7 repos):**
- PowerChell, offensive-powershell
- OFFSEC-PowerShell, Invisi-Shell
- DSInternals, BYOSI, PowerHouse

#### 7. **Research Agent**
**Purpose:** General R&D and experimentation  
**Capabilities:**
- Tool testing
- Technique development
- Proof-of-concept creation
- Knowledge base curation

### Database Integration
**Use Existing Schema:**
```sql
-- No new tables needed, use existing agents table
-- Just add new agent records with type="custom"

INSERT INTO agents (name, type, status, config) VALUES
('Burp Suite Orchestrator', 'custom', 'idle', '{"toolSettings": {"burpApiUrl": "...", "burpApiKey": "..."}}'),
('Empire C2 Manager', 'custom', 'idle', '{"toolSettings": {"empireUrl": "...", "empireToken": "..."}}'),
('Advanced Fuzzing Agent', 'custom', 'idle', '{"capabilities": ["ffuf", "wordlist_management", "parameter_discovery"]}'),
('Framework Security Agent', 'custom', 'idle', '{"capabilities": ["tech_stack_detection", "framework_analysis"]}'),
('Maldev Agent', 'custom', 'idle', '{"capabilities": ["reverse_engineering", "rop_development", "rust_development"], "repositories": 44, "primaryLanguage": "rust"}'),
('Azure-AD Agent', 'custom', 'idle', '{"capabilities": ["entra_id_abuse", "ad_enumeration", "lateral_movement"], "repositories": 28, "primaryLanguages": ["rust", "cpp"]}'),
('Research Agent', 'custom', 'idle', '{"capabilities": ["tool_testing", "poc_creation", "knowledge_curation"]}');
```

### Implementation Checklist

**Phase 1: Agent Extraction & Analysis (Day 1)**
- [ ] Clone offsec-team repository: `git clone https://github.com/cmndcntrlcyber/offsec-team`
- [ ] Extract agent implementations from `offsec-team/tools/` directory
- [ ] Analyze each agent's dependencies, configuration requirements, and API interfaces
- [ ] Document agent capabilities and tool integrations for each of the 7 agent types
- [ ] Identify conflicts with existing RTPI agents and plan resolution strategy

**Phase 2: Agent Interface Adaptation (Days 2-3)**
- [ ] Adapt Burp Suite agent to RTPI agent interface (`server/services/agents/burp-suite-agent.ts`)
- [ ] Adapt Empire C2 agent to RTPI agent interface (`server/services/agents/empire-c2-agent.ts`)
- [ ] Adapt Advanced Fuzzing agent to RTPI agent interface (`server/services/agents/fuzzing-agent.ts`)
- [ ] Adapt Framework Security agent to RTPI agent interface (`server/services/agents/framework-security-agent.ts`)
- [ ] Adapt Maldev agent to RTPI agent interface (`server/services/agents/maldev-agent.ts`)
- [ ] Adapt Azure-AD agent to RTPI agent interface (`server/services/agents/azure-ad-agent.ts`)
- [ ] Adapt Research agent to RTPI agent interface (`server/services/agents/research-agent.ts`)
- [ ] Ensure all agents implement required methods: `execute()`, `configure()`, `validate()`

**Phase 3: Database Registration (Day 3)**
- [ ] Register agents in RTPI agents table using SQL migration or seed script
- [ ] Set initial agent status to 'idle' for all R&D agents
- [ ] Configure agent metadata (name, type='custom', capabilities array)
- [ ] Add agent-specific configuration objects (API URLs, tokens, repository lists)
- [ ] Create agent category/tag "R&D" for filtering in UI
- [ ] Add foreign key relationships to users table (created_by field)

**Phase 4: Agent Configuration UI (Days 3-4)**
- [ ] Create agent configuration modal component (`client/src/components/offsec-team/AgentConfigModal.tsx`)
- [ ] Implement configuration forms for each agent type with appropriate input fields
- [ ] Add API URL/token input fields for Burp Suite and Empire C2 agents
- [ ] Create repository selection interface for Maldev and Azure-AD agents
- [ ] Implement capability checkboxes for multi-capability agents
- [ ] Add validation for required configuration fields
- [ ] Include test connection button for API-based agents (Burp, Empire)
- [ ] Persist configuration changes to agents.config JSONB column

**Phase 5: Agent Execution Integration (Day 4-5)**
- [ ] Test agent execution through existing `agent-tool-connector.ts` service
- [ ] Verify agents can access configured tools via `getToolConnector()` method
- [ ] Ensure agents respect tool execution policies and security constraints
- [ ] Implement error handling for failed tool connections or executions
- [ ] Add logging for all agent activities using existing logger service
- [ ] Test agent communication with external services (Burp API, Empire API)

**Phase 6: Agent-Specific Capabilities (Day 5)**
- [ ] Add Burp Suite-specific capabilities: scan configuration, result parsing, vulnerability extraction
- [ ] Add Empire C2-specific capabilities: listener management, payload generation, agent coordination
- [ ] Add Fuzzing-specific capabilities: wordlist management, parameter discovery, fuzzing templates
- [ ] Add Framework Security capabilities: tech stack detection, vulnerability mapping, framework analysis
- [ ] Add Maldev capabilities: reverse engineering tools, ROP chain generation, Rust compilation
- [ ] Add Azure-AD capabilities: EntraID enumeration, AD persistence, lateral movement techniques
- [ ] Add Research capabilities: POC creation, tool testing workflows, knowledge documentation

**Phase 7: Workflow Orchestrator Integration (Day 5-6)**
- [ ] Integrate R&D agents with existing `agent-workflow-orchestrator.ts` service
- [ ] Create workflow templates for common R&D tasks (vulnerability research, tool testing, POC development)
- [ ] Implement agent chaining for complex workflows (e.g., Fuzzing → Burp → Maldev)
- [ ] Add workflow task types specific to R&D agents
- [ ] Enable agent collaboration through shared workflow context
- [ ] Test multi-agent workflows with R&D agent combinations

**Phase 8: Agent UI Components (Day 6)**
- [ ] Create agent status cards for R&D Agents tab showing name, status, capabilities
- [ ] Implement agent activity timeline showing recent executions and results
- [ ] Add agent metrics dashboard (successful executions, failed attempts, avg execution time)
- [ ] Create agent control panel with start/stop/configure actions
- [ ] Implement agent logs viewer showing execution history and error messages
- [ ] Add agent capability badges visually indicating available features

**Phase 9: Security & Access Control (Throughout)**
- [ ] Implement permission checks for R&D agent access (`offsec_rd:agent:read`, `offsec_rd:agent:execute`)
- [ ] Restrict dangerous agent capabilities to admin users only (e.g., C2 operations, malware dev)
- [ ] Add audit logging for all R&D agent executions with user, timestamp, and action details
- [ ] Implement rate limiting for agent executions to prevent abuse
- [ ] Add sandboxing configuration for agents executing untrusted code
- [ ] Ensure API keys and tokens are stored encrypted in database

**Phase 10: Testing & Validation (Day 6)**
- [ ] Write unit tests for each agent's core methods (`execute()`, `configure()`, `validate()`)
- [ ] Create integration tests for agent-tool-connector interactions
- [ ] Test workflow orchestration with R&D agent workflows
- [ ] Verify agent configuration persistence and retrieval from database
- [ ] Test agent UI components with mock data and real agent instances
- [ ] Validate security controls and permission checks work correctly

**Dependencies:**
- offsec-team repository (source of agent implementations)
- Burp Suite Professional API (for Burp Suite agent)
- Empire C2 server (for Empire agent)
- FFUF binary (for Fuzzing agent)
- Rust toolchain (for Maldev agent compilation tasks)
- Azure CLI / Azure PowerShell (for Azure-AD agent)

**Integration Points:**
- `server/services/agent-tool-connector.ts` - Tool execution interface
- `server/services/agent-workflow-orchestrator.ts` - Workflow management
- `server/api/v1/agents.ts` - Existing agents API (extend for R&D agents)
- `client/src/pages/Agents.tsx` - Existing agents page (filter by R&D category)
- `shared/schema.ts` - Agents table schema (already supports custom types)

### Estimated Effort
5-6 days

---

## Tool Library Integration

### Status: 🟡 Tier 2 - Medium Priority

### Description
Integrate the 22 offensive security tools from offsec-team into RTPI's existing security tools system.

### Tools from offsec-team

Based on the README, offsec-team integrates 22 security tools:
1. Nmap Scanner
2. Metasploit Framework
3. FFUF Fuzzer
4. SQLMap
5. Burp Suite Professional
6. Empire C2 Framework
7. WinDBG
8. Hydra
9. Masscan
10. Katana
11. Nuclei Scanner
12. HTTPx
13. Assetfinder
14. Amass
15. Arjun
16. AlterX
17. Certificate Transparency
18. Scout Suite
19. shuffledns
20. SSL Scanner
21. Wayback URLs
22. Additional tools from `tools/` directory

### Integration Strategy

#### **Use RTPI's Existing security_tools Table**
```sql
-- No new schema needed
-- Add new tool records to existing table

INSERT INTO security_tools (name, category, description, command, docker_image, metadata)
VALUES
('Burp Suite Professional', 'web_security', 'Web application security testing platform', 'burp', 'burp/suite:pro', '{"api_enabled": true}'),
('Empire C2', 'post_exploitation', 'PowerShell and Python post-exploitation framework', 'empire', 'empire/framework:latest', '{"listeners": [], "stagers": []}'),
('FFUF', 'web_security', 'Fast web fuzzer', 'ffuf', 'ffuf/ffuf:latest', '{"wordlists": "/wordlists"}');
-- ... more tools
```

#### **Leverage Existing Tool Management**
- Use RTPI's existing `tools/` page and API
- Utilize docker-executor service for container-based tools
- Integrate with agent-tool-connector for agent access
- Follow existing tool configuration schema (from Task 6)

### Implementation Checklist

**Phase 1: Tool Audit & Categorization (Day 1)**
- [ ] Audit offsec-team tools list - verify all 22 tools from repository README
- [ ] Map to RTPI's tool categories: scanner, exploit, c2, fuzzer, enumeration, post-exploitation
- [ ] Create spreadsheet documenting: tool name, category, Docker support, dependencies, CLI args
- [ ] Identify tools already in RTPI to avoid duplication (Nmap, Metasploit, SQLMap, etc.)
- [ ] Prioritize tools by R&D value: high (Burp, Empire, FFUF), medium (LinEnum, Evil-WinRM), low (duplicates)

**Phase 2: Tool Registration (Days 1-2)**
- [ ] Create tool registration records in `security_tools` table for each of 22 tools
- [ ] Define tool metadata: name, version, category, description, official URL
- [ ] Specify installation methods: Docker image, binary download, package manager, source compile
- [ ] Add tool capabilities tags: ["web_scanning"], ["c2_framework"], ["fuzzing"], etc.
- [ ] Configure tool execution modes: interactive, automated, API-driven
- [ ] Set tool risk levels: safe, moderate, dangerous (for permission checks)

**Phase 3: Docker Images (Days 2-3)**
- [ ] Identify tools with official Docker images (Nmap, SQLMap, Burp Suite, etc.)
- [ ] Create custom Dockerfiles for tools without official images in `docker/tools/` directory
- [ ] Build and test Docker images locally: `docker build -t rtpi/tool-name:latest .`
- [ ] Push images to Docker registry (Docker Hub or private registry)
- [ ] Update tool records with Docker image references: `dockerImage: "rtpi/burp-suite:latest"`
- [ ] Configure volume mounts for tool output and configuration persistence
- [ ] Set resource limits (CPU, memory) for each tool container

**Phase 4: Tool Parameter Configuration (Day 3)**
- [ ] Define default parameters for each tool in `tool_configs` JSONB column
- [ ] Create parameter schemas with validation rules (required fields, allowed values, regex patterns)
- [ ] Implement parameter templates for common use cases (quick scan, deep scan, stealth mode)
- [ ] Add parameter documentation with examples and best practices
- [ ] Create UI form schemas for dynamic parameter input in Tool Lab
- [ ] Implement parameter validation on frontend and backend to prevent injection attacks

**Phase 5: Docker Executor Integration (Day 3-4)**
- [ ] Test tool execution through existing `docker-executor.ts` service
- [ ] Verify container creation, execution, and cleanup workflows
- [ ] Implement stdout/stderr capture for tool output
- [ ] Add execution timeout handling to prevent runaway containers
- [ ] Test error scenarios: missing image, invalid parameters, container crashes
- [ ] Implement output parsing for structured tool results (JSON, XML, CSV)
- [ ] Add progress monitoring for long-running tools (via Docker logs)

**Phase 6: Agent-Tool Assignment (Day 4)**
- [ ] Add tool assignment interface to R&D Agents tab
- [ ] Allow assigning multiple tools to each agent based on capabilities
- [ ] Create agent-tool compatibility matrix (e.g., Burp Suite → Burp Suite Agent only)
- [ ] Implement tool availability checks before agent execution
- [ ] Add tool version requirements to agent configurations
- [ ] Enable dynamic tool discovery - agents detect available tools at runtime

**Phase 7: Tool Usage Documentation (Day 4)**
- [ ] Create tool usage guide for each tool in `docs/tools/` directory
- [ ] Document command-line arguments and parameter options
- [ ] Provide usage examples for common scenarios
- [ ] Include troubleshooting section for common errors
- [ ] Add security considerations and best practices
- [ ] Link documentation to tool cards in Tool Lab UI

**Phase 8: Tool Upload Interface (Throughout)**
- [ ] Create tool upload form in Tool Lab tab (`client/src/components/offsec-team/ToolUploadForm.tsx`)
- [ ] Implement file upload for tool binaries, scripts, or Dockerfiles
- [ ] Add tool metadata editor: name, version, category, description, author
- [ ] Implement file type validation (only allow: .sh, .py, .rb, Dockerfile, .zip)
- [ ] Add virus scanning integration (optional: ClamAV) for uploaded files
- [ ] Store uploaded tools in secure directory with restricted permissions
- [ ] Create approval workflow for admin review before tool activation

**Phase 9: Tool Testing & Validation (Throughout)**
- [ ] Create tool testing checklist for each tool
- [ ] Test each tool against safe targets in isolated environment
- [ ] Verify tool output matches expected format and structure
- [ ] Test tool parameter validation and error handling
- [ ] Validate Docker image builds and container execution
- [ ] Test tool execution through agent-tool-connector interface
- [ ] Verify tool cleanup after execution (no orphaned containers or files)

**Phase 10: Tool Library UI (Throughout)**
- [ ] Create tool library grid view showing all available tools
- [ ] Implement tool search and filtering (by category, name, capabilities)
- [ ] Add tool detail modal with full description, parameters, usage examples
- [ ] Create tool status indicators: installed, available, updating, error
- [ ] Implement tool installation/uninstallation actions
- [ ] Add tool version management (update, rollback)
- [ ] Show tool usage statistics: execution count, success rate, avg duration

**Security Considerations:**
- [ ] Implement sandboxed execution for all tools (Docker network isolation)
- [ ] Restrict tool execution to authorized users with `offsec_rd:tool:execute` permission
- [ ] Audit log all tool executions with user, timestamp, parameters, and results
- [ ] Scan uploaded tools for malware before allowing execution
- [ ] Implement output sanitization to prevent XSS or command injection
- [ ] Restrict tool file system access to designated directories only
- [ ] Disable network access for tools that don't require it

**Dependencies:**
- Docker Engine (existing RTPI dependency)
- `docker-executor.ts` service (existing RTPI service)
- `security_tools` table (existing in database schema)
- File upload library (existing from security tools feature)
- Virus scanning service (optional: ClamAV integration)

**Integration Points:**
- `server/services/docker-executor.ts` - Tool container management
- `server/services/agent-tool-connector.ts` - Agent-tool communication
- `server/api/v1/security-tools.ts` - Existing tools API (extend for R&D tools)
- `client/src/pages/Tools.tsx` - Existing tools page (add R&D category filter)
- `client/src/components/offsec-team/ToolLabTab.tsx` - New R&D-specific tool interface

### Estimated Effort
3-4 days

---

## Research Workflows

### Status: 🟢 Tier 3 - Medium Priority

### Description
Dedicated workflows for R&D activities, tool testing, and technique development.

### Workflow Types

#### 1. **Tool Testing Workflow**
```typescript
interface ToolTestWorkflow {
  name: "Tool Validation";
  steps: [
    {
      agent: "Research Agent",
      task: "Install and configure new tool",
      tool: "GitHub Auto-Installer"
    },
    {
      agent: "Research Agent",
      task: "Run test suite against safe targets",
      validation: "Verify expected output"
    },
    {
      agent: "Research Agent",
      task: "Document findings and integration notes"
    }
  ]
}
```

#### 2. **Vulnerability Research Workflow**
Systematic approach to discovering, analyzing, and documenting new vulnerabilities in target applications or frameworks.

```typescript
interface VulnerabilityResearchWorkflow {
  name: "Vulnerability Discovery & Analysis";
  description: "Multi-phase workflow for discovering and validating security vulnerabilities";
  steps: [
    {
      phase: "Reconnaissance",
      agent: "Framework Security Agent",
      task: "Identify target technology stack and version",
      tools: ["Wappalyzer", "whatweb", "BuildWith"],
      output: "tech_stack_analysis.json"
    },
    {
      phase: "Vulnerability Scanning",
      agent: "Burp Suite Agent",
      task: "Run automated vulnerability scans",
      tools: ["Burp Suite Professional"],
      config: {
        scanProfile: "comprehensive",
        targetUrl: "{{target_url}}",
        authConfig: "{{auth_tokens}}"
      },
      output: "burp_scan_results.xml"
    },
    {
      phase: "Manual Analysis",
      agent: "Research Agent",
      task: "Analyze scan results and identify high-value targets",
      input: "burp_scan_results.xml",
      actions: [
        "Filter out false positives",
        "Prioritize by severity and exploitability",
        "Identify unique attack surfaces"
      ],
      output: "vulnerability_candidates.json"
    },
    {
      phase: "Exploitation Development",
      agent: "Maldev Agent",
      task: "Develop proof-of-concept exploit",
      tools: ["Custom exploit framework", "Python", "Rust"],
      validation: "Successfully execute exploit in test environment",
      output: "exploit_poc.py"
    },
    {
      phase: "Impact Analysis",
      agent: "Research Agent",
      task: "Assess vulnerability impact and severity",
      criteria: [
        "Confidentiality impact",
        "Integrity impact",
        "Availability impact",
        "Attack complexity",
        "Privileges required"
      ],
      output: "cvss_score_analysis.json"
    },
    {
      phase: "Documentation",
      agent: "Research Agent",
      task: "Create comprehensive vulnerability report",
      sections: [
        "Executive Summary",
        "Technical Details",
        "Proof-of-Concept",
        "Impact Assessment",
        "Remediation Recommendations",
        "Timeline"
      ],
      output: "vulnerability_report.md"
    },
    {
      phase: "Knowledge Base Update",
      agent: "Research Agent",
      task: "Add findings to knowledge base",
      actions: [
        "Tag vulnerability with relevant categories",
        "Link to MITRE ATT&CK techniques",
        "Add to searchable knowledge base",
        "Update agent training data"
      ],
      output: "kb_entry_id"
    }
  ],
  deliverables: [
    "Detailed vulnerability report",
    "Working proof-of-concept exploit",
    "CVSS score with justification",
    "Remediation recommendations",
    "Knowledge base entry"
  ]
}
```

**Workflow Triggers:**
- Manual initiation from Research Projects tab
- Scheduled periodic research on target applications
- Alert-based triggers from surface assessment findings
- Integration with bug bounty program workflows

**Success Criteria:**
- ✅ Vulnerability validated and reproduced
- ✅ CVSS score calculated and justified
- ✅ Proof-of-concept exploit created
- ✅ Complete documentation in knowledge base
- ✅ Remediation guidance provided

#### 3. **Technique Development Workflow**
Workflow for developing, testing, and documenting new offensive security techniques and methodologies.

```typescript
interface TechniqueDevelopmentWorkflow {
  name: "Offensive Technique R&D";
  description: "End-to-end workflow for developing novel attack techniques";
  steps: [
    {
      phase: "Research & Ideation",
      agent: "Research Agent",
      task: "Research state-of-the-art techniques and identify gaps",
      sources: [
        "MITRE ATT&CK framework",
        "Recent security research papers",
        "Bug bounty disclosures",
        "CTF challenges and write-ups"
      ],
      output: "research_notes.md"
    },
    {
      phase: "Hypothesis Formation",
      agent: "Research Agent",
      task: "Define technique hypothesis and objectives",
      deliverables: [
        "Technique description and purpose",
        "Expected outcomes",
        "Success criteria",
        "Threat actor use cases",
        "Detection evasion strategies"
      ],
      output: "technique_hypothesis.json"
    },
    {
      phase: "Tool Selection",
      agent: "Research Agent",
      task: "Identify required tools and frameworks",
      categories: [
        "Development tools (compilers, debuggers)",
        "Testing tools (sandboxes, VMs)",
        "Offensive tools (C2, payloads)",
        "Reverse engineering tools"
      ],
      output: "tool_requirements.json"
    },
    {
      phase: "Prototype Development",
      agent: "Maldev Agent",
      task: "Develop initial technique prototype",
      tools: ["Rust", "C++", "Python", "PowerShell"],
      repositories: [
        "TamperETW", "SHAPESHIFTER", "SharpCall",
        "SysWhispers", "rustclr", "windows_reflective_loader"
      ],
      focus: "Prioritize Rust and C++ for production-quality code",
      output: "technique_prototype_v1.rs"
    },
    {
      phase: "Testing & Validation",
      agent: "Research Agent",
      task: "Test technique in controlled environment",
      testCases: [
        "Windows 10/11 with default security settings",
        "Windows Server with hardened configuration",
        "Against various EDR/AV solutions",
        "Network detection systems (IDS/IPS)"
      ],
      validationCriteria: [
        "Technique executes successfully",
        "Evades detection (low false positive rate)",
        "Maintains stealth and OPSEC",
        "Achieves intended objective"
      ],
      output: "test_results.json"
    },
    {
      phase: "Refinement & Optimization",
      agent: "Maldev Agent",
      task: "Refine technique based on test results",
      improvements: [
        "Optimize for performance",
        "Enhance evasion capabilities",
        "Reduce artifacts and indicators",
        "Add error handling and resilience"
      ],
      output: "technique_final.rs"
    },
    {
      phase: "ATT&CK Mapping",
      agent: "Research Agent",
      task: "Map technique to MITRE ATT&CK framework",
      mapping: {
        tactic: "{{MITRE_TACTIC}}", // e.g., "Defense Evasion"
        techniqueId: "{{TECHNIQUE_ID}}", // e.g., "T1562.001"
        subTechnique: "{{SUB_TECHNIQUE}}",
        platforms: ["Windows", "Linux", "macOS"],
        permissions: "User/Admin",
        defenses: ["EDR", "AV", "HIDS"]
      },
      output: "attack_mapping.json"
    },
    {
      phase: "Documentation",
      agent: "Research Agent",
      task: "Create comprehensive technique documentation",
      sections: [
        "Technique Overview",
        "Technical Details",
        "Implementation Guide",
        "Usage Examples",
        "Detection & Mitigation",
        "Related Techniques",
        "References"
      ],
      output: "technique_documentation.md"
    },
    {
      phase: "Agent Integration",
      agent: "Research Agent",
      task: "Integrate technique into relevant R&D agents",
      integration: [
        "Add as capability to Maldev Agent",
        "Update agent system prompts with technique knowledge",
        "Create workflow templates using technique",
        "Add to agent tool library"
      ],
      output: "agent_capability_update"
    }
  ],
  deliverables: [
    "Production-ready technique implementation (Rust/C++)",
    "Comprehensive documentation",
    "MITRE ATT&CK mapping",
    "Test results and validation data",
    "Agent capability integration",
    "Knowledge base entry"
  ]
}
```

**Workflow Triggers:**
- Monthly R&D sprint planning
- Response to new defensive technologies
- Competitive intelligence (new tools/techniques in wild)
- Agent capability gap analysis

**Success Criteria:**
- ✅ Technique prototype successfully developed
- ✅ Validated in test environment
- ✅ Documented with usage examples
- ✅ Mapped to MITRE ATT&CK
- ✅ Integrated into agent capabilities

#### 4. **Knowledge Base Curation**
Workflow for collecting, organizing, and maintaining the R&D knowledge base to enhance agent intelligence and team collaboration.

```typescript
interface KnowledgeBaseCurationWorkflow {
  name: "Knowledge Base Management";
  description: "Systematic curation of offensive security knowledge for RAG-enhanced agents";
  steps: [
    {
      phase: "Content Collection",
      agent: "Research Agent",
      task: "Gather security research from multiple sources",
      sources: [
        "Published vulnerability reports",
        "Security research papers (arXiv, IEEE)",
        "Bug bounty write-ups (HackerOne, Bugcrowd)",
        "Conference presentations (DEF CON, Black Hat)",
        "GitHub security repositories",
        "MITRE ATT&CK updates",
        "CVE databases",
        "Internal R&D findings"
      ],
      automation: "RSS feeds, API integrations, web scraping",
      output: "raw_content_queue.json"
    },
    {
      phase: "Content Filtering",
      agent: "Research Agent",
      task: "Filter and prioritize collected content",
      criteria: [
        "Relevance to offensive security operations",
        "Technical depth and quality",
        "Novelty (not already in knowledge base)",
        "Actionability (can be used in engagements)",
        "Authority of source"
      ],
      actions: [
        "Remove duplicates",
        "Filter out low-quality content",
        "Prioritize by relevance score",
        "Tag with categories and keywords"
      ],
      output: "filtered_content.json"
    },
    {
      phase: "Content Processing",
      agent: "Research Agent",
      task: "Process content for knowledge base ingestion",
      processing: [
        "Extract key information (summary, techniques, tools)",
        "Normalize formatting (Markdown)",
        "Generate embeddings for semantic search",
        "Extract code snippets and examples",
        "Identify related MITRE ATT&CK techniques"
      ],
      tools: ["NLP models", "Embedding models", "Markdown parsers"],
      output: "processed_articles.json"
    },
    {
      phase: "Taxonomy & Tagging",
      agent: "Research Agent",
      task: "Organize content with structured taxonomy",
      taxonomy: {
        categories: [
          "Web Application Security",
          "Network Security",
          "Cloud Security",
          "Active Directory",
          "Malware Development",
          "Reverse Engineering",
          "Post-Exploitation",
          "Detection Evasion"
        ],
        tags: [
          "Tools", "Techniques", "Tactics",
          "Vulnerabilities", "Exploits", "POCs",
          "Defenses", "Detection", "Remediation"
        ],
        attackPhases: ["Reconnaissance", "Initial Access", "Execution", "Persistence", "..."],
        platforms: ["Windows", "Linux", "macOS", "Cloud", "Mobile"]
      },
      output: "tagged_articles.json"
    },
    {
      phase: "Knowledge Base Ingestion",
      agent: "Research Agent",
      task: "Add processed content to knowledge base",
      database: "PostgreSQL with pgvector extension",
      storage: {
        textContent: "knowledge_base.articles table",
        embeddings: "knowledge_base.embeddings table (vector)",
        metadata: "knowledge_base.metadata JSONB",
        relationships: "knowledge_base.relationships table"
      },
      indexing: [
        "Full-text search index on content",
        "Vector similarity index on embeddings",
        "B-tree indexes on tags and categories"
      ],
      output: "kb_entry_ids[]"
    },
    {
      phase: "RAG Integration",
      agent: "Research Agent",
      task: "Update agent RAG systems with new knowledge",
      ragConfig: {
        chunkSize: 1000,
        overlap: 200,
        embeddingModel: "text-embedding-ada-002",
        retrievalTopK: 5,
        semanticThreshold: 0.75
      },
      agentUpdates: [
        "Update Burp Suite Agent with web vulns knowledge",
        "Update Maldev Agent with evasion techniques",
        "Update Azure-AD Agent with EntraID research",
        "Update all agents with general TTPs"
      ],
      output: "agent_rag_update_status"
    },
    {
      phase: "Quality Assurance",
      agent: "Research Agent",
      task: "Validate knowledge base integrity and searchability",
      tests: [
        "Test search functionality with sample queries",
        "Verify embedding quality (semantic similarity)",
        "Check for broken links or references",
        "Validate metadata completeness",
        "Test RAG retrieval accuracy"
      ],
      output: "qa_report.json"
    },
    {
      phase: "Documentation & Reporting",
      agent: "Research Agent",
      task: "Generate knowledge base status report",
      metrics: [
        "Total articles: {{count}}",
        "New articles this period: {{new_count}}",
        "Top categories: {{top_categories}}",
        "Most searched topics: {{search_analytics}}",
        "Agent RAG query success rate: {{rag_success_rate}}"
      ],
      output: "kb_status_report.md"
    }
  ],
  deliverables: [
    "Curated knowledge base with searchable articles",
    "Vector embeddings for semantic search",
    "Structured taxonomy and tagging",
    "RAG-enhanced agent knowledge",
    "Knowledge base status reports"
  ]
}
```

**Automation Schedule:**
- **Daily**: Collect new content from RSS feeds and APIs
- **Weekly**: Filter and process collected content
- **Monthly**: Quality assurance and optimization
- **Quarterly**: Taxonomy review and updates

**Success Criteria:**
- ✅ Knowledge base contains 500+ high-quality articles
- ✅ Search functionality returns relevant results (>90% accuracy)
- ✅ RAG integration enhances agent responses
- ✅ Content freshness maintained (weekly updates)
- ✅ Structured taxonomy enables easy navigation

### Implementation Checklist
- [ ] Define R&D workflow templates
- [ ] Create workflow UI in OffSec Team page
- [ ] Integrate with existing workflow orchestrator
- [ ] Add research project tracking
- [ ] Implement knowledge base storage
- [ ] Add experiment logging

### Estimated Effort
4-5 days

---

## Database Schema

### New Tables for R&D Tracking

#### research_projects
```sql
CREATE TABLE research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'tool_testing', 'vulnerability_research', 'technique_development'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'archived'
  
  -- Team Assignment
  lead_agent_id UUID REFERENCES agents(id),
  assigned_agents JSONB DEFAULT '[]',
  
  -- Tracking
  objectives TEXT,
  findings JSONB DEFAULT '{}',
  artifacts JSONB DEFAULT '[]', -- Code, reports, POCs
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### rd_experiments
```sql
CREATE TABLE rd_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Experiment Details
  hypothesis TEXT,
  methodology TEXT,
  tools_used JSONB DEFAULT '[]',
  
  -- Results
  status VARCHAR(20) DEFAULT 'planned', -- 'planned', 'running', 'completed', 'failed'
  results JSONB,
  conclusions TEXT,
  
  -- Agent Execution
  executed_by_agent_id UUID REFERENCES agents(id),
  execution_log TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### Migration File
**File:** `migrations/0011_add_offsec_rd_team.sql`

Complete SQL migration file for creating all OffSec Team R&D tables, indexes, and constraints.

```sql
-- Migration: 0011_add_offsec_rd_team.sql
-- Description: Add OffSec Team R&D infrastructure (research projects, experiments, knowledge base)
-- Author: RTPI Development Team
-- Date: 2025-12-19

-- ============================================================================
-- FORWARD MIGRATION
-- ============================================================================

BEGIN;

-- Create research_projects table
CREATE TABLE IF NOT EXISTS research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('tool_testing', 'vulnerability_research', 'technique_development', 'knowledge_curation')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived', 'cancelled')),

  -- Team Assignment
  lead_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  assigned_agents JSONB DEFAULT '[]', -- Array of agent IDs

  -- Project Details
  objectives TEXT,
  success_criteria TEXT,
  findings JSONB DEFAULT '{}',
  artifacts JSONB DEFAULT '[]', -- [{type: 'code|report|poc', name: '', path: '', createdAt: ''}]

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed')
  )
);

-- Create rd_experiments table
CREATE TABLE IF NOT EXISTS rd_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Experiment Details
  hypothesis TEXT,
  methodology TEXT,
  tools_used JSONB DEFAULT '[]', -- Array of tool names/IDs
  targets JSONB DEFAULT '[]', -- Test targets (URLs, IPs, etc.)

  -- Results
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'failed', 'cancelled')),
  results JSONB DEFAULT '{}',
  conclusions TEXT,
  success BOOLEAN,

  -- Execution Details
  executed_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES agent_workflows(id) ON DELETE SET NULL,
  execution_log TEXT,
  error_message TEXT,

  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER
      ELSE NULL
    END
  ) STORED,

  -- Constraints
  CONSTRAINT valid_timing CHECK (
    (started_at IS NULL OR started_at >= created_at) AND
    (completed_at IS NULL OR completed_at >= started_at)
  )
);

-- Create knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,

  -- Classification
  category VARCHAR(100) NOT NULL, -- 'Web Security', 'Network Security', 'Malware Dev', etc.
  tags TEXT[] DEFAULT '{}', -- Array of tags: ['OWASP', 'XSS', 'Burp Suite']

  -- Source & Attribution
  source_url TEXT,
  author TEXT,
  published_date DATE,

  -- Content Type
  content_type VARCHAR(50) DEFAULT 'article' CHECK (content_type IN ('article', 'tutorial', 'paper', 'poc', 'tool_doc', 'technique')),

  -- MITRE ATT&CK Mapping
  attack_tactics TEXT[] DEFAULT '{}', -- ['Initial Access', 'Execution']
  attack_techniques TEXT[] DEFAULT '{}', -- ['T1566', 'T1059']

  -- RAG/Embedding Support
  embedding VECTOR(1536), -- OpenAI text-embedding-ada-002 dimension
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002',

  -- Metrics
  view_count INTEGER DEFAULT 0,
  usefulness_score DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 5.0

  -- Relationships
  related_project_id UUID REFERENCES research_projects(id) ON DELETE SET NULL,
  related_articles UUID[] DEFAULT '{}', -- Array of related knowledge_base IDs

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'C')
  ) STORED
);

-- Create tool_library table (extends security_tools with R&D metadata)
CREATE TABLE IF NOT EXISTS tool_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,

  -- R&D Specific Metadata
  research_value VARCHAR(20) DEFAULT 'medium' CHECK (research_value IN ('low', 'medium', 'high', 'critical')),
  testing_status VARCHAR(20) DEFAULT 'untested' CHECK (testing_status IN ('untested', 'testing', 'validated', 'deprecated')),

  -- Integration
  compatible_agents JSONB DEFAULT '[]', -- Agent IDs that can use this tool
  required_capabilities TEXT[] DEFAULT '{}',

  -- Testing & Validation
  last_tested_at TIMESTAMP,
  test_results JSONB DEFAULT '{}',
  known_issues TEXT[],

  -- Usage Metrics
  execution_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.0, -- 0.00 to 100.00
  avg_execution_time_seconds INTEGER,

  -- Documentation
  usage_examples JSONB DEFAULT '[]', -- [{title: '', description: '', command: ''}]
  research_notes TEXT,

  -- Metadata
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Research Projects Indexes
CREATE INDEX idx_research_projects_status ON research_projects(status);
CREATE INDEX idx_research_projects_type ON research_projects(type);
CREATE INDEX idx_research_projects_lead_agent ON research_projects(lead_agent_id);
CREATE INDEX idx_research_projects_created_by ON research_projects(created_by);
CREATE INDEX idx_research_projects_created_at ON research_projects(created_at DESC);

-- R&D Experiments Indexes
CREATE INDEX idx_rd_experiments_project ON rd_experiments(project_id);
CREATE INDEX idx_rd_experiments_status ON rd_experiments(status);
CREATE INDEX idx_rd_experiments_agent ON rd_experiments(executed_by_agent_id);
CREATE INDEX idx_rd_experiments_workflow ON rd_experiments(workflow_id);
CREATE INDEX idx_rd_experiments_created_at ON rd_experiments(created_at DESC);

-- Knowledge Base Indexes
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_base_tags ON knowledge_base USING GIN(tags);
CREATE INDEX idx_knowledge_base_attack_tactics ON knowledge_base USING GIN(attack_tactics);
CREATE INDEX idx_knowledge_base_attack_techniques ON knowledge_base USING GIN(attack_techniques);
CREATE INDEX idx_knowledge_base_content_type ON knowledge_base(content_type);
CREATE INDEX idx_knowledge_base_created_at ON knowledge_base(created_at DESC);
CREATE INDEX idx_knowledge_base_search ON knowledge_base USING GIN(search_vector);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
-- Note: ivfflat index requires pgvector extension

-- Tool Library Indexes
CREATE INDEX idx_tool_library_security_tool ON tool_library(security_tool_id);
CREATE INDEX idx_tool_library_research_value ON tool_library(research_value);
CREATE INDEX idx_tool_library_testing_status ON tool_library(testing_status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on research_projects
CREATE OR REPLACE FUNCTION update_research_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER research_projects_updated_at
  BEFORE UPDATE ON research_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_research_projects_updated_at();

-- Update updated_at timestamp on knowledge_base
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_updated_at();

-- Update updated_at timestamp on tool_library
CREATE OR REPLACE FUNCTION update_tool_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tool_library_updated_at
  BEFORE UPDATE ON tool_library
  FOR EACH ROW
  EXECUTE FUNCTION update_tool_library_updated_at();

-- ============================================================================
-- SEED DATA (Optional - R&D Agents)
-- ============================================================================

-- Insert R&D specialized agents (optional, can also be done via application)
INSERT INTO agents (name, type, status, config) VALUES
(
  'Burp Suite Orchestrator',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "gpt-4",
    "systemPrompt": "You are a Burp Suite orchestration specialist. You automate web application security testing using Burp Suite Professional API.",
    "capabilities": ["web_scanning", "vulnerability_detection", "burp_api"],
    "toolSettings": {
      "burpApiUrl": "",
      "burpApiKey": ""
    }
  }'::JSONB
),
(
  'Empire C2 Manager',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "gpt-4",
    "systemPrompt": "You are an Empire C2 framework specialist. You manage command & control operations for red team engagements.",
    "capabilities": ["c2_management", "payload_generation", "post_exploitation"],
    "toolSettings": {
      "empireUrl": "",
      "empireToken": ""
    }
  }'::JSONB
),
(
  'Advanced Fuzzing Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "gpt-4",
    "systemPrompt": "You are a fuzzing and input validation specialist. You discover vulnerabilities through intelligent fuzzing techniques.",
    "capabilities": ["ffuf", "wordlist_management", "parameter_discovery"],
    "toolSettings": {}
  }'::JSONB
),
(
  'Framework Security Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "gpt-4",
    "systemPrompt": "You are a framework security analyst. You identify and exploit framework-specific vulnerabilities.",
    "capabilities": ["tech_stack_detection", "framework_analysis", "vulnerability_mapping"],
    "toolSettings": {}
  }'::JSONB
),
(
  'Maldev Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "gpt-4",
    "systemPrompt": "You are a malware development and reverse engineering specialist. You develop offensive tools and techniques, prioritizing Rust and C++.",
    "capabilities": ["reverse_engineering", "rop_development", "rust_development", "evasion_techniques"],
    "repositories": 44,
    "primaryLanguage": "rust",
    "toolSettings": {}
  }'::JSONB
),
(
  'Azure-AD Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "gpt-4",
    "systemPrompt": "You are an Azure & Active Directory attack specialist. You perform EntraID abuse, AD enumeration, and lateral movement.",
    "capabilities": ["entra_id_abuse", "ad_enumeration", "lateral_movement", "persistence"],
    "repositories": 28,
    "primaryLanguages": ["rust", "cpp"],
    "toolSettings": {}
  }'::JSONB
),
(
  'Research Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "gpt-4",
    "systemPrompt": "You are a security research specialist. You conduct tool testing, POC development, and knowledge base curation.",
    "capabilities": ["tool_testing", "poc_creation", "knowledge_curation", "documentation"],
    "toolSettings": {}
  }'::JSONB
)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- ROLLBACK MIGRATION
-- ============================================================================

-- To rollback this migration, run:
/*
BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS research_projects_updated_at ON research_projects;
DROP TRIGGER IF EXISTS knowledge_base_updated_at ON knowledge_base;
DROP TRIGGER IF EXISTS tool_library_updated_at ON tool_library;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_research_projects_updated_at();
DROP FUNCTION IF EXISTS update_knowledge_base_updated_at();
DROP FUNCTION IF EXISTS update_tool_library_updated_at();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS tool_library CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS rd_experiments CASCADE;
DROP TABLE IF EXISTS research_projects CASCADE;

-- Optionally remove R&D agents (if seeded)
DELETE FROM agents WHERE config->>'category' = 'R&D';

COMMIT;
*/
```

**Migration Notes:**
- Requires PostgreSQL 12+ for GENERATED columns
- Requires pgvector extension for embedding support: `CREATE EXTENSION IF NOT EXISTS vector;`
- ivfflat index creation may take time on large datasets; consider creating async
- R&D agent seeding is optional and can be skipped if agents are created via UI
- Ensure agents table exists before running (should exist from core RTPI schema)

**Dependencies:**
- Existing tables: `agents`, `users`, `agent_workflows`, `security_tools`
- PostgreSQL extensions: `pgvector` (for vector similarity search)
- Database features: JSONB, array types, generated columns, GIN indexes

**Post-Migration Steps:**
1. Verify migration success: `SELECT COUNT(*) FROM research_projects;`
2. Check R&D agents created: `SELECT name FROM agents WHERE config->>'category' = 'R&D';`
3. Test knowledge base full-text search: `SELECT * FROM knowledge_base WHERE search_vector @@ to_tsquery('sql injection');`
4. Configure pgvector if using embeddings for RAG

---

## API Endpoints

### OffSec Team R&D API

#### GET /api/v1/offsec-rd/agents
```typescript
// List R&D team agents
// Returns: Burp Agent, Empire Agent, Fuzzing Agent, etc.
```

#### GET /api/v1/offsec-rd/projects
```typescript
// List research projects
// Filter by status, type, agent
```

#### POST /api/v1/offsec-rd/projects
```typescript
// Create new research project
{
  "name": "Fuzzing Framework X",
  "type": "tool_testing",
  "leadAgentId": "agent_burp_001",
  "objectives": "Test FFUF against various web frameworks"
}
```

#### POST /api/v1/offsec-rd/experiments
```typescript
// Create new experiment
{
  "projectId": "project_001",
  "name": "SQLi Bypass Technique",
  "hypothesis": "WAF can be bypassed with encoding",
  "toolsUsed": ["sqlmap", "burp-intruder"]
}
```

---

### Complete API Endpoint Specifications

#### Research Projects API

##### GET /api/v1/offsec-rd/projects
**Description:** List all research projects with optional filtering and pagination

**Query Parameters:**
```typescript
interface ProjectsQueryParams {
  status?: 'draft' | 'active' | 'completed' | 'archived' | 'cancelled';
  type?: 'tool_testing' | 'vulnerability_research' | 'technique_development' | 'knowledge_curation';
  leadAgentId?: string;
  page?: number;        // Default: 1
  limit?: number;       // Default: 20, Max: 100
  sortBy?: 'created_at' | 'updated_at' | 'name';
  sortOrder?: 'asc' | 'desc';
}
```

**Response (200 OK):**
```typescript
interface ProjectsResponse {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    type: 'tool_testing' | 'vulnerability_research' | 'technique_development' | 'knowledge_curation';
    status: 'draft' | 'active' | 'completed' | 'archived' | 'cancelled';
    leadAgent: {
      id: string;
      name: string;
      type: string;
    } | null;
    assignedAgents: Array<{
      id: string;
      name: string;
    }>;
    objectives: string | null;
    successCriteria: string | null;
    findings: Record<string, any>;
    artifacts: Array<{
      type: 'code' | 'report' | 'poc' | 'documentation';
      name: string;
      path: string;
      createdAt: string;
    }>;
    createdBy: {
      id: string;
      username: string;
    } | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    experimentCount: number;
    completedExperiments: number;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication
- `500 Internal Server Error`: Database or server error

---

##### GET /api/v1/offsec-rd/projects/:id
**Description:** Get detailed information about a specific research project

**Path Parameters:**
- `id` (string, required): Project UUID

**Response (200 OK):**
```typescript
interface ProjectDetailResponse {
  id: string;
  name: string;
  description: string | null;
  type: 'tool_testing' | 'vulnerability_research' | 'technique_development' | 'knowledge_curation';
  status: 'draft' | 'active' | 'completed' | 'archived' | 'cancelled';
  leadAgent: {
    id: string;
    name: string;
    type: string;
    status: string;
    config: Record<string, any>;
  } | null;
  assignedAgents: Array<{
    id: string;
    name: string;
    type: string;
    capabilities: string[];
  }>;
  objectives: string | null;
  successCriteria: string | null;
  findings: Record<string, any>;
  artifacts: Array<{
    type: 'code' | 'report' | 'poc' | 'documentation';
    name: string;
    path: string;
    size: number;
    createdAt: string;
  }>;
  experiments: Array<{
    id: string;
    name: string;
    status: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
    success: boolean | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  createdBy: {
    id: string;
    username: string;
    fullName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Project does not exist
- `500 Internal Server Error`: Database or server error

---

##### POST /api/v1/offsec-rd/projects
**Description:** Create a new research project

**Request Body:**
```typescript
interface CreateProjectRequest {
  name: string;                    // Required, 1-255 characters
  description?: string;
  type: 'tool_testing' | 'vulnerability_research' | 'technique_development' | 'knowledge_curation';
  status?: 'draft' | 'active';     // Default: 'draft'
  leadAgentId?: string;            // UUID of agent
  assignedAgents?: string[];       // Array of agent UUIDs
  objectives?: string;
  successCriteria?: string;
}
```

**Response (201 Created):**
```typescript
interface CreateProjectResponse {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  leadAgentId: string | null;
  assignedAgents: string[];
  objectives: string | null;
  successCriteria: string | null;
  findings: {};
  artifacts: [];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

**Validation Rules:**
- `name`: Required, 1-255 characters
- `type`: Must be one of the enum values
- `leadAgentId`: Must reference existing agent if provided
- `assignedAgents`: All UUIDs must reference existing agents

**Error Responses:**
- `400 Bad Request`: Validation errors (missing required fields, invalid enum values)
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Referenced agent does not exist
- `500 Internal Server Error`: Database or server error

---

##### PUT /api/v1/offsec-rd/projects/:id
**Description:** Update an existing research project

**Path Parameters:**
- `id` (string, required): Project UUID

**Request Body:**
```typescript
interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  type?: 'tool_testing' | 'vulnerability_research' | 'technique_development' | 'knowledge_curation';
  status?: 'draft' | 'active' | 'completed' | 'archived' | 'cancelled';
  leadAgentId?: string | null;
  assignedAgents?: string[];
  objectives?: string | null;
  successCriteria?: string | null;
  findings?: Record<string, any>;
  artifacts?: Array<{
    type: 'code' | 'report' | 'poc' | 'documentation';
    name: string;
    path: string;
  }>;
}
```

**Response (200 OK):**
```typescript
interface UpdateProjectResponse {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  leadAgentId: string | null;
  assignedAgents: string[];
  objectives: string | null;
  successCriteria: string | null;
  findings: Record<string, any>;
  artifacts: Array<any>;
  updatedAt: string;
  completedAt: string | null;  // Auto-set if status changed to 'completed'
}
```

**Business Rules:**
- Setting `status` to 'completed' automatically sets `completedAt` to current timestamp
- Cannot change `status` back to 'draft' or 'active' once 'completed'
- `artifacts` array is merged (not replaced) with existing artifacts

**Error Responses:**
- `400 Bad Request`: Validation errors, invalid status transition
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have permission to update project
- `404 Not Found`: Project does not exist
- `500 Internal Server Error`: Database or server error

---

##### DELETE /api/v1/offsec-rd/projects/:id
**Description:** Delete a research project (and all associated experiments via CASCADE)

**Path Parameters:**
- `id` (string, required): Project UUID

**Response (204 No Content):** Empty body

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have permission to delete project
- `404 Not Found`: Project does not exist
- `409 Conflict`: Cannot delete project with active experiments
- `500 Internal Server Error`: Database or server error

---

#### Experiments API

##### GET /api/v1/offsec-rd/experiments
**Description:** List all experiments with optional filtering

**Query Parameters:**
```typescript
interface ExperimentsQueryParams {
  projectId?: string;
  status?: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
  executedByAgentId?: string;
  success?: boolean;
  page?: number;        // Default: 1
  limit?: number;       // Default: 20, Max: 100
  sortBy?: 'created_at' | 'started_at' | 'completed_at';
  sortOrder?: 'asc' | 'desc';
}
```

**Response (200 OK):**
```typescript
interface ExperimentsResponse {
  experiments: Array<{
    id: string;
    projectId: string;
    projectName: string;
    name: string;
    description: string | null;
    hypothesis: string | null;
    status: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
    success: boolean | null;
    toolsUsed: string[];
    executedByAgent: {
      id: string;
      name: string;
    } | null;
    workflowId: string | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    durationSeconds: number | null;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

##### GET /api/v1/offsec-rd/experiments/:id
**Description:** Get detailed information about a specific experiment

**Response (200 OK):**
```typescript
interface ExperimentDetailResponse {
  id: string;
  project: {
    id: string;
    name: string;
    type: string;
  };
  name: string;
  description: string | null;
  hypothesis: string | null;
  methodology: string | null;
  toolsUsed: Array<{
    id?: string;
    name: string;
    version?: string;
  }>;
  targets: Array<{
    type: 'url' | 'ip' | 'domain' | 'network';
    value: string;
  }>;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
  results: Record<string, any>;
  conclusions: string | null;
  success: boolean | null;
  executedByAgent: {
    id: string;
    name: string;
    type: string;
  } | null;
  workflow: {
    id: string;
    name: string;
    status: string;
  } | null;
  executionLog: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}
```

---

##### POST /api/v1/offsec-rd/experiments
**Description:** Create a new experiment

**Request Body:**
```typescript
interface CreateExperimentRequest {
  projectId: string;              // Required, UUID
  name: string;                   // Required, 1-255 characters
  description?: string;
  hypothesis?: string;
  methodology?: string;
  toolsUsed?: Array<{
    id?: string;
    name: string;
    version?: string;
  }>;
  targets?: Array<{
    type: 'url' | 'ip' | 'domain' | 'network';
    value: string;
  }>;
  status?: 'planned';             // Default: 'planned'
  executedByAgentId?: string;     // UUID of agent
}
```

**Response (201 Created):**
```typescript
interface CreateExperimentResponse {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  hypothesis: string | null;
  methodology: string | null;
  toolsUsed: Array<any>;
  targets: Array<any>;
  status: 'planned';
  results: {};
  executedByAgentId: string | null;
  createdAt: string;
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors (missing required fields)
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Referenced project does not exist
- `500 Internal Server Error`: Database or server error

---

##### PUT /api/v1/offsec-rd/experiments/:id
**Description:** Update experiment (typically to record results or change status)

**Request Body:**
```typescript
interface UpdateExperimentRequest {
  name?: string;
  description?: string | null;
  hypothesis?: string | null;
  methodology?: string | null;
  toolsUsed?: Array<any>;
  targets?: Array<any>;
  status?: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
  results?: Record<string, any>;
  conclusions?: string | null;
  success?: boolean | null;
  executionLog?: string | null;
  errorMessage?: string | null;
}
```

**Response (200 OK):**
```typescript
interface UpdateExperimentResponse {
  id: string;
  name: string;
  status: string;
  results: Record<string, any>;
  conclusions: string | null;
  success: boolean | null;
  startedAt: string | null;       // Auto-set when status changes to 'running'
  completedAt: string | null;     // Auto-set when status changes to 'completed' or 'failed'
  durationSeconds: number | null; // Auto-calculated
  updatedAt: string;
}
```

**Business Rules:**
- Setting `status` to 'running' auto-sets `startedAt` if null
- Setting `status` to 'completed' or 'failed' auto-sets `completedAt` if null
- `durationSeconds` is auto-calculated from `startedAt` and `completedAt`

---

##### POST /api/v1/offsec-rd/experiments/:id/execute
**Description:** Execute an experiment using the Agent Workflow Orchestrator

**Path Parameters:**
- `id` (string, required): Experiment UUID

**Request Body:**
```typescript
interface ExecuteExperimentRequest {
  agentId?: string;               // Optional: Override executedByAgentId
  workflowConfig?: {
    timeout?: number;             // Seconds, default: 3600
    retryOnFailure?: boolean;     // Default: false
    notifyOnCompletion?: boolean; // Default: true
  };
}
```

**Response (202 Accepted):**
```typescript
interface ExecuteExperimentResponse {
  experimentId: string;
  workflowId: string;
  status: 'running';
  startedAt: string;
  estimatedDuration: number | null;
  message: 'Experiment execution started';
}
```

**Error Responses:**
- `400 Bad Request`: Experiment already running or completed
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Experiment does not exist
- `409 Conflict`: Experiment status does not allow execution (must be 'planned')
- `500 Internal Server Error`: Failed to start workflow

---

##### DELETE /api/v1/offsec-rd/experiments/:id
**Description:** Delete an experiment

**Response (204 No Content):** Empty body

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have permission to delete experiment
- `404 Not Found`: Experiment does not exist
- `409 Conflict`: Cannot delete running experiment
- `500 Internal Server Error`: Database or server error

---

#### Tool Library API

##### GET /api/v1/offsec-rd/tools
**Description:** List tools in the R&D tool library with metadata

**Query Parameters:**
```typescript
interface ToolLibraryQueryParams {
  researchValue?: 'low' | 'medium' | 'high';
  testingStatus?: 'untested' | 'testing' | 'validated' | 'deprecated';
  category?: string;              // From security_tools.category
  compatibleAgentId?: string;     // Filter tools compatible with specific agent
  page?: number;
  limit?: number;
}
```

**Response (200 OK):**
```typescript
interface ToolLibraryResponse {
  tools: Array<{
    id: string;
    tool: {
      id: string;
      name: string;
      category: string;
      version: string;
      dockerImage: string | null;
    };
    researchValue: 'low' | 'medium' | 'high';
    testingStatus: 'untested' | 'testing' | 'validated' | 'deprecated';
    compatibleAgents: Array<{
      id: string;
      name: string;
    }>;
    executionCount: number;
    successRate: number;
    lastUsed: string | null;
    notes: string | null;
    relatedProjects: Array<{
      id: string;
      name: string;
    }>;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

##### POST /api/v1/offsec-rd/tools
**Description:** Add a tool to the R&D library (links existing security_tools entry)

**Request Body:**
```typescript
interface AddToolToLibraryRequest {
  securityToolId: string;         // Required, references security_tools.id
  researchValue?: 'low' | 'medium' | 'high';
  testingStatus?: 'untested' | 'testing' | 'validated';
  compatibleAgents?: Array<{
    agentId: string;
    configOverrides?: Record<string, any>;
  }>;
  notes?: string;
}
```

**Response (201 Created):**
```typescript
interface AddToolToLibraryResponse {
  id: string;
  securityToolId: string;
  researchValue: string;
  testingStatus: string;
  compatibleAgents: Array<any>;
  executionCount: 0;
  successRate: 0.0;
  createdAt: string;
}
```

---

##### PUT /api/v1/offsec-rd/tools/:id
**Description:** Update tool library metadata

**Request Body:**
```typescript
interface UpdateToolLibraryRequest {
  researchValue?: 'low' | 'medium' | 'high';
  testingStatus?: 'untested' | 'testing' | 'validated' | 'deprecated';
  compatibleAgents?: Array<{
    agentId: string;
    configOverrides?: Record<string, any>;
  }>;
  notes?: string | null;
  relatedProjects?: string[];     // Array of project UUIDs
}
```

**Response (200 OK):** Updated tool library entry

---

##### POST /api/v1/offsec-rd/tools/:id/test
**Description:** Execute a test run of a tool (creates test experiment)

**Request Body:**
```typescript
interface TestToolRequest {
  agentId: string;                // Agent to execute the test
  testTarget: {
    type: 'url' | 'ip' | 'domain';
    value: string;
  };
  testConfig?: Record<string, any>;
}
```

**Response (202 Accepted):**
```typescript
interface TestToolResponse {
  experimentId: string;
  workflowId: string;
  status: 'running';
  message: 'Tool test execution started';
}
```

---

#### Knowledge Base API

##### GET /api/v1/offsec-rd/knowledge
**Description:** Search and retrieve knowledge base articles

**Query Parameters:**
```typescript
interface KnowledgeQueryParams {
  q?: string;                     // Full-text search query
  category?: string;              // Filter by category
  tags?: string[];                // Filter by tags (comma-separated)
  attackTactics?: string[];       // MITRE ATT&CK tactics
  attackTechniques?: string[];    // MITRE ATT&CK techniques
  source?: 'internal' | 'external' | 'research' | 'documentation';
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'created_at' | 'updated_at';
}
```

**Response (200 OK):**
```typescript
interface KnowledgeResponse {
  articles: Array<{
    id: string;
    title: string;
    summary: string | null;
    category: string;
    tags: string[];
    attackTactics: string[];
    attackTechniques: string[];
    source: 'internal' | 'external' | 'research' | 'documentation';
    sourceUrl: string | null;
    author: string | null;
    publishedDate: string | null;
    relevanceScore?: number;      // Only present for search queries
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

**Search Behavior:**
- If `q` parameter provided: Uses PostgreSQL full-text search (`search_vector` column)
- Results sorted by relevance (ts_rank) when searching
- Can combine full-text search with filters (category, tags, etc.)

---

##### GET /api/v1/offsec-rd/knowledge/:id
**Description:** Get full content of a knowledge base article

**Response (200 OK):**
```typescript
interface KnowledgeArticleResponse {
  id: string;
  title: string;
  content: string;                // Full markdown content
  summary: string | null;
  category: string;
  tags: string[];
  attackTactics: string[];
  attackTechniques: string[];
  source: 'internal' | 'external' | 'research' | 'documentation';
  sourceUrl: string | null;
  author: string | null;
  publishedDate: string | null;
  embedding: number[] | null;     // Optional: for RAG debugging
  embeddingModel: string | null;
  relatedArticles: Array<{        // Vector similarity search results
    id: string;
    title: string;
    similarity: number;
  }>;
  createdBy: {
    id: string;
    username: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}
```

---

##### POST /api/v1/offsec-rd/knowledge
**Description:** Create a new knowledge base article

**Request Body:**
```typescript
interface CreateKnowledgeRequest {
  title: string;                  // Required, 1-500 characters
  content: string;                // Required, markdown format
  summary?: string;               // Auto-generated if not provided
  category: string;               // Required
  tags?: string[];
  attackTactics?: string[];       // MITRE ATT&CK tactic IDs
  attackTechniques?: string[];    // MITRE ATT&CK technique IDs
  source?: 'internal' | 'external' | 'research' | 'documentation';
  sourceUrl?: string;
  author?: string;
  publishedDate?: string;
  generateEmbedding?: boolean;    // Default: true (for RAG)
}
```

**Response (201 Created):**
```typescript
interface CreateKnowledgeResponse {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string;
  tags: string[];
  attackTactics: string[];
  attackTechniques: string[];
  source: string;
  embeddingModel: string | null;  // e.g., "text-embedding-ada-002"
  createdBy: string;
  createdAt: string;
}
```

**Background Processing:**
- If `generateEmbedding: true`, article content is sent to OpenAI embedding API
- Embedding stored in `embedding` column (VECTOR(1536))
- ivfflat index enables fast similarity search for RAG retrieval

---

##### PUT /api/v1/offsec-rd/knowledge/:id
**Description:** Update a knowledge base article

**Request Body:**
```typescript
interface UpdateKnowledgeRequest {
  title?: string;
  content?: string;
  summary?: string | null;
  category?: string;
  tags?: string[];
  attackTactics?: string[];
  attackTechniques?: string[];
  source?: 'internal' | 'external' | 'research' | 'documentation';
  sourceUrl?: string | null;
  author?: string | null;
  publishedDate?: string | null;
  regenerateEmbedding?: boolean;  // Re-create embedding if content changed
}
```

**Response (200 OK):** Updated article

**Business Rules:**
- If `content` is updated and `regenerateEmbedding: true`, embedding is regenerated
- `search_vector` (full-text search) is auto-updated via database trigger

---

##### POST /api/v1/offsec-rd/knowledge/search-similar
**Description:** Find similar articles using vector similarity search (RAG)

**Request Body:**
```typescript
interface SimilaritySearchRequest {
  query?: string;                 // Natural language query (will be embedded)
  articleId?: string;             // Find articles similar to this one
  limit?: number;                 // Default: 5, Max: 20
  threshold?: number;             // Cosine similarity threshold (0.0-1.0), default: 0.7
}
```

**Note:** Must provide either `query` OR `articleId`, not both.

**Response (200 OK):**
```typescript
interface SimilaritySearchResponse {
  query: string | null;
  results: Array<{
    id: string;
    title: string;
    summary: string | null;
    category: string;
    tags: string[];
    similarity: number;           // Cosine similarity score (0.0-1.0)
    content: string;              // First 500 characters
  }>;
}
```

**Implementation:**
- If `query` provided: Generate embedding via OpenAI API, then search
- If `articleId` provided: Use existing article embedding for search
- Uses PostgreSQL pgvector `<=>` operator for cosine similarity
- Results sorted by similarity score (descending)

---

##### DELETE /api/v1/offsec-rd/knowledge/:id
**Description:** Delete a knowledge base article

**Response (204 No Content):** Empty body

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have permission to delete article
- `404 Not Found`: Article does not exist
- `500 Internal Server Error`: Database or server error

---

#### R&D Agents API

##### GET /api/v1/offsec-rd/agents
**Description:** List R&D team agents (filters agents table for R&D category)

**Query Parameters:**
```typescript
interface RDAgentsQueryParams {
  status?: 'idle' | 'busy' | 'offline' | 'error';
  capabilities?: string[];        // Filter by agent capabilities
}
```

**Response (200 OK):**
```typescript
interface RDAgentsResponse {
  agents: Array<{
    id: string;
    name: string;
    type: string;
    status: 'idle' | 'busy' | 'offline' | 'error';
    category: 'R&D';
    capabilities: string[];
    repositories: number;
    primaryLanguage: string | null;
    systemPrompt: string;
    lastActivity: string | null;
    executionCount: number;
    successRate: number;
  }>;
}
```

**Implementation:**
```sql
SELECT * FROM agents WHERE config->>'category' = 'R&D'
```

---

##### GET /api/v1/offsec-rd/agents/:id/stats
**Description:** Get performance statistics for an R&D agent

**Response (200 OK):**
```typescript
interface AgentStatsResponse {
  agentId: string;
  agentName: string;
  executionStats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    avgDurationSeconds: number;
  };
  projectStats: {
    activeProjects: number;
    completedProjects: number;
    leadingProjects: number;
  };
  experimentStats: {
    totalExperiments: number;
    completedExperiments: number;
    successfulExperiments: number;
  };
  toolUsage: Array<{
    toolName: string;
    usageCount: number;
  }>;
  recentActivity: Array<{
    type: 'project' | 'experiment' | 'workflow';
    id: string;
    name: string;
    timestamp: string;
    status: string;
  }>;
}
```

---

### Authentication & Authorization

All OffSec Team R&D API endpoints require authentication via:
- Session-based authentication (Redis session cookie)
- OR API key authentication (X-API-Key header)

**Required Permissions:**
- **Read operations** (GET): Any authenticated user
- **Create operations** (POST): Role `user` or higher
- **Update operations** (PUT): Role `user` or higher (can only update own resources unless `admin`)
- **Delete operations** (DELETE): Role `admin` or resource creator
- **Execute operations** (POST .../execute): Role `user` or higher

**Rate Limiting:**
- Standard endpoints: 100 requests/minute per user
- Search endpoints: 30 requests/minute per user
- Execute endpoints: 10 requests/minute per user

---

### Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorResponse {
  error: {
    code: string;               // Machine-readable error code
    message: string;            // Human-readable error message
    details?: any;              // Optional additional context
    field?: string;             // For validation errors
  };
  status: number;               // HTTP status code
  timestamp: string;            // ISO 8601 timestamp
  path: string;                 // Request path
}
```

**Common Error Codes:**
- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Resource does not exist
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `CONFLICT`: Resource state conflict (e.g., already running)
- `INTERNAL_ERROR`: Server error

**Example Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid project type",
    "details": "type must be one of: tool_testing, vulnerability_research, technique_development, knowledge_curation",
    "field": "type"
  },
  "status": 400,
  "timestamp": "2025-12-19T10:30:00.000Z",
  "path": "/api/v1/offsec-rd/projects"
}
```

---

### Integration with Existing RTPI APIs

The OffSec Team R&D API integrates with existing RTPI endpoints:

**Agents API (`/api/v1/agents`):**
- R&D agents are stored in the same `agents` table
- Filtered by `config.category = 'R&D'`
- Can be managed via both `/api/v1/agents` and `/api/v1/offsec-rd/agents`

**Workflows API (`/api/v1/agent-workflows`):**
- R&D experiments can trigger agent workflows
- `rd_experiments.workflow_id` references `agent_workflows.id`
- Workflow results populate experiment `results` field

**Security Tools API (`/api/v1/security-tools`):**
- Tool library entries reference `security_tools.id`
- Tools can be added to R&D library for testing and validation
- Usage statistics tracked in `tool_library` table

**Docker Executor (`/api/v1/containers`):**
- R&D tools can be executed via Docker containers
- Experiment execution creates container instances
- Execution logs captured in `rd_experiments.execution_log`

---

## OffSec Team Page Structure

### Tab 1: R&D Agents
**Purpose:** Manage specialized offensive security agents

```
┌─────────────────────────────────────────────────────────────────┐
│ R&D Agents                                                       │
├─────────────────────────────────────────────────────────────────┤
│ [+ Add R&D Agent]  [Import from offsec-team]                    │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🔍 Burp Suite Orchestrator                                │   │
│ │    Type: Custom | Status: 🟢 Idle                         │   │
│ │    Capabilities: Web scanning, API testing, reporting     │   │
│ │    Last Activity: Never                                   │   │
│ │    [Configure] [Test] [View Logs]                         │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ ⚡ Empire C2 Manager                                       │   │
│ │    Type: Custom | Status: 🟢 Idle                         │   │
│ │    Capabilities: C2 operations, payload generation        │   │
│ │    Last Activity: 2 days ago                              │   │
│ │    [Configure] [Test] [View Logs]                         │   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 2: Tool Lab
**Purpose:** Test and validate new security tools

#### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Tool Lab                                     [+ Add Tool]  [⚙️]  │
├─────────────────────────────────────────────────────────────────┤
│ Filters: [All] [Untested] [Testing] [Validated] [Deprecated]   │
│ Search: [____________________]  Category: [All Categories ▼]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🛠️  FFUF - Fast Web Fuzzer                    [Validated] │   │
│ │                                                            │   │
│ │ Category: Fuzzer | Version: 2.1.0                         │   │
│ │ Research Value: ⭐⭐⭐ High                                 │   │
│ │ Success Rate: 94.2% (53/56 executions)                    │   │
│ │                                                            │   │
│ │ Compatible Agents:                                         │   │
│ │   • Fuzzing Agent (primary)                               │   │
│ │   • Burp Suite Orchestrator (integration)                 │   │
│ │                                                            │   │
│ │ Related Projects:                                          │   │
│ │   • Advanced Fuzzing Techniques (5 experiments)           │   │
│ │                                                            │   │
│ │ [▶️ Quick Test] [🔧 Configure] [📊 View Stats] [📝 Notes] │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🛠️  Covenant C2 Framework                      [Testing]  │   │
│ │                                                            │   │
│ │ Category: C2 | Version: 0.7                               │   │
│ │ Research Value: ⭐⭐ Medium                                │   │
│ │ Success Rate: 71.4% (5/7 executions)                      │   │
│ │                                                            │   │
│ │ Compatible Agents:                                         │   │
│ │   • Empire C2 Manager (testing)                           │   │
│ │                                                            │   │
│ │ Related Projects:                                          │   │
│ │   • C2 Framework Comparison (2 experiments)               │   │
│ │                                                            │   │
│ │ [▶️ Quick Test] [🔧 Configure] [📊 View Stats] [📝 Notes] │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🛠️  SharpHound - AD Enumeration              [Untested]   │   │
│ │                                                            │   │
│ │ Category: Enumeration | Version: 4.3.1                    │   │
│ │ Research Value: ⭐⭐⭐ High                                 │   │
│ │ Success Rate: N/A (0 executions)                          │   │
│ │                                                            │   │
│ │ Compatible Agents:                                         │   │
│ │   • Azure-AD Agent (recommended)                          │   │
│ │   • Research Agent (testing)                              │   │
│ │                                                            │   │
│ │ Related Projects: None                                     │   │
│ │                                                            │   │
│ │ [▶️ Quick Test] [🔧 Configure] [📊 View Stats] [📝 Notes] │   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown

**File:** `client/src/components/offsec-team/ToolLabTab.tsx`

```typescript
import { useState } from 'react';
import { useToolLibrary } from '@/hooks/useToolLibrary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ToolCard from './ToolCard';
import AddToolDialog from './AddToolDialog';
import QuickTestDialog from './QuickTestDialog';

interface ToolLabTabProps {
  projectId?: string;  // Optional: filter tools for specific project
}

export default function ToolLabTab({ projectId }: ToolLabTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [addToolOpen, setAddToolOpen] = useState(false);
  const [testingTool, setTestingTool] = useState<Tool | null>(null);

  const { tools, loading, error, refetch } = useToolLibrary({
    testingStatus: statusFilter !== 'all' ? statusFilter : undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    searchQuery,
  });

  const handleQuickTest = (tool: Tool) => {
    setTestingTool(tool);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tool Lab</h2>
        <Button onClick={() => setAddToolOpen(true)}>
          + Add Tool
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {['all', 'untested', 'testing', 'validated', 'deprecated'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>

        <Input
          type="search"
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />

        <Select
          value={categoryFilter}
          onValueChange={setCategoryFilter}
        >
          <option value="all">All Categories</option>
          <option value="scanner">Scanner</option>
          <option value="exploit">Exploit</option>
          <option value="c2">C2</option>
          <option value="fuzzer">Fuzzer</option>
          <option value="enumeration">Enumeration</option>
          <option value="post-exploitation">Post-Exploitation</option>
        </Select>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 gap-4">
        {loading && <p>Loading tools...</p>}
        {error && <p className="text-destructive">Error: {error.message}</p>}
        {tools && tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onQuickTest={() => handleQuickTest(tool)}
            onRefetch={refetch}
          />
        ))}
        {tools && tools.length === 0 && (
          <p className="text-muted-foreground text-center py-12">
            No tools found. Add your first tool to get started.
          </p>
        )}
      </div>

      {/* Dialogs */}
      <AddToolDialog
        open={addToolOpen}
        onClose={() => setAddToolOpen(false)}
        onSuccess={() => {
          setAddToolOpen(false);
          refetch();
        }}
      />

      {testingTool && (
        <QuickTestDialog
          tool={testingTool}
          open={!!testingTool}
          onClose={() => setTestingTool(null)}
          onSuccess={() => {
            setTestingTool(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
```

#### ToolCard Component

**File:** `client/src/components/offsec-team/ToolCard.tsx`

```typescript
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import ToolStatsDialog from './ToolStatsDialog';
import ToolNotesDialog from './ToolNotesDialog';

interface ToolCardProps {
  tool: ToolLibraryEntry;
  onQuickTest: () => void;
  onRefetch: () => void;
}

export default function ToolCard({ tool, onQuickTest, onRefetch }: ToolCardProps) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    const variants = {
      untested: 'secondary',
      testing: 'default',
      validated: 'success',
      deprecated: 'destructive',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getResearchValueStars = (value: string) => {
    const stars = value === 'high' ? 3 : value === 'medium' ? 2 : 1;
    return '⭐'.repeat(stars);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛠️</span>
            <div>
              <h3 className="text-lg font-semibold">{tool.tool.name}</h3>
              <p className="text-sm text-muted-foreground">
                {tool.tool.category} | Version: {tool.tool.version}
              </p>
            </div>
          </div>
          {getStatusBadge(tool.testingStatus)}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Research Value */}
        <div>
          <span className="text-sm font-medium">Research Value: </span>
          <span>{getResearchValueStars(tool.researchValue)} {tool.researchValue}</span>
        </div>

        {/* Success Rate */}
        {tool.executionCount > 0 && (
          <div>
            <span className="text-sm font-medium">Success Rate: </span>
            <span className="text-sm">
              {tool.successRate}% ({tool.executionCount} executions)
            </span>
          </div>
        )}

        {/* Compatible Agents */}
        {tool.compatibleAgents.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Compatible Agents:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              {tool.compatibleAgents.map((agent) => (
                <li key={agent.id}>{agent.name}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Related Projects */}
        {tool.relatedProjects.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Related Projects:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              {tool.relatedProjects.map((project) => (
                <li key={project.id}>{project.name}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button size="sm" onClick={onQuickTest}>
          ▶️ Quick Test
        </Button>
        <Button size="sm" variant="outline">
          🔧 Configure
        </Button>
        <Button size="sm" variant="outline" onClick={() => setStatsOpen(true)}>
          📊 View Stats
        </Button>
        <Button size="sm" variant="outline" onClick={() => setNotesOpen(true)}>
          📝 Notes
        </Button>
      </CardFooter>

      {/* Dialogs */}
      <ToolStatsDialog
        tool={tool}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
      />
      <ToolNotesDialog
        tool={tool}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        onSave={onRefetch}
      />
    </Card>
  );
}
```

#### Quick Test Dialog

**File:** `client/src/components/offsec-team/QuickTestDialog.tsx`

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { testTool } from '@/services/offsecTeamService';
import { useToast } from '@/hooks/useToast';

interface QuickTestDialogProps {
  tool: ToolLibraryEntry;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickTestDialog({ tool, open, onClose, onSuccess }: QuickTestDialogProps) {
  const [agentId, setAgentId] = useState('');
  const [targetType, setTargetType] = useState<'url' | 'ip' | 'domain'>('url');
  const [targetValue, setTargetValue] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTest = async () => {
    if (!agentId || !targetValue) {
      toast({ title: 'Validation Error', description: 'Agent and target are required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await testTool(tool.id, {
        agentId,
        testTarget: { type: targetType, value: targetValue },
      });

      toast({
        title: 'Test Started',
        description: `Experiment ${response.experimentId} is now running`,
      });

      onSuccess();
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Test: {tool.tool.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent Selection */}
          <div>
            <Label htmlFor="agent">Select Agent</Label>
            <Select
              id="agent"
              value={agentId}
              onValueChange={setAgentId}
            >
              <option value="">Choose an agent...</option>
              {tool.compatibleAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Target Type */}
          <div>
            <Label htmlFor="targetType">Target Type</Label>
            <Select
              id="targetType"
              value={targetType}
              onValueChange={(val) => setTargetType(val as 'url' | 'ip' | 'domain')}
            >
              <option value="url">URL</option>
              <option value="ip">IP Address</option>
              <option value="domain">Domain</option>
            </Select>
          </div>

          {/* Target Value */}
          <div>
            <Label htmlFor="targetValue">Target Value</Label>
            <Input
              id="targetValue"
              type="text"
              placeholder={
                targetType === 'url' ? 'https://example.com' :
                targetType === 'ip' ? '192.168.1.1' :
                'example.com'
              }
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleTest} disabled={loading}>
            {loading ? 'Starting...' : '▶️ Run Test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Add Tool Dialog

**File:** `client/src/components/offsec-team/AddToolDialog.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSecurityTools } from '@/hooks/useSecurityTools';
import { addToolToLibrary } from '@/services/offsecTeamService';
import { useToast } from '@/hooks/useToast';

interface AddToolDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddToolDialog({ open, onClose, onSuccess }: AddToolDialogProps) {
  const [securityToolId, setSecurityToolId] = useState('');
  const [researchValue, setResearchValue] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const { tools } = useSecurityTools();
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!securityToolId) {
      toast({ title: 'Validation Error', description: 'Please select a tool', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await addToolToLibrary({
        securityToolId,
        researchValue,
        testingStatus: 'untested',
        notes,
      });

      toast({ title: 'Success', description: 'Tool added to library' });
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tool to R&D Library</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="tool">Select Security Tool</Label>
            <Select
              id="tool"
              value={securityToolId}
              onValueChange={setSecurityToolId}
            >
              <option value="">Choose a tool...</option>
              {tools && tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name} ({tool.category})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="researchValue">Research Value</Label>
            <Select
              id="researchValue"
              value={researchValue}
              onValueChange={(val) => setResearchValue(val as 'low' | 'medium' | 'high')}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this tool's research value or intended use..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? 'Adding...' : 'Add to Library'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Key Features

1. **Tool Status Filtering**: Filter by untested, testing, validated, or deprecated status
2. **Search & Category Filters**: Quick access to specific tools
3. **Quick Test**: One-click tool testing with agent selection and target configuration
4. **Success Rate Tracking**: Visual display of execution success rates
5. **Agent Compatibility**: Shows which R&D agents can execute each tool
6. **Related Projects**: Links tools to active research projects
7. **Notes System**: Internal documentation for each tool
8. **Statistics Dashboard**: Detailed execution history and performance metrics

#### Data Flow

1. **Fetch Tools**: `GET /api/v1/offsec-rd/tools` with filter parameters
2. **Add Tool**: `POST /api/v1/offsec-rd/tools` to link security_tools entry
3. **Quick Test**: `POST /api/v1/offsec-rd/tools/:id/test` creates experiment and starts workflow
4. **Update Status**: `PUT /api/v1/offsec-rd/tools/:id` to change testing status or research value

#### Integration Points

- **Security Tools**: Retrieves tools from existing `security_tools` table
- **Agents**: Lists R&D agents for tool execution
- **Experiments**: Quick test creates experiment and triggers workflow
- **Docker Executor**: Tools with `dockerImage` execute in containers

### Tab 3: Research Projects
**Purpose:** Track ongoing R&D initiatives

```
┌─────────────────────────────────────────────────────────────────┐
│ Active Research Projects                                         │
├─────────────────────────────────────────────────────────────────┤
│ [+ New Project]                                                  │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 📁 Advanced Fuzzing Techniques                            │   │
│ │    Status: 🟢 Active | Lead: Fuzzing Agent               │   │
│ │    Progress: ████████░░ 80%                               │   │
│ │    Experiments: 5 completed, 2 in progress                │   │
│ │    [View Details] [Add Experiment]                        │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 📁 WAF Bypass Research                                    │   │
│ │    Status: 🟡 Planning | Lead: Burp Agent                │   │
│ │    Progress: ███░░░░░░░ 30%                               │   │
│ │    Experiments: 1 completed, 0 in progress                │   │
│ │    [View Details] [Start Research]                        │   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 4: Experiments
**Purpose:** Individual test cases and experiments

#### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Experiments                    [+ New Experiment]  [Filters ▼]  │
├─────────────────────────────────────────────────────────────────┤
│ Project: [All Projects ▼]  Status: [All ▼]  Agent: [All ▼]     │
│ Sort by: [Most Recent ▼]                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🧪 SQLi WAF Bypass - Encoding Technique        [Completed] │   │
│ │                                                            │   │
│ │ Project: WAF Bypass Research                              │   │
│ │ Hypothesis: URL encoding bypasses ModSecurity WAF         │   │
│ │                                                            │   │
│ │ Agent: 🔍 Burp Suite Orchestrator                        │   │
│ │ Tools: SQLMap, Burp Intruder                              │   │
│ │ Target: https://demo.testfire.net/login                   │   │
│ │                                                            │   │
│ │ ✅ Success | Duration: 8m 42s                             │   │
│ │ Results: Bypass successful with %2527 encoding            │   │
│ │                                                            │   │
│ │ Completed: 2 hours ago                                     │   │
│ │ [View Details] [View Results] [Clone] [Export]            │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🧪 Fuzzing GraphQL API Mutations                [Running]  │   │
│ │                                                            │   │
│ │ Project: Advanced Fuzzing Techniques                      │   │
│ │ Hypothesis: GraphQL mutations vulnerable to DoS attacks   │   │
│ │                                                            │   │
│ │ Agent: 🎯 Fuzzing Agent                                   │   │
│ │ Tools: FFUF, GraphQL Voyager                              │   │
│ │ Target: https://api.example.com/graphql                   │   │
│ │                                                            │   │
│ │ ⏳ In Progress... | Elapsed: 3m 15s / ~10m               │   │
│ │ Status: Testing mutation complexity limits                │   │
│ │                                                            │   │
│ │ Started: 3 minutes ago                                     │   │
│ │ [View Live Log] [Stop]                                     │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🧪 Empire C2 Stager Obfuscation                   [Failed] │   │
│ │                                                            │   │
│ │ Project: C2 Framework Comparison                          │   │
│ │ Hypothesis: XOR obfuscation evades Windows Defender       │   │
│ │                                                            │   │
│ │ Agent: ⚡ Empire C2 Manager                               │   │
│ │ Tools: Empire, Donut, ConfuserEx                          │   │
│ │ Target: Windows 11 Test VM (192.168.56.101)               │   │
│ │                                                            │   │
│ │ ❌ Failed | Duration: 2m 18s                              │   │
│ │ Error: Stager blocked by AMSI                             │   │
│ │                                                            │   │
│ │ Completed: 1 day ago                                       │   │
│ │ [View Error Log] [Retry] [Modify & Rerun]                 │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 🧪 Azure AD Token Theft via Device Code Flow   [Planned]  │   │
│ │                                                            │   │
│ │ Project: Cloud Attack Research                            │   │
│ │ Hypothesis: Device code phishing succeeds without MFA     │   │
│ │                                                            │   │
│ │ Agent: ☁️ Azure-AD Agent                                  │   │
│ │ Tools: TokenTactics, AADInternals, Roadtools              │   │
│ │ Target: Tenant ID: abc-123-def (test tenant)              │   │
│ │                                                            │   │
│ │ 📋 Ready to Execute                                       │   │
│ │                                                            │   │
│ │ Created: 3 days ago                                        │   │
│ │ [▶️ Execute] [Edit] [Delete]                              │   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown

**File:** `client/src/components/offsec-team/ExperimentsTab.tsx`

```typescript
import { useState } from 'react';
import { useExperiments } from '@/hooks/useExperiments';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import ExperimentCard from './ExperimentCard';
import CreateExperimentDialog from './CreateExperimentDialog';
import ExperimentDetailsDialog from './ExperimentDetailsDialog';

export default function ExperimentsTab() {
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);

  const { experiments, loading, error, refetch } = useExperiments({
    projectId: projectFilter !== 'all' ? projectFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    executedByAgentId: agentFilter !== 'all' ? agentFilter : undefined,
    sortBy: sortBy as 'created_at' | 'started_at' | 'completed_at',
    sortOrder: 'desc',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Experiments</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refetch}>
            🔄 Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            + New Experiment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Project</label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <option value="all">All Projects</option>
            {/* Populated from projects API */}
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <option value="all">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Agent</label>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <option value="all">All Agents</option>
            {/* Populated from agents API */}
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Sort By</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <option value="created_at">Most Recent</option>
            <option value="started_at">Recently Started</option>
            <option value="completed_at">Recently Completed</option>
          </Select>
        </div>
      </div>

      {/* Experiment Cards */}
      <div className="space-y-4">
        {loading && <p>Loading experiments...</p>}
        {error && <p className="text-destructive">Error: {error.message}</p>}
        {experiments && experiments.map((experiment) => (
          <ExperimentCard
            key={experiment.id}
            experiment={experiment}
            onViewDetails={() => setSelectedExperiment(experiment)}
            onRefetch={refetch}
          />
        ))}
        {experiments && experiments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">No experiments found</p>
            <p className="text-sm">Create your first experiment to begin testing</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateExperimentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          refetch();
        }}
      />

      {selectedExperiment && (
        <ExperimentDetailsDialog
          experiment={selectedExperiment}
          open={!!selectedExperiment}
          onClose={() => setSelectedExperiment(null)}
          onRefetch={refetch}
        />
      )}
    </div>
  );
}
```

#### ExperimentCard Component

**File:** `client/src/components/offsec-team/ExperimentCard.tsx`

```typescript
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { executeExperiment, cancelExperiment } from '@/services/offsecTeamService';
import { useToast } from '@/hooks/useToast';
import { formatDistance } from 'date-fns';

interface ExperimentCardProps {
  experiment: Experiment;
  onViewDetails: () => void;
  onRefetch: () => void;
}

export default function ExperimentCard({ experiment, onViewDetails, onRefetch }: ExperimentCardProps) {
  const { toast } = useToast();

  const getStatusBadge = (status: string) => {
    const config = {
      planned: { variant: 'secondary', icon: '📋', label: 'Planned' },
      running: { variant: 'default', icon: '⏳', label: 'Running' },
      completed: { variant: 'success', icon: '✅', label: 'Completed' },
      failed: { variant: 'destructive', icon: '❌', label: 'Failed' },
      cancelled: { variant: 'outline', icon: '🚫', label: 'Cancelled' },
    };
    const { variant, icon, label } = config[status] || config.planned;
    return <Badge variant={variant}>{icon} {label}</Badge>;
  };

  const handleExecute = async () => {
    try {
      await executeExperiment(experiment.id, {});
      toast({ title: 'Experiment Started', description: `${experiment.name} is now running` });
      onRefetch();
    } catch (error) {
      toast({ title: 'Execution Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleStop = async () => {
    try {
      await cancelExperiment(experiment.id);
      toast({ title: 'Experiment Stopped', description: `${experiment.name} has been cancelled` });
      onRefetch();
    } catch (error) {
      toast({ title: 'Stop Failed', description: error.message, variant: 'destructive' });
    }
  };

  const getElapsedTime = () => {
    if (!experiment.startedAt) return null;
    const start = new Date(experiment.startedAt);
    const end = experiment.completedAt ? new Date(experiment.completedAt) : new Date();
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧪</span>
            <div>
              <h3 className="text-lg font-semibold">{experiment.name}</h3>
              <p className="text-sm text-muted-foreground">
                Project: {experiment.projectName || 'Unknown'}
              </p>
            </div>
          </div>
          {getStatusBadge(experiment.status)}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Hypothesis */}
        {experiment.hypothesis && (
          <div>
            <span className="text-sm font-medium">Hypothesis: </span>
            <span className="text-sm">{experiment.hypothesis}</span>
          </div>
        )}

        {/* Agent & Tools */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Agent: </span>
            <span>{experiment.executedByAgent?.name || 'Not assigned'}</span>
          </div>
          <div>
            <span className="font-medium">Tools: </span>
            <span>{experiment.toolsUsed?.join(', ') || 'None'}</span>
          </div>
        </div>

        {/* Target */}
        {experiment.targets && experiment.targets.length > 0 && (
          <div>
            <span className="text-sm font-medium">Target: </span>
            <span className="text-sm">{experiment.targets[0].value}</span>
          </div>
        )}

        {/* Running Status */}
        {experiment.status === 'running' && (
          <div className="space-y-2">
            <Progress value={45} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Elapsed: {getElapsedTime()} / ~{experiment.estimatedDuration || '10m'}
            </p>
            <p className="text-sm text-muted-foreground">
              Status: {experiment.currentStep || 'Executing...'}
            </p>
          </div>
        )}

        {/* Completed Status */}
        {experiment.status === 'completed' && (
          <div>
            <span className={`text-sm font-medium ${experiment.success ? 'text-green-600' : 'text-yellow-600'}`}>
              {experiment.success ? '✅ Success' : '⚠️ Partial Success'}
            </span>
            <span className="text-sm text-muted-foreground"> | Duration: {getElapsedTime()}</span>
            {experiment.results?.summary && (
              <p className="text-sm mt-1">{experiment.results.summary}</p>
            )}
          </div>
        )}

        {/* Failed Status */}
        {experiment.status === 'failed' && (
          <div>
            <span className="text-sm font-medium text-destructive">❌ Failed</span>
            <span className="text-sm text-muted-foreground"> | Duration: {getElapsedTime()}</span>
            {experiment.errorMessage && (
              <p className="text-sm text-destructive mt-1">Error: {experiment.errorMessage}</p>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-sm text-muted-foreground">
          {experiment.status === 'planned' && `Created: ${formatDistance(new Date(experiment.createdAt), new Date(), { addSuffix: true })}`}
          {experiment.status === 'running' && `Started: ${formatDistance(new Date(experiment.startedAt!), new Date(), { addSuffix: true })}`}
          {(experiment.status === 'completed' || experiment.status === 'failed') && `Completed: ${formatDistance(new Date(experiment.completedAt!), new Date(), { addSuffix: true })}`}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        {experiment.status === 'planned' && (
          <>
            <Button size="sm" onClick={handleExecute}>
              ▶️ Execute
            </Button>
            <Button size="sm" variant="outline" onClick={onViewDetails}>
              Edit
            </Button>
            <Button size="sm" variant="destructive">
              Delete
            </Button>
          </>
        )}

        {experiment.status === 'running' && (
          <>
            <Button size="sm" variant="outline" onClick={onViewDetails}>
              View Live Log
            </Button>
            <Button size="sm" variant="destructive" onClick={handleStop}>
              Stop
            </Button>
          </>
        )}

        {(experiment.status === 'completed' || experiment.status === 'failed') && (
          <>
            <Button size="sm" onClick={onViewDetails}>
              View Details
            </Button>
            <Button size="sm" variant="outline" onClick={onViewDetails}>
              View Results
            </Button>
            <Button size="sm" variant="outline">
              Clone
            </Button>
            <Button size="sm" variant="outline">
              Export
            </Button>
          </>
        )}

        {experiment.status === 'failed' && (
          <Button size="sm" variant="default">
            Retry
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

#### Create Experiment Dialog

**File:** `client/src/components/offsec-team/CreateExperimentDialog.tsx`

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { createExperiment } from '@/services/offsecTeamService';
import { useToast } from '@/hooks/useToast';
import { useProjects } from '@/hooks/useProjects';
import { useAgents } from '@/hooks/useAgents';

interface CreateExperimentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateExperimentDialog({ open, onClose, onSuccess }: CreateExperimentDialogProps) {
  const [formData, setFormData] = useState({
    projectId: '',
    name: '',
    description: '',
    hypothesis: '',
    methodology: '',
    executedByAgentId: '',
    toolsUsed: '',
    targetType: 'url' as 'url' | 'ip' | 'domain',
    targetValue: '',
  });
  const [loading, setLoading] = useState(false);

  const { projects } = useProjects({ status: 'active' });
  const { agents } = useAgents({ category: 'R&D' });
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!formData.projectId || !formData.name) {
      toast({ title: 'Validation Error', description: 'Project and name are required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await createExperiment({
        projectId: formData.projectId,
        name: formData.name,
        description: formData.description || undefined,
        hypothesis: formData.hypothesis || undefined,
        methodology: formData.methodology || undefined,
        executedByAgentId: formData.executedByAgentId || undefined,
        toolsUsed: formData.toolsUsed ? formData.toolsUsed.split(',').map(t => ({ name: t.trim() })) : undefined,
        targets: formData.targetValue ? [{ type: formData.targetType, value: formData.targetValue }] : undefined,
      });

      toast({ title: 'Success', description: 'Experiment created successfully' });
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Experiment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Selection */}
          <div>
            <Label htmlFor="project">Research Project *</Label>
            <Select
              id="project"
              value={formData.projectId}
              onValueChange={(val) => setFormData({ ...formData, projectId: val })}
            >
              <option value="">Select a project...</option>
              {projects && projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Experiment Name */}
          <div>
            <Label htmlFor="name">Experiment Name *</Label>
            <Input
              id="name"
              placeholder="e.g., SQLi WAF Bypass - Encoding Technique"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of what this experiment tests..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Hypothesis */}
          <div>
            <Label htmlFor="hypothesis">Hypothesis</Label>
            <Textarea
              id="hypothesis"
              placeholder="What are you testing? e.g., URL encoding bypasses ModSecurity WAF"
              value={formData.hypothesis}
              onChange={(e) => setFormData({ ...formData, hypothesis: e.target.value })}
              rows={2}
            />
          </div>

          {/* Methodology */}
          <div>
            <Label htmlFor="methodology">Methodology</Label>
            <Textarea
              id="methodology"
              placeholder="How will you test this hypothesis? What steps will the agent follow?"
              value={formData.methodology}
              onChange={(e) => setFormData({ ...formData, methodology: e.target.value })}
              rows={3}
            />
          </div>

          {/* Agent Selection */}
          <div>
            <Label htmlFor="agent">Executing Agent</Label>
            <Select
              id="agent"
              value={formData.executedByAgentId}
              onValueChange={(val) => setFormData({ ...formData, executedByAgentId: val })}
            >
              <option value="">Auto-select agent...</option>
              {agents && agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Tools */}
          <div>
            <Label htmlFor="tools">Tools (comma-separated)</Label>
            <Input
              id="tools"
              placeholder="e.g., SQLMap, Burp Intruder, FFUF"
              value={formData.toolsUsed}
              onChange={(e) => setFormData({ ...formData, toolsUsed: e.target.value })}
            />
          </div>

          {/* Target */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="targetType">Target Type</Label>
              <Select
                id="targetType"
                value={formData.targetType}
                onValueChange={(val) => setFormData({ ...formData, targetType: val as 'url' | 'ip' | 'domain' })}
              >
                <option value="url">URL</option>
                <option value="ip">IP Address</option>
                <option value="domain">Domain</option>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="targetValue">Target Value</Label>
              <Input
                id="targetValue"
                placeholder={formData.targetType === 'url' ? 'https://example.com' : formData.targetType === 'ip' ? '192.168.1.1' : 'example.com'}
                value={formData.targetValue}
                onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Experiment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Key Features

1. **Status-Based Display**: Different card layouts for planned, running, completed, and failed experiments
2. **Real-Time Updates**: Live progress tracking for running experiments with elapsed time
3. **Quick Actions**: Execute, stop, retry, clone, and export experiments
4. **Advanced Filtering**: Filter by project, status, agent, and sort order
5. **Result Visualization**: Display success/failure status, error messages, and result summaries
6. **Workflow Integration**: Experiments trigger agent workflows via execute endpoint

#### Data Flow

1. **List Experiments**: `GET /api/v1/offsec-rd/experiments` with filters
2. **Create Experiment**: `POST /api/v1/offsec-rd/experiments`
3. **Execute Experiment**: `POST /api/v1/offsec-rd/experiments/:id/execute` starts workflow
4. **Update Status**: Real-time updates via polling or WebSocket
5. **View Results**: `GET /api/v1/offsec-rd/experiments/:id` for detailed results

#### Integration Points

- **Research Projects**: Experiments belong to projects
- **Agents**: Agents execute experiments via Agent Workflow Orchestrator
- **Workflows**: Each experiment execution creates a workflow instance
- **Tools**: Tools used are tracked in experiment metadata

### Tab 5: Knowledge Base
**Purpose:** Curated offensive security knowledge

#### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Knowledge Base                      [+ Add Article]  [Import]   │
├─────────────────────────────────────────────────────────────────┤
│ Search: [_________________________________]  [🔍 Search]         │
│                                                                  │
│ Category: [All ▼]  Tags: [All ▼]  ATT&CK: [All Tactics ▼]      │
│ Source: [All ▼]  Sort: [Relevance ▼]                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 📄 Advanced SQL Injection Techniques for WAF Bypass       │   │
│ │                                                            │   │
│ │ Category: Web Application Security                        │   │
│ │ Tags: sql-injection, waf-bypass, encoding, obfuscation    │   │
│ │ ATT&CK: T1190 (Exploit Public-Facing Application)        │   │
│ │                                                            │   │
│ │ Summary: Comprehensive guide to bypassing modern WAFs     │   │
│ │ using encoding techniques, comment injection, and HTTP    │   │
│ │ parameter pollution. Includes real-world examples from    │   │
│ │ penetration tests...                                       │   │
│ │                                                            │   │
│ │ Source: Internal Research | Author: Research Agent        │   │
│ │ Published: 2 days ago | Similarity: 94%                   │   │
│ │                                                            │   │
│ │ [Read Article] [View Similar] [Add to Project] [Export]   │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 📄 Covenant C2 Framework: Operational Guide               │   │
│ │                                                            │   │
│ │ Category: Command & Control                               │   │
│ │ Tags: c2, covenant, .net, evasion, implant                │   │
│ │ ATT&CK: T1071.001 (App Layer Protocol: Web Protocols)    │   │
│ │                                                            │   │
│ │ Summary: Complete operational guide for deploying and     │   │
│ │ managing Covenant C2 infrastructure. Covers implant       │   │
│ │ generation, listener configuration, OPSEC considerations, │   │
│ │ and evasion techniques...                                 │   │
│ │                                                            │   │
│ │ Source: Tool Documentation | Author: Empire C2 Manager    │   │
│ │ Published: 1 week ago | Similarity: 87%                   │   │
│ │                                                            │   │
│ │ [Read Article] [View Similar] [Add to Project] [Export]   │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 📄 AMSI Bypass Techniques - 2025 Edition                  │   │
│ │                                                            │   │
│ │ Category: Defense Evasion                                 │   │
│ │ Tags: amsi, bypass, powershell, dotnet, windows           │   │
│ │ ATT&CK: T1562.001 (Impair Defenses: Disable/Modify Tools)│   │
│ │                                                            │   │
│ │ Summary: Analysis of current AMSI bypass techniques       │   │
│ │ effective against Windows 11 24H2. Covers memory          │   │
│ │ patching, context switching, and DLL unhooking methods... │   │
│ │                                                            │   │
│ │ Source: External Research | Author: Dr. James Forshaw     │   │
│ │ Published: 3 weeks ago | Similarity: 82%                  │   │
│ │                                                            │   │
│ │ [Read Article] [View Similar] [Add to Project] [Export]   │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 📄 GraphQL Security Testing Methodology                   │   │
│ │                                                            │   │
│ │ Category: API Security                                    │   │
│ │ Tags: graphql, api, fuzzing, introspection, dos           │   │
│ │ ATT&CK: T1190 (Exploit Public-Facing Application)        │   │
│ │                                                            │   │
│ │ Summary: Systematic approach to testing GraphQL APIs      │   │
│ │ for security vulnerabilities. Includes introspection      │   │
│ │ queries, mutation fuzzing, and batching attack vectors... │   │
│ │                                                            │   │
│ │ Source: Documentation | Author: Fuzzing Agent             │   │
│ │ Published: 1 month ago | Similarity: 75%                  │   │
│ │                                                            │   │
│ │ [Read Article] [View Similar] [Add to Project] [Export]   │   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown

**File:** `client/src/components/offsec-team/KnowledgeBaseTab.tsx`

```typescript
import { useState } from 'react';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import KnowledgeArticleCard from './KnowledgeArticleCard';
import AddArticleDialog from './AddArticleDialog';
import ArticleViewerDialog from './ArticleViewerDialog';
import ImportArticlesDialog from './ImportArticlesDialog';

export default function KnowledgeBaseTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [tacticFilter, setTacticFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'created_at' | 'updated_at'>('relevance');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  const { articles, loading, error, refetch } = useKnowledgeBase({
    q: searchQuery || undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    tags: tagFilter !== 'all' ? [tagFilter] : undefined,
    attackTactics: tacticFilter !== 'all' ? [tacticFilter] : undefined,
    source: sourceFilter !== 'all' ? sourceFilter : undefined,
    sortBy,
  });

  const handleSearch = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Knowledge Base</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            📥 Import
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            + Add Article
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          type="search"
          placeholder="Search knowledge base... (e.g., 'SQL injection bypass techniques')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch}>
          🔍 Search
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-5 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Category</label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <option value="all">All Categories</option>
            <option value="web-application">Web Application</option>
            <option value="api-security">API Security</option>
            <option value="c2">Command & Control</option>
            <option value="defense-evasion">Defense Evasion</option>
            <option value="post-exploitation">Post-Exploitation</option>
            <option value="cloud-security">Cloud Security</option>
            <option value="mobile-security">Mobile Security</option>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Tags</label>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <option value="all">All Tags</option>
            {/* Populated dynamically from available tags */}
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">ATT&CK Tactic</label>
          <Select value={tacticFilter} onValueChange={setTacticFilter}>
            <option value="all">All Tactics</option>
            <option value="TA0001">Initial Access</option>
            <option value="TA0002">Execution</option>
            <option value="TA0003">Persistence</option>
            <option value="TA0004">Privilege Escalation</option>
            <option value="TA0005">Defense Evasion</option>
            <option value="TA0006">Credential Access</option>
            <option value="TA0007">Discovery</option>
            <option value="TA0008">Lateral Movement</option>
            <option value="TA0009">Collection</option>
            <option value="TA0010">Exfiltration</option>
            <option value="TA0011">Command and Control</option>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Source</label>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <option value="all">All Sources</option>
            <option value="internal">Internal Research</option>
            <option value="external">External Research</option>
            <option value="documentation">Tool Documentation</option>
            <option value="research">Academic Papers</option>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Sort By</label>
          <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
            <option value="relevance">Relevance</option>
            <option value="created_at">Newest First</option>
            <option value="updated_at">Recently Updated</option>
          </Select>
        </div>
      </div>

      {/* Article Cards */}
      <div className="space-y-4">
        {loading && <p>Loading knowledge base...</p>}
        {error && <p className="text-destructive">Error: {error.message}</p>}
        {articles && articles.map((article) => (
          <KnowledgeArticleCard
            key={article.id}
            article={article}
            onReadArticle={() => setSelectedArticle(article)}
            onRefetch={refetch}
          />
        ))}
        {articles && articles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">No articles found</p>
            <p className="text-sm">
              {searchQuery
                ? 'Try a different search query or adjust filters'
                : 'Add your first knowledge base article to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddArticleDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {
          setAddOpen(false);
          refetch();
        }}
      />

      <ImportArticlesDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          setImportOpen(false);
          refetch();
        }}
      />

      {selectedArticle && (
        <ArticleViewerDialog
          article={selectedArticle}
          open={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onRefetch={refetch}
        />
      )}
    </div>
  );
}
```

#### KnowledgeArticleCard Component

**File:** `client/src/components/offsec-team/KnowledgeArticleCard.tsx`

```typescript
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistance } from 'date-fns';

interface KnowledgeArticleCardProps {
  article: KnowledgeArticle;
  onReadArticle: () => void;
  onRefetch: () => void;
}

export default function KnowledgeArticleCard({ article, onReadArticle, onRefetch }: KnowledgeArticleCardProps) {
  const getTacticBadge = (tacticId: string) => {
    const tactics = {
      TA0001: { name: 'Initial Access', color: 'blue' },
      TA0002: { name: 'Execution', color: 'purple' },
      TA0003: { name: 'Persistence', color: 'green' },
      TA0004: { name: 'Privilege Escalation', color: 'yellow' },
      TA0005: { name: 'Defense Evasion', color: 'red' },
      TA0006: { name: 'Credential Access', color: 'orange' },
      TA0007: { name: 'Discovery', color: 'teal' },
      TA0008: { name: 'Lateral Movement', color: 'indigo' },
      TA0009: { name: 'Collection', color: 'pink' },
      TA0010: { name: 'Exfiltration', color: 'rose' },
      TA0011: { name: 'Command and Control', color: 'violet' },
    };
    return tactics[tacticId] || { name: tacticId, color: 'gray' };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <span className="text-2xl">📄</span>
            <div>
              <h3 className="text-lg font-semibold">{article.title}</h3>
              <p className="text-sm text-muted-foreground">
                Category: {article.category}
              </p>
            </div>
          </div>
          {article.relevanceScore && (
            <Badge variant="secondary">
              Similarity: {Math.round(article.relevanceScore * 100)}%
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-sm font-medium mr-1">Tags:</span>
            {article.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* ATT&CK Tactics */}
        {article.attackTactics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-sm font-medium mr-1">ATT&CK:</span>
            {article.attackTactics.map((tacticId) => {
              const tactic = getTacticBadge(tacticId);
              return (
                <Badge key={tacticId} variant="default" className="text-xs">
                  {tacticId} ({tactic.name})
                </Badge>
              );
            })}
          </div>
        )}

        {/* ATT&CK Techniques */}
        {article.attackTechniques.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-sm font-medium mr-1">Techniques:</span>
            {article.attackTechniques.slice(0, 5).map((techId) => (
              <Badge key={techId} variant="outline" className="text-xs">
                {techId}
              </Badge>
            ))}
            {article.attackTechniques.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{article.attackTechniques.length - 5} more
              </Badge>
            )}
          </div>
        )}

        {/* Summary */}
        {article.summary && (
          <p className="text-sm text-muted-foreground">
            {article.summary}
          </p>
        )}

        {/* Metadata */}
        <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2 pt-2 border-t">
          <div>
            <span className="font-medium">Source: </span>
            <span>{article.source}</span>
          </div>
          {article.author && (
            <div>
              <span className="font-medium">Author: </span>
              <span>{article.author}</span>
            </div>
          )}
          <div>
            <span className="font-medium">Published: </span>
            <span>
              {article.publishedDate
                ? formatDistance(new Date(article.publishedDate), new Date(), { addSuffix: true })
                : formatDistance(new Date(article.createdAt), new Date(), { addSuffix: true })}
            </span>
          </div>
          {article.sourceUrl && (
            <div className="col-span-2">
              <span className="font-medium">URL: </span>
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {article.sourceUrl}
              </a>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button size="sm" onClick={onReadArticle}>
          Read Article
        </Button>
        <Button size="sm" variant="outline">
          View Similar
        </Button>
        <Button size="sm" variant="outline">
          Add to Project
        </Button>
        <Button size="sm" variant="outline">
          Export
        </Button>
      </CardFooter>
    </Card>
  );
}
```

#### Add Article Dialog

**File:** `client/src/components/offsec-team/AddArticleDialog.tsx`

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { createKnowledgeArticle } from '@/services/offsecTeamService';
import { useToast } from '@/hooks/useToast';

interface AddArticleDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddArticleDialog({ open, onClose, onSuccess }: AddArticleDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    category: '',
    tags: '',
    attackTactics: [] as string[],
    attackTechniques: '',
    source: 'internal' as 'internal' | 'external' | 'research' | 'documentation',
    sourceUrl: '',
    author: '',
    publishedDate: '',
    generateEmbedding: true,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!formData.title || !formData.content || !formData.category) {
      toast({
        title: 'Validation Error',
        description: 'Title, content, and category are required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await createKnowledgeArticle({
        title: formData.title,
        content: formData.content,
        summary: formData.summary || undefined,
        category: formData.category,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : undefined,
        attackTactics: formData.attackTactics.length > 0 ? formData.attackTactics : undefined,
        attackTechniques: formData.attackTechniques
          ? formData.attackTechniques.split(',').map(t => t.trim())
          : undefined,
        source: formData.source,
        sourceUrl: formData.sourceUrl || undefined,
        author: formData.author || undefined,
        publishedDate: formData.publishedDate || undefined,
        generateEmbedding: formData.generateEmbedding,
      });

      toast({ title: 'Success', description: 'Article created successfully' });
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Knowledge Base Article</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Advanced SQL Injection Techniques for WAF Bypass"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Category *</Label>
            <Input
              id="category"
              placeholder="e.g., Web Application Security"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              placeholder="e.g., sql-injection, waf-bypass, encoding"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>

          {/* ATT&CK Techniques */}
          <div>
            <Label htmlFor="techniques">ATT&CK Techniques (comma-separated)</Label>
            <Input
              id="techniques"
              placeholder="e.g., T1190, T1059.001, T1055"
              value={formData.attackTechniques}
              onChange={(e) => setFormData({ ...formData, attackTechniques: e.target.value })}
            />
          </div>

          {/* Summary */}
          <div>
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              placeholder="Brief summary (auto-generated if left blank)"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={3}
            />
          </div>

          {/* Content */}
          <div>
            <Label htmlFor="content">Content (Markdown) *</Label>
            <Textarea
              id="content"
              placeholder="Full article content in Markdown format..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          {/* Source Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="source">Source</Label>
              <Select
                id="source"
                value={formData.source}
                onValueChange={(val) => setFormData({ ...formData, source: val as any })}
              >
                <option value="internal">Internal Research</option>
                <option value="external">External Research</option>
                <option value="documentation">Tool Documentation</option>
                <option value="research">Academic Papers</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                placeholder="Author name"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="sourceUrl">Source URL</Label>
            <Input
              id="sourceUrl"
              type="url"
              placeholder="https://example.com/article"
              value={formData.sourceUrl}
              onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
            />
          </div>

          {/* RAG Embedding */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="generateEmbedding"
              checked={formData.generateEmbedding}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, generateEmbedding: checked as boolean })
              }
            />
            <Label htmlFor="generateEmbedding" className="cursor-pointer">
              Generate AI embedding for RAG similarity search
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Article'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Article Viewer Dialog

**File:** `client/src/components/offsec-team/ArticleViewerDialog.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getKnowledgeArticle, searchSimilarArticles } from '@/services/offsecTeamService';
import ReactMarkdown from 'react-markdown';

interface ArticleViewerDialogProps {
  article: KnowledgeArticle;
  open: boolean;
  onClose: () => void;
  onRefetch: () => void;
}

export default function ArticleViewerDialog({ article, open, onClose, onRefetch }: ArticleViewerDialogProps) {
  const [fullArticle, setFullArticle] = useState<KnowledgeArticleDetail | null>(null);
  const [showSimilar, setShowSimilar] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && article.id) {
      loadFullArticle();
    }
  }, [open, article.id]);

  const loadFullArticle = async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeArticle(article.id);
      setFullArticle(data);
    } catch (error) {
      console.error('Failed to load article:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article.title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p>Loading article...</p>
        ) : fullArticle ? (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="flex flex-wrap gap-2 pb-4 border-b">
              <Badge>{fullArticle.category}</Badge>
              {fullArticle.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* ATT&CK Info */}
            {(fullArticle.attackTactics.length > 0 || fullArticle.attackTechniques.length > 0) && (
              <div className="space-y-2 pb-4 border-b">
                {fullArticle.attackTactics.length > 0 && (
                  <div>
                    <span className="font-medium text-sm">ATT&CK Tactics: </span>
                    {fullArticle.attackTactics.join(', ')}
                  </div>
                )}
                {fullArticle.attackTechniques.length > 0 && (
                  <div>
                    <span className="font-medium text-sm">ATT&CK Techniques: </span>
                    {fullArticle.attackTechniques.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{fullArticle.content}</ReactMarkdown>
            </div>

            {/* Similar Articles */}
            {fullArticle.relatedArticles && fullArticle.relatedArticles.length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="font-medium mb-2">Related Articles ({fullArticle.relatedArticles.length})</h3>
                <div className="space-y-2">
                  {fullArticle.relatedArticles.map((related) => (
                    <div key={related.id} className="flex items-center justify-between">
                      <span className="text-sm">{related.title}</span>
                      <Badge variant="outline">
                        {Math.round(related.similarity * 100)}% similar
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source Info */}
            <div className="text-sm text-muted-foreground pt-4 border-t">
              <div>
                <span className="font-medium">Source: </span>
                <span>{fullArticle.source}</span>
              </div>
              {fullArticle.author && (
                <div>
                  <span className="font-medium">Author: </span>
                  <span>{fullArticle.author}</span>
                </div>
              )}
              {fullArticle.sourceUrl && (
                <div>
                  <span className="font-medium">URL: </span>
                  <a
                    href={fullArticle.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {fullArticle.sourceUrl}
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p>Failed to load article</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline">
            Add to Project
          </Button>
          <Button>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Key Features

1. **Full-Text Search**: PostgreSQL tsvector-based search with relevance ranking
2. **Vector Similarity Search**: pgvector-powered RAG for finding semantically similar articles
3. **ATT&CK Mapping**: Tag articles with MITRE ATT&CK tactics and techniques
4. **Multi-Source Support**: Internal research, external research, documentation, academic papers
5. **Markdown Rendering**: Full markdown support for article content
6. **Related Articles**: Automatic similarity detection using vector embeddings
7. **Advanced Filtering**: Filter by category, tags, ATT&CK tactics, source
8. **Import Functionality**: Bulk import from external sources

#### Data Flow

1. **List Articles**: `GET /api/v1/offsec-rd/knowledge` with search query and filters
2. **Create Article**: `POST /api/v1/offsec-rd/knowledge` with content
3. **Generate Embedding**: Automatic embedding generation via OpenAI API if enabled
4. **Full-Text Indexing**: PostgreSQL trigger auto-updates tsvector search index
5. **Similarity Search**: `POST /api/v1/offsec-rd/knowledge/search-similar` for RAG queries
6. **View Article**: `GET /api/v1/offsec-rd/knowledge/:id` for full content

#### Integration Points

- **RAG System**: Vector embeddings enable semantic search and agent knowledge augmentation
- **ATT&CK Framework**: Links to MITRE ATT&CK tactics and techniques
- **Research Projects**: Articles can be linked to active research projects
- **Agents**: Agents query knowledge base during execution for context
- **pgvector**: PostgreSQL extension for vector similarity search

---

## Implementation Plan

### Phase 1: Foundation (Tier 2, Week 3)
1. **Extract Tools** (Day 15-16)
   - Clone offsec-team repository components
   - Identify compatible tools
   - Map to RTPI architecture

2. **Agent Integration** (Day 17-18)
   - Create Burp Suite agent
   - Create Empire C2 agent
   - Create Fuzzing agent
   - Register in agents table

3. **Basic UI** (Day 19-21)
   - Create OffSec Team page
   - R&D Agents tab
   - Tool Lab tab (basic)

### Phase 2: Advanced Features (Tier 3, Post-Beta)
1. **Research Projects**
   - Project tracking system
   - Experiment management
   - Results analysis

2. **Knowledge Base**
   - RAG integration
   - Document management
   - Search and retrieval

3. **Advanced Workflows**
   - Automated research pipelines
   - Cross-agent collaboration
   - Report generation

---

## Compatibility Matrix

### What Gets Absorbed from offsec-team

| Component | Status | Integration Method |
|-----------|--------|-------------------|
| Tools Directory | ✅ Absorb | Adapt agents, register in RTPI |
| Agent Implementations | ✅ Absorb | Convert to RTPI agent format |
| Configuration Patterns | ✅ Reference | Use as templates |
| Documentation | ✅ Reference | Incorporate into RTPI docs |
| Scripts | ✅ Selective | Useful automation only |

### What Gets Discarded

| Component | Status | Reason |
|-----------|--------|--------|
| MCP Servers | ❌ Discard | RTPI has own MCP architecture |
| OpenWebUI Bridge | ❌ Discard | RTPI has React UI |
| Gateway | ❌ Discard | RTPI uses Express routing |
| Infrastructure Layer | ❌ Discard | RTPI has Docker executor |
| Workers | ❌ Discard | Conflicts with RTPI design |

---

## Testing Requirements

### Unit Tests
- [ ] R&D agent creation and configuration
- [ ] Tool library registration
- [ ] Research project CRUD operations
- [ ] Experiment tracking

**Target Coverage:** 75%

### Integration Tests
- [ ] Agent execution through existing connector
- [ ] Tool invocation from R&D agents
- [ ] Workflow orchestration
- [ ] Database operations
- [ ] **Maldev Agent Rust toolchain integration**
- [ ] **Compilation of Rust POC binaries**

**Target Coverage:** 70%

### E2E Tests
- [ ] Complete R&D workflow
- [ ] Agent collaboration
- [ ] Project lifecycle
- [ ] **End-to-end Rust POC workflow:**
  - [ ] Reverse engineering with WinDBG/x64dbg/Ghidra
  - [ ] ROP chain development
  - [ ] Shellcode generation
  - [ ] Rust compilation to binary
  - [ ] Executable testing (Windows PE & Linux ELF)

**Target Coverage:** 60%

### Maldev-Specific Tests (NEW)
- [ ] Reverse engineering tools functional (WinDBG MCP, x64dbg MCP, Ghidra MCP)
- [ ] ROP chain generators working (RustChain, ROPgadget, Ropdump)
- [ ] Shellcode IDE integration
- [ ] Rust toolchain installed and configured
- [ ] Compilation to Windows PE executable
- [ ] Compilation to Linux ELF binary
- [ ] Cross-compilation capabilities
- [ ] Binary analysis tools functional
- [ ] **Complete POC workflow: Analysis → Development → Compilation → Testing**

**Target Coverage:** 80% (critical for Maldev functionality)

---

## Dependencies

### External Dependencies
- Burp Suite Professional (if using Burp agent)
- Empire C2 Framework (if using Empire agent)
- FFUF and other security tools

### Internal Dependencies
- RTPI agents system
- RTPI agent-tool-connector
- RTPI workflow orchestrator
- RTPI tools management
- Existing MCP server manager

### No New Infrastructure Required
- ✅ Uses RTPI's existing database
- ✅ Uses RTPI's existing API structure
- ✅ Uses RTPI's existing Docker executor
- ✅ Uses RTPI's existing authentication

---

## Success Metrics

### Functional Requirements
- [ ] **7 R&D agents registered and operational** (Burp, Empire, Fuzzing, Framework, Maldev, Azure-AD, Research)
- [ ] 10+ core tools from offsec-team integrated
- [ ] 72+ specialized tool repositories integrated (Maldev: 44, Azure-AD: 28)
- [ ] Research project tracking working
- [ ] No conflicts with existing RTPI features
- [ ] **Maldev Agent successfully compiles Rust POC to binary**

### Performance Requirements
- [ ] Agent operations same as existing agents
- [ ] Tool execution through existing executor
- [ ] No performance degradation

### User Experience
- [ ] Clear separation between production and R&D
- [ ] Easy agent configuration
- [ ] Intuitive project tracking

---

## Migration from offsec-team

### Step-by-Step Absorption

1. **Clone offsec-team locally** (if not already done)
   ```bash
   cd /home/cmndcntrl/capstone
   git clone https://github.com/cmndcntrlcyber/offsec-team
   ```

2. **Extract Relevant Components**
   ```bash
   # Copy tools to RTPI
   cp -r offsec-team/tools/* rtpi/server/services/offsec-agents/
   
   # Copy useful scripts
   cp offsec-team/scripts/* rtpi/scripts/offsec-rd/
   
   # Reference documentation
   cp -r offsec-team/docs/* rtpi/docs/offsec-team-reference/
   ```

3. **Adapt to RTPI**
   - Convert Python/JS agents to RTPI agent format
   - Register in agents table
   - Configure tool settings
   - Test execution

4. **Verify No Conflicts**
   - Check no port conflicts
   - Verify no API route collisions
   - Ensure database schema compatible
   - Test alongside existing features

---

## Related Documentation
- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent document
- [05-TOOL-FRAMEWORK.md](05-TOOL-FRAMEWORK.md) - Tool framework (auto-installer)
- [offsec-team Repository](https://github.com/cmndcntrlcyber/offsec-team) - Source project

---

**Status Legend:**
- 🔴 Tier 1 - Critical for beta
- 🟡 Tier 2 - Beta enhancement
- 🟢 Tier 3 - Post-beta
- ✅ Absorb - Include in RTPI
- ❌ Discard - Not compatible
- 📝 Planned

---

**Last Updated:** December 4, 2025  
**Maintained By:** RTPI Development Team
