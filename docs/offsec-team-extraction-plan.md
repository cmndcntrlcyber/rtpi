# OffSec Team Tool Extraction Plan

**Plan Date:** 2025-12-26
**Status:** Phase 1 Complete - Ready for Phase 2
**Total Tools Identified:** 40
**Recommended for Migration:** 16 (Phase 1-2)
**Post-Beta Candidates:** 24 (Phase 3)

---

## Extraction Strategy

### Philosophy:
- **Start small, prove value** - Migrate high-impact, low-complexity tools first
- **Incremental integration** - Test each tool thoroughly before next migration
- **Leverage existing infrastructure** - Use RTPI's tool framework (100% complete)
- **Avoid scope creep** - Skip MCP servers, OpenWebUI bridge, and infrastructure components

### Success Metrics:
- ✅ Tools operational within RTPI
- ✅ Integration tests passing
- ✅ UI components functional
- ✅ Documentation complete
- ✅ Zero breaking changes to existing RTPI

---

## Phase 1: Foundation & Quick Wins (Days 12-16)

**Goal:** Migrate 6 high-value tools with immediate operational benefit

### Tier 1A: Vulnerability Testing (3 tools)

#### 1. WebVulnerabilityTester
- **File:** `tools/bug_hunter/WebVulnerabilityTester.py`
- **Priority:** 🔴 CRITICAL
- **Complexity:** MEDIUM (2-3 days)
- **Value:** Immediate vulnerability testing capabilities
- **Dependencies:** requests, pydantic (✅ already in RTPI)
- **Integration:**
  - Create `/server/services/web-vulnerability-tester.ts` wrapper
  - Add endpoint `POST /api/v1/vulnerabilities/test`
  - Integrate with Operations workflows
  - Connect to vulnerability management page
- **Testing:**
  - Test SQL injection detection
  - Test XSS detection
  - Test command injection detection
  - Validate result parsing

#### 2. VulnerabilityReportGenerator
- **File:** `tools/bug_hunter/VulnerabilityReportGenerator.py`
- **Priority:** 🔴 HIGH
- **Complexity:** LOW (1-2 days)
- **Value:** Enhanced reporting for vulnerabilities
- **Dependencies:** pydantic, jinja2 (may need to add)
- **Integration:**
  - Enhance `/server/services/report-generator.ts`
  - Add vulnerability-specific report templates
  - Integrate with existing report generation
- **Testing:**
  - Generate sample vulnerability report
  - Test template rendering
  - Validate output formats (PDF, HTML, JSON)

#### 3. VulnerabilityScannerBridge
- **File:** `tools/bug_hunter/VulnerabilityScannerBridge.py`
- **Priority:** 🟡 HIGH
- **Complexity:** MEDIUM (2-3 days)
- **Value:** Integration with external scanners (Nessus, OpenVAS, etc.)
- **Dependencies:** requests, pydantic
- **Integration:**
  - Create `/server/services/scanner-bridge.ts` wrapper
  - Add endpoints for scanner management
  - Support multiple scanner types
- **Testing:**
  - Mock scanner integration tests
  - Test result parsing from various scanners
  - Validate scanner status checking

---

### Tier 1B: Burp Suite Integration (3 tools)

#### 4. BurpSuiteAPIClient
- **File:** `tools/burpsuite_operator/BurpSuiteAPIClient.py`
- **Priority:** 🔴 CRITICAL
- **Complexity:** HIGH (4-5 days)
- **Value:** Foundational Burp Suite integration
- **Dependencies:** requests, pydantic, shared/api_clients/base_client.py
- **Integration:**
  - Create `/server/services/burp-suite-executor.ts`
  - Add database tables: burp_scans, burp_findings
  - Create API endpoints `/api/v1/burp/*`
  - Build frontend page `/client/src/pages/BurpSuite.tsx`
- **Prerequisites:**
  - Burp Suite Professional license
  - Burp REST API enabled
  - Port 1337 accessible
- **Testing:**
  - Test connection establishment
  - Test scan creation
  - Test result retrieval
  - Validate error handling

#### 5. BurpScanOrchestrator
- **File:** `tools/burpsuite_operator/BurpScanOrchestrator.py`
- **Priority:** 🟡 HIGH
- **Complexity:** MEDIUM (3-4 days)
- **Value:** Automated scan orchestration
- **Dependencies:** BurpSuiteAPIClient, requests, pydantic
- **Integration:**
  - Extend burp-suite-executor.ts
  - Add scan orchestration endpoints
  - Connect to Operations workflows
  - Enable agent automation
- **Testing:**
  - Test multi-target scanning
  - Test scan prioritization
  - Test concurrent scan management
  - Validate resource limits

#### 6. BurpResultProcessor
- **File:** `tools/burpsuite_operator/BurpResultProcessor.py`
- **Priority:** 🟡 HIGH
- **Complexity:** MEDIUM (2-3 days)
- **Value:** Parse and enrich Burp scan results
- **Dependencies:** pydantic, shared/data_models/security_models.py
- **Integration:**
  - Add result processing to burp-suite-executor.ts
  - Parse Burp XML/JSON output
  - Map to RTPI vulnerability schema
  - Auto-create vulnerability records
- **Testing:**
  - Test XML parsing
  - Test JSON parsing
  - Test vulnerability deduplication
  - Validate severity mapping

---

## Phase 2: Core Integrations (Days 17-23)

**Goal:** Migrate 6-8 tools that enhance core capabilities

### Tier 2A: Advanced Scanning (3 tools)

#### 7. FrameworkSecurityAnalyzer
- **File:** `tools/bug_hunter/FrameworkSecurityAnalyzer.py`
- **Priority:** 🟡 MEDIUM
- **Complexity:** HIGH (4-5 days)
- **Value:** Technology stack vulnerability assessment
- **Features:**
  - Detect web frameworks (React, Angular, Django, etc.)
  - Identify versions and CVEs
  - Assess security configurations
  - Generate remediation recommendations

#### 8. ResearcherThreatIntelligence
- **File:** `tools/bug_hunter/ResearcherThreatIntelligence.py`
- **Priority:** 🟡 MEDIUM
- **Complexity:** MEDIUM (3 days)
- **Value:** Threat intelligence enrichment
- **Features:**
  - Query threat intelligence feeds
  - Enrich vulnerability data
  - Track threat actors
  - Map to ATT&CK techniques

#### 9. BurpVulnerabilityAssessor
- **File:** `tools/burpsuite_operator/BurpVulnerabilityAssessor.py`
- **Priority:** 🟡 MEDIUM
- **Complexity:** MEDIUM (3 days)
- **Value:** Automated vulnerability assessment
- **Features:**
  - Assess Burp findings
  - Risk scoring
  - False positive detection
  - Prioritization recommendations

---

### Tier 2B: Workflow Enhancement (3-5 tools)

#### 10. TaskScheduler
- **File:** `tools/nexus_kamuy/TaskScheduler.py`
- **Priority:** 🟡 MEDIUM
- **Complexity:** MEDIUM (3-4 days)
- **Value:** Enhanced task scheduling for agents
- **Integration:**
  - Enhance agent-workflow-orchestrator.ts
  - Add task prioritization
  - Implement scheduling algorithms
  - Queue management

#### 11. AgentCoordinator
- **File:** `tools/nexus_kamuy/AgentCoordinator.py`
- **Priority:** 🟢 MEDIUM
- **Complexity:** HIGH (5-6 days)
- **Value:** Multi-agent coordination
- **Integration:**
  - Extend agent orchestration system
  - Enable agent-to-agent communication
  - Implement coordination protocols
  - Add agent status management

#### 12. WorkflowOrchestrator
- **File:** `tools/nexus_kamuy/WorkflowOrchestrator.py`
- **Priority:** 🟢 MEDIUM
- **Complexity:** HIGH (5-6 days)
- **Value:** Advanced workflow automation
- **Integration:**
  - Enhance workflow capabilities
  - Add complex workflow patterns
  - Enable conditional workflows
  - Implement error handling

---

### Optional Tier 2 Tools (if time permits):

#### 13. ResearcherCodeAnalysis
- **File:** `tools/rt_dev/ResearcherCodeAnalysis.py`
- **Priority:** 🟢 LOW-MEDIUM
- **Complexity:** MEDIUM (3 days)
- **Value:** Code security analysis for tool validation

#### 14. ResearcherExploitDatabase
- **File:** `tools/bug_hunter/ResearcherExploitDatabase.py`
- **Priority:** 🟢 LOW-MEDIUM
- **Complexity:** MEDIUM (2-3 days)
- **Value:** Exploit database integration (ExploitDB, etc.)

---

## Phase 3: Advanced Features (Post-Beta)

**Goal:** Migrate remaining 24 tools for advanced capabilities

### Deferred Tool Categories:

#### Compliance & Policy (daedelu5 - 8 tools):
- SecurityPolicyEnforcer
- ComplianceAuditor
- InfrastructureAsCodeManager
- SelfHealingIntegrator
- ResearcherRiskIntelligence
- ResearcherComplianceIntelligence
- ResearcherPolicyAnalyzer
- (1 more)

**Rationale:** Advanced enterprise features, not critical for core functionality

#### DevOps Automation (rt_dev - 6 tools):
- CodeForgeGenerator
- CIPipelineManager
- InfrastructureOrchestrator
- PlatformConnector
- ResearcherAutomationIntelligence
- ResearcherSecurityIntegration

**Rationale:** Specialized DevOps features, lower priority for offensive security platform

#### Advanced Orchestration (nexus_kamuy - 5 tools):
- CollaborationManager
- ResearcherCollaborationEnhancement
- ResearcherTaskIntelligence
- ResearcherWorkflowOptimization
- (1 more)

**Rationale:** Nice-to-have enhancements to existing orchestration

#### Additional Research Tools (5 tools):
- ResearcherVulnContext (bug_hunter)
- ResearcherPayloadIntelligence (burpsuite_operator)
- ResearcherScanEnhancer (burpsuite_operator)
- ResearcherWebAppIntelligence (burpsuite_operator)
- (others)

**Rationale:** Lower impact, enhancement tools

---

## Shared Module Migration

**Critical:** Extract shared modules before tool migration

### Priority 1: Base Infrastructure

#### shared/ResearcherTool.py
- **Purpose:** Base class for all research tools
- **Action:** Create RTPI equivalent in `/server/services/base/`
- **Complexity:** LOW (1 day)
- **Required for:** All tools depend on this

#### shared/api_clients/base_client.py
- **Purpose:** HTTP client foundation
- **Action:** Adapt to RTPI's existing HTTP client patterns
- **Complexity:** LOW (1 day)
- **Required for:** All API integration tools

### Priority 2: Data Models

#### shared/data_models/security_models.py
- **Purpose:** Security data structures (Vulnerability, ScanResult, etc.)
- **Action:** Map to RTPI's existing types in `/shared/types/`
- **Complexity:** MEDIUM (2 days)
- **Required for:** Vulnerability and scanning tools

#### shared/data_models/workflow_models.py
- **Purpose:** Workflow data structures
- **Action:** Integrate with existing workflow types
- **Complexity:** MEDIUM (2 days)
- **Required for:** Orchestration tools

### Priority 3: Utilities

#### shared/security/auth.py
- **Purpose:** Authentication utilities
- **Action:** Adapt to RTPI's auth system
- **Complexity:** LOW (1 day)

#### shared/security/crypto.py
- **Purpose:** Cryptographic operations
- **Action:** Use RTPI's existing encryption.ts or adapt
- **Complexity:** LOW (1 day)

---

## Migration Workflow

### For Each Tool:

1. **Analysis** (30 min - 1 hour)
   - Read tool code
   - Identify dependencies
   - Map to RTPI architecture
   - Plan integration points

2. **Preparation** (1-2 hours)
   - Extract shared dependencies
   - Create TypeScript wrapper service
   - Design database schema changes (if needed)
   - Plan API endpoints

3. **Implementation** (1-3 days)
   - Create backend service wrapper
   - Add database migrations (if needed)
   - Create API endpoints
   - Build frontend components (if needed)
   - Write integration tests

4. **Testing** (0.5-1 day)
   - Unit tests for service wrapper
   - Integration tests for API endpoints
   - E2E tests for complete workflow
   - Security testing
   - Performance testing

5. **Documentation** (0.5 day)
   - API documentation
   - User guide updates
   - Admin guide updates
   - Code comments

6. **Review & Deploy** (0.5 day)
   - Code review
   - Testing verification
   - Update master tracker
   - Deploy to development

---

## Technical Implementation Details

### Database Schema Extensions:

```sql
-- Burp Suite Integration
CREATE TABLE burp_servers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 1337,
  api_key TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'inactive',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE burp_scans (
  id SERIAL PRIMARY KEY,
  server_id INTEGER REFERENCES burp_servers(id),
  operation_id INTEGER REFERENCES operations(id),
  target_url TEXT NOT NULL,
  scan_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE burp_findings (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER REFERENCES burp_scans(id),
  vulnerability_id INTEGER REFERENCES vulnerabilities(id),
  name VARCHAR(255),
  severity VARCHAR(50),
  confidence VARCHAR(50),
  description TEXT,
  remediation TEXT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints Structure:

```typescript
// Burp Suite
POST   /api/v1/burp/servers          // Register Burp server
GET    /api/v1/burp/servers          // List Burp servers
POST   /api/v1/burp/scans            // Create new scan
GET    /api/v1/burp/scans/:id        // Get scan status
GET    /api/v1/burp/findings/:scanId // Get scan findings
DELETE /api/v1/burp/scans/:id        // Cancel scan

// Vulnerability Testing
POST   /api/v1/vulnerabilities/test  // Test for vulnerabilities
GET    /api/v1/vulnerabilities/reports // Generate reports

// Scanner Integration
POST   /api/v1/scanners/connect      // Connect external scanner
GET    /api/v1/scanners              // List connected scanners
POST   /api/v1/scanners/:id/scan     // Trigger scan
```

### Service Architecture:

```
server/services/
├── burp-suite-executor.ts           # Burp Suite integration
├── web-vulnerability-tester.ts      # Vulnerability testing
├── scanner-bridge.ts                # External scanner integration
├── tool-migrator.ts                 # Tool migration utilities
└── base/
    ├── python-tool-executor.ts      # Generic Python tool runner
    └── researcher-tool-base.ts      # ResearcherTool adaptation
```

---

## Resource Requirements

### Time Estimates:

**Phase 1 (6 tools):** 14-19 days
- WebVulnerabilityTester: 2-3 days
- VulnerabilityReportGenerator: 1-2 days
- VulnerabilityScannerBridge: 2-3 days
- BurpSuiteAPIClient: 4-5 days
- BurpScanOrchestrator: 3-4 days
- BurpResultProcessor: 2-3 days

**Phase 2 (6-8 tools):** 20-30 days
- FrameworkSecurityAnalyzer: 4-5 days
- ResearcherThreatIntelligence: 3 days
- BurpVulnerabilityAssessor: 3 days
- TaskScheduler: 3-4 days
- AgentCoordinator: 5-6 days
- WorkflowOrchestrator: 5-6 days
- (Optional tools: 5-10 days)

**Total Phase 1-2:** 34-49 days

### External Dependencies:

**Required:**
- Burp Suite Professional license ($399/year)
- Burp Suite REST API enabled

**Optional:**
- Nessus scanner (for scanner bridge)
- OpenVAS (for scanner bridge)
- Threat intelligence API keys (for threat intelligence)

---

## Risk Mitigation

### Technical Risks:

**Risk:** Python-TypeScript integration complexity
- **Mitigation:** Use existing tool-executor.ts patterns
- **Fallback:** Create Python subprocess wrapper service

**Risk:** Shared module dependency conflicts
- **Mitigation:** Extract shared modules first, test independently
- **Fallback:** Copy required code into each tool wrapper

**Risk:** Burp Suite API limitations
- **Mitigation:** Thorough API documentation review upfront
- **Fallback:** Use Burp Suite extensions if API insufficient

**Risk:** Performance impact from Python tools
- **Mitigation:** Run tools in separate processes, implement timeouts
- **Fallback:** Rewrite critical tools in TypeScript

### Operational Risks:

**Risk:** Burp Suite licensing costs
- **Mitigation:** Document value proposition clearly
- **Fallback:** Start with free/trial version for POC

**Risk:** Tool testing requires targets
- **Mitigation:** Use intentionally vulnerable apps (DVWA, WebGoat)
- **Fallback:** Mock testing with simulated responses

---

## Success Criteria

### Phase 1 Complete:
- ✅ 6 tools migrated and operational
- ✅ Burp Suite integration functional
- ✅ Vulnerability testing working
- ✅ All integration tests passing
- ✅ User documentation complete
- ✅ Master tracker updated

### Phase 2 Complete:
- ✅ 12-14 total tools migrated
- ✅ Advanced scanning capabilities operational
- ✅ Workflow enhancements deployed
- ✅ Agent coordination enhanced
- ✅ Comprehensive testing done
- ✅ Admin documentation complete

---

## Next Actions (Phase 2 Start)

1. **#OT-04:** Create tool-analyzer.ts service
   - Automatic tool detection
   - Configuration generation
   - Dependency analysis

2. **#OT-05:** Build tool-migration-service.ts
   - Automated tool migration
   - Python wrapper generation
   - Testing automation

3. **#OT-06:** Create API endpoints
   - POST /api/v1/tool-migration/analyze
   - POST /api/v1/tool-migration/migrate
   - GET /api/v1/tool-migration/status

4. **#OT-07:** Implement batch migration
   - Parallel migration support
   - Progress tracking
   - Error handling

5. **#OT-08:** Add validation tests
   - Tool migration tests
   - Integration tests
   - E2E workflow tests

---

## Appendix: Tool Migration Checklist

### Per-Tool Checklist:

- [ ] Tool analysis complete
- [ ] Dependencies identified
- [ ] Shared modules extracted
- [ ] Database schema updated (if needed)
- [ ] Backend service created
- [ ] API endpoints implemented
- [ ] Frontend components created (if needed)
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] Security review complete
- [ ] Documentation updated
- [ ] Code review complete
- [ ] Master tracker updated
- [ ] Tool deployed to development
- [ ] Tool registered in security_tools table

---

**Status:** Ready for Phase 2 Implementation
**Next Task:** #OT-04 - Create tool-analyzer.ts service
