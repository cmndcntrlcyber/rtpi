import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Eye, CheckCircle, XCircle, Clock, Download, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface CompletedWorkflowsProps {
  operationId?: string;
  onViewDetails?: (workflowId: string) => void;
}

export default function CompletedWorkflows({
  operationId,
  onViewDetails,
}: CompletedWorkflowsProps) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowReports, setWorkflowReports] = useState<Record<string, any>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (operationId) {
      loadWorkflows();
    }
  }, [operationId]);

  const loadWorkflows = async () => {
    if (!operationId) return;

    try {
      const response = await api.get<{ workflows: any[] }>("/agent-workflows");
      // Filter workflows for this operation
      const filtered = response.workflows.filter(
        (w) => w.operationId === operationId
      );
      setWorkflows(filtered);

      // Load reports for completed workflows
      await loadReportsForWorkflows(filtered);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    }
  };

  const loadReportsForWorkflows = async (workflowList: any[]) => {
    const reportsMap: Record<string, any> = {};
    
    // Only fetch reports for completed workflows
    const completedWorkflows = workflowList.filter(w => w.status === "completed");
    
    for (const workflow of completedWorkflows) {
      try {
        const response = await api.get<{ report: any }>(`/reports/workflow/${workflow.id}`);
        if (response.report) {
          reportsMap[workflow.id] = response.report;
        }
      } catch (error) {
        // Report doesn't exist for this workflow, which is fine
        console.debug(`No report found for workflow ${workflow.id}`);
      }
    }
    
    setWorkflowReports(reportsMap);
  };

  const handleDownloadReport = async (workflowId: string) => {
    const report = workflowReports[workflowId];
    if (!report) return;

    setDownloading(prev => ({ ...prev, [workflowId]: true }));
    
    try {
      const response = await fetch(`/api/v1/reports/${report.id}/download`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${report.name}.md`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download report:", error);
      alert("Failed to download report. Please try again.");
    } finally {
      setDownloading(prev => ({ ...prev, [workflowId]: false }));
    }
  };

  const handleDeleteWorkflow = async (workflowId: string, workflowName: string) => {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${workflowName}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(prev => ({ ...prev, [workflowId]: true }));
    
    try {
      await api.delete(`/agent-workflows/${workflowId}`);
      
      // Remove from local state
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
      
      // Remove report from state if it exists
      setWorkflowReports(prev => {
        const newReports = { ...prev };
        delete newReports[workflowId];
        return newReports;
      });
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      alert("Failed to delete workflow. Please try again.");
    } finally {
      setDeleting(prev => ({ ...prev, [workflowId]: false }));
    }
  };

  const total = workflows.length;
  const completed = workflows.filter((w) => w.status === "completed").length;
  const failed = workflows.filter((w) => w.status === "failed").length;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string; icon: any }> = {
      completed: { className: "bg-green-500/10 text-green-600", label: "COMPLETED", icon: CheckCircle },
      failed: { className: "bg-red-500/10 text-red-600", label: "FAILED", icon: XCircle },
      running: { className: "bg-blue-500/10 text-blue-600", label: "RUNNING", icon: Activity },
      pending: { className: "bg-yellow-500/10 text-yellow-600", label: "PENDING", icon: Clock },
      cancelled: { className: "bg-gray-500/10 text-gray-600", label: "CANCELLED", icon: XCircle },
    };

    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge variant="secondary" className={`${variant.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {variant.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Completed Workflows
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Workflow Stats */}
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-gray-700">
            {total} {total === 1 ? "Workflow" : "Workflows"}
          </span>
          {total > 0 && (
            <>
              <span className="text-green-600">{completed} completed</span>
              {failed > 0 && <span className="text-red-600">{failed} failed</span>}
            </>
          )}
        </div>

        {/* Workflow List */}
        {total === 0 ? (
          <p className="text-sm text-gray-500">No workflows executed yet</p>
        ) : (
          <div className="space-y-2">
            {workflows.slice(0, 3).map((workflow) => (
              <div
                key={workflow.id}
                className="p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {workflow.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {new Date(workflow.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {/* Download button - only for completed workflows with reports */}
                      {workflow.status === "completed" && workflowReports[workflow.id] && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReport(workflow.id)}
                          disabled={downloading[workflow.id]}
                          className="h-7 px-2"
                          title="Download Report"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      )}
                      {getStatusBadge(workflow.status)}
                    </div>
                    {/* Delete button underneath status badge */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                      disabled={deleting[workflow.id]}
                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete Workflow"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Progress Info */}
                {workflow.status !== "completed" && workflow.progress > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{workflow.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${workflow.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {onViewDetails && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(workflow.id)}
                    className="w-full mt-2 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View Details
                  </Button>
                )}
              </div>
            ))}
            {total > 3 && (
              <p className="text-xs text-gray-500 italic">
                + {total - 3} more workflows
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
