import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export interface OperationsManagementStats {
  activeReporters: number;
  pendingQuestions: number;
  recentTasksCount: number;
  recentWorkflowsCount: number;
}

export interface OperationsManagementData {
  operation: any;
  stats: OperationsManagementStats;
  recentTasks: any[];
  recentWorkflows: any[];
  schedulerStatus: {
    running: boolean;
    nextRun: string | null;
    isProcessing: boolean;
  };
}

export function useOperationsManagement(operationId: string) {
  const [data, setData] = useState<OperationsManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/operations-management/dashboard/${operationId}`);
      setData(response);
    } catch (err: any) {
      console.error("Failed to fetch operations management data:", err);
      setError(
        err.response?.data?.error || err.message || "Failed to fetch operations management data"
      );
    } finally {
      setLoading(false);
    }
  };

  const enableHourlyReporting = async () => {
    try {
      await api.post(`/operations-management/enable/${operationId}`);
      await fetchData();
    } catch (err: any) {
      console.error("Failed to enable hourly reporting:", err);
      throw new Error(
        err.response?.data?.error || err.message || "Failed to enable hourly reporting"
      );
    }
  };

  const disableHourlyReporting = async () => {
    try {
      await api.post(`/operations-management/disable/${operationId}`);
      await fetchData();
    } catch (err: any) {
      console.error("Failed to disable hourly reporting:", err);
      throw new Error(
        err.response?.data?.error || err.message || "Failed to disable hourly reporting"
      );
    }
  };

  const triggerNow = async () => {
    try {
      const response = await api.post(`/operations-management/trigger-now/${operationId}`);
      await fetchData();
      return response.workflowId;
    } catch (err: any) {
      console.error("Failed to trigger workflow:", err);
      throw new Error(err.response?.data?.error || err.message || "Failed to trigger workflow");
    }
  };

  useEffect(() => {
    if (operationId) {
      fetchData();

      // Poll every 3 minutes
      const interval = setInterval(fetchData, 3 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [operationId]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    enableHourlyReporting,
    disableHourlyReporting,
    triggerNow,
  };
}
