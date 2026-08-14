import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Play, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

interface Implant {
  id: string;
  name: string;
  status: string;
  capabilities?: string[];
}

interface Props {
  implants: Implant[];
  onComplete?: () => void;
}

export default function DistributedWorkflowDialog({ implants, onComplete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [taskName, setTaskName] = useState("");
  const [params, setParams] = useState("");
  const [autonomy, setAutonomy] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeImplants = implants.filter((i) => i.status === "connected" || i.status === "active");

  const toggleImplant = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const submit = async () => {
    if (selected.size === 0 || !taskName) return;
    setSubmitting(true);
    setError(null);
    try {
      let parsedParams = {};
      if (params.trim()) {
        parsedParams = JSON.parse(params);
      }
      await api.post("/rust-nexus/workflows/distributed", {
        implant_ids: Array.from(selected),
        task: { tool_name: taskName, parameters: parsedParams },
        autonomy_level: autonomy,
        safety_limits: { max_duration_ms: 600000, max_tasks: 50 },
      });
      onComplete?.();
    } catch (e: any) {
      setError(e?.message || "Failed to create workflow");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Network className="h-4 w-4" />
          Distributed Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Implant selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Select Implants</label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {activeImplants.map((imp) => (
              <label
                key={imp.id}
                className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(imp.id)}
                  onChange={() => toggleImplant(imp.id)}
                  className="rounded"
                />
                <span className="font-mono">{imp.name || imp.id.slice(0, 12)}</span>
                <Badge variant="outline" className="text-[10px] ml-auto">{imp.status}</Badge>
              </label>
            ))}
            {activeImplants.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">No active implants</p>
            )}
          </div>
        </div>

        {/* Task config */}
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tool / Skill Name</label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="offense/recon/nmap-scan"
              className="w-full mt-1 px-2 py-1.5 text-xs rounded border bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Parameters (JSON)</label>
            <textarea
              value={params}
              onChange={(e) => setParams(e.target.value)}
              placeholder='{"target": "10.0.0.0/24"}'
              rows={2}
              className="w-full mt-1 px-2 py-1.5 text-xs rounded border bg-background font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Autonomy Level: {autonomy}
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={autonomy}
              onChange={(e) => setAutonomy(Number(e.target.value))}
              className="w-full mt-1"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Manual</span>
              <span>Supervised</span>
              <span>Autonomous</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {error}
          </div>
        )}

        <Button
          onClick={submit}
          disabled={selected.size === 0 || !taskName || submitting}
          className="w-full"
          size="sm"
        >
          <Play className="h-3 w-3 mr-1" />
          {submitting ? "Submitting..." : `Launch on ${selected.size} implant${selected.size !== 1 ? "s" : ""}`}
        </Button>
      </CardContent>
    </Card>
  );
}
