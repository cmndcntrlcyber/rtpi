import { useState, useEffect } from "react";
import { GitCompare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import OverviewTab from "@/components/surface-assessment/OverviewTab";
import VulnerabilitiesTab from "@/components/surface-assessment/VulnerabilitiesTab";
import AssetsTab from "@/components/surface-assessment/AssetsTab";
import ServicesTab from "@/components/surface-assessment/ServicesTab";
import ActivityTab from "@/components/surface-assessment/ActivityTab";
import ScanConfigTab from "@/components/surface-assessment/ScanConfigTab";
import NetworkTopologyView from "@/components/surface-assessment/NetworkTopologyView";
import ScanComparisonDialog from "@/components/surface-assessment/ScanComparisonDialog";

export default function SurfaceAssessment() {
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      const res = await api.get<{ operations: any[] }>("/operations");
      setOperations(res.operations);
      if (res.operations.length > 0) {
        setSelectedOperation(res.operations[0].id);
      }
    } catch (error) {
      // Error handled via toast
    } finally {
      setLoading(false);
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="topology">Topology</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="config">Scan Config</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab operationId={selectedOperation} />
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
          <NetworkTopologyView operationId={selectedOperation} />
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <ActivityTab operationId={selectedOperation} />
        </TabsContent>

        <TabsContent value="config" className="mt-0">
          <ScanConfigTab operationId={selectedOperation} />
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
