import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/attack/stats", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Error handled via toast
      }
    } catch (error) {
      // Error handled via toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const totalTechniques = stats.techniques + stats.subtechniques;

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
        <StixImportDialog />
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
      <Tabs defaultValue="techniques" className="space-y-6">
        <TabsList>
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
