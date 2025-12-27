import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Info,
  Activity,
  BarChart3,
  Settings,
  Calendar,
  Cpu,
  HardDrive,
  Network,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { RustNexusImplant } from "./ImplantsTab";

interface ImplantDetailModalProps {
  implant: RustNexusImplant;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

interface ImplantDetails {
  implant: RustNexusImplant;
  taskStats: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
  latestTelemetry?: {
    cpuUsagePercent?: number;
    memoryUsageMb?: number;
    memoryTotalMb?: number;
    networkLatencyMs?: number;
    healthStatus: string;
    healthScore?: number;
    collectedAt: string;
  };
}

export default function ImplantDetailModal({
  implant,
  open,
  onClose,
  onRefresh,
}: ImplantDetailModalProps) {
  const [details, setDetails] = useState<ImplantDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/rust-nexus/implants/${implant.id}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setDetails(data);
      } else {
        console.error("Failed to fetch implant details");
      }
    } catch (error) {
      console.error("Failed to fetch implant details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDetails();
    }
  }, [open, implant.id]);

  const handleRefresh = () => {
    fetchDetails();
    onRefresh();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{implant.implantName}</DialogTitle>
              <DialogDescription>Implant details and configuration</DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <Info className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <Activity className="h-4 w-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="telemetry">
              <BarChart3 className="h-4 w-4 mr-2" />
              Telemetry
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hostname</p>
                    <p className="text-sm font-mono">{implant.hostname}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                    <p className="text-sm font-mono">{implant.ipAddress || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Operating System</p>
                    <p className="text-sm">
                      {implant.osType} {implant.osVersion && `(${implant.osVersion})`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Architecture</p>
                    <p className="text-sm font-mono">{implant.architecture}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Implant Type</p>
                    <Badge variant="outline" className="capitalize">
                      {implant.implantType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Version</p>
                    <p className="text-sm font-mono">{implant.version}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant="outline" className="capitalize">
                      {implant.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Connection Quality
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            implant.connectionQuality > 80
                              ? "bg-green-500"
                              : implant.connectionQuality > 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${implant.connectionQuality}%` }}
                        />
                      </div>
                      <span className="text-sm">{implant.connectionQuality}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Heartbeat</p>
                    <p className="text-sm">
                      {implant.lastHeartbeat
                        ? formatDistanceToNow(new Date(implant.lastHeartbeat), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Registered</p>
                    <p className="text-sm">
                      {format(new Date(implant.registeredAt), "PPpp")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Task Statistics</CardTitle>
                <CardDescription>Performance and execution metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {details ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                      <p className="text-2xl font-bold">{details.taskStats.total}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold text-green-600">
                        {details.taskStats.completed}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Failed</p>
                      <p className="text-2xl font-bold text-red-600">
                        {details.taskStats.failed}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Queued</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {details.taskStats.queued}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Running</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {details.taskStats.running}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold">
                        {details.taskStats.total > 0
                          ? Math.round(
                              (details.taskStats.completed / details.taskStats.total) * 100
                            )
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Loading task statistics...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Telemetry Tab */}
          <TabsContent value="telemetry" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Latest Telemetry</CardTitle>
                <CardDescription>
                  Real-time performance and health metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {details?.latestTelemetry ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <Cpu className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">CPU Usage</p>
                          <p className="text-lg font-semibold">
                            {details.latestTelemetry.cpuUsagePercent?.toFixed(1) || "N/A"}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <HardDrive className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Memory Usage</p>
                          <p className="text-lg font-semibold">
                            {details.latestTelemetry.memoryUsageMb || "N/A"} MB
                            {details.latestTelemetry.memoryTotalMb &&
                              ` / ${details.latestTelemetry.memoryTotalMb} MB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Network className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Network Latency
                          </p>
                          <p className="text-lg font-semibold">
                            {details.latestTelemetry.networkLatencyMs || "N/A"} ms
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Health Status
                          </p>
                          <Badge variant="outline" className="capitalize">
                            {details.latestTelemetry.healthStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Collected{" "}
                        {formatDistanceToNow(new Date(details.latestTelemetry.collectedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No telemetry data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">AI Provider</p>
                    <p className="text-sm">{implant.aiProvider || "Not configured"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">AI Model</p>
                    <p className="text-sm font-mono">{implant.aiModel || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Autonomy Level</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-cyan-500"
                          style={{ width: `${(implant.autonomyLevel / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm">{implant.autonomyLevel}/10</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
