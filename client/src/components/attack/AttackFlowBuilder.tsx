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
  Upload,
  Play,
  Trash2,
  Copy,
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

interface AttackFlowBuilderProps {
  operationId?: string;
}

// Custom node types
const nodeTypes = {
  technique: TechniqueNode,
  objective: ObjectiveNode,
  asset: AssetNode,
};

function TechniqueNode({ data }: any) {
  return (
    <Card className="p-3 min-w-[200px] border-2 border-blue-500 bg-blue-50 dark:bg-blue-950">
      <div className="font-semibold text-sm mb-1">{data.label}</div>
      {data.techniqueId && (
        <div className="text-xs text-muted-foreground">{data.techniqueId}</div>
      )}
      {data.description && (
        <div className="text-xs mt-2 text-muted-foreground line-clamp-2">
          {data.description}
        </div>
      )}
    </Card>
  );
}

function ObjectiveNode({ data }: any) {
  return (
    <Card className="p-3 min-w-[200px] border-2 border-green-500 bg-green-50 dark:bg-green-950">
      <div className="font-semibold text-sm mb-1">🎯 {data.label}</div>
      {data.description && (
        <div className="text-xs mt-2 text-muted-foreground line-clamp-2">
          {data.description}
        </div>
      )}
    </Card>
  );
}

function AssetNode({ data }: any) {
  return (
    <Card className="p-3 min-w-[200px] border-2 border-purple-500 bg-purple-50 dark:bg-purple-950">
      <div className="font-semibold text-sm mb-1">🖥️ {data.label}</div>
      {data.type && (
        <div className="text-xs text-muted-foreground">{data.type}</div>
      )}
      {data.description && (
        <div className="text-xs mt-2 text-muted-foreground line-clamp-2">
          {data.description}
        </div>
      )}
    </Card>
  );
}

export default function AttackFlowBuilder({ operationId }: AttackFlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [flowName, setFlowName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");

  // Dialogs
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);

  // Node creation form
  const [nodeType, setNodeType] = useState<"technique" | "objective" | "asset">("technique");
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [nodeTechniqueId, setNodeTechniqueId] = useState("");
  const [nodeAssetType, setNodeAssetType] = useState("");

  const nodeIdCounter = useRef(0);

  useEffect(() => {
    loadFlows();
  }, [operationId]);

  const loadFlows = async () => {
    try {
      const params = operationId ? `?operationId=${operationId}` : "";
      const response = await api.get<{ flows: any[] }>(`/attack-flows${params}`);
      setFlows(response.flows || []);
    } catch (error) {
      console.error("Failed to load flows:", error);
    }
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAddNode = () => {
    setNodeDialogOpen(true);
  };

  const createNode = () => {
    if (!nodeLabel.trim()) {
      toast.error("Node label is required");
      return;
    }

    const newNode: Node = {
      id: `node-${++nodeIdCounter.current}`,
      type: nodeType,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: nodeLabel,
        description: nodeDescription || undefined,
        ...(nodeType === "technique" && nodeTechniqueId ? { techniqueId: nodeTechniqueId } : {}),
        ...(nodeType === "asset" && nodeAssetType ? { type: nodeAssetType } : {}),
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setNodeDialogOpen(false);
    resetNodeForm();
    toast.success("Node added successfully");
  };

  const resetNodeForm = () => {
    setNodeLabel("");
    setNodeDescription("");
    setNodeTechniqueId("");
    setNodeAssetType("");
  };

  const handleSaveFlow = async () => {
    if (!flowName.trim()) {
      toast.error("Flow name is required");
      return;
    }

    try {
      const flowData = {
        nodes,
        edges,
      };

      if (selectedFlow) {
        // Update existing flow
        await api.put(`/attack-flows/${selectedFlow}`, {
          name: flowName,
          description: flowDescription,
          flowData,
        });
        toast.success("Flow updated successfully");
      } else {
        // Create new flow
        const response = await api.post("/attack-flows", {
          name: flowName,
          description: flowDescription,
          operationId: operationId || null,
          flowData,
        });
        setSelectedFlow(response.id);
        toast.success("Flow saved successfully");
      }

      await loadFlows();
      setSaveDialogOpen(false);
    } catch (error) {
      console.error("Failed to save flow:", error);
      toast.error("Failed to save flow");
    }
  };

  const handleLoadFlow = (flow: any) => {
    setNodes(flow.flowData?.nodes || []);
    setEdges(flow.flowData?.edges || []);
    setSelectedFlow(flow.id);
    setFlowName(flow.name);
    setFlowDescription(flow.description || "");
    setLoadDialogOpen(false);
    toast.success(`Loaded flow: ${flow.name}`);
  };

  const handleNewFlow = () => {
    setNodes([]);
    setEdges([]);
    setSelectedFlow(null);
    setFlowName("");
    setFlowDescription("");
    toast.success("New flow created");
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm("Are you sure you want to delete this flow?")) {
      return;
    }

    try {
      await api.delete(`/attack-flows/${flowId}`);
      toast.success("Flow deleted successfully");
      await loadFlows();

      if (selectedFlow === flowId) {
        handleNewFlow();
      }
    } catch (error) {
      console.error("Failed to delete flow:", error);
      toast.error("Failed to delete flow");
    }
  };

  const handleDuplicateFlow = async (flowId: string) => {
    try {
      await api.post(`/attack-flows/${flowId}/duplicate`);
      toast.success("Flow duplicated successfully");
      await loadFlows();
    } catch (error) {
      console.error("Failed to duplicate flow:", error);
      toast.error("Failed to duplicate flow");
    }
  };

  const handleExportFlow = () => {
    const data = {
      name: flowName || "Unnamed Flow",
      description: flowDescription,
      flowData: { nodes, edges },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attack-flow-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Flow exported successfully");
  };

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
          <Button size="sm" onClick={handleNewFlow}>
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
          <Button size="sm" variant="outline" onClick={handleAddNode}>
            <Plus className="h-4 w-4 mr-2" />
            Add Node
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportFlow}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </Panel>

        {flowName && (
          <Panel position="top-right">
            <div className="bg-card px-4 py-2 rounded-lg shadow border border-border">
              <div className="font-semibold text-sm">{flowName}</div>
              {flowDescription && (
                <div className="text-xs text-muted-foreground mt-1">{flowDescription}</div>
              )}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedFlow ? "Update" : "Save"} Attack Flow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="flow-name">Flow Name *</Label>
              <Input
                id="flow-name"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="e.g., Initial Access Flow"
              />
            </div>
            <div>
              <Label htmlFor="flow-description">Description</Label>
              <Textarea
                id="flow-description"
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                placeholder="Describe the attack flow..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFlow}>
              {selectedFlow ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Attack Flow</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
            {flows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No saved flows yet. Create and save a flow to get started!
              </div>
            ) : (
              flows.map((flow) => (
                <div
                  key={flow.id}
                  className="p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{flow.name}</h3>
                      {flow.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {flow.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          {flow.flowData?.nodes?.length || 0} nodes,{" "}
                          {flow.flowData?.edges?.length || 0} edges
                        </span>
                        <span>
                          Updated {new Date(flow.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button size="sm" onClick={() => handleLoadFlow(flow)}>
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicateFlow(flow.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFlow(flow.id)}
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

      {/* Add Node Dialog */}
      <Dialog open={nodeDialogOpen} onOpenChange={setNodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Node</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="node-type">Node Type</Label>
              <Select value={nodeType} onValueChange={(v: any) => setNodeType(v)}>
                <SelectTrigger id="node-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technique">Technique</SelectItem>
                  <SelectItem value="objective">Objective</SelectItem>
                  <SelectItem value="asset">Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="node-label">Label *</Label>
              <Input
                id="node-label"
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                placeholder="e.g., Phishing"
              />
            </div>
            <div>
              <Label htmlFor="node-description">Description</Label>
              <Textarea
                id="node-description"
                value={nodeDescription}
                onChange={(e) => setNodeDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            {nodeType === "technique" && (
              <div>
                <Label htmlFor="technique-id">Technique ID</Label>
                <Input
                  id="technique-id"
                  value={nodeTechniqueId}
                  onChange={(e) => setNodeTechniqueId(e.target.value)}
                  placeholder="e.g., T1566"
                />
              </div>
            )}
            {nodeType === "asset" && (
              <div>
                <Label htmlFor="asset-type">Asset Type</Label>
                <Input
                  id="asset-type"
                  value={nodeAssetType}
                  onChange={(e) => setNodeAssetType(e.target.value)}
                  placeholder="e.g., Server, Workstation"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNodeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createNode}>Add Node</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
