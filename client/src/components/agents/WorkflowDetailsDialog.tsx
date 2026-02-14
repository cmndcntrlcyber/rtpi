import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Loader2,
  Circle,
  BrainCircuit,
} from "lucide-react";
import type { WorkflowDetails } from "@/hooks/useWorkflows";

interface WorkflowDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowDetails: WorkflowDetails | null;
  agents: any[];
}

export default function WorkflowDetailsDialog({
  open,
  onOpenChange,
  workflowDetails,
  agents,
}: WorkflowDetailsDialogProps) {
  if (!workflowDetails) return null;

  const { workflow, tasks, logs } = workflowDetails;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      pending: { className: "bg-yellow-500/10 text-yellow-600", label: "PENDING" },
      running: { className: "bg-blue-500/10 text-blue-600", label: "RUNNING" },
      completed: { className: "bg-green-500/10 text-green-600", label: "COMPLETED" },
      failed: { className: "bg-red-500/10 text-red-600", label: "FAILED" },
      cancelled: { className: "bg-secondary0/10 text-muted-foreground", label: "CANCELLED" },
      in_progress: { className: "bg-blue-500/10 text-blue-600", label: "IN PROGRESS" },
    };

    const variant = variants[status] || variants.pending;

    return (
      <Badge variant="secondary" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const getTaskIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "in_progress":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-600" />
            {workflow.name}
            {getStatusBadge(workflow.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Overview */}
          <div className="p-4 bg-secondary rounded-lg">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span className="font-medium">Overall Progress</span>
              <span>{workflow.progress}%</span>
            </div>
            <Progress value={workflow.progress} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
              <div>
                {workflow.startedAt && (
                  <span>Started: {new Date(workflow.startedAt).toLocaleString()}</span>
                )}
              </div>
              <div>
                {workflow.completedAt && (
                  <span>Completed: {new Date(workflow.completedAt).toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="tasks" className="flex-1">Tasks</TabsTrigger>
              <TabsTrigger value="logs" className="flex-1">Logs</TabsTrigger>
              <TabsTrigger value="ai-logs" className="flex-1">AI Logs</TabsTrigger>
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-3 mt-4">
              {tasks
                .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                .map((task) => {
                  const agent = agents.find((a) => a.id === task.agentId);
                  
                  return (
                    <div key={task.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getTaskIcon(task.status)}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-foreground">{task.taskName}</h4>
                            {getStatusBadge(task.status)}
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>
                              <span className="font-medium">Agent:</span> {agent?.name || "Unknown"}
                            </div>
                            <div>
                              <span className="font-medium">Type:</span> {task.taskType}
                            </div>
                            {task.startedAt && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {task.completedAt
                                    ? `Duration: ${Math.floor(
                                        (new Date(task.completedAt).getTime() -
                                          new Date(task.startedAt).getTime()) /
                                          1000
                                      )}s`
                                    : `Started: ${new Date(task.startedAt).toLocaleString()}`}
                                </span>
                              </div>
                            )}
                          </div>

                          {task.errorMessage && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                              <span className="font-medium">Error:</span> {task.errorMessage}
                            </div>
                          )}

                          {task.outputData && task.outputData.rawResponse && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                View Output
                              </summary>
                              <div className="mt-2 p-2 bg-secondary rounded text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {task.outputData.rawResponse}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="mt-4">
              <div className="space-y-2 max-h-96 overflow-y-auto border border-border rounded-lg p-3 bg-secondary">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No logs available</p>
                ) : (
                  logs
                    .filter((log) => log.level !== "ai_call")
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((log, index) => (
                      <div
                        key={log.id || index}
                        className={`p-2 rounded text-xs font-mono ${
                          log.level === "error"
                            ? "bg-red-50 text-red-700"
                            : log.level === "warning"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-card text-foreground"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="font-medium uppercase">[{log.level}]</span>
                          <span className="flex-1">{log.message}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </TabsContent>

            {/* AI Logs Tab */}
            <TabsContent value="ai-logs" className="mt-4">
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {(() => {
                  const aiLogs = logs
                    .filter((log) => log.level === "ai_call")
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                  if (aiLogs.length === 0) {
                    return (
                      <div className="text-sm text-muted-foreground text-center py-8 border border-border rounded-lg bg-secondary">
                        <BrainCircuit className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p>No AI communication logs available</p>
                        <p className="text-xs mt-1">AI logs will appear here once the workflow makes LLM calls</p>
                      </div>
                    );
                  }

                  return aiLogs.map((log, index) => (
                    <div key={log.id || index} className="border border-border rounded-lg overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between p-3 bg-secondary">
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="h-4 w-4 text-purple-500" />
                          <span className="font-medium text-sm text-foreground">
                            {log.context?.phase || "AI Call"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {log.context?.provider && log.context?.model && (
                            <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 text-xs">
                              {log.context.provider}/{log.context.model}
                            </Badge>
                          )}
                          {log.context?.durationMs != null && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {(log.context.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {/* Stats bar */}
                      <div className="flex items-center gap-4 px-3 py-1.5 bg-card text-xs text-muted-foreground border-b border-border">
                        {log.context?.promptCharCount != null && (
                          <span>Prompt: {log.context.promptCharCount.toLocaleString()} chars</span>
                        )}
                        {log.context?.responseCharCount != null && (
                          <span>Response: {log.context.responseCharCount.toLocaleString()} chars</span>
                        )}
                        {log.context?.error && (
                          <span className="text-red-500">Error: {log.context.error}</span>
                        )}
                      </div>

                      {/* Prompt (collapsible) */}
                      {log.context?.prompt && Array.isArray(log.context.prompt) && (
                        <details className="border-b border-border">
                          <summary className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-secondary/50 select-none">
                            Prompt Sent ({log.context.prompt.length} message{log.context.prompt.length !== 1 ? "s" : ""})
                          </summary>
                          <div className="px-3 py-2 bg-card">
                            {log.context.prompt.map((msg: { role: string; content: string }, i: number) => (
                              <div key={i} className="mb-2 last:mb-0">
                                <span className="text-xs font-semibold uppercase text-purple-500">[{msg.role}]</span>
                                <pre className="mt-1 text-xs font-mono whitespace-pre-wrap text-foreground max-h-64 overflow-y-auto bg-secondary rounded p-2">
                                  {msg.content}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Response (collapsible) */}
                      {log.context?.response && (
                        <details>
                          <summary className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-secondary/50 select-none">
                            Response Received
                          </summary>
                          <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap text-foreground max-h-64 overflow-y-auto bg-card">
                            {log.context.response}
                          </pre>
                        </details>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Workflow ID</Label>
                    <p className="text-sm font-mono text-foreground">{workflow.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <p className="text-sm text-foreground">{workflow.workflowType}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Target ID</Label>
                    <p className="text-sm font-mono text-foreground">{workflow.targetId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Created At</Label>
                    <p className="text-sm text-foreground">
                      {new Date(workflow.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {workflow.metadata && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Metadata</Label>
                    <pre className="mt-1 p-3 bg-secondary rounded text-xs font-mono overflow-x-auto">
                      {JSON.stringify(workflow.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
