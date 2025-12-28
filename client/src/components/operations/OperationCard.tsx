import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Users, Target, AlertCircle, Clock, Edit, Trash2, Download, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

interface Operation {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;  // FIX BUG #2: Correct field name to match database
  endDate?: string;    // FIX BUG #2: Correct field name to match database
  createdBy: string;
  type?: string;
  targets?: number;
  findings?: number;
  latestWorkflow?: string;
  latestWorkflowId?: string;
  latestWorkflowStatus?: string;
  latestWorkflowDate?: string;
}

interface OperationCardProps {
  operation: Operation;
  onSelect?: (operation: Operation) => void;
  onEdit?: (operation: Operation) => void;
  onDelete?: (operation: Operation) => void;
  onWorkflowsChange?: () => void;
  onStatusChange?: (operationId: string, newStatus: string) => Promise<void>; // FIX BUG #2: Inline status change
  // Bulk selection props
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

const statusColors = {
  planning: "bg-blue-500/10 text-blue-400",
  active: "bg-green-500/10 text-green-400",
  paused: "bg-yellow-500/10 text-yellow-400",
  completed: "bg-secondary0/10 text-muted-foreground",
  failed: "bg-red-500/10 text-red-400"
};

export default function OperationCard({
  operation,
  onSelect,
  onEdit,
  onDelete,
  onWorkflowsChange,
  onStatusChange,
  selectable = false,
  selected = false,
  onSelectionChange
}: OperationCardProps) {
  const [workflowReport, setWorkflowReport] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // FIX BUG #2: Handle status changes with confirmation for destructive actions
  const handleStatusChange = async (newStatus: string) => {
    // Confirmation for destructive actions
    if (newStatus === "cancelled" || newStatus === "completed") {
      const action = newStatus === "cancelled" ? "cancel" : "complete";
      if (!confirm(`Are you sure you want to ${action} this operation?`)) {
        return;
      }
    }

    if (!onStatusChange) return;

    setUpdatingStatus(true);
    try {
      await onStatusChange(operation.id, newStatus);
      
      // Trigger refresh
      if (onWorkflowsChange) {
        onWorkflowsChange();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update operation status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Fetch report for latest workflow if it exists
  useState(() => {
    const loadWorkflowReport = async () => {
      if (operation.latestWorkflowId && operation.latestWorkflowStatus === "completed") {
        try {
          const response = await api.get<{ report: any }>(`/reports/workflow/${operation.latestWorkflowId}`);
          if (response.report) {
            setWorkflowReport(response.report);
          }
        } catch (error) {
          console.debug(`No report found for workflow ${operation.latestWorkflowId}`);
        }
      }
    };
    loadWorkflowReport();
  });

  const handleClick = () => {
    if (onSelect) {
      onSelect(operation);
    }
  };

  const handleDownloadReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workflowReport) return;

    setDownloading(true);
    
    try {
      const response = await fetch(`/api/v1/reports/${workflowReport.id}/download`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${workflowReport.name}.md`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

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
      setDownloading(false);
    }
  };

  const handleDeleteWorkflow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!operation.latestWorkflowId) return;

    if (!confirm(`Are you sure you want to delete "${operation.latestWorkflow}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    
    try {
      await api.delete(`/agent-workflows/${operation.latestWorkflowId}`);
      
      // Notify parent to refresh
      if (onWorkflowsChange) {
        onWorkflowsChange();
      }
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      alert("Failed to delete workflow. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getColorFromName = (name: string) => {
    const colors = ['bg-blue-600', 'bg-green-600', 'bg-red-600', 'bg-purple-600', 'bg-yellow-600', 'bg-indigo-600'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // FIX BUG #2: Safe date formatting with null/undefined handling
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "Not set";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid date";
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return "Invalid date";
    }
  };

  const handleSelectionChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectionChange) {
      onSelectionChange(operation.id, !selected);
    }
  };

  return (
    <Card
      className={`bg-card border-border shadow-sm hover:shadow-lg cursor-pointer transition-all duration-200 ${
        selected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {selectable && (
              <div onClick={handleSelectionChange}>
                <Checkbox checked={selected} />
              </div>
            )}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getColorFromName(operation.name)}`}>
              {getInitials(operation.name)}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{operation.name}</h3>
              <p className="text-sm text-muted-foreground flex items-center mt-0.5">
                <Users className="h-3 w-3 mr-1" />
                Created by {operation.createdBy}
              </p>
            </div>
          </div>
          {/* FIX BUG #2: Inline status dropdown or static badge */}
          {onStatusChange ? (
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={operation.status}
                onValueChange={handleStatusChange}
                disabled={updatingStatus}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Planning
                    </span>
                  </SelectItem>
                  <SelectItem value="active">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Active
                    </span>
                  </SelectItem>
                  <SelectItem value="paused">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      Paused
                    </span>
                  </SelectItem>
                  <SelectItem value="completed">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-secondary0" />
                      Completed
                    </span>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <span className="flex items-center gap-2 text-red-600">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Cancelled
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge 
              variant="secondary" 
              className={`${statusColors[operation.status as keyof typeof statusColors]} px-2 py-1 text-xs font-medium`}
            >
              {operation.status}
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
          <div className="flex items-center text-muted-foreground">
            <Calendar className="h-4 w-4 mr-2" />
            <span>{formatDate(operation.startDate)}</span>
          </div>
          <div className="flex items-center text-muted-foreground">
            {operation.endDate ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                <span>Ended {formatDate(operation.endDate)}</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                <span>In progress</span>
              </>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          {operation.type && (
            <Badge variant="outline" className="text-xs">
              {operation.type}
            </Badge>
          )}
          <div className="flex items-center text-xs text-muted-foreground">
            <Target className="h-3 w-3 mr-1" />
            <span>{operation.targets || 0} targets</span>
          </div>
          {operation.findings !== undefined && (
            <div className="flex items-center text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3 mr-1" />
              <span>{operation.findings} findings</span>
            </div>
          )}
        </div>

        {/* Latest Workflow if exists */}
        {operation.latestWorkflow && (
          <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-100">
            <p className="text-xs text-blue-600 font-medium mb-2">Latest Workflow</p>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-900 font-medium truncate">{operation.latestWorkflow}</p>
                {operation.latestWorkflowDate && (
                  <p className="text-xs text-blue-700/70 mt-1">
                    {new Date(operation.latestWorkflowDate).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {/* Download button - only if workflow has report */}
                  {operation.latestWorkflowStatus === "completed" && workflowReport && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadReport}
                      disabled={downloading}
                      className="h-7 px-2 bg-card"
                      title="Download Report"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  {/* Status badge */}
                  {operation.latestWorkflowStatus === "completed" && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      COMPLETED
                    </Badge>
                  )}
                </div>
                {/* Delete button underneath */}
                {operation.latestWorkflowId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteWorkflow}
                    disabled={deleting}
                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 bg-card"
                    title="Delete Workflow"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Description if exists */}
        {operation.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
            {operation.description}
          </p>
        )}

        {/* Action Buttons */}
        {(onEdit || onDelete) && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(operation);
                }}
                className="flex-1"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(operation);
                }}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
