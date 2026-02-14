import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAgents } from "@/hooks/useAgents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Wrench,
  GitBranch,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface GitHubToolsDialogProps {
  mode: "install" | "create";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BuildStatus {
  status: string;
  buildLog?: string;
  error?: string;
  repairAttempts?: number;
  currentStep?: string;
}

const PIPELINE_STEPS = [
  { key: "researching", label: "Researching repositories" },
  { key: "generating_dockerfile", label: "Generating Dockerfile" },
  { key: "building_image", label: "Building Docker image" },
  { key: "repairing", label: "Repairing Dockerfile" },
  { key: "starting_container", label: "Starting container" },
  { key: "registering_mcp", label: "Registering MCP server" },
  { key: "attaching_agent", label: "Attaching to agent" },
];

export default function GitHubToolsDialog({
  mode,
  open,
  onOpenChange,
}: GitHubToolsDialogProps) {
  const { agents } = useAgents();

  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [githubUrls, setGithubUrls] = useState("");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Poll build status
  useEffect(() => {
    if (!buildId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/agent-tool-builds/${buildId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setBuildStatus(data);
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch {
        // Silently retry on network errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [buildId]);

  // Reset state when dialog closes
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTimeout(() => {
        setName("");
        setAgentId("");
        setGithubUrls("");
        setBuildId(null);
        setBuildStatus(null);
        setSubmitting(false);
      }, 300);
    }
  };

  const handleSubmit = async () => {
    const urls = githubUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (!name || !agentId || urls.length === 0) {
      toast.error("Missing fields", {
        description: "Please fill in all fields",
      });
      return;
    }

    // Validate URLs
    const invalidUrls = urls.filter(
      (u) => !u.match(/github\.com\/[^/]+\/[^/]+/)
    );
    if (invalidUrls.length > 0) {
      toast.error("Invalid URLs", {
        description: `Invalid GitHub URLs: ${invalidUrls.join(", ")}`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/agent-tool-builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, mode, agentId, githubUrls: urls }),
      });
      if (!response.ok) throw new Error("Failed to start build");
      const data = await response.json();
      setBuildId(data.buildId);
    } catch (err: any) {
      toast.error("Build failed", {
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTryAgain = () => {
    setBuildId(null);
    setBuildStatus(null);
  };

  const getStepIndex = (stepKey: string) =>
    PIPELINE_STEPS.findIndex((s) => s.key === stepKey);

  const currentStepIndex = buildStatus
    ? getStepIndex(buildStatus.status)
    : -1;

  const hasEnteredRepair = (buildStatus?.repairAttempts ?? 0) > 0;
  const repairingStepIndex = getStepIndex("repairing");
  const buildingStepIndex = getStepIndex("building_image");

  const renderStepIcon = (stepKey: string, index: number) => {
    if (buildStatus?.status === "completed") {
      // Skip the repair step icon if repair was never triggered
      if (stepKey === "repairing" && !hasEnteredRepair) {
        return <CheckCircle2 className="h-5 w-5 text-green-500/40 shrink-0" />;
      }
      return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
    }

    if (buildStatus?.status === "failed" && index === currentStepIndex) {
      return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
    }

    // When repairing: show building_image as needing retry (orange), repair step as active
    if (buildStatus?.status === "repairing") {
      if (stepKey === "building_image") {
        return <RefreshCw className="h-5 w-5 text-orange-500 shrink-0" />;
      }
      if (stepKey === "repairing") {
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />;
      }
      if (index < buildingStepIndex) {
        return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
      }
      return <div className="h-5 w-5 rounded-full bg-muted border border-border shrink-0" />;
    }

    // When rebuilding after repair: show repair step as complete, building_image as active
    if (buildStatus?.status === "building_image" && hasEnteredRepair) {
      if (stepKey === "repairing") {
        return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
      }
    }

    // Skip repair step if never entered repair and we're past building
    if (stepKey === "repairing" && !hasEnteredRepair && currentStepIndex > repairingStepIndex) {
      return <CheckCircle2 className="h-5 w-5 text-green-500/40 shrink-0" />;
    }

    if (index < currentStepIndex) {
      return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
    }

    if (index === currentStepIndex) {
      return (
        <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
      );
    }

    // Future step
    return (
      <div className="h-5 w-5 rounded-full bg-muted border border-border shrink-0" />
    );
  };

  const isFormValid =
    name.trim().length > 0 &&
    agentId.length > 0 &&
    githubUrls.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "install" ? (
              <Download className="h-5 w-5" />
            ) : (
              <Wrench className="h-5 w-5" />
            )}
            {mode === "install" ? "Install from GitHub" : "Create Agent Tools"}
          </DialogTitle>
          <DialogDescription>
            {mode === "install"
              ? "Install tools from GitHub repositories into an existing agent container"
              : "Create a new agent tool container from GitHub repositories"}
          </DialogDescription>
        </DialogHeader>

        {!buildId ? (
          /* Form View */
          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label htmlFor="collection-name">Collection Name</Label>
              <Input
                id="collection-name"
                placeholder="e.g., web-fuzzing-tools"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Agent Select */}
            <div>
              <Label htmlFor="agent-select">Assign to Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        {agent.name}
                        <Badge variant="outline" className="text-xs">
                          {agent.type}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* GitHub URLs */}
            <div>
              <Label htmlFor="github-urls">GitHub Repositories</Label>
              <Textarea
                id="github-urls"
                placeholder={
                  "https://github.com/owner/repo\nhttps://github.com/owner/another-repo"
                }
                value={githubUrls}
                onChange={(e) => setGithubUrls(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter one GitHub repository URL per line
              </p>
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!isFormValid || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {mode === "install"
                    ? "Installing Tools..."
                    : "Creating Container..."}
                </>
              ) : (
                <>
                  {mode === "install" ? (
                    <Download className="h-4 w-4 mr-2" />
                  ) : (
                    <Wrench className="h-4 w-4 mr-2" />
                  )}
                  {mode === "install" ? "Install Tools" : "Create Container"}
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Progress View */
          <div className="space-y-4">
            {/* Pipeline Steps */}
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, index) => {
                // Determine step label — show attempt count for repair step
                let label = step.label;
                if (step.key === "repairing" && hasEnteredRepair) {
                  label = `Repairing Dockerfile (attempt ${buildStatus?.repairAttempts ?? 1} of 3)`;
                }

                // Determine text style
                const isActive =
                  index <= currentStepIndex ||
                  buildStatus?.status === "completed" ||
                  (step.key === "repairing" && buildStatus?.status === "repairing");
                const isSkipped = step.key === "repairing" && !hasEnteredRepair;

                return (
                  <div key={step.key} className="flex items-center gap-3">
                    {renderStepIcon(step.key, index)}
                    <span
                      className={
                        isSkipped
                          ? "text-sm text-muted-foreground/50"
                          : isActive
                            ? "text-sm text-foreground"
                            : "text-sm text-muted-foreground"
                      }
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Build Log */}
            {buildStatus?.buildLog && (
              <div className="mt-4">
                <Label>Build Log</Label>
                <pre className="mt-2 p-3 bg-secondary rounded-lg text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {buildStatus.buildLog}
                </pre>
              </div>
            )}

            {/* Status Footer */}
            {buildStatus?.status === "completed" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-sm text-green-500">
                    Build completed successfully
                  </span>
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            )}

            {buildStatus?.status === "failed" && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-red-500">
                    {buildStatus.error || "Build failed"}
                  </span>
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleTryAgain}
                >
                  <GitBranch className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}

            {buildStatus?.status !== "completed" &&
              buildStatus?.status !== "failed" && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building...
                </div>
              )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
