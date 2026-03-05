import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, List, ClipboardCheck } from "lucide-react";
import CISControlsTable from "@/components/cis/CISControlsTable";
import CISAssessment from "@/components/cis/CISAssessment";

export default function CISFramework() {
  const [stats, setStats] = useState({ controls: 0, safeguards: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/cis/stats", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch CIS stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/cis/import", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        await fetchStats();
      }
    } catch (error) {
      console.error("Failed to import CIS Controls:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-bold">CIS Controls v8</h1>
            <p className="text-muted-foreground mt-1">
              Center for Internet Security Critical Security Controls
            </p>
          </div>
        </div>
        {stats.controls === 0 && (
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import CIS Controls v8"}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <List className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Controls</h3>
          </div>
          <p className="text-3xl font-bold">{loading ? "..." : stats.controls}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Safeguards</h3>
          </div>
          <p className="text-3xl font-bold">{loading ? "..." : stats.safeguards}</p>
        </div>
      </div>

      <Tabs defaultValue="controls" className="space-y-6">
        <TabsList>
          <TabsTrigger value="controls">Controls & Safeguards</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="controls">
          <CISControlsTable />
        </TabsContent>

        <TabsContent value="assessment">
          <CISAssessment />
        </TabsContent>
      </Tabs>
    </div>
  );
}
