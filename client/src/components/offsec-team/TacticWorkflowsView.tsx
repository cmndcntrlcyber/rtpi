import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// MITRE ATT&CK Enterprise Tactics
const MITRE_TACTICS = [
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

// Agent to MITRE Tactic mapping
interface AgentConfig {
  id: string;
  name: string;
  type: string;
  dockerImage: string;
  description: string;
  tactics: string[];
  capabilities: string[];
  status: "running" | "stopped" | "building" | "error";
  toolCount: number;
}

const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: "burp-suite",
    name: "Burp Suite Agent",
    type: "burp-tools",
    dockerImage: "rtpi/burp-tools:latest",
    description: "Web application security testing and Burp Suite orchestration",
    tactics: ["reconnaissance", "initial-access"],
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
    tactics: ["command-and-control", "lateral-movement", "persistence"],
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
    tactics: ["discovery", "reconnaissance"],
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
    tactics: ["reconnaissance", "initial-access"],
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
    tactics: ["defense-evasion", "execution", "persistence"],
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
    tactics: ["credential-access", "persistence", "lateral-movement"],
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
    tactics: ["*"], // All tactics
    capabilities: ["tool_testing", "poc_creation", "knowledge_curation", "experimentation"],
    status: "stopped",
    toolCount: 35,
  },
];

// Get agents for a specific tactic
function getAgentsForTactic(tacticShortName: string): AgentConfig[] {
  return AGENT_CONFIGS.filter(
    (agent) => agent.tactics.includes(tacticShortName) || agent.tactics.includes("*")
  );
}

// Status badge component
function StatusBadge({ status }: { status: AgentConfig["status"] }) {
  const statusConfig = {
    running: { label: "Running", className: "bg-green-100 text-green-800 border-green-200" },
    stopped: { label: "Stopped", className: "bg-gray-100 text-gray-800 border-gray-200" },
    building: { label: "Building", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    error: { label: "Error", className: "bg-red-100 text-red-800 border-red-200" },
  };

  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Agent workflow card component
function AgentWorkflowCard({
  agent,
  onStart,
  onConfigure,
}: {
  agent: AgentConfig;
  onStart: (agent: AgentConfig) => void;
  onConfigure: (agent: AgentConfig) => void;
}) {
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
              <CardDescription className="text-xs mt-1">
                {agent.dockerImage}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{agent.description}</p>

        {/* Capabilities */}
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Capabilities</p>
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 4).map((cap) => (
              <Badge key={cap} variant="secondary" className="text-xs">
                {cap.replace(/_/g, " ")}
              </Badge>
            ))}
            {agent.capabilities.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{agent.capabilities.length - 4}
              </Badge>
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
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start
              </>
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

export default function TacticWorkflowsView() {
  const [expandedTactics, setExpandedTactics] = useState<Set<string>>(new Set(["TA0043"])); // Start with Reconnaissance expanded
  const [searchTerm, setSearchTerm] = useState("");
  const [agents, setAgents] = useState<AgentConfig[]>(AGENT_CONFIGS);

  // Toggle tactic expansion
  const toggleTactic = (tacticId: string) => {
    setExpandedTactics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tacticId)) {
        newSet.delete(tacticId);
      } else {
        newSet.add(tacticId);
      }
      return newSet;
    });
  };

  // Expand all tactics
  const expandAll = () => {
    setExpandedTactics(new Set(MITRE_TACTICS.map((t) => t.id)));
  };

  // Collapse all tactics
  const collapseAll = () => {
    setExpandedTactics(new Set());
  };

  // Filter tactics based on search term
  const filteredTactics = searchTerm
    ? MITRE_TACTICS.filter((tactic) => {
        // Check if tactic name matches
        if (tactic.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return true;
        }
        // Check if any agent in this tactic matches
        const tacticAgents = getAgentsForTactic(tactic.shortName);
        return tacticAgents.some(
          (agent) =>
            agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.capabilities.some((cap) => cap.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      })
    : MITRE_TACTICS;

  // Handle agent start
  const handleStartAgent = async (agent: AgentConfig) => {
    console.log("Starting/stopping agent:", agent.id);
    // TODO: Implement API call to start/stop container
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agent.id
          ? { ...a, status: a.status === "running" ? "stopped" : "running" }
          : a
      )
    );
  };

  // Handle agent configuration
  const handleConfigureAgent = (agent: AgentConfig) => {
    console.log("Configure agent:", agent.id);
    // TODO: Open configuration modal
  };

  // Get count of agents per tactic
  const getAgentCount = (tacticShortName: string): number => {
    return getAgentsForTactic(tacticShortName).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">ATT&CK Workflows</h2>
          <p className="text-muted-foreground">
            Agent workflows organized by MITRE ATT&CK Enterprise Tactics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tactics, agents, or capabilities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
            <div className="text-2xl font-bold">{agents.length}</div>
            <p className="text-sm text-muted-foreground">Agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {agents.filter((a) => a.status === "running").length}
            </div>
            <p className="text-sm text-muted-foreground">Running</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {agents.reduce((acc, a) => acc + a.toolCount, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Total Tools</p>
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Tactic Sections */}
      <div className="space-y-3">
        {filteredTactics.map((tactic) => {
          const TacticIcon = tactic.icon;
          const isExpanded = expandedTactics.has(tactic.id);
          const tacticAgents = getAgentsForTactic(tactic.shortName);
          const runningCount = tacticAgents.filter(
            (a) => agents.find((ag) => ag.id === a.id)?.status === "running"
          ).length;

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
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTactic(tactic.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <div className={cn("p-2 rounded-lg", tactic.color)}>
                    <TacticIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tactic.name}</span>
                      <Badge variant="outline" className="text-xs font-mono">
                        {tactic.id}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tacticAgents.length} agent{tacticAgents.length !== 1 ? "s" : ""} available
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {runningCount > 0 && (
                    <Badge variant="default" className="bg-green-600">
                      {runningCount} running
                    </Badge>
                  )}
                  <Badge variant="secondary">{tacticAgents.length}</Badge>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <CardContent className="pt-4">
                  {tacticAgents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tacticAgents.map((agent) => {
                        const currentAgent = agents.find((a) => a.id === agent.id) || agent;
                        return (
                          <AgentWorkflowCard
                            key={agent.id}
                            agent={currentAgent}
                            onStart={handleStartAgent}
                            onConfigure={handleConfigureAgent}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Container className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No agents configured for this tactic</p>
                      <p className="text-sm">
                        Configure an agent to appear here
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
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
