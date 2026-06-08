import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Server, Activity, Clock, Plus, RotateCcw, Pause, Target, CheckCircle, AlertTriangle, Zap, GripVertical, ArrowRight, X, Import, Workflow, ChevronDown, ChevronRight, Pencil, Trash2, Search, MoveRight, Ban, MessageSquare, RefreshCw, Loader2, Cpu } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAgents } from "@/hooks/useAgents";
import { useMCPServers } from "@/hooks/useMCPServers";
import { useTargets } from "@/hooks/useTargets";
import { useOperations } from "@/hooks/useOperations";
import { useTools } from "@/hooks/useTools";
import { useWorkflows, type WorkflowDetails } from "@/hooks/useWorkflows";
import { useWorkflowTemplates, type WorkflowTemplate } from "@/hooks/useWorkflowTemplates";
import { api } from "@/lib/api";
import WorkflowProgressCard from "@/components/agents/WorkflowProgressCard";
import WorkflowDetailsDialog from "@/components/agents/WorkflowDetailsDialog";
import ImportAgentDialog from "@/components/agents/ImportAgentDialog";
import { RestoreBackupsDialog } from "@/components/agents/RestoreBackupsDialog";
import WorkflowBuilder from "@/components/agents/WorkflowBuilder";
import WorkflowEditDialog from "@/components/agents/WorkflowEditDialog";
import { AgentsTablePanel } from "@/components/agents/AgentsTablePanel";
import { DefaultServersPanel } from "@/components/mcp/DefaultServersPanel";
import { DualListbox } from "@/components/ui/DualListbox";
import { useAgentChatManager } from "@/contexts/AgentChatContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable agent item for drag-drop with remove button
function SortableAgentItem({ agent, onRemove }: { agent: any; onRemove: (agentId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: agent.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center p-3 bg-secondary border border-border rounded-lg"
    >
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 mr-3 text-muted-foreground hover:text-muted-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      
      <div className="flex items-center flex-1">
        <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg mr-3">
          <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-foreground font-medium">{agent.name}</h4>
          <p className="text-sm text-muted-foreground capitalize">{agent.type} Agent</p>
        </div>
        {agent.config?.flowOrder >= 0 && (
          <div className="text-sm text-muted-foreground mr-3">
            Order: {agent.config.flowOrder}
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(agent.id)}
          className="hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Sortable tool item for drag-drop
function SortableToolItem({ id, tool, index }: { id: string; tool: any; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center p-2 bg-secondary border border-border rounded-lg"
    >
      <div className="flex items-center justify-center w-6 h-6 bg-indigo-100 rounded-full text-indigo-600 text-xs font-medium mr-2">
        {index + 1}
      </div>
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 mr-2 text-muted-foreground hover:text-muted-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <span className="text-sm font-medium text-foreground">{tool.name}</span>
        <span className="text-xs text-muted-foreground ml-2">
          ({tool.category.replace(/_/g, " ")})
        </span>
      </div>
    </div>
  );
}

// Sortable workflow template item for drag-drop
function SortableWorkflowItem({
  template,
  index,
  onRemove,
  onSelect,
  onExecute,
  onEdit,
  isSelected,
  agentCount,
  targetSelected,
}: {
  template: WorkflowTemplate;
  index: number;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onExecute: (id: string) => void;
  onEdit: (id: string) => void;
  isSelected: boolean;
  agentCount: number;
  targetSelected: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: template.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-center p-3 bg-secondary border rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-blue-300'
      }`}
      onClick={() => onSelect(template.id)}
    >
      <div className="flex items-center justify-center w-8 h-8 bg-indigo-100 rounded-full text-indigo-600 text-sm font-medium mr-3">
        {index + 1}
      </div>
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 mr-3 text-muted-foreground hover:text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex items-center flex-1">
        <div className="bg-indigo-100 p-2 rounded-lg mr-3">
          <Workflow className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-foreground font-medium">{template.name}</h4>
          <p className="text-sm text-muted-foreground">
            {agentCount} agent{agentCount !== 1 ? 's' : ''} • {template.isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onExecute(template.id);
            }}
            disabled={!targetSelected}
            className="hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400"
            title={targetSelected ? "Execute this workflow" : "Select a target first"}
          >
            <Zap className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(template.id);
            }}
            className="hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 dark:hover:text-blue-400"
            title="Edit workflow agents"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(template.id);
            }}
            className="hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
            title="Delete workflow"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Agents() {
  const { agents, loading: agentsLoading, refetch: refetchAgents } = useAgents();
  const { servers: mcpServers, loading: serversLoading, refetch: refetchServers } = useMCPServers();
  const { tools } = useTools();
  const { runningWorkflows, allNonRunning, getWorkflowDetails, cancelWorkflow } = useWorkflows();
  const { templates: workflowTemplates, reorderTemplates, deleteTemplate, updateTemplate, refetch: refetchTemplates } = useWorkflowTemplates();
  const { openAgentChat } = useAgentChatManager();
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [editServerDialogOpen, setEditServerDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<any>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [backupsDialogOpen, setBackupsDialogOpen] = useState(false);
  const [workflowBuilderOpen, setWorkflowBuilderOpen] = useState(false);
  const [workflowEditOpen, setWorkflowEditOpen] = useState(false);
  const [editingWorkflowTemplate, setEditingWorkflowTemplate] = useState<WorkflowTemplate | null>(null);
  const [addReporters, setAddReporters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    running: true,
    completed: false,
    failed: false,
    workflowOrder: true,
    workflows: true,
    agentsTabs: true,
  });
  const [workflowDetailsOpen, setWorkflowDetailsOpen] = useState(false);
  const [selectedWorkflowDetails, setSelectedWorkflowDetails] = useState<WorkflowDetails | null>(null);
  const [workflowTasksMap, setWorkflowTasksMap] = useState<Record<string, any[]>>({});
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [newAgent, setNewAgent] = useState({
    name: "",
    type: "openai" as any,
    config: {
      model: "gpt-5.2-chat-latest",
      systemPrompt: "",
      loopEnabled: false,
      loopPartnerId: "",
      maxLoopIterations: 5,
      loopExitCondition: "functional_poc",
      flowOrder: 0,
      enabledTools: [] as string[],
      enabledSkills: [] as string[],
      // v2.9.3 — `mcpServerIds` is the multi-select source of truth; the
      // legacy `mcpServerId` is the first entry, kept in sync on every save
      // so single-server consumers (current dispatch fallback) keep working.
      mcpServerIds: [] as string[],
      mcpServerId: "" as string,
    },
    capabilities: [],
  });
  const [activeLoops, setActiveLoops] = useState<any[]>([]);
  const { targets } = useTargets();
  const { operations } = useOperations();
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [selectedWorkflowTemplateId, setSelectedWorkflowTemplateId] = useState<string>("");
  const [newServer, setNewServer] = useState({
    name: "",
    command: "",
    args: [],
    autoRestart: true,
  });
  const [agentMcpSearch, setAgentMcpSearch] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [tactics, setTactics] = useState<{ id: string; attackId: string; name: string; shortName: string }[]>([]);

  // Live Ollama models — same source the Settings / Ollama AI pages use.
  // Populated on demand when the Edit AI Agent dialog opens, so the Model
  // dropdown can list whatever's loaded on the configured Ollama host.
  const [ollamaModels, setOllamaModels] = useState<{ name: string; size?: number }[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [ollamaModelsError, setOllamaModelsError] = useState<string | null>(null);

  // Skills catalog — tool SKILL.md files plus bug-hunter knowledge_base
  // entries, served by /api/v1/skills/available. Loaded when the Edit AI
  // Agent dialog opens so the dual listbox has its pool of items.
  type CatalogSkill = {
    id: string;
    kind: "tool" | "bug_hunter";
    displayName: string;
    summary: string;
    source: string;
    tags: string[];
  };
  const [catalogSkills, setCatalogSkills] = useState<CatalogSkill[]>([]);
  const [catalogSkillsLoading, setCatalogSkillsLoading] = useState(false);
  const [catalogSkillsError, setCatalogSkillsError] = useState<string | null>(null);

  const loadCatalogSkills = useCallback(async () => {
    try {
      setCatalogSkillsLoading(true);
      setCatalogSkillsError(null);
      const res = await fetch("/api/v1/skills/available?grouped=true", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCatalogSkills([]);
        setCatalogSkillsError(data.error || data.details || `HTTP ${res.status}`);
        return;
      }
      setCatalogSkills(Array.isArray(data.skills) ? data.skills : []);
    } catch (err) {
      setCatalogSkills([]);
      setCatalogSkillsError(err instanceof Error ? err.message : "load failed");
    } finally {
      setCatalogSkillsLoading(false);
    }
  }, []);

  const loadOllamaModels = useCallback(async () => {
    try {
      setOllamaModelsLoading(true);
      setOllamaModelsError(null);
      const res = await fetch("/api/v1/ollama/models/live", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOllamaModels([]);
        setOllamaModelsError(data.details || data.error || `HTTP ${res.status}`);
        return;
      }
      setOllamaModels(Array.isArray(data.models) ? data.models : []);
    } catch (e: any) {
      setOllamaModels([]);
      setOllamaModelsError(e?.message || "Network error");
    } finally {
      setOllamaModelsLoading(false);
    }
  }, []);

  // Load ATT&CK tactics for agent-tactic assignment dropdowns
  useEffect(() => {
    api.get<{ tactics: any[] }>("/attack/tactics").then(res => {
      setTactics(res.tactics || []);
    }).catch(() => {});
  }, []);

  const handleAssignTactic = async (agentId: string, tacticId: string) => {
    try {
      await api.put(`/agents/${agentId}/tactic`, { tacticId });
      toast.success("Agent assigned to tactic");
      refetchAgents();
    } catch {
      toast.error("Failed to assign tactic");
    }
  };

  const handleRemoveTactic = async (agentId: string) => {
    try {
      await api.delete(`/agents/${agentId}/tactic`);
      toast.success("Agent removed from tactic");
      refetchAgents();
    } catch {
      toast.error("Failed to remove tactic");
    }
  };

  // Load active loops
  useEffect(() => {
    loadActiveLoops();
    const interval = setInterval(loadActiveLoops, 3000); // Refresh every 3s
    return () => clearInterval(interval);
  }, []);

  const loadActiveLoops = async () => {
    try {
      const response = await api.get<{ loops: any[] }>("/agent-loops");
      setActiveLoops(response.loops || []);
    } catch (err) {
      // Silently handle loop loading errors
    }
  };

  const handleEditAgent = (agent: any) => {
    setEditingAgent(agent);
    const config = agent.config || {};
    // v2.9.3 — hydrate multi-select state. Prefer the new `mcpServerIds`
    // array; fall back to the legacy `mcpServerId` as a single-element array;
    // empty when neither is set.
    const incomingMcpIds: string[] = Array.isArray(config.mcpServerIds)
      ? config.mcpServerIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : config.mcpServerId
      ? [config.mcpServerId]
      : [];
    setNewAgent({
      name: agent.name,
      type: agent.type,
      config: {
        model: config.model || (
          agent.type === "openai" ? "gpt-5.2-chat-latest" :
          agent.type === "anthropic" ? "claude-sonnet-4-5" :
          ""
        ),
        systemPrompt: config.systemPrompt || "",
        loopEnabled: config.loopEnabled || false,
        loopPartnerId: config.loopPartnerId || "",
        maxLoopIterations: config.maxLoopIterations || 5,
        loopExitCondition: config.loopExitCondition || "functional_poc",
        flowOrder: config.flowOrder || 0,
        enabledTools: config.enabledTools || [],
        enabledSkills: config.enabledSkills || [],
        mcpServerIds: incomingMcpIds,
        mcpServerId: incomingMcpIds[0] ?? "",
      },
      capabilities: agent.capabilities || [],
    });
    setAgentDialogOpen(true);
  };

  const handleCreateAgent = async () => {
    try {
      const method = editingAgent ? "PUT" : "POST";
      const url = editingAgent ? `/api/v1/agents/${editingAgent.id}` : "/api/v1/agents";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newAgent),
      });

      if (!response.ok) throw new Error(`Failed to ${editingAgent ? 'update' : 'create'} agent`);

      await refetchAgents();
      setAgentDialogOpen(false);
      setEditingAgent(null);
      setNewAgent({
        name: "",
        type: "openai",
        config: {
          model: "gpt-5.2-chat-latest",
          systemPrompt: "",
          loopEnabled: false,
          loopPartnerId: "",
          maxLoopIterations: 5,
          loopExitCondition: "functional_poc",
          flowOrder: 0,
          enabledTools: [],
          enabledSkills: [],
          mcpServerIds: [],
          mcpServerId: "",
        },
        capabilities: []
      });
    } catch (err) {
      toast.error(`Failed to save agent: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      const response = await fetch(`/api/v1/agents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to delete agent");

      await refetchAgents();
    } catch (err) {
      toast.error(`Failed to delete agent: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && agents) {
      const sortedAgents = [...agents].sort((a, b) => {
        const aOrder = (a.config as any)?.flowOrder || 0;
        const bOrder = (b.config as any)?.flowOrder || 0;
        return aOrder - bOrder;
      });
      
      const oldIndex = sortedAgents.findIndex((agent) => agent.id === active.id);
      const newIndex = sortedAgents.findIndex((agent) => agent.id === over.id);

      const newAgents = arrayMove(sortedAgents, oldIndex, newIndex);
      
      // Update flow order for all agents
      newAgents.forEach(async (agent, index) => {
        const currentOrder = (agent.config as any)?.flowOrder || 0;
        if (currentOrder !== index) {
          try {
            await fetch(`/api/v1/agents/${agent.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                config: { ...(agent.config as any), flowOrder: index }
              }),
            });
          } catch (err) {
            
          }
        }
      });
      
      // Refresh after updates
      setTimeout(() => refetchAgents(), 500);
    }
  };

  // Handle drag end for workflow templates
  const handleWorkflowDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && workflowTemplates) {
      const oldIndex = workflowTemplates.findIndex((t) => t.id === active.id);
      const newIndex = workflowTemplates.findIndex((t) => t.id === over.id);

      const newOrder = arrayMove(workflowTemplates, oldIndex, newIndex);

      try {
        await reorderTemplates(newOrder.map((t) => t.id));
        toast.success("Workflow order updated");
      } catch (err) {
        toast.error("Failed to update workflow order");
      }
    }
  };

  // Execute selected workflow template (or a specific one by ID)
  const handleExecuteWorkflowTemplate = async (templateId?: string) => {
    if (!selectedTargetId) {
      toast.warning("Please select a target first");
      return;
    }

    const execId = templateId || selectedWorkflowTemplateId;
    if (!execId) {
      toast.warning("Please select a workflow template to execute");
      return;
    }

    const template = workflowTemplates.find((t) => t.id === execId);
    if (!template) return;

    try {
      const response = await api.post("/agent-workflows/start", {
        targetId: selectedTargetId,
        workflowType: "penetration_test",
        templateId: execId,
        metadata: addReporters ? { includeReporters: true } : undefined,
      });

      toast.success(`Workflow "${template.name}" started! Workflow ID: ${response.workflow.id}`);
      if (!templateId) setSelectedWorkflowTemplateId("");
    } catch (err) {
      toast.error(`Failed to start workflow: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Open edit dialog for a workflow template
  const handleEditWorkflowTemplate = (templateId: string) => {
    const template = workflowTemplates.find((t) => t.id === templateId);
    if (template) {
      setEditingWorkflowTemplate(template);
      setWorkflowEditOpen(true);
    }
  };

  // Save edited workflow template configuration
  const handleSaveWorkflowTemplate = async (templateId: string, configuration: any) => {
    try {
      await updateTemplate(templateId, { configuration });
      toast.success("Workflow template updated");
      setWorkflowEditOpen(false);
      setEditingWorkflowTemplate(null);
    } catch (err) {
      toast.error(`Failed to update workflow: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Delete workflow template
  const handleDeleteWorkflowTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this workflow template?")) return;

    try {
      await deleteTemplate(templateId);
      if (selectedWorkflowTemplateId === templateId) {
        setSelectedWorkflowTemplateId("");
      }
      toast.success("Workflow template deleted");
    } catch (err) {
      toast.error("Failed to delete workflow template");
    }
  };

  const handleStartLoop = async (agentId: string) => {
    const targetId = targets[0]?.id; // Use first target for demo
    if (!targetId) {
      toast.warning("No targets available. Please create a target first.");
      return;
    }

    try {
      await api.post("/agent-loops/start", {
        agentId,
        targetId,
        initialInput: "Begin vulnerability analysis and exploit development",
      });
      await loadActiveLoops();
      toast.success("Agent loop started successfully!");
    } catch (err) {
      toast.error(`Failed to start loop: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  const handleStopLoop = async (loopId: string) => {
    try {
      await api.post(`/agent-loops/${loopId}/stop`, {});
      await loadActiveLoops();
    } catch (err) {
      toast.error(`Failed to stop loop: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  const handleCreateServer = async () => {
    try {
      const response = await fetch("/api/v1/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newServer),
      });

      if (!response.ok) throw new Error("Failed to create MCP server");

      await refetchServers();
      setServerDialogOpen(false);
      setNewServer({ name: "", command: "", args: [], autoRestart: true });
    } catch (err) {
      toast.error(`Failed to create MCP server: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  const handleStartServer = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/mcp-servers/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to start server");

      await refetchServers();
      toast.success("MCP server started successfully!");
    } catch (err) {
      toast.error(`Failed to start MCP server: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  const handleStartAllServers = async (ids: string[]) => {
    if (ids.length === 0) return;
    let started = 0;
    let failed = 0;
    // Parallel POSTs — the manager queues spawns internally so this won't
    // overwhelm the host. Per-row errors are captured into the failed
    // counter; the row's lastError column gets the structured preflight
    // message (e.g. command_missing, path_unwritable, disabled_by_default)
    // for the operator to inspect afterward.
    await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(`/api/v1/mcp-servers/${id}/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (response.ok) started += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }),
    );
    await refetchServers();
    if (failed === 0) {
      toast.success(`Started ${started} MCP server${started === 1 ? "" : "s"}`);
    } else if (started === 0) {
      toast.error(`Failed to start ${failed} server${failed === 1 ? "" : "s"} — check rows for last_error details`);
    } else {
      toast.warning(`Started ${started}, failed ${failed} — check rows for last_error details`);
    }
  };

  const handleStopServer = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/mcp-servers/${id}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to stop server");

      await refetchServers();
      toast.success("MCP server stopped successfully!");
    } catch (err) {
      toast.error(`Failed to stop MCP server: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  const handleEditServer = (server: any) => {
    setEditingServer(server);
    setNewServer({
      name: server.name,
      command: server.command,
      args: server.args || [],
      autoRestart: server.autoRestart ?? true,
    });
    setEditServerDialogOpen(true);
  };

  const handleUpdateServer = async () => {
    if (!editingServer) return;
    try {
      const response = await fetch(`/api/v1/mcp-servers/${editingServer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newServer),
      });
      if (!response.ok) throw new Error("Failed to update MCP server");
      await refetchServers();
      setEditServerDialogOpen(false);
      setEditingServer(null);
      setNewServer({ name: "", command: "", args: [], autoRestart: true });
      toast.success("MCP server updated successfully!");
    } catch (err) {
      toast.error(`Failed to update MCP server: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleDeleteServer = async (id: string, force = false) => {
    if (!force && !confirm("Are you sure you want to delete this MCP server?")) return;
    try {
      // ?force=true is required by the backend when the row is a managed
      // catalog default (seedKey non-null) — see server/api/v1/mcp-servers.ts
      // delete handler. The DefaultServersPanel passes force=true after its
      // own confirmation step, so we don't double-prompt here.
      const url = force ? `/api/v1/mcp-servers/${id}?force=true` : `/api/v1/mcp-servers/${id}`;
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete MCP server");
      await refetchServers();
      toast.success("MCP server deleted successfully!");
    } catch (err) {
      toast.error(`Failed to delete MCP server: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Remove agent from flow (set flowOrder to -1)
  const handleRemoveFromFlow = async (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    try {
      await fetch(`/api/v1/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          config: { ...(agent.config as any), flowOrder: -1, activeInFlow: false }
        }),
      });

      await refetchAgents();
    } catch (err) {
      toast.error(`Failed to remove agent from flow: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  // Add agent to flow
  const handleAddToFlow = async (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    // Find highest flowOrder and add 1
    const activeAgents = agents.filter((a) => {
      const order = (a.config as any)?.flowOrder;
      return order !== undefined && order >= 0;
    });
    const maxOrder = activeAgents.length > 0
      ? Math.max(...activeAgents.map((a) => (a.config as any)?.flowOrder || 0))
      : -1;

    try {
      await fetch(`/api/v1/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          config: { ...(agent.config as any), flowOrder: maxOrder + 1, activeInFlow: true }
        }),
      });

      await refetchAgents();
    } catch (err) {
      toast.error(`Failed to add agent to flow: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  // Execute workflow with selected target
  const handleExecuteWorkflow = async () => {
    if (!selectedTargetId) {
      toast.warning("Please select a target first");
      return;
    }

    try {
      const response = await api.post("/agent-workflows/start", {
        targetId: selectedTargetId,
        workflowType: "penetration_test"
      });

      toast.success(`Workflow started successfully! Workflow ID: ${response.workflow.id}`);
      
    } catch (err) {
      toast.error(`Failed to start workflow: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Error already shown via toast
    }
  };

  // View workflow details
  const handleViewWorkflowDetails = async (workflowId: string) => {
    try {
      const details = await getWorkflowDetails(workflowId);
      if (details) {
        setSelectedWorkflowDetails(details);
        setWorkflowDetailsOpen(true);
      }
    } catch (err) {
      // Silently handle workflow details loading errors
      toast.error("Failed to load workflow details");
    }
  };

  // Cancel workflow
  const handleCancelWorkflow = async (workflowId: string) => {
    if (!confirm("Are you sure you want to cancel this workflow?")) return;

    try {
      await cancelWorkflow(workflowId);
      toast.success("Workflow cancelled successfully");
    } catch (err) {
      // Error handled via toast
      toast.error("Failed to cancel workflow");
    }
  };

  // Load tasks for running workflows with controlled polling
  useEffect(() => {
    const loadTasksForWorkflows = async () => {
      // Only poll for actively running workflows (not completed/failed/cancelled)
      const activeWorkflows = runningWorkflows.filter(
        w => w.status === 'running' || w.status === 'pending'
      );

      if (activeWorkflows.length === 0) {
        return;
      }

      const tasksMap: Record<string, any[]> = {};
      
      for (const workflow of activeWorkflows) {
        try {
          const response = await api.get(`/agent-workflows/${workflow.id}/tasks`);
          tasksMap[workflow.id] = response.tasks || [];
        } catch (err) {
          // Error handled via toast
        }
      }
      
      setWorkflowTasksMap(prevMap => ({ ...prevMap, ...tasksMap }));
    };

    // Initial load
    if (runningWorkflows.length > 0) {
      loadTasksForWorkflows();
    }

    // Set up polling interval (every 5 seconds)
    const pollInterval = setInterval(() => {
      if (runningWorkflows.some(w => w.status === 'running' || w.status === 'pending')) {
        loadTasksForWorkflows();
      }
    }, 5000);

    // Cleanup interval on unmount or when dependencies change
    return () => clearInterval(pollInterval);
  }, [runningWorkflows.length]); // Only re-run when count changes, not array reference

  const stats = {
    aiAgents: agents.length,
    active: agents.filter((a) => a.status === "running").length,
    mcpServers: mcpServers.length,
    connected: mcpServers.filter((s) => s.status === "running").length,
  };

  const statCards = [
    { label: "AI Agents", value: stats.aiAgents, color: "text-foreground" },
    { label: "Active Agents", value: stats.active, color: "text-success" },
    { label: "MCP Servers", value: stats.mcpServers, color: "text-foreground" },
    { label: "Connected", value: stats.connected, color: "text-info" },
  ];

  return (
    <div className="p-8">
      <PageHeader
        icon={Cpu}
        title="AI Agents & MCP Servers"
        description="Manage AI agents, MCP server connections, and multi-agent workflows."
      />

      {/* Stats Cards + Agent Workflows tile */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-card p-6 rounded-lg shadow-sm border border-border"
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{card.label}</h3>
            {agentsLoading || serversLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className={`text-3xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            )}
          </div>
        ))}

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
              <Workflow aria-hidden="true" className="h-4 w-4 text-info" />
              Agent Workflows
            </h3>
            <p className="text-xs text-muted-foreground">Orchestrate multi-agent workflows</p>
          </div>
          <Button size="sm" className="mt-3 w-full" onClick={() => setWorkflowBuilderOpen(true)}>
            <Plus aria-hidden="true" className="h-3 w-3 mr-1" />
            Create Workflow
          </Button>
        </div>
      </div>

      {/* Workflow Order + combined Workflows (Active + History) — share row 1.
          The AI Agents / MCP Servers panel sits alone in row 2 below. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className={`bg-card ${expandedGroups.workflowOrder !== expandedGroups.workflows ? "lg:col-span-2" : ""}`}>
          <CardHeader
            className="cursor-pointer hover:bg-secondary/50 rounded-t-lg transition-colors"
            onClick={() => setExpandedGroups(prev => ({ ...prev, workflowOrder: !prev.workflowOrder }))}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {expandedGroups.workflowOrder ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Workflow className="h-5 w-5 text-indigo-600" />
                Workflow Order
                <Badge variant="secondary" className="ml-2">
                  {workflowTemplates.length}
                </Badge>
              </CardTitle>

              {/* Target Selector, Reporters & Execute Button — only when expanded */}
              {expandedGroups.workflowOrder && (
                <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select target..." />
                      </SelectTrigger>
                      <SelectContent>
                        {targets.map((target) => (
                          <SelectItem key={target.id} value={target.id}>
                            {target.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => setAddReporters(!addReporters)}
                  >
                    <Checkbox
                      checked={addReporters}
                      onCheckedChange={(checked) => setAddReporters(!!checked)}
                    />
                    <span className="text-sm text-muted-foreground">Add Reporters</span>
                  </div>
                  <Button
                    onClick={() => handleExecuteWorkflowTemplate()}
                    disabled={!selectedTargetId || !selectedWorkflowTemplateId}
                    className="w-48 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Execute
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          {expandedGroups.workflowOrder && <CardContent>
            {workflowTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Workflow className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No workflow templates yet.</p>
                <p className="text-xs mt-1">
                  Create a workflow using the &quot;Create Workflow&quot; button above.
                </p>
              </div>
            ) : (
              <>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleWorkflowDragEnd}
                >
                  <SortableContext
                    items={workflowTemplates.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {workflowTemplates.map((template, index) => (
                        <SortableWorkflowItem
                          key={template.id}
                          template={template}
                          index={index}
                          onRemove={handleDeleteWorkflowTemplate}
                          onSelect={setSelectedWorkflowTemplateId}
                          onExecute={handleExecuteWorkflowTemplate}
                          onEdit={handleEditWorkflowTemplate}
                          isSelected={selectedWorkflowTemplateId === template.id}
                          agentCount={template.configuration?.agents?.length || 0}
                          targetSelected={!!selectedTargetId}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* How it Works Section */}
                {workflowTemplates.length > 0 && (
                  <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h4 className="text-sm font-medium text-foreground mb-2">How Workflow Order Works</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Workflows are listed in priority order (top = highest priority)</li>
                      <li>• Each workflow contains its own agent sequence (managed in Workflow Builder)</li>
                      <li>• Drag workflows up or down to change their priority</li>
                      <li>• Click a workflow to select it, then click Execute to run against a target</li>
                      <li>• Click X to delete a workflow template</li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>}
        </Card>

        {/* Combined Workflows — Active + History as tabs in one card.
            Replaces the previous side-by-side Active Workflows + Workflow
            History panels so operators see both states in one place.
            Toggle behavior matches Workflow Order: when one of the two cards
            is collapsed and the other expanded, the expanded card spans
            both columns so the row reclaims the freed space. */}
        <Card className={`bg-card ${expandedGroups.workflowOrder !== expandedGroups.workflows ? "lg:col-span-2" : ""}`}>
          <CardHeader
            className="cursor-pointer hover:bg-secondary/50 rounded-t-lg transition-colors pb-3"
            onClick={() => setExpandedGroups(prev => ({ ...prev, workflows: !prev.workflows }))}
          >
            <CardTitle className="flex items-center gap-2">
              {expandedGroups.workflows ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Activity className="h-5 w-5 text-blue-600" />
              Workflows
              <Badge variant="secondary" className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                {runningWorkflows.length} active
              </Badge>
              <Badge variant="secondary" className="ml-1">
                {allNonRunning.length} history
              </Badge>
            </CardTitle>
          </CardHeader>
          {expandedGroups.workflows && <CardContent>
            <Tabs defaultValue="active" className="w-full">
              <TabsList>
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Active
                  <Badge variant="secondary" className="ml-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                    {runningWorkflows.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  History
                  <Badge variant="secondary" className="ml-1">
                    {allNonRunning.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4 mt-4">
                {runningWorkflows.length > 0 ? (
                  <div className="space-y-4">
                    {runningWorkflows.map((workflow) => (
                      <WorkflowProgressCard
                        key={workflow.id}
                        workflow={workflow}
                        tasks={workflowTasksMap[workflow.id] || []}
                        agents={agents}
                        onCancel={handleCancelWorkflow}
                        onViewDetails={handleViewWorkflowDetails}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No active workflows</p>
                    <p className="text-xs mt-1">Execute a workflow to see progress here.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-3 mt-4">
                {allNonRunning.length > 0 ? (
                  <div className="space-y-3">
                    {allNonRunning.slice(0, 10).map((workflow) => (
                      <div
                        key={workflow.id}
                        className="p-3 bg-secondary rounded border border-border hover:bg-secondary/80 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-foreground">
                              {workflow.name}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {workflow.completedAt
                                ? new Date(workflow.completedAt).toLocaleString()
                                : new Date(workflow.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`${
                              workflow.status === "completed"
                                ? "bg-green-500/10 text-green-600"
                                : workflow.status === "failed"
                                ? "bg-red-500/10 text-red-600"
                                : "bg-secondary/10 text-muted-foreground"
                            }`}
                          >
                            {workflow.status.toUpperCase()}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewWorkflowDetails(workflow.id)}
                          className="w-full text-xs"
                        >
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No workflow history</p>
                    <p className="text-xs mt-1">Completed workflows will appear here.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>}
        </Card>
      </div>

      {/* AI Agents / MCP Servers — full-width row 2 */}
      <Card className="bg-card">
          <CardHeader
            className="cursor-pointer hover:bg-secondary/50 rounded-t-lg transition-colors"
            onClick={() => setExpandedGroups(prev => ({ ...prev, agentsTabs: !prev.agentsTabs }))}
          >
            <CardTitle className="flex items-center gap-2">
              {expandedGroups.agentsTabs ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Bot className="h-5 w-5 text-blue-600" />
              AI Agents & MCP Servers
              <Badge variant="secondary" className="ml-2">
                {agents.length + mcpServers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          {expandedGroups.agentsTabs && <CardContent>
        <Tabs defaultValue="ai" className="space-y-4">
          <div className="flex items-center gap-3">
            <TabsList>
              <TabsTrigger value="ai">AI Agents</TabsTrigger>
              <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
            </TabsList>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter agents & servers..."
                value={agentMcpSearch}
                onChange={(e) => setAgentMcpSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          <TabsContent value="ai" className="space-y-4">
            <AgentsTablePanel
              agents={agents}
              tactics={tactics}
              tools={tools}
              searchQuery={agentMcpSearch}
              onNewAgent={() => setAgentDialogOpen(true)}
              onImportAgent={() => setImportDialogOpen(true)}
              onRestoreBackups={() => setBackupsDialogOpen(true)}
              onChatAgent={(agent) => openAgentChat(agent.id, agent.name, agent.config?.role || agent.type)}
              onEditAgent={handleEditAgent}
              onDeleteAgent={handleDeleteAgent}
              onAssignTactic={handleAssignTactic}
              onRemoveTactic={handleRemoveTactic}
              onStartLoop={handleStartLoop}
            />

            {!agentsLoading && agents.length > 0 && (
              <>

                {/* Active Loops Section */}
                {activeLoops.length > 0 && (
                  <Card className="mt-6 bg-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-blue-600" />
                        Active Agent Loops
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {activeLoops.map((loop) => {
                          const agent = agents.find((a) => a.id === loop.agentId);
                          const partner = agents.find((a) => a.id === loop.partnerId);

                          return (
                            <div key={loop.id} className="p-4 bg-secondary rounded-lg border border-border">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <Target className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-foreground">
                                    {agent?.name} ↔ {partner?.name}
                                  </span>
                                  <Badge
                                    className={`${
                                      loop.status === "running"
                                        ? "bg-blue-600"
                                        : loop.status === "completed"
                                        ? "bg-green-600"
                                        : "bg-gray-600"
                                    } text-white`}
                                  >
                                    {loop.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {loop.currentIteration}/{loop.maxIterations} iterations
                                  </span>
                                  {loop.status === "running" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStopLoop(loop.id)}
                                    >
                                      <Pause className="h-3 w-3 mr-1" />
                                      Stop
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div className="text-xs text-muted-foreground space-y-1 mb-3">
                                <div>Exit Condition: {loop.exitCondition}</div>
                                <div>Started: {new Date(loop.startedAt).toLocaleString()}</div>
                                {loop.completedAt && (
                                  <div>Completed: {new Date(loop.completedAt).toLocaleString()}</div>
                                )}
                              </div>

                              {/* Latest Iteration */}
                              {loop.iterations && loop.iterations.length > 0 && (
                                <div className="p-3 bg-card rounded border border-border">
                                  <h5 className="text-xs font-semibold text-foreground mb-2">
                                    Latest Iteration
                                  </h5>
                                  <div className="text-xs text-muted-foreground">
                                    <div className="mb-1">
                                      <span className="text-foreground">Agent:</span>{" "}
                                      {agents.find((a) => a.id === loop.iterations[loop.iterations.length - 1].agentId)?.name}
                                    </div>
                                    <div className="mb-1">
                                      <span className="text-foreground">Output:</span>{" "}
                                      {loop.iterations[loop.iterations.length - 1].output.substring(0, 100)}...
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-foreground">Success:</span>
                                      {loop.iterations[loop.iterations.length - 1].success ? (
                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <AlertTriangle className="h-3 w-3 text-red-600" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="mcp" className="space-y-4">
          <DefaultServersPanel
            onChange={refetchServers}
            onEditServer={(serverId) => {
              const s = mcpServers.find((s) => s.id === serverId);
              if (s) handleEditServer(s);
            }}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
            onDeleteServer={handleDeleteServer}
            onAddServer={() => setServerDialogOpen(true)}
            onStartAll={handleStartAllServers}
            userServers={mcpServers.filter((s) => !s.seedKey)}
            searchQuery={agentMcpSearch}
          />
        </TabsContent>
      </Tabs>
          </CardContent>}
        </Card>


      {/* Import/Edit Agent Dialog */}
      <Dialog open={agentDialogOpen} onOpenChange={(open) => {
        setAgentDialogOpen(open);
        if (open) {
          // Pre-fetch live Ollama models so the Model dropdown is ready
          // if the operator switches Agent Type to Ollama.
          loadOllamaModels();
          // Pre-fetch the unified skills catalog (tool skills + bug-hunter
          // knowledge_base) so the Skills Enabled dual listbox is populated
          // when the operator scrolls down to it.
          loadCatalogSkills();
        } else {
          setEditingAgent(null);
          setToolSearch("");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "Edit AI Agent" : "Import AI Agent"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="GPT-4 Analysis Agent"
              />
            </div>
            
            <div>
              <Label htmlFor="agent-type">Agent Type</Label>
              <Select
                value={newAgent.type}
                onValueChange={(value: any) => {
                  // Set default model based on type. Ollama defaults to the
                  // first live model if any are loaded; otherwise empty so
                  // the dropdown forces an explicit selection.
                  const defaultModel =
                    value === "openai" ? "gpt-5.2-chat-latest" :
                    value === "anthropic" ? "claude-sonnet-4-5" :
                    value === "ollama" ? (ollamaModels[0]?.name ?? "") :
                    "";
                  setNewAgent({
                    ...newAgent,
                    type: value,
                    config: { ...newAgent.config, model: defaultModel }
                  });
                  if (value === "ollama") {
                    // Refresh on selection so the list reflects the host's
                    // current state (operators often pull a model and come
                    // straight back to wire it up).
                    loadOllamaModels();
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="ollama">Ollama (Local / Self-Hosted)</SelectItem>
                  <SelectItem value="mcp_server">MCP Server</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection - conditional based on agent type */}
            {(newAgent.type === "openai" || newAgent.type === "anthropic") && (
              <div>
                <Label htmlFor="model">Model</Label>
                <Select
                  value={newAgent.config.model}
                  onValueChange={(value) => setNewAgent({
                    ...newAgent,
                    config: { ...newAgent.config, model: value }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {newAgent.type === "openai" && (
                      <>
                        <SelectItem value="gpt-5.2">GPT-5.2 (Thinking)</SelectItem>
                        <SelectItem value="gpt-5.2-chat-latest">GPT-5.2 Instant (Recommended)</SelectItem>
                        <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (Fast)</SelectItem>
                      </>
                    )}
                    {newAgent.type === "anthropic" && (
                      <>
                        <SelectItem value="claude-opus-4-6">Claude Opus 4.6 (Thinking)</SelectItem>
                        <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5 (Recommended)</SelectItem>
                        <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5 (Fast)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Ollama: live model list from /api/v1/ollama/models/live —
                same source the Settings + Ollama AI pages use, so whatever
                is loaded on the configured host (local, remote, or vLLM in
                OpenAI-compat mode) shows up without code changes. */}
            {newAgent.type === "ollama" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="ollama-model">Model</Label>
                  <button
                    type="button"
                    onClick={loadOllamaModels}
                    disabled={ollamaModelsLoading}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
                    title="Re-fetch live models from the configured Ollama host"
                  >
                    {ollamaModelsLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Refresh
                  </button>
                </div>
                <select
                  id="ollama-model"
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  value={newAgent.config.model}
                  onChange={(e) => setNewAgent({
                    ...newAgent,
                    config: { ...newAgent.config, model: e.target.value }
                  })}
                  disabled={ollamaModelsLoading || ollamaModels.length === 0}
                >
                  {ollamaModels.length > 0 ? (
                    <>
                      {!newAgent.config.model && (
                        <option value="" disabled>
                          Select a model…
                        </option>
                      )}
                      {ollamaModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name}
                          {typeof m.size === "number"
                            ? ` (${(m.size / 1024 / 1024 / 1024).toFixed(1)} GB)`
                            : ""}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="" disabled>
                      {ollamaModelsLoading
                        ? "loading…"
                        : ollamaModelsError
                          ? `unavailable: ${ollamaModelsError}`
                          : "no models loaded — open Ollama AI to pull one"}
                    </option>
                  )}
                </select>
                {ollamaModelsError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Couldn't reach Ollama: {ollamaModelsError}.{" "}
                    <a href="/ollama" className="underline hover:no-underline">
                      Configure host
                    </a>
                  </p>
                )}
                {!ollamaModelsError && ollamaModels.length === 0 && !ollamaModelsLoading && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No models loaded.{" "}
                    <a href="/ollama" className="underline hover:no-underline">
                      Open Ollama AI
                    </a>{" "}
                    to pull one.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="model-prompt">Model Prompt</Label>
              <Textarea
                id="model-prompt"
                value={newAgent.config.systemPrompt || ""}
                onChange={(e) => setNewAgent({
                  ...newAgent,
                  config: { ...newAgent.config, systemPrompt: e.target.value }
                })}
                placeholder="Enter custom prompt to characterize this agent's behavior..."
                rows={4}
              />
            </div>

            {/* Tools Enabled Section */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-indigo-600" />
                <h3 className="text-lg font-semibold">Tools Enabled</h3>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter tools..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                {tools.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No tools available. Please seed the tools database.
                  </p>
                ) : (
                  tools
                    .filter((tool) => {
                      if (!toolSearch.trim()) return true;
                      const q = toolSearch.toLowerCase();
                      return (
                        tool.name.toLowerCase().includes(q) ||
                        tool.category.toLowerCase().includes(q)
                      );
                    })
                    .map((tool) => (
                    <div key={tool.id} className="flex items-center gap-2 hover:bg-secondary p-2 rounded">
                      <input
                        type="checkbox"
                        id={`tool-${tool.id}`}
                        checked={newAgent.config.enabledTools.includes(tool.id)}
                        onChange={(e) => {
                          const enabledTools = e.target.checked
                            ? [...newAgent.config.enabledTools, tool.id]
                            : newAgent.config.enabledTools.filter((id) => id !== tool.id);
                          setNewAgent({
                            ...newAgent,
                            config: { ...newAgent.config, enabledTools }
                          });
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-border rounded"
                      />
                      <Label htmlFor={`tool-${tool.id}`} className="flex-1 mb-0 cursor-pointer">
                        <span className="font-medium">{tool.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({tool.category.replace(/_/g, " ")})
                        </span>
                      </Label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {newAgent.config.enabledTools.length} tool(s)
              </p>

              {/* Tools Order Section */}
              {newAgent.config.enabledTools.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Tools Order</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Drag to reorder how the agent will use these tools
                  </p>
                  
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => {
                      const { active, over } = event;
                      if (over && active.id !== over.id) {
                        const oldIndex = newAgent.config.enabledTools.indexOf(active.id as string);
                        const newIndex = newAgent.config.enabledTools.indexOf(over.id as string);
                        const reordered = arrayMove(newAgent.config.enabledTools, oldIndex, newIndex);
                        setNewAgent({
                          ...newAgent,
                          config: { ...newAgent.config, enabledTools: reordered }
                        });
                      }
                    }}
                  >
                    <SortableContext
                      items={newAgent.config.enabledTools}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {newAgent.config.enabledTools.map((toolId, index) => {
                          const tool = tools.find((t) => t.id === toolId);
                          if (!tool) return null;

                          return (
                            <SortableToolItem 
                              key={toolId}
                              id={toolId}
                              tool={tool}
                              index={index}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-xs text-muted-foreground">
                      💡 The agent will execute tools in the order shown above (top to bottom)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Skills Enabled Section — dual listbox over the unified skills
                catalog. Tool SKILL.md files and bug-hunter knowledge_base
                rows live in the same pool; the namespaced ID
                (`tool:<registry>:<rowId>` vs `bh:skill:<slug>`) lets the
                backend route the content into the agent's prompt at run time. */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-lg font-semibold">Skills Enabled</h3>
                </div>
                <button
                  type="button"
                  onClick={loadCatalogSkills}
                  disabled={catalogSkillsLoading}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
                  title="Re-fetch the skills catalog"
                >
                  {catalogSkillsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Refresh
                </button>
              </div>

              {catalogSkillsError && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Couldn&apos;t load skills catalog: {catalogSkillsError}
                </p>
              )}

              {!catalogSkillsLoading && !catalogSkillsError && catalogSkills.length === 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  No skills found. Tool skills come from <code>FF_TOOL_SKILL_GENERATION</code>; bug-hunter skills come from{" "}
                  <code>npm run bug-hunter:import-skills</code> after enabling <code>FF_BUG_HUNTER</code>.
                </p>
              )}

              <DualListbox<CatalogSkill>
                items={catalogSkills}
                selectedIds={newAgent.config.enabledSkills}
                onChange={(ids) =>
                  setNewAgent({
                    ...newAgent,
                    config: { ...newAgent.config, enabledSkills: ids },
                  })
                }
                getSearchText={(s) =>
                  `${s.displayName} ${s.kind} ${s.source} ${s.summary} ${s.tags.join(" ")}`
                }
                availableLabel="Available skills"
                selectedLabel="Enabled skills"
                helpText="Tip: click to highlight, ⌘/Ctrl-click for multi-select, double-click to move. Filters apply to each pane independently."
                renderItem={(s) => (
                  <div className="flex items-start gap-2">
                    <Badge
                      variant="secondary"
                      className={`shrink-0 text-[10px] py-0 px-1.5 ${
                        s.kind === "tool"
                          ? "bg-indigo-500/10 text-indigo-600"
                          : "bg-emerald-500/10 text-emerald-600"
                      }`}
                    >
                      {s.kind === "tool" ? "tool" : "bh"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {s.displayName}
                      </div>
                      {s.summary && (
                        <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                          {s.summary}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {newAgent.config.enabledSkills.length} skill{newAgent.config.enabledSkills.length === 1 ? "" : "s"}
                {catalogSkills.length > 0 && (
                  <>
                    {" · "}
                    <span className="text-muted-foreground/80">
                      Pool: {catalogSkills.filter((s) => s.kind === "tool").length} tool / {catalogSkills.filter((s) => s.kind === "bug_hunter").length} bug-hunter
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* MCP Server Integration Section */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Server className="h-4 w-4 text-purple-600" />
                <h3 className="text-lg font-semibold">MCP Server Integration</h3>
              </div>

              <div>
                <Label>Select MCP Servers (Optional)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Connect this agent to one or more running MCP servers. The
                  first selected server is the primary; backend dispatch will
                  route each tool call to whichever attached server provides it.
                </p>
                {(() => {
                  const selectedIds: string[] = newAgent.config.mcpServerIds ?? [];
                  const runningServers = mcpServers.filter((s) => s.status === "running");
                  if (runningServers.length === 0) {
                    return (
                      <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        No running MCP servers. Start one in the MCP Servers tab to attach it here.
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2 space-y-1">
                        {runningServers.map((server) => {
                          const checked = selectedIds.includes(server.id);
                          return (
                            <div
                              key={server.id}
                              className="flex items-center gap-2 py-1 px-1 rounded hover:bg-secondary/40"
                            >
                              <Checkbox
                                id={`mcp-${server.id}`}
                                checked={checked}
                                onCheckedChange={(state) => {
                                  const isChecked = state === true;
                                  const next = isChecked
                                    ? [...selectedIds, server.id]
                                    : selectedIds.filter((id) => id !== server.id);
                                  setNewAgent({
                                    ...newAgent,
                                    config: {
                                      ...newAgent.config,
                                      mcpServerIds: next,
                                      mcpServerId: next[0] ?? "",
                                    },
                                  });
                                }}
                              />
                              <Label
                                htmlFor={`mcp-${server.id}`}
                                className="flex-1 cursor-pointer text-sm font-normal"
                              >
                                {server.name}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({server.status})
                                </span>
                                {checked && selectedIds[0] === server.id && (
                                  <Badge variant="secondary" className="ml-2 bg-purple-500/10 text-purple-600 text-[10px]">
                                    primary
                                  </Badge>
                                )}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Selected: {selectedIds.length} server{selectedIds.length === 1 ? "" : "s"}
                        {selectedIds.length > 0 && (
                          <>
                            {" · "}
                            <span className="text-purple-600">
                              ✓ Agent will have access to MCP tools across all selected servers
                            </span>
                          </>
                        )}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Loop Configuration Section */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-4">
                <RotateCcw className="h-4 w-4 text-blue-600" />
                <h3 className="text-lg font-semibold">Loop Configuration</h3>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label>Enable Agent Loop</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow this agent to loop with another agent for iterative refinement
                  </p>
                </div>
                <Switch
                  checked={newAgent.config.loopEnabled}
                  onCheckedChange={(checked) => setNewAgent({
                    ...newAgent,
                    config: { ...newAgent.config, loopEnabled: checked }
                  })}
                />
              </div>

              {newAgent.config.loopEnabled && (
                <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                  <div>
                    <Label htmlFor="loop-partner">Loop Partner Agent</Label>
                    <Select
                      value={newAgent.config.loopPartnerId}
                      onValueChange={(value) => setNewAgent({
                        ...newAgent,
                        config: { ...newAgent.config, loopPartnerId: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent to loop with" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents
                          ?.filter((a) => a.id !== editingAgent?.id)
                          .map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name} ({agent.type})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="max-iterations">Maximum Loop Iterations</Label>
                    <Input
                      id="max-iterations"
                      type="number"
                      value={newAgent.config.maxLoopIterations}
                      onChange={(e) => setNewAgent({
                        ...newAgent,
                        config: { ...newAgent.config, maxLoopIterations: parseInt(e.target.value) || 5 }
                      })}
                      placeholder="5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="exit-condition">Loop Exit Condition</Label>
                    <Select
                      value={newAgent.config.loopExitCondition}
                      onValueChange={(value) => setNewAgent({
                        ...newAgent,
                        config: { ...newAgent.config, loopExitCondition: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select exit condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="functional_poc">Functional POC</SelectItem>
                        <SelectItem value="vulnerability_confirmed">Vulnerability Confirmed</SelectItem>
                        <SelectItem value="exploit_successful">Exploit Successful</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAgent} disabled={!newAgent.name}>
                {editingAgent ? "Save Changes" : "Import Agent"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add MCP Server Dialog */}
      <Dialog open={serverDialogOpen} onOpenChange={setServerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="server-name">Server Name</Label>
              <Input
                id="server-name"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                placeholder="Tavily Search Server"
              />
            </div>
            <div>
              <Label htmlFor="server-command">Command</Label>
              <Input
                id="server-command"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                placeholder="npx -y @anthropics/mcp-remote https://mcp.tavily.com/mcp/"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Full shell command with arguments (e.g., npx -y package-name or node /path/to/script.js)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-restart"
                checked={newServer.autoRestart}
                onChange={(e) => setNewServer({ ...newServer, autoRestart: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="auto-restart">Auto-restart on failure</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setServerDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateServer} disabled={!newServer.name || !newServer.command}>
                Add Server
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit MCP Server Dialog */}
      <Dialog open={editServerDialogOpen} onOpenChange={(open) => {
        setEditServerDialogOpen(open);
        if (!open) {
          setEditingServer(null);
          setNewServer({ name: "", command: "", args: [], autoRestart: true });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit MCP Server</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-server-name">Server Name</Label>
              <Input
                id="edit-server-name"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-server-command">Command</Label>
              <Input
                id="edit-server-command"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Full shell command with arguments (e.g., npx -y package-name or node /path/to/script.js)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-auto-restart"
                checked={newServer.autoRestart}
                onChange={(e) => setNewServer({ ...newServer, autoRestart: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-auto-restart">Auto-restart on failure</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditServerDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateServer} disabled={!newServer.name || !newServer.command}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Details Dialog */}
      <WorkflowDetailsDialog
        open={workflowDetailsOpen}
        onOpenChange={setWorkflowDetailsOpen}
        workflowDetails={selectedWorkflowDetails}
        agents={agents}
      />

      {/* Import Agent Dialog */}
      <ImportAgentDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        mcpServers={mcpServers || []}
        onAgentCreated={refetchAgents}
      />

      {/* Restore Backups Dialog */}
      <RestoreBackupsDialog
        open={backupsDialogOpen}
        onOpenChange={setBackupsDialogOpen}
        onRestored={refetchAgents}
      />

      {/* Workflow Builder Dialog */}
      <WorkflowBuilder
        open={workflowBuilderOpen}
        onOpenChange={setWorkflowBuilderOpen}
        agents={agents || []}
        mcpServers={mcpServers || []}
        operations={operations || []}
        targets={targets || []}
        onWorkflowCreated={refetchAgents}
      />

      {/* Workflow Edit Dialog */}
      <WorkflowEditDialog
        open={workflowEditOpen}
        onOpenChange={(open) => {
          setWorkflowEditOpen(open);
          if (!open) setEditingWorkflowTemplate(null);
        }}
        template={editingWorkflowTemplate}
        agents={agents || []}
        onSave={handleSaveWorkflowTemplate}
      />
    </div>
  );
}
