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

### Detailed Implementation Steps

#### 1. Create Route in Client Router
**File:** `client/src/main.tsx` or router configuration
```tsx
<Route path="/surface-assessment" component={SurfaceAssessment} />
```

#### 2. Add Sidebar Navigation Entry
**File:** `client/src/components/layout/Sidebar.tsx`
```tsx
{
  name: "Surface Assessment",
  path: "/surface-assessment",
  icon: BarChart3, // from lucide-react
  roles: ["admin", "operator"]
}
```

#### 3. Create Main Page Component
**File:** `client/src/pages/SurfaceAssessment.tsx`
```tsx
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import OverviewTab from "@/components/surface-assessment/OverviewTab";
import VulnerabilitiesTab from "@/components/surface-assessment/VulnerabilitiesTab";
import AssetsTab from "@/components/surface-assessment/AssetsTab";
import ServicesTab from "@/components/surface-assessment/ServicesTab";
import ActivityTab from "@/components/surface-assessment/ActivityTab";
import ScanConfigTab from "@/components/surface-assessment/ScanConfigTab";

export default function SurfaceAssessment() {
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      const res = await api.get<{ operations: any[] }>("/operations");
      setOperations(res.operations);
      if (res.operations.length > 0) {
        setSelectedOperation(res.operations[0].id);
      }
    } catch (error) {
      console.error("Failed to load operations:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Surface Assessment</h1>
        <Select value={selectedOperation} onValueChange={setSelectedOperation}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select operation" />
          </SelectTrigger>
          <SelectContent>
            {operations.map((op) => (
              <SelectItem key={op.id} value={op.id}>
                {op.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="config">Scan Config</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab operationId={selectedOperation} />
        </TabsContent>
        <TabsContent value="vulnerabilities">
          <VulnerabilitiesTab operationId={selectedOperation} />
        </TabsContent>
        <TabsContent value="assets">
          <AssetsTab operationId={selectedOperation} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesTab operationId={selectedOperation} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab operationId={selectedOperation} />
        </TabsContent>
        <TabsContent value="config">
          <ScanConfigTab operationId={selectedOperation} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 4. Real-time Data Updates
Implement WebSocket connection for live updates:
```tsx
useEffect(() => {
  if (!selectedOperation) return;
  
  const ws = new WebSocket(`${WS_URL}/surface-assessment/${selectedOperation}`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Update state based on message type
    handleRealtimeUpdate(data);
  };
  
  return () => ws.close();
}, [selectedOperation]);
```

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

#### 1. Summary Statistics Card
**File:** `client/src/components/surface-assessment/SummaryStatsCard.tsx`

**Props:**
```tsx
interface SummaryStatsCardProps {
  stats: {
    totalHosts: number;
    totalServices: number;
    totalVulnerabilities: number;
    webVulnerabilities: number;
    lastScanTimestamp: string;
  };
}
```

**Features:**
- Display numeric metrics with icons
- Show percentage changes from previous scan
- Color-coded indicators (green for good, red for issues)
- Click to expand detailed breakdown
- Animated number transitions

**Implementation Pattern:**
```tsx
export default function SummaryStatsCard({ stats }: SummaryStatsCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Summary Statistics</h3>
      <div className="space-y-3">
        <StatRow icon={Server} label="Total Hosts" value={stats.totalHosts} />
        <StatRow icon={Network} label="Services" value={stats.totalServices} />
        <StatRow icon={AlertTriangle} label="Vulnerabilities" value={stats.totalVulnerabilities} />
        <StatRow icon={Globe} label="Web Vulns" value={stats.webVulnerabilities} />
      </div>
      <p className="text-sm text-gray-500 mt-4">
        Last scan: {formatDistanceToNow(new Date(stats.lastScanTimestamp))} ago
      </p>
    </div>
  );
}
```

#### 2. Severity Distribution Chart (Pie/Donut)
**File:** `client/src/components/surface-assessment/SeverityChart.tsx`

**Library:** Recharts
**Props:**
```tsx
interface SeverityChartProps {
  data: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
}
```

**Implementation:**
```tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = {
  critical: '#dc2626',    // red-600
  high: '#ea580c',        // orange-600
  medium: '#ca8a04',      // yellow-600
  low: '#16a34a',         // green-600
  informational: '#0284c7' // sky-600
};

export default function SeverityChart({ data }: SeverityChartProps) {
  const chartData = [
    { name: 'Critical', value: data.critical, color: COLORS.critical },
    { name: 'High', value: data.high, color: COLORS.high },
    { name: 'Medium', value: data.medium, color: COLORS.medium },
    { name: 'Low', value: data.low, color: COLORS.low },
    { name: 'Info', value: data.informational, color: COLORS.informational },
  ].filter(item => item.value > 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Vulnerabilities by Severity</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

#### 3. Status Distribution Chart (Donut)
**File:** `client/src/components/surface-assessment/StatusChart.tsx`

**Features:**
- Interactive segments (click to filter)
- Percentage display in center
- Color-coded by status (open=red, in_progress=yellow, fixed=green)
- Animated transitions

**Data Structure:**
```tsx
interface StatusChartProps {
  data: {
    open: number;
    in_progress: number;
    fixed: number;
    false_positive: number;
    accepted_risk: number;
  };
  onStatusClick?: (status: string) => void;
}
```

#### 4. Top Vulnerable Assets Table
**File:** `client/src/components/surface-assessment/TopVulnerableAssetsTable.tsx`

**Columns:**
- Asset name/IP (clickable to asset detail)
- Total vulnerability count (with severity badges)
- Critical count (red badge)
- High count (orange badge)
- Last scanned timestamp
- Quick action buttons (rescan, view details)

**Features:**
- Sortable by vulnerability count
- Limited to top 10 by default
- "View All" button to open full assets tab
- Hover tooltips with severity breakdown

#### 5. Top Services Table
**File:** `client/src/components/surface-assessment/TopServicesTable.tsx`

**Columns:**
- Service name (HTTP, SSH, FTP, etc.)
- Port number
- Host count
- Common version (if consistent across hosts)
- Known vulnerabilities count
- Click to view affected hosts

**Implementation Pattern:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Service</TableHead>
      <TableHead>Port</TableHead>
      <TableHead>Hosts</TableHead>
      <TableHead>Version</TableHead>
      <TableHead>Vulns</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {services.map((service) => (
      <TableRow 
        key={service.id} 
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => handleServiceClick(service)}
      >
        <TableCell className="font-medium">{service.name}</TableCell>
        <TableCell>{service.port}</TableCell>
        <TableCell>{service.hostCount}</TableCell>
        <TableCell className="text-sm text-gray-600">{service.version}</TableCell>
        <TableCell>
          {service.vulnCount > 0 && (
            <Badge variant="destructive">{service.vulnCount}</Badge>
          )}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

#### 6. Activity Feed
**File:** `client/src/components/surface-assessment/ActivityFeed.tsx`

**Features:**
- Real-time updates via WebSocket
- Event type icons (scan, vulnerability, user action)
- Timestamp with relative time
- Filterable by event type
- Expandable event details
- Auto-scroll to new items

**Event Types:**
```tsx
type ActivityEvent = {
  id: string;
  type: 'scan_started' | 'scan_completed' | 'vuln_discovered' | 'vuln_status_changed' | 'user_action';
  timestamp: string;
  title: string;
  description: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  userId?: string;
  metadata?: Record<string, any>;
};
```

**Display Pattern:**
```tsx
<div className="space-y-3">
  {activities.map((activity) => (
    <div key={activity.id} className="flex items-start gap-3 p-3 border-l-2 border-blue-500">
      <ActivityIcon type={activity.type} />
      <div className="flex-1">
        <p className="font-medium">{activity.title}</p>
        <p className="text-sm text-gray-600">{activity.description}</p>
        <p className="text-xs text-gray-400 mt-1">
          {formatDistanceToNow(new Date(activity.timestamp))} ago
        </p>
      </div>
    </div>
  ))}
</div>
```
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

1. **Advanced Filtering System**
   - Multi-select severity filter (Critical, High, Medium, Low, Info)
   - Status filter (Open, In Progress, Fixed, False Positive, Accepted Risk)
   - Asset/Target filter (dropdown of all discovered assets)
   - Free-text search across title, description, CVE-ID
   - Date range filter (discovered date)
   - Combined filter logic (AND operation)

2. **Sortable Columns**
   - Sort by severity (critical → low)
   - Sort by discovery date (newest/oldest)
   - Sort by asset name (alphabetical)
   - Sort by status
   - Maintain sort state in URL params

3. **Bulk Operations**
   - Select all/none functionality
   - Select filtered results
   - Bulk status change (Open → In Progress, etc.)
   - Bulk assignment to users
   - Bulk export (CSV, JSON, Markdown)
   - Bulk delete (admin only)
   - Confirmation dialog for destructive actions

4. **Inline Actions**
   - Quick status change dropdown
   - Copy vulnerability ID
   - Share link to vulnerability
   - Duplicate vulnerability
   - Delete individual vulnerability

5. **Pagination**
   - Configurable page size (20, 50, 100, 200)
   - Page number navigation
   - Jump to page input
   - Total count display
   - "Load more" option for infinite scroll

6. **Export Functionality**
   - Export filtered results
   - CSV format (for spreadsheets)
   - JSON format (for API integration)
   - Markdown format (for reports)
   - Include/exclude certain fields option

7. **Detail View Integration**
   - Click row to open vulnerability detail modal
   - Navigate to dedicated vulnerability page
   - Edit inline (for quick updates)
   - Preview proof-of-concept in modal

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

1. **Asset Discovery Display**
   - List all discovered hosts/IPs
   - Display asset type (host, domain, IP, network)
   - Show discovery method (BBOT, Nmap, manual)
   - Discovery timestamp
   - Asset status (active, down, unreachable)
   - Operating system detection (from Nmap)
   - Hostname resolution

2. **Service Enumeration per Asset**
   - Expandable row showing all services
   - Service name, port, protocol
   - Service version information
   - Service banner (if captured)
   - Service state (open, filtered, closed)
   - Link to service-specific vulnerabilities

3. **Vulnerability Mapping**
   - Vulnerability count badge per asset
   - Severity breakdown (Critical/High/Medium/Low)
   - Click to filter vulnerabilities by asset
   - Quick view of top 3 vulnerabilities
   - Link to full vulnerability list

4. **Asset Grouping & Organization**
   - Group by network segment
   - Group by asset type
   - Group by criticality/priority
   - Custom tagging system
   - Color-coded categories

5. **Asset Metadata**
   - Custom labels/tags
   - Notes field
   - Owner/responsible team
   - Business criticality level
   - Compliance requirements
   - Last scan timestamp

6. **Network Topology View (Future Phase)**
   - Visual network map
   - Asset relationships
   - Network segmentation display
   - Interactive zoom/pan
   - Export as image

7. **Asset Actions**
   - Rescan individual asset
   - Edit asset details
   - Add to scan target
   - Mark as false positive
   - Archive/delete asset

8. **Search & Filter**
   - Search by IP, hostname, or tag
   - Filter by discovery source
   - Filter by vulnerability count
   - Filter by last scan date
   - Filter by asset status

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

1. **Service Catalog**
   - Complete list of all discovered services
   - Group by service type (HTTP, SSH, FTP, SMTP, etc.)
   - Total count per service type
   - Protocol information (TCP/UDP)
   - Standard vs non-standard ports

2. **Port Distribution**
   - Visual chart of common ports
   - Highlight unusual ports
   - Port range analysis (well-known, registered, dynamic)
   - Protocol distribution (TCP vs UDP)

3. **Version Analysis**
   - Service version information
   - Group hosts by same version
   - Identify outdated versions
   - Link to CVE database for known vulnerabilities
   - Version compatibility matrix

4. **Affected Hosts List**
   - For each service, show all hosts running it
   - Host count metric
   - Click to view host details
   - Export hosts list
   - Bulk action on hosts

5. **Service-Specific Vulnerabilities**
   - Known vulnerabilities for each service/version
   - CVE listings with CVSS scores
   - Exploitability indicators
   - Remediation guidance
   - Patch availability status

6. **Service Configuration**
   - Detected misconfigurations
   - Security headers analysis (for web services)
   - SSL/TLS configuration (for encrypted services)
   - Authentication methods detected
   - Default credentials warnings

7. **Service Health & Availability**
   - Service uptime/downtime tracking
   - Response time metrics
   - Service availability percentage
   - Recent status changes

8. **Service Search & Filtering**
   - Filter by service name
   - Filter by port number/range
   - Filter by version
   - Filter by vulnerability count
   - Search by banner text

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

1. **Comprehensive Activity Log**
   - All surface assessment events
   - Scan start/completion events
   - New asset discoveries
   - New vulnerability findings
   - Status change events
   - User actions (manual edits, assignments)
   - System events (scheduled scans, errors)

2. **Event Types & Categories**
   - **Scan Events:** Started, Completed, Failed, Cancelled
   - **Discovery Events:** New Asset, New Service, Updated Service
   - **Vulnerability Events:** Discovered, Status Changed, Assigned, Resolved
   - **User Events:** Manual Scan, Configuration Change, Export
   - **System Events:** Scheduled Task, Error, Warning

3. **Timeline Visualization**
   - Chronological event list (newest first)
   - Visual timeline with event markers
   - Color-coded by event type
   - Expandable event details
   - Event grouping by time period (Today, Yesterday, This Week, etc.)

4. **Event Details**
   - Event timestamp (absolute and relative)
   - Event type icon and label
   - Event description
   - User who triggered (if applicable)
   - Related entities (asset, vulnerability, scan)
   - Event metadata (duration, results count, error details)

5. **Filtering & Search**
   - Filter by event type
   - Filter by date range (custom picker)
   - Filter by user
   - Filter by related entity (specific asset/vulnerability)
   - Free-text search in event descriptions
   - Severity filter (for vulnerability events)

6. **Event Navigation**
   - Click event to navigate to related entity
   - Quick action buttons (view asset, view vulnerability)
   - Context menu for additional actions
   - Copy event details
   - Share event link

7. **Export & Reporting**
   - Export activity log to CSV
   - Export filtered results
   - Generate activity report (for compliance)
   - Include/exclude event types in export

8. **Real-time Updates**
   - WebSocket integration for live events
   - Auto-scroll to new events (with user control)
   - New event notification badge
   - Event animation on arrival

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

1. **Ax Module Configuration**
   - List of all available Ax modules (BBOT, XSStrike, Nuclei, etc.)
   - Enable/disable modules
   - Module status indicators (running, stopped, error)
   - Module description and capabilities
   - Configuration form per module
   - Test connection/validate setup

2. **Scan Scheduling**
   - Create scan schedules (daily, weekly, monthly, custom cron)
   - Schedule name and description
   - Target selection for scheduled scans
   - Module selection (which tools to run)
   - Time zone configuration
   - Notification settings (on completion, on error)
   - Schedule enable/disable toggle
   - Next run time display

3. **GitHub Actions Integration**
   - Display GitHub Actions workflow status
   - Show recent workflow runs
   - Trigger manual workflow run
   - Workflow run logs viewer
   - Success/failure indicators
   - Duration and cost metrics (if available)
   - Link to GitHub Actions page
   - Webhook configuration for results

4. **Scan History**
   - List of all previous scans
   - Scan type (manual vs scheduled)
   - Start/end timestamps
   - Duration
   - Results summary (assets/services/vulns found)
   - Status (completed, failed, cancelled)
   - Triggered by (user or schedule)
   - View scan results
   - Re-run scan with same parameters

5. **Tool Credentials Management**
   - Secure credential storage for external tools
   - API keys for third-party services (Shodan, VirusTotal, etc.)
   - Database credentials (if needed)
   - Cloud provider credentials (AWS, Azure, GCP)
   - Encrypted storage indication
   - Test credentials button
   - Last used timestamp

6. **Scan Target Configuration**
   - Define scan scope (IP ranges, domains, networks)
   - Include/exclude lists
   - Import targets from file
   - Target validation
   - Preview target list
   - Save target templates

7. **Notification Settings**
   - Email notifications on scan completion
   - Webhook notifications
   - Slack/Discord integration
   - Severity-based notifications (only critical findings)
   - Notification recipients
   - Custom notification templates

8. **Performance & Limits**
   - Concurrent scan limits
   - Rate limiting configuration
   - Resource allocation (CPU/memory for Docker containers)
   - Timeout settings per tool
   - Retry configuration
   - Scan throttling options

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

**Overview:**
BBOT (Bighuge BLS OSINT Tool) is a recursive internet scanner for hackers. It's designed for comprehensive reconnaissance and attack surface mapping.

**Key Features:**
- Subdomain enumeration with 50+ data sources
- Multi-threaded crawling
- Port scanning integration
- Web content discovery
- Automated asset discovery
- Output in multiple formats (JSON, CSV, TXT)

**Installation (Docker - Recommended):**
```bash
# Pull the latest Docker image
docker pull blacklanternsecurity/bbot:latest

# Or use bbot-docker.sh helper script
git clone https://github.com/blacklanternsecurity/bbot
cd bbot
./bbot-docker.sh --help
```

**Installation (Python):**
```bash
# Using pipx (recommended)
pipx install bbot

# Using pip
pip install bbot
```

**Basic Usage:**
```bash
# Subdomain enumeration
bbot -t evilcorp.com -p subdomain-enum

# Passive-only enumeration
bbot -t evilcorp.com -p subdomain-enum -rf passive

# Full scan with port scan and screenshots
bbot -t evilcorp.com -p subdomain-enum -m portscan gowitness -n my_scan -o .

# Web spider
bbot -t www.evilcorp.com -p spider -c web.spider_distance=2 web.spider_depth=2
```

**Output Formats:**
- JSON (structured event data)
- TXT (simple list format)
- CSV (spreadsheet compatible)
- Neo4j (graph database)

**RTPI Integration:**
```typescript
// File: server/services/ax-executor.ts
import { dockerExecutor } from './docker-executor';

export async function executeBBOT(target: string, options: {
  preset?: string;
  modules?: string[];
  flags?: string[];
  outputDir?: string;
}) {
  const args = ['-t', target];
  
  if (options.preset) {
    args.push('-p', options.preset);
  }
  
  if (options.modules && options.modules.length > 0) {
    args.push('-m', options.modules.join(','));
  }
  
  if (options.flags && options.flags.length > 0) {
    args.push('-f', options.flags.join(','));
  }
  
  args.push('--json');
  
  const result = await dockerExecutor.exec(
    'blacklanternsecurity/bbot:latest',
    args,
    { timeout: 1800000 } // 30 min timeout
  );
  
  return parseBBOTOutput(result.stdout);
}

function parseBBOTOutput(output: string) {
  const lines = output.split('\n').filter(line => line.trim());
  const events = lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
  
  return {
    domains: events.filter(e => e.type === 'DNS_NAME'),
    ips: events.filter(e => e.type === 'IP_ADDRESS'),
    urls: events.filter(e => e.type === 'URL'),
    technologies: events.filter(e => e.type === 'TECHNOLOGY'),
  };
}
```

**API Key Configuration:**
```yaml
# ~/.config/bbot/bbot.yml
modules:
  shodan_dns:
    api_key: your_shodan_key
  virustotal:
    api_key: your_virustotal_key
  censys:
    api_id: your_censys_id
    api_secret: your_censys_secret
```

#### 2. BBOT-MCP (AI-Assisted Recon)
**Repository:** https://github.com/marlinkcyber/bbot-mcp  
**Purpose:** BBOT with MCP integration for AI-assisted reconnaissance

**Overview:**
BBOT-MCP is a Model Context Protocol (MCP) server that enables AI assistants to run BBOT scans. It provides tools to manage and execute reconnaissance through the MCP interface.

**Key Features:**
- Module and preset management
- Scan execution and monitoring
- Real-time status tracking
- Wait & progress reporting
- Concurrent scan support
- Comprehensive dependency management

**Installation:**
```bash
# From PyPI (recommended)
pip install bbot-mcp

# From source
git clone https://github.com/marlinkcyber/bbot-mcp
cd bbot-mcp
pip install -e .

# Using uvx (no installation)
uvx bbot-mcp
```

**Available MCP Tools:**
1. `list_bbot_modules()` - List all available modules
2. `list_bbot_presets()` - List scan presets
3. `start_bbot_scan(targets, modules, presets, flags)` - Start scan
4. `get_scan_status(scan_id)` - Check scan status
5. `get_scan_results(scan_id, limit)` - Retrieve results
6. `list_active_scans()` - List running scans
7. `wait_for_scan_completion(scan_id, timeout)` - Wait for completion
8. `get_dependency_info()` - Dependency information

**RTPI Integration Pattern:**
```typescript
// File: server/services/bbot-mcp-client.ts
import { spawn } from 'child_process';

export class BBOTMCPClient {
  private process: any;
  
  async connect() {
    this.process = spawn('uvx', ['bbot-mcp']);
    // Implement MCP protocol communication
  }
  
  async startScan(targets: string[], options: {
    modules?: string;
    presets?: string;
    no_deps?: boolean;
  }) {
    const request = {
      method: 'tools/call',
      params: {
        name: 'start_bbot_scan',
        arguments: {
          targets: targets.join(','),
          modules: options.modules || '',
          presets: options.presets || 'subdomain-enum',
          no_deps: options.no_deps ?? true
        }
      }
    };
    
    return await this.sendRequest(request);
  }
  
  async waitForCompletion(scanId: string, timeout: number = 300) {
    return await this.sendRequest({
      method: 'tools/call',
      params: {
        name: 'wait_for_scan_completion',
        arguments: { scan_id: scanId, timeout }
      }
    });
  }
}
```

**MCP Configuration:**
```json
{
  "mcpServers": {
    "bbot": {
      "command": "uvx",
      "args": ["--refresh", "bbot-mcp"]
    }
  }
}
```

**Dependency Management:**
The MCP server includes sudo prevention and graceful degradation:
- `no_deps=True` by default (prevents sudo prompts)
- Environment variables block interactive input
- Automatic module exclusion for problematic dependencies
- Force configuration for continued execution

#### 3. XSStrike (Web Vulnerability Scanner)
**Repository:** https://github.com/s0md3v/XSStrike  
**Purpose:** Advanced XSS detection with intelligent payload generation

**Overview:**
XSStrike is a Cross Site Scripting detection suite with four hand-written parsers, an intelligent payload generator, a powerful fuzzing engine, and an incredibly fast crawler.

**Key Features:**
- Reflected and DOM XSS scanning
- Multi-threaded crawling
- Context analysis for payload generation
- WAF detection & evasion
- Outdated JS library scanning
- Intelligent payload generator
- HTML & JavaScript parsers
- Powerful fuzzing engine
- Blind XSS support
- Payload encoding

**Installation:**
```bash
git clone https://github.com/s0md3v/XSStrike
cd XSStrike
pip install -r requirements.txt --break-system-packages

# Usage
python xsstrike.py --help
```

**Basic Usage:**
```bash
# Basic XSS scan
python xsstrike.py -u "http://example.com/search?q=test"

# Scan with crawling
python xsstrike.py -u "http://example.com" --crawl

# Blind XSS with custom callback
python xsstrike.py -u "http://example.com/form" --blind http://yourserver.com

# Fuzzing mode
python xsstrike.py -u "http://example.com" --fuzzer

# Custom headers
python xsstrike.py -u "http://example.com" --headers "Cookie: session=abc123"
```

**Docker Integration:**
```dockerfile
# Dockerfile.xsstrike
FROM python:3.9-slim

RUN git clone https://github.com/s0md3v/XSStrike /opt/xsstrike
WORKDIR /opt/xsstrike
RUN pip install -r requirements.txt

ENTRYPOINT ["python", "xsstrike.py"]
```

**RTPI Integration:**
```typescript
// File: server/services/xsstrike-executor.ts
export async function executeXSStrike(url: string, options: {
  crawl?: boolean;
  blind?: string;
  fuzzer?: boolean;
  headers?: Record<string, string>;
}) {
  const args = ['-u', url];
  
  if (options.crawl) args.push('--crawl');
  if (options.fuzzer) args.push('--fuzzer');
  if (options.blind) args.push('--blind', options.blind);
  
  if (options.headers) {
    const headerString = Object.entries(options.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\\n');
    args.push('--headers', headerString);
  }
  
  const result = await dockerExecutor.exec(
    'rtpi-xsstrike',
    args,
    { timeout: 600000 } // 10 min timeout
  );
  
  return parseXSStrikeOutput(result.stdout);
}

function parseXSStrikeOutput(output: string) {
  const vulnerabilities: any[] = [];
  const lines = output.split('\n');
  
  // Parse XSStrike output format
  for (const line of lines) {
    if (line.includes('[+]') && line.includes('XSS')) {
      const vuln = {
        type: 'xss',
        severity: line.includes('Reflected') ? 'high' : 'medium',
        payload: extractPayload(line),
        context: extractContext(line)
      };
      vulnerabilities.push(vuln);
    }
  }
  
  return vulnerabilities;
}
```

**Output Parsing:**
XSStrike outputs findings to stdout with markers:
- `[+]` - Vulnerability found
- `[!]` - WAF detected
- `[~]` - Information
- `[-]` - Error

**Database Storage:**
Map findings to RTPI vulnerabilities table:
```typescript
const xssVulnerability = {
  title: 'Cross-Site Scripting (XSS)',
  description: `XSS vulnerability detected with payload: ${payload}`,
  severity: 'high',
  cvssScore: 7.5,
  cweId: 'CWE-79',
  proofOfConcept: payload,
  remediation: 'Implement proper input validation and output encoding',
  targetId: target.id,
  operationId: operation.id
};
```

#### 4. Bugzee (Bug Bounty Automation)
**Repository:** https://github.com/SecFathy/Bugzee  
**Purpose:** Automated installation of bug bounty hunting tools

**Overview:**
Bugzee is a simple shell script that automates the installation of recommended Bug Bounty Hunting Tools in Linux distributions. It's designed for quickly setting up a bug bounty hunting environment.

**Installed Tools:**
1. a2sv - SSL/TLS vulnerability scanner
2. masscan - Fast port scanner
3. nmap - Network exploration tool
4. Sublist3r - Subdomain enumeration
5. knock - Subdomain scanner
6. subjack - Subdomain takeover tool
7. aquatone - Visual inspection tool
8. dirsearch - Web path scanner
9. whatweb - Web technology identifier
10. wafw00f - WAF fingerprinter
11. Sqlmap - SQL injection tool
12. tplmap - Template injection scanner
13. LFISuite - LFI exploitation tool
14. RCE The Web - RCE scanner
15. WPscan - WordPress scanner
16. joomlascan - Joomla scanner
17. CMSmap - CMS scanner
18. GitTools - Git repository tool
19. Weevely - Web shell
20. ReconCat - Reconnaissance framework

**Installation:**
```bash
git clone https://github.com/SecFathy/Bugzee.git
cd Bugzee
chmod +x bugzee.sh

# Run as root
sudo ./bugzee.sh
```

**RTPI Integration Approach:**
Rather than using Bugzee directly, RTPI should containerize individual tools:

```yaml
# docker-compose.tools.yml
version: '3.8'
services:
  masscan:
    image: ilyaglow/masscan
    volumes:
      - ./scans:/scans
    
  whatweb:
    image: urbanadventurer/whatweb
    volumes:
      - ./scans:/scans
      
  wafw00f:
    build:
      context: ./dockerfiles
      dockerfile: Dockerfile.wafw00f
    volumes:
      - ./scans:/scans
```

**Tool Orchestration Service:**
```typescript
// File: server/services/bugbounty-tools.ts
export class BugBountyToolOrchestrator {
  async runMasscan(targets: string[], ports: string) {
    return await dockerExecutor.exec('ilyaglow/masscan', [
      '-p', ports,
      '--rate', '1000',
      '--output-format', 'json',
      '--output-filename', '/scans/masscan-results.json',
      ...targets
    ]);
  }
  
  async runWhatWeb(url: string) {
    return await dockerExecutor.exec('urbanadventurer/whatweb', [
      '--log-json=/scans/whatweb-results.json',
      '-a', '3', // Aggression level
      url
    ]);
  }
  
  async runWafW00f(url: string) {
    return await dockerExecutor.exec('rtpi-wafw00f', [
      url,
      '-o', '/scans/waf-results.json'
    ]);
  }
  
  async runSubdomainEnum(domain: string) {
    // Use BBOT instead (more modern)
    return await executeBBOT(domain, {
      preset: 'subdomain-enum',
      modules: ['sublist3r', 'subfinder', 'amass']
    });
  }
}
```

**Best Practices:**
Instead of installing all tools via Bugzee, RTPI should:
1. Use containerized versions of each tool
2. Implement tool-specific modules
3. Leverage existing solutions (BBOT for recon, Nuclei for scanning)
4. Maintain isolated environments per tool
5. Implement proper result parsing and storage

**Note:** Bugzee itself is primarily an installation helper. For production RTPI deployment, individual tool integration with proper containerization is recommended.

#### 5. Nuclei (Template Engine)
**Repository:** https://github.com/projectdiscovery/nuclei  
**Purpose:** Fast, customizable vulnerability scanner powered by YAML templates

**Overview:**
Nuclei is a modern, high-performance vulnerability scanner that leverages simple YAML-based templates. It empowers custom vulnerability detection that mimics real-world conditions, leading to zero false positives.

**Key Features:**
- Simple YAML format for templates
- 6,000+ community-contributed templates
- Multiple protocol support (HTTP, DNS, TCP, SSL, JavaScript, Code)
- Ultra-fast parallel scanning
- CI/CD integration ready
- Integrations with Jira, Splunk, GitHub, Elastic, GitLab
- Template validation and signing
- Cloud scanning capabilities

**Installation:**
```bash
# Go installation
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# Binary download
wget https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip
unzip nuclei_linux_amd64.zip

# Docker
docker pull projectdiscovery/nuclei:latest

# Update templates
nuclei -update-templates
```

**Basic Usage:**
```bash
# Single target scan
nuclei -u https://example.com

# Multiple targets
nuclei -list urls.txt

# Specific templates
nuclei -u https://example.com -t cves/ -t vulnerabilities/

# Severity-based filtering
nuclei -u https://example.com -severity critical,high

# Output to file
nuclei -u https://example.com -json-export results.json

# With specific tags
nuclei -u https://example.com -tags cve,sqli,xss

# Network scanning
nuclei -target 192.168.1.0/24

# With rate limiting
nuclei -u https://example.com -rate-limit 50 -bulk-size 25
```

**Docker Integration:**
```bash
# Run with Docker
docker run -it projectdiscovery/nuclei:latest -u https://example.com

# Mount custom templates
docker run -it \
  -v $(pwd)/custom-templates:/templates \
  projectdiscovery/nuclei:latest \
  -u https://example.com -t /templates
```

**RTPI Integration:**
```typescript
// File: server/services/nuclei-executor.ts
export async function executeNuclei(targets: string[], options: {
  templates?: string[];
  severity?: string[];
  tags?: string[];
  rateLimit?: number;
  timeout?: number;
}) {
  const args = [];
  
  // Add targets
  if (targets.length === 1) {
    args.push('-u', targets[0]);
  } else {
    // Write targets to temp file
    const targetFile = await writeTempFile(targets.join('\n'));
    args.push('-list', targetFile);
  }
  
  // Add template filters
  if (options.templates && options.templates.length > 0) {
    args.push('-t', options.templates.join(','));
  }
  
  if (options.severity && options.severity.length > 0) {
    args.push('-severity', options.severity.join(','));
  }
  
  if (options.tags && options.tags.length > 0) {
    args.push('-tags', options.tags.join(','));
  }
  
  // Rate limiting
  if (options.rateLimit) {
    args.push('-rate-limit', options.rateLimit.toString());
  }
  
  // JSON output
  args.push('-json');
  
  const result = await dockerExecutor.exec(
    'projectdiscovery/nuclei:latest',
    args,
    { timeout: options.timeout || 1800000 }
  );
  
  return parseNucleiOutput(result.stdout);
}

function parseNucleiOutput(output: string) {
  const lines = output.split('\n').filter(line => line.trim());
  const findings: any[] = [];
  
  for (const line of lines) {
    try {
      const finding = JSON.parse(line);
      findings.push({
        templateId: finding['template-id'],
        name: finding.info.name,
        severity: finding.info.severity,
        description: finding.info.description,
        cvss: finding.info['cvss-score'],
        cve: finding.info['cve-id'],
        cwe: finding.info['cwe-id'],
        matchedAt: finding['matched-at'],
        extractedResults: finding['extracted-results'],
        curl: finding['curl-command'],
        host: finding.host,
        type: finding.type
      });
    } catch (error) {
      console.warn('Failed to parse Nuclei line:', line);
    }
  }
  
  return findings;
}
```

**Custom Template Example:**
```yaml
# custom-templates/api-key-exposure.yaml
id: api-key-exposure

info:
  name: API Key Exposure Detection
  author: rtpi-team
  severity: high
  description: Detects exposed API keys in responses
  tags: exposure,api,keys

http:
  - method: GET
    path:
      - "{{BaseURL}}"
      - "{{BaseURL}}/config"
      - "{{BaseURL}}/.env"
    
    matchers-condition: or
    matchers:
      - type: regex
        regex:
          - '(?i)(api[_-]?key|apikey)["\']?\s*[:=]\s*["\']?([a-zA-Z0-9]{20,})'
          - '(?i)(secret[_-]?key|secretkey)["\']?\s*[:=]\s*["\']?([a-zA-Z0-9]{20,})'
        
    extractors:
      - type: regex
        regex:
          - '([a-zA-Z0-9]{32,})'
```

**Database Mapping:**
```typescript
async function storeNucleiFindings(findings: any[], operationId: string) {
  for (const finding of findings) {
    await db.insert(vulnerabilities).values({
      title: finding.name,
      description: finding.description,
      severity: mapSeverity(finding.severity),
      cvssScore: finding.cvss || calculateCVSS(finding.severity),
      cveId: finding.cve,
      cweId: finding.cwe,
      targetId: await getTargetId(finding.host),
      operationId,
      proofOfConcept: finding.curl,
      discoveredAt: new Date(),
      status: 'open'
    });
  }
}

function mapSeverity(nucleiSeverity: string): string {
  const mapping: Record<string, string> = {
    'info': 'informational',
    'low': 'low',
    'medium': 'medium',
    'high': 'high',
    'critical': 'critical'
  };
  return mapping[nucleiSeverity.toLowerCase()] || 'medium';
}
```

**Template Management:**
```typescript
export class NucleiTemplateManager {
  async updateTemplates() {
    await dockerExecutor.exec('projectdiscovery/nuclei:latest', [
      '-update-templates'
    ]);
  }
  
  async listTemplates() {
    const result = await dockerExecutor.exec(
      'projectdiscovery/nuclei:latest',
      ['-tl']
    );
    return result.stdout.split('\n');
  }
  
  async validateTemplate(templatePath: string) {
    await dockerExecutor.exec('projectdiscovery/nuclei:latest', [
      '-validate',
      '-t', templatePath
    ]);
  }
}
```

**CI/CD Integration Example:**
```yaml
# .github/workflows/nuclei-scan.yml
name: Nuclei Scan
on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Run Nuclei
        run: |
          docker run projectdiscovery/nuclei:latest \
            -u ${{ secrets.TARGET_URL }} \
            -severity high,critical \
            -json-export results.json
      
      - name: Upload to RTPI
        run: |
          curl -X POST https://rtpi.example.com/api/v1/nuclei/import \
            -H "Authorization: Bearer ${{ secrets.RTPI_TOKEN }}" \
            -F "results=@results.json"
```

### Ax Module Configuration

**Central Configuration Management for All Scanning Tools**

**File:** `server/services/ax-config-manager.ts`

```typescript
import { db } from '../db';
import { axModuleConfigs } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface AxModuleConfig {
  id: string;
  moduleName: string;
  enabled: boolean;
  config: Record<string, any>;
  credentials?: Record<string, string>;
  rateLimit?: number;
  timeout?: number;
  lastUsed?: Date;
}

export class AxConfigManager {
  // BBOT Configuration
  async getBBOTConfig(operationId: string): Promise<any> {
    return {
      preset: 'subdomain-enum',
      modules: ['subfinder', 'assetfinder', 'amass'],
      flags: ['safe'],
      outputFormat: 'json',
      apiKeys: {
        shodan: process.env.SHODAN_API_KEY,
        virustotal: process.env.VIRUSTOTAL_API_KEY,
        censys_id: process.env.CENSYS_API_ID,
        censys_secret: process.env.CENSYS_SECRET
      }
    };
  }
  
  // XSStrike Configuration
  async getXSStrikeConfig(): Promise<any> {
    return {
      enabled: true,
      crawl: true,
      fuzzer: false,
      blindXSS: {
        enabled: false,
        callback: process.env.BLIND_XSS_CALLBACK
      },
      timeout: 600000, // 10 minutes
      headers: {
        'User-Agent': 'RTPI-Scanner/1.0'
      }
    };
  }
  
  // Nuclei Configuration
  async getNucleiConfig(): Promise<any> {
    return {
      enabled: true,
      templates: ['cves/', 'vulnerabilities/', 'exposures/'],
      severity: ['critical', 'high', 'medium'],
      tags: ['cve', 'sqli', 'xss', 'rce'],
      rateLimit: 50,
      bulkSize: 25,
      timeout: 1800000, // 30 minutes
      updateTemplates: true,
      customTemplates: '/opt/rtpi/custom-nuclei-templates'
    };
  }
  
  // Unified Module Configuration
  async getModuleConfig(moduleName: string, operationId?: string): Promise<AxModuleConfig> {
    const result = await db
      .select()
      .from(axModuleConfigs)
      .where(eq(axModuleConfigs.moduleName, moduleName))
      .limit(1);
    
    if (result.length > 0) {
      return result[0];
    }
    
    // Return default config
    return this.getDefaultConfig(moduleName);
  }
  
  // Save Module Configuration
  async saveModuleConfig(config: AxModuleConfig): Promise<void> {
    await db
      .insert(axModuleConfigs)
      .values({
        ...config,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: axModuleConfigs.moduleName,
        set: {
          enabled: config.enabled,
          config: config.config,
          credentials: config.credentials,
          rateLimit: config.rateLimit,
          timeout: config.timeout,
          updatedAt: new Date()
        }
      });
  }
  
  // Get Default Configuration
  private getDefaultConfig(moduleName: string): AxModuleConfig {
    const defaults: Record<string, AxModuleConfig> = {
      bbot: {
        id: 'bbot',
        moduleName: 'bbot',
        enabled: true,
        config: {
          preset: 'subdomain-enum',
          modules: [],
          flags: ['safe']
        },
        timeout: 1800000
      },
      xsstrike: {
        id: 'xsstrike',
        moduleName: 'xsstrike',
        enabled: true,
        config: {
          crawl: true,
          fuzzer: false
        },
        timeout: 600000
      },
      nuclei: {
        id: 'nuclei',
        moduleName: 'nuclei',
        enabled: true,
        config: {
          severity: ['critical', 'high', 'medium'],
          rateLimit: 50
        },
        timeout: 1800000
      },
      masscan: {
        id: 'masscan',
        moduleName: 'masscan',
        enabled: true,
        config: {
          ports: '80,443,8080,8443',
          rate: 1000
        },
        timeout: 3600000
      },
      whatweb: {
        id: 'whatweb',
        moduleName: 'whatweb',
        enabled: true,
        config: {
          aggression: 3
        },
        timeout: 300000
      }
    };
    
    return defaults[moduleName] || {
      id: moduleName,
      moduleName,
      enabled: false,
      config: {}
    };
  }
  
  // Validate Configuration
  async validateConfig(moduleName: string, config: any): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    // Module-specific validation
    switch (moduleName) {
      case 'bbot':
        if (config.modules && !Array.isArray(config.modules)) {
          errors.push('BBOT modules must be an array');
        }
        break;
      case 'nuclei':
        if (config.severity && !Array.isArray(config.severity)) {
          errors.push('Nuclei severity must be an array');
        }
        if (config.rateLimit && (config.rateLimit < 1 || config.rateLimit > 500)) {
          errors.push('Nuclei rate limit must be between 1 and 500');
        }
        break;
      case 'xsstrike':
        if (config.blindXSS && config.blindXSS.enabled && !config.blindXSS.callback) {
          errors.push('Blind XSS requires a callback URL');
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const axConfigManager = new AxConfigManager();
```

**Configuration UI Component:**

```tsx
// File: client/src/components/surface-assessment/ModuleConfigForm.tsx
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function ModuleConfigForm({ moduleName }: { moduleName: string }) {
  const [config, setConfig] = useState<any>({});
  const [enabled, setEnabled] = useState(true);
  
  useEffect(() => {
    loadConfig();
  }, [moduleName]);
  
  const loadConfig = async () => {
    const result = await api.get(`/ax/modules/${moduleName}/config`);
    setConfig(result.config);
    setEnabled(result.enabled);
  };
  
  const saveConfig = async () => {
    await api.put(`/ax/modules/${moduleName}/config`, {
      enabled,
      config
    });
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="enabled">Enable {moduleName}</Label>
        <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      
      {/* Module-specific configuration fields */}
      {moduleName === 'nuclei' && (
        <>
          <div>
            <Label>Severity Levels</Label>
            <Input 
              value={config.severity?.join(',')} 
              onChange={(e) => setConfig({
                ...config,
                severity: e.target.value.split(',')
              })}
            />
          </div>
          <div>
            <Label>Rate Limit</Label>
            <Input 
              type="number" 
              value={config.rateLimit} 
              onChange={(e) => setConfig({
                ...config,
                rateLimit: parseInt(e.target.value)
              })}
            />
          </div>
        </>
      )}
      
      <Button onClick={saveConfig}>Save Configuration</Button>
    </div>
  );
}
```

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
**Library:** Recharts  
**File:** `client/src/components/surface-assessment/charts/SeverityDistributionChart.tsx`

**Implementation:**
Already implemented above in Overview Dashboard section. Same component can be reused.

**Additional Features:**
- Click on segment to filter vulnerabilities
- Hover tooltip with count and percentage
- Legend with color coding
- Animation on data update
- Export chart as PNG/SVG

#### 2. Vulnerability Timeline (Line Chart)
**Library:** Recharts  
**File:** `client/src/components/surface-assessment/charts/VulnerabilityTimelineChart.tsx`

**Purpose:** Show vulnerability discovery trends over time

**Implementation:**
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

interface TimelineChartProps {
  data: {
    date: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  }[];
}

export default function VulnerabilityTimelineChart({ data }: TimelineChartProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Vulnerability Discovery Timeline</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(date) => format(new Date(date), 'MMM dd')}
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
          />
          <Legend />
          <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} />
          <Line type="monotone" dataKey="high" stroke="#ea580c" strokeWidth={2} />
          <Line type="monotone" dataKey="medium" stroke="#ca8a04" strokeWidth={2} />
          <Line type="monotone" dataKey="low" stroke="#16a34a" strokeWidth={2} />
          <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Data Aggregation:**
```typescript
// Generate timeline data from vulnerabilities
function generateTimelineData(vulnerabilities: any[], days: number = 30) {
  const timeline: any[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dateString = format(date, 'yyyy-MM-dd');
    
    const vulnsOnDate = vulnerabilities.filter(v => 
      format(new Date(v.discoveredAt), 'yyyy-MM-dd') === dateString
    );
    
    timeline.push({
      date: dateString,
      critical: vulnsOnDate.filter(v => v.severity === 'critical').length,
      high: vulnsOnDate.filter(v => v.severity === 'high').length,
      medium: vulnsOnDate.filter(v => v.severity === 'medium').length,
      low: vulnsOnDate.filter(v => v.severity === 'low').length,
      total: vulnsOnDate.length
    });
  }
  
  return timeline;
}
```

#### 3. Asset Treemap
**Library:** Recharts  
**File:** `client/src/components/surface-assessment/charts/AssetTreemap.tsx`

**Purpose:** Visualize assets by vulnerability count in a hierarchical view

**Implementation:**
```tsx
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

interface TreemapData {
  name: string;
  size: number;
  children?: TreemapData[];
}

interface AssetTreemapProps {
  data: TreemapData[];
}

const COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0284c7'];

export default function AssetTreemap({ data }: AssetTreemapProps) {
  const CustomContent = (props: any) => {
    const { x, y, width, height, name, size } = props;
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: COLORS[Math.floor(Math.random() * COLORS.length)],
            stroke: '#fff',
            strokeWidth: 2,
            opacity: 0.8
          }}
        />
        {width > 50 && height > 30 && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - 7}
              textAnchor="middle"
              fill="#fff"
              fontSize={12}
            >
              {name}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 7}
              textAnchor="middle"
              fill="#fff"
              fontSize={10}
            >
              {size} vulns
            </text>
          </>
        )}
      </g>
    );
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Asset Vulnerability Distribution</h3>
      <ResponsiveContainer width="100%" height={400}>
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#fff"
          fill="#8884d8"
          content={<CustomContent />}
        >
          <Tooltip />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
```

#### 4. Service Distribution (Bar Chart)
**Library:** Recharts  
**File:** `client/src/components/surface-assessment/charts/ServiceDistributionChart.tsx`

**Purpose:** Show distribution of services across discovered assets

**Implementation:**
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ServiceDistributionProps {
  data: {
    service: string;
    port: number;
    count: number;
    vulnerabilities: number;
  }[];
}

export default function ServiceDistributionChart({ data }: ServiceDistributionProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Service Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="service" />
          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
          <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
          <Tooltip />
          <Legend />
          <Bar 
            yAxisId="left" 
            dataKey="count" 
            fill="#3b82f6" 
            name="Host Count"
          />
          <Bar 
            yAxisId="right" 
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
