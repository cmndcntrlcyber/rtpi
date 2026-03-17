import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FlaskConical,
  Activity,
  PlayCircle,
  XCircle,
  FileCode,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Package,
  Loader2,
  Eye,
  Copy,
  CheckCircle2,
  BrainCircuit,
  MessageSquare,
  Clock,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

interface Experiment {
  id: string;
  name: string;
  projectId: string;
  projectName: string | null;
  status: string;
  hypothesis: string | null;
  methodology: string | null;
  results: any;
  executionLog: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Artifact {
  id: string;
  experimentId: string;
  projectId: string;
  artifactType: string;
  content: string | null;
  filename: string | null;
  language: string | null;
  metadata: any;
  createdAt: string;
}

interface AgentMessage {
  id: string;
  messageType: string;
  fromAgentRole: string;
  toAgentRole: string | null;
  subject: string;
  contentSummary: string;
  contentData: any;
  priority: string;
  status: string;
  createdAt: string;
}

interface LogEntry {
  id: string;
  level: string;
  message: string;
  timestamp: string;
  context?: any;
}

interface AgentLogData {
  experiment: { id: string; name: string; status: string; startedAt: string | null; completedAt: string | null };
  agentMessages: AgentMessage[];
  executionLog: LogEntry[];
}

// ============================================================================
// Component
// ============================================================================

export default function ExperimentsTab() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Record<string, Artifact[]>>({});
  const [executing, setExecuting] = useState<Set<string>>(new Set());

  // Promote dialog
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoteArtifact, setPromoteArtifact] = useState<Artifact | null>(null);
  const [promoteToolName, setPromoteToolName] = useState("");
  const [promoting, setPromoting] = useState(false);

  // Artifact preview
  const [previewArtifact, setPreviewArtifact] = useState<Artifact | null>(null);

  // Agent log dialog
  const [agentLogOpen, setAgentLogOpen] = useState(false);
  const [agentLogData, setAgentLogData] = useState<AgentLogData | null>(null);
  const [agentLogLoading, setAgentLogLoading] = useState(false);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ experiments: Experiment[] }>("/offsec-rd/experiments");
      setExperiments(response.experiments);
    } catch (error: any) {
      toast.error("Failed to load experiments");
    } finally {
      setLoading(false);
    }
  };

  const fetchArtifacts = async (experimentId: string) => {
    try {
      const response = await api.get<{ artifacts: Artifact[] }>(
        `/offsec-rd/experiments/${experimentId}/artifacts`
      );
      setArtifacts((prev) => ({ ...prev, [experimentId]: response.artifacts || [] }));
    } catch {
      setArtifacts((prev) => ({ ...prev, [experimentId]: [] }));
    }
  };

  const handleExecute = async (experiment: Experiment) => {
    try {
      setExecuting((prev) => new Set(prev).add(experiment.id));
      await api.post(`/offsec-rd/experiments/${experiment.id}/execute`, {
        operationId: "",
      });
      toast.success(`Experiment "${experiment.name}" execution started`);
      // Refresh after a short delay to pick up status change
      setTimeout(fetchExperiments, 1500);
    } catch (error: any) {
      toast.error(error?.message || "Failed to execute experiment");
    } finally {
      setExecuting((prev) => {
        const next = new Set(prev);
        next.delete(experiment.id);
        return next;
      });
    }
  };

  const handleCancel = async (experiment: Experiment) => {
    try {
      await api.post(`/offsec-rd/experiments/${experiment.id}/cancel`);
      toast.success(`Experiment "${experiment.name}" cancelled`);
      fetchExperiments();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel experiment");
    }
  };

  const handleToggleExpand = (experimentId: string) => {
    if (expandedId === experimentId) {
      setExpandedId(null);
    } else {
      setExpandedId(experimentId);
      if (!artifacts[experimentId]) {
        fetchArtifacts(experimentId);
      }
    }
  };

  const handlePromote = async () => {
    if (!promoteArtifact) return;
    try {
      setPromoting(true);
      const result = await api.post<{ success: boolean; toolId?: string; error?: string }>(
        `/offsec-rd/artifacts/${promoteArtifact.id}/promote`,
        { toolName: promoteToolName || undefined }
      );
      if (result.success) {
        toast.success(`Artifact promoted to Tool Registry as "${result.toolId}"`);
      } else {
        toast.error(result.error || "Promotion failed");
      }
      setPromoteDialogOpen(false);
      setPromoteArtifact(null);
      setPromoteToolName("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to promote artifact");
    } finally {
      setPromoting(false);
    }
  };

  const handleViewAgentLog = async (experimentId: string) => {
    try {
      setAgentLogLoading(true);
      setAgentLogOpen(true);
      const data = await api.get<AgentLogData>(`/offsec-rd/experiments/${experimentId}/agent-log`);
      setAgentLogData(data);
    } catch (error: any) {
      toast.error("Failed to load agent log");
      setAgentLogOpen(false);
    } finally {
      setAgentLogLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "research_agent": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "maldev_agent": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "poc_developer": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "nuclei_template_developer": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "rd_team": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
      case "operations_manager": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "running": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "failed": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "cancelled": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
  };

  const getArtifactTypeLabel = (type: string) => {
    switch (type) {
      case "poc_code": return "POC Code";
      case "research_document": return "Research";
      case "nuclei_template": return "Nuclei Template";
      default: return type;
    }
  };

  const getArtifactTypeColor = (type: string) => {
    switch (type) {
      case "poc_code": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "research_document": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "nuclei_template": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-muted-foreground">Loading experiments...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{experiments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Planned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {experiments.filter((e) => e.status === "planned").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {experiments.filter((e) => e.status === "running").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {experiments.filter((e) => e.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {experiments.filter((e) => e.status === "failed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Experiments List */}
      <div className="space-y-4">
        {experiments.map((experiment) => {
          const isExpanded = expandedId === experiment.id;
          const expArtifacts = artifacts[experiment.id] || [];

          return (
            <Card key={experiment.id} className="overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-teal-100 dark:bg-teal-900 p-3 rounded-lg">
                      <FlaskConical className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-foreground">{experiment.name}</h3>
                        <Badge className={getStatusColor(experiment.status)}>
                          {experiment.status}
                        </Badge>
                      </div>
                      {experiment.projectName && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Project: {experiment.projectName}
                        </p>
                      )}
                      {experiment.hypothesis && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Hypothesis:</span> {experiment.hypothesis}
                        </p>
                      )}
                      {experiment.errorMessage && (
                        <p className="text-sm text-red-600 mt-1">
                          Error: {experiment.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {experiment.status === "planned" && (
                      <Button
                        size="sm"
                        onClick={() => handleExecute(experiment)}
                        disabled={executing.has(experiment.id)}
                      >
                        {executing.has(experiment.id) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4 mr-2" />
                        )}
                        Execute
                      </Button>
                    )}
                    {experiment.status === "running" && (
                      <Button size="sm" variant="destructive" onClick={() => handleCancel(experiment)}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                    {experiment.status !== "planned" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewAgentLog(experiment.id)}
                      >
                        <BrainCircuit className="h-4 w-4 mr-2" />
                        Agent Log
                      </Button>
                    )}
                    {(experiment.status === "completed" || experiment.status === "failed") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleExpand(experiment.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        )}
                        {isExpanded ? "Hide" : "Artifacts"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Artifacts Section */}
                {isExpanded && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      Generated Artifacts ({expArtifacts.length})
                    </h4>

                    {expArtifacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No artifacts generated for this experiment
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {expArtifacts.map((artifact) => (
                          <div
                            key={artifact.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Badge className={getArtifactTypeColor(artifact.artifactType)}>
                                {getArtifactTypeLabel(artifact.artifactType)}
                              </Badge>
                              <span className="text-sm font-medium truncate">
                                {artifact.filename || artifact.id.substring(0, 8)}
                              </span>
                              {artifact.language && (
                                <Badge variant="outline" className="text-xs">
                                  {artifact.language}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(artifact.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex gap-2 ml-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPreviewArtifact(artifact)}
                                title="Preview"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {artifact.content && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(artifact.content!)}
                                  title="Copy"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                              {artifact.artifactType === "poc_code" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPromoteArtifact(artifact);
                                    setPromoteToolName(artifact.filename || "");
                                    setPromoteDialogOpen(true);
                                  }}
                                  title="Promote to Tool Registry"
                                >
                                  <ArrowUpRight className="h-4 w-4 mr-1" />
                                  Promote
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Execution Log */}
                    {experiment.executionLog && (
                      <details className="mt-4">
                        <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                          Execution Log
                        </summary>
                        <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
                          {experiment.executionLog}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {experiments.length === 0 && (
        <div className="text-center py-12">
          <FlaskConical className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No experiments yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create a research project first, then add experiments to it
          </p>
        </div>
      )}

      {/* Artifact Preview Dialog */}
      <Dialog open={!!previewArtifact} onOpenChange={() => setPreviewArtifact(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {previewArtifact?.filename || "Artifact Preview"}
              {previewArtifact?.language && (
                <Badge variant="outline">{previewArtifact.language}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            <pre className="p-4 bg-muted rounded-lg text-sm font-mono whitespace-pre-wrap">
              {previewArtifact?.content || "No content available"}
            </pre>
          </div>
          <DialogFooter>
            {previewArtifact?.content && (
              <Button
                variant="outline"
                onClick={() => copyToClipboard(previewArtifact.content!)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            )}
            <Button onClick={() => setPreviewArtifact(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to Tool Registry Dialog */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Promote Artifact to Tool Registry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Artifact</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {promoteArtifact?.filename || promoteArtifact?.id.substring(0, 8)}
                {" "}({getArtifactTypeLabel(promoteArtifact?.artifactType || "")})
              </p>
            </div>
            <div>
              <Label htmlFor="promote-name">Tool Name</Label>
              <Input
                id="promote-name"
                value={promoteToolName}
                onChange={(e) => setPromoteToolName(e.target.value)}
                placeholder="e.g., custom-sqli-exploit"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The tool will be added to the Tool Registry with ATT&CK mappings auto-assigned
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePromote} disabled={promoting}>
              {promoting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Promoting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Promote to Registry
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Communication Log Dialog */}
      <Dialog open={agentLogOpen} onOpenChange={setAgentLogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <BrainCircuit className="h-5 w-5 text-purple-500" />
              Agent Communication Log
              {agentLogData?.experiment && (
                <Badge className={getStatusColor(agentLogData.experiment.status)}>
                  {agentLogData.experiment.status}
                </Badge>
              )}
            </DialogTitle>
            {agentLogData?.experiment && (
              <p className="text-sm text-muted-foreground">
                {agentLogData.experiment.name}
              </p>
            )}
          </DialogHeader>

          {agentLogLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <span className="ml-3 text-muted-foreground">Loading agent communications...</span>
            </div>
          ) : agentLogData ? (
            <Tabs defaultValue="messages" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="messages" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Agent Messages ({agentLogData.agentMessages.length})
                </TabsTrigger>
                <TabsTrigger value="execution" className="flex-1">
                  <Activity className="h-4 w-4 mr-2" />
                  Execution Log ({agentLogData.executionLog.length})
                </TabsTrigger>
              </TabsList>

              {/* Agent Messages Tab */}
              <TabsContent value="messages" className="mt-4">
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {agentLogData.agentMessages.length === 0 ? (
                    <div className="text-center py-8 border border-border rounded-lg bg-muted/50">
                      <BrainCircuit className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No agent communications recorded</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Messages between agents will appear here during experiment execution
                      </p>
                    </div>
                  ) : (
                    agentLogData.agentMessages.map((msg) => (
                      <div key={msg.id} className="border border-border rounded-lg overflow-hidden">
                        {/* Message Header */}
                        <div className="flex items-center justify-between p-3 bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Badge className={getRoleBadgeColor(msg.fromAgentRole)}>
                              {formatRoleName(msg.fromAgentRole)}
                            </Badge>
                            {msg.toAgentRole && (
                              <>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge className={getRoleBadgeColor(msg.toAgentRole)}>
                                  {formatRoleName(msg.toAgentRole)}
                                </Badge>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {msg.messageType}
                            </Badge>
                            {msg.priority !== "normal" && (
                              <Badge variant="outline" className={
                                msg.priority === "critical" ? "text-red-600 border-red-300" :
                                msg.priority === "high" ? "text-orange-600 border-orange-300" :
                                "text-gray-600"
                              }>
                                {msg.priority}
                              </Badge>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {/* Message Content */}
                        <div className="p-3">
                          <h4 className="font-medium text-sm text-foreground mb-1">{msg.subject}</h4>
                          <p className="text-sm text-muted-foreground">{msg.contentSummary}</p>

                          {/* Expandable data payload */}
                          {msg.contentData && Object.keys(msg.contentData).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                                View Data Payload
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {JSON.stringify(msg.contentData, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Execution Log Tab */}
              <TabsContent value="execution" className="mt-4">
                <div className="space-y-1 max-h-[500px] overflow-y-auto border border-border rounded-lg p-3 bg-muted/50">
                  {agentLogData.executionLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No execution log entries available
                    </p>
                  ) : (
                    agentLogData.executionLog.map((log) => (
                      <div
                        key={log.id}
                        className={`p-2 rounded text-xs font-mono ${
                          log.level === "error"
                            ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-card text-foreground"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={`font-medium uppercase ${
                            log.level === "error" ? "text-red-600" : "text-blue-600"
                          }`}>
                            [{log.level}]
                          </span>
                          <span className="flex-1">{log.message}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Timing info */}
                {agentLogData.experiment.startedAt && (
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Started: {new Date(agentLogData.experiment.startedAt).toLocaleString()}
                    </span>
                    {agentLogData.experiment.completedAt && (
                      <>
                        <span>
                          Completed: {new Date(agentLogData.experiment.completedAt).toLocaleString()}
                        </span>
                        <span>
                          Duration: {Math.round(
                            (new Date(agentLogData.experiment.completedAt).getTime() -
                              new Date(agentLogData.experiment.startedAt).getTime()) / 1000
                          )}s
                        </span>
                      </>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
