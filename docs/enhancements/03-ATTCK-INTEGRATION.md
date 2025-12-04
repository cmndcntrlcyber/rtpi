# ATT&CK Integration - Tier 2 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🟡 Tier 2 - Beta Enhancement  
**Timeline:** Week 3-4 (Days 15-30)  
**Total Items:** 40  
**Last Updated:** December 4, 2025

---

## Overview

This document details the complete MITRE ATT&CK framework integration for RTPI, including a dedicated ATT&CK page, Workbench integration for staging, STIX data management, and Attack Flow visualization.

### Purpose
- **Align operations with ATT&CK framework** for standardized adversary tactics
- **Enable workflow planning** using established techniques
- **Facilitate knowledge sharing** through STIX data
- **Support Operation Lead and Technical Writer agents** with staging capabilities
- **Visualize attack paths** using Attack Flow

### Success Criteria
- ✅ ATT&CK page operational with all 6 tabs
- ✅ "Send to Operation Lead" workflow functional
- ✅ STIX data imported and browsable
- ✅ Agents can stage content to Workbench
- ✅ Attack Flow visualization working

---

## Table of Contents

1. [Page Structure & Navigation](#page-structure--navigation)
2. [Tab 1: Navigator (Matrix Visualization)](#tab-1-navigator-matrix-visualization)
3. [Tab 2: Planner (Technique Selection)](#tab-2-planner-technique-selection)
4. [Tab 3: Workbench (Collections & Staging)](#tab-3-workbench-collections--staging)
5. [Tab 4: Attack Flow (Behavior Sequencing)](#tab-4-attack-flow-behavior-sequencing)
6. [Tab 5: Techniques (Browse All)](#tab-5-techniques-browse-all)
7. [Tab 6: Collections (Data Management)](#tab-6-collections-data-management)
8. [ATT&CK Workbench REST API Integration](#attck-workbench-rest-api-integration)
9. [STIX Data Import](#stix-data-import)
10. [Agent-Workbench Bridge](#agent-workbench-bridge)
11. [Database Schema](#database-schema)
12. [API Endpoints](#api-endpoints)
13. [Testing Requirements](#testing-requirements)

---

## Page Structure & Navigation

### Location
- **Route:** `/attck`
- **Navigation:** Main sidebar → ATT&CK (new entry)
- **Icon:** ⚔️ or 🎯
- **Access:** Requires authentication, all authenticated users

### Page Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│ ATT&CK                                                               │
│ Enterprise threat intelligence and operation planning                │
├─────────────────────────────────────────────────────────────────────┤
│ [Navigator] [Planner] [Workbench] [Attack Flow] [Techniques]        │
│ [Collections]                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                     [TAB CONTENT AREA]                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Sidebar Update
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
│ ⚔️ ATT&CK                    │ ← NEW
│                              │
│ ADMINISTRATION               │
│ ⚙️ Settings                  │
│ 👤 Profile                   │
│ 👥 User Management           │
└──────────────────────────────┘
```

### Implementation Checklist
- [ ] Create new route `/attck`
- [ ] Add navigation entry to sidebar
- [ ] Create `ATTACKPage.tsx` page component
- [ ] Implement 6-tab navigation system
- [ ] Add operation context selector
- [ ] Set up state management for ATT&CK data

**[TO BE FILLED WITH DETAILED IMPLEMENTATION]**

---

## Tab 1: Navigator (Matrix Visualization)

### Status: 🟡 Medium Priority

### Description
Interactive ATT&CK Enterprise matrix showing all tactics and techniques with color-coding for coverage and execution status.

### Layout Design
```
┌────────────────────────────────────────────────────────────────────┐
│ ATT&CK Navigator - [Enterprise v14]                                │
├────────────────────────────────────────────────────────────────────┤
│ Filter: [Tactic ▼] [Platform ▼] [Data Source ▼]  [Legend]         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Reconnaissance  Resource    Initial     Execution     Persistence │
│                  Dev         Access                               │
│  ┌──────────┐   ┌────────┐  ┌────────┐  ┌────────┐   ┌────────┐ │
│  │ T1595    │   │ T1583  │  │ T1190  │  │ T1059  │   │ T1543  │ │
│  │ Active   │   │ Acquire│  │ Exploit│  │ Command│   │ Create │ │
│  │ Scanning │   │ Infra  │  │ Public │  │ Script │   │ Service│ │
│  │ ████████ │   │ ▓▓▓▓   │  │ ████   │  │ ▓▓▓▓   │   │ ░░░░   │ │
│  └──────────┘   └────────┘  └────────┘  └────────┘   └────────┘ │
│                                                                    │
│  [Legend: ████ Executed | ▓▓▓▓ Planned | ░░░░ Available]         │
└────────────────────────────────────────────────────────────────────┘
```

### Features
- Interactive matrix with all 14 tactics
- Technique cards with execution status
- Color-coding by status
- Click technique for details
- Filter by platform, tactic, data source
- Coverage percentage indicator

### Implementation Checklist
- [ ] Create NavigatorTab component
- [ ] Fetch ATT&CK matrix data
- [ ] Implement technique card grid
- [ ] Add status color-coding
- [ ] Implement filtering
- [ ] Add click-through to technique details
- [ ] Show coverage statistics
- [ ] Add export to layer file

**[TO BE FILLED]**

### Estimated Effort
4-5 days

---

## Tab 2: Planner (Technique Selection)

### Status: 🟡 High Priority

### Description
Operational planning interface for selecting ATT&CK techniques and sending execution plans to the Operation Lead Agent.

### Layout Design
```
┌─────────────────────────────────────────────────────────────────┐
│ ATT&CK Planner - [Select Operation ▼]                           │
├─────────────────────────────────────────────────────────────────┤
│  Selected Techniques for Execution Plan:                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ T1595 - Active Scanning         [Recon]      [Remove]   │  │
│  │ T1592 - Gather Victim Host Info [Recon]      [Remove]   │  │
│  │ T1190 - Exploit Public-Facing   [Initial]    [Remove]   │  │
│  │ T1059.001 - PowerShell          [Execution]  [Remove]   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [+ Add Technique]  [Import from Collection]  [Clear All]      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Coverage: ████████░░ 80%  |  Est. Time: 4h  |  Risk: H │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Plan Name: [Beta Operation - Recon & Exploit            ]     │
│  Description: [Planned techniques for initial phase       ]     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │   🚀 Send to Operation Lead                             │   │
│  │                                                          │   │
│  │   This will send the execution plan to the Operation    │   │
│  │   Lead Agent for analysis and workflow generation.      │   │
│  │                                                          │   │
│  │   [Cancel]                [Send to Operation Lead →]    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Save Draft]  [Export STIX]  [🚀 Send to Operation Lead]     │
└─────────────────────────────────────────────────────────────────┘
```

### Features
- Technique selection from full ATT&CK catalog
- Drag-and-drop ordering
- Coverage analysis
- Risk assessment
- Time estimation
- **"Send to Operation Lead" button** ⭐ KEY FEATURE

### "Send to Operation Lead" Workflow
**[TO BE FILLED]**

```typescript
// Workflow when button clicked:
1. Validate plan has minimum required techniques
2. Create staged collection in Workbench
3. Submit plan to Operation Lead Agent
4. Agent analyzes techniques and generates workflow
5. Return workflow ID for monitoring
6. Show progress/status to user
```

### Implementation Checklist
- [ ] Create PlannerTab component
- [ ] Implement technique search/selection
- [ ] Add drag-and-drop ordering
- [ ] Calculate coverage percentage
- [ ] Estimate execution time
- [ ] Assess risk level
- [ ] **Implement "Send to Operation Lead" button**
- [ ] Create agent submission workflow
- [ ] Add progress monitoring
- [ ] Save/load draft plans
- [ ] Export to STIX format

### Estimated Effort
4-5 days

---

## Tab 3: Workbench (Collections & Staging)

### Status: 🟡 High Priority

### Description
ATT&CK Workbench serves as a staging area where agents (Operation Lead, Technical Writer) can write ATT&CK objects and organize them into collections before execution or reporting.

### Layout Design
```
┌─────────────────────────────────────────────────────────────────┐
│ ATT&CK Workbench - Collections                                   │
├─────────────────────────────────────────────────────────────────┤
│ [+ New Collection] [Import STIX] [Sync with MITRE]              │
│                                                                  │
│ Filter: [All Types ▼] [All Status ▼] [Search...]               │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 📁 Beta-Ready Op - Execution Plan                           │ │
│ │    Type: execution_plan | Status: 🟡 Staged                │ │
│ │    Techniques: 8 | Created by: Op Lead Agent               │ │
│ │    Last modified: 5 min ago                                │ │
│ │    [View] [Edit] [Execute] [Export]                        │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 📁 Beta-Ready Op - Findings Report                          │ │
│ │    Type: findings_report | Status: ✅ Approved             │ │
│ │    Objects: 15 | Created by: Technical Writer Agent        │ │
│ │    Last modified: 2 hours ago                              │ │
│ │    [View] [Edit] [Generate Report] [Export]                │ │
│ └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Collection Types
- **execution_plan** - Staged by Operation Lead Agent
- **findings_report** - Staged by Technical Writer Agent
- **custom_techniques** - Custom technique library
- **imported_intel** - External threat intelligence

### Implementation Checklist
- [ ] Create WorkbenchTab component
- [ ] Implement collections browser
- [ ] Add collection CRUD operations
- [ ] Display collection contents
- [ ] Implement approval workflow
- [ ] Add STIX export/import
- [ ] Show agent-created collections
- [ ] Add execution triggers

**[TO BE FILLED]**

### Estimated Effort
3-4 days

---

## Tab 4: Attack Flow (Behavior Sequencing)

### Status: 🟢 Medium Priority

### Description
Visual Attack Flow builder for sequencing adversary behaviors based on [attack-flow](https://github.com/center-for-threat-informed-defense/attack-flow) specification.

### Layout Design
```
┌───────────────────────────────────────────────────────────────────┐
│ Attack Flow Builder - [Flow Name]                                 │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│    ┌────────────┐                                                 │
│    │   START    │                                                 │
│    └─────┬──────┘                                                 │
│          ▼                                                        │
│    ┌────────────────┐                                             │
│    │ T1595          │                                             │
│    │ Active Scan    │                                             │
│    │ Asset: Network │                                             │
│    └───────┬────────┘                                             │
│            ▼                                                      │
│      ┌─────┴─────┐                                                │
│      ▼           ▼                                                │
│ ┌──────────┐ ┌──────────┐                                        │
│ │ T1592    │ │ T1590    │                                        │
│ │ Gather   │ │ Gather   │                                        │
│ └────┬─────┘ └────┬─────┘                                        │
│      └─────┬─────┘                                                │
│            ▼                                                      │
│    ┌────────────────┐                                             │
│    │ T1190          │                                             │
│    │ Exploit Public │                                             │
│    └────────────────┘                                             │
│                                                                   │
│  [Add Action] [Add Branch] [Export] [Execute]                    │
└───────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create AttackFlowTab component
- [ ] Implement node-based flow builder
- [ ] Add technique nodes
- [ ] Add asset nodes
- [ ] Implement branching (AND/OR)
- [ ] Add visual connectors
- [ ] Export to Attack Flow JSON
- [ ] Import existing flows

**[TO BE FILLED]**

### Estimated Effort
5-6 days

---

## Tab 5: Techniques (Browse All)

### Status: 🟡 Medium Priority

### Description
Searchable browser for all ATT&CK techniques with detailed information.

### Features
**[TO BE FILLED]**

### Implementation Checklist
- [ ] Create TechniquesTab component
- [ ] Implement technique listing
- [ ] Add search and filtering
- [ ] Show technique details modal
- [ ] Add "Add to Planner" button
- [ ] Display related techniques

### Estimated Effort
2-3 days

---

## Tab 6: Collections (Data Management)

### Status: 🟡 Medium Priority

### Description
Manage STIX collections including imports, exports, and custom libraries.

### Features
**[TO BE FILLED]**

### Implementation Checklist
- [ ] Create CollectionsTab component
- [ ] Display all collections
- [ ] Implement import/export
- [ ] Add collection versioning
- [ ] Show collection statistics

### Estimated Effort
2-3 days

---

## ATT&CK Workbench REST API Integration

### Overview
Integration with [ATT&CK Workbench](https://github.com/center-for-threat-informed-defense/attack-workbench-frontend) REST API for managing ATT&CK data objects.

### REST API Service
**[TO BE FILLED]**

```typescript
// server/services/attck-workbench-connector.ts

class ATTCKWorkbenchConnector {
  // Techniques
  async getTechniques(params?: QueryParams): Promise<Technique[]>;
  async getTechnique(stixId: string): Promise<Technique>;
  async createTechnique(technique: TechniqueInput): Promise<Technique>;
  async updateTechnique(stixId: string, technique: TechniqueInput): Promise<Technique>;
  
  // Tactics
  async getTactics(): Promise<Tactic[]>;
  
  // Collections
  async getCollections(): Promise<Collection[]>;
  async createCollection(collection: CollectionInput): Promise<Collection>;
  async exportCollection(id: string): Promise<STIXBundle>;
  
  // ... more methods
}
```

### Implementation Checklist
- [ ] Create Workbench connector service
- [ ] Implement technique CRUD
- [ ] Implement tactic operations
- [ ] Implement collection operations
- [ ] Add software/tool management
- [ ] Add group (threat actor) management
- [ ] Implement relationship mapping
- [ ] Add error handling and retry logic

**[TO BE FILLED]**

### Estimated Effort
4-5 days

---

## STIX Data Import

### Overview
Import official MITRE ATT&CK data from [attack-stix-data](https://github.com/mitre-attack/attack-stix-data) repository.

### STIX Data Sources
- **Enterprise ATT&CK** - enterprise-attack.json
- **Mobile ATT&CK** - mobile-attack.json
- **ICS ATT&CK** - ics-attack.json

### Import Service
**[TO BE FILLED]**

```typescript
// server/services/stix-data-importer.ts

class STIXDataImporter {
  async importEnterprise(): Promise<ImportResult>;
  async importMobile(): Promise<ImportResult>;
  async importICS(): Promise<ImportResult>;
  
  private async processBundle(bundle: STIXBundle): Promise<ImportResult> {
    // Process techniques, tactics, mitigations, etc.
  }
}
```

### Database Schema
```sql
-- STIX Objects Table
CREATE TABLE stix_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stix_id TEXT NOT NULL UNIQUE,
  stix_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  x_mitre_id TEXT,
  x_mitre_platforms JSONB,
  raw_stix JSONB NOT NULL,
  source TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Implementation Checklist
- [ ] Create STIX importer service
- [ ] Implement bundle processing
- [ ] Store techniques in database
- [ ] Store tactics, mitigations, etc.
- [ ] Handle relationships
- [ ] Add import UI
- [ ] Add update/sync functionality
- [ ] Display import progress

**[TO BE FILLED]**

### Estimated Effort
3-4 days

---

## Agent-Workbench Bridge

### Overview
Enable Operation Lead and Technical Writer agents to stage content in ATT&CK Workbench as collections.

### Operation Lead → Workbench Flow
**[TO BE FILLED]**

```typescript
// When Op Lead creates execution plan
async function stageExecutionPlan(
  agentId: string,
  operationId: string,
  plan: ExecutionPlan
): Promise<Collection> {
  // 1. Agent selects techniques
  // 2. Agent creates attack flow
  // 3. Stage as collection in workbench
  // 4. Return collection ID
}
```

### Technical Writer → Workbench Flow
**[TO BE FILLED]**

```typescript
// When Technical Writer documents findings
async function stageFindings(
  agentId: string,
  operationId: string,
  findings: Finding[]
): Promise<Collection> {
  // 1. Agent analyzes exploitation results
  // 2. Map to ATT&CK objects
  // 3. Create documentation collection
  // 4. Link to report generation
}
```

### Implementation Checklist
- [ ] Create agent-workbench bridge service
- [ ] Implement Op Lead staging workflow
- [ ] Implement Technical Writer staging workflow
- [ ] Add collection approval workflow
- [ ] Create agent → planner integration
- [ ] Add notification system
- [ ] Implement execution triggers

**[TO BE FILLED]**

### Estimated Effort
3-4 days

---

## Database Schema

### Complete Schema

#### stix_objects
```sql
CREATE TABLE stix_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stix_id TEXT NOT NULL UNIQUE,
  stix_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created TIMESTAMP NOT NULL,
  modified TIMESTAMP NOT NULL,
  x_mitre_id TEXT,
  x_mitre_platforms JSONB,
  x_mitre_domains JSONB,
  x_mitre_version TEXT,
  x_mitre_deprecated BOOLEAN DEFAULT false,
  raw_stix JSONB NOT NULL,
  source TEXT,
  imported_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

#### stix_collections
**[TO BE FILLED]**

#### stix_collection_contents
**[TO BE FILLED]**

#### attck_technique_mapping
**[TO BE FILLED]**

### Migration Files
- **File:** `migrations/0007_add_attck_integration.sql`
- **[TO BE FILLED]**

---

## API Endpoints

### ATT&CK API

#### GET /api/v1/attck/techniques
**[TO BE FILLED]**

#### GET /api/v1/attck/tactics
**[TO BE FILLED]**

#### POST /api/v1/attck/collections
**[TO BE FILLED]**

#### POST /api/v1/attck/send-to-operation-lead
**[TO BE FILLED]**

#### GET /api/v1/attck/flows
**[TO BE FILLED]**

---

## Testing Requirements

### Unit Tests
- [ ] STIX data parser
- [ ] Technique selection logic
- [ ] Collection management
- [ ] Agent staging workflows

**Target Coverage:** 80%

### Integration Tests
- [ ] STIX import end-to-end
- [ ] Collection creation and management
- [ ] Agent-workbench bridge
- [ ] "Send to Operation Lead" workflow

**Target Coverage:** 70%

### E2E Tests
- [ ] Complete planning workflow
- [ ] Agent staging workflow
- [ ] Collection approval and execution
- [ ] Export/import operations

**Target Coverage:** 60%

---

## Implementation Timeline

### Phase 1: Foundation (Week 3, Days 15-17)
- [ ] Database schema and migrations
- [ ] STIX data import
- [ ] Basic page structure
- [ ] Navigator tab

### Phase 2: Planning (Week 3, Days 18-20)
- [ ] Planner tab
- [ ] "Send to Operation Lead" workflow
- [ ] Agent-workbench bridge

### Phase 3: Workbench (Week 4, Days 21-23)
- [ ] Workbench tab
- [ ] Collections management
- [ ] Approval workflows

### Phase 4: Advanced (Week 4, Days 24-26)
- [ ] Attack Flow tab
- [ ] Techniques browser
- [ ] Collections tab

### Phase 5: Polish (Week 4, Days 27-30)
- [ ] Testing and bug fixes
- [ ] Documentation
- [ ] Performance optimization
- [ ] UI polish

---

## Dependencies

### External Dependencies
- ATT&CK Workbench (https://github.com/center-for-threat-informed-defense/attack-workbench-frontend)
- ATT&CK STIX Data (https://github.com/mitre-attack/attack-stix-data)
- Attack Flow (https://github.com/center-for-threat-informed-defense/attack-flow)

### Internal Dependencies
- Operation Lead Agent implementation
- Technical Writer Agent implementation
- Agent workflow orchestrator

### Library Dependencies
- STIX parsing library
- D3.js or similar for flow visualization
- React Flow or similar for node-based editor

---

## Success Metrics

### Functional Requirements
- [ ] All 6 tabs operational
- [ ] STIX data imported successfully
- [ ] Agents can stage to Workbench
- [ ] "Send to Operation Lead" workflow working
- [ ] Collections system functional

### Performance Requirements
- [ ] Matrix loads in <1 second
- [ ] Technique search <200ms
- [ ] Collection operations <500ms
- [ ] Flow rendering <1 second

### User Experience
- [ ] Intuitive technique selection
- [ ] Clear workflow from planning to execution
- [ ] Helpful guidance and tooltips
- [ ] Responsive design

---

## Related Documentation
- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent document
- [01-CRITICAL-BUGS.md](01-CRITICAL-BUGS.md) - Critical bugs
- [02-SURFACE-ASSESSMENT.md](02-SURFACE-ASSESSMENT.md) - Surface Assessment
- [ATT&CK Workbench Docs](https://github.com/center-for-threat-informed-defense/attack-workbench-frontend/blob/main/docs/collections.md)

---

**Status Legend:**
- 🔴 Blocking - Must be completed first
- 🟡 High Priority - Important for beta
- 🟢 Medium Priority - Nice to have
- ✅ Complete
- 🚧 In Progress
- ⏸️ Blocked

---

**Last Updated:** December 4, 2025  
**Maintained By:** RTPI Development Team
