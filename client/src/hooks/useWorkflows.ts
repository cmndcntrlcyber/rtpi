import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface WorkflowTask {
  id: string;
  workflowId: string;
  agentId: string;
  taskType: string;
  taskName: string;
  status: string;
  sequenceOrder: number;
  inputData: any;
  outputData: any;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  workflowType: string;
  targetId: string;
  operationId: string | null;
  currentAgentId: string | null;
  currentTaskId: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  metadata: any;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface WorkflowDetails {
  workflow: Workflow;
  tasks: WorkflowTask[];
  logs: any[];
}

export function useWorkflows(autoRefresh = true) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadWorkflows = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await api.get<{ workflows: Workflow[] }>("/agent-workflows", {
        signal: abortControllerRef.current.signal,
      });
      setWorkflows(response.workflows || []);
      setError(null);
    } catch (err) {
      // Ignore abort errors - these are expected when unmounting
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const getWorkflowDetails = async (id: string): Promise<WorkflowDetails | null> => {
    try {
      const response = await api.get<WorkflowDetails>(`/agent-workflows/${id}`);
      return response;
    } catch (err) {
      // Error handled by component
      return null;
    }
  };

  const cancelWorkflow = async (id: string) => {
    try {
      await api.post(`/agent-workflows/${id}/cancel`, {});
      await loadWorkflows();
    } catch (err) {
      // Error handled by component
      throw err;
    }
  };

  useEffect(() => {
    loadWorkflows();

    let interval: NodeJS.Timeout | undefined;
    if (autoRefresh) {
      interval = setInterval(loadWorkflows, 3000); // Refresh every 3 seconds
    }

    // Cleanup: clear interval and abort pending request
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoRefresh, loadWorkflows]);

  // Derived data
  const runningWorkflows = workflows.filter((w) => w.status === "running");
  const completedWorkflows = workflows.filter((w) => w.status === "completed");
  const failedWorkflows = workflows.filter((w) => w.status === "failed");
  const allNonRunning = workflows.filter((w) => w.status !== "running"); // For history view

  return {
    workflows,
    runningWorkflows,
    completedWorkflows,
    failedWorkflows,
    allNonRunning,
    loading,
    error,
    refetch: loadWorkflows,
    getWorkflowDetails,
    cancelWorkflow,
  };
}
