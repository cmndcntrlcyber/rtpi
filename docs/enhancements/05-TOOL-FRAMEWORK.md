# Tool Framework Enhancements - Tier 1/2 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🔴 Tier 1 (Core) / 🟡 Tier 2 (Advanced)  
**Timeline:** Week 1-2 (Core), Week 3-4 (Advanced)  
**Total Items:** 25  
**Last Updated:** December 4, 2025

---

## Overview

This document details the comprehensive tool framework enhancements, including tool configuration schema, GitHub auto-installer, testing framework, and agent-tool validation.

### Purpose
- **Standardize tool configuration** across all security tools
- **Enable easy tool addition** via GitHub repository URL
- **Provide testing framework** for tool validation
- **Support agent-tool integration** with validation
- **Automate tool discovery** and installation

### Success Criteria
- ✅ Tool configuration schema implemented
- ✅ GitHub auto-installer functional
- ✅ Testing framework operational
- ✅ Agent-tool validation working
- ✅ rtpi-tools container automatically updated

---

## Table of Contents

1. [Tool Configuration Schema](#tool-configuration-schema)
2. [GitHub Tool Auto-Installer](#github-tool-auto-installer)
3. [Tool Testing Framework](#tool-testing-framework)
4. [Agent-Tool Assignment & Validation](#agent-tool-assignment--validation)
5. [Tool Registry & Management](#tool-registry--management)
6. [Output Parsing System](#output-parsing-system)
7. [rtpi-tools Container Integration](#rtpi-tools-container-integration)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Testing Requirements](#testing-requirements)

---

## Tool Configuration Schema

### Status: 🔴 Tier 1 - High Priority

### Description
Standardized configuration schema for all security tools to ensure consistent behavior and integration.

### Schema Definition
```typescript
interface ToolConfiguration {
  // Basic Info
  toolId: string;
  name: string;
  category: string; // 'reconnaissance', 'exploitation', 'web_security', etc.
  description: string;
  version: string;
  
  // Execution
  command: string;
  entrypoint?: string;
  workingDirectory?: string;
  
  // Parameters
  parameters: ToolParameter[];
  
  // Target Compatibility
  supportedTargetTypes: ('ip' | 'domain' | 'url' | 'network' | 'range')[];
  
  // Output
  outputFormat: 'text' | 'json' | 'xml' | 'csv';
  outputParser: string; // Function name or parsing script
  
  // Execution Settings
  requiresSudo: boolean;
  timeout: number; // seconds
  maxRetries: number;
  environment: Record<string, string>;
  
  // Container/Docker
  dockerImage?: string;
  dockerfile?: string;
  buildArgs?: Record<string, string>;
  
  // GitHub Integration
  githubUrl?: string;
  installMethod?: 'docker' | 'binary' | 'script' | 'pip' | 'npm';
  
  // Documentation
  documentation: string;
  exampleCommands: string[];
  usageNotes: string;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  default?: any;
  options?: string[]; // For select/multiselect
  validation?: string; // Regex pattern
  description: string;
  example?: string;
}
```

### Implementation Checklist
- [ ] Define TypeScript interfaces
- [ ] Create schema validation
- [ ] Update existing tools to use schema
- [ ] Add schema editor UI
- [ ] Create configuration templates
- [ ] Add import/export functionality

**[TO BE FILLED]**

### Estimated Effort
2-3 days

---

## GitHub Tool Auto-Installer

### Status: 🟡 Tier 2 - Medium Priority

### Description
Automated tool installation system that analyzes GitHub repositories, detects dependencies, generates Dockerfiles, and installs tools into the rtpi-tools container.

### User Flow
```
1. User clicks "Add New Tool" → Enter GitHub URL
2. System analyzes repository:
   - Detects language (Python, Go, Rust, Node.js, etc.)
   - Finds dependency files (requirements.txt, package.json, etc.)
   - Extracts installation instructions from README
   - Identifies entry points
3. Shows analysis preview with editable config
4. User reviews and adjusts configuration
5. User clicks "Install"
6. System:
   - Generates Dockerfile
   - Builds Docker image
   - Tests installation
   - Registers in database
   - Updates rtpi-tools container
7. Tool ready for use
```

### UI Design
```
┌─────────────────────────────────────────────────────────────────┐
│ Add New Tool from GitHub                                         │
├─────────────────────────────────────────────────────────────────┤
│ GitHub Repository URL *                                          │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │ https://github.com/SecFathy/Bugzee                       │    │
│ └──────────────────────────────────────────────────────────┘    │
│ [Analyze Repository]                                             │
│                                                                  │
│ ✅ Repository Analysis Complete:                                │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │ Name: Bugzee                                             │    │
│ │ Language: Python 3.9+                                    │    │
│ │ Requirements: requirements.txt found                     │    │
│ │ Installation: pip install -r requirements.txt            │    │
│ │ Entry Point: bugzee.py                                   │    │
│ │ License: MIT                                             │    │
│ │ Size: 2.4 MB                                             │    │
│ │ Last Updated: 2 weeks ago                                │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ Tool Configuration                                               │
│ Category: [Vulnerability Scanning ▼]                             │
│ Command: [bugzee scan {target}                           ]       │
│ Output Format: [JSON ▼]                                          │
│                                                                  │
│ [Cancel]                              [Install in rtpi-tools →] │
└─────────────────────────────────────────────────────────────────┘
```

### Components

#### A. GitHub Repository Analyzer
**[TO BE FILLED]**

```typescript
// server/services/github-tool-analyzer.ts

class GitHubToolAnalyzer {
  async analyzeRepository(githubUrl: string): Promise<ToolAnalysis> {
    // 1. Parse GitHub URL
    // 2. Fetch repository metadata via GitHub API
    // 3. Detect language & dependencies
    // 4. Parse installation instructions
    // 5. Identify entry points
    return analysis;
  }
  
  private async detectDependencies(owner: string, repo: string): Promise<Dependencies>;
  private async parseInstallInstructions(owner: string, repo: string): Promise<InstallInstructions>;
}
```

#### B. Dockerfile Generator
**[TO BE FILLED]**

```typescript
// server/services/tool-dockerfile-generator.ts

class ToolDockerfileGenerator {
  generateDockerfile(analysis: ToolAnalysis): string {
    // Generate appropriate Dockerfile based on language
  }
  
  private generatePythonDockerfile(analysis: ToolAnalysis): string;
  private generateNodeDockerfile(analysis: ToolAnalysis): string;
  private generateGoDockerfile(analysis: ToolAnalysis): string;
}
```

#### C. Auto-Installer Service
**[TO BE FILLED]**

```typescript
// server/services/tool-auto-installer.ts

class ToolAutoInstaller {
  async installTool(githubUrl: string, config: ToolConfig): Promise<InstallResult> {
    // 1. Analyze repository
    // 2. Generate Dockerfile
    // 3. Build Docker image
    // 4. Test installation
    // 5. Register in database
    // 6. Update rtpi-tools container
    return result;
  }
}
```

### Implementation Checklist
- [ ] Create GitHub analyzer service
- [ ] Implement language detection
- [ ] Add dependency parser for Python, Node, Go, Rust
- [ ] Create Dockerfile generator
- [ ] Implement Docker build process
- [ ] Add installation testing
- [ ] Create tool registration
- [ ] Update rtpi-tools container
- [ ] Build UI components
- [ ] Add error handling

### Estimated Effort
5-6 days

---

## Tool Testing Framework

### Status: 🔴 Tier 1 - High Priority

### Description
Comprehensive testing framework for validating tool installations and ensuring they work correctly before use.

### Test Suite Structure
```typescript
interface ToolTest {
  toolId: string;
  testName: string;
  testTarget: string; // Safe target for testing
  expectedOutput: {
    minPorts?: number;
    services?: string[];
    shouldSucceed: boolean;
    outputPattern?: RegExp;
  };
  timeout: number;
}

// Run test suite for a tool
async function testTool(toolId: string): Promise<ToolTestResult[]> {
  // Execute predefined tests
  // Validate outputs
  // Return pass/fail results
}
```

### Pre-defined Tests
**[TO BE FILLED]**

- **Nmap Test:** Scan scanme.nmap.org, expect ports 22, 80
- **BBOT Test:** Enumerate example.com, expect subdomains
- **XSStrike Test:** Test against safe target, expect XSS detection
- **Nuclei Test:** Run basic templates, expect format validation

### UI Components
```
┌─────────────────────────────────────────────────────────────────┐
│ Tool Testing - Nmap                                              │
├─────────────────────────────────────────────────────────────────┤
│ Test Name              Status      Duration    Details           │
│ ─────────────────────────────────────────────────────────────── │
│ Basic Scan             ✅ Pass      2.3s        22 ports found   │
│ Service Detection      ✅ Pass      4.1s        SSH, HTTP OK     │
│ Invalid Target         ✅ Pass      0.1s        Error handled    │
│ Timeout Handling       🚧 Running   --          In progress...   │
│                                                                  │
│ Overall: 3/3 passing                          [Run All Tests]    │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create test framework service
- [ ] Define test suites for core tools
- [ ] Implement test execution
- [ ] Add result validation
- [ ] Create testing UI
- [ ] Add test history logging
- [ ] Implement automated testing on tool updates

### Estimated Effort
3-4 days

---

## Agent-Tool Assignment & Validation

### Status: 🔴 Tier 1 - High Priority

### Description
Validate that tools assigned to agents are properly configured, accessible, and compatible.

### Validation Checks
**[TO BE FILLED]**

1. **Tool Availability:** Verify tool is installed and accessible
2. **Permission Check:** Ensure agent has permissions to run tool
3. **Dependency Check:** Validate all dependencies met
4. **Compatibility Check:** Confirm tool supports agent's target types
5. **Configuration Check:** Validate tool parameters are correct

### UI Components
```
┌─────────────────────────────────────────────────────────────────┐
│ Agent Tool Configuration - [Agent Name]                          │
├─────────────────────────────────────────────────────────────────┤
│ Assigned Tools:                                                  │
│                                                                  │
│ ☑ Nmap                   ✅ Validated    [Test] [Configure]     │
│ ☑ BBOT                   ⚠️  Warning     [Test] [Configure]     │
│   └─ Missing API key for full functionality                     │
│ ☐ XSStrike               ⏸️  Not tested  [Test] [Configure]     │
│ ☑ Metasploit             ✅ Validated    [Test] [Configure]     │
│                                                                  │
│ [+ Add Tool]  [Test All]  [Save]                                │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create validation service
- [ ] Implement availability checks
- [ ] Add permission validation
- [ ] Test tool execution
- [ ] Create validation UI
- [ ] Add warning/error displays
- [ ] Implement auto-fix suggestions

### Estimated Effort
2-3 days

---

## Tool Registry & Management

### Status: 🟡 Tier 2 - Medium Priority

### Description
Centralized registry for all tools with version tracking, health checks, and usage analytics.

### Features
**[TO BE FILLED]**

- Tool catalog browser
- Version management
- Health status monitoring
- Usage statistics
- Tool recommendations based on target type

### Implementation Checklist
- [ ] Create tool registry service
- [ ] Implement version tracking
- [ ] Add health check system
- [ ] Track usage analytics
- [ ] Create catalog UI
- [ ] Add search and filtering

### Estimated Effort
3 days

---

## Output Parsing System

### Status: 🟡 Tier 2 - Medium Priority

### Description
Unified output parsing system to handle different tool output formats and extract structured data.

### Supported Formats
- Text (unstructured)
- JSON
- XML
- CSV
- Custom formats

### Parser Implementation
**[TO BE FILLED]**

```typescript
// server/services/tool-output-parser.ts

class ToolOutputParser {
  async parse(toolId: string, rawOutput: string): Promise<ParsedOutput> {
    const tool = await this.getTool(toolId);
    const parser = this.getParser(tool.outputFormat);
    return parser.parse(rawOutput);
  }
  
  private getParser(format: string): OutputParser {
    // Return appropriate parser
  }
}
```

### Implementation Checklist
- [ ] Create parser framework
- [ ] Implement JSON parser
- [ ] Implement XML parser
- [ ] Implement text parser (regex-based)
- [ ] Add custom parser support
- [ ] Create parser registry
- [ ] Add validation

### Estimated Effort
3-4 days

---

## rtpi-tools Container Integration

### Status: 🟡 Tier 2 - Medium Priority

### Description
Automatically update the rtpi-tools Docker container when new tools are installed.

### Integration Methods
**[TO BE FILLED]**

#### Method 1: Multi-stage Dockerfile
```dockerfile
# Base layer with common tools
FROM kali-linux:latest AS base
RUN apt-get update && apt-get install -y nmap metasploit-framework

# Dynamically added tools
FROM base AS tools
# Tool layers added here programmatically

FROM tools AS final
WORKDIR /workspace
```

#### Method 2: Volume Mounting
- Mount tools directory
- Install tools at runtime
- Persist across restarts

#### Method 3: Layer Injection
- Build new layer for each tool
- Tag and version images
- Hot-reload container

### Implementation Checklist
- [ ] Choose integration method
- [ ] Implement container update mechanism
- [ ] Add tool layer management
- [ ] Create rebuild automation
- [ ] Test container updates
- [ ] Add rollback capability

### Estimated Effort
3 days

---

## Database Schema

### Enhanced Tools Schema

#### security_tools (Enhanced)
```sql
ALTER TABLE security_tools
ADD COLUMN github_url TEXT,
ADD COLUMN install_method TEXT,
ADD COLUMN dockerfile TEXT,
ADD COLUMN build_args JSONB,
ADD COLUMN dependencies JSONB,
ADD COLUMN test_suite JSONB;
```

#### tool_installation_logs
```sql
CREATE TABLE tool_installation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,
  github_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  analysis_result JSONB,
  build_log TEXT,
  test_output TEXT,
  error_message TEXT,
  installed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### tool_test_results
**[TO BE FILLED]**

### Migration File
- **File:** `migrations/0009_enhance_tool_framework.sql`
- **[TO BE FILLED]**

---

## API Endpoints

### Tool Management API

#### POST /api/v1/tools/analyze-github
**Request:**
```json
{
  "githubUrl": "https://github.com/SecFathy/Bugzee"
}
```
**Response:**
```json
{
  "analysis": {
    "name": "Bugzee",
    "language": "Python",
    "dependencies": [...],
    "entrypoint": "bugzee.py"
  }
}
```

#### POST /api/v1/tools/install
**[TO BE FILLED]**

#### POST /api/v1/tools/:id/test
**[TO BE FILLED]**

#### GET /api/v1/tools/:id/validation
**[TO BE FILLED]**

---

## Testing Requirements

### Unit Tests
- [ ] GitHub analyzer functions
- [ ] Dockerfile generator
- [ ] Dependency detector
- [ ] Tool configuration validator

**Target Coverage:** 80%

### Integration Tests
- [ ] Complete installation workflow
- [ ] Tool testing framework
- [ ] Container update process
- [ ] Agent-tool validation

**Target Coverage:** 70%

### E2E Tests
- [ ] GitHub URL → Installed tool
- [ ] Tool test execution
- [ ] Agent assignment and validation

**Target Coverage:** 60%

---

## Implementation Timeline

### Week 1-2 (Tier 1 - Core Framework)
- [ ] Tool configuration schema
- [ ] Tool testing framework
- [ ] Agent-tool validation
- [ ] Basic registry

### Week 3-4 (Tier 2 - Auto-installer)
- [ ] GitHub repository analyzer
- [ ] Dockerfile generator
- [ ] Auto-installer service
- [ ] UI components
- [ ] Container integration

---

## Dependencies

### External Dependencies
- GitHub API for repository analysis
- Docker SDK for container operations
- Language-specific package managers (pip, npm, cargo, etc.)

### Internal Dependencies
- Docker executor service
- Agent system
- Tool configuration schema

---

## Success Metrics

### Functional Requirements
- [ ] Tool configuration schema adopted
- [ ] GitHub auto-installer working
- [ ] Tool testing passing for all core tools
- [ ] Agent-tool validation operational
- [ ] rtpi-tools container auto-updates

### Performance Requirements
- [ ] Repository analysis <10 seconds
- [ ] Docker build <5 minutes
- [ ] Tool tests <2 minutes
- [ ] Validation checks <1 second

### User Experience
- [ ] Simple tool addition process
- [ ] Clear error messages
- [ ] Progress indicators
- [ ] Helpful documentation

---

## Related Documentation
- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent document
- [01-CRITICAL-BUGS.md](01-CRITICAL-BUGS.md) - Critical bugs (Nmap fixes)
- [RTPI-TOOLS-IMPLEMENTATION.md](../RTPI-TOOLS-IMPLEMENTATION.md) - Tools documentation

---

**Status Legend:**
- 🔴 Tier 1 - Critical for beta
- 🟡 Tier 2 - Beta enhancement
- 🟢 Tier 3 - Post-beta
- ✅ Complete
- 🚧 In Progress
- ⏸️ Blocked

---

**Last Updated:** December 4, 2025  
**Maintained By:** RTPI Development Team
