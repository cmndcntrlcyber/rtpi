import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FlaskConical, Search, Code, FileCode, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Vulnerability {
  id: string;
  title: string;
  description?: string;
  severity: string;
  cveId?: string;
  cweId?: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
}

interface SendToRDDialogProps {
  open: boolean;
  vulnerability: Vulnerability | null;
  onClose: () => void;
  onSuccess?: (projectId: string) => void;
}

export default function SendToRDDialog({
  open,
  vulnerability,
  onClose,
  onSuccess,
}: SendToRDDialogProps) {
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [formData, setFormData] = useState({
    projectName: "",
    leadAgentId: "",
    includeResearchPhase: true,
    includePocPhase: true,
    includeNucleiPhase: true,
  });

  useEffect(() => {
    if (open) {
      fetchAgents();
      // Reset form with suggested name
      setFormData({
        projectName: vulnerability
          ? `R&D: ${vulnerability.title}${vulnerability.cveId ? ` (${vulnerability.cveId})` : ""}`
          : "",
        leadAgentId: "",
        includeResearchPhase: true,
        includePocPhase: true,
        includeNucleiPhase: true,
      });
    }
  }, [open, vulnerability]);

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/v1/agents", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        // Filter to R&D agents if possible
        const rdAgents = data.agents?.filter(
          (a: Agent) => a.type !== "mcp_server"
        ) || [];
        setAgents(rdAgents);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    }
  };

  const handleSubmit = async () => {
    if (!vulnerability) return;

    setLoading(true);
    try {
      const response = await fetch("/api/v1/vulnerability-rd/send-to-rd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vulnerabilityId: vulnerability.id,
          projectName: formData.projectName || undefined,
          leadAgentId: formData.leadAgentId || undefined,
          includeResearchPhase: formData.includeResearchPhase,
          includePocPhase: formData.includePocPhase,
          includeNucleiPhase: formData.includeNucleiPhase,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create R&D project");
      }

      const data = await response.json();
      toast.success(`R&D Project created with ${data.experiments.length} experiments`);
      onClose();
      onSuccess?.(data.project.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to send to R&D");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-600 text-white",
      high: "bg-orange-500 text-white",
      medium: "bg-yellow-500 text-white",
      low: "bg-blue-500 text-white",
      informational: "bg-gray-500 text-white",
    };
    return colors[severity] || "bg-gray-500 text-white";
  };

  if (!vulnerability) return null;

  const hasPhaseSelected =
    formData.includeResearchPhase ||
    formData.includePocPhase ||
    formData.includeNucleiPhase;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-600" />
            Send to R&D
          </DialogTitle>
          <DialogDescription>
            Create a research project to investigate this vulnerability
          </DialogDescription>
        </DialogHeader>

        {/* Vulnerability Summary */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">{vulnerability.title}</h4>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getSeverityColor(vulnerability.severity)}>
                  {vulnerability.severity.toUpperCase()}
                </Badge>
                {vulnerability.cveId && (
                  <Badge variant="outline">{vulnerability.cveId}</Badge>
                )}
                {vulnerability.cweId && (
                  <Badge variant="outline">{vulnerability.cweId}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Project Name */}
          <div>
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={formData.projectName}
              onChange={(e) =>
                setFormData({ ...formData, projectName: e.target.value })
              }
              placeholder="Auto-generated if left empty"
              className="mt-1"
            />
          </div>

          {/* Lead Agent */}
          <div>
            <Label htmlFor="leadAgent">Lead Agent (Optional)</Label>
            <Select
              value={formData.leadAgentId}
              onValueChange={(value) =>
                setFormData({ ...formData, leadAgentId: value === "none" ? "" : value })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select lead agent..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No lead agent</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Research Phases */}
          <div>
            <Label className="mb-3 block">Research Phases</Label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer">
                <Checkbox
                  checked={formData.includeResearchPhase}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      includeResearchPhase: !!checked,
                    })
                  }
                />
                <div className="flex items-center gap-2 flex-1">
                  <Search className="h-4 w-4 text-blue-600" />
                  <div>
                    <span className="font-medium text-sm">
                      Vulnerability Research
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Analyze exploitation vectors and attack patterns
                    </p>
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer">
                <Checkbox
                  checked={formData.includePocPhase}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, includePocPhase: !!checked })
                  }
                />
                <div className="flex items-center gap-2 flex-1">
                  <Code className="h-4 w-4 text-green-600" />
                  <div>
                    <span className="font-medium text-sm">
                      POC Development
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Develop a working Proof of Concept
                    </p>
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer">
                <Checkbox
                  checked={formData.includeNucleiPhase}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, includeNucleiPhase: !!checked })
                  }
                />
                <div className="flex items-center gap-2 flex-1">
                  <FileCode className="h-4 w-4 text-purple-600" />
                  <div>
                    <span className="font-medium text-sm">
                      Nuclei Template
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Create automated detection template
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !hasPhaseSelected}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4 mr-2" />
                Create R&D Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
