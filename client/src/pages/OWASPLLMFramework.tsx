import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
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
      <PageHeader
        icon={Lock}
        title="OWASP LLM Top 10"
        description="Top 10 Critical Vulnerabilities for LLM Applications"
        actions={
          <>
            <Select value={selectedOperation} onValueChange={setSelectedOperation}>
              <SelectTrigger className="w-[220px]" aria-label="Filter by operation">
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
            {stats.vulnerabilities === 0 && (
              <Button onClick={handleImport} disabled={loading}>
                {loading ? "Importing..." : "Import OWASP LLM Top 10"}
              </Button>
            )}
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: "Vulnerabilities", value: stats.vulnerabilities, icon: AlertTriangle, iconColor: "text-destructive" },
          { label: "Attack Vectors", value: stats.attackVectors, icon: Lock, iconColor: "text-warning" },
          { label: "Mitigations", value: stats.mitigations, icon: Shield, iconColor: "text-success" },
        ].map(({ label, value, icon: Icon, iconColor }) => (
          <div key={label} className="bg-card p-6 rounded-lg shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Icon aria-hidden="true" className={`h-5 w-5 ${iconColor}`} />
              <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
            </div>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold tabular-nums">{value}</p>
            )}
          </div>
        ))}
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
