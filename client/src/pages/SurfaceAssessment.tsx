import { useState, useEffect } from "react";
import { GitCompare, FileText, Download, ChevronDown, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { toast } from "sonner";
import OverviewTab from "@/components/surface-assessment/OverviewTab";
import VulnerabilitiesTab from "@/components/surface-assessment/VulnerabilitiesTab";
import AssetsTab from "@/components/surface-assessment/AssetsTab";
import ServicesTab from "@/components/surface-assessment/ServicesTab";
import ActivityTab from "@/components/surface-assessment/ActivityTab";
import ScanConfigTab from "@/components/surface-assessment/ScanConfigTab";
import NetworkTopologyView from "@/components/surface-assessment/NetworkTopologyView";
import ScanComparisonDialog from "@/components/surface-assessment/ScanComparisonDialog";
import ScanImportCard from "@/components/surface-assessment/ScanImportCard";
import DedupCard from "@/components/surface-assessment/DedupCard";

export default function SurfaceAssessment() {
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "csv" | "json" | "txt") => {
    if (!selectedOperation) return;
    setExporting(true);
    try {
      const res = await fetch(
        `/api/v1/surface-assessment/${selectedOperation}/export?format=${format}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      const filename = match?.[1] ?? `surface-assessment.${format}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${filename}`);
    } catch (error: any) {
      toast.error("Export failed", { description: error?.message || "Unknown error" });
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      const res = await api.get<{ operations: any[] }>("/operations");
      const activeOps = res.operations.filter((op: any) => op.status === "active");
      setOperations(activeOps);
      if (activeOps.length > 0) {
        setSelectedOperation(activeOps[0].id);
      }
    } catch (error) {
      // Error handled via toast
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedOperation) return;
    setReportGenerating(true);
    try {
      await api.post(`/surface-assessment/${selectedOperation}/report/generate`, {});
      toast.success("Report generation started", {
        description: "The 3-agent workflow is running. Check the Reports page when complete.",
      });
    } catch (error: any) {
      toast.error("Failed to start report generation", {
        description: error?.message || "Unknown error",
      });
    } finally {
      setReportGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-4">Surface Assessment</h1>
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No operations found</p>
          <p className="text-muted-foreground mt-2">Create an operation to start surface assessment</p>
        </div>
      </div>
    );
  }

  if (!selectedOperation) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-4">Surface Assessment</h1>
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">Loading operation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Surface Assessment</h1>
          <p className="text-muted-foreground mt-1">
            Centralized attack surface management dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleGenerateReport}
            disabled={reportGenerating}
          >
            <FileText className="h-4 w-4 mr-2" />
            {reportGenerating ? "Generating..." : "Generate Report"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!selectedOperation || exporting}>
                <Download className="h-4 w-4 mr-2" />
                {exporting ? "Exporting..." : "Export"}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("txt")}>TXT</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={() => setComparisonDialogOpen(true)}
          >
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Scans
          </Button>
          <Select value={selectedOperation} onValueChange={setSelectedOperation}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select operation" />
            </SelectTrigger>
            <SelectContent>
              {operations.map((op) => (
                <SelectItem key={op.id} value={op.id}>
                  {op.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <h5 className="mb-1 font-medium leading-none tracking-tight text-yellow-500">OPSEC Warning: Loud Scans</h5>
        <AlertDescription className="text-yellow-500/90">
          Automated scans initiated from this dashboard (including BBOT) have a loud network profile and will actively enumerate targets. Ensure you have proper authorization before proceeding.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="topology">Topology</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="config">Scan Config</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab operationId={selectedOperation} onTabChange={setActiveTab} />
        </TabsContent>

        <TabsContent value="vulnerabilities" className="mt-0">
          <VulnerabilitiesTab operationId={selectedOperation} />
        </TabsContent>

        <TabsContent value="assets" className="mt-0">
          <AssetsTab operationId={selectedOperation} />
        </TabsContent>

        <TabsContent value="services" className="mt-0">
          <ServicesTab operationId={selectedOperation} />
        </TabsContent>

        <TabsContent value="topology" className="mt-0">
          <NetworkTopologyView
            operationId={selectedOperation}
            operationName={operations.find(op => op.id === selectedOperation)?.name}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <ActivityTab operationId={selectedOperation} />
        </TabsContent>

        <TabsContent value="config" className="mt-0">
          <ScanConfigTab operationId={selectedOperation} />
        </TabsContent>

        <TabsContent value="import" className="mt-0">
          <div className="space-y-6">
            <ScanImportCard operationId={selectedOperation} />
            <DedupCard operationId={selectedOperation} />
          </div>
        </TabsContent>
      </Tabs>

      <ScanComparisonDialog
        open={comparisonDialogOpen}
        onOpenChange={setComparisonDialogOpen}
        operationId={selectedOperation}
      />
    </div>
  );
}
