import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileCheck, Layers, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import NISTFunctionsAccordion from "@/components/nist-ai/NISTFunctionsAccordion";
import NISTCategoriesTable from "@/components/nist-ai/NISTCategoriesTable";
import NISTImplementationGuide from "@/components/nist-ai/NISTImplementationGuide";
import NISTAIAssessment from "@/components/nist-ai/NISTAIAssessment";

export default function NISTAIFramework() {
  const [stats, setStats] = useState({ functions: 0, categories: 0, subcategories: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/nist-ai/stats", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch NIST AI stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/nist-ai/import", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        await fetchStats();
      }
    } catch (error) {
      console.error("Failed to import NIST AI RMF:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        icon={FileCheck}
        title="NIST AI RMF"
        description="AI Risk Management Framework (AI 100-1)"
        actions={
          stats.functions === 0 ? (
            <Button onClick={handleImport} disabled={loading}>
              {loading ? "Importing..." : "Import NIST AI RMF"}
            </Button>
          ) : undefined
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: "Functions", value: stats.functions, icon: Layers, iconColor: "text-info" },
          { label: "Categories", value: stats.categories, icon: FileCheck, iconColor: "text-primary" },
          { label: "Subcategories", value: stats.subcategories, icon: ListChecks, iconColor: "text-success" },
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

      <Tabs defaultValue="functions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="functions">Functions</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="implementation">Implementation Guide</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="mappings">OWASP LLM Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="functions">
          <NISTFunctionsAccordion />
        </TabsContent>

        <TabsContent value="categories">
          <NISTCategoriesTable />
        </TabsContent>

        <TabsContent value="implementation">
          <NISTImplementationGuide />
        </TabsContent>

        <TabsContent value="assessment">
          <NISTAIAssessment />
        </TabsContent>

        <TabsContent value="mappings">
          <div className="bg-card p-6 rounded-lg border border-border">
            <p className="text-muted-foreground">
              Cross-framework mappings showing how NIST AI RMF subcategories relate to OWASP LLM vulnerabilities.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
