import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Target, Users, Wrench, ShieldCheck, Database, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
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
        <PageHeader
          icon={Shield}
          title="MITRE ATT&CK Framework"
          description="Adversary tactics, techniques, and knowledge base"
        />
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle aria-hidden="true" className="h-6 w-6" />
            <h2 className="text-xl font-semibold">Failed to Load ATT&CK Framework</h2>
          </div>
          <p className="text-sm mb-4">{error}</p>
          <Button
            variant="destructive"
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchStats();
              fetchOperations();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        icon={Shield}
        title="MITRE ATT&CK Framework"
        description="Adversary tactics, techniques, and knowledge base"
        actions={
          <>
            {operations.length > 0 && (
              <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                <SelectTrigger className="w-64" aria-label="Select operation">
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
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        {[
          {
            label: "Techniques",
            value: loading ? null : totalTechniques.toLocaleString(),
            icon: Target,
            iconColor: "text-info",
            footnote: `${stats.techniques} base + ${stats.subtechniques} sub`,
          },
          {
            label: "Tactics",
            value: loading ? null : stats.tactics.toString(),
            icon: Shield,
            iconColor: "text-primary",
            footnote: "Kill chain phases",
          },
          {
            label: "Groups",
            value: loading ? null : stats.groups.toString(),
            icon: Users,
            iconColor: "text-destructive",
            footnote: "Threat actors",
          },
          {
            label: "Software",
            value: loading ? null : stats.software.toString(),
            icon: Wrench,
            iconColor: "text-warning",
            footnote: "Malware & tools",
          },
          {
            label: "Mitigations",
            value: loading ? null : stats.mitigations.toString(),
            icon: ShieldCheck,
            iconColor: "text-success",
            footnote: "Countermeasures",
          },
          {
            label: "Data Sources",
            value: loading ? null : stats.dataSources.toString(),
            icon: Database,
            iconColor: "text-muted-foreground",
            footnote: "Detection sources",
          },
        ].map(({ label, value, icon: Icon, iconColor, footnote }) => (
          <div key={label} className="bg-card p-6 rounded-lg shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Icon aria-hidden="true" className={`h-5 w-5 ${iconColor}`} />
              <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
            </div>
            {value === null ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{footnote}</p>
          </div>
        ))}
      </div>

      {/* ATT&CK Tabs */}
      <Tabs defaultValue="tactics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tactics">Tactics</TabsTrigger>
          <TabsTrigger value="navigator">Navigator</TabsTrigger>
          <TabsTrigger value="flowBuilder">Flow Builder</TabsTrigger>
          <TabsTrigger value="techniques">Techniques</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="software">Software</TabsTrigger>
          <TabsTrigger value="mitigations">Mitigations</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="flow">Attack Flow</TabsTrigger>
          <TabsTrigger value="workbench">Workbench</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="tactics" className="space-y-4">
          <TacticsGrid />
        </TabsContent>

        <TabsContent value="navigator" className="space-y-4">
          <ATTCKNavigator operationId={selectedOperation === "all" ? undefined : selectedOperation} />
        </TabsContent>

        <TabsContent value="flowBuilder" className="space-y-4">
          <AttackFlowBuilder operationId={selectedOperation === "all" ? undefined : selectedOperation} />
        </TabsContent>

        <TabsContent value="techniques" className="space-y-4">
          <TechniquesTable />
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
