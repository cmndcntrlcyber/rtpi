import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileCheck, Layers, ListChecks } from "lucide-react";
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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FileCheck className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">NIST AI RMF</h1>
            <p className="text-muted-foreground mt-1">
              AI Risk Management Framework (AI 100-1)
            </p>
          </div>
        </div>
        {stats.functions === 0 && (
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import NIST AI RMF"}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Functions</h3>
          </div>
          <p className="text-3xl font-bold">{loading ? "..." : stats.functions}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Categories</h3>
          </div>
          <p className="text-3xl font-bold">{loading ? "..." : stats.categories}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Subcategories</h3>
          </div>
          <p className="text-3xl font-bold">{loading ? "..." : stats.subcategories}</p>
        </div>
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
