import { useState, useEffect } from "react";
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
import { Bot, Server, Activity, Clock, Plus, RotateCcw, Pause, Target, CheckCircle, AlertTriangle, Zap, GripVertical, ArrowRight, X } from "lucide-react";
import { useAgents } from "@/hooks/useAgents";
import { useMCPServers } from "@/hooks/useMCPServers";
import { useTargets } from "@/hooks/useTargets";
import { useTools } from "@/hooks/useTools";
import { useWorkflows, type WorkflowDetails } from "@/hooks/useWorkflows";
import { api } from "@/lib/api";
import WorkflowProgressCard from "@/components/agents/WorkflowProgressCard";
import WorkflowDetailsDialog from "@/components/agents/WorkflowDetailsDialog";
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
        <div className="bg-blue-100 p-2 rounded-lg mr-3">
          <Bot className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-foreground font-medium">{agent.name}</h4>
          <p className="text-sm text-muted-foreground capitalize">{agent.type} Agent</p>
        </div>
        <div className="text-sm text-muted-foreground mr-3">
          Order: {agent.config?.flowOrder >= 0 ? agent.config.flowOrder : 0}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(agent.id)}
          className="hover:bg-red-50 hover:text-red-600"
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

export default function Agents() {
  const { agents, loading: agentsLoading, refetch: refetchAgents } = useAgents();
  const { servers: mcpServers, loading: serversLoading, refetch: refetchServers } = useMCPServers();
  const { tools } = useTools();
  const { runningWorkflows, allNonRunning, getWorkflowDetails, cancelWorkflow } = useWorkflows();
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [workflowDetailsOpen, setWorkflowDetailsOpen] = useState(false);
  const [selectedWorkflowDetails, setSelectedWorkflowDetails] = useState<WorkflowDetails | null>(null);
  const [workflowTasksMap, setWorkflowTasksMap] = useState<Record<string, any[]>>({});
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [newAgent, setNewAgent] = useState({
    name: "",
    type: "openai" as any,
    config: {
      model: "gpt-4o",
      systemPrompt: "",
      loopEnabled: false,
      loopPartnerId: "",
      maxLoopIterations: 5,
      loopExitCondition: "functional_poc",
      flowOrder: 0,
      enabledTools: [] as string[],
      mcpServerId: "" as string,
    },
    capabilities: [],
  });
  const [activeLoops, setActiveLoops] = useState<any[]>([]);
  const { targets } = useTargets();
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [newServer, setNewServer] = useState({
    name: "",
    command: "",
    args: [],
    autoRestart: true,
  });

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
      console.error("Failed to load loops:", err);
    }
  };

  const handleEditAgent = (agent: any) => {
    setEditingAgent(agent);
    const config = agent.config || {};
    setNewAgent({
      name: agent.name,
      type: agent.type,
      config: {
        model: config.model || (agent.type === "openai" ? "gpt-4o" : "claude-sonnet-4-5-20250929"),
        systemPrompt: config.systemPrompt || "",
        loopEnabled: config.loopEnabled || false,
        loopPartnerId: config.loopPartnerId || "",
        maxLoopIterations: config.maxLoopIterations || 5,
        loopExitCondition: config.loopExitCondition || "functional_poc",
        flowOrder: config.flowOrder || 0,
        enabledTools: config.enabledTools || [],
        mcpServerId: config.mcpServerId || "",
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
          model: "gpt-4o",
          systemPrompt: "",
          loopEnabled: false,
          loopPartnerId: "",
          maxLoopIterations: 5,
          loopExitCondition: "functional_poc",
          flowOrder: 0,
          enabledTools: [],
          mcpServerId: "",
        }, 
        capabilities: [] 
      });
    } catch (err) {
      console.error("Failed to save agent:", err);
      alert("Failed to save agent");
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
      console.error("Failed to delete agent:", err);
      alert("Failed to delete agent");
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
            console.error("Failed to update flow order:", err);
          }
        }
      });
      
      // Refresh after updates
      setTimeout(() => refetchAgents(), 500);
    }
  };

  const handleStartLoop = async (agentId: string) => {
    const targetId = targets[0]?.id; // Use first target for demo
    if (!targetId) {
      alert("No targets available. Please create a target first.");
      return;
    }

    try {
      await api.post("/agent-loops/start", {
        agentId,
        targetId,
        initialInput: "Begin vulnerability analysis and exploit development",
      });
      await loadActiveLoops();
      alert("Agent loop started successfully!");
    } catch (err) {
      console.error("Failed to start loop:", err);
      alert("Failed to start loop");
    }
  };

  const handleStopLoop = async (loopId: string) => {
    try {
      await api.post(`/agent-loops/${loopId}/stop`, {});
      await loadActiveLoops();
    } catch (err) {
      console.error("Failed to stop loop:", err);
      alert("Failed to stop loop");
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
      console.error("Failed to create MCP server:", err);
      alert("Failed to create MCP server");
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
      alert("MCP server started successfully!");
    } catch (err) {
      console.error("Failed to start server:", err);
      alert("Failed to start MCP server");
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
      alert("MCP server stopped successfully!");
    } catch (err) {
      console.error("Failed to stop server:", err);
      alert("Failed to stop MCP server");
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
      console.error("Failed to remove agent from flow:", err);
      alert("Failed to remove agent from flow");
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
      console.error("Failed to add agent to flow:", err);
      alert("Failed to add agent to flow");
    }
  };

  // Execute workflow with selected target
  const handleExecuteWorkflow = async () => {
    if (!selectedTargetId) {
      alert("Please select a target first");
      return;
    }

    try {
      const response = await api.post("/agent-workflows/start", {
        targetId: selectedTargetId,
        workflowType: "penetration_test"
      });

      alert(`Workflow started successfully! Workflow ID: ${response.workflow.id}`);
      console.log("Workflow started:", response);
    } catch (err) {
      console.error("Failed to start workflow:", err);
      alert("Failed to start workflow");
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
      console.error("Failed to load workflow details:", err);
      alert("Failed to load workflow details");
    }
  };

  // Cancel workflow
  const handleCancelWorkflow = async (workflowId: string) => {
    if (!confirm("Are you sure you want to cancel this workflow?")) return;

    try {
      await cancelWorkflow(workflowId);
      alert("Workflow cancelled successfully");
    } catch (err) {
      console.error("Failed to cancel workflow:", err);
      alert("Failed to cancel workflow");
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
          console.error(`Failed to load tasks for workflow ${workflow.id}:`, err);
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">AI Agents & MCP Servers</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">AI Agents</h3>
          <p className="text-3xl font-bold text-foreground">{stats.aiAgents}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Agents</h3>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">MCP Servers</h3>
          <p className="text-3xl font-bold text-foreground">{stats.mcpServers}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Connected</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.connected}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ai">AI Agents</TabsTrigger>
          <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setAgentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Import Agent
            </Button>
          </div>

          {agentsLoading ? (
            <p className="text-muted-foreground">Loading AI agents...</p>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-border">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No AI agents configured</p>
              <p className="text-sm text-muted-foreground mb-4">Import an AI agent to get started</p>
              <Button onClick={() => setAgentDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Import Agent
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agents.map((agent) => {
                  const config = agent.config as any;
                  const loopPartner = config?.loopEnabled 
                    ? agents.find((a) => a.id === config.loopPartnerId) 
                    : null;
                  
                  return (
                    <Card key={agent.id} className="bg-card">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white mr-3">
                              <Bot className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{agent.name}</h3>
                              <p className="text-sm text-muted-foreground capitalize">{agent.type}</p>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`${
                              agent.status === "running"
                                ? "bg-green-500/10 text-green-600"
                                : "bg-secondary0/10 text-muted-foreground"
                            }`}
                          >
                            {agent.status}
                          </Badge>
                        </div>

                        {/* Capabilities Section */}
                        <div className="mb-4 p-3 bg-secondary rounded">
                          <h4 className="text-xs font-semibold text-foreground mb-2">CAPABILITIES</h4>
                          <p className="text-xs text-muted-foreground">
                            {agent.type === "openai" && "Advanced reasoning, vulnerability analysis, comprehensive reporting, ethical assessment"}
                            {agent.type === "anthropic" && "Advanced reasoning, vulnerability analysis, comprehensive reporting, ethical assessment"}
                            {agent.type === "mcp_server" && "Tool integration, automated workflows, external service connectivity"}
                            {agent.type === "custom" && "Custom AI processing and analysis"}
                          </p>
                        </div>

                        {/* Tools Enabled Section */}
                        {config?.enabledTools && config.enabledTools.length > 0 && (
                          <div className="mb-4 p-3 bg-indigo-50 rounded border-l-4 border-indigo-600">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-indigo-600" />
                              <h4 className="text-xs font-semibold text-foreground">TOOLS ENABLED</h4>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              {config.enabledTools.slice(0, 3).map((toolId: string) => {
                                const tool = tools.find((t) => t.id === toolId);
                                return tool ? (
                                  <div key={toolId}>
                                    • {tool.name} ({tool.category.replace(/_/g, " ")})
                                  </div>
                                ) : null;
                              })}
                              {config.enabledTools.length > 3 && (
                                <div className="text-indigo-600 font-medium">
                                  + {config.enabledTools.length - 3} more tools
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Loop Configuration Display */}
                        {config?.loopEnabled && loopPartner && (
                          <div className="mb-4 p-3 bg-blue-50 rounded border-l-4 border-blue-600">
                            <div className="flex items-center gap-2 mb-2">
                              <RotateCcw className="h-4 w-4 text-blue-600" />
                              <h4 className="text-xs font-semibold text-foreground">LOOP ENABLED</h4>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>Partner: {loopPartner.name}</div>
                              <div>Max Iterations: {config.maxLoopIterations || 5}</div>
                              <div>Exit: {config.loopExitCondition || "functional_poc"}</div>
                            </div>
                          </div>
                        )}

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div className="flex items-center text-muted-foreground">
                            <Activity className="h-4 w-4 mr-2" />
                            <span>{agent.tasksCompleted || 0} tasks</span>
                          </div>
                          {agent.lastActivity && (
                            <div className="flex items-center text-muted-foreground">
                              <Clock className="h-4 w-4 mr-2" />
                              <span>{new Date(agent.lastActivity).toLocaleTimeString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {config?.loopEnabled && loopPartner && (
                            <Button
                              size="sm"
                              onClick={() => handleStartLoop(agent.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Start Loop
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditAgent(agent)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteAgent(agent.id)}
                            className="hover:bg-red-50 hover:text-red-600 hover:border-red-600"
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Agent Flow Order Section */}
              {agents.length > 0 && (
                <Card className="mt-6 bg-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <ArrowRight className="h-5 w-5 text-blue-600" />
                          Agent Flow Order
                        </CardTitle>
                        <p className="text-muted-foreground text-sm mt-1">
                          Drag and drop to organize the order that AI agents will communicate with each other
                        </p>
                      </div>
                      
                      {/* Target Selector & Execute Button */}
                      <div className="flex flex-col items-end gap-2">
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
                        <Button
                          onClick={handleExecuteWorkflow}
                          disabled={!selectedTargetId}
                          className="w-48 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Execute
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Filter agents in flow (flowOrder >= 0) */}
                    {(() => {
                      const agentsInFlow = [...agents]
                        .filter((a) => {
                          const order = (a.config as any)?.flowOrder;
                          return order !== undefined && order >= 0;
                        })
                        .sort((a, b) => {
                          const aOrder = (a.config as any)?.flowOrder || 0;
                          const bOrder = (b.config as any)?.flowOrder || 0;
                          return aOrder - bOrder;
                        });

                      const availableAgents = agents.filter((a) => {
                        const order = (a.config as any)?.flowOrder;
                        return order === undefined || order < 0;
                      });

                      return (
                        <>
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext
                              items={agentsInFlow.map((agent) => agent.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-3">
                                {agentsInFlow.map((agent, index) => (
                                  <div key={agent.id} className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-blue-600 text-sm font-medium">
                                      {index + 1}
                                    </div>
                                    <SortableAgentItem agent={agent} onRemove={handleRemoveFromFlow} />
                                    {index < agentsInFlow.length - 1 && (
                                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>

                          {/* Add Agent Section */}
                          {availableAgents.length > 0 && (
                            <div className="mt-6 p-4 bg-secondary border border-dashed border-border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Plus className="h-4 w-4 text-muted-foreground" />
                                <Select onValueChange={handleAddToFlow}>
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Add agent to flow..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableAgents.map((agent) => (
                                      <SelectItem key={agent.id} value={agent.id}>
                                        {agent.name} ({agent.type})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                {availableAgents.length} agent(s) available to add
                              </p>
                            </div>
                          )}

                          {/* How it Works Section */}
                          {agentsInFlow.length > 1 && (
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <h4 className="text-sm font-medium text-foreground mb-2">How Agent Flow Works</h4>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                <li>• Agents execute in the order shown above (top to bottom)</li>
                                <li>• Each agent can process and enhance the previous agent&apos;s output</li>
                                <li>• Drag agents up or down to change their execution order</li>
                                <li>• Click X to remove an agent from the flow</li>
                                <li>• The final output combines insights from all agents in sequence</li>
                              </ul>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Active Workflows Section */}
              {runningWorkflows.length > 0 && (
                <Card className="mt-6 bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-600" />
                      Active Workflows
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Real-time monitoring of running workflows with progress tracking
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </CardContent>
                </Card>
              )}

              {/* Workflow History Section */}
              {allNonRunning.length > 0 && (
                <Card className="mt-6 bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      Workflow History
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Completed and failed workflows
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {allNonRunning.slice(0, 5).map((workflow) => (
                        <div
                          key={workflow.id}
                          className="p-3 bg-secondary rounded border border-border hover:bg-secondary transition-colors"
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
                                  : "bg-secondary0/10 text-muted-foreground"
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
                      {allNonRunning.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center italic">
                          + {allNonRunning.length - 5} more workflows
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

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
          <div className="flex justify-end mb-4">
            <Button onClick={() => setServerDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add MCP Server
            </Button>
          </div>

          {serversLoading ? (
            <p className="text-muted-foreground">Loading MCP servers...</p>
          ) : mcpServers.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-border">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No MCP servers configured</p>
              <p className="text-sm text-muted-foreground mb-4">Add an MCP server to get started</p>
              <Button onClick={() => setServerDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add MCP Server
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mcpServers.map((server) => (
                <Card key={server.id} className="bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white mr-3">
                          <Server className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{server.name}</h3>
                          <p className="text-sm text-muted-foreground">MCP Server</p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${
                          server.status === "running"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-secondary0/10 text-muted-foreground"
                        }`}
                      >
                        {server.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2 truncate">
                      {server.command}
                    </div>
                    {server.autoRestart && (
                      <div className="text-xs text-muted-foreground">
                        Auto-restart enabled
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      {server.status === "stopped" && (
                        <Button
                          size="sm"
                          onClick={() => handleStartServer(server.id)}
                        >
                          Start Server
                        </Button>
                      )}
                      {server.status === "running" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStopServer(server.id)}
                        >
                          Stop Server
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Import/Edit Agent Dialog */}
      <Dialog open={agentDialogOpen} onOpenChange={(open) => {
        setAgentDialogOpen(open);
        if (!open) setEditingAgent(null);
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
                  // Set default model based on type
                  const defaultModel = value === "openai" ? "gpt-4o" : 
                                      value === "anthropic" ? "claude-sonnet-4-5-20250929" : "";
                  setNewAgent({ 
                    ...newAgent, 
                    type: value,
                    config: { ...newAgent.config, model: defaultModel }
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
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
                        <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="o3-deep-research">o3 Deep Research</SelectItem>
                        <SelectItem value="o4-mini">o4 Mini</SelectItem>
                      </>
                    )}
                    {newAgent.type === "anthropic" && (
                      <>
                        <SelectItem value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Recommended)</SelectItem>
                        <SelectItem value="claude-opus-4-1-20250805">Claude Opus 4.1</SelectItem>
                        <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
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

              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                {tools.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No tools available. Please seed the tools database.
                  </p>
                ) : (
                  tools.map((tool) => (
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

            {/* MCP Server Integration Section */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Server className="h-4 w-4 text-purple-600" />
                <h3 className="text-lg font-semibold">MCP Server Integration</h3>
              </div>

              <div>
                <Label htmlFor="mcp-server">Select MCP Server (Optional)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Connect this agent to an MCP server for enhanced capabilities like web search and data extraction
                </p>
                <Select
                  value={newAgent.config.mcpServerId || ""}
                  onValueChange={(value) => setNewAgent({
                    ...newAgent,
                    config: { ...newAgent.config, mcpServerId: value || "" }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No MCP server selected" />
                  </SelectTrigger>
                  <SelectContent>
                    {mcpServers
                      .filter((s) => s.status === "running")
                      .map((server) => (
                        <SelectItem key={server.id} value={server.id}>
                          {server.name} ({server.status})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {newAgent.config.mcpServerId && (
                  <p className="text-xs text-purple-600 mt-2">
                    ✓ Agent will have access to MCP tools (search, extract, crawl, map)
                  </p>
                )}
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
                placeholder="npx -y tavily-mcp@latest"
              />
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

      {/* Workflow Details Dialog */}
      <WorkflowDetailsDialog
        open={workflowDetailsOpen}
        onOpenChange={setWorkflowDetailsOpen}
        workflowDetails={selectedWorkflowDetails}
        agents={agents}
      />
    </div>
  );
}
