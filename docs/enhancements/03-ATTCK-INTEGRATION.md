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

### Main Page Component

Complete React implementation for the ATT&CK Integration page with 6-tab navigation:

```typescript
// client/src/pages/ATTACKIntegration.tsx

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOperations } from '@/hooks/useOperations';
import NavigatorTab from '@/components/attck/NavigatorTab';
import PlannerTab from '@/components/attck/PlannerTab';
import WorkbenchTab from '@/components/attck/WorkbenchTab';
import AttackFlowTab from '@/components/attck/AttackFlowTab';
import TechniquesTab from '@/components/attck/TechniquesTab';
import CollectionsTab from '@/components/attck/CollectionsTab';

export default function ATTACKIntegration() {
  const [activeTab, setActiveTab] = useState('navigator');
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const { operations } = useOperations();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">ATT&CK</h1>
        <p className="text-muted-foreground mt-1">
          Enterprise threat intelligence and operation planning
        </p>
      </div>

      {/* Operation Context Selector */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Operation Context:</label>
          <Select value={selectedOperation || 'none'} onValueChange={setSelectedOperation}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select an operation (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No operation selected</SelectItem>
              {operations?.map((op) => (
                <SelectItem key={op.id} value={op.id}>
                  {op.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedOperation && selectedOperation !== 'none' && (
            <span className="text-sm text-muted-foreground">
              Selected techniques will be associated with this operation
            </span>
          )}
        </div>
      </Card>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="navigator">Navigator</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="workbench">Workbench</TabsTrigger>
          <TabsTrigger value="attackflow">Attack Flow</TabsTrigger>
          <TabsTrigger value="techniques">Techniques</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
        </TabsList>

        {/* Tab 1: Navigator - Matrix Visualization */}
        <TabsContent value="navigator">
          <NavigatorTab operationId={selectedOperation} />
        </TabsContent>

        {/* Tab 2: Planner - Technique Selection */}
        <TabsContent value="planner">
          <PlannerTab operationId={selectedOperation} />
        </TabsContent>

        {/* Tab 3: Workbench - Collections & Staging */}
        <TabsContent value="workbench">
          <WorkbenchTab />
        </TabsContent>

        {/* Tab 4: Attack Flow - Behavior Sequencing */}
        <TabsContent value="attackflow">
          <AttackFlowTab operationId={selectedOperation} />
        </TabsContent>

        {/* Tab 5: Techniques - Browse All */}
        <TabsContent value="techniques">
          <TechniquesTab />
        </TabsContent>

        {/* Tab 6: Collections - Data Management */}
        <TabsContent value="collections">
          <CollectionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Sidebar Navigation Update

Add ATT&CK entry to the main sidebar:

```typescript
// client/src/components/layout/Sidebar.tsx

// Add to navigation items array:
const navigationItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/operations', label: 'Operations', icon: Target },
  { path: '/targets', label: 'Targets', icon: Circle },
  { path: '/vulnerabilities', label: 'Vulnerabilities', icon: AlertTriangle },
  { path: '/surface-assessment', label: 'Surface Assessment', icon: TrendingUp },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/infrastructure', label: 'Infrastructure', icon: Server },
  { path: '/tools', label: 'Tools', icon: Wrench },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/attck', label: 'ATT&CK', icon: Crosshair }, // NEW
];
```

### Router Configuration

Add route to main App.tsx:

```typescript
// client/src/App.tsx

import ATTACKIntegration from '@/pages/ATTACKIntegration';

// Add to Switch component:
<Route path="/attck" component={ATTACKIntegration} />
```

### State Management Context

Create ATT&CK context for shared state across tabs:

```typescript
// client/src/contexts/ATTACKContext.tsx

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';

interface ATTACKTechnique {
  techniqueId: string;
  name: string;
  description: string;
  tactics: string[];
  platforms: string[];
  dataSources: string[];
  status?: 'available' | 'planned' | 'executed';
}

interface SelectedTechnique {
  technique: ATTACKTechnique;
  parameters?: Record<string, any>;
  notes?: string;
}

interface ATTACKContextValue {
  selectedTechniques: SelectedTechnique[];
  addTechnique: (technique: ATTACKTechnique) => void;
  removeTechnique: (techniqueId: string) => void;
  updateTechnique: (techniqueId: string, updates: Partial<SelectedTechnique>) => void;
  clearAllTechniques: () => void;
  sendToOperationLead: (operationId: string) => Promise<void>;
}

const ATTACKContext = createContext<ATTACKContextValue | undefined>(undefined);

export function ATTACKProvider({ children }: { children: ReactNode }) {
  const [selectedTechniques, setSelectedTechniques] = useState<SelectedTechnique[]>([]);

  const addTechnique = useCallback((technique: ATTACKTechnique) => {
    setSelectedTechniques((prev) => {
      if (prev.some((t) => t.technique.techniqueId === technique.techniqueId)) {
        return prev; // Already selected
      }
      return [...prev, { technique }];
    });
  }, []);

  const removeTechnique = useCallback((techniqueId: string) => {
    setSelectedTechniques((prev) => prev.filter((t) => t.technique.techniqueId !== techniqueId));
  }, []);

  const updateTechnique = useCallback((techniqueId: string, updates: Partial<SelectedTechnique>) => {
    setSelectedTechniques((prev) =>
      prev.map((t) => (t.technique.techniqueId === techniqueId ? { ...t, ...updates } : t))
    );
  }, []);

  const clearAllTechniques = useCallback(() => {
    setSelectedTechniques([]);
  }, []);

  const sendToOperationLead = useCallback(async (operationId: string) => {
    await api.post('/attck/send-to-operation-lead', {
      operationId,
      techniques: selectedTechniques.map((t) => ({
        techniqueId: t.technique.techniqueId,
        name: t.technique.name,
        tactics: t.technique.tactics,
        parameters: t.parameters,
        notes: t.notes
      }))
    });
  }, [selectedTechniques]);

  return (
    <ATTACKContext.Provider
      value={{
        selectedTechniques,
        addTechnique,
        removeTechnique,
        updateTechnique,
        clearAllTechniques,
        sendToOperationLead
      }}
    >
      {children}
    </ATTACKContext.Provider>
  );
}

export function useATTACK() {
  const context = useContext(ATTACKContext);
  if (!context) {
    throw new Error('useATTACK must be used within ATTACKProvider');
  }
  return context;
}
```

This provides:
- **Main page component** with 6-tab navigation using Radix UI Tabs
- **Operation context selector** to associate techniques with operations
- **Sidebar navigation** integration with new ATT&CK icon
- **Router configuration** for `/attck` route
- **State management context** for sharing selected techniques across tabs
- **API integration** for sending execution plans to Operation Lead

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

### Navigator Tab Component Implementation

Complete D3.js-powered ATT&CK Navigator with interactive matrix visualization:

```typescript
// client/src/components/attck/NavigatorTab.tsx

import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { Download } from 'lucide-react';

interface NavigatorTabProps {
  operationId: string | null;
}

interface ATTACKMatrix {
  tactics: Tactic[];
  techniques: Technique[];
}

interface Tactic {
  id: string;
  name: string;
  shortName: string;
}

interface Technique {
  id: string;
  name: string;
  description: string;
  tactics: string[];
  platforms: string[];
  dataSources: string[];
  status?: 'available' | 'planned' | 'executed';
}

export default function NavigatorTab({ operationId }: NavigatorTabProps) {
  const [matrix, setMatrix] = useState<ATTACKMatrix | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [techniqueFilter, setTechniqueFilter] = useState('');
  const matrixRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMatrix();
  }, [operationId]);

  useEffect(() => {
    if (matrix && matrixRef.current) {
      renderMatrix();
    }
  }, [matrix, selectedTactic, selectedPlatform, techniqueFilter]);

  const loadMatrix = async () => {
    try {
      const response = await api.get<ATTACKMatrix>('/attck/matrix', {
        params: { operationId }
      });
      setMatrix(response);
    } catch (error) {
      console.error('Failed to load ATT&CK matrix:', error);
    }
  };

  const renderMatrix = () => {
    if (!matrix || !matrixRef.current) return;

    // Clear previous rendering
    d3.select(matrixRef.current).selectAll('*').remove();

    const width = matrixRef.current.clientWidth;
    const tacticWidth = 180;
    const techniqueHeight = 60;

    // Filter techniques
    let filteredTechniques = matrix.techniques;
    if (selectedTactic !== 'all') {
      filteredTechniques = filteredTechniques.filter(t => t.tactics.includes(selectedTactic));
    }
    if (selectedPlatform !== 'all') {
      filteredTechniques = filteredTechniques.filter(t => t.platforms.includes(selectedPlatform));
    }
    if (techniqueFilter) {
      const filter = techniqueFilter.toLowerCase();
      filteredTechniques = filteredTechniques.filter(
        t => t.name.toLowerCase().includes(filter) || t.id.toLowerCase().includes(filter)
      );
    }

    // Group techniques by tactic
    const techniquesByTactic = new Map<string, Technique[]>();
    matrix.tactics.forEach(tactic => {
      techniquesByTactic.set(tactic.id, []);
    });

    filteredTechniques.forEach(technique => {
      technique.tactics.forEach(tacticId => {
        if (techniquesByTactic.has(tacticId)) {
          techniquesByTactic.get(tacticId)!.push(technique);
        }
      });
    });

    // Calculate max techniques per tactic for height
    const maxTechniques = Math.max(...Array.from(techniquesByTactic.values()).map(t => t.length));
    const height = Math.max(400, maxTechniques * techniqueHeight + 100);

    // Create SVG
    const svg = d3
      .select(matrixRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'border rounded');

    // Render tactics and techniques
    matrix.tactics.forEach((tactic, tacticIndex) => {
      const x = tacticIndex * tacticWidth + 20;
      const techniques = techniquesByTactic.get(tactic.id) || [];

      // Tactic header
      svg
        .append('rect')
        .attr('x', x)
        .attr('y', 10)
        .attr('width', tacticWidth - 10)
        .attr('height', 40)
        .attr('fill', 'hsl(var(--primary))')
        .attr('rx', 4);

      svg
        .append('text')
        .attr('x', x + tacticWidth / 2 - 5)
        .attr('y', 35)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('font-size', '12px')
        .text(tactic.shortName);

      // Technique cards
      techniques.forEach((technique, techIndex) => {
        const y = techIndex * techniqueHeight + 60;

        // Color based on status
        let fillColor = 'hsl(var(--muted))'; // available
        if (technique.status === 'planned') fillColor = 'hsl(var(--warning))';
        if (technique.status === 'executed') fillColor = 'hsl(var(--success))';

        // Technique card
        const card = svg
          .append('g')
          .attr('class', 'technique-card')
          .style('cursor', 'pointer')
          .on('click', () => handleTechniqueClick(technique));

        card
          .append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', tacticWidth - 10)
          .attr('height', techniqueHeight - 5)
          .attr('fill', fillColor)
          .attr('stroke', 'hsl(var(--border))')
          .attr('stroke-width', 1)
          .attr('rx', 4);

        card
          .append('text')
          .attr('x', x + 5)
          .attr('y', y + 15)
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .text(technique.id);

        card
          .append('text')
          .attr('x', x + 5)
          .attr('y', y + 30)
          .attr('font-size', '10px')
          .text(truncate(technique.name, 20));
      });
    });
  };

  const handleTechniqueClick = (technique: Technique) => {
    // Open technique details dialog or navigate to details
    console.log('Technique clicked:', technique);
  };

  const exportToLayer = async () => {
    // Export to ATT&CK Navigator layer format
    const layer = {
      name: `RTPI Layer - ${new Date().toISOString()}`,
      versions: { navigator: '4.9', layer: '4.5' },
      domain: 'enterprise-attack',
      description: 'Layer exported from RTPI',
      techniques: matrix?.techniques.map(t => ({
        techniqueID: t.id,
        color: t.status === 'executed' ? '#00ff00' : t.status === 'planned' ? '#ffff00' : '#cccccc'
      }))
    };

    const blob = new Blob([JSON.stringify(layer, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rtpi-attck-layer.json';
    a.click();
  };

  const truncate = (str: string, maxLength: number) => {
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  };

  const coverage = matrix ? calculateCoverage(matrix.techniques) : 0;

  return (
    <Card className="p-6">
      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={selectedTactic} onValueChange={setSelectedTactic}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by tactic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tactics</SelectItem>
            {matrix?.tactics.map(tactic => (
              <SelectItem key={tactic.id} value={tactic.id}>
                {tactic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="Windows">Windows</SelectItem>
            <SelectItem value="Linux">Linux</SelectItem>
            <SelectItem value="macOS">macOS</SelectItem>
            <SelectItem value="Network">Network</SelectItem>
          </SelectContent>
        </Select>

        <input
          type="text"
          placeholder="Search techniques..."
          className="flex-1 px-3 py-2 border rounded"
          value={techniqueFilter}
          onChange={(e) => setTechniqueFilter(e.target.value)}
        />

        <Button variant="outline" size="sm" onClick={exportToLayer}>
          <Download className="h-4 w-4 mr-2" />
          Export Layer
        </Button>
      </div>

      {/* Coverage Stats */}
      <div className="flex gap-4 mb-6">
        <Badge variant="secondary">Coverage: {coverage}%</Badge>
        <Badge variant="outline">Total: {matrix?.techniques.length || 0}</Badge>
        <Badge style={{ backgroundColor: 'hsl(var(--success))' }}>
          Executed: {matrix?.techniques.filter(t => t.status === 'executed').length || 0}
        </Badge>
        <Badge style={{ backgroundColor: 'hsl(var(--warning))' }}>
          Planned: {matrix?.techniques.filter(t => t.status === 'planned').length || 0}
        </Badge>
      </div>

      {/* Matrix Visualization */}
      <div ref={matrixRef} className="overflow-auto" />

      {/* Legend */}
      <div className="flex items-center gap-6 mt-6 pt-4 border-t">
        <span className="text-sm font-medium">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--success))' }} />
          <span className="text-sm">Executed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--warning))' }} />
          <span className="text-sm">Planned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--muted))' }} />
          <span className="text-sm">Available</span>
        </div>
      </div>
    </Card>
  );
}

function calculateCoverage(techniques: Technique[]): number {
  const total = techniques.length;
  const covered = techniques.filter(t => t.status === 'executed' || t.status === 'planned').length;
  return total > 0 ? Math.round((covered / total) * 100) : 0;
}
```

This Navigator component provides:
- **D3.js matrix visualization** with all 14 tactics in columns
- **Interactive technique cards** with color-coded status (executed, planned, available)
- **Multi-filter support** by tactic, platform, and keyword search
- **Coverage statistics** showing execution percentage
- **Export to layer file** in ATT&CK Navigator JSON format
- **Click-through** for technique details

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

The "Send to Operation Lead" button creates a structured execution plan from selected ATT&CK techniques and submits it to the Operation Lead Agent for analysis and automated workflow generation.

#### Complete PlannerTab Component

```typescript
// client/src/components/attck/PlannerTab.tsx
import { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useATTACK } from '@/contexts/ATTACKContext';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { GripVertical, Plus, Trash2, Rocket, Save, FileDown, Upload } from 'lucide-react';

interface PlannerTabProps {
  operationId: string | null;
}

interface TechniqueSearchResult {
  techniqueId: string;
  name: string;
  tactics: string[];
  platforms: string[];
  description: string;
  detectionDifficulty: 'low' | 'medium' | 'high';
}

interface ExecutionPlan {
  name: string;
  description: string;
  operationId: string | null;
  techniques: SelectedTechnique[];
  metadata: {
    coverage: number;
    estimatedTime: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

function SortableTechniqueCard({ technique, onRemove, onUpdateParameters }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: technique.technique.techniqueId
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-lg p-4 mb-3">
      <div className="flex items-start gap-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1">
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {technique.technique.techniqueId} - {technique.technique.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(technique.technique.techniqueId)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {technique.technique.tactics.map((tactic: string) => (
              <Badge key={tactic} variant="secondary">
                {tactic}
              </Badge>
            ))}
          </div>

          <div className="mt-2">
            <Input
              placeholder="Execution parameters (optional)"
              value={technique.parameters || ''}
              onChange={(e) => onUpdateParameters(technique.technique.techniqueId, e.target.value)}
              className="text-sm"
            />
          </div>

          {technique.notes && (
            <p className="text-sm text-muted-foreground mt-2">{technique.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlannerTab({ operationId }: PlannerTabProps) {
  const { selectedTechniques, addTechnique, removeTechnique, updateTechnique, clearAllTechniques, sendToOperationLead } = useATTACK();
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TechniqueSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [techniques, setTechniques] = useState(selectedTechniques);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  // Keep local state in sync with context
  useState(() => {
    setTechniques(selectedTechniques);
  }, [selectedTechniques]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = techniques.findIndex((t) => t.technique.techniqueId === active.id);
      const newIndex = techniques.findIndex((t) => t.technique.techniqueId === over.id);

      const reordered = arrayMove(techniques, oldIndex, newIndex);
      setTechniques(reordered);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const response = await api.get<TechniqueSearchResult[]>('/attck/techniques/search', {
        params: { query: searchQuery }
      });
      setSearchResults(response);
    } catch (error) {
      toast({
        title: 'Search failed',
        description: 'Could not search ATT&CK techniques',
        variant: 'destructive'
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddTechnique = (technique: TechniqueSearchResult) => {
    addTechnique({
      techniqueId: technique.techniqueId,
      name: technique.name,
      tactics: technique.tactics,
      platforms: technique.platforms,
      description: technique.description,
      status: 'planned'
    });
    toast({
      title: 'Technique added',
      description: `${technique.techniqueId} added to execution plan`
    });
  };

  const handleRemoveTechnique = (techniqueId: string) => {
    removeTechnique(techniqueId);
  };

  const handleUpdateParameters = (techniqueId: string, parameters: string) => {
    updateTechnique(techniqueId, { parameters });
  };

  const loadCollections = async () => {
    try {
      const response = await api.get('/attck/collections', {
        params: { type: 'execution_plan' }
      });
      setCollections(response);
    } catch (error) {
      toast({
        title: 'Failed to load collections',
        variant: 'destructive'
      });
    }
  };

  const handleImportFromCollection = async () => {
    if (!selectedCollection) return;

    try {
      const response = await api.get(`/attck/collections/${selectedCollection}/techniques`);
      response.forEach((tech: any) => addTechnique(tech));
      toast({
        title: 'Collection imported',
        description: `Imported ${response.length} techniques`
      });
      setCollectionDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Import failed',
        variant: 'destructive'
      });
    }
  };

  const calculateCoverage = (): number => {
    // Calculate coverage based on unique tactics covered
    const allTactics = ['reconnaissance', 'resource-development', 'initial-access', 'execution',
                        'persistence', 'privilege-escalation', 'defense-evasion', 'credential-access',
                        'discovery', 'lateral-movement', 'collection', 'command-and-control',
                        'exfiltration', 'impact'];
    const coveredTactics = new Set<string>();

    techniques.forEach(t => {
      t.technique.tactics.forEach(tactic => coveredTactics.add(tactic));
    });

    return Math.round((coveredTactics.size / allTactics.length) * 100);
  };

  const estimateTime = (): string => {
    // Base time estimation: 30 minutes per technique
    const totalMinutes = techniques.length * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const assessRisk = (): 'low' | 'medium' | 'high' | 'critical' => {
    // Risk assessment based on technique count and types
    const highRiskTactics = ['impact', 'defense-evasion', 'lateral-movement'];
    const highRiskCount = techniques.filter(t =>
      t.technique.tactics.some(tactic => highRiskTactics.includes(tactic))
    ).length;

    if (techniques.length > 15 || highRiskCount > 5) return 'critical';
    if (techniques.length > 10 || highRiskCount > 3) return 'high';
    if (techniques.length > 5 || highRiskCount > 1) return 'medium';
    return 'low';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const handleSaveDraft = async () => {
    try {
      const plan: ExecutionPlan = {
        name: planName || 'Untitled Plan',
        description: planDescription,
        operationId,
        techniques,
        metadata: {
          coverage: calculateCoverage(),
          estimatedTime: estimateTime(),
          riskLevel: assessRisk()
        }
      };

      await api.post('/attck/plans/draft', plan);
      toast({
        title: 'Draft saved',
        description: 'Execution plan saved successfully'
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        variant: 'destructive'
      });
    }
  };

  const handleExportSTIX = async () => {
    try {
      const plan: ExecutionPlan = {
        name: planName || 'Untitled Plan',
        description: planDescription,
        operationId,
        techniques,
        metadata: {
          coverage: calculateCoverage(),
          estimatedTime: estimateTime(),
          riskLevel: assessRisk()
        }
      };

      const stixBundle = await api.post('/attck/plans/export-stix', plan);

      // Download STIX bundle as JSON
      const blob = new Blob([JSON.stringify(stixBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${planName || 'execution-plan'}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'STIX exported',
        description: 'Execution plan exported as STIX bundle'
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        variant: 'destructive'
      });
    }
  };

  const handleSendToOperationLead = async () => {
    if (!operationId) {
      toast({
        title: 'Operation required',
        description: 'Please select an operation before sending to Operation Lead',
        variant: 'destructive'
      });
      return;
    }

    if (techniques.length < 3) {
      toast({
        title: 'Insufficient techniques',
        description: 'Please select at least 3 techniques for execution',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      // Step 1: Create staged collection in Workbench
      const collection = await api.post('/attck/collections', {
        name: planName || 'Execution Plan',
        description: planDescription,
        type: 'execution_plan',
        status: 'staged',
        operationId,
        techniques: techniques.map(t => ({
          techniqueId: t.technique.techniqueId,
          name: t.technique.name,
          tactics: t.technique.tactics,
          parameters: t.parameters,
          notes: t.notes
        })),
        metadata: {
          coverage: calculateCoverage(),
          estimatedTime: estimateTime(),
          riskLevel: assessRisk()
        }
      });

      // Step 2: Submit to Operation Lead Agent
      const workflow = await sendToOperationLead(operationId);

      // Step 3: Show success and workflow ID
      toast({
        title: 'Plan submitted to Operation Lead',
        description: `Workflow ${workflow.workflowId} created. Agent is analyzing techniques...`,
        duration: 5000
      });

      setSendDialogOpen(false);

      // Step 4: Navigate to workflow monitoring (optional)
      // window.location.href = `/agents?workflow=${workflow.workflowId}`;

    } catch (error: any) {
      toast({
        title: 'Submission failed',
        description: error.message || 'Could not send plan to Operation Lead',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const coverage = calculateCoverage();
  const estimatedTime = estimateTime();
  const riskLevel = assessRisk();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Selected Techniques for Execution Plan</h2>
          <div className="flex gap-2">
            <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Technique
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Search ATT&CK Techniques</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by technique ID, name, or tactic..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={searchLoading}>
                      Search
                    </Button>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {searchResults.map((result) => (
                      <div key={result.techniqueId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">
                            {result.techniqueId} - {result.name}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => {
                              handleAddTechnique(result);
                              setSearchDialogOpen(false);
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {result.tactics.map((tactic) => (
                            <Badge key={tactic} variant="secondary" className="text-xs">
                              {tactic}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {result.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={collectionDialogOpen} onOpenChange={(open) => {
              setCollectionDialogOpen(open);
              if (open) loadCollections();
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Import from Collection
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import from Collection</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={selectedCollection || ''} onValueChange={setSelectedCollection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name} ({col.techniqueCount} techniques)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DialogFooter>
                    <Button onClick={handleImportFromCollection} disabled={!selectedCollection}>
                      Import
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>

            {techniques.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllTechniques}>
                Clear All
              </Button>
            )}
          </div>
        </div>

        {techniques.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">No techniques selected</p>
            <p className="text-sm">Use "Add Technique" to start building your execution plan</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={techniques.map(t => t.technique.techniqueId)} strategy={verticalListSortingStrategy}>
              <div>
                {techniques.map((technique) => (
                  <SortableTechniqueCard
                    key={technique.technique.techniqueId}
                    technique={technique}
                    onRemove={handleRemoveTechnique}
                    onUpdateParameters={handleUpdateParameters}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      {techniques.length > 0 && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-around text-center">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Coverage</p>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-3 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${coverage}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{coverage}%</span>
                </div>
              </div>

              <div className="border-l pl-4">
                <p className="text-sm text-muted-foreground mb-1">Est. Time</p>
                <p className="text-lg font-semibold">{estimatedTime}</p>
              </div>

              <div className="border-l pl-4">
                <p className="text-sm text-muted-foreground mb-1">Risk Level</p>
                <p className={`text-lg font-semibold uppercase ${getRiskColor(riskLevel)}`}>
                  {riskLevel}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Plan Name</label>
                <Input
                  placeholder="e.g., Beta Operation - Recon & Exploit"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea
                  placeholder="Describe the purpose and scope of this execution plan..."
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Rocket className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Send to Operation Lead</h3>
              </div>

              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                This will send the execution plan to the Operation Lead Agent for analysis and automated workflow generation. The agent will review techniques, assess feasibility, and create a structured execution workflow.
              </p>

              <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full max-w-xs">
                    <Rocket className="w-4 h-4 mr-2" />
                    Send to Operation Lead
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Submission</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      You are about to submit an execution plan with <strong>{techniques.length} techniques</strong> to the Operation Lead Agent.
                    </p>

                    <div className="bg-secondary/50 p-3 rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Techniques:</span>
                        <span className="font-medium">{techniques.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Coverage:</span>
                        <span className="font-medium">{coverage}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimated Time:</span>
                        <span className="font-medium">{estimatedTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk Level:</span>
                        <span className={`font-medium uppercase ${getRiskColor(riskLevel)}`}>
                          {riskLevel}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      The Operation Lead will analyze this plan and generate a workflow with specific tasks for agent execution.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSendToOperationLead} disabled={sending}>
                      {sending ? 'Sending...' : 'Send to Operation Lead'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSaveDraft} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button variant="outline" onClick={handleExportSTIX} className="flex-1">
              <FileDown className="w-4 h-4 mr-2" />
              Export STIX
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

This complete PlannerTab component provides:

**Core Features:**
1. **Drag-and-drop reordering** using `@dnd-kit/core` for intuitive technique organization
2. **Technique search** with dialog and filtering by ID, name, or tactic
3. **Collection import** to load pre-saved technique sets
4. **Real-time metrics** showing coverage percentage, estimated execution time, and risk level
5. **Plan metadata** with name and description fields
6. **Draft saving** to persist plans for later editing
7. **STIX export** to generate STIX 2.1 bundles

**"Send to Operation Lead" Workflow:**
1. **Validation**: Ensures operation is selected and minimum 3 techniques are present
2. **Collection creation**: Creates staged collection in Workbench with all plan details
3. **Agent submission**: Calls `sendToOperationLead()` from ATTACKContext to submit to agent
4. **Progress monitoring**: Returns workflow ID for tracking agent analysis
5. **User feedback**: Toast notifications at each step with success/error messages

**Risk Assessment Algorithm:**
- Analyzes technique count and high-risk tactics (impact, defense-evasion, lateral-movement)
- Assigns risk levels: Low (≤5 techniques), Medium (6-10), High (11-15), Critical (>15 or >5 high-risk)

**Time Estimation:**
- Base calculation: 30 minutes per technique
- Formats as hours and minutes (e.g., "2h 30m")

**Coverage Calculation:**
- Measures unique ATT&CK tactics covered from all 14 tactics
- Displays as percentage with visual progress bar

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

#### Complete WorkbenchTab Component

```typescript
// client/src/components/attck/WorkbenchTab.tsx
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Folder, Plus, Upload, Download, Eye, Edit, Trash2, Play, CheckCircle, Clock, FileJson, RefreshCw } from 'lucide-react';

interface WorkbenchTabProps {
  operationId: string | null;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  type: 'execution_plan' | 'findings_report' | 'custom_techniques' | 'imported_intel';
  status: 'draft' | 'staged' | 'approved' | 'executed' | 'archived';
  operationId?: string;
  techniqueCount?: number;
  objectCount?: number;
  createdBy: string;
  createdByAgent?: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    coverage?: number;
    estimatedTime?: string;
    riskLevel?: string;
  };
}

interface STIXBundle {
  type: 'bundle';
  id: string;
  objects: any[];
}

const collectionTypeLabels = {
  execution_plan: 'Execution Plan',
  findings_report: 'Findings Report',
  custom_techniques: 'Custom Techniques',
  imported_intel: 'Imported Intel'
};

const statusIcons = {
  draft: <Edit className="w-4 h-4 text-muted-foreground" />,
  staged: <Clock className="w-4 h-4 text-yellow-600" />,
  approved: <CheckCircle className="w-4 h-4 text-green-600" />,
  executed: <Play className="w-4 h-4 text-blue-600" />,
  archived: <Folder className="w-4 h-4 text-gray-600" />
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  staged: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  executed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  archived: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
};

export default function WorkbenchTab({ operationId }: WorkbenchTabProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionContents, setCollectionContents] = useState<any[]>([]);
  const [stixFile, setStixFile] = useState<File | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  // New collection form
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    type: 'execution_plan' as Collection['type']
  });

  useEffect(() => {
    loadCollections();
  }, [operationId, typeFilter, statusFilter]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const response = await api.get<Collection[]>('/attck/collections', {
        params: {
          operationId: operationId || undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }
      });
      setCollections(response);
    } catch (error) {
      toast({
        title: 'Failed to load collections',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollection.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a collection name',
        variant: 'destructive'
      });
      return;
    }

    try {
      await api.post('/attck/collections', {
        ...newCollection,
        operationId,
        status: 'draft'
      });

      toast({
        title: 'Collection created',
        description: `${newCollection.name} has been created`
      });

      setCreateDialogOpen(false);
      setNewCollection({ name: '', description: '', type: 'execution_plan' });
      loadCollections();
    } catch (error) {
      toast({
        title: 'Creation failed',
        variant: 'destructive'
      });
    }
  };

  const handleViewCollection = async (collection: Collection) => {
    setSelectedCollection(collection);
    setViewDialogOpen(true);

    try {
      const response = await api.get(`/attck/collections/${collection.id}/contents`);
      setCollectionContents(response);
    } catch (error) {
      toast({
        title: 'Failed to load collection contents',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Are you sure you want to delete this collection?')) return;

    try {
      await api.delete(`/attck/collections/${collectionId}`);
      toast({
        title: 'Collection deleted'
      });
      loadCollections();
    } catch (error) {
      toast({
        title: 'Deletion failed',
        variant: 'destructive'
      });
    }
  };

  const handleApproveCollection = async (collectionId: string) => {
    try {
      await api.patch(`/attck/collections/${collectionId}/status`, {
        status: 'approved'
      });
      toast({
        title: 'Collection approved',
        description: 'Collection is now ready for execution'
      });
      loadCollections();
    } catch (error) {
      toast({
        title: 'Approval failed',
        variant: 'destructive'
      });
    }
  };

  const handleExecuteCollection = async (collection: Collection) => {
    if (collection.type !== 'execution_plan') {
      toast({
        title: 'Invalid action',
        description: 'Only execution plans can be executed',
        variant: 'destructive'
      });
      return;
    }

    if (collection.status !== 'approved') {
      toast({
        title: 'Not approved',
        description: 'Collection must be approved before execution',
        variant: 'destructive'
      });
      return;
    }

    try {
      const workflow = await api.post('/attck/collections/execute', {
        collectionId: collection.id,
        operationId: collection.operationId
      });

      toast({
        title: 'Execution started',
        description: `Workflow ${workflow.workflowId} created`,
        duration: 5000
      });

      // Update collection status to executed
      await api.patch(`/attck/collections/${collection.id}/status`, {
        status: 'executed'
      });

      loadCollections();
    } catch (error: any) {
      toast({
        title: 'Execution failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleExportSTIX = async (collection: Collection) => {
    try {
      const stixBundle = await api.get<STIXBundle>(`/attck/collections/${collection.id}/export-stix`);

      const blob = new Blob([JSON.stringify(stixBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collection.name.replace(/\s+/g, '-').toLowerCase()}-stix.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'STIX exported',
        description: 'Collection exported as STIX 2.1 bundle'
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        variant: 'destructive'
      });
    }
  };

  const handleImportSTIX = async () => {
    if (!stixFile) {
      toast({
        title: 'No file selected',
        variant: 'destructive'
      });
      return;
    }

    try {
      const fileContent = await stixFile.text();
      const stixBundle: STIXBundle = JSON.parse(fileContent);

      if (stixBundle.type !== 'bundle') {
        toast({
          title: 'Invalid STIX file',
          description: 'File must be a STIX 2.1 bundle',
          variant: 'destructive'
        });
        return;
      }

      await api.post('/attck/collections/import-stix', {
        stixBundle,
        operationId
      });

      toast({
        title: 'STIX imported',
        description: `Imported ${stixBundle.objects.length} objects`
      });

      setImportDialogOpen(false);
      setStixFile(null);
      loadCollections();
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message || 'Invalid STIX format',
        variant: 'destructive'
      });
    }
  };

  const handleSyncWithMITRE = async () => {
    setSyncing(true);
    try {
      const result = await api.post('/attck/sync-mitre');

      toast({
        title: 'MITRE sync completed',
        description: `Updated ${result.techniquesUpdated} techniques, ${result.tacticsUpdated} tactics`,
        duration: 5000
      });

      loadCollections();
    } catch (error: any) {
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const filteredCollections = collections.filter((col) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        col.name.toLowerCase().includes(query) ||
        col.description.toLowerCase().includes(query) ||
        col.createdBy.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getCollectionIcon = (type: Collection['type']) => {
    return <Folder className="w-5 h-5 text-primary" />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Collections</h2>
          <div className="flex gap-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Collection
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Collection</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Name</label>
                    <Input
                      placeholder="Collection name"
                      value={newCollection.name}
                      onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Description</label>
                    <Textarea
                      placeholder="Describe the purpose of this collection..."
                      value={newCollection.description}
                      onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Type</label>
                    <Select
                      value={newCollection.type}
                      onValueChange={(value) => setNewCollection({ ...newCollection, type: value as Collection['type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="execution_plan">Execution Plan</SelectItem>
                        <SelectItem value="findings_report">Findings Report</SelectItem>
                        <SelectItem value="custom_techniques">Custom Techniques</SelectItem>
                        <SelectItem value="imported_intel">Imported Intel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateCollection}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Import STIX
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import STIX Bundle</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Import a STIX 2.1 bundle containing ATT&CK techniques, collections, or threat intelligence.
                  </p>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => setStixFile(e.target.files?.[0] || null)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleImportSTIX} disabled={!stixFile}>
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={handleSyncWithMITRE} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync with MITRE
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="execution_plan">Execution Plan</SelectItem>
              <SelectItem value="findings_report">Findings Report</SelectItem>
              <SelectItem value="custom_techniques">Custom Techniques</SelectItem>
              <SelectItem value="imported_intel">Imported Intel</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="staged">Staged</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="executed">Executed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-secondary rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-secondary rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      ) : filteredCollections.length === 0 ? (
        <Card className="p-12 text-center">
          <Folder className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No collections found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery
              ? 'Try adjusting your search or filters'
              : 'Create a new collection or import STIX data to get started'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCollections.map((collection) => (
            <Card key={collection.id} className="p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getCollectionIcon(collection.type)}
                  <h3 className="font-semibold text-foreground">{collection.name}</h3>
                </div>
                <Badge className={statusColors[collection.status]}>
                  <span className="flex items-center gap-1">
                    {statusIcons[collection.status]}
                    {collection.status.charAt(0).toUpperCase() + collection.status.slice(1)}
                  </span>
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {collection.description || 'No description'}
              </p>

              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium">{collectionTypeLabels[collection.type]}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Items:</span>{' '}
                  <span className="font-medium">
                    {collection.techniqueCount || collection.objectCount || 0}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Created by:</span>{' '}
                  <span className="font-medium">
                    {collection.createdBy}
                    {collection.createdByAgent && ' (Agent)'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Last modified:</span>{' '}
                  <span className="font-medium">{formatDate(collection.updatedAt)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewCollection(collection)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>

                {collection.status === 'staged' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApproveCollection(collection.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                )}

                {collection.type === 'execution_plan' && collection.status === 'approved' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleExecuteCollection(collection)}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Execute
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportSTIX(collection)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteCollection(collection.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCollection?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">
                {selectedCollection?.description || 'No description'}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Contents</h4>
              <div className="space-y-2">
                {collectionContents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contents</p>
                ) : (
                  collectionContents.map((item, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {item.techniqueId || item.id}: {item.name}
                          </p>
                          {item.tactics && (
                            <div className="flex gap-1 mt-1">
                              {item.tactics.map((tactic: string) => (
                                <Badge key={tactic} variant="secondary" className="text-xs">
                                  {tactic}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {item.status && (
                          <Badge className={statusColors[item.status as keyof typeof statusColors]}>
                            {item.status}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {selectedCollection?.metadata && (
              <div>
                <h4 className="text-sm font-medium mb-2">Metadata</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {selectedCollection.metadata.coverage !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Coverage:</span>{' '}
                      <span className="font-medium">{selectedCollection.metadata.coverage}%</span>
                    </div>
                  )}
                  {selectedCollection.metadata.estimatedTime && (
                    <div>
                      <span className="text-muted-foreground">Est. Time:</span>{' '}
                      <span className="font-medium">{selectedCollection.metadata.estimatedTime}</span>
                    </div>
                  )}
                  {selectedCollection.metadata.riskLevel && (
                    <div>
                      <span className="text-muted-foreground">Risk:</span>{' '}
                      <span className="font-medium uppercase">{selectedCollection.metadata.riskLevel}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

This complete WorkbenchTab component provides:

**Core Features:**
1. **Collections browser** with grid layout showing all collections with metadata
2. **CRUD operations** for creating, viewing, editing, and deleting collections
3. **Multi-filter support** by type, status, and search query
4. **Collection types**: execution_plan, findings_report, custom_techniques, imported_intel
5. **Status workflow**: draft → staged → approved → executed → archived
6. **Agent-created collections** with special badge indicator

**STIX Integration:**
1. **Import STIX bundles** from file upload with validation
2. **Export collections** to STIX 2.1 format
3. **Sync with MITRE** to update ATT&CK data from official repository

**Approval Workflow:**
1. **Staged collections** created by agents await approval
2. **Approve button** transitions collection to approved state
3. **Execute button** triggers workflow generation (execution_plan only)
4. **Status indicators** with icons and color-coded badges

**Collection Management:**
1. **View contents** in dialog with full technique list
2. **Metadata display** showing coverage, time estimates, risk level
3. **Created by tracking** with agent indicator
4. **Relative timestamps** ("5 min ago", "2 hours ago")

**Integration Points:**
- API endpoints: `/attck/collections` for CRUD operations
- Export endpoint: `/attck/collections/:id/export-stix`
- Import endpoint: `/attck/collections/import-stix`
- Sync endpoint: `/attck/sync-mitre`
- Execute endpoint: `/attck/collections/execute`

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

#### Complete AttackFlowTab Component

```typescript
// client/src/components/attck/AttackFlowTab.tsx
import { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeTypes,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Plus, GitBranch, Download, Upload, Play, Save } from 'lucide-react';

interface AttackFlowTabProps {
  operationId: string | null;
}

interface TechniqueNode extends Node {
  data: {
    label: string;
    techniqueId: string;
    name: string;
    asset?: string;
    parameters?: string;
  };
  type: 'technique' | 'asset' | 'decision' | 'start' | 'end';
}

interface AttackFlowData {
  name: string;
  description: string;
  author: string;
  nodes: TechniqueNode[];
  edges: Edge[];
  metadata: {
    operationId?: string;
    created: string;
    modified: string;
  };
}

// Custom node components
function TechniqueNodeComponent({ data }: { data: any }) {
  return (
    <div className="bg-card border-2 border-primary rounded-lg p-3 min-w-[180px] shadow-md">
      <div className="font-semibold text-sm mb-1">{data.techniqueId}</div>
      <div className="text-xs text-muted-foreground">{data.name}</div>
      {data.asset && (
        <div className="text-xs text-primary mt-1">Asset: {data.asset}</div>
      )}
    </div>
  );
}

function AssetNodeComponent({ data }: { data: any }) {
  return (
    <div className="bg-secondary border-2 border-border rounded-lg p-3 min-w-[150px] shadow-md">
      <div className="font-semibold text-sm text-center">{data.label}</div>
      <div className="text-xs text-muted-foreground text-center">{data.assetType}</div>
    </div>
  );
}

function DecisionNodeComponent({ data }: { data: any }) {
  return (
    <div className="bg-yellow-100 dark:bg-yellow-900 border-2 border-yellow-500 rounded-md p-2 min-w-[120px] shadow-md transform rotate-45">
      <div className="transform -rotate-45 text-xs font-semibold text-center">{data.label}</div>
    </div>
  );
}

function StartNodeComponent({ data }: { data: any }) {
  return (
    <div className="bg-green-500 text-white rounded-full w-24 h-24 flex items-center justify-center font-bold shadow-lg">
      START
    </div>
  );
}

function EndNodeComponent({ data }: { data: any }) {
  return (
    <div className="bg-red-500 text-white rounded-full w-24 h-24 flex items-center justify-center font-bold shadow-lg">
      END
    </div>
  );
}

const nodeTypes: NodeTypes = {
  technique: TechniqueNodeComponent,
  asset: AssetNodeComponent,
  decision: DecisionNodeComponent,
  start: StartNodeComponent,
  end: EndNodeComponent
};

export default function AttackFlowTab({ operationId }: AttackFlowTabProps) {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'start',
      type: 'start',
      position: { x: 250, y: 50 },
      data: { label: 'START' }
    }
  ]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [flows, setFlows] = useState<AttackFlowData[]>([]);
  const [selectedNodeType, setSelectedNodeType] = useState<'technique' | 'asset' | 'decision'>('technique');
  const [techniqueSearch, setTechniqueSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({
      ...connection,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed }
    }, eds)),
    []
  );

  const handleSearchTechniques = async () => {
    if (!techniqueSearch.trim()) return;

    try {
      const response = await api.get('/attck/techniques/search', {
        params: { query: techniqueSearch }
      });
      setSearchResults(response);
    } catch (error) {
      toast({
        title: 'Search failed',
        variant: 'destructive'
      });
    }
  };

  const handleAddTechniqueNode = (technique: any) => {
    const newNode: Node = {
      id: `${technique.techniqueId}-${Date.now()}`,
      type: 'technique',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 200
      },
      data: {
        label: technique.name,
        techniqueId: technique.techniqueId,
        name: technique.name
      }
    };

    setNodes((nds) => [...nds, newNode]);
    setAddNodeDialogOpen(false);
    toast({
      title: 'Node added',
      description: `${technique.techniqueId} added to flow`
    });
  };

  const handleAddAssetNode = () => {
    const newNode: Node = {
      id: `asset-${Date.now()}`,
      type: 'asset',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 200
      },
      data: {
        label: 'New Asset',
        assetType: 'system'
      }
    };

    setNodes((nds) => [...nds, newNode]);
    setAddNodeDialogOpen(false);
  };

  const handleAddDecisionNode = () => {
    const newNode: Node = {
      id: `decision-${Date.now()}`,
      type: 'decision',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 200
      },
      data: {
        label: 'Decision'
      }
    };

    setNodes((nds) => [...nds, newNode]);
    setAddNodeDialogOpen(false);
  };

  const handleAddEndNode = () => {
    const hasEndNode = nodes.some(n => n.type === 'end');
    if (hasEndNode) {
      toast({
        title: 'End node exists',
        description: 'Flow already has an end node',
        variant: 'destructive'
      });
      return;
    }

    const newNode: Node = {
      id: 'end',
      type: 'end',
      position: {
        x: 250,
        y: 600
      },
      data: {
        label: 'END'
      }
    };

    setNodes((nds) => [...nds, newNode]);
  };

  const handleExportFlow = () => {
    const flowData: AttackFlowData = {
      name: flowName || 'Untitled Flow',
      description: flowDescription,
      author: 'User',
      nodes: nodes as TechniqueNode[],
      edges,
      metadata: {
        operationId: operationId || undefined,
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      }
    };

    // Export as Attack Flow JSON spec
    const attackFlowSpec = {
      type: 'attack-flow',
      id: `attack-flow--${Date.now()}`,
      spec_version: '2.1',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      name: flowData.name,
      description: flowData.description,
      scope: operationId ? 'operation-specific' : 'general',
      start_refs: ['start'],
      actions: nodes.filter(n => n.type === 'technique').map((n: any) => ({
        type: 'attack-action',
        id: n.id,
        name: n.data.name,
        technique_id: n.data.techniqueId,
        asset: n.data.asset
      })),
      relationships: edges.map(e => ({
        type: 'flow',
        source_ref: e.source,
        target_ref: e.target
      }))
    };

    const blob = new Blob([JSON.stringify(attackFlowSpec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowName || 'attack-flow'}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Flow exported',
      description: 'Attack Flow exported as JSON'
    });
  };

  const handleSaveFlow = async () => {
    if (!flowName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a flow name',
        variant: 'destructive'
      });
      return;
    }

    try {
      const flowData: AttackFlowData = {
        name: flowName,
        description: flowDescription,
        author: 'User',
        nodes: nodes as TechniqueNode[],
        edges,
        metadata: {
          operationId: operationId || undefined,
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      };

      await api.post('/attck/attack-flows', flowData);

      toast({
        title: 'Flow saved',
        description: `${flowName} has been saved`
      });

      setSaveDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Save failed',
        variant: 'destructive'
      });
    }
  };

  const handleLoadFlow = async (flow: AttackFlowData) => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setFlowName(flow.name);
    setFlowDescription(flow.description);
    setLoadDialogOpen(false);

    toast({
      title: 'Flow loaded',
      description: `${flow.name} loaded successfully`
    });
  };

  const loadSavedFlows = async () => {
    try {
      const response = await api.get<AttackFlowData[]>('/attck/attack-flows', {
        params: { operationId: operationId || undefined }
      });
      setFlows(response);
    } catch (error) {
      toast({
        title: 'Failed to load flows',
        variant: 'destructive'
      });
    }
  };

  const handleExecuteFlow = async () => {
    if (nodes.filter(n => n.type === 'technique').length === 0) {
      toast({
        title: 'No techniques',
        description: 'Add techniques to the flow before executing',
        variant: 'destructive'
      });
      return;
    }

    if (!operationId) {
      toast({
        title: 'Operation required',
        description: 'Select an operation to execute this flow',
        variant: 'destructive'
      });
      return;
    }

    try {
      const techniqueNodes = nodes.filter(n => n.type === 'technique') as TechniqueNode[];
      const techniques = techniqueNodes.map(n => ({
        techniqueId: n.data.techniqueId,
        name: n.data.name,
        asset: n.data.asset,
        parameters: n.data.parameters
      }));

      const workflow = await api.post('/attck/attack-flows/execute', {
        operationId,
        flowName: flowName || 'Unnamed Flow',
        techniques,
        flowStructure: { nodes, edges }
      });

      toast({
        title: 'Flow execution started',
        description: `Workflow ${workflow.workflowId} created`,
        duration: 5000
      });
    } catch (error: any) {
      toast({
        title: 'Execution failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Input
              placeholder="Flow name"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="w-[250px]"
            />
            <Input
              placeholder="Flow description (optional)"
              value={flowDescription}
              onChange={(e) => setFlowDescription(e.target.value)}
              className="w-[350px]"
            />
          </div>

          <div className="flex gap-2">
            <Dialog open={addNodeDialogOpen} onOpenChange={setAddNodeDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Node
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Node to Attack Flow</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={selectedNodeType} onValueChange={(value: any) => setSelectedNodeType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technique">Technique Node</SelectItem>
                      <SelectItem value="asset">Asset Node</SelectItem>
                      <SelectItem value="decision">Decision Node (AND/OR)</SelectItem>
                    </SelectContent>
                  </Select>

                  {selectedNodeType === 'technique' && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Search techniques..."
                          value={techniqueSearch}
                          onChange={(e) => setTechniqueSearch(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearchTechniques()}
                        />
                        <Button onClick={handleSearchTechniques}>Search</Button>
                      </div>
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {searchResults.map((result) => (
                          <div key={result.techniqueId} className="p-3 border rounded-lg flex items-center justify-between">
                            <div>
                              <span className="font-medium">{result.techniqueId} - {result.name}</span>
                              <p className="text-sm text-muted-foreground line-clamp-1">{result.description}</p>
                            </div>
                            <Button size="sm" onClick={() => handleAddTechniqueNode(result)}>
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {selectedNodeType === 'asset' && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-4">
                        Add an asset node to represent systems, networks, or data targets
                      </p>
                      <Button onClick={handleAddAssetNode}>Add Asset Node</Button>
                    </div>
                  )}

                  {selectedNodeType === 'decision' && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-4">
                        Add a decision node to represent branching logic (AND/OR)
                      </p>
                      <Button onClick={handleAddDecisionNode}>Add Decision Node</Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={handleAddEndNode}>
              Add End
            </Button>

            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Attack Flow</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Save this flow for later use or sharing with team members.
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveFlow}>Save Flow</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={loadDialogOpen} onOpenChange={(open) => {
              setLoadDialogOpen(open);
              if (open) loadSavedFlows();
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Load
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Load Saved Flow</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {flows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No saved flows</p>
                  ) : (
                    flows.map((flow) => (
                      <div key={flow.name} className="p-3 border rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium">{flow.name}</p>
                          <p className="text-sm text-muted-foreground">{flow.description}</p>
                        </div>
                        <Button size="sm" onClick={() => handleLoadFlow(flow)}>
                          Load
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={handleExportFlow}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            <Button size="sm" onClick={handleExecuteFlow} disabled={!operationId}>
              <Play className="w-4 h-4 mr-2" />
              Execute Flow
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-0" style={{ height: '600px' }}>
        <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </Card>

      <Card className="p-4 bg-secondary/20">
        <h4 className="text-sm font-semibold mb-2">Instructions:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Click "Add Node" to add techniques, assets, or decision points</li>
          <li>• Drag nodes to position them on the canvas</li>
          <li>• Click and drag from one node to another to create connections</li>
          <li>• Use decision nodes to represent branching (AND/OR logic)</li>
          <li>• Save your flow for later use or export as Attack Flow JSON spec</li>
          <li>• Click "Execute Flow" to send the sequence to Operation Lead Agent</li>
        </ul>
      </Card>
    </div>
  );
}
```

This complete AttackFlowTab component provides:

**Core Features:**
1. **React Flow canvas** with drag-and-drop node positioning
2. **5 node types**: Technique, Asset, Decision (AND/OR), Start, End
3. **Visual connectors** with animated arrows between nodes
4. **Custom node styling** for each node type with technique IDs, names, and assets

**Flow Building:**
1. **Add nodes** via dialog with technique search, asset creation, decision logic
2. **Connect nodes** by dragging from one node to another
3. **Reposition nodes** with drag-and-drop on canvas
4. **Delete nodes/edges** using React Flow built-in controls

**Data Management:**
1. **Save flows** to database for later editing
2. **Load flows** from saved library
3. **Export to Attack Flow JSON** following the attack-flow specification v2.1
4. **Import flows** (can be extended with file upload)

**Execution:**
1. **Execute flow** button sends sequence to Operation Lead Agent
2. **Validation** ensures operation is selected and techniques are present
3. **Workflow generation** with flow structure preserved

**Integration Points:**
- API endpoints: `/attck/attack-flows` for CRUD operations
- Search endpoint: `/attck/techniques/search`
- Execute endpoint: `/attck/attack-flows/execute`
- React Flow library: `reactflow` for visual flow builder

### Estimated Effort
5-6 days

---

## Tab 5: Techniques (Browse All)

### Status: 🟡 Medium Priority

### Description
Searchable browser for all ATT&CK techniques with detailed information.

### Features

#### Complete TechniquesTab Component

```typescript
// client/src/components/attck/TechniquesTab.tsx
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useATTACK } from '@/contexts/ATTACKContext';
import api from '@/lib/api';
import { Search, Plus, ExternalLink } from 'lucide-react';

interface ATTACKTechnique {
  techniqueId: string;
  name: string;
  description: string;
  tactics: string[];
  platforms: string[];
  dataSources: string[];
  defenses: string[];
  permissions: string[];
  mitreUrl: string;
  relatedTechniques?: string[];
}

export default function TechniquesTab() {
  const [techniques, setTechniques] = useState<ATTACKTechnique[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tacticFilter, setTacticFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedTechnique, setSelectedTechnique] = useState<ATTACKTechnique | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { addTechnique } = useATTACK();
  const { toast } = useToast();

  useEffect(() => {
    loadTechniques();
  }, [tacticFilter, platformFilter]);

  const loadTechniques = async () => {
    setLoading(true);
    try {
      const response = await api.get<ATTACKTechnique[]>('/attck/techniques', {
        params: {
          tactic: tacticFilter !== 'all' ? tacticFilter : undefined,
          platform: platformFilter !== 'all' ? platformFilter : undefined
        }
      });
      setTechniques(response);
    } catch (error) {
      toast({ title: 'Failed to load techniques', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredTechniques = techniques.filter((tech) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tech.techniqueId.toLowerCase().includes(query) ||
      tech.name.toLowerCase().includes(query) ||
      tech.description.toLowerCase().includes(query)
    );
  });

  const handleViewDetails = async (technique: ATTACKTechnique) => {
    setSelectedTechnique(technique);
    setDetailsDialogOpen(true);
  };

  const handleAddToPlanner = (technique: ATTACKTechnique) => {
    addTechnique({
      techniqueId: technique.techniqueId,
      name: technique.name,
      tactics: technique.tactics,
      platforms: technique.platforms,
      description: technique.description,
      status: 'planned'
    });
    toast({
      title: 'Added to Planner',
      description: `${technique.techniqueId} added to your execution plan`
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search techniques by ID, name, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={tacticFilter} onValueChange={setTacticFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Tactics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tactics</SelectItem>
              <SelectItem value="reconnaissance">Reconnaissance</SelectItem>
              <SelectItem value="resource-development">Resource Development</SelectItem>
              <SelectItem value="initial-access">Initial Access</SelectItem>
              <SelectItem value="execution">Execution</SelectItem>
              <SelectItem value="persistence">Persistence</SelectItem>
              <SelectItem value="privilege-escalation">Privilege Escalation</SelectItem>
              <SelectItem value="defense-evasion">Defense Evasion</SelectItem>
              <SelectItem value="credential-access">Credential Access</SelectItem>
              <SelectItem value="discovery">Discovery</SelectItem>
              <SelectItem value="lateral-movement">Lateral Movement</SelectItem>
              <SelectItem value="collection">Collection</SelectItem>
              <SelectItem value="command-and-control">Command and Control</SelectItem>
              <SelectItem value="exfiltration">Exfiltration</SelectItem>
              <SelectItem value="impact">Impact</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="windows">Windows</SelectItem>
              <SelectItem value="linux">Linux</SelectItem>
              <SelectItem value="macos">macOS</SelectItem>
              <SelectItem value="cloud">Cloud</SelectItem>
              <SelectItem value="network">Network</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 text-sm text-muted-foreground">
          Showing {filteredTechniques.length} of {techniques.length} techniques
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-secondary rounded w-1/2 mb-3"></div>
              <div className="h-3 bg-secondary rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-secondary rounded w-full"></div>
            </Card>
          ))}
        </div>
      ) : filteredTechniques.length === 0 ? (
        <Card className="p-12 text-center">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No techniques found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTechniques.map((technique) => (
            <Card key={technique.techniqueId} className="p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-sm font-semibold text-primary">
                  {technique.techniqueId}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddToPlanner(technique)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <h3 className="font-semibold text-foreground mb-2">{technique.name}</h3>

              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {technique.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {technique.tactics.slice(0, 3).map((tactic) => (
                  <Badge key={tactic} variant="secondary" className="text-xs">
                    {tactic}
                  </Badge>
                ))}
                {technique.tactics.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{technique.tactics.length - 3}
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(technique)}
                  className="flex-1"
                >
                  Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(technique.mitreUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTechnique?.techniqueId} - {selectedTechnique?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedTechnique && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedTechnique.description}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Tactics</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTechnique.tactics.map((tactic) => (
                    <Badge key={tactic}>{tactic}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTechnique.platforms.map((platform) => (
                    <Badge key={platform} variant="outline">{platform}</Badge>
                  ))}
                </div>
              </div>

              {selectedTechnique.dataSources.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Data Sources</h4>
                  <ul className="text-sm text-muted-foreground list-disc list-inside">
                    {selectedTechnique.dataSources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedTechnique.relatedTechniques && selectedTechnique.relatedTechniques.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Related Techniques</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTechnique.relatedTechniques.map((rel) => (
                      <Badge key={rel} variant="secondary" className="cursor-pointer">
                        {rel}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={() => handleAddToPlanner(selectedTechnique)} className="flex-1">
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Planner
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedTechnique.mitreUrl, '_blank')}
                >
                  View on MITRE ATT&CK
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Key Features:**
1. **Full technique catalog** with grid layout displaying all ATT&CK techniques
2. **Multi-filter search** by technique ID, name, description, tactic, and platform
3. **Technique cards** showing ID, name, description preview, and tactics
4. **Details modal** with full technique information including data sources and related techniques
5. **Add to Planner** button to quickly add techniques to execution plan
6. **MITRE ATT&CK links** to official technique pages
7. **Related techniques** displayed in details modal for exploration

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
Manage STIX collections including imports, exports, and custom libraries. This tab is an alias to the Workbench Tab (Tab 3) for users who are more familiar with "Collections" terminology.

### Features

**Note**: The Collections Manager tab is functionally identical to the Workbench Tab, with the same component implementation. This provides an alternate entry point for users who think in terms of "collections" rather than "workbench".

```typescript
// client/src/components/attck/CollectionsTab.tsx
import WorkbenchTab from './WorkbenchTab';

export default WorkbenchTab;
```

**Key Features** (inherited from WorkbenchTab):
1. **Collections browser** with grid layout showing all STIX collections
2. **CRUD operations** for creating, viewing, editing, and deleting collections
3. **Multi-filter support** by collection type, status, and search query
4. **STIX import/export** for data portability and threat intelligence sharing
5. **Approval workflow** for agent-created collections (draft → staged → approved → executed)
6. **Collection versioning** tracked through created/modified timestamps
7. **Collection statistics** showing technique counts, coverage, time estimates
8. **Agent tracking** with special indicators for agent-created collections

**Additional Features Specific to Collections View:**
- **Collection versioning**: Track history of changes to collections over time
- **Diff viewer**: Compare collection versions to see what changed
- **Merge collections**: Combine multiple collections into one
- **Fork collections**: Create a copy of a collection for modification
- **Share collections**: Export and share with other RTPI instances or teams

### Implementation Checklist
- [ ] Create CollectionsTab component (alias to WorkbenchTab)
- [ ] Display all collections (inherited from Workbench)
- [ ] Implement import/export (inherited from Workbench)
- [ ] Add collection versioning
- [ ] Show collection statistics (inherited from Workbench)
- [ ] Add diff viewer for version comparison
- [ ] Implement collection merge functionality
- [ ] Add fork/clone collection feature

### Estimated Effort
2-3 days

---

## ATT&CK Workbench REST API Integration

### Overview
Integration with [ATT&CK Workbench](https://github.com/center-for-threat-informed-defense/attack-workbench-frontend) REST API for managing ATT&CK data objects.

### REST API Service

```typescript
// server/services/attck-workbench-connector.ts
import axios, { AxiosInstance } from 'axios';

interface QueryParams {
  limit?: number;
  offset?: number;
  domain?: 'enterprise-attack' | 'mobile-attack' | 'ics-attack';
  status?: 'work-in-progress' | 'awaiting-review' | 'reviewed';
  lastUpdatedBy?: string;
  includePagination?: boolean;
  includeRevoked?: boolean;
  includeDeprecated?: boolean;
}

interface WorkbenchTechnique {
  stix: {
    id: string;
    type: 'attack-pattern';
    name: string;
    description: string;
    external_references: Array<{ source_name: string; external_id: string; url: string }>;
    x_mitre_platforms: string[];
    x_mitre_tactics: string[];
    x_mitre_data_sources: string[];
    kill_chain_phases: Array<{ kill_chain_name: string; phase_name: string }>;
  };
  workspace: {
    workflow: { state: string };
    attack_id: string;
  };
}

interface STIXBundle {
  type: 'bundle';
  id: string;
  spec_version: '2.1';
  objects: any[];
}

export class ATTCKWorkbenchConnector {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.ATTCK_WORKBENCH_URL || 'http://localhost:3000/api';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // ==================== Techniques ====================
  async getTechniques(params?: QueryParams): Promise<WorkbenchTechnique[]> {
    try {
      const response = await this.client.get('/attack-patterns', { params });
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(`Failed to get techniques: ${error.message}`);
    }
  }

  async getTechnique(stixId: string): Promise<WorkbenchTechnique> {
    try {
      const response = await this.client.get(`/attack-patterns/${stixId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get technique ${stixId}: ${error.message}`);
    }
  }

  async getTechniqueByAttackId(attackId: string): Promise<WorkbenchTechnique> {
    try {
      const techniques = await this.getTechniques({ limit: 1000 });
      const technique = techniques.find(
        t => t.workspace.attack_id === attackId ||
             t.stix.external_references.some(ref => ref.external_id === attackId)
      );
      if (!technique) {
        throw new Error(`Technique ${attackId} not found`);
      }
      return technique;
    } catch (error: any) {
      throw new Error(`Failed to get technique by attack ID ${attackId}: ${error.message}`);
    }
  }

  async createTechnique(technique: Partial<WorkbenchTechnique>): Promise<WorkbenchTechnique> {
    try {
      const response = await this.client.post('/attack-patterns', technique);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create technique: ${error.message}`);
    }
  }

  async updateTechnique(stixId: string, technique: Partial<WorkbenchTechnique>): Promise<WorkbenchTechnique> {
    try {
      const response = await this.client.put(`/attack-patterns/${stixId}`, technique);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to update technique ${stixId}: ${error.message}`);
    }
  }

  async deleteTechnique(stixId: string): Promise<void> {
    try {
      await this.client.delete(`/attack-patterns/${stixId}`);
    } catch (error: any) {
      throw new Error(`Failed to delete technique ${stixId}: ${error.message}`);
    }
  }

  // ==================== Tactics ====================
  async getTactics(params?: QueryParams): Promise<any[]> {
    try {
      const response = await this.client.get('/x-mitre-tactics', { params });
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(`Failed to get tactics: ${error.message}`);
    }
  }

  async getTactic(stixId: string): Promise<any> {
    try {
      const response = await this.client.get(`/x-mitre-tactics/${stixId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get tactic ${stixId}: ${error.message}`);
    }
  }

  // ==================== Collections ====================
  async getCollections(params?: QueryParams): Promise<any[]> {
    try {
      const response = await this.client.get('/collections', { params });
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(`Failed to get collections: ${error.message}`);
    }
  }

  async getCollection(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/collections/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get collection ${id}: ${error.message}`);
    }
  }

  async createCollection(collection: { name: string; description: string; contents?: string[] }): Promise<any> {
    try {
      const response = await this.client.post('/collections', collection);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create collection: ${error.message}`);
    }
  }

  async updateCollection(id: string, collection: Partial<any>): Promise<any> {
    try {
      const response = await this.client.put(`/collections/${id}`, collection);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to update collection ${id}: ${error.message}`);
    }
  }

  async deleteCollection(id: string): Promise<void> {
    try {
      await this.client.delete(`/collections/${id}`);
    } catch (error: any) {
      throw new Error(`Failed to delete collection ${id}: ${error.message}`);
    }
  }

  async exportCollection(id: string): Promise<STIXBundle> {
    try {
      const response = await this.client.get(`/collections/${id}/bundle`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to export collection ${id}: ${error.message}`);
    }
  }

  async importBundle(bundle: STIXBundle): Promise<{ imported: number; errors: any[] }> {
    try {
      const response = await this.client.post('/collection-bundles', bundle);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to import bundle: ${error.message}`);
    }
  }

  // ==================== Software/Tools ====================
  async getSoftware(params?: QueryParams): Promise<any[]> {
    try {
      const response = await this.client.get('/software', { params });
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(`Failed to get software: ${error.message}`);
    }
  }

  // ==================== Groups (Threat Actors) ====================
  async getGroups(params?: QueryParams): Promise<any[]> {
    try {
      const response = await this.client.get('/groups', { params });
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(`Failed to get groups: ${error.message}`);
    }
  }

  // ==================== Relationships ====================
  async getRelationships(params?: QueryParams): Promise<any[]> {
    try {
      const response = await this.client.get('/relationships', { params });
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(`Failed to get relationships: ${error.message}`);
    }
  }

  // ==================== Health Check ====================
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

export default new ATTCKWorkbenchConnector();
```

**Key Features:**
1. **RESTful API client** using axios with configurable base URL
2. **Complete CRUD operations** for techniques, tactics, collections
3. **STIX bundle import/export** for data portability
4. **Query parameter support** for filtering, pagination, status
5. **Error handling** with descriptive error messages
6. **Health check** to verify Workbench connectivity
7. **Relationship mapping** for technique dependencies
8. **Software and group management** for threat intelligence

### Implementation Checklist
- [ ] Create Workbench connector service
- [ ] Implement technique CRUD
- [ ] Implement tactic operations
- [ ] Implement collection operations
- [ ] Add software/tool management
- [ ] Add group (threat actor) management
- [ ] Implement relationship mapping
- [ ] Add error handling and retry logic

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

```typescript
// server/services/stix-data-importer.ts
import axios from 'axios';
import { db } from '../db';
import { stixObjects } from '../../shared/schema';

interface ImportResult {
  techniques: number;
  tactics: number;
  mitigations: number;
  groups: number;
  software: number;
  relationships: number;
  errors: string[];
}

interface STIXBundle {
  type: 'bundle';
  id: string;
  spec_version: string;
  objects: STIXObject[];
}

interface STIXObject {
  type: string;
  id: string;
  name: string;
  description?: string;
  created: string;
  modified: string;
  x_mitre_version?: string;
  x_mitre_platforms?: string[];
  x_mitre_domains?: string[];
  external_references?: Array<{ source_name: string; external_id?: string; url?: string }>;
  kill_chain_phases?: Array<{ kill_chain_name: string; phase_name: string }>;
  [key: string]: any;
}

export class STIXDataImporter {
  private readonly GITHUB_RAW_URL = 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master';

  async importEnterprise(): Promise<ImportResult> {
    const url = `${this.GITHUB_RAW_URL}/enterprise-attack/enterprise-attack.json`;
    return this.fetchAndImport(url, 'enterprise-attack');
  }

  async importMobile(): Promise<ImportResult> {
    const url = `${this.GITHUB_RAW_URL}/mobile-attack/mobile-attack.json`;
    return this.fetchAndImport(url, 'mobile-attack');
  }

  async importICS(): Promise<ImportResult> {
    const url = `${this.GITHUB_RAW_URL}/ics-attack/ics-attack.json`;
    return this.fetchAndImport(url, 'ics-attack');
  }

  private async fetchAndImport(url: string, source: string): Promise<ImportResult> {
    try {
      console.log(`Fetching STIX bundle from: ${url}`);
      const response = await axios.get<STIXBundle>(url);
      const bundle = response.data;

      console.log(`Processing ${bundle.objects.length} STIX objects from ${source}`);
      return await this.processBundle(bundle, source);
    } catch (error: any) {
      throw new Error(`Failed to fetch/import STIX data: ${error.message}`);
    }
  }

  private async processBundle(bundle: STIXBundle, source: string): Promise<ImportResult> {
    const result: ImportResult = {
      techniques: 0,
      tactics: 0,
      mitigations: 0,
      groups: 0,
      software: 0,
      relationships: 0,
      errors: []
    };

    for (const obj of bundle.objects) {
      try {
        await this.processObject(obj, source);

        // Count by type
        switch (obj.type) {
          case 'attack-pattern':
            result.techniques++;
            break;
          case 'x-mitre-tactic':
            result.tactics++;
            break;
          case 'course-of-action':
            result.mitigations++;
            break;
          case 'intrusion-set':
            result.groups++;
            break;
          case 'malware':
          case 'tool':
            result.software++;
            break;
          case 'relationship':
            result.relationships++;
            break;
        }
      } catch (error: any) {
        result.errors.push(`Error processing ${obj.id}: ${error.message}`);
      }
    }

    console.log(`Import complete for ${source}:`, result);
    return result;
  }

  private async processObject(obj: STIXObject, source: string): Promise<void> {
    // Extract x_mitre_id from external references
    const mitreRef = obj.external_references?.find(ref => ref.source_name === 'mitre-attack');
    const xMitreId = mitreRef?.external_id || null;

    // Upsert into stix_objects table
    await db
      .insert(stixObjects)
      .values({
        stixId: obj.id,
        stixType: obj.type,
        name: obj.name,
        description: obj.description || '',
        created: new Date(obj.created),
        modified: new Date(obj.modified),
        xMitreId,
        xMitrePlatforms: obj.x_mitre_platforms || null,
        xMitreDomains: obj.x_mitre_domains || null,
        xMitreVersion: obj.x_mitre_version || null,
        xMitreDeprecated: obj.x_mitre_deprecated || false,
        rawStix: obj,
        source
      })
      .onConflictDoUpdate({
        target: stixObjects.stixId,
        set: {
          name: obj.name,
          description: obj.description || '',
          modified: new Date(obj.modified),
          xMitreVersion: obj.x_mitre_version || null,
          xMitreDeprecated: obj.x_mitre_deprecated || false,
          rawStix: obj
        }
      });
  }

  async syncAll(): Promise<{ enterprise: ImportResult; mobile: ImportResult; ics: ImportResult }> {
    console.log('Starting full ATT&CK sync...');
    const [enterprise, mobile, ics] = await Promise.all([
      this.importEnterprise(),
      this.importMobile(),
      this.importICS()
    ]);
    console.log('Full ATT&CK sync complete');
    return { enterprise, mobile, ics };
  }
}

export default new STIXDataImporter();
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

**Key Features:**
1. **Automatic fetching** from official MITRE ATT&CK GitHub repository
2. **Three domain support**: Enterprise, Mobile, and ICS ATT&CK
3. **Upsert logic** to handle updates and prevent duplicates
4. **Parallel sync** for all three domains simultaneously
5. **Error tracking** with detailed error messages per object
6. **Object counting** by type (techniques, tactics, mitigations, groups, software, relationships)
7. **Database integration** with Drizzle ORM for type-safe queries

### Estimated Effort
3-4 days

---

## Agent-Workbench Bridge

### Overview
Enable Operation Lead and Technical Writer agents to stage content in ATT&CK Workbench as collections.

### Operation Lead → Workbench Flow

```typescript
// server/services/agent-workbench-bridge.ts
import { db } from '../db';
import { stixCollections, stixCollectionContents, agentWorkflows } from '../../shared/schema';
import workbenchConnector from './attck-workbench-connector';

interface ExecutionPlan {
  name: string;
  description: string;
  techniques: Array<{
    techniqueId: string;
    name: string;
    tactics: string[];
    parameters?: string;
    priority?: 'high' | 'medium' | 'low';
  }>;
  metadata: {
    coverage: number;
    estimatedTime: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export class AgentWorkbenchBridge {
  /**
   * Operation Lead creates an execution plan and stages it as a collection
   * This is called when the "Send to Operation Lead" button is clicked
   */
  async stageExecutionPlan(
    agentId: string,
    operationId: string,
    plan: ExecutionPlan
  ): Promise<{ collectionId: string; workflowId: string }> {
    // 1. Create collection in local database
    const [collection] = await db
      .insert(stixCollections)
      .values({
        name: plan.name,
        description: plan.description,
        type: 'execution_plan',
        status: 'staged',
        operationId,
        createdBy: agentId,
        createdByAgent: true,
        metadata: plan.metadata
      })
      .returning();

    // 2. Add techniques to collection contents
    for (const technique of plan.techniques) {
      await db.insert(stixCollectionContents).values({
        collectionId: collection.id,
        techniqueId: technique.techniqueId,
        name: technique.name,
        tactics: technique.tactics,
        parameters: technique.parameters,
        priority: technique.priority || 'medium'
      });
    }

    // 3. Stage in ATT&CK Workbench (if connected)
    try {
      const workbenchCollection = await workbenchConnector.createCollection({
        name: `[RTPI] ${plan.name}`,
        description: `Auto-staged by Operation Lead Agent\n\n${plan.description}`,
        contents: plan.techniques.map(t => t.techniqueId)
      });

      await db
        .update(stixCollections)
        .set({ workbenchCollectionId: workbenchCollection.id })
        .where({ id: collection.id });
    } catch (error) {
      console.warn('Failed to stage in Workbench:', error);
      // Continue without Workbench integration
    }

    // 4. Create agent workflow for tracking
    const [workflow] = await db
      .insert(agentWorkflows)
      .values({
        operationId,
        agentId,
        type: 'execution_plan',
        status: 'pending_approval',
        input: { collectionId: collection.id, plan },
        output: {}
      })
      .returning();

    // 5. Notify users that plan needs approval
    await this.notifyApprovalRequired(collection.id, workflow.id);

    return {
      collectionId: collection.id,
      workflowId: workflow.id
    };
  }

  /**
   * Technical Writer documents findings and stages them as a collection
   * This is called after agent executes techniques and analyzes results
   */
  async stageFindings(
    agentId: string,
    operationId: string,
    findings: Finding[]
  ): Promise<{ collectionId: string; workflowId: string }> {
    // 1. Map findings to ATT&CK techniques
    const mappedTechniques = await this.mapFindingsToTechniques(findings);

    // 2. Create findings collection
    const [collection] = await db
      .insert(stixCollections)
      .values({
        name: `Findings Report - ${new Date().toISOString().split('T')[0]}`,
        description: `Documented findings from ${findings.length} exploitation attempts`,
        type: 'findings_report',
        status: 'staged',
        operationId,
        createdBy: agentId,
        createdByAgent: true,
        metadata: {
          findingCount: findings.length,
          successfulExploits: findings.filter(f => f.success).length,
          severity: this.calculateOverallSeverity(findings)
        }
      })
      .returning();

    // 3. Add techniques and findings to collection
    for (const mapped of mappedTechniques) {
      await db.insert(stixCollectionContents).values({
        collectionId: collection.id,
        techniqueId: mapped.techniqueId,
        name: mapped.techniqueName,
        tactics: mapped.tactics,
        findings: mapped.findings,
        evidence: mapped.evidence,
        recommendations: mapped.recommendations
      });
    }

    // 4. Stage in Workbench
    try {
      const workbenchCollection = await workbenchConnector.createCollection({
        name: `[RTPI] Findings - ${collection.name}`,
        description: collection.description,
        contents: mappedTechniques.map(m => m.techniqueId)
      });

      await db
        .update(stixCollections)
        .set({ workbenchCollectionId: workbenchCollection.id })
        .where({ id: collection.id });
    } catch (error) {
      console.warn('Failed to stage findings in Workbench:', error);
    }

    // 5. Create workflow for report generation
    const [workflow] = await db
      .insert(agentWorkflows)
      .values({
        operationId,
        agentId,
        type: 'findings_report',
        status: 'pending_approval',
        input: { collectionId: collection.id, findings },
        output: {}
      })
      .returning();

    // 6. Trigger report generation (if approved)
    await this.notifyReportReady(collection.id, workflow.id);

    return {
      collectionId: collection.id,
      workflowId: workflow.id
    };
  }

  /**
   * Approve a staged collection and trigger execution/reporting
   */
  async approveCollection(
    collectionId: string,
    approvedBy: string
  ): Promise<void> {
    const collection = await db.query.stixCollections.findFirst({
      where: (collections, { eq }) => eq(collections.id, collectionId)
    });

    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    await db
      .update(stixCollections)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date()
      })
      .where({ id: collectionId });

    // Trigger appropriate workflow based on collection type
    if (collection.type === 'execution_plan') {
      await this.executeApprovedPlan(collectionId);
    } else if (collection.type === 'findings_report') {
      await this.generateApprovedReport(collectionId);
    }
  }

  private async executeApprovedPlan(collectionId: string): Promise<void> {
    // Fetch collection and techniques
    const contents = await db.query.stixCollectionContents.findMany({
      where: (contents, { eq }) => eq(contents.collectionId, collectionId)
    });

    // Create agent tasks for each technique
    for (const technique of contents) {
      await this.createAgentTask({
        operationId: collection.operationId,
        techniqueId: technique.techniqueId,
        parameters: technique.parameters,
        priority: technique.priority
      });
    }
  }

  private async generateApprovedReport(collectionId: string): Promise<void> {
    // Trigger Technical Writer agent to generate final report
    // This would integrate with existing report generation service
    console.log(`Generating report for collection ${collectionId}`);
  }

  private async mapFindingsToTechniques(findings: Finding[]): Promise<MappedTechnique[]> {
    // Map exploitation findings to ATT&CK techniques based on attack vectors
    const mapped: MappedTechnique[] = [];

    for (const finding of findings) {
      // Use AI or rule-based mapping to identify techniques
      const technique = await this.identifyTechnique(finding);
      mapped.push({
        techniqueId: technique.id,
        techniqueName: technique.name,
        tactics: technique.tactics,
        findings: [finding.description],
        evidence: finding.evidence || [],
        recommendations: finding.recommendations || []
      });
    }

    return mapped;
  }

  private async notifyApprovalRequired(collectionId: string, workflowId: string): Promise<void> {
    // Send notification to users with approval permissions
    console.log(`Collection ${collectionId} requires approval (workflow ${workflowId})`);
  }

  private async notifyReportReady(collectionId: string, workflowId: string): Promise<void> {
    // Notify users that findings report is ready for review
    console.log(`Findings report ${collectionId} ready for review (workflow ${workflowId})`);
  }

  private calculateOverallSeverity(findings: Finding[]): string {
    const severities = findings.map(f => f.severity || 'low');
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }
}

interface Finding {
  id: string;
  targetId: string;
  vulnerabilityId?: string;
  description: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  success: boolean;
  evidence?: string[];
  recommendations?: string[];
  attackVector?: string;
}

interface MappedTechnique {
  techniqueId: string;
  techniqueName: string;
  tactics: string[];
  findings: string[];
  evidence: string[];
  recommendations: string[];
}

export default new AgentWorkbenchBridge();
```

**Key Features:**
1. **Two-way integration**: Agents can stage collections, users can approve them
2. **Automatic Workbench sync**: Collections are mirrored to ATT&CK Workbench when available
3. **Approval workflow**: Staged collections require user approval before execution
4. **Finding-to-technique mapping**: Automatically maps exploitation results to ATT&CK techniques
5. **Workflow tracking**: Each collection has an associated agent workflow for monitoring
6. **Notification system**: Users are notified when approval is required
7. **Execution triggers**: Approved execution plans automatically create agent tasks

### Implementation Checklist
- [ ] Create agent-workbench bridge service
- [ ] Implement Op Lead staging workflow
- [ ] Implement Technical Writer staging workflow
- [ ] Add collection approval workflow
- [ ] Create agent → planner integration
- [ ] Add notification system
- [ ] Implement execution triggers

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
```sql
CREATE TABLE stix_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'execution_plan', 'findings_report', 'custom_techniques', 'imported_intel'
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'staged', 'approved', 'executed', 'archived'
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  workbench_collection_id TEXT, -- ID in external ATT&CK Workbench
  created_by UUID NOT NULL REFERENCES users(id),
  created_by_agent BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}', -- coverage, estimatedTime, riskLevel, etc.
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_stix_collections_operation ON stix_collections(operation_id);
CREATE INDEX idx_stix_collections_type ON stix_collections(type);
CREATE INDEX idx_stix_collections_status ON stix_collections(status);
CREATE INDEX idx_stix_collections_created_by ON stix_collections(created_by);
```

#### stix_collection_contents
```sql
CREATE TABLE stix_collection_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES stix_collections(id) ON DELETE CASCADE,
  technique_id TEXT NOT NULL, -- ATT&CK technique ID (e.g., T1595, T1190.001)
  name TEXT NOT NULL,
  tactics JSONB NOT NULL DEFAULT '[]', -- Array of tactic names
  parameters TEXT, -- Execution parameters for the technique
  priority VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
  status VARCHAR(20), -- 'planned', 'in_progress', 'completed', 'failed'
  findings JSONB DEFAULT '[]', -- Array of finding descriptions
  evidence JSONB DEFAULT '[]', -- Array of evidence items
  recommendations JSONB DEFAULT '[]', -- Array of recommendation strings
  execution_result JSONB, -- Results from agent execution
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_collection_contents_collection ON stix_collection_contents(collection_id);
CREATE INDEX idx_collection_contents_technique ON stix_collection_contents(technique_id);
CREATE INDEX idx_collection_contents_status ON stix_collection_contents(status);
```

#### attck_technique_mapping
```sql
CREATE TABLE attck_technique_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  target_id UUID REFERENCES targets(id) ON DELETE SET NULL,
  vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE SET NULL,
  technique_id TEXT NOT NULL, -- ATT&CK technique ID
  technique_name TEXT NOT NULL,
  tactics JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL, -- 'planned', 'executed', 'successful', 'failed'
  agent_id UUID REFERENCES agents(id),
  workflow_id UUID REFERENCES agent_workflows(id),
  execution_timestamp TIMESTAMP,
  success BOOLEAN,
  notes TEXT,
  evidence JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_technique_mapping_operation ON attck_technique_mapping(operation_id);
CREATE INDEX idx_technique_mapping_target ON attck_technique_mapping(target_id);
CREATE INDEX idx_technique_mapping_technique ON attck_technique_mapping(technique_id);
CREATE INDEX idx_technique_mapping_status ON attck_technique_mapping(status);
CREATE INDEX idx_technique_mapping_agent ON attck_technique_mapping(agent_id);
```

### Migration Files

**File:** `migrations/0007_add_attck_integration.sql`

```sql
-- Migration: Add ATT&CK Integration Tables
-- Description: Adds tables for STIX objects, collections, and ATT&CK technique mapping
-- Date: 2025-01-XX

BEGIN;

-- ==================== STIX Objects Table ====================
CREATE TABLE IF NOT EXISTS stix_objects (
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

CREATE INDEX idx_stix_objects_stix_id ON stix_objects(stix_id);
CREATE INDEX idx_stix_objects_type ON stix_objects(stix_type);
CREATE INDEX idx_stix_objects_mitre_id ON stix_objects(x_mitre_id);
CREATE INDEX idx_stix_objects_source ON stix_objects(source);

-- ==================== STIX Collections Table ====================
CREATE TABLE IF NOT EXISTS stix_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  workbench_collection_id TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_by_agent BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_stix_collections_operation ON stix_collections(operation_id);
CREATE INDEX idx_stix_collections_type ON stix_collections(type);
CREATE INDEX idx_stix_collections_status ON stix_collections(status);
CREATE INDEX idx_stix_collections_created_by ON stix_collections(created_by);

-- ==================== STIX Collection Contents Table ====================
CREATE TABLE IF NOT EXISTS stix_collection_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES stix_collections(id) ON DELETE CASCADE,
  technique_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tactics JSONB NOT NULL DEFAULT '[]',
  parameters TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20),
  findings JSONB DEFAULT '[]',
  evidence JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  execution_result JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_collection_contents_collection ON stix_collection_contents(collection_id);
CREATE INDEX idx_collection_contents_technique ON stix_collection_contents(technique_id);
CREATE INDEX idx_collection_contents_status ON stix_collection_contents(status);

-- ==================== ATT&CK Technique Mapping Table ====================
CREATE TABLE IF NOT EXISTS attck_technique_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  target_id UUID REFERENCES targets(id) ON DELETE SET NULL,
  vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE SET NULL,
  technique_id TEXT NOT NULL,
  technique_name TEXT NOT NULL,
  tactics JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL,
  agent_id UUID REFERENCES agents(id),
  workflow_id UUID REFERENCES agent_workflows(id),
  execution_timestamp TIMESTAMP,
  success BOOLEAN,
  notes TEXT,
  evidence JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_technique_mapping_operation ON attck_technique_mapping(operation_id);
CREATE INDEX idx_technique_mapping_target ON attck_technique_mapping(target_id);
CREATE INDEX idx_technique_mapping_technique ON attck_technique_mapping(technique_id);
CREATE INDEX idx_technique_mapping_status ON attck_technique_mapping(status);
CREATE INDEX idx_technique_mapping_agent ON attck_technique_mapping(agent_id);

-- ==================== Attack Flows Table ====================
CREATE TABLE IF NOT EXISTS attack_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_attack_flows_operation ON attack_flows(operation_id);
CREATE INDEX idx_attack_flows_created_by ON attack_flows(created_by);

-- ==================== Functions ====================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_stix_collections_updated_at
  BEFORE UPDATE ON stix_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stix_collection_contents_updated_at
  BEFORE UPDATE ON stix_collection_contents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attck_technique_mapping_updated_at
  BEFORE UPDATE ON attck_technique_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attack_flows_updated_at
  BEFORE UPDATE ON attack_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

**Rollback Script:** `migrations/0007_add_attck_integration_rollback.sql`

```sql
BEGIN;

DROP TABLE IF EXISTS attack_flows CASCADE;
DROP TABLE IF EXISTS attck_technique_mapping CASCADE;
DROP TABLE IF EXISTS stix_collection_contents CASCADE;
DROP TABLE IF EXISTS stix_collections CASCADE;
DROP TABLE IF EXISTS stix_objects CASCADE;

DROP TRIGGER IF EXISTS update_stix_collections_updated_at ON stix_collections;
DROP TRIGGER IF EXISTS update_stix_collection_contents_updated_at ON stix_collection_contents;
DROP TRIGGER IF EXISTS update_attck_technique_mapping_updated_at ON attck_technique_mapping;
DROP TRIGGER IF EXISTS update_attack_flows_updated_at ON attack_flows;

COMMIT;
```

---

## API Endpoints

### ATT&CK API

Complete REST API implementation at `/server/api/v1/attck.ts`:

```typescript
// server/api/v1/attck.ts
import { Router } from 'express';
import { db } from '../../db';
import { stixObjects, stixCollections, stixCollectionContents, attackFlows } from '../../../shared/schema';
import workbenchConnector from '../../services/attck-workbench-connector';
import stixImporter from '../../services/stix-data-importer';
import agentBridge from '../../services/agent-workbench-bridge';
import { authenticateSession } from '../../middleware/auth';

const router = Router();

// ==================== Techniques ====================

/**
 * GET /api/v1/attck/techniques
 * Get all ATT&CK techniques with optional filtering
 */
router.get('/techniques', authenticateSession, async (req, res) => {
  try {
    const { tactic, platform, domain, deprecated } = req.query;

    let query = db.select().from(stixObjects).where(eq(stixObjects.stixType, 'attack-pattern'));

    if (tactic) {
      query = query.where(sql`${stixObjects.rawStix}->>'x_mitre_tactics' @> ${JSON.stringify([tactic])}`);
    }

    if (platform) {
      query = query.where(sql`${stixObjects.rawStix}->>'x_mitre_platforms' @> ${JSON.stringify([platform])}`);
    }

    if (domain) {
      query = query.where(sql`${stixObjects.rawStix}->>'x_mitre_domains' @> ${JSON.stringify([domain])}`);
    }

    if (deprecated !== 'true') {
      query = query.where(eq(stixObjects.xMitreDeprecated, false));
    }

    const techniques = await query;

    res.json(techniques.map(t => ({
      techniqueId: t.xMitreId,
      stixId: t.stixId,
      name: t.name,
      description: t.description,
      tactics: t.rawStix.kill_chain_phases?.map((p: any) => p.phase_name) || [],
      platforms: t.xMitrePlatforms || [],
      dataSources: t.rawStix.x_mitre_data_sources || [],
      mitreUrl: `https://attack.mitre.org/techniques/${t.xMitreId}`,
      deprecated: t.xMitreDeprecated
    })));
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch techniques', message: error.message });
  }
});

/**
 * GET /api/v1/attck/techniques/search
 * Search techniques by keyword
 */
router.get('/techniques/search', authenticateSession, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const searchQuery = `%${query}%`;
    const techniques = await db
      .select()
      .from(stixObjects)
      .where(
        and(
          eq(stixObjects.stixType, 'attack-pattern'),
          or(
            like(stixObjects.name, searchQuery),
            like(stixObjects.xMitreId, searchQuery),
            like(stixObjects.description, searchQuery)
          )
        )
      )
      .limit(50);

    res.json(techniques.map(t => ({
      techniqueId: t.xMitreId,
      name: t.name,
      description: t.description,
      tactics: t.rawStix.kill_chain_phases?.map((p: any) => p.phase_name) || [],
      platforms: t.xMitrePlatforms || []
    })));
  } catch (error: any) {
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

/**
 * GET /api/v1/attck/techniques/:id
 * Get single technique by ATT&CK ID
 */
router.get('/techniques/:id', authenticateSession, async (req, res) => {
  try {
    const { id } = req.params;

    const technique = await db.query.stixObjects.findFirst({
      where: (objects, { eq }) => eq(objects.xMitreId, id)
    });

    if (!technique) {
      return res.status(404).json({ error: 'Technique not found' });
    }

    res.json({
      techniqueId: technique.xMitreId,
      name: technique.name,
      description: technique.description,
      tactics: technique.rawStix.kill_chain_phases?.map((p: any) => p.phase_name) || [],
      platforms: technique.xMitrePlatforms || [],
      dataSources: technique.rawStix.x_mitre_data_sources || [],
      defenses: technique.rawStix.x_mitre_defenses_bypassed || [],
      permissions: technique.rawStix.x_mitre_permissions_required || [],
      mitreUrl: `https://attack.mitre.org/techniques/${technique.xMitreId}`,
      relatedTechniques: [] // TODO: implement relationship lookup
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch technique', message: error.message });
  }
});

// ==================== Tactics ====================

/**
 * GET /api/v1/attck/tactics
 * Get all ATT&CK tactics
 */
router.get('/tactics', authenticateSession, async (req, res) => {
  try {
    const tactics = await db
      .select()
      .from(stixObjects)
      .where(eq(stixObjects.stixType, 'x-mitre-tactic'));

    res.json(tactics.map(t => ({
      tacticId: t.xMitreId,
      name: t.name,
      description: t.description,
      shortName: t.rawStix.x_mitre_shortname
    })));
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch tactics', message: error.message });
  }
});

// ==================== Matrix ====================

/**
 * GET /api/v1/attck/matrix
 * Get ATT&CK matrix with all tactics and techniques
 */
router.get('/matrix', authenticateSession, async (req, res) => {
  try {
    const { operationId } = req.query;

    // Get all tactics
    const tactics = await db
      .select()
      .from(stixObjects)
      .where(eq(stixObjects.stixType, 'x-mitre-tactic'))
      .orderBy(stixObjects.name);

    // Get all techniques
    const techniques = await db
      .select()
      .from(stixObjects)
      .where(
        and(
          eq(stixObjects.stixType, 'attack-pattern'),
          eq(stixObjects.xMitreDeprecated, false)
        )
      );

    // If operation specified, get execution status
    let techniqueStatuses = {};
    if (operationId) {
      const mappings = await db
        .select()
        .from(attckTechniqueMapping)
        .where(eq(attckTechniqueMapping.operationId, operationId));

      techniqueStatuses = mappings.reduce((acc, m) => {
        acc[m.techniqueId] = m.status;
        return acc;
      }, {});
    }

    res.json({
      tactics: tactics.map(t => ({
        id: t.xMitreId,
        name: t.name,
        shortName: t.rawStix.x_mitre_shortname
      })),
      techniques: techniques.map(t => ({
        techniqueId: t.xMitreId,
        name: t.name,
        description: t.description,
        tactics: t.rawStix.kill_chain_phases?.map((p: any) => p.phase_name) || [],
        platforms: t.xMitrePlatforms || [],
        status: techniqueStatuses[t.xMitreId] || 'available'
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch matrix', message: error.message });
  }
});

// ==================== Collections ====================

/**
 * GET /api/v1/attck/collections
 * Get all collections with optional filtering
 */
router.get('/collections', authenticateSession, async (req, res) => {
  try {
    const { operationId, type, status } = req.query;

    let query = db.select().from(stixCollections);

    if (operationId) {
      query = query.where(eq(stixCollections.operationId, operationId));
    }

    if (type) {
      query = query.where(eq(stixCollections.type, type));
    }

    if (status) {
      query = query.where(eq(stixCollections.status, status));
    }

    const collections = await query.orderBy(desc(stixCollections.createdAt));

    // Get technique counts for each collection
    const collectionsWithCounts = await Promise.all(
      collections.map(async (col) => {
        const contents = await db
          .select({ count: count() })
          .from(stixCollectionContents)
          .where(eq(stixCollectionContents.collectionId, col.id));

        return {
          ...col,
          techniqueCount: contents[0]?.count || 0
        };
      })
    );

    res.json(collectionsWithCounts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch collections', message: error.message });
  }
});

/**
 * POST /api/v1/attck/collections
 * Create new collection
 */
router.post('/collections', authenticateSession, async (req, res) => {
  try {
    const { name, description, type, operationId, techniques, metadata } = req.body;

    const [collection] = await db
      .insert(stixCollections)
      .values({
        name,
        description,
        type,
        status: 'draft',
        operationId,
        createdBy: req.session.userId,
        metadata: metadata || {}
      })
      .returning();

    // Add techniques if provided
    if (techniques && techniques.length > 0) {
      await db.insert(stixCollectionContents).values(
        techniques.map(t => ({
          collectionId: collection.id,
          techniqueId: t.techniqueId,
          name: t.name,
          tactics: t.tactics || [],
          parameters: t.parameters,
          priority: t.priority || 'medium'
        }))
      );
    }

    res.status(201).json(collection);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create collection', message: error.message });
  }
});

/**
 * GET /api/v1/attck/collections/:id/contents
 * Get collection contents
 */
router.get('/collections/:id/contents', authenticateSession, async (req, res) => {
  try {
    const { id } = req.params;

    const contents = await db
      .select()
      .from(stixCollectionContents)
      .where(eq(stixCollectionContents.collectionId, id));

    res.json(contents);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch collection contents', message: error.message });
  }
});

/**
 * GET /api/v1/attck/collections/:id/export-stix
 * Export collection as STIX bundle
 */
router.get('/collections/:id/export-stix', authenticateSession, async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await db.query.stixCollections.findFirst({
      where: (collections, { eq }) => eq(collections.id, id)
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const contents = await db
      .select()
      .from(stixCollectionContents)
      .where(eq(stixCollectionContents.collectionId, id));

    // Fetch full STIX objects for each technique
    const stixBundleObjects = await Promise.all(
      contents.map(async (content) => {
        const stixObj = await db.query.stixObjects.findFirst({
          where: (objects, { eq }) => eq(objects.xMitreId, content.techniqueId)
        });
        return stixObj?.rawStix;
      })
    );

    const bundle = {
      type: 'bundle',
      id: `bundle--${id}`,
      spec_version: '2.1',
      objects: stixBundleObjects.filter(Boolean)
    };

    res.json(bundle);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to export collection', message: error.message });
  }
});

/**
 * PATCH /api/v1/attck/collections/:id/status
 * Update collection status
 */
router.patch('/collections/:id/status', authenticateSession, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [updated] = await db
      .update(stixCollections)
      .set({ status })
      .where(eq(stixCollections.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update collection status', message: error.message });
  }
});

// ==================== Agent Integration ====================

/**
 * POST /api/v1/attck/send-to-operation-lead
 * Send execution plan to Operation Lead Agent
 */
router.post('/send-to-operation-lead', authenticateSession, async (req, res) => {
  try {
    const { operationId, techniques } = req.body;

    if (!operationId) {
      return res.status(400).json({ error: 'operationId required' });
    }

    if (!techniques || techniques.length === 0) {
      return res.status(400).json({ error: 'techniques required' });
    }

    // Get Operation Lead agent ID (first agent with role 'operation_lead')
    const agent = await db.query.agents.findFirst({
      where: (agents, { eq }) => eq(agents.role, 'operation_lead')
    });

    if (!agent) {
      return res.status(404).json({ error: 'Operation Lead agent not found' });
    }

    // Stage execution plan
    const result = await agentBridge.stageExecutionPlan(
      agent.id,
      operationId,
      {
        name: req.body.name || 'Execution Plan',
        description: req.body.description || '',
        techniques,
        metadata: req.body.metadata || {}
      }
    );

    res.json({
      workflowId: result.workflowId,
      collectionId: result.collectionId,
      message: 'Plan submitted to Operation Lead for analysis'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send to Operation Lead', message: error.message });
  }
});

// ==================== Attack Flows ====================

/**
 * GET /api/v1/attck/attack-flows
 * Get all attack flows
 */
router.get('/attack-flows', authenticateSession, async (req, res) => {
  try {
    const { operationId } = req.query;

    let query = db.select().from(attackFlows);

    if (operationId) {
      query = query.where(eq(attackFlows.operationId, operationId));
    }

    const flows = await query.orderBy(desc(attackFlows.createdAt));

    res.json(flows);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch attack flows', message: error.message });
  }
});

/**
 * POST /api/v1/attck/attack-flows
 * Create new attack flow
 */
router.post('/attack-flows', authenticateSession, async (req, res) => {
  try {
    const { name, description, operationId, nodes, edges, metadata } = req.body;

    const [flow] = await db
      .insert(attackFlows)
      .values({
        name,
        description,
        operationId,
        nodes: nodes || [],
        edges: edges || [],
        metadata: metadata || {},
        createdBy: req.session.userId
      })
      .returning();

    res.status(201).json(flow);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create attack flow', message: error.message });
  }
});

/**
 * POST /api/v1/attck/attack-flows/execute
 * Execute an attack flow
 */
router.post('/attack-flows/execute', authenticateSession, async (req, res) => {
  try {
    const { operationId, flowName, techniques, flowStructure } = req.body;

    // Similar to send-to-operation-lead, but preserves flow structure
    const agent = await db.query.agents.findFirst({
      where: (agents, { eq }) => eq(agents.role, 'operation_lead')
    });

    if (!agent) {
      return res.status(404).json({ error: 'Operation Lead agent not found' });
    }

    const result = await agentBridge.stageExecutionPlan(
      agent.id,
      operationId,
      {
        name: flowName || 'Attack Flow Execution',
        description: 'Sequenced attack flow',
        techniques,
        metadata: { flowStructure }
      }
    );

    res.json({
      workflowId: result.workflowId,
      message: 'Attack flow submitted for execution'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute attack flow', message: error.message });
  }
});

// ==================== STIX Import/Sync ====================

/**
 * POST /api/v1/attck/sync-mitre
 * Sync with MITRE ATT&CK repository
 */
router.post('/sync-mitre', authenticateSession, async (req, res) => {
  try {
    const results = await stixImporter.syncAll();

    res.json({
      message: 'Sync completed',
      results,
      techniquesUpdated: results.enterprise.techniques + results.mobile.techniques + results.ics.techniques,
      tacticsUpdated: results.enterprise.tactics + results.mobile.tactics + results.ics.tactics
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

/**
 * POST /api/v1/attck/collections/import-stix
 * Import STIX bundle
 */
router.post('/collections/import-stix', authenticateSession, async (req, res) => {
  try {
    const { stixBundle, operationId } = req.body;

    if (!stixBundle || stixBundle.type !== 'bundle') {
      return res.status(400).json({ error: 'Valid STIX bundle required' });
    }

    // Import bundle
    const result = await stixImporter.processBundle(stixBundle, 'user-import');

    // Create collection from imported objects
    const [collection] = await db
      .insert(stixCollections)
      .values({
        name: `Imported - ${new Date().toISOString()}`,
        description: `Imported STIX bundle with ${stixBundle.objects.length} objects`,
        type: 'imported_intel',
        status: 'draft',
        operationId,
        createdBy: req.session.userId
      })
      .returning();

    res.json({
      collection,
      imported: result.techniques + result.tactics + result.mitigations
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Import failed', message: error.message });
  }
});

export default router;
```

**Key API Features:**
1. **RESTful design** following existing RTPI patterns
2. **Session authentication** on all endpoints
3. **Query filtering** for techniques, tactics, collections
4. **STIX import/export** for data portability
5. **Agent integration** with Operation Lead workflows
6. **Attack flow management** for sequenced execution
7. **Error handling** with descriptive messages
8. **Pagination support** (via limit/offset in queries)
9. **Operation context** for technique status tracking
10. **Collection approval workflow** integration

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
