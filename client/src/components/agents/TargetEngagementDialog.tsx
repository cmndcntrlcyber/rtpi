import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Target, Zap, Activity, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

interface TargetEngagementDialogProps {
  open: boolean;
  onClose: () => void;
  agent: any;
  targets: any[];
  tools: any[];
}

export default function TargetEngagementDialog({
  open,
  onClose,
  agent,
  targets,
  tools,
}: TargetEngagementDialogProps) {
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isEngaging, setIsEngaging] = useState(false);
  const [engagementStatus, setEngagementStatus] = useState<any>(null);

  // Pre-select agent's enabled tools
  useEffect(() => {
    if (agent?.config?.enabledTools && agent.config.enabledTools.length > 0) {
      setSelectedTools(agent.config.enabledTools);
    }
  }, [agent]);

  // Check if there's an active engagement for this agent
  useEffect(() => {
    if (open && agent) {
      checkEngagementStatus();
    }
  }, [open, agent]);

  const checkEngagementStatus = async () => {
    try {
      const response = await api.get(`/agents/${agent.id}/engagement-status`);
      setEngagementStatus(response.status || null);
    } catch (err) {
      console.error("Failed to check engagement status:", err);
      setEngagementStatus(null);
    }
  };

  const handleToggleTarget = (targetId: string) => {
    setSelectedTargets((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleToggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  const handleSelectAllTargets = () => {
    if (selectedTargets.length === targets.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(targets.map((t) => t.id));
    }
  };

  const handleSelectAllTools = () => {
    const agentTools = tools.filter((t) => 
      agent?.config?.enabledTools?.includes(t.id)
    );
    
    if (selectedTools.length === agentTools.length) {
      setSelectedTools([]);
    } else {
      setSelectedTools(agentTools.map((t) => t.id));
    }
  };

  const handleEngage = async () => {
    if (selectedTargets.length === 0 || selectedTools.length === 0) {
      alert("Please select at least one target and one tool");
      return;
    }

    setIsEngaging(true);
    try {
      const response = await api.post(`/agents/${agent.id}/engage`, {
        targetIds: selectedTargets,
        toolIds: selectedTools,
      });

      alert(`Engagement initiated! ${response.message || "Agent is now executing tools against selected targets."}`);
      await checkEngagementStatus();
    } catch (err: any) {
      console.error("Failed to engage:", err);
      alert(`Failed to engage: ${err.message || "Unknown error"}`);
    } finally {
      setIsEngaging(false);
    }
  };

  const handleDisengage = async () => {
    if (!confirm("Are you sure you want to disengage the agent?")) {
      return;
    }

    setIsEngaging(true);
    try {
      const response = await api.post(`/agents/${agent.id}/disengage`, {});

      alert(`Disengagement complete! ${response.message || "Agent has stopped tool execution."}`);
      await checkEngagementStatus();
    } catch (err: any) {
      console.error("Failed to disengage:", err);
      alert(`Failed to disengage: ${err.message || "Unknown error"}`);
    } finally {
      setIsEngaging(false);
    }
  };

  // Filter tools to only show agent's enabled tools
  const availableTools = tools.filter((t) => 
    agent?.config?.enabledTools?.includes(t.id)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Target Engagement - {agent?.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Select targets and tools to engage, then click &quot;Engage&quot; to start tool execution
          </p>
        </DialogHeader>

        {/* Engagement Status Banner */}
        {engagementStatus && (
          <div className={`p-4 rounded-lg border ${
            engagementStatus.active 
              ? "bg-green-50 border-green-200" 
              : "bg-secondary border-border"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {engagementStatus.active ? (
                <Activity className="h-5 w-5 text-green-600 animate-pulse" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              )}
              <h4 className="font-semibold text-foreground">
                {engagementStatus.active ? "Currently Engaged" : "Not Engaged"}
              </h4>
            </div>
            {engagementStatus.active && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Targets: {engagementStatus.targetCount || 0}</p>
                <p>Tools: {engagementStatus.toolCount || 0}</p>
                <p>Started: {new Date(engagementStatus.startedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Targets Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Select Targets</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllTargets}
                className="text-xs"
              >
                {selectedTargets.length === targets.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="border border-border rounded-lg max-h-[400px] overflow-y-auto">
              {targets.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm">No targets available</p>
                  <p className="text-xs">Create targets first to engage</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {targets.map((target) => (
                    <div
                      key={target.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedTargets.includes(target.id)
                          ? "bg-blue-50 border-blue-200"
                          : "bg-card border-border hover:bg-secondary"
                      }`}
                      onClick={() => handleToggleTarget(target.id)}
                    >
                      <Checkbox
                        checked={selectedTargets.includes(target.id)}
                        onCheckedChange={() => handleToggleTarget(target.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground text-sm truncate">
                          {target.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {target.type}
                          </Badge>
                          <span className="ml-2">{target.value}</span>
                        </p>
                        {target.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {target.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 text-xs text-muted-foreground text-center">
              {selectedTargets.length} target(s) selected
            </div>
          </div>

          {/* Tools Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Select Tools</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllTools}
                className="text-xs"
              >
                {selectedTools.length === availableTools.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="border border-border rounded-lg max-h-[400px] overflow-y-auto">
              {availableTools.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm">No tools enabled</p>
                  <p className="text-xs">Enable tools in agent configuration</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {availableTools.map((tool) => (
                    <div
                      key={tool.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedTools.includes(tool.id)
                          ? "bg-indigo-50 border-indigo-200"
                          : "bg-card border-border hover:bg-secondary"
                      }`}
                      onClick={() => handleToggleTool(tool.id)}
                    >
                      <Checkbox
                        checked={selectedTools.includes(tool.id)}
                        onCheckedChange={() => handleToggleTool(tool.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground text-sm">
                          {tool.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {tool.category.replace(/_/g, " ")}
                          </Badge>
                        </p>
                        {tool.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 text-xs text-muted-foreground text-center">
              {selectedTools.length} tool(s) selected
            </div>
          </div>
        </div>

        {/* Engagement Info */}
        {selectedTargets.length > 0 && selectedTools.length > 0 && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Ready to Engage
            </h4>
            <p className="text-xs text-muted-foreground">
              The agent will execute {selectedTools.length} tool(s) against {selectedTargets.length} target(s).
              Tools will run in the order configured in the agent settings.
            </p>
          </div>
        )}

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isEngaging}
          >
            Cancel
          </Button>
          
          <div className="flex gap-2">
            {engagementStatus?.active ? (
              <Button
                variant="destructive"
                onClick={handleDisengage}
                disabled={isEngaging}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {isEngaging ? "Disengaging..." : "Disengage"}
              </Button>
            ) : (
              <Button
                onClick={handleEngage}
                disabled={
                  isEngaging ||
                  selectedTargets.length === 0 ||
                  selectedTools.length === 0
                }
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isEngaging ? "Engaging..." : "Engage"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
