import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Target, ShieldCheck, BookOpen, Link2 } from "lucide-react";
import AtlasTacticsGrid from "@/components/atlas/AtlasTacticsGrid";
import AtlasTechniquesTable from "@/components/atlas/AtlasTechniquesTable";
import AtlasNavigator from "@/components/atlas/AtlasNavigator";
import AtlasMitigationsTable from "@/components/atlas/AtlasMitigationsTable";
import AtlasCaseStudiesTable from "@/components/atlas/AtlasCaseStudiesTable";
import AtlasAttackMappingsTab from "@/components/atlas/AtlasAttackMappingsTab";
import AtlasStixImportDialog from "@/components/atlas/AtlasStixImportDialog";
import AtlasCoverageMatrix from "@/components/atlas/AtlasCoverageMatrix";
import AtlasPlannerTab from "@/components/atlas/AtlasPlannerTab";
import AtlasFlowBuilder from "@/components/atlas/AtlasFlowBuilder";
import AtlasFlowDiagram from "@/components/atlas/AtlasFlowDiagram";
import AtlasWorkbenchTab from "@/components/atlas/AtlasWorkbenchTab";

interface AtlasStats {
  techniques: number;
  subtechniques: number;
  tactics: number;
  mitigations: number;
  caseStudies: number;
  relationships: number;
}

export default function ATLASFramework() {
  const [stats, setStats] = useState<AtlasStats>({
    techniques: 0,
    subtechniques: 0,
    tactics: 0,
    mitigations: 0,
    caseStudies: 0,
    relationships: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>("all");

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/atlas/stats", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch stats" }));
        setError(errorData.error || "Failed to fetch ATLAS statistics");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error while fetching statistics";
      setError(message);
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
      // Silent fail for operations
    }
  };

  useEffect(() => {
    fetchStats();
    fetchOperations();
  }, []);

  const totalTechniques = stats.techniques + stats.subtechniques;

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 border border-destructive text-destructive-foreground rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-6 w-6" />
            <h2 className="text-xl font-semibold">Failed to Load ATLAS Framework</h2>
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
          <Brain className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold">MITRE ATLAS</h1>
            <p className="text-muted-foreground mt-1">
              Adversarial Threat Landscape for AI Systems
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
          <AtlasStixImportDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-purple-600" />
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
            <Brain className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Tactics</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : stats.tactics}
          </p>
          <p className="text-xs text-muted-foreground mt-1">AI/ML kill chain phases</p>
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
            <BookOpen className="h-5 w-5 text-orange-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Case Studies</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : stats.caseStudies}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Real-world AI attacks</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Relationships</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? "..." : stats.relationships}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Object linkages</p>
        </div>
      </div>

      {/* ATLAS Tabs */}
      <Tabs defaultValue="tactics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tactics">Tactics</TabsTrigger>
          <TabsTrigger value="navigator">Navigator</TabsTrigger>
          <TabsTrigger value="flowBuilder">Flow Builder</TabsTrigger>
          <TabsTrigger value="techniques">Techniques</TabsTrigger>
          <TabsTrigger value="mitigations">Mitigations</TabsTrigger>
          <TabsTrigger value="caseStudies">Case Studies</TabsTrigger>
          <TabsTrigger value="mappings">ATT&CK Mappings</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="flow">Attack Flow</TabsTrigger>
          <TabsTrigger value="workbench">Workbench</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="tactics" className="space-y-4">
          <AtlasTacticsGrid />
        </TabsContent>

        <TabsContent value="navigator" className="space-y-4">
          <AtlasNavigator operationId={selectedOperation === "all" ? undefined : selectedOperation} />
        </TabsContent>

        <TabsContent value="flowBuilder" className="space-y-4">
          <AtlasFlowBuilder operationId={selectedOperation === "all" ? undefined : selectedOperation} />
        </TabsContent>

        <TabsContent value="techniques" className="space-y-4">
          <AtlasTechniquesTable />
        </TabsContent>

        <TabsContent value="mitigations" className="space-y-4">
          <AtlasMitigationsTable />
        </TabsContent>

        <TabsContent value="caseStudies" className="space-y-4">
          <AtlasCaseStudiesTable />
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4">
          <AtlasAttackMappingsTab />
        </TabsContent>

        <TabsContent value="planner" className="space-y-4">
          <AtlasPlannerTab />
        </TabsContent>

        <TabsContent value="flow" className="space-y-4">
          <AtlasFlowDiagram />
        </TabsContent>

        <TabsContent value="workbench" className="space-y-4">
          <AtlasWorkbenchTab />
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <AtlasCoverageMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}
