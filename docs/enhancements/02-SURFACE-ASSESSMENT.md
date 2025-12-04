# Surface Assessment Page - Tier 2 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🟡 Tier 2 - Beta Enhancement  
**Timeline:** Week 3-4 (Days 15-30)  
**Total Items:** 35  
**Last Updated:** December 4, 2025

---

## Overview

This document details the Surface Assessment page - a comprehensive attack surface management dashboard inspired by [Faraday](https://docs.faradaysec.com/). This feature provides centralized visibility into all discovered assets, services, and vulnerabilities with rich data visualization.

### Purpose
- **Centralize attack surface data** from multiple scanning tools
- **Visualize security posture** with interactive charts and graphs
- **Enable data-driven decisions** through comprehensive metrics
- **Streamline workflow** from discovery to remediation

### Success Criteria
- ✅ Dashboard displays all scan data in real-time
- ✅ Integration with Ax framework tools working
- ✅ Data visualizations render correctly
- ✅ Click-through to vulnerability details functional
- ✅ GitHub Actions automation operational

---

## Table of Contents

1. [Page Structure & Navigation](#page-structure--navigation)
2. [Tab 1: Overview Dashboard](#tab-1-overview-dashboard)
3. [Tab 2: Vulnerabilities View](#tab-2-vulnerabilities-view)
4. [Tab 3: Assets View](#tab-3-assets-view)
5. [Tab 4: Services View](#tab-4-services-view)
6. [Tab 5: Activity Timeline](#tab-5-activity-timeline)
7. [Tab 6: Scan Configuration](#tab-6-scan-configuration)
8. [Ax Framework Integration](#ax-framework-integration)
9. [Data Visualization Components](#data-visualization-components)
10. [GitHub Actions Automation](#github-actions-automation)
11. [Database Schema](#database-schema)
12. [API Endpoints](#api-endpoints)
13. [Testing Requirements](#testing-requirements)

---

## Page Structure & Navigation

### Location
- **Route:** `/surface-assessment`
- **Navigation:** Main sidebar → Surface Assessment (new entry)
- **Icon:** 📈 or 🔍
- **Access:** Requires authentication, Operator or Admin role

### Page Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Surface Assessment - [Operation Name]                           │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Vulnerabilities] [Assets] [Services] [Activity]     │
│ [Scan Config]                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                     [TAB CONTENT AREA]                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create new route `/surface-assessment`
- [ ] Add navigation entry to sidebar
- [ ] Create `SurfaceAssessment.tsx` page component
- [ ] Implement tab navigation system
- [ ] Add operation selector dropdown
- [ ] Set up real-time data refresh

**[TO BE FILLED WITH DETAILED IMPLEMENTATION]**

---

## Tab 1: Overview Dashboard

### Status: 🟡 High Priority

### Description
The Overview tab provides a high-level summary of the attack surface with key metrics, charts, and recent activity.

### Layout Design
```
┌─────────────────────────────────────────────────────────────────┐
│ Overview Tab                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Summary     │  │  Vulns by    │  │  Vulns by    │          │
│  │  Stats       │  │  Severity    │  │  Status      │          │
│  │              │  │              │  │              │          │
│  │ Hosts: 15    │  │ 🔴 Crit: 2   │  │  ┌───────┐   │          │
│  │ Services: 42 │  │ 🟠 High: 5   │  │  │ Open  │   │          │
│  │ Vulns: 28    │  │ 🟡 Med: 12   │  │  │  75%  │   │          │
│  │ Web: 12      │  │ 🟢 Low: 9    │  │  └───────┘   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │   Most Vulnerable        │  │      Top Services        │    │
│  │   Assets                 │  │                          │    │
│  │                          │  │                          │    │
│  │  192.168.1.10    8 vulns │  │  HTTPS         12 hosts  │    │
│  │  app.example.com 6 vulns │  │  SSH            8 hosts  │    │
│  │  [View All →]            │  │  [View All →]            │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    Activity Feed                        │    │
│  │  ───────────────────────────────────────────────────── │    │
│  │  🔍 Dec 4, 5:30am  BBOT scan completed - 42 hosts     │    │
│  │  ⚠️  Dec 4, 5:25am  New critical vuln found           │    │
│  │  [View All Activity →]                                 │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Components Required
**[TO BE FILLED]**

#### 1. Summary Statistics Card
- Total hosts discovered
- Total services enumerated
- Total vulnerabilities
- Web-specific vulnerabilities
- Last scan timestamp

#### 2. Severity Distribution Chart (Pie/Donut)
- Critical vulnerabilities
- High vulnerabilities
- Medium vulnerabilities
- Low vulnerabilities
- Informational findings

#### 3. Status Distribution Chart (Donut)
- Open vulnerabilities
- In Progress
- Fixed
- False Positive
- Accepted Risk

#### 4. Top Vulnerable Assets Table
- Asset name/IP
- Vulnerability count
- Severity breakdown
- Last scanned
- Click to filter vulnerabilities

#### 5. Top Services Table
- Service name
- Port
- Host count
- Version information
- Click to view affected hosts

#### 6. Activity Feed
- Recent scan completions
- New vulnerabilities discovered
- Status changes
- User actions

### Data Sources
- `surface_assessments` table
- `discovered_assets` table
- `discovered_services` table
- `vulnerabilities` table
- `ax_scan_results` table

### Implementation Checklist
- [ ] Create OverviewTab component
- [ ] Implement summary statistics API
- [ ] Add severity distribution chart (recharts/chart.js)
- [ ] Add status distribution chart
- [ ] Create vulnerable assets table
- [ ] Create top services table
- [ ] Implement activity feed
- [ ] Add real-time updates via WebSocket
- [ ] Implement export functionality

### Estimated Effort
3-4 days

---

## Tab 2: Vulnerabilities View

### Status: 🟡 High Priority

### Description
Comprehensive vulnerability listing with advanced filtering, sorting, and bulk operations.

### Features
**[TO BE FILLED]**

### Layout Design
```
┌─────────────────────────────────────────────────────────────────┐
│ Vulnerabilities Tab                                              │
├─────────────────────────────────────────────────────────────────┤
│ Filters: [Severity ▼] [Status ▼] [Asset ▼] [Search...]         │
│                                                      [Export]     │
├─────────────────────────────────────────────────────────────────┤
│ ☐ Title              Severity    Asset          Status    Age    │
│ ─────────────────────────────────────────────────────────────── │
│ ☐ SQL Injection      🔴 Critical  web-01         Open      2d    │
│ ☐ XSS Reflected      🟠 High      app.example    Open      5d    │
│ ☐ Outdated SSL       🟡 Medium    192.168.1.10   In Prog   1w    │
│                                                                  │
│ [Select All] [Bulk Actions ▼]                    [1-20 of 156]  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create VulnerabilitiesTab component
- [ ] Implement advanced filtering
- [ ] Add sortable table columns
- [ ] Add bulk selection functionality
- [ ] Implement bulk actions (status change, export)
- [ ] Add click-through to vulnerability details
- [ ] Add pagination
- [ ] Implement search functionality

### Estimated Effort
2-3 days

---

## Tab 3: Assets View

### Status: 🟡 Medium Priority

### Description
Complete inventory of discovered assets with service enumeration and vulnerability mapping.

### Features
**[TO BE FILLED]**

### Implementation Checklist
- [ ] Create AssetsTab component
- [ ] Implement asset listing
- [ ] Add service enumeration display
- [ ] Add vulnerability count per asset
- [ ] Implement asset grouping/tagging
- [ ] Add network topology visualization (future)

### Estimated Effort
2-3 days

---

## Tab 4: Services View

### Status: 🟡 Medium Priority

### Description
Service-centric view showing all discovered services, versions, and affected hosts.

### Features
**[TO BE FILLED]**

### Implementation Checklist
- [ ] Create ServicesTab component
- [ ] Implement service listing grouped by type
- [ ] Add port distribution visualization
- [ ] Show service versions
- [ ] Link to affected hosts
- [ ] Display service-specific vulnerabilities

### Estimated Effort
2 days

---

## Tab 5: Activity Timeline

### Status: 🟢 Medium Priority

### Description
Comprehensive activity log with filtering and search capabilities.

### Features
**[TO BE FILLED]**

### Implementation Checklist
- [ ] Create ActivityTab component
- [ ] Implement timeline visualization
- [ ] Add event filtering
- [ ] Add search functionality
- [ ] Implement export to CSV

### Estimated Effort
2 days

---

## Tab 6: Scan Configuration

### Status: 🟡 Medium Priority

### Description
Configure and manage automated scanning tools, schedules, and targets.

### Features
**[TO BE FILLED]**

### Implementation Checklist
- [ ] Create ScanConfigTab component
- [ ] Display configured Ax modules
- [ ] Add scan scheduling UI
- [ ] Show GitHub Actions status
- [ ] Display scan history
- [ ] Add tool credentials management

### Estimated Effort
2-3 days

---

## Ax Framework Integration

### Overview
[Ax (Attack Surface)](https://ax.attacksurge.com/) is an attack surface management framework that orchestrates various security tools.

### Supported Tools

#### 1. BBOT (Reconnaissance)
**Repository:** https://github.com/blacklanternsecurity/bbot  
**Purpose:** OSINT, subdomain enumeration, web crawling  
**[TO BE FILLED]**

#### 2. BBOT-MCP (AI-Assisted Recon)
**Repository:** https://github.com/marlinkcyber/bbot-mcp  
**Purpose:** BBOT with MCP integration  
**[TO BE FILLED]**

#### 3. XSStrike (Web Vulnerability Scanner)
**Repository:** https://github.com/s0md3v/XSStrike  
**Purpose:** XSS vulnerability detection  
**[TO BE FILLED]**

#### 4. Bugzee (Bug Bounty Automation)
**Repository:** https://github.com/SecFathy/Bugzee  
**Purpose:** Automated vulnerability scanning  
**[TO BE FILLED]**

#### 5. Nuclei (Template Engine)
**Purpose:** Fast vulnerability scanning with templates  
**[TO BE FILLED]**

### Ax Module Configuration
**[TO BE FILLED]**

### Implementation Checklist
- [ ] Create Ax executor service
- [ ] Implement BBOT integration
- [ ] Implement XSStrike integration
- [ ] Implement Bugzee integration
- [ ] Implement Nuclei integration
- [ ] Create unified output parser
- [ ] Add module configuration UI
- [ ] Implement result aggregation

### Estimated Effort
1-2 weeks

---

## Data Visualization Components

### Required Charts

#### 1. Severity Distribution (Pie/Donut Chart)
**Library:** Recharts or Chart.js  
**[TO BE FILLED]**

#### 2. Vulnerability Timeline (Line Chart)
**[TO BE FILLED]**

#### 3. Asset Treemap
**[TO BE FILLED]**

#### 4. Service Distribution (Bar Chart)
**[TO BE FILLED]**

#### 5. Network Topology (Future)
**[TO BE FILLED]**

### Implementation Checklist
- [ ] Select charting library (recharts recommended)
- [ ] Create chart wrapper components
- [ ] Implement severity pie chart
- [ ] Implement timeline chart
- [ ] Implement treemap visualization
- [ ] Implement bar charts
- [ ] Add export to image functionality
- [ ] Ensure responsive design

### Estimated Effort
3-4 days

---

## GitHub Actions Automation

### Purpose
Automate scanning using GitHub Actions CI/CD pipeline inspired by [CIScanner](https://github.com/SecFathy/CIScanner).

### Workflow Structure
**[TO BE FILLED]**

```yaml
# .github/workflows/surface-scan.yml
name: Automated Surface Scan

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  workflow_dispatch:
    inputs:
      target:
        description: 'Target to scan'
        required: true

jobs:
  recon:
    runs-on: ubuntu-latest
    steps:
      # [TO BE FILLED]
```

### Implementation Checklist
- [ ] Create GitHub Actions workflow template
- [ ] Implement BBOT scan job
- [ ] Implement vulnerability scan job
- [ ] Add result upload to RTPI
- [ ] Create webhook receiver in RTPI
- [ ] Add manual trigger UI
- [ ] Implement scan scheduling
- [ ] Add GitHub Actions status display

### Estimated Effort
2-3 days

---

## Database Schema

### New Tables Required

#### surface_assessments
```sql
CREATE TABLE surface_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  stats JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### discovered_assets
**[TO BE FILLED]**

#### discovered_services
**[TO BE FILLED]**

#### ax_scan_results
**[TO BE FILLED]**

### Migration File
**File:** `migrations/0006_add_surface_assessment.sql`  
**[TO BE FILLED]**

---

## API Endpoints

### Surface Assessment API

#### GET /api/v1/surface-assessment/overview
**[TO BE FILLED]**

#### GET /api/v1/surface-assessment/vulnerabilities
**[TO BE FILLED]**

#### GET /api/v1/surface-assessment/assets
**[TO BE FILLED]**

#### POST /api/v1/surface-assessment/scan
**[TO BE FILLED]**

#### POST /api/v1/surface-assessment/webhook
**[TO BE FILLED]**

---

## Testing Requirements

### Unit Tests
- [ ] Surface assessment service functions
- [ ] Ax module executors
- [ ] Output parsers
- [ ] Chart data transformations

**Target Coverage:** 80%

### Integration Tests
- [ ] Ax tool execution end-to-end
- [ ] Result aggregation pipeline
- [ ] API endpoints
- [ ] Database operations

**Target Coverage:** 70%

### E2E Tests
- [ ] Complete scan workflow
- [ ] Dashboard rendering
- [ ] Filter and search functionality
- [ ] Export operations

**Target Coverage:** 60%

---

## Implementation Timeline

### Phase 1: Foundation (Week 3, Days 15-18)
- [ ] Database schema and migrations
- [ ] Basic page structure and navigation
- [ ] Overview tab with static data
- [ ] API endpoints

### Phase 2: Ax Integration (Week 3, Days 19-21)
- [ ] Ax executor service
- [ ] BBOT integration
- [ ] XSStrike integration
- [ ] Output parsing

### Phase 3: Visualization (Week 4, Days 22-25)
- [ ] Chart components
- [ ] Vulnerabilities tab
- [ ] Assets tab
- [ ] Services tab

### Phase 4: Automation (Week 4, Days 26-28)
- [ ] GitHub Actions workflows
- [ ] Webhook receiver
- [ ] Scan scheduling UI

### Phase 5: Polish (Week 4, Days 29-30)
- [ ] Activity timeline
- [ ] Testing and bug fixes
- [ ] Documentation
- [ ] Performance optimization

---

## Dependencies

### External Dependencies
- Ax framework (https://ax.attacksurge.com/)
- BBOT (https://github.com/blacklanternsecurity/bbot)
- XSStrike (https://github.com/s0md3v/XSStrike)
- Bugzee (https://github.com/SecFathy/Bugzee)
- Nuclei (nuclei-templates)

### Internal Dependencies
- Nmap scanning fixes (Bug #3 from Critical Bugs)
- Scan history system

### Library Dependencies
- recharts or chart.js for visualizations
- date-fns for date formatting
- lodash for data transformations

---

## Success Metrics

### Functional Requirements
- [ ] All 6 tabs operational
- [ ] Real-time data updates working
- [ ] Ax framework tools integrated (min 3/5)
- [ ] Data visualizations rendering correctly
- [ ] Export functionality working

### Performance Requirements
- [ ] Dashboard loads in <2 seconds
- [ ] Chart rendering <500ms
- [ ] API responses <1 second
- [ ] Handles 1000+ vulnerabilities

### User Experience
- [ ] Intuitive navigation
- [ ] Clear data presentation
- [ ] Responsive on tablet/desktop
- [ ] Helpful tooltips and guidance

---

## Related Documentation
- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent document
- [01-CRITICAL-BUGS.md](01-CRITICAL-BUGS.md) - Critical bugs
- [Faraday Documentation](https://docs.faradaysec.com/) - Inspiration
- [Ax Documentation](https://ax.attacksurge.com/) - Framework docs

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
