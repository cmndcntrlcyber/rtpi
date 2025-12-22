import { Crown } from "lucide-react";
import EmpireTab from "@/components/empire/EmpireTab";

export default function Empire() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold">Empire C2</h1>
            <p className="text-muted-foreground mt-1">
              Command and Control framework integration
            </p>
          </div>
        </div>
      </div>

      <EmpireTab />
    </div>
  );
}
