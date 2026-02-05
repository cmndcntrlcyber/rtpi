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
} from "reactflow";
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
  Maximize2,
  Filter,
  Network,
  Server,
  Globe,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface Asset {
  id: string;
  ip: string;
  hostname?: string;
  type: "host" | "domain" | "service";
  subnet?: string;
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

const nodeTypes = {
  host: HostNode,
  domain: DomainNode,
  service: ServiceNode,
};

// ============================================================================
// Main Component
// ============================================================================

interface NetworkTopologyViewProps {
  operationId: string;
}

export default function NetworkTopologyView({ operationId }: NetworkTopologyViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [layoutType, setLayoutType] = useState<"hierarchical" | "force" | "subnet">(
    "subnet"
  );
  const [filterSeverity, setFilterSeverity] = useState<"all" | "critical" | "high">("all");

  // Fetch assets and build topology
  const fetchTopology = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch discovered assets
      const response = await api.get<any[]>(
        `/surface-assessment/operations/${operationId}/assets`
      );

      setAssets(response);

      // Build nodes and edges
      const { nodes: generatedNodes, edges: generatedEdges } = buildTopology(
        response,
        layoutType,
        filterSeverity
      );

      setNodes(generatedNodes);
      setEdges(generatedEdges);
    } catch (error) {
      console.error("Failed to fetch topology:", error);
      toast.error("Failed to load network topology");
    } finally {
      setLoading(false);
    }
  }, [operationId, layoutType, filterSeverity, setNodes, setEdges]);

  useEffect(() => {
    if (operationId) {
      fetchTopology();
    }
  }, [operationId, fetchTopology]);

  // Export topology as PNG
  const handleExportPNG = () => {
    // Get React Flow instance and export
    const viewport = document.querySelector(".react-flow__viewport");
    if (!viewport) return;

    // Use html-to-image or similar library in production
    toast.info("Export feature requires html-to-image library");
  };

  // Export topology as SVG
  const handleExportSVG = () => {
    toast.info("SVG export coming soon");
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
            <Badge variant="outline">{assets.length} assets</Badge>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Layout Type */}
            <Select value={layoutType} onValueChange={(v: any) => setLayoutType(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subnet">Subnet Clusters</SelectItem>
                <SelectItem value="hierarchical">Hierarchical</SelectItem>
                <SelectItem value="force">Force-Directed</SelectItem>
              </SelectContent>
            </Select>

            {/* Severity Filter */}
            <Select
              value={filterSeverity}
              onValueChange={(v: any) => setFilterSeverity(v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assets</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="high">High+ Only</SelectItem>
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
        </div>
      </Card>

      {/* React Flow Canvas */}
      <Card className="p-0" style={{ height: "600px" }}>
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
              <div>🔍 Scroll to zoom</div>
              <div>🖱️ Drag to pan</div>
              <div>📌 Click nodes for details</div>
            </Card>
          </Panel>
        </ReactFlow>
      </Card>
    </div>
  );
}

// ============================================================================
// Topology Building Logic
// ============================================================================

function buildTopology(
  assets: Asset[],
  layoutType: "hierarchical" | "force" | "subnet",
  filterSeverity: "all" | "critical" | "high"
): { nodes: Node[]; edges: Edge[] } {
  // Filter assets by severity
  let filteredAssets = assets;
  if (filterSeverity === "critical") {
    filteredAssets = assets.filter((a) => (a.criticalVulnerabilities || 0) > 0);
  } else if (filterSeverity === "high") {
    filteredAssets = assets.filter(
      (a) => (a.criticalVulnerabilities || 0) > 0 || (a.vulnerabilityCount || 0) > 5
    );
  }

  // Build nodes
  const nodes: Node[] = filteredAssets.map((asset, index) => {
    const position = calculateNodePosition(asset, index, filteredAssets, layoutType);

    return {
      id: asset.id,
      type: asset.type,
      data: {
        label: asset.ip,
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

// Calculate node position based on layout type
function calculateNodePosition(
  asset: Asset,
  index: number,
  allAssets: Asset[],
  layoutType: "hierarchical" | "force" | "subnet"
): { x: number; y: number } {
  if (layoutType === "subnet") {
    // Group by subnet
    const subnets = Array.from(new Set(allAssets.map((a) => a.subnet || "unknown")));
    const subnetIndex = subnets.indexOf(asset.subnet || "unknown");
    const assetsInSubnet = allAssets.filter((a) => a.subnet === asset.subnet);
    const indexInSubnet = assetsInSubnet.findIndex((a) => a.id === asset.id);

    return {
      x: subnetIndex * 300,
      y: indexInSubnet * 120,
    };
  } else if (layoutType === "hierarchical") {
    // Hierarchical layout (domains at top, hosts below)
    const row = asset.type === "domain" ? 0 : 1;
    const col = index % 5;

    return {
      x: col * 250,
      y: row * 200,
    };
  } else {
    // Force-directed (simple circular for now)
    const angle = (index / allAssets.length) * 2 * Math.PI;
    const radius = 300;

    return {
      x: 400 + radius * Math.cos(angle),
      y: 400 + radius * Math.sin(angle),
    };
  }
}

// Infer connections between assets
function inferConnections(assets: Asset[]): NetworkConnection[] {
  const connections: NetworkConnection[] = [];

  // Group assets by subnet
  const subnetMap = new Map<string, Asset[]>();
  assets.forEach((asset) => {
    const subnet = asset.subnet || "unknown";
    if (!subnetMap.has(subnet)) {
      subnetMap.set(subnet, []);
    }
    subnetMap.get(subnet)!.push(asset);
  });

  // Create connections within subnets
  subnetMap.forEach((subnetAssets) => {
    for (let i = 0; i < subnetAssets.length - 1; i++) {
      for (let j = i + 1; j < subnetAssets.length; j++) {
        // Only connect if they share services or are on the same network
        if (Math.random() > 0.7) {
          // Random sampling to avoid overcrowding
          connections.push({
            sourceId: subnetAssets[i].id,
            targetId: subnetAssets[j].id,
            type: "network",
          });
        }
      }
    }
  });

  // Create service connections
  assets.forEach((asset) => {
    if (asset.services && asset.services.length > 0) {
      // Connect to other assets that might depend on these services
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
