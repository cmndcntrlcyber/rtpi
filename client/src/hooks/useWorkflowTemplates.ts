import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface WorkflowTemplateAgent {
  agentId: string;
  order: number;
}

export interface WorkflowTemplateConfig {
  agents: WorkflowTemplateAgent[];
  mcpServerIds: string[];
  maxParallelAgents?: number;
  timeoutMs?: number;
  retryConfig?: {
    maxRetries: number;
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  triggerEvent: string | null;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  configuration: WorkflowTemplateConfig;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useWorkflowTemplates() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ templates: WorkflowTemplate[] }>("/agents/workflow-templates");
      setTemplates(response.templates || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (data: {
    name: string;
    description?: string;
    agents: WorkflowTemplateAgent[];
    mcpServerIds?: string[];
    isActive?: boolean;
  }) => {
    const response = await api.post<{ template: WorkflowTemplate }>("/agents/workflow-templates", data);
    await loadTemplates();
    return response.template;
  }, [loadTemplates]);

  const updateTemplate = useCallback(async (id: string, data: Partial<{
    name: string;
    description: string;
    displayOrder: number;
    isActive: boolean;
    configuration: WorkflowTemplateConfig;
  }>) => {
    const response = await api.put<{ template: WorkflowTemplate }>(`/agents/workflow-templates/${id}`, data);
    await loadTemplates();
    return response.template;
  }, [loadTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    await api.delete(`/agents/workflow-templates/${id}`);
    await loadTemplates();
  }, [loadTemplates]);

  const reorderTemplates = useCallback(async (orderedIds: string[]) => {
    await api.put("/agents/workflow-templates/reorder", { orderedIds });
    await loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return {
    templates,
    loading,
    error,
    refetch: loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    reorderTemplates,
  };
}
