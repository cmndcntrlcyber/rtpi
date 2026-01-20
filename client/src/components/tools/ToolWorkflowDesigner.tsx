import { useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Save,
  FolderOpen,
  Plus,
  Download,
  Play,
  Trash2,
  Copy,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ToolWorkflowDesignerProps {
  operationId?: string;
}

// Custom node type for tools
function ToolNode({ data }: any) {
  return (
    <Card className="p-3 min-w-[200px] border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-950">
      <div className="font-semibold text-sm mb-1">🔧 {data.label}</div>
      {data.category && (
        <div className="text-xs text-muted-foreground mb-2">{data.category}</div>
      )}
      {data.command && (
        <div className="text-xs mt-2 font-mono bg-black/10 px-2 py-1 rounded">
          {data.command}
        </div>
      )}
      {data.description && (
        <div className="text-xs mt-2 text-muted-foreground line-clamp-2">
          {data.description}
        </div>
      )}
    </Card>
  );
}

// Custom node types
const nodeTypes = {
  tool: ToolNode,
};

export default function ToolWorkflowDesigner({ operationId }: ToolWorkflowDesignerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [workflowCategory, setWorkflowCategory] = useState("");

  // Dialogs
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState("");

  const nodeIdCounter = useRef(0);

  useEffect(() => {
    loadWorkflows();
    loadAvailableTools();
  }, [operationId]);

  const loadWorkflows = async () => {
    try {
      const params = operationId ? `?operationId=${operationId}` : "";
      const response = await api.get<{ workflows: any[] }>(`/tool-workflows${params}`);
      setWorkflows(response.workflows || []);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    }
  };

  const loadAvailableTools = async () => {
    try {
      const response = await api.get<{ tools: any[] }>("/tool-workflows/meta/available-tools");
      setAvailableTools(response.tools || []);
    } catch (error) {
      console.error("Failed to load tools:", error);
    }
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAddTool = (tool: any) => {
    const newNode: Node = {
      id: `tool-${++nodeIdCounter.current}`,
      type: "tool",
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: tool.name,
        toolId: tool.id,
        category: tool.category,
        description: tool.description,
        command: tool.command,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setToolPickerOpen(false);
    toast.success(`Added ${tool.name} to workflow`);
  };

  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) {
      toast.error("Workflow name is required");
      return;
    }

    try {
      const workflowData = {
        nodes,
        edges,
      };

      if (selectedWorkflow) {
        // Update existing workflow
        await api.put(`/tool-workflows/${selectedWorkflow}`, {
          name: workflowName,
          description: workflowDescription,
          category: workflowCategory,
          workflowData,
        });
        toast.success("Workflow updated successfully");
      } else {
        // Create new workflow
        const response = await api.post("/tool-workflows", {
          name: workflowName,
          description: workflowDescription,
          category: workflowCategory,
          operationId: operationId || null,
          workflowData,
        });
        setSelectedWorkflow(response.id);
        toast.success("Workflow saved successfully");
      }

      await loadWorkflows();
      setSaveDialogOpen(false);
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast.error("Failed to save workflow");
    }
  };

  const handleLoadWorkflow = (workflow: any) => {
    setNodes(workflow.workflowData?.nodes || []);
    setEdges(workflow.workflowData?.edges || []);
    setSelectedWorkflow(workflow.id);
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description || "");
    setWorkflowCategory(workflow.category || "");
    setLoadDialogOpen(false);
    toast.success(`Loaded workflow: ${workflow.name}`);
  };

  const handleNewWorkflow = () => {
    setNodes([]);
    setEdges([]);
    setSelectedWorkflow(null);
    setWorkflowName("");
    setWorkflowDescription("");
    setWorkflowCategory("");
    toast.success("New workflow created");
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) {
      return;
    }

    try {
      await api.delete(`/tool-workflows/${workflowId}`);
      toast.success("Workflow deleted successfully");
      await loadWorkflows();

      if (selectedWorkflow === workflowId) {
        handleNewWorkflow();
      }
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      toast.error("Failed to delete workflow");
    }
  };

  const handleDuplicateWorkflow = async (workflowId: string) => {
    try {
      await api.post(`/tool-workflows/${workflowId}/duplicate`);
      toast.success("Workflow duplicated successfully");
      await loadWorkflows();
    } catch (error) {
      console.error("Failed to duplicate workflow:", error);
      toast.error("Failed to duplicate workflow");
    }
  };

  const handleExecuteWorkflow = async () => {
    if (!selectedWorkflow) {
      toast.error("Please save the workflow before executing");
      return;
    }

    try {
      await api.post(`/tool-workflows/${selectedWorkflow}/execute`);
      toast.success("Workflow execution started");
    } catch (error) {
      console.error("Failed to execute workflow:", error);
      toast.error("Failed to execute workflow");
    }
  };

  const handleExportWorkflow = () => {
    const data = {
      name: workflowName || "Unnamed Workflow",
      description: workflowDescription,
      category: workflowCategory,
      workflowData: { nodes, edges },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tool-workflow-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Workflow exported successfully");
  };

  const filteredTools = availableTools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
      tool.category?.toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
      tool.description?.toLowerCase().includes(toolSearchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-300px)] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

        <Panel position="top-left" className="space-x-2">
          <Button size="sm" onClick={handleNewWorkflow}>
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSaveDialogOpen(true)}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLoadDialogOpen(true)}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Load
          </Button>
          <Button size="sm" variant="outline" onClick={() => setToolPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tool
          </Button>
          {selectedWorkflow && (
            <Button size="sm" variant="default" onClick={handleExecuteWorkflow}>
              <Play className="h-4 w-4 mr-2" />
              Execute
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleExportWorkflow}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </Panel>

        {workflowName && (
          <Panel position="top-right">
            <div className="bg-card px-4 py-2 rounded-lg shadow border border-border">
              <div className="font-semibold text-sm">{workflowName}</div>
              {workflowCategory && (
                <div className="text-xs text-muted-foreground mt-1">{workflowCategory}</div>
              )}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedWorkflow ? "Update" : "Save"} Tool Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="workflow-name">Workflow Name *</Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g., Reconnaissance Workflow"
              />
            </div>
            <div>
              <Label htmlFor="workflow-category">Category</Label>
              <Select value={workflowCategory} onValueChange={setWorkflowCategory}>
                <SelectTrigger id="workflow-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reconnaissance">Reconnaissance</SelectItem>
                  <SelectItem value="exploitation">Exploitation</SelectItem>
                  <SelectItem value="post-exploitation">Post-Exploitation</SelectItem>
                  <SelectItem value="web_security">Web Security</SelectItem>
                  <SelectItem value="network_security">Network Security</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Describe the workflow..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWorkflow}>
              {selectedWorkflow ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Tool Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
            {workflows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No saved workflows yet. Create and save a workflow to get started!
              </div>
            ) : (
              workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{workflow.name}</h3>
                        {workflow.category && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {workflow.category}
                          </span>
                        )}
                      </div>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {workflow.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          {workflow.workflowData?.nodes?.length || 0} tools,{" "}
                          {workflow.workflowData?.edges?.length || 0} connections
                        </span>
                        <span>
                          Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                        </span>
                        {workflow.executionCount > 0 && (
                          <span>Executed {workflow.executionCount}x</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button size="sm" onClick={() => handleLoadWorkflow(workflow)}>
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicateWorkflow(workflow.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tool Picker Dialog */}
      <Dialog open={toolPickerOpen} onOpenChange={setToolPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Tool to Workflow</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={toolSearchQuery}
              onChange={(e) => setToolSearchQuery(e.target.value)}
              placeholder="Search tools..."
              className="pl-10"
            />
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-2 gap-3 mt-4 max-h-[400px] overflow-y-auto">
            {filteredTools.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                No tools found
              </div>
            ) : (
              filteredTools.map((tool) => (
                <Card
                  key={tool.id}
                  className="p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => handleAddTool(tool)}
                >
                  <div className="font-semibold text-sm mb-1">{tool.name}</div>
                  {tool.category && (
                    <div className="text-xs text-muted-foreground mb-2">{tool.category}</div>
                  )}
                  {tool.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {tool.description}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setToolPickerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
