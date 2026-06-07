import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, List, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
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
      <PageHeader
        icon={ShieldCheck}
        title="CIS Controls v8"
        description="Center for Internet Security Critical Security Controls"
        actions={
          stats.controls === 0 ? (
            <Button onClick={handleImport} disabled={loading}>
              {loading ? "Importing..." : "Import CIS Controls v8"}
            </Button>
          ) : undefined
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {[
          { label: "Controls", value: stats.controls, icon: List, iconColor: "text-success" },
          { label: "Safeguards", value: stats.safeguards, icon: ClipboardCheck, iconColor: "text-info" },
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
