import { useState } from "react";
import { Cpu, Monitor, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImplantsTab from "@/components/implants/ImplantsTab";
import DeployAgentDialog from "@/components/implants/DeployAgentDialog";

export default function Implants() {
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<"windows" | "linux">("linux");

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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Cpu className="h-8 w-8 text-cyan-600" />
          <div>
            <h1 className="text-3xl font-bold">Agentic Implants</h1>
            <p className="text-muted-foreground mt-1">
              Autonomous rust-nexus implant management and orchestration
            </p>
          </div>
        </div>

        {/* Deploy Agent Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            onClick={handleDeployWindows}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Monitor className="h-4 w-4 mr-2" />
            Deploy Windows Agent
          </Button>
          <Button
            variant="default"
            onClick={handleDeployLinux}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Terminal className="h-4 w-4 mr-2" />
            Deploy Linux Agent
          </Button>
        </div>
      </div>

      <ImplantsTab />

      {/* Deploy Agent Dialog */}
      <DeployAgentDialog
        open={deployDialogOpen}
        onClose={() => setDeployDialogOpen(false)}
        platform={selectedPlatform}
      />
    </div>
  );
}
