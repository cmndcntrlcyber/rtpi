import { useState, useEffect } from "react";
import { Cpu, Monitor, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { useFeatureFlag } from "@/lib/feature-flags";
import ImplantsTab from "@/components/implants/ImplantsTab";
import DeployAgentDialog from "@/components/implants/DeployAgentDialog";
import TaskQueueView from "@/components/implants/TaskQueueView";
import CertificatesTab from "@/components/implants/CertificatesTab";
import DistributedWorkflowDialog from "@/components/implants/DistributedWorkflowDialog";

export default function Implants() {
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<"windows" | "linux">("linux");
  const [bundlesRefreshTrigger, setBundlesRefreshTrigger] = useState(0);
  const ferryEnabled = useFeatureFlag("ferryBridge");
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>("all");

  useEffect(() => {
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

  const handleDeployWindows = () => {
    setSelectedPlatform("windows");
    setDeployDialogOpen(true);
  };

  const handleDeployLinux = () => {
    setSelectedPlatform("linux");
    setDeployDialogOpen(true);
  };

  return (
    <div className="p-8">
      <PageHeader
        icon={Cpu}
        title="Agentic Implants"
        description="Autonomous rust-nexus implant management and orchestration"
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
            <Button onClick={handleDeployWindows}>
              <Monitor aria-hidden="true" className="h-4 w-4 mr-2" />
              Deploy Windows Agent
            </Button>
            <Button onClick={handleDeployLinux}>
              <Terminal aria-hidden="true" className="h-4 w-4 mr-2" />
              Deploy Linux Agent
            </Button>
          </>
        }
      />

      <ImplantsTab bundlesRefreshTrigger={bundlesRefreshTrigger} operationId={selectedOperation === "all" ? undefined : selectedOperation} />

      {ferryEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <TaskQueueView />
          <CertificatesTab />
        </div>
      )}

      {ferryEnabled && (
        <div className="mt-6">
          <DistributedWorkflowDialog implants={[]} />
        </div>
      )}

      {/* Deploy Agent Dialog */}
      <DeployAgentDialog
        open={deployDialogOpen}
        onClose={() => setDeployDialogOpen(false)}
        platform={selectedPlatform}
        onBundleGenerated={() => setBundlesRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
}
