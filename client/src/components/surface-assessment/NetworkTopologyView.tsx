import { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap,
  Panel,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import { toPng, toSvg } from "html-to-image";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  RefreshCw,
  Network,
  Server,
  Globe,
  Shield,
  AlertTriangle,
  Crosshair,
  Radar,
  Search,
  MousePointer,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

type LayoutType = "hierarchical" | "force" | "subnet" | "discovery";

interface Asset {
  id: string;
  ip: string;
  value?: string;
  hostname?: string;
  type: "host" | "domain" | "service";
  subnet?: string;
  discoveryMethod?: string;
  targetTags?: string[];
  targetName?: string;
  vulnerabilityCount?: number;
  criticalVulnerabilities?: number;
  services?: {
    port: number;
    protocol: string;
    service: string;
  }[];
}

interface NetworkConnection {
  sourceId: string;
  targetId: string;
  type: "network" | "service" | "dependency";
  protocol?: string;
  port?: number;
}

// ============================================================================
// Discovery Flow Helpers
// ============================================================================

const DISCOVERY_METHODS = ["bbot", "nmap", "nuclei", "scope", "manual"] as const;

const METHOD_COLORS: Record<string, string> = {
  bbot: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950",
  nmap: "border-blue-500 bg-blue-50 dark:bg-blue-950",
  nuclei: "border-amber-500 bg-amber-50 dark:bg-amber-950",
  manual: "border-purple-500 bg-purple-50 dark:bg-purple-950",
  scope: "border-gray-500 bg-gray-50 dark:bg-gray-950",
  unknown: "border-slate-400 bg-slate-50 dark:bg-slate-950",
};

const METHOD_LABELS: Record<string, string> = {
  bbot: "BBOT Recon",
  nmap: "Nmap Scan",
  nuclei: "Nuclei Scan",
  manual: "Manual",
  scope: "Scope Import",
  unknown: "Unknown",
};

/**
 * Determine the discovery group for an asset using target tags (preferred)
 * with fallback to discoveredAsset.discoveryMethod.
 */
function getDiscoveryGroup(asset: Asset): string {
  // 1. Check target tags for discovery source (most accurate, set by auto-tagging)
  const targetTags = asset.targetTags || [];
  const discoveryTag = targetTags.find((t) =>
    DISCOVERY_METHODS.includes(t as any)
  );
  if (discoveryTag) return discoveryTag;

  // 2. Fall back to discoveredAsset.discoveryMethod
  if (asset.discoveryMethod) return asset.discoveryMethod;

  // 3. Default
  return "unknown";
}

// ============================================================================
// Custom Node Components
// ============================================================================

function HostNode({ data }: any) {
  const getSeverityColor = (critical: number, total: number) => {
    if (critical > 0) return "border-red-500 bg-red-50 dark:bg-red-950";
    if (total > 5) return "border-orange-500 bg-orange-50 dark:bg-orange-950";
    if (total > 0) return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950";
    return "border-green-500 bg-green-50 dark:bg-green-950";
  };

  return (
    <Card
      className={`p-3 min-w-[180px] border-2 ${getSeverityColor(
        data.criticalVulnerabilities || 0,
        data.vulnerabilityCount || 0
      )}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Server className="h-4 w-4" />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      {data.hostname && (
        <div className="text-xs text-muted-foreground mb-1">{data.hostname}</div>
      )}
      {data.subnet && (
        <Badge variant="outline" className="text-xs mb-2">
          {data.subnet}
        </Badge>
      )}
      {data.vulnerabilityCount > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <AlertTriangle className="h-3 w-3 text-red-600" />
          <span>
            {data.vulnerabilityCount} vuln{data.vulnerabilityCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </Card>
  );
}

function DomainNode({ data }: any) {
  return (
    <Card className="p-3 min-w-[160px] border-2 border-blue-500 bg-blue-50 dark:bg-blue-950">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-4 w-4 text-blue-600" />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      {data.ip && <div className="text-xs text-muted-foreground">{data.ip}</div>}
    </Card>
  );
}

function ServiceNode({ data }: any) {
  return (
    <Card className="p-2 min-w-[120px] border border-purple-500 bg-purple-50 dark:bg-purple-950">
      <div className="flex items-center gap-2">
        <Network className="h-3 w-3 text-purple-600" />
        <div className="text-xs font-medium">{data.label}</div>
      </div>
      {data.port && (
        <div className="text-xs text-muted-foreground mt-1">Port {data.port}</div>
      )}
    </Card>
  );
}

function OperationNode({ data }: any) {
  return (
    <Card className="p-4 min-w-[220px] border-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-950">
      <div className="flex items-center gap-2 mb-1">
        <Crosshair className="h-5 w-5 text-cyan-600" />
        <div className="font-bold text-base">{data.label}</div>
      </div>
      <div className="text-xs text-muted-foreground">
        {data.assetCount} assets discovered
      </div>
    </Card>
  );
}

function DiscoveryMethodNode({ data }: any) {
  const iconMap: Record<string, React.ReactNode> = {
    bbot: <Radar className="h-4 w-4 text-emerald-600" />,
    nmap: <Search className="h-4 w-4 text-blue-600" />,
    nuclei: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    manual: <MousePointer className="h-4 w-4 text-purple-600" />,
    scope: <Layers className="h-4 w-4 text-gray-600" />,
  };

  const colorClass = METHOD_COLORS[data.method] || METHOD_COLORS.unknown;

  return (
    <Card className={`p-3 min-w-[160px] border-2 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-1">
        {iconMap[data.method] || <Network className="h-4 w-4" />}
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      <div className="text-xs text-muted-foreground">
        {data.assetCount} asset{data.assetCount !== 1 ? "s" : ""}
      </div>
    </Card>
  );
}

const nodeTypes = {
  host: HostNode,
  domain: DomainNode,
  service: ServiceNode,
  operation: OperationNode,
  discoveryMethod: DiscoveryMethodNode,
};

// ============================================================================
// Main Component
// ============================================================================

interface NetworkTopologyViewProps {
  operationId: string;
  operationName?: string;
}

export default function NetworkTopologyView(props: NetworkTopologyViewProps) {
  return (
    <ReactFlowProvider>
      <NetworkTopologyViewInner {...props} />
    </ReactFlowProvider>
  );
}

function NetworkTopologyViewInner({
  operationId,
  operationName,
}: NetworkTopologyViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [layoutType, setLayoutType] = useState<LayoutType>("subnet");
  const [filterAssetType, setFilterAssetType] = useState<"all" | "host" | "domain" | "service">("all");
  const [filterVulnLevel, setFilterVulnLevel] = useState<"all" | "critical" | "high" | "medium">("all");
  const [canvasHeight, setCanvasHeight] = useState(600);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = canvasHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      setCanvasHeight(Math.max(400, Math.min(1200, startHeight + delta)));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [canvasHeight]);

  // Fetch assets and build topology
  const fetchTopology = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch discovered assets (API returns { assets: [...] })
      const response = await api.get<any>(
        `/surface-assessment/${operationId}/assets`
      );

      const assetData: Asset[] = response.assets || response || [];
      setAssets(assetData);

      // Build nodes and edges
      const { nodes: generatedNodes, edges: generatedEdges } = buildTopology(
        assetData,
        layoutType,
        filterAssetType,
        filterVulnLevel,
        operationName
      );

      setNodes(generatedNodes);
      setEdges(generatedEdges);
    } catch (error) {
      console.error("Failed to fetch topology:", error);
      toast.error("Failed to load network topology");
    } finally {
      setLoading(false);
    }
  }, [operationId, layoutType, filterAssetType, filterVulnLevel, operationName, setNodes, setEdges]);

  useEffect(() => {
    if (operationId) {
      fetchTopology();
    }
  }, [operationId, fetchTopology]);

  const reactFlowInstance = useReactFlow();

  const getExportFilename = (ext: string) => {
    const name = (operationName || "topology").toLowerCase().replace(/\s+/g, "-");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `topology-${name}-${ts}.${ext}`;
  };

  const getGraphBounds = () => {
    const allNodes = reactFlowInstance.getNodes();
    if (allNodes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of allNodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + (node.width || 200));
      maxY = Math.max(maxY, node.position.y + (node.height || 100));
    }
    const padding = 50;
    return {
      width: Math.ceil(maxX - minX + padding * 2),
      height: Math.ceil(maxY - minY + padding * 2),
      minX: minX - padding,
      minY: minY - padding,
    };
  };

  const handleExportPNG = async () => {
    const flowEl = document.querySelector(".react-flow") as HTMLElement;
    if (!flowEl) {
      toast.error("Could not find topology container");
      return;
    }
    try {
      toast.info("Generating PNG...");
      const bounds = getGraphBounds();
      if (!bounds) { toast.error("No nodes to export"); return; }

      // Save current viewport, then set to zoom=1 showing all nodes
      const savedViewport = reactFlowInstance.getViewport();
      reactFlowInstance.setViewport({ x: -bounds.minX, y: -bounds.minY, zoom: 1 });
      await new Promise((r) => setTimeout(r, 200));

      const dataUrl = await toPng(flowEl, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width: bounds.width,
        height: bounds.height,
      });

      // Restore original viewport
      reactFlowInstance.setViewport(savedViewport);

      const link = document.createElement("a");
      link.download = getExportFilename("png");
      link.href = dataUrl;
      link.click();
      toast.success("PNG exported successfully");
    } catch (err) {
      console.error("PNG export failed:", err);
      toast.error("Failed to export PNG");
    }
  };

  const handleExportSVG = async () => {
    const flowEl = document.querySelector(".react-flow") as HTMLElement;
    if (!flowEl) {
      toast.error("Could not find topology container");
      return;
    }
    try {
      toast.info("Generating SVG...");
      const bounds = getGraphBounds();
      if (!bounds) { toast.error("No nodes to export"); return; }

      const savedViewport = reactFlowInstance.getViewport();
      reactFlowInstance.setViewport({ x: -bounds.minX, y: -bounds.minY, zoom: 1 });
      await new Promise((r) => setTimeout(r, 200));

      const dataUrl = await toSvg(flowEl, {
        backgroundColor: "#ffffff",
        width: bounds.width,
        height: bounds.height,
      });

      reactFlowInstance.setViewport(savedViewport);

      const link = document.createElement("a");
      link.download = getExportFilename("svg");
      link.href = dataUrl;
      link.click();
      toast.success("SVG exported successfully");
    } catch (err) {
      console.error("SVG export failed:", err);
      toast.error("Failed to export SVG");
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-600" />
              <h3 className="text-lg font-semibold">Network Topology</h3>
            </div>
            <Badge variant="outline">
              {(() => {
                const displayed = nodes.filter((n) => n.type !== "operation" && n.type !== "discoveryMethod").length;
                return displayed < assets.length
                  ? `${displayed} / ${assets.length} assets`
                  : `${assets.length} assets`;
              })()}
            </Badge>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Layout Type */}
            <Select value={layoutType} onValueChange={(v: any) => setLayoutType(v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subnet">Subnet Clusters</SelectItem>
                <SelectItem value="hierarchical">Hierarchical</SelectItem>
                <SelectItem value="force">Force-Directed</SelectItem>
                <SelectItem value="discovery">Discovery Flow</SelectItem>
              </SelectContent>
            </Select>

            {/* Asset Type Filter */}
            <Select
              value={filterAssetType}
              onValueChange={(v: any) => setFilterAssetType(v)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="host">Hosts</SelectItem>
                <SelectItem value="domain">Domains</SelectItem>
                <SelectItem value="service">Services</SelectItem>
              </SelectContent>
            </Select>

            {/* Vulnerability Level Filter */}
            <Select
              value={filterVulnLevel}
              onValueChange={(v: any) => setFilterVulnLevel(v)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High+</SelectItem>
                <SelectItem value="medium">Medium+</SelectItem>
              </SelectContent>
            </Select>

            {/* Actions */}
            <Button variant="outline" size="sm" onClick={fetchTopology} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            <Button variant="outline" size="sm" onClick={handleExportPNG}>
              <Download className="h-4 w-4 mr-2" />
              PNG
            </Button>

            <Button variant="outline" size="sm" onClick={handleExportSVG}>
              <Download className="h-4 w-4 mr-2" />
              SVG
            </Button>
          </div>
        </div>
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <div className="font-semibold">Legend:</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-red-500 bg-red-50 dark:bg-red-950 rounded"></div>
            <span>Critical Vulnerabilities</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-orange-500 bg-orange-50 dark:bg-orange-950 rounded"></div>
            <span>High Vulnerabilities</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 rounded"></div>
            <span>Medium Vulnerabilities</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-green-500 bg-green-50 dark:bg-green-950 rounded"></div>
            <span>Secure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 bg-blue-50 dark:bg-blue-950 rounded"></div>
            <span>Domain/External</span>
          </div>
          {layoutType === "discovery" && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-950 rounded"></div>
                <span>Operation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950 rounded"></div>
                <span>Discovery Method</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* React Flow Canvas */}
      <Card className="p-0 relative" style={{ height: `${canvasHeight}px` }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "operation") return "#06b6d4";
              if (node.type === "discoveryMethod") return "#10b981";
              if (node.type === "host") {
                const critical = (node.data as any).criticalVulnerabilities || 0;
                const total = (node.data as any).vulnerabilityCount || 0;
                if (critical > 0) return "#ef4444";
                if (total > 5) return "#f97316";
                if (total > 0) return "#eab308";
                return "#22c55e";
              }
              if (node.type === "domain") return "#3b82f6";
              return "#a855f7";
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
          <Panel position="top-right">
            <Card className="p-2 text-xs">
              <div>Scroll to zoom</div>
              <div>Drag to pan</div>
              <div>Drag bottom edge to resize</div>
            </Card>
          </Panel>
        </ReactFlow>
        {/* Resize handle */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-transparent hover:bg-muted/50 z-50 transition-colors"
          onMouseDown={handleResizeStart}
        />
      </Card>
    </div>
  );
}

// ============================================================================
// Topology Building Logic
// ============================================================================

function buildTopology(
  assets: Asset[],
  layoutType: LayoutType,
  filterAssetType: "all" | "host" | "domain" | "service",
  filterVulnLevel: "all" | "critical" | "high" | "medium",
  operationName?: string
): { nodes: Node[]; edges: Edge[] } {
  // Filter by asset type
  let filteredAssets = assets;
  if (filterAssetType !== "all") {
    filteredAssets = filteredAssets.filter((a) => a.type === filterAssetType);
  }

  // Filter by vulnerability level
  if (filterVulnLevel === "critical") {
    filteredAssets = filteredAssets.filter((a) => (a.criticalVulnerabilities || 0) > 0);
  } else if (filterVulnLevel === "high") {
    filteredAssets = filteredAssets.filter(
      (a) => (a.criticalVulnerabilities || 0) > 0 || (a.vulnerabilityCount || 0) > 5
    );
  } else if (filterVulnLevel === "medium") {
    filteredAssets = filteredAssets.filter((a) => (a.vulnerabilityCount || 0) > 0);
  }

  // Discovery Flow layout is fully custom
  if (layoutType === "discovery") {
    return buildDiscoveryFlowTopology(filteredAssets, operationName || "Operation");
  }

  // Build nodes for other layouts
  const nodes: Node[] = filteredAssets.map((asset, index) => {
    const position = calculateNodePosition(asset, index, filteredAssets, layoutType);

    return {
      id: asset.id,
      type: asset.type,
      data: {
        label: asset.value || asset.ip,
        hostname: asset.hostname,
        subnet: asset.subnet,
        vulnerabilityCount: asset.vulnerabilityCount,
        criticalVulnerabilities: asset.criticalVulnerabilities,
      },
      position,
    };
  });

  // Build edges (connections between assets)
  const edges: Edge[] = [];
  const connections = inferConnections(filteredAssets);

  connections.forEach((conn, index) => {
    edges.push({
      id: `edge-${index}`,
      source: conn.sourceId,
      target: conn.targetId,
      type: "smoothstep",
      animated: conn.type === "service",
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      label: conn.port ? `${conn.protocol}:${conn.port}` : undefined,
      style: {
        stroke: conn.type === "network" ? "#94a3b8" : "#8b5cf6",
        strokeWidth: 2,
      },
    });
  });

  return { nodes, edges };
}

// ============================================================================
// Discovery Flow Layout (Tag-Aware)
// ============================================================================

function buildDiscoveryFlowTopology(
  assets: Asset[],
  operationName: string
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Root node: Operation
  const rootId = "op-root";
  nodes.push({
    id: rootId,
    type: "operation",
    data: {
      label: operationName,
      assetCount: assets.length,
    },
    position: { x: 0, y: 0 }, // will be centered below
  });

  // Group assets by discovery method using tag-aware logic
  const methodGroups = new Map<string, Asset[]>();
  assets.forEach((asset) => {
    const method = getDiscoveryGroup(asset);
    if (!methodGroups.has(method)) {
      methodGroups.set(method, []);
    }
    methodGroups.get(method)!.push(asset);
  });

  const methods = Array.from(methodGroups.keys()).sort((a, b) => {
    // Sort by pipeline order: scope → bbot → nmap → nuclei → manual → unknown
    const order = ["scope", "bbot", "nmap", "nuclei", "manual", "unknown"];
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) -
           (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
  });

  // Calculate method spacing based on widest group
  const colSpacing = 250;
  const maxGroupCols = Math.max(
    ...Array.from(methodGroups.values()).map((g) =>
      Math.min(g.length > 8 ? 4 : g.length > 4 ? 3 : g.length, 4)
    )
  );
  const methodSpacing = Math.max(400, maxGroupCols * colSpacing + 100);
  const totalWidth = (methods.length - 1) * methodSpacing;
  const startX = -totalWidth / 2;

  // Center the root node
  nodes[0].position = { x: 0, y: 0 };

  // Discovery method intermediate nodes (row 2)
  methods.forEach((method, methodIndex) => {
    const methodNodeId = `method-${method}`;
    const methodAssets = methodGroups.get(method)!;
    const x = startX + methodIndex * methodSpacing;

    nodes.push({
      id: methodNodeId,
      type: "discoveryMethod",
      data: {
        label: METHOD_LABELS[method] || method.toUpperCase(),
        method,
        assetCount: methodAssets.length,
      },
      position: { x, y: 180 },
    });

    // Edge from root to method group
    edges.push({
      id: `edge-root-${method}`,
      source: rootId,
      target: methodNodeId,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#64748b", strokeWidth: 2.5 },
    });

    // Asset leaf nodes (row 3+)
    // Scale columns based on group size to prevent overlap
    const cols = methodAssets.length > 8 ? 4 : methodAssets.length > 4 ? 3 : methodAssets.length;
    const rowSpacing = 130;
    const groupWidth = (Math.min(cols, methodAssets.length) - 1) * colSpacing;
    const assetStartX = x - groupWidth / 2;

    methodAssets.forEach((asset, assetIndex) => {
      const col = assetIndex % cols;
      const row = Math.floor(assetIndex / cols);
      const assetX = assetStartX + col * colSpacing;
      const assetY = 370 + row * rowSpacing;

      const nodeType = asset.type === "domain" ? "domain" : "host";

      nodes.push({
        id: asset.id,
        type: nodeType,
        data: {
          label: asset.value || asset.ip || asset.hostname || "unknown",
          hostname: asset.hostname,
          ip: asset.ip,
          subnet: asset.subnet,
          vulnerabilityCount: asset.vulnerabilityCount,
          criticalVulnerabilities: asset.criticalVulnerabilities,
        },
        position: { x: assetX, y: assetY },
      });

      // Edge from method to asset
      edges.push({
        id: `edge-${method}-${asset.id}`,
        source: methodNodeId,
        target: asset.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      });
    });
  });

  return { nodes, edges };
}

// ============================================================================
// Standard Layout Helpers
// ============================================================================

function calculateNodePosition(
  asset: Asset,
  index: number,
  allAssets: Asset[],
  layoutType: Exclude<LayoutType, "discovery">
): { x: number; y: number } {
  if (layoutType === "subnet") {
    const subnets = Array.from(new Set(allAssets.map((a) => a.subnet || "unknown")));
    const subnetIndex = subnets.indexOf(asset.subnet || "unknown");
    const assetsInSubnet = allAssets.filter((a) => a.subnet === asset.subnet);
    const indexInSubnet = assetsInSubnet.findIndex((a) => a.id === asset.id);

    return {
      x: subnetIndex * 350,
      y: indexInSubnet * 130,
    };
  } else if (layoutType === "hierarchical") {
    // Separate domains (row 0) from hosts, then wrap into grid
    const domains = allAssets.filter((a) => a.type === "domain");
    const hosts = allAssets.filter((a) => a.type !== "domain");
    const colsPerRow = 8;

    if (asset.type === "domain") {
      const di = domains.findIndex((a) => a.id === asset.id);
      return {
        x: (di % colsPerRow) * 280,
        y: Math.floor(di / colsPerRow) * 130,
      };
    }
    const hi = hosts.findIndex((a) => a.id === asset.id);
    const domainRows = Math.ceil(domains.length / colsPerRow);
    return {
      x: (hi % colsPerRow) * 280,
      y: (domainRows + 1) * 130 + Math.floor(hi / colsPerRow) * 130,
    };
  } else {
    // Force-directed (circular scaled to node count)
    const angle = (index / allAssets.length) * 2 * Math.PI;
    const radius = Math.max(400, allAssets.length * 25);
    const cx = radius + 100;
    const cy = radius + 100;

    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }
}

function inferConnections(assets: Asset[]): NetworkConnection[] {
  const connections: NetworkConnection[] = [];

  const subnetMap = new Map<string, Asset[]>();
  assets.forEach((asset) => {
    const subnet = asset.subnet || "unknown";
    if (!subnetMap.has(subnet)) {
      subnetMap.set(subnet, []);
    }
    subnetMap.get(subnet)!.push(asset);
  });

  subnetMap.forEach((subnetAssets) => {
    for (let i = 0; i < subnetAssets.length - 1; i++) {
      for (let j = i + 1; j < subnetAssets.length; j++) {
        if (Math.random() > 0.7) {
          connections.push({
            sourceId: subnetAssets[i].id,
            targetId: subnetAssets[j].id,
            type: "network",
          });
        }
      }
    }
  });

  assets.forEach((asset) => {
    if (asset.services && asset.services.length > 0) {
      const potentialTargets = assets.filter(
        (a) => a.id !== asset.id && a.subnet === asset.subnet
      );
      if (potentialTargets.length > 0 && Math.random() > 0.5) {
        const target = potentialTargets[0];
        connections.push({
          sourceId: asset.id,
          targetId: target.id,
          type: "service",
          protocol: asset.services[0].protocol,
          port: asset.services[0].port,
        });
      }
    }
  });

  return connections;
}
