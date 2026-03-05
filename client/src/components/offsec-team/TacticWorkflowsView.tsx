import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  ChevronDown,
  Search,
  Play,
  Settings,
  Container,
  Activity,
  Target,
  Shield,
  Zap,
  Key,
  Eye,
  ArrowRightLeft,
  Radio,
  Upload,
  Skull,
  Layers,
  RefreshCw,
  Plus,
  Minus,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface TacticDef {
  id: string;       // e.g. "TA0043"
  name: string;
  shortName: string;
  icon: React.ElementType;
  color: string;
}

interface AgentConfig {
  id: string;         // config key, e.g. "burp-suite"
  dbId: string;       // UUID from agents table
  name: string;
  type: string;
  dockerImage: string;
  description: string;
  capabilities: string[];
  status: "running" | "stopped" | "building" | "error";
  toolCount: number;
}

interface TacticRecord {
  id: string;       // UUID from attackTactics
  attackId: string;  // e.g. "TA0043"
  name: string;
  shortName: string;
}

// Agent-tactic assignment from the API
interface Assignment {
  agentId: string;   // UUID
  tacticId: string;  // UUID
  attackId: string;
  name: string;
  shortName: string;
}

// ── Static Data ──────────────────────────────────────────────────────────────

const MITRE_TACTICS: TacticDef[] = [
  { id: "TA0043", name: "Reconnaissance", shortName: "reconnaissance", icon: Eye, color: "bg-blue-500" },
  { id: "TA0042", name: "Resource Development", shortName: "resource-development", icon: Layers, color: "bg-indigo-500" },
  { id: "TA0001", name: "Initial Access", shortName: "initial-access", icon: Target, color: "bg-green-500" },
  { id: "TA0002", name: "Execution", shortName: "execution", icon: Zap, color: "bg-yellow-500" },
  { id: "TA0003", name: "Persistence", shortName: "persistence", icon: Shield, color: "bg-orange-500" },
  { id: "TA0004", name: "Privilege Escalation", shortName: "privilege-escalation", icon: ArrowRightLeft, color: "bg-red-500" },
  { id: "TA0005", name: "Defense Evasion", shortName: "defense-evasion", icon: Shield, color: "bg-pink-500" },
  { id: "TA0006", name: "Credential Access", shortName: "credential-access", icon: Key, color: "bg-purple-500" },
  { id: "TA0007", name: "Discovery", shortName: "discovery", icon: Search, color: "bg-cyan-500" },
  { id: "TA0008", name: "Lateral Movement", shortName: "lateral-movement", icon: ArrowRightLeft, color: "bg-teal-500" },
  { id: "TA0011", name: "Command and Control", shortName: "command-and-control", icon: Radio, color: "bg-amber-500" },
  { id: "TA0010", name: "Exfiltration", shortName: "exfiltration", icon: Upload, color: "bg-lime-500" },
  { id: "TA0040", name: "Impact", shortName: "impact", icon: Skull, color: "bg-rose-500" },
];

// Static agent config data (UI metadata)
const AGENT_CONFIGS: Omit<AgentConfig, "dbId">[] = [
  {
    id: "burp-suite",
    name: "Burp Suite Agent",
    type: "burp-tools",
    dockerImage: "rtpi/burp-tools:latest",
    description: "Web application security testing and Burp Suite orchestration",
    capabilities: ["web_scanning", "proxy", "crawler", "vulnerability_detection"],
    status: "stopped",
    toolCount: 22,
  },
  {
    id: "empire-c2",
    name: "Empire C2 Agent",
    type: "empire-tools",
    dockerImage: "rtpi/empire-tools:latest",
    description: "Command & Control, payload generation, and post-exploitation",
    capabilities: ["c2_management", "payload_generation", "post_exploitation", "listeners"],
    status: "stopped",
    toolCount: 28,
  },
  {
    id: "fuzzing",
    name: "Advanced Fuzzing Agent",
    type: "fuzzing-tools",
    dockerImage: "rtpi/fuzzing-tools:latest",
    description: "Web fuzzing, directory discovery, and parameter bruteforcing",
    capabilities: ["ffuf", "gobuster", "feroxbuster", "wordlist_management"],
    status: "stopped",
    toolCount: 18,
  },
  {
    id: "framework-security",
    name: "Framework Security Agent",
    type: "framework-tools",
    dockerImage: "rtpi/framework-tools:latest",
    description: "Technology stack detection and framework vulnerability analysis",
    capabilities: ["tech_detection", "cms_scanning", "dependency_analysis"],
    status: "stopped",
    toolCount: 25,
  },
  {
    id: "maldev",
    name: "Maldev Agent",
    type: "maldev-tools",
    dockerImage: "rtpi/maldev-tools:latest",
    description: "Binary analysis, reverse engineering, ROP development, Rust-based exploitation",
    capabilities: ["reverse_engineering", "rop_development", "rust_malware", "shellcode"],
    status: "stopped",
    toolCount: 44,
  },
  {
    id: "azure-ad",
    name: "Azure-AD Agent",
    type: "azure-ad-tools",
    dockerImage: "rtpi/azure-ad-tools:latest",
    description: "Azure & Active Directory attack research and enumeration",
    capabilities: ["entra_id_abuse", "ad_enumeration", "bloodhound", "privilege_escalation"],
    status: "stopped",
    toolCount: 28,
  },
  {
    id: "research",
    name: "Research Agent",
    type: "research-tools",
    dockerImage: "rtpi/research-tools:latest",
    description: "General R&D, tool testing, POC creation, and knowledge curation",
    capabilities: ["tool_testing", "poc_creation", "knowledge_curation", "experimentation"],
    status: "stopped",
    toolCount: 35,
  },
];

// Map DB agent names → config keys
const AGENT_NAME_TO_KEY: Record<string, string> = {
  "Burp Suite Orchestrator": "burp-suite",
  "Empire C2 Manager": "empire-c2",
  "Advanced Fuzzing Agent": "fuzzing",
  "Framework Security Agent": "framework-security",
  "Maldev Agent": "maldev",
  "Azure-AD Agent": "azure-ad",
  "Research Agent": "research",
};

// Default tactic assignments (used for seeding on first load)
const DEFAULT_TACTIC_ASSIGNMENTS: Record<string, string[]> = {
  "burp-suite": ["reconnaissance", "initial-access"],
  "empire-c2": ["command-and-control", "lateral-movement", "persistence"],
  "fuzzing": ["discovery", "reconnaissance"],
  "framework-security": ["reconnaissance", "initial-access"],
  "maldev": ["defense-evasion", "execution", "persistence"],
  "azure-ad": ["credential-access", "persistence", "lateral-movement"],
  "research": ["reconnaissance", "discovery", "execution"],
};

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AgentConfig["status"] }) {
  const cfg = {
    running: { label: "Running", className: "bg-green-100 text-green-800 border-green-200" },
    stopped: { label: "Stopped", className: "bg-gray-100 text-gray-800 border-gray-200" },
    building: { label: "Building", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    error: { label: "Error", className: "bg-red-100 text-red-800 border-red-200" },
  };
  const c = cfg[status];
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function AgentWorkflowCard({
  agent,
  tacticId,
  tacticDbId,
  assignedTacticIds,
  allTactics,
  onStart,
  onConfigure,
  onAddToTactics,
  onRemoveFromTactic,
}: {
  agent: AgentConfig;
  tacticId: string;
  tacticDbId: string;
  assignedTacticIds: Set<string>;
  allTactics: TacticRecord[];
  onStart: (agent: AgentConfig) => void;
  onConfigure: (agent: AgentConfig) => void;
  onAddToTactics: (agentDbId: string, tacticDbIds: string[]) => void;
  onRemoveFromTactic: (agentDbId: string, tacticDbId: string) => void;
}) {
  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set());

  // Tactics this agent is NOT yet assigned to
  const unassignedTactics = allTactics.filter(t => !assignedTacticIds.has(t.id));

  const handleTogglePending = (tacticDbId: string) => {
    setPendingAdds(prev => {
      const next = new Set(prev);
      if (next.has(tacticDbId)) next.delete(tacticDbId);
      else next.add(tacticDbId);
      return next;
    });
  };

  const handleConfirmAdd = () => {
    if (pendingAdds.size > 0) {
      onAddToTactics(agent.dbId, Array.from(pendingAdds));
      setPendingAdds(new Set());
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Container className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <CardDescription className="text-xs mt-1">{agent.dockerImage}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={agent.status} />

            {/* (+) Add to more tactics */}
            {unassignedTactics.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Add to more tactics">
                    <Plus className="h-4 w-4 text-green-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Add to Tactics</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {unassignedTactics.map(t => (
                    <DropdownMenuCheckboxItem
                      key={t.id}
                      checked={pendingAdds.has(t.id)}
                      onCheckedChange={() => handleTogglePending(t.id)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <span className="font-mono text-xs mr-2 text-muted-foreground">{t.attackId}</span>
                      {t.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {pendingAdds.size > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="p-2">
                        <Button size="sm" className="w-full" onClick={handleConfirmAdd}>
                          Add to {pendingAdds.size} tactic{pendingAdds.size !== 1 ? "s" : ""}
                        </Button>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* (-) Remove from this tactic */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Remove from this tactic"
              onClick={() => onRemoveFromTactic(agent.dbId, tacticDbId)}
            >
              <Minus className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{agent.description}</p>

        {/* Capabilities */}
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Capabilities</p>
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 4).map(cap => (
              <Badge key={cap} variant="secondary" className="text-xs">{cap.replace(/_/g, " ")}</Badge>
            ))}
            {agent.capabilities.length > 4 && (
              <Badge variant="secondary" className="text-xs">+{agent.capabilities.length - 4}</Badge>
            )}
          </div>
        </div>

        {/* Tool count */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>{agent.toolCount} tools available</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={agent.status === "running" ? "destructive" : "default"}
            className="flex-1"
            onClick={() => onStart(agent)}
          >
            {agent.status === "running" ? (
              <><RefreshCw className="h-4 w-4 mr-2" />Stop</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Start</>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onConfigure(agent)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Bulk assignment controls — two multi-select dropdowns + Assign button
function BulkAssignmentControls({
  agentConfigs,
  allTactics,
  onBulkAssign,
}: {
  agentConfigs: AgentConfig[];
  allTactics: TacticRecord[];
  onBulkAssign: (agentDbIds: string[], tacticDbIds: string[]) => void;
}) {
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectedTactics, setSelectedTactics] = useState<Set<string>>(new Set());

  const toggleAgent = (dbId: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId); else next.add(dbId);
      return next;
    });
  };

  const toggleTactic = (dbId: string) => {
    setSelectedTactics(prev => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId); else next.add(dbId);
      return next;
    });
  };

  const handleAssign = () => {
    if (selectedAgents.size > 0 && selectedTactics.size > 0) {
      onBulkAssign(Array.from(selectedAgents), Array.from(selectedTactics));
      setSelectedAgents(new Set());
      setSelectedTactics(new Set());
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Agent multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Users className="h-4 w-4" />
            Agents {selectedAgents.size > 0 && `(${selectedAgents.size})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Select Agents</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {agentConfigs.map(a => (
            <DropdownMenuCheckboxItem
              key={a.dbId}
              checked={selectedAgents.has(a.dbId)}
              onCheckedChange={() => toggleAgent(a.dbId)}
              onSelect={(e) => e.preventDefault()}
            >
              {a.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tactic multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Target className="h-4 w-4" />
            Tactics {selectedTactics.size > 0 && `(${selectedTactics.size})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Select Tactics</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allTactics.map(t => (
            <DropdownMenuCheckboxItem
              key={t.id}
              checked={selectedTactics.has(t.id)}
              onCheckedChange={() => toggleTactic(t.id)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="font-mono text-xs mr-2 text-muted-foreground">{t.attackId}</span>
              {t.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assign button */}
      <Button
        size="sm"
        disabled={selectedAgents.size === 0 || selectedTactics.size === 0}
        onClick={handleAssign}
      >
        Assign
      </Button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TacticWorkflowsView() {
  const [expandedTactics, setExpandedTactics] = useState<Set<string>>(new Set(["TA0043"]));
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // DB-backed state
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [dbTactics, setDbTactics] = useState<TacticRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, tacticsRes] = await Promise.all([
        fetch("/api/v1/agents", { credentials: "include" }),
        fetch("/api/v1/attack/tactics", { credentials: "include" }),
      ]);

      const agentsData = await agentsRes.json();
      const tacticsData = await tacticsRes.json();

      // Build agent configs by matching DB records to static metadata
      const dbAgents: any[] = agentsData.agents || [];
      const matched: AgentConfig[] = [];

      for (const dbAgent of dbAgents) {
        const configKey = AGENT_NAME_TO_KEY[dbAgent.name];
        if (!configKey) continue;
        const staticCfg = AGENT_CONFIGS.find(c => c.id === configKey);
        if (!staticCfg) continue;

        matched.push({
          ...staticCfg,
          dbId: dbAgent.id,
          status: dbAgent.status === "active" || dbAgent.status === "running" ? "running" : "stopped",
        });
      }

      setAgentConfigs(matched);

      // Map tactic records
      const tactics: TacticRecord[] = (tacticsData.tactics || tacticsData || []).map((t: any) => ({
        id: t.id,
        attackId: t.attackId,
        name: t.name,
        shortName: t.shortName,
      }));
      setDbTactics(tactics);

      // Collect all assignments from enriched agents
      const allAssignments: Assignment[] = [];
      for (const dbAgent of dbAgents) {
        const agentTactics: any[] = dbAgent.tactics || [];
        for (const t of agentTactics) {
          allAssignments.push({
            agentId: t.agentId,
            tacticId: t.tacticId,
            attackId: t.attackId,
            name: t.name,
            shortName: t.shortName,
          });
        }
      }
      setAssignments(allAssignments);

      // Seed defaults if no assignments exist yet
      if (allAssignments.length === 0 && matched.length > 0 && tactics.length > 0) {
        await seedDefaults(matched, tactics);
      }
    } catch (err) {
      console.error("Failed to load ATT&CK workflow data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Seed default assignments on first load
  const seedDefaults = async (agents: AgentConfig[], tactics: TacticRecord[]) => {
    const tacticByShort = new Map(tactics.map(t => [t.shortName, t]));

    for (const agent of agents) {
      const defaults = DEFAULT_TACTIC_ASSIGNMENTS[agent.id];
      if (!defaults) continue;

      const tacticDbIds = defaults
        .map(shortName => tacticByShort.get(shortName)?.id)
        .filter((id): id is string => !!id);

      if (tacticDbIds.length === 0) continue;

      try {
        await fetch(`/api/v1/agents/${agent.dbId}/tactics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tacticIds: tacticDbIds }),
        });
      } catch (err) {
        console.error(`Failed to seed tactics for ${agent.name}:`, err);
      }
    }

    // Re-fetch to pick up the seeded data
    await fetchData();
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived state ──────────────────────────────────────────────────────────

  // Map attackId → TacticRecord for lookups
  const tacticByAttackId = new Map(dbTactics.map(t => [t.attackId, t]));

  // Get agents assigned to a given tactic attackId
  const getAgentsForTactic = (attackId: string): AgentConfig[] => {
    const tacticRec = tacticByAttackId.get(attackId);
    if (!tacticRec) return [];

    const assignedAgentIds = new Set(
      assignments
        .filter(a => a.tacticId === tacticRec.id)
        .map(a => a.agentId)
    );

    return agentConfigs.filter(a => assignedAgentIds.has(a.dbId));
  };

  // Get all tactic DB IDs assigned to a given agent
  const getAssignedTacticIdsForAgent = (agentDbId: string): Set<string> => {
    return new Set(
      assignments
        .filter(a => a.agentId === agentDbId)
        .map(a => a.tacticId)
    );
  };

  // Total assignment count
  const totalAssignments = assignments.length;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddToTactics = async (agentDbId: string, tacticDbIds: string[]) => {
    try {
      const res = await fetch(`/api/v1/agents/${agentDbId}/tactics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tacticIds: tacticDbIds }),
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error("Failed to add tactic assignments:", err);
    }
  };

  const handleRemoveFromTactic = async (agentDbId: string, tacticDbId: string) => {
    try {
      const res = await fetch(`/api/v1/agents/${agentDbId}/tactics/${tacticDbId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error("Failed to remove tactic assignment:", err);
    }
  };

  const handleBulkAssign = async (agentDbIds: string[], tacticDbIds: string[]) => {
    try {
      await Promise.all(
        agentDbIds.map(agentDbId =>
          fetch(`/api/v1/agents/${agentDbId}/tactics`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ tacticIds: tacticDbIds }),
          })
        )
      );
      await fetchData();
    } catch (err) {
      console.error("Failed to bulk assign:", err);
    }
  };

  const handleStartAgent = async (agent: AgentConfig) => {
    console.log("Starting/stopping agent:", agent.id);
    setAgentConfigs(prev =>
      prev.map(a =>
        a.id === agent.id
          ? { ...a, status: a.status === "running" ? "stopped" as const : "running" as const }
          : a
      )
    );
  };

  const handleConfigureAgent = (agent: AgentConfig) => {
    console.log("Configure agent:", agent.id);
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const toggleTactic = (tacticId: string) => {
    setExpandedTactics(prev => {
      const next = new Set(prev);
      if (next.has(tacticId)) next.delete(tacticId); else next.add(tacticId);
      return next;
    });
  };

  const expandAll = () => setExpandedTactics(new Set(MITRE_TACTICS.map(t => t.id)));
  const collapseAll = () => setExpandedTactics(new Set());

  const filteredTactics = searchTerm
    ? MITRE_TACTICS.filter(tactic => {
        if (tactic.name.toLowerCase().includes(searchTerm.toLowerCase())) return true;
        const tacticAgents = getAgentsForTactic(tactic.id);
        return tacticAgents.some(
          agent =>
            agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.capabilities.some(cap => cap.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      })
    : MITRE_TACTICS;

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading ATT&CK workflows...</span>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header with bulk assignment controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">ATT&CK Workflows</h2>
          <p className="text-muted-foreground">
            Agent workflows organized by MITRE ATT&CK Enterprise Tactics
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BulkAssignmentControls
            agentConfigs={agentConfigs}
            allTactics={dbTactics}
            onBulkAssign={handleBulkAssign}
          />
          <div className="h-6 w-px bg-border mx-1" />
          <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tactics, agents, or capabilities..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{MITRE_TACTICS.length}</div>
            <p className="text-sm text-muted-foreground">Tactics</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{agentConfigs.length}</div>
            <p className="text-sm text-muted-foreground">Agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalAssignments}</div>
            <p className="text-sm text-muted-foreground">Assignments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {agentConfigs.filter(a => a.status === "running").length}
            </div>
            <p className="text-sm text-muted-foreground">Running</p>
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Tactic Sections */}
      <div className="space-y-3">
        {filteredTactics.map(tactic => {
          const TacticIcon = tactic.icon;
          const isExpanded = expandedTactics.has(tactic.id);
          const tacticAgents = getAgentsForTactic(tactic.id);
          const runningCount = tacticAgents.filter(a => a.status === "running").length;
          const tacticRec = tacticByAttackId.get(tactic.id);

          return (
            <Card key={tactic.id} className="overflow-hidden">
              {/* Tactic Header */}
              <div
                className={cn(
                  "flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors",
                  isExpanded && "border-b"
                )}
                onClick={() => toggleTactic(tactic.id)}
              >
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0"
                    onClick={e => { e.stopPropagation(); toggleTactic(tactic.id); }}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  <div className={cn("p-2 rounded-lg", tactic.color)}>
                    <TacticIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tactic.name}</span>
                      <Badge variant="outline" className="text-xs font-mono">{tactic.id}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tacticAgents.length} agent{tacticAgents.length !== 1 ? "s" : ""} assigned
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {runningCount > 0 && (
                    <Badge variant="default" className="bg-green-600">{runningCount} running</Badge>
                  )}
                  <Badge variant="secondary">{tacticAgents.length}</Badge>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <CardContent className="pt-4">
                  {tacticAgents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tacticAgents.map(agent => (
                        <AgentWorkflowCard
                          key={`${agent.dbId}-${tactic.id}`}
                          agent={agent}
                          tacticId={tactic.id}
                          tacticDbId={tacticRec?.id || ""}
                          assignedTacticIds={getAssignedTacticIdsForAgent(agent.dbId)}
                          allTactics={dbTactics}
                          onStart={handleStartAgent}
                          onConfigure={handleConfigureAgent}
                          onAddToTactics={handleAddToTactics}
                          onRemoveFromTactic={handleRemoveFromTactic}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Container className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No agents assigned to this tactic</p>
                      <p className="text-sm">Use the bulk assignment controls above to add agents</p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Empty search state */}
      {filteredTactics.length === 0 && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Results Found</h3>
          <p className="text-muted-foreground">
            No tactics or agents match your search term "{searchTerm}"
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setSearchTerm("")}>
            Clear Search
          </Button>
        </Card>
      )}
    </div>
  );
}
