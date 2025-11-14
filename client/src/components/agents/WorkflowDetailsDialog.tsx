import { useState, useEffect } from "react";
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
  FileText,
  Loader2,
  Circle,
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
      cancelled: { className: "bg-gray-500/10 text-gray-600", label: "CANCELLED" },
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
        return <Circle className="h-5 w-5 text-gray-400" />;
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
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span className="font-medium">Overall Progress</span>
              <span>{workflow.progress}%</span>
            </div>
            <Progress value={workflow.progress} className="h-3" />
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
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
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-3 mt-4">
              {tasks
                .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                .map((task) => {
                  const agent = agents.find((a) => a.id === task.agentId);
                  
                  return (
                    <div key={task.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getTaskIcon(task.status)}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">{task.taskName}</h4>
                            {getStatusBadge(task.status)}
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>
                              <span className="font-medium">Agent:</span> {agent?.name || "Unknown"}
                            </div>
                            <div>
                              <span className="font-medium">Type:</span> {task.taskType}
                            </div>
                            {task.startedAt && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
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
                              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                                View Output
                              </summary>
                              <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
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
              <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No logs available</p>
                ) : (
                  logs
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((log, index) => (
                      <div
                        key={log.id || index}
                        className={`p-2 rounded text-xs font-mono ${
                          log.level === "error"
                            ? "bg-red-50 text-red-700"
                            : log.level === "warning"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-white text-gray-700"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 whitespace-nowrap">
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

            {/* Details Tab */}
            <TabsContent value="details" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Workflow ID</Label>
                    <p className="text-sm font-mono text-gray-900">{workflow.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Type</Label>
                    <p className="text-sm text-gray-900">{workflow.workflowType}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Target ID</Label>
                    <p className="text-sm font-mono text-gray-900">{workflow.targetId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Created At</Label>
                    <p className="text-sm text-gray-900">
                      {new Date(workflow.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {workflow.metadata && (
                  <div>
                    <Label className="text-xs text-gray-500">Metadata</Label>
                    <pre className="mt-1 p-3 bg-gray-50 rounded text-xs font-mono overflow-x-auto">
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
