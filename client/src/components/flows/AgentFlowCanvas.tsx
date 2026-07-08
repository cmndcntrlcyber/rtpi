import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import ReactFlow, {
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Connection,
  Edge,
  Node,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { Save, Plus, Play, CheckCircle2, Repeat, Trash2, X, Search, ChevronRight, Sparkles, Loader2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useFlowPalette, PaletteAgent, PaletteSkill } from "@/hooks/useFlowPalette";
import { useWorkflowTemplates } from "@/hooks/useWorkflowTemplates";
import { useOperations } from "@/hooks/useOperations";
import { useTargets } from "@/hooks/useTargets";
import { useAgentWebSocket } from "@/hooks/useAgentWebSocket";
import { flowNodeTypes } from "./nodes";
import { portTypeOf } from "./nodes/portTypes";

interface AgentFlowCanvasProps {
  templateId: string | null;
  onSelectTemplate: (id: string | null) => void;
}

const LOOP_EXIT_CONDITIONS = ["functional_poc", "vulnerability_confirmed", "exploit_successful"];
const TRIGGER_EVENTS = ["manual", "operation_created", "scan_complete"];
const CONDITION_TYPES = ["context_has", "context_equals", "capability_available", "custom"];

const HANDOFF_COLOR = "#f43f5e"; // rose — matches the handoff port type

/**
 * Apply the rose, animated, arrow-headed styling that marks an edge as a
 * "handoff" (one agent delegating control + its output to the next). Sequence /
 * data / mcp / loop edges keep React Flow's default look. Idempotent — safe to
 * run over already-styled edges on reload.
 */
function styleEdge(edge: Edge): Edge {
  if (edge.data?.portType !== "handoff") return edge;
  const label = edge.data?.handoff?.condition?.expression
    ? `handoff if: ${edge.data.handoff.condition.expression}`
    : "handoff";
  return {
    ...edge,
    animated: true,
    label,
    labelStyle: { fill: HANDOFF_COLOR, fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: "var(--background, #fff)", fillOpacity: 0.85 },
    markerEnd: { type: MarkerType.ArrowClosed, color: HANDOFF_COLOR },
    style: { stroke: HANDOFF_COLOR, strokeWidth: 2 },
  };
}

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idSeq++}`;

function InnerCanvas({ templateId, onSelectTemplate }: AgentFlowCanvasProps) {
  const { palette, refetch: refetchPalette } = useFlowPalette();
  const { templates, createTemplate, refetch: refetchTemplates } = useWorkflowTemplates();
  const { operations } = useOperations();
  const { targets } = useTargets();
  const { project } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [dirty, setDirty] = useState(false);

  // Run / live execution
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runOperationId, setRunOperationId] = useState<string>("");
  const [runInstanceId, setRunInstanceId] = useState<string | null>(null);
  const { events, pendingApprovals, approve, deny } = useAgentWebSocket({
    subscriptions: runOperationId ? [runOperationId] : [],
  });

  // Live sync: when agent/workflow activity streams over the WebSocket, refresh the
  // palette (agent statuses, newly-discovered tools/MCP servers) and templates so the
  // builder reflects backend state as it changes — on top of the palette's own polling.
  // Debounced so bursts of execution events coalesce into a single refresh.
  const latestEventId = events.length ? events[events.length - 1].eventId : null;
  const liveRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!latestEventId) return;
    if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current);
    liveRefreshTimer.current = setTimeout(() => {
      refetchPalette();
      refetchTemplates();
    }, 1500);
    return () => {
      if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current);
    };
  }, [latestEventId, refetchPalette, refetchTemplates]);

  // ---- New-template dialog ----
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) || null,
    [edges, selectedEdgeId],
  );

  // ------------------------------------------------------------------ load
  const loadGraph = useCallback(
    async (tid: string | null) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setDirty(false);
      if (!tid) {
        setNodes([]);
        setEdges([]);
        return;
      }
      try {
        const res = await api.get<{ flowGraph: { nodes: Node[]; edges: Edge[] } }>(
          `/agent-flows/${tid}/graph`,
        );
        setNodes(res.flowGraph?.nodes || []);
        setEdges((res.flowGraph?.edges || []).map(styleEdge));
      } catch (err) {
        toast.error("Failed to load flow graph");
      }
    },
    [setNodes, setEdges],
  );

  useEffect(() => {
    // Defer to the next tick so the load's state updates never run synchronously
    // inside this effect; also cancels in-flight loads on rapid template switches.
    const id = setTimeout(() => loadGraph(templateId), 0);
    return () => clearTimeout(id);
  }, [templateId, loadGraph]);

  // ------------------------------------------------------------- connection
  const isValidConnection = useCallback((conn: Connection) => {
    const s = portTypeOf(conn.sourceHandle);
    const t = portTypeOf(conn.targetHandle);
    if (!s || !t) return true; // unlabeled handles: allow
    return s === t;
  }, []);

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      const pt = portTypeOf((params as Connection).sourceHandle);
      const data =
        pt === "handoff"
          ? { portType: pt, handoff: { condition: null } as Record<string, any> }
          : { portType: pt };
      setEdges((eds) => addEdge(styleEdge({ ...params, data } as Edge), eds));
      setDirty(true);
    },
    [setEdges],
  );

  // ------------------------------------------------------------- drag & drop
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/rtpi-flow-node");
      if (!raw) return;
      const payload = JSON.parse(raw);
      const bounds = wrapperRef.current?.getBoundingClientRect();
      const position = project({
        x: e.clientX - (bounds?.left ?? 0),
        y: e.clientY - (bounds?.top ?? 0),
      });
      setNodes((nds) => [...nds, { ...payload.node, id: nextId(payload.idPrefix), position }]);
      setDirty(true);
    },
    [project, setNodes],
  );

  // palette → node templates
  const makePaletteItem = (
    idPrefix: string,
    node: Omit<Node, "id" | "position">,
  ) => ({ idPrefix, node: { ...node, position: { x: 0, y: 0 } } });

  const onPaletteDragStart = (e: React.DragEvent, item: any) => {
    e.dataTransfer.setData("application/rtpi-flow-node", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
  };

  // ---------------------------------------------------------------- node data
  const updateNodeData = useCallback(
    (nodeId: string, patch: Record<string, any>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
      setDirty(true);
    },
    [setNodes],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    setDirty(true);
  }, [selectedNodeId, setNodes, setEdges]);

  // Patch a handoff edge's data (e.g. its run-condition) and re-apply styling so
  // the on-canvas label reflects the new condition immediately.
  const updateEdgeData = useCallback(
    (edgeId: string, patch: Record<string, any>) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId ? styleEdge({ ...e, data: { ...e.data, ...patch } }) : e,
        ),
      );
      setDirty(true);
    },
    [setEdges],
  );

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    setDirty(true);
  }, [selectedEdgeId, setEdges]);

  // --------------------------------------------------------------- Add To Loop
  const addAgentToLoop = useCallback(
    (agentNode: Node) => {
      const agentId = agentNode.data?.agentId;
      if (!agentId) return;
      setNodes((nds) => {
        let loop = nds.find((n) => n.type === "loopNode");
        let next = [...nds];
        if (!loop) {
          loop = {
            id: nextId("loop"),
            type: "loopNode",
            position: { x: (agentNode.position?.x ?? 0) + 280, y: (agentNode.position?.y ?? 0) + 120 },
            data: { label: "Analysis Loop", agentIds: [], maxIterations: 5, exitCondition: "functional_poc" },
          } as Node;
          next = [...next, loop];
        }
        const ids: string[] = Array.isArray(loop.data?.agentIds) ? loop.data.agentIds : [];
        const newIds = ids.includes(agentId) ? ids : [...ids, agentId];
        next = next.map((n) => {
          if (n.id === loop!.id) return { ...n, data: { ...n.data, agentIds: newIds } };
          if (n.id === agentNode.id) return { ...n, data: { ...n.data, loopAgentIds: newIds } };
          return n;
        });
        // connect loop -> agent (loop port)
        setEdges((eds) => {
          const exists = eds.some(
            (e) => e.source === loop!.id && e.target === agentNode.id && e.targetHandle === "loop-in",
          );
          if (exists) return eds;
          return addEdge(
            {
              id: nextId("e"),
              source: loop!.id,
              sourceHandle: "loop-out",
              target: agentNode.id,
              targetHandle: "loop-in",
              data: { portType: "loop" },
            } as Edge,
            eds,
          );
        });
        return next;
      });
      setDirty(true);
      toast.success("Added agent to analysis loop");
    },
    [setNodes, setEdges],
  );

  // ------------------------------------------------------------------ persist
  const handleSave = useCallback(async () => {
    if (!templateId) {
      toast.error("Select or create a workflow first");
      return;
    }
    try {
      const flowGraph = { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } };
      const res = await api.patch<{ agentCount: number }>(
        `/agent-flows/${templateId}/graph`,
        { flowGraph },
      );
      setDirty(false);
      await refetchTemplates();
      toast.success(`Saved (${res.agentCount} agent${res.agentCount === 1 ? "" : "s"} in workflow)`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save flow");
    }
  }, [templateId, nodes, edges, refetchTemplates]);

  const handleValidate = useCallback(async () => {
    if (!templateId) return;
    try {
      const res = await api.post<{ valid: boolean; issues: any[] }>(
        `/agent-flows/${templateId}/validate`,
        { flowGraph: { nodes, edges } },
      );
      const byNode = new Map(res.issues.map((i) => [i.nodeId, i]));
      setNodes((nds) =>
        nds.map((n) =>
          byNode.has(n.id)
            ? { ...n, data: { ...n.data, invalid: true, invalidReason: byNode.get(n.id)!.kind } }
            : { ...n, data: { ...n.data, invalid: false, invalidReason: undefined } },
        ),
      );
      toast[res.valid ? "success" : "error"](
        res.valid ? "Flow is valid" : `${res.issues.length} issue(s) found`,
      );
    } catch {
      toast.error("Validation failed");
    }
  }, [templateId, nodes, edges, setNodes]);

  // -------------------------------------------------------------------- run
  const startRun = useCallback(async () => {
    if (!templateId || !runOperationId) {
      toast.error("Select an operation to run against");
      return;
    }
    try {
      if (dirty) await handleSave();
      const res = await api.post<{ workflowId: string }>("/agents/workflows/execute", {
        templateId,
        operationId: runOperationId,
      });
      setRunInstanceId(res.workflowId);
      setRunDialogOpen(false);
      toast.success("Workflow started");
    } catch (err: any) {
      toast.error(err?.message || "Failed to start workflow");
    }
  }, [templateId, runOperationId, dirty, handleSave]);

  // poll instance state → color agent nodes by status
  useEffect(() => {
    if (!runInstanceId) return;
    let stop = false;
    const tick = async () => {
      try {
        const state = await api.get<{ status: string; agents: any[] }>(
          `/agent-flows/instances/${runInstanceId}/state`,
        );
        const statusByAgent = new Map((state.agents || []).map((a) => [a.agentId, a.status]));
        setNodes((nds) =>
          nds.map((n) =>
            n.type === "agentNode" && n.data?.agentId && statusByAgent.has(n.data.agentId)
              ? { ...n, data: { ...n.data, status: statusByAgent.get(n.data.agentId) } }
              : n,
          ),
        );
        if (["completed", "failed", "cancelled"].includes(state.status)) {
          stop = true;
          toast(`Workflow ${state.status}`);
        }
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const interval = setInterval(() => {
      if (stop) clearInterval(interval);
      else void tick();
    }, 2000);
    return () => clearInterval(interval);
  }, [runInstanceId, setNodes]);

  // ----------------------------------------------------------- palette render
  const filteredAgents = palette.agents.filter((a) =>
    a.name.toLowerCase().includes(paletteQuery.toLowerCase()),
  );
  const filteredServers = palette.mcpServers.filter((s) =>
    s.name.toLowerCase().includes(paletteQuery.toLowerCase()),
  );
  const filteredTools = palette.securityTools.filter((t) =>
    t.name.toLowerCase().includes(paletteQuery.toLowerCase()),
  );
  const filteredSkills = palette.skills.filter((s) =>
    s.name.toLowerCase().includes(paletteQuery.toLowerCase()),
  );

  const agentPaletteItem = (a: PaletteAgent) =>
    makePaletteItem("agent", {
      type: "agentNode",
      data: { agentId: a.id, label: a.name, agentType: a.type, status: a.status, config: a.config || {} },
    });
  const serverPaletteItem = (s: any) =>
    makePaletteItem("mcp", {
      type: "mcpServerNode",
      data: { serverId: s.id, label: s.name, status: s.status },
    });
  const toolPaletteItem = (t: any) =>
    makePaletteItem("tool", {
      type: "securityToolNode",
      data: { toolId: t.id, label: t.name, category: t.category, command: t.command },
    });
  const skillPaletteItem = (s: PaletteSkill) =>
    makePaletteItem("skill", {
      type: "skillNode",
      data: { skillId: s.id, label: s.name, skillKind: s.kind, summary: s.summary },
    });
  const triggerPaletteItem = makePaletteItem("trigger", {
    type: "triggerNode",
    data: { label: "Trigger", event: "manual" },
  });
  const conditionPaletteItem = makePaletteItem("cond", {
    type: "conditionNode",
    data: { label: "Condition", conditionType: "context_has", field: "", operator: "exists", value: "" },
  });

  return (
    <div className="flex h-[calc(100vh-360px)] min-h-[460px] w-full border border-border rounded-lg overflow-hidden">
      {/* ---------------------------------------------------- left palette */}
      <div className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              placeholder="Search palette…"
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
          <PaletteGroup title="Logic" count={2}>
            <PaletteChip label="Trigger" color="amber" onDragStart={(e) => onPaletteDragStart(e, triggerPaletteItem)} />
            <PaletteChip label="Condition" color="amber" onDragStart={(e) => onPaletteDragStart(e, conditionPaletteItem)} />
          </PaletteGroup>
          <PaletteGroup title="Agents" count={filteredAgents.length}>
            {filteredAgents.slice(0, 60).map((a) => (
              <PaletteChip key={a.id} label={a.name} color="blue" onDragStart={(e) => onPaletteDragStart(e, agentPaletteItem(a))} />
            ))}
          </PaletteGroup>
          <PaletteGroup title="MCP Servers" count={filteredServers.length}>
            {filteredServers.map((s) => (
              <PaletteChip key={s.id} label={s.name} color="emerald" onDragStart={(e) => onPaletteDragStart(e, serverPaletteItem(s))} />
            ))}
          </PaletteGroup>
          <PaletteGroup title="Tools" count={filteredTools.length}>
            {filteredTools.slice(0, 60).map((t) => (
              <PaletteChip key={t.id} label={t.name} color="indigo" onDragStart={(e) => onPaletteDragStart(e, toolPaletteItem(t))} />
            ))}
          </PaletteGroup>
          <PaletteGroup title="Skills" count={filteredSkills.length}>
            {filteredSkills.slice(0, 80).map((s) => (
              <PaletteChip key={s.id} label={s.name} color="teal" title={s.summary} onDragStart={(e) => onPaletteDragStart(e, skillPaletteItem(s))} />
            ))}
          </PaletteGroup>
        </div>
      </div>

      {/* ---------------------------------------------------------- canvas */}
      <div className="flex-1 relative" ref={wrapperRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          nodeTypes={flowNodeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={(_, n) => {
            setSelectedNodeId(n.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_, e) => {
            setSelectedEdgeId(e.id);
            setSelectedNodeId(null);
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
          fitView
        >
          <Controls />
          <MiniMap pannable zoomable />
          <Background variant={BackgroundVariant.Dots} gap={14} size={1} />

          <Panel position="top-left" className="flex items-center gap-2">
            <Select value={templateId ?? ""} onValueChange={(v) => onSelectTemplate(v || null)}>
              <SelectTrigger className="h-8 w-52 text-xs bg-card">
                <SelectValue placeholder="Select workflow…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />New
            </Button>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={!templateId}>
              <Save className="h-4 w-4 mr-1" />Save{dirty ? " *" : ""}
            </Button>
            <Button size="sm" variant="outline" onClick={handleValidate} disabled={!templateId}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Validate
            </Button>
            <Button size="sm" onClick={() => setRunDialogOpen(true)} disabled={!templateId}>
              <Play className="h-4 w-4 mr-1" />Run
            </Button>
          </Panel>
        </ReactFlow>

        {/* ----------------------------------------- inline config panel */}
        {selectedNode && (
          <Card className="absolute top-2 right-2 w-72 max-h-[calc(100%-1rem)] overflow-y-auto p-3 shadow-lg z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">{selectedNode.data?.label || selectedNode.type}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={deleteSelected} title="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedNodeId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <NodeConfig
              node={selectedNode}
              targets={targets}
              onChange={(patch) => updateNodeData(selectedNode.id, patch)}
              onAddToLoop={() => addAgentToLoop(selectedNode)}
            />
          </Card>
        )}

        {/* ------------------------------------------- edge (handoff) config */}
        {!selectedNode && selectedEdge && selectedEdge.data?.portType === "handoff" && (
          <Card className="absolute top-2 right-2 w-72 p-3 shadow-lg z-10 border-rose-400">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm flex items-center gap-1">
                <ArrowRightLeft className="h-4 w-4 text-rose-500" />
                Handoff
              </span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={deleteSelectedEdge} title="Remove handoff">
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedEdgeId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <HandoffEdgeConfig
              edge={selectedEdge}
              nodes={nodes}
              onChange={(patch) => updateEdgeData(selectedEdge.id, patch)}
            />
          </Card>
        )}

        {/* approval gate (from WS) */}
        {pendingApprovals.length > 0 && (
          <Card className="absolute bottom-2 right-2 w-80 p-3 shadow-lg z-10 border-amber-400">
            <div className="font-semibold text-sm mb-1 flex items-center gap-1">
              <Repeat className="h-4 w-4" /> Approval required
            </div>
            {pendingApprovals.slice(0, 1).map((a) => (
              <div key={a.approvalId} className="text-xs space-y-2">
                <div className="text-muted-foreground line-clamp-3">
                  <span className="font-mono">{a.tool}</span>
                  {a.reason ? ` — ${a.reason}` : ""}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve(a.approvalId)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => deny(a.approvalId)}>Deny</Button>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* live event ticker */}
        {runInstanceId && events.length > 0 && (
          <div className="absolute bottom-2 left-2 max-w-[60%] text-[11px] bg-card/90 border border-border rounded px-2 py-1 z-10">
            <span className="text-muted-foreground">last: </span>
            {events[events.length - 1]?.type} — {events[events.length - 1]?.agentName || ""}
          </div>
        )}
      </div>

      {/* run dialog */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Run Workflow</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Operation</Label>
              <Select value={runOperationId} onValueChange={setRunOperationId}>
                <SelectTrigger><SelectValue placeholder="Select operation" /></SelectTrigger>
                <SelectContent>
                  {operations.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>Cancel</Button>
            <Button onClick={startRun}><Play className="h-4 w-4 mr-1" />Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* new template dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Workflow</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Recon → Exploit" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!newName.trim()) return;
                const t = await createTemplate({ name: newName.trim(), agents: [] });
                setNewName("");
                setNewOpen(false);
                onSelectTemplate(t.id);
                toast.success("Workflow created");
              }}
            >Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --------------------------------------------------------------------------
// Collapsible palette category. Each group is an independent toggle dropdown;
// expanded by default. Empty groups still render so users see the count is 0.
function PaletteGroup({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-1.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-secondary/50 rounded"
        aria-expanded={open}
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="flex-1 text-left">{title}</span>
        <span className="text-muted-foreground/70">{count}</span>
      </button>
      {open && <div className="space-y-1 px-1.5 pb-1.5 pt-0.5">{children}</div>}
    </div>
  );
}

const CHIP_COLORS: Record<string, string> = {
  blue: "border-blue-400 bg-blue-50 dark:bg-blue-950",
  emerald: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950",
  indigo: "border-indigo-400 bg-indigo-50 dark:bg-indigo-950",
  amber: "border-amber-400 bg-amber-50 dark:bg-amber-950",
  teal: "border-teal-400 bg-teal-50 dark:bg-teal-950",
};
function PaletteChip({
  label,
  color,
  title,
  onDragStart,
}: {
  label: string;
  color: string;
  title?: string;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`cursor-grab active:cursor-grabbing border rounded px-2 py-1 truncate ${CHIP_COLORS[color]}`}
      title={title ?? label}
    >
      {label}
    </div>
  );
}

// --------------------------------------------------------------------------
function NodeConfig({
  node,
  targets,
  onChange,
  onAddToLoop,
}: {
  node: Node;
  targets: any[];
  onChange: (patch: Record<string, any>) => void;
  onAddToLoop: () => void;
}) {
  const d = node.data || {};
  // Loading flag for the "Generate" system-prompt action. Declared before any
  // conditional return so the hook order stays stable across node types.
  const [genLoading, setGenLoading] = useState(false);

  // Expand the agent's system prompt with the default model, using the agent
  // name + whatever the user has already written as the seed. Reuses the
  // existing POST /agents/generate-prompt endpoint.
  const generateSystemPrompt = async () => {
    const name = d.label || "Agent";
    const draft = (d.config?.systemPrompt || "").trim();
    setGenLoading(true);
    try {
      const res = await api.post<{ prompt: string }>("/agents/generate-prompt", {
        description:
          `Agent name: ${name}.\n` +
          `Agent type: ${d.agentType || "anthropic"}.\n` +
          `Role / intent provided by the user:\n` +
          (draft || "(none provided — infer a sensible role from the agent name)"),
        agentType: d.agentType || "anthropic",
      });
      onChange({ config: { ...(d.config || {}), systemPrompt: res.prompt } });
      toast.success("Expanded system prompt generated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate prompt");
    } finally {
      setGenLoading(false);
    }
  };

  if (node.type === "agentNode") {
    return (
      <div className="space-y-2 text-xs">
        <Field label="Model">
          {/* Auto-populated and locked — set the model per-agent in the
              Agent-LLM tab, not here. */}
          <Input
            className="h-7 bg-muted/50 cursor-not-allowed"
            value={d.config?.model || ""}
            readOnly
            disabled
            placeholder="Set in Agent-LLM tab"
            title="Model is set per-agent in the Agent-LLM tab"
          />
        </Field>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">System prompt</Label>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              onClick={generateSystemPrompt}
              disabled={genLoading}
              title="Generate an expanded system prompt from the agent name + your draft using the default model"
            >
              {genLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {genLoading ? "Generating…" : "Generate"}
            </Button>
          </div>
          <Textarea
            rows={4}
            value={d.config?.systemPrompt || ""}
            placeholder="Describe the agent's role, then click Generate to expand…"
            onChange={(e) => onChange({ config: { ...(d.config || {}), systemPrompt: e.target.value } })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Temp">
            <Input
              className="h-7"
              type="number"
              step="0.1"
              value={d.config?.ai?.temperature ?? ""}
              onChange={(e) =>
                onChange({ config: { ...(d.config || {}), ai: { ...(d.config?.ai || {}), temperature: parseFloat(e.target.value) } } })
              }
            />
          </Field>
          <Field label="Max tokens">
            <Input
              className="h-7"
              type="number"
              value={d.config?.ai?.maxTokens ?? ""}
              onChange={(e) =>
                onChange({ config: { ...(d.config || {}), ai: { ...(d.config?.ai || {}), maxTokens: parseInt(e.target.value, 10) } } })
              }
            />
          </Field>
        </div>
        <Button size="sm" variant="outline" className="w-full" onClick={onAddToLoop}>
          <Repeat className="h-3.5 w-3.5 mr-1" />Add To Loop
        </Button>
        <Button
          size="sm"
          className="w-full"
          onClick={async () => {
            try {
              await api.put(`/agents/${d.agentId}`, { config: d.config });
              toast.success("Applied to agent");
            } catch (err: any) {
              toast.error(err?.message || "Failed to apply to agent");
            }
          }}
        >
          Apply to Agent
        </Button>
      </div>
    );
  }

  if (node.type === "triggerNode") {
    return (
      <Field label="Event">
        <Select value={d.event || "manual"} onValueChange={(v) => onChange({ event: v })}>
          <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRIGGER_EVENTS.map((ev) => <SelectItem key={ev} value={ev}>{ev}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  if (node.type === "conditionNode") {
    return (
      <div className="space-y-2 text-xs">
        <Field label="Type">
          <Select value={d.conditionType || "context_has"} onValueChange={(v) => onChange({ conditionType: v })}>
            <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONDITION_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Field"><Input className="h-7" value={d.field || ""} onChange={(e) => onChange({ field: e.target.value })} /></Field>
        <Field label="Operator"><Input className="h-7" value={d.operator || ""} onChange={(e) => onChange({ operator: e.target.value })} /></Field>
        <Field label="Value"><Input className="h-7" value={d.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} /></Field>
      </div>
    );
  }

  if (node.type === "loopNode") {
    const [target, setTarget] = [d._loopTarget || "", (v: string) => onChange({ _loopTarget: v })];
    return (
      <div className="space-y-2 text-xs">
        <div className="text-muted-foreground">{(d.agentIds || []).length} agent(s) in ring</div>
        <Field label="Max iterations">
          <Input className="h-7" type="number" value={d.maxIterations ?? 5} onChange={(e) => onChange({ maxIterations: parseInt(e.target.value, 10) })} />
        </Field>
        <Field label="Exit condition">
          <Select value={d.exitCondition || "functional_poc"} onValueChange={(v) => onChange({ exitCondition: v })}>
            <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOOP_EXIT_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Target">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-7"><SelectValue placeholder="Select target" /></SelectTrigger>
            <SelectContent>
              {targets.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Button
          size="sm"
          className="w-full"
          onClick={async () => {
            const agentIds = d.agentIds || [];
            if (agentIds.length < 1) return toast.error("Add agents to the loop first");
            if (!target) return toast.error("Select a target");
            try {
              await api.post("/agent-loops/start", {
                agentIds,
                targetId: target,
                initialInput: "Begin collaborative analysis.",
                maxIterations: d.maxIterations ?? 5,
                exitCondition: d.exitCondition || "functional_poc",
              });
              toast.success("Analysis loop started");
            } catch (err: any) {
              toast.error(err?.message || "Failed to start loop");
            }
          }}
        >
          <Play className="h-3.5 w-3.5 mr-1" />Start Loop
        </Button>
      </div>
    );
  }

  // mcp / tool — read-only summary
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      {d.status && <Badge variant="outline" className="text-[10px]">{d.status}</Badge>}
      {d.category && <div>Category: {d.category}</div>}
      {d.command && <div className="font-mono break-all">{d.command}</div>}
    </div>
  );
}

// --------------------------------------------------------------------------
// Handoff edge config — a handoff transfers control from the source agent to
// the target agent, passing the source's output into the target's context. An
// optional run-condition (a `context.<field> <op> <value>` test) lets the
// orchestrator skip the handoff when the condition is unmet at workflow build.
function HandoffEdgeConfig({
  edge,
  nodes,
  onChange,
}: {
  edge: Edge;
  nodes: Node[];
  onChange: (patch: Record<string, any>) => void;
}) {
  const labelOf = (nodeId: string) =>
    nodes.find((n) => n.id === nodeId)?.data?.label || "agent";
  const condition = edge.data?.handoff?.condition || null;
  const expression: string = condition?.expression || "";

  const setExpression = (value: string) => {
    const expr = value.trim();
    onChange({
      handoff: {
        ...(edge.data?.handoff || {}),
        condition: expr ? { type: "custom", expression: expr } : null,
      },
    });
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-1 text-muted-foreground">
        <span className="font-medium text-foreground truncate">{labelOf(edge.source)}</span>
        <ArrowRightLeft className="h-3 w-3 text-rose-500 shrink-0" />
        <span className="font-medium text-foreground truncate">{labelOf(edge.target)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        On completion, <span className="font-medium">{labelOf(edge.source)}</span> hands its output
        to <span className="font-medium">{labelOf(edge.target)}</span>, which then runs in a later phase.
      </p>
      <Field label="Run only if (optional)">
        <Input
          className="h-7 font-mono"
          value={expression}
          placeholder="context.vulnerability_confirmed === true"
          onChange={(e) => setExpression(e.target.value)}
          title="A JS-style expression over the accumulated workflow `context`. Empty = always hand off."
        />
      </Field>
      <p className="text-[10px] text-muted-foreground">
        Leave blank for an unconditional handoff. The expression is evaluated against the workflow
        <span className="font-mono"> context</span> when the run is planned.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function AgentFlowCanvas(props: AgentFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerCanvas {...props} />
    </ReactFlowProvider>
  );
}
