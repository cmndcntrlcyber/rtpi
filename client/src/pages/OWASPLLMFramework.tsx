import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, AlertTriangle, Shield } from "lucide-react";
import { api } from "@/lib/api";
import VulnerabilitiesTable from "@/components/owasp-llm/VulnerabilitiesTable";
import AttackVectorsTable from "@/components/owasp-llm/AttackVectorsTable";
import MitigationsTable from "@/components/owasp-llm/MitigationsTable";
import OWASPLLMAssessment from "@/components/owasp-llm/OWASPLLMAssessment";

export default function OWASPLLMFramework() {
  const [stats, setStats] = useState({ vulnerabilities: 0, attackVectors: 0, mitigations: 0 });
  const [loading, setLoading] = useState(true);
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>("all");

  useEffect(() => {
    fetchStats();
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      const res = await api.get<{ operations: any[] }>("/operations");
      setOperations(res.operations.filter((op: any) => op.status === "active"));
    } catch {
      // ignore
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/owasp-llm/stats", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch OWASP LLM stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/owasp-llm/import", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        await fetchStats();
      }
    } catch (error) {
      console.error("Failed to import OWASP LLM:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Lock className="h-8 w-8 text-red-600" />
          <div>
            <h1 className="text-3xl font-bold">OWASP LLM Top 10</h1>
            <p className="text-muted-foreground mt-1">
              Top 10 Critical Vulnerabilities for LLM Applications
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedOperation} onValueChange={setSelectedOperation}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by operation" />
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
        </div>
        {stats.vulnerabilities === 0 && (
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import OWASP LLM Top 10"}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Vulnerabilities</h3>
          </div>
          <p className="text-3xl font-bold">{loading ? "..." : stats.vulnerabilities}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5 text-orange-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Attack Vectors</h3>
          </div>
          <p className="text-3xl font-bold">{loading ? "..." : stats.attackVectors}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Mitigations</h3>
          </div>
          <p className="text-3xl font-bold">{loading ? "..." : stats.mitigations}</p>
        </div>
      </div>

      <Tabs defaultValue="top10" className="space-y-6">
        <TabsList>
          <TabsTrigger value="top10">Top 10 Vulnerabilities</TabsTrigger>
          <TabsTrigger value="attackVectors">Attack Vectors</TabsTrigger>
          <TabsTrigger value="mitigations">Mitigations</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="mappings">ATLAS Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="top10">
          <VulnerabilitiesTable />
        </TabsContent>

        <TabsContent value="attackVectors">
          <AttackVectorsTable />
        </TabsContent>

        <TabsContent value="mitigations">
          <MitigationsTable />
        </TabsContent>

        <TabsContent value="assessment">
          <OWASPLLMAssessment />
        </TabsContent>

        <TabsContent value="mappings">
          <div className="bg-card p-6 rounded-lg border border-border">
            <p className="text-muted-foreground">
              Cross-framework mappings to MITRE ATLAS adversarial ML techniques.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
