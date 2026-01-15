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
  Database,
  Shield,
} from "lucide-react";
import type { Technique } from "@shared/types/attack";

interface AttackFlowNode extends Node {
  data: {
    label: string;
    type: "technique" | "objective" | "asset";
    techniqueId?: string;
    attackId?: string;
    description?: string;
  };
}

interface AttackFlow {
  id: string;
  name: string;
  description: string;
  nodes: AttackFlowNode[];
  edges: Edge[];
  created: string;
  modified: string;
}

const nodeTypes = {
  technique: { color: "#3b82f6", icon: Shield },
  objective: { color: "#10b981", icon: Target },
  asset: { color: "#f59e0b", icon: Database },
};

export default function AttackFlowDiagram() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [selectedTechnique, setSelectedTechnique] = useState<string>("");
  const [flowName, setFlowName] = useState("New Attack Flow");
  const [flowDescription, setFlowDescription] = useState("");

  // Dialog states
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [nodeType, setNodeType] = useState<"technique" | "objective" | "asset">("technique");
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");

  // Fetch techniques for adding as nodes
  const fetchTechniques = async () => {
    try {
      const response = await fetch("/api/v1/attack/techniques?subtechniques=exclude", {
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

    // Load saved flow from localStorage if exists
    const saved = localStorage.getItem("attack-flow-current");
    if (saved) {
      const flow = JSON.parse(saved) as AttackFlow;
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setFlowName(flow.name);
      setFlowDescription(flow.description);
    }
  }, []);

  // Auto-save flow to localStorage
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const flow: AttackFlow = {
        id: `flow-${Date.now()}`,
        name: flowName,
        description: flowDescription,
        nodes: nodes as AttackFlowNode[],
        edges,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };
      localStorage.setItem("attack-flow-current", JSON.stringify(flow));
    }
  }, [nodes, edges, flowName, flowDescription]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  );

  const addNode = () => {
    let label = nodeLabel;
    let techniqueId = undefined;
    let attackId = undefined;

    if (nodeType === "technique" && selectedTechnique) {
      const technique = techniques.find((t) => t.id === selectedTechnique);
      if (technique) {
        label = technique.name;
        techniqueId = technique.id;
        attackId = technique.attackId;
      }
    }

    const newNode: AttackFlowNode = {
      id: `node-${Date.now()}`,
      type: "default",
      position: { x: Math.random() * 500, y: Math.random() * 300 },
      data: {
        label,
        type: nodeType,
        techniqueId,
        attackId,
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
    if (confirm("Are you sure you want to clear the entire flow?")) {
      setNodes([]);
      setEdges([]);
      setFlowName("New Attack Flow");
      setFlowDescription("");
      localStorage.removeItem("attack-flow-current");
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

  // Export to Attack Flow JSON format
  const exportToAttackFlow = () => {
    const attackFlow = {
      type: "bundle",
      id: `bundle--${crypto.randomUUID()}`,
      spec_version: "2.1",
      objects: [
        {
          type: "attack-flow",
          id: `attack-flow--${crypto.randomUUID()}`,
          name: flowName,
          description: flowDescription,
          scope: "incident",
          start_refs: nodes
            .filter((n) => edges.every((e) => e.target !== n.id))
            .map((n) => n.id),
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        // Add action objects for each node
        ...nodes.map((node) => ({
          type: "attack-action",
          id: node.id,
          name: node.data.label,
          description: node.data.description || "",
          technique_id: node.data.attackId || "",
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

    const blob = new Blob([JSON.stringify(attackFlow, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flowName.replace(/\s+/g, "-").toLowerCase()}-attack-flow.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export as image (using html2canvas would be ideal, but for now just the JSON)
  const saveFlow = () => {
    const flows = JSON.parse(localStorage.getItem("attack-flows") || "[]");
    const flow: AttackFlow = {
      id: `flow-${Date.now()}`,
      name: flowName,
      description: flowDescription,
      nodes: nodes as AttackFlowNode[],
      edges,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };

    flows.push(flow);
    localStorage.setItem("attack-flows", JSON.stringify(flows));
    toast.success("Flow saved successfully!");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
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
              <Button size="sm" variant="outline" onClick={() => setAddNodeDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Node
              </Button>
              <Button size="sm" variant="outline" onClick={deleteSelectedNodes}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
              <Button size="sm" variant="outline" onClick={saveFlow}>
                <Save className="h-4 w-4 mr-2" />
                Save Flow
              </Button>
              <Button size="sm" onClick={exportToAttackFlow}>
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: nodeTypes.technique.color }} />
              <span className="text-sm">Technique</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: nodeTypes.objective.color }} />
              <span className="text-sm">Objective</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: nodeTypes.asset.color }} />
              <span className="text-sm">Asset</span>
            </div>
            <div className="text-sm text-muted-foreground ml-auto">
              {nodes.length} nodes, {edges.length} connections
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flow Diagram */}
      <Card>
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
                  const n = node as AttackFlowNode;
                  return nodeTypes[n.data.type].color;
                }}
              />
              <Panel position="top-right" className="bg-card p-2 rounded shadow-md">
                <div className="text-xs text-muted-foreground">
                  <p>• Drag nodes to reposition</p>
                  <p>• Click nodes to select</p>
                  <p>• Drag from node edge to create connection</p>
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
            <DialogTitle>Add Node to Flow</DialogTitle>
            <DialogDescription>
              Create a new node in your attack flow diagram
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
                      <Shield className="h-4 w-4" />
                      Technique
                    </div>
                  </SelectItem>
                  <SelectItem value="objective">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Objective
                    </div>
                  </SelectItem>
                  <SelectItem value="asset">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Asset
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {nodeType === "technique" ? (
              <div>
                <Label htmlFor="technique">Select Technique</Label>
                <Select value={selectedTechnique} onValueChange={setSelectedTechnique}>
                  <SelectTrigger id="technique">
                    <SelectValue placeholder="Choose a technique..." />
                  </SelectTrigger>
                  <SelectContent>
                    {techniques.slice(0, 100).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {t.attackId}
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
                      ? "e.g., Gain initial access"
                      : "e.g., Domain controller"
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
            >
              Add Node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
