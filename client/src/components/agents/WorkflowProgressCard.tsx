import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  Loader2, 
  Circle, 
  XCircle,
  Eye,
  StopCircle
} from "lucide-react";
import type { Workflow, WorkflowTask } from "@/hooks/useWorkflows";

interface WorkflowProgressCardProps {
  workflow: Workflow;
  tasks: WorkflowTask[];
  agents: any[];
  onCancel: (id: string) => void;
  onViewDetails: (id: string) => void;
}

export default function WorkflowProgressCard({
  workflow,
  tasks,
  agents,
  onCancel,
  onViewDetails,
}: WorkflowProgressCardProps) {
  const [elapsedTime, setElapsedTime] = useState("");

  useEffect(() => {
    if (!workflow.startedAt) return;

    const updateElapsedTime = () => {
      const start = new Date(workflow.startedAt!);
      const now = new Date();
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      
      if (minutes > 0) {
        setElapsedTime(`${minutes}m ${seconds}s`);
      } else {
        setElapsedTime(`${seconds}s`);
      }
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);
    return () => clearInterval(interval);
  }, [workflow.startedAt]);

  const currentAgent = agents.find((a) => a.id === workflow.currentAgentId);
  const currentTask = tasks.find((t) => t.id === workflow.currentTaskId);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      pending: { className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", label: "PENDING" },
      running: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "RUNNING" },
      completed: { className: "bg-green-500/10 text-green-600 dark:text-green-400", label: "COMPLETED" },
      failed: { className: "bg-red-500/10 text-red-600 dark:text-red-400", label: "FAILED" },
      cancelled: { className: "bg-secondary0/10 text-muted-foreground", label: "CANCELLED" },
    };

    const variant = variants[status] || variants.pending;

    return (
      <Badge variant="secondary" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const getTaskIcon = (task: WorkflowTask) => {
    switch (task.status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTaskDuration = (task: WorkflowTask) => {
    if (!task.startedAt) return null;
    
    const start = new Date(task.startedAt);
    const end = task.completedAt ? new Date(task.completedAt) : new Date();
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <Card className="bg-card border-l-4 border-blue-600 dark:border-blue-400">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-foreground">{workflow.name}</h3>
          </div>
          {getStatusBadge(workflow.status)}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{workflow.progress}%</span>
          </div>
          <Progress value={workflow.progress} className="h-2" />
        </div>

        {/* Current Status */}
        {workflow.status === "running" && currentAgent && currentTask && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium text-foreground">Current Agent:</span>{" "}
                {currentAgent.name}
              </div>
              <div>
                <span className="font-medium text-foreground">Task:</span>{" "}
                {currentTask.taskName}
              </div>
              {elapsedTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Elapsed: {elapsedTime}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task Checklist */}
        <div className="mb-4 space-y-2">
          {tasks
            .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
            .map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                {getTaskIcon(task)}
                <span className={`flex-1 ${task.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {task.taskName}
                </span>
                {task.status === "in_progress" && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {getTaskDuration(task)}
                  </span>
                )}
                {task.status === "completed" && (
                  <span className="text-xs text-muted-foreground">
                    {getTaskDuration(task)}
                  </span>
                )}
                {task.status === "failed" && (
                  <span className="text-xs text-red-600 dark:text-red-400">failed</span>
                )}
              </div>
            ))}
        </div>

        {/* Metadata */}
        <div className="text-xs text-muted-foreground mb-3">
          {workflow.startedAt && (
            <div>Started: {new Date(workflow.startedAt).toLocaleString()}</div>
          )}
          {workflow.completedAt && (
            <div>Completed: {new Date(workflow.completedAt).toLocaleString()}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(workflow.id)}
            className="flex-1"
          >
            <Eye className="h-3 w-3 mr-1" />
            View Details
          </Button>
          {workflow.status === "running" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancel(workflow.id)}
              className="hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-600 dark:hover:border-red-400"
            >
              <StopCircle className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
