import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Target, Users, Wrench, ShieldCheck, Database } from "lucide-react";
import TechniquesTable from "@/components/attack/TechniquesTable";
import TacticsGrid from "@/components/attack/TacticsGrid";
import StixImportDialog from "@/components/attack/StixImportDialog";
import GroupsTable from "@/components/attack/GroupsTable";
import SoftwareTable from "@/components/attack/SoftwareTable";
import MitigationsTable from "@/components/attack/MitigationsTable";
import CoverageMatrix from "@/components/attack/CoverageMatrix";
import PlannerTab from "@/components/attack/PlannerTab";
import AttackFlowDiagram from "@/components/attack/AttackFlowDiagram";
import WorkbenchTab from "@/components/attack/WorkbenchTab";
import ATTCKNavigator from "@/components/attack/ATTCKNavigator";
import AttackFlowBuilder from "@/components/attack/AttackFlowBuilder";

interface AttackStats {
  techniques: number;
  subtechniques: number;
  tactics: number;
  groups: number;
  software: number;
  mitigations: number;
  dataSources: number;
  campaigns: number;
}

export default function AttackFramework() {
  const [stats, setStats] = useState<AttackStats>({
    techniques: 0,
    subtechniques: 0,
    tactics: 0,
    groups: 0,
    software: 0,
    mitigations: 0,
    dataSources: 0,
    campaigns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>("all");

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/attack/stats", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch stats" }));
        setError(errorData.error || "Failed to fetch ATT&CK statistics");
        console.error("Failed to fetch stats:", errorData);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error while fetching statistics";
      setError(message);
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOperations = async () => {
    try {
      const response = await fetch("/api/v1/operations", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setOperations(data.operations || []);
        if (data.operations && data.operations.length > 0) {
          setSelectedOperation(data.operations[0].id);
        }
      }
    } catch (error) {
      // Error handled via toast
    }
  };

  useEffect(() => {
    fetchStats();
    fetchOperations();
  }, []);

  const totalTechniques = stats.techniques + stats.subtechniques;

  // Display error state
  if (error) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 border border-destructive text-destructive-foreground rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-6 w-6" />
            <h2 className="text-xl font-semibold">Failed to Load ATT&CK Framework</h2>
          </div>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchStats();
              fetchOperations();
            }}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">MITRE ATT&CK Framework</h1>
            <p className="text-muted-foreground mt-1">
              Adversary tactics, techniques, and knowledge base
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {operations.length > 0 && (
            <Select value={selectedOperation} onValueChange={setSelectedOperation}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select operation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operations</SelectItem>
                {operations.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <StixImportDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Techniques</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : totalTechniques.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.techniques} base + {stats.subtechniques} sub
          </p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Tactics</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : stats.tactics}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Kill chain phases</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Groups</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : stats.groups}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Threat actors</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Software</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : stats.software}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Malware & tools</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Mitigations</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : stats.mitigations}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Countermeasures</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Data Sources</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : stats.dataSources}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Detection sources</p>
        </div>
      </div>

      {/* ATT&CK Tabs */}
      <Tabs defaultValue="navigator" className="space-y-6">
        <TabsList>
          <TabsTrigger value="navigator">Navigator</TabsTrigger>
          <TabsTrigger value="flowBuilder">Flow Builder</TabsTrigger>
          <TabsTrigger value="techniques">Techniques</TabsTrigger>
          <TabsTrigger value="tactics">Tactics</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="software">Software</TabsTrigger>
          <TabsTrigger value="mitigations">Mitigations</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="flow">Attack Flow</TabsTrigger>
          <TabsTrigger value="workbench">Workbench</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="navigator" className="space-y-4">
          <ATTCKNavigator operationId={selectedOperation === "all" ? undefined : selectedOperation} />
        </TabsContent>

        <TabsContent value="flowBuilder" className="space-y-4">
          <AttackFlowBuilder operationId={selectedOperation === "all" ? undefined : selectedOperation} />
        </TabsContent>

        <TabsContent value="techniques" className="space-y-4">
          <TechniquesTable />
        </TabsContent>

        <TabsContent value="tactics" className="space-y-4">
          <TacticsGrid />
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <GroupsTable />
        </TabsContent>

        <TabsContent value="software" className="space-y-4">
          <SoftwareTable />
        </TabsContent>

        <TabsContent value="mitigations" className="space-y-4">
          <MitigationsTable />
        </TabsContent>

        <TabsContent value="planner" className="space-y-4">
          <PlannerTab />
        </TabsContent>

        <TabsContent value="flow" className="space-y-4">
          <AttackFlowDiagram />
        </TabsContent>

        <TabsContent value="workbench" className="space-y-4">
          <WorkbenchTab />
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <CoverageMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}
