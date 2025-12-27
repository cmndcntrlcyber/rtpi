import { Cpu } from "lucide-react";
import ImplantsTab from "@/components/implants/ImplantsTab";

export default function Implants() {
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
      </div>

      <ImplantsTab />
    </div>
  );
}
