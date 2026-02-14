import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Download,
  Trash2,
  Save,
  Target,
  Brain,
  Cpu,
} from "lucide-react";

interface AtlasTechniqueItem {
  id: string;
  atlasId: string;
  name: string;
  description: string | null;
  killChainPhases: string[] | null;
}

interface AtlasFlowNode extends Node {
  data: {
    label: string;
    type: "technique" | "objective" | "asset";
    techniqueId?: string;
    atlasId?: string;
    description?: string;
  };
}

interface AtlasFlow {
  id: string;
  name: string;
  description: string;
  nodes: AtlasFlowNode[];
  edges: Edge[];
  created: string;
  modified: string;
}

const nodeTypes = {
  technique: { color: "#9333ea", icon: Brain },    // purple-600
  objective: { color: "#7c3aed", icon: Target },   // violet-600
  asset: { color: "#c026d3", icon: Cpu },           // fuchsia-600
};

export default function AtlasFlowDiagram() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [techniques, setTechniques] = useState<AtlasTechniqueItem[]>([]);
  const [selectedTechnique, setSelectedTechnique] = useState<string>("");
  const [flowName, setFlowName] = useState("New ATLAS Attack Flow");
  const [flowDescription, setFlowDescription] = useState("");

  // Dialog states
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [nodeType, setNodeType] = useState<"technique" | "objective" | "asset">("technique");
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");

  // Fetch ATLAS techniques for adding as nodes
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
      // Error already shown via toast
    }
  };

  useEffect(() => {
    fetchTechniques();

    // Load saved ATLAS flow from localStorage if exists
    const saved = localStorage.getItem("atlas-flow-current");
    if (saved) {
      const flow = JSON.parse(saved) as AtlasFlow;
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setFlowName(flow.name);
      setFlowDescription(flow.description);
    }
  }, []);

  // Auto-save flow to localStorage
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const flow: AtlasFlow = {
        id: `atlas-flow-${Date.now()}`,
        name: flowName,
        description: flowDescription,
        nodes: nodes as AtlasFlowNode[],
        edges,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };
      localStorage.setItem("atlas-flow-current", JSON.stringify(flow));
    }
  }, [nodes, edges, flowName, flowDescription]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2, stroke: "#9333ea" },
          },
          eds
        )
      ),
    [setEdges]
  );

  const addNode = () => {
    let label = nodeLabel;
    let techniqueId = undefined;
    let atlasId = undefined;

    if (nodeType === "technique" && selectedTechnique) {
      const technique = techniques.find((t) => t.id === selectedTechnique);
      if (technique) {
        label = technique.name;
        techniqueId = technique.id;
        atlasId = technique.atlasId;
      }
    }

    const newNode: AtlasFlowNode = {
      id: `atlas-node-${Date.now()}`,
      type: "default",
      position: { x: Math.random() * 500, y: Math.random() * 300 },
      data: {
        label,
        type: nodeType,
        techniqueId,
        atlasId,
        description: nodeDescription,
      },
      style: {
        background: nodeTypes[nodeType].color,
        color: "white",
        border: "1px solid #222",
        borderRadius: "8px",
        padding: "10px",
        fontSize: "12px",
        fontWeight: "500",
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setAddNodeDialogOpen(false);
    setNodeLabel("");
    setNodeDescription("");
    setSelectedTechnique("");
  };

  const _clearFlow = () => {
    if (confirm("Are you sure you want to clear the entire ATLAS flow?")) {
      setNodes([]);
      setEdges([]);
      setFlowName("New ATLAS Attack Flow");
      setFlowDescription("");
      localStorage.removeItem("atlas-flow-current");
    }
  };

  const deleteSelectedNodes = () => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => {
      const sourceExists = nodes.find((n) => n.id === edge.source && !n.selected);
      const targetExists = nodes.find((n) => n.id === edge.target && !n.selected);
      return sourceExists && targetExists;
    }));
  };

  // Export to ATLAS Attack Flow JSON format
  const exportToAtlasFlow = () => {
    const atlasFlow = {
      type: "bundle",
      id: `bundle--${crypto.randomUUID()}`,
      spec_version: "2.1",
      framework: "MITRE ATLAS",
      objects: [
        {
          type: "atlas-attack-flow",
          id: `atlas-attack-flow--${crypto.randomUUID()}`,
          name: flowName,
          description: flowDescription,
          scope: "ai-ml-incident",
          start_refs: nodes
            .filter((n) => edges.every((e) => e.target !== n.id))
            .map((n) => n.id),
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        // Add action objects for each node
        ...nodes.map((node) => ({
          type: "atlas-attack-action",
          id: node.id,
          name: node.data.label,
          description: node.data.description || "",
          technique_id: node.data.atlasId || "",
          technique_ref: node.data.atlasId
            ? `https://atlas.mitre.org/techniques/${node.data.atlasId}`
            : "",
          execution_start: new Date().toISOString(),
          execution_end: new Date().toISOString(),
        })),
        // Add relationships for edges
        ...edges.map((edge) => ({
          type: "relationship",
          id: `relationship--${crypto.randomUUID()}`,
          source_ref: edge.source,
          target_ref: edge.target,
          relationship_type: "followed-by",
        })),
      ],
    };

    const blob = new Blob([JSON.stringify(atlasFlow, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flowName.replace(/\s+/g, "-").toLowerCase()}-atlas-flow.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save flow to localStorage
  const saveFlow = () => {
    const flows = JSON.parse(localStorage.getItem("atlas-flow-diagrams") || "[]");
    const flow: AtlasFlow = {
      id: `atlas-flow-${Date.now()}`,
      name: flowName,
      description: flowDescription,
      nodes: nodes as AtlasFlowNode[],
      edges,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };

    flows.push(flow);
    localStorage.setItem("atlas-flow-diagrams", JSON.stringify(flows));
    toast.success("ATLAS flow saved successfully!");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="h-5 w-5 text-purple-600" />
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">ATLAS Attack Flow</span>
              </div>
              <Input
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                placeholder="Flow name..."
              />
              <Input
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                className="text-sm text-muted-foreground border-0 p-0 h-auto mt-1 focus-visible:ring-0"
                placeholder="Description..."
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAddNodeDialogOpen(true)} className="border-purple-300">
                <Plus className="h-4 w-4 mr-2" />
                Add Node
              </Button>
              <Button size="sm" variant="outline" onClick={deleteSelectedNodes}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
              <Button size="sm" variant="outline" onClick={saveFlow} className="border-purple-300">
                <Save className="h-4 w-4 mr-2" />
                Save Flow
              </Button>
              <Button size="sm" onClick={exportToAtlasFlow} className="bg-purple-600 hover:bg-purple-700">
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Legend */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: nodeTypes.technique.color }} />
              <span className="text-sm">ATLAS Technique</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: nodeTypes.objective.color }} />
              <span className="text-sm">Objective</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: nodeTypes.asset.color }} />
              <span className="text-sm">ML Asset</span>
            </div>
            <div className="text-sm text-muted-foreground ml-auto">
              {nodes.length} nodes, {edges.length} connections
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flow Diagram */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="p-0">
          <div style={{ height: "600px" }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              attributionPosition="bottom-left"
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const n = node as AtlasFlowNode;
                  return nodeTypes[n.data.type]?.color || "#9333ea";
                }}
              />
              <Panel position="top-right" className="bg-card p-2 rounded shadow-md border border-purple-200 dark:border-purple-800">
                <div className="text-xs text-muted-foreground">
                  <p>Drag nodes to reposition</p>
                  <p>Click nodes to select</p>
                  <p>Drag from node edge to connect</p>
                  <p className="mt-1 text-purple-600 font-medium">MITRE ATLAS Framework</p>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      {/* Add Node Dialog */}
      <Dialog open={addNodeDialogOpen} onOpenChange={setAddNodeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Add Node to ATLAS Flow
            </DialogTitle>
            <DialogDescription>
              Create a new node in your ATLAS attack flow diagram
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="node-type">Node Type</Label>
              <Select value={nodeType} onValueChange={(v: any) => setNodeType(v)}>
                <SelectTrigger id="node-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technique">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-600" />
                      ATLAS Technique
                    </div>
                  </SelectItem>
                  <SelectItem value="objective">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-violet-600" />
                      Objective
                    </div>
                  </SelectItem>
                  <SelectItem value="asset">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-fuchsia-600" />
                      ML Asset
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {nodeType === "technique" ? (
              <div>
                <Label htmlFor="technique">Select ATLAS Technique</Label>
                <Select value={selectedTechnique} onValueChange={setSelectedTechnique}>
                  <SelectTrigger id="technique">
                    <SelectValue placeholder="Choose an ATLAS technique..." />
                  </SelectTrigger>
                  <SelectContent>
                    {techniques.slice(0, 100).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs border-purple-300 text-purple-700">
                            {t.atlasId}
                          </Badge>
                          <span className="truncate">{t.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label htmlFor="node-label">Label</Label>
                <Input
                  id="node-label"
                  value={nodeLabel}
                  onChange={(e) => setNodeLabel(e.target.value)}
                  placeholder={
                    nodeType === "objective"
                      ? "e.g., Extract proprietary ML model"
                      : "e.g., Production inference API"
                  }
                />
              </div>
            )}

            <div>
              <Label htmlFor="node-desc">Description (Optional)</Label>
              <Input
                id="node-desc"
                value={nodeDescription}
                onChange={(e) => setNodeDescription(e.target.value)}
                placeholder="Additional details..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNodeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={addNode}
              disabled={
                nodeType === "technique"
                  ? !selectedTechnique
                  : !nodeLabel
              }
              className="bg-purple-600 hover:bg-purple-700"
            >
              Add Node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
