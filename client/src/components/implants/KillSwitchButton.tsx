import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OctagonX } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  workflowId: string;
  onKilled?: () => void;
}

export default function KillSwitchButton({ workflowId, onKilled }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [killing, setKilling] = useState(false);

  const handleKill = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 5000);
      return;
    }
    setKilling(true);
    try {
      await api.post(`/rust-nexus/workflows/${workflowId}/kill-switch`, {
        reason: "operator_manual",
      });
      onKilled?.();
    } catch {
      // handled
    } finally {
      setKilling(false);
      setConfirming(false);
    }
  };

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleKill}
      disabled={killing}
      className={confirming ? "animate-pulse" : ""}
    >
      <OctagonX className="h-3 w-3 mr-1" />
      {killing ? "Killing..." : confirming ? "Confirm Kill" : "Kill Switch"}
    </Button>
  );
}
