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
  Trash2,
  Copy,
  Brain,
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
import { toast } from "sonner";

interface AtlasFlowBuilderProps {
  operationId?: string;
}

interface AtlasTechniqueItem {
  id: string;
  atlasId: string;
  name: string;
  description: string | null;
  killChainPhases: string[] | null;
}

interface SavedFlow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  created: string;
  modified: string;
}

// Custom node types for ATLAS Flow Builder
const nodeTypes = {
  technique: AtlasTechniqueNode,
  objective: AtlasObjectiveNode,
  asset: AtlasAssetNode,
};

function AtlasTechniqueNode({ data }: any) {
  return (
    <Card className="p-3 min-w-[200px] border-2 border-purple-500 bg-purple-50 dark:bg-purple-950">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="h-4 w-4 text-purple-600" />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      {data.techniqueId && (
        <div className="text-xs text-purple-600 dark:text-purple-400 font-mono">{data.techniqueId}</div>
      )}
      {data.description && (
        <div className="text-xs mt-2 text-muted-foreground line-clamp-2">
          {data.description}
        </div>
      )}
    </Card>
  );
}

function AtlasObjectiveNode({ data }: any) {
  return (
    <Card className="p-3 min-w-[200px] border-2 border-violet-500 bg-violet-50 dark:bg-violet-950">
      <div className="font-semibold text-sm mb-1">Target: {data.label}</div>
      {data.description && (
        <div className="text-xs mt-2 text-muted-foreground line-clamp-2">
          {data.description}
        </div>
      )}
    </Card>
  );
}

function AtlasAssetNode({ data }: any) {
  return (
    <Card className="p-3 min-w-[200px] border-2 border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950">
      <div className="font-semibold text-sm mb-1">ML Asset: {data.label}</div>
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

export default function AtlasFlowBuilder({ operationId }: AtlasFlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [techniques, setTechniques] = useState<AtlasTechniqueItem[]>([]);
  const [flows, setFlows] = useState<SavedFlow[]>([]);
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

  // Fetch ATLAS techniques
  const fetchTechniques = async () => {
    try {
      const response = await fetch("/api/v1/atlas/techniques?subtechniques=exclude", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTechniques(data);
      }
    } catch (error) {
      console.error("Failed to load ATLAS techniques:", error);
    }
  };

  useEffect(() => {
    fetchTechniques();
    loadFlows();
  }, [operationId]);

  // Load saved flows from localStorage (future: ATLAS flows API)
  const loadFlows = () => {
    try {
      const stored = localStorage.getItem("atlas-flows");
      if (stored) {
        const parsed = JSON.parse(stored);
        setFlows(parsed);
      }
    } catch (error) {
      console.error("Failed to load ATLAS flows:", error);
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
      id: `atlas-node-${++nodeIdCounter.current}`,
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
    toast.success("ATLAS node added successfully");
  };

  const resetNodeForm = () => {
    setNodeLabel("");
    setNodeDescription("");
    setNodeTechniqueId("");
    setNodeAssetType("");
  };

  // Save flow to localStorage (future: ATLAS flows API)
  const handleSaveFlow = () => {
    if (!flowName.trim()) {
      toast.error("Flow name is required");
      return;
    }

    const flowData: SavedFlow = {
      id: selectedFlow || `atlas-flow-${Date.now()}`,
      name: flowName,
      description: flowDescription,
      nodes,
      edges,
      created: selectedFlow
        ? flows.find((f) => f.id === selectedFlow)?.created || new Date().toISOString()
        : new Date().toISOString(),
      modified: new Date().toISOString(),
    };

    let updatedFlows: SavedFlow[];
    if (selectedFlow) {
      updatedFlows = flows.map((f) => (f.id === selectedFlow ? flowData : f));
      toast.success("ATLAS flow updated successfully");
    } else {
      updatedFlows = [...flows, flowData];
      setSelectedFlow(flowData.id);
      toast.success("ATLAS flow saved successfully");
    }

    setFlows(updatedFlows);
    localStorage.setItem("atlas-flows", JSON.stringify(updatedFlows));
    setSaveDialogOpen(false);
  };

  const handleLoadFlow = (flow: SavedFlow) => {
    setNodes(flow.nodes || []);
    setEdges(flow.edges || []);
    setSelectedFlow(flow.id);
    setFlowName(flow.name);
    setFlowDescription(flow.description || "");
    setLoadDialogOpen(false);
    toast.success(`Loaded ATLAS flow: ${flow.name}`);
  };

  const handleNewFlow = () => {
    setNodes([]);
    setEdges([]);
    setSelectedFlow(null);
    setFlowName("");
    setFlowDescription("");
    toast.success("New ATLAS flow created");
  };

  const handleDeleteFlow = (flowId: string) => {
    if (!confirm("Are you sure you want to delete this ATLAS flow?")) {
      return;
    }

    const updatedFlows = flows.filter((f) => f.id !== flowId);
    setFlows(updatedFlows);
    localStorage.setItem("atlas-flows", JSON.stringify(updatedFlows));
    toast.success("ATLAS flow deleted successfully");

    if (selectedFlow === flowId) {
      handleNewFlow();
    }
  };

  const handleDuplicateFlow = (flowId: string) => {
    const flow = flows.find((f) => f.id === flowId);
    if (!flow) return;

    const duplicated: SavedFlow = {
      ...flow,
      id: `atlas-flow-${Date.now()}`,
      name: `${flow.name} (Copy)`,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };

    const updatedFlows = [...flows, duplicated];
    setFlows(updatedFlows);
    localStorage.setItem("atlas-flows", JSON.stringify(updatedFlows));
    toast.success("ATLAS flow duplicated successfully");
  };

  const handleExportFlow = () => {
    const data = {
      type: "atlas-flow",
      name: flowName || "Unnamed ATLAS Flow",
      description: flowDescription,
      flowData: { nodes, edges },
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atlas-flow-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("ATLAS flow exported successfully");
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
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case "technique":
                return "#9333ea"; // purple-600
              case "objective":
                return "#7c3aed"; // violet-600
              case "asset":
                return "#c026d3"; // fuchsia-600
              default:
                return "#9333ea";
            }
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

        <Panel position="top-left" className="space-x-2">
          <Button size="sm" onClick={handleNewFlow} className="bg-purple-600 hover:bg-purple-700">
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
            <div className="bg-card px-4 py-2 rounded-lg shadow border border-purple-200 dark:border-purple-800">
              <div className="font-semibold text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                {flowName}
              </div>
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
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              {selectedFlow ? "Update" : "Save"} ATLAS Flow
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="flow-name">Flow Name *</Label>
              <Input
                id="flow-name"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="e.g., ML Model Extraction Flow"
              />
            </div>
            <div>
              <Label htmlFor="flow-description">Description</Label>
              <Textarea
                id="flow-description"
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                placeholder="Describe the ATLAS attack flow..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFlow} className="bg-purple-600 hover:bg-purple-700">
              {selectedFlow ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Load ATLAS Flow
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
            {flows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No saved ATLAS flows yet. Create and save a flow to get started!
              </div>
            ) : (
              flows.map((flow) => (
                <div
                  key={flow.id}
                  className="p-4 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-colors"
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
                          {flow.nodes?.length || 0} nodes,{" "}
                          {flow.edges?.length || 0} edges
                        </span>
                        <span>
                          Updated {new Date(flow.modified).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button size="sm" onClick={() => handleLoadFlow(flow)} className="bg-purple-600 hover:bg-purple-700">
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
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Add ATLAS Node
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="node-type">Node Type</Label>
              <Select value={nodeType} onValueChange={(v: any) => setNodeType(v)}>
                <SelectTrigger id="node-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technique">ATLAS Technique</SelectItem>
                  <SelectItem value="objective">Objective</SelectItem>
                  <SelectItem value="asset">ML Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="node-label">Label *</Label>
              <Input
                id="node-label"
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                placeholder={
                  nodeType === "technique"
                    ? "e.g., Model Poisoning"
                    : nodeType === "objective"
                    ? "e.g., Exfiltrate ML model"
                    : "e.g., Production ML Pipeline"
                }
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
                <Label htmlFor="technique-id">ATLAS Technique ID</Label>
                <Input
                  id="technique-id"
                  value={nodeTechniqueId}
                  onChange={(e) => setNodeTechniqueId(e.target.value)}
                  placeholder="e.g., AML.T0000"
                />
                {techniques.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Or select from catalog:</Label>
                    <Select
                      value=""
                      onValueChange={(v) => {
                        const t = techniques.find((tech) => tech.id === v);
                        if (t) {
                          setNodeLabel(t.name);
                          setNodeTechniqueId(t.atlasId);
                          if (t.description) setNodeDescription(t.description);
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select ATLAS technique..." />
                      </SelectTrigger>
                      <SelectContent>
                        {techniques.slice(0, 100).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="font-mono text-xs text-purple-600 mr-2">{t.atlasId}</span>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            {nodeType === "asset" && (
              <div>
                <Label htmlFor="asset-type">ML Asset Type</Label>
                <Input
                  id="asset-type"
                  value={nodeAssetType}
                  onChange={(e) => setNodeAssetType(e.target.value)}
                  placeholder="e.g., ML Model, Training Data, Inference API"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNodeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createNode} className="bg-purple-600 hover:bg-purple-700">
              Add Node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
