import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Container, RefreshCw, ServerCog, HardDrive, Activity } from "lucide-react";
import EmpireTab from "@/components/empire/EmpireTab";
import WorkspaceTab from "@/components/kasm/WorkspaceTab";
import DeploymentsPanel from "@/components/deployments/DeploymentsPanel";
import C2FrameworksPanel from "@/components/c2/C2FrameworksPanel";
import { useInfrastructure } from "@/hooks/useInfrastructure";

function fmtTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function Infrastructure() {
  const { containers, mcpServers, devices, healthChecks, loading, error, refetch } = useInfrastructure();

  const stats = {
    containers: containers.length,
    running: containers.filter((c) => c.running).length,
    devices: devices.length,
    healthy: healthChecks.filter((h) => h.status === "healthy" || h.status === "ok").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Infrastructure Monitoring</h1>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw aria-hidden="true" className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load live infrastructure data: {error}
        </div>
      )}

      {/* Stats Cards (live) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Containers</h3>
          <p className="text-3xl font-bold text-foreground tabular-nums">{stats.containers}</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Running</h3>
          <p className="text-3xl font-bold text-green-600 tabular-nums">{stats.running}</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Devices</h3>
          <p className="text-3xl font-bold text-blue-600 tabular-nums">{stats.devices}</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Healthy Checks</h3>
          <p className="text-3xl font-bold text-green-600 tabular-nums">{stats.healthy}</p>
        </div>
      </div>

      <Tabs defaultValue="containers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="frameworks">C2 Frameworks</TabsTrigger>
          <TabsTrigger value="empire">C2 Warroom</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
        </TabsList>

        {/* Containers — live, read-only (no generic docker-control endpoint) */}
        <TabsContent value="containers" className="space-y-4">
          {loading && containers.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : containers.length === 0 ? (
            <EmptyState icon={Container} title="No containers found" description="No tool containers are currently registered." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {containers.map((c) => (
                <Card key={c.container} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white mr-3 flex-shrink-0">
                          <Container className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{c.container}</h3>
                          <p className="text-sm text-muted-foreground truncate">{c.image || "—"}</p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`ml-2 px-2 py-1 text-xs font-medium ${
                          c.running ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {c.state}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Tools:</span> {c.tools.length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Last health: {fmtTime(c.lastHealthAt)}
                      {c.lastHealthOk != null && (
                        <span className={c.lastHealthOk ? "text-green-600" : "text-red-600"}>
                          {" "}({c.lastHealthOk ? "ok" : "failing"})
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {mcpServers.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <ServerCog className="h-4 w-4" /> MCP Servers
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mcpServers.map((m) => (
                  <Card key={m.id} className="bg-card border-border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">Last probe: {fmtTime(m.lastProbeAt)}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={m.lastProbeOk ? "bg-green-500/10 text-green-600" : "bg-secondary text-muted-foreground"}
                      >
                        {m.status || "unknown"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4">
          <DeploymentsPanel />
        </TabsContent>

        {/* Devices — live */}
        <TabsContent value="devices" className="space-y-4">
          {loading && devices.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </div>
          ) : devices.length === 0 ? (
            <EmptyState icon={HardDrive} title="No devices registered" description="Devices appear here once they enroll with a certificate." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map((device) => (
                <Card key={device.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-foreground truncate">{device.name}</h3>
                      <Badge
                        variant="secondary"
                        className={device.isBlocked ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}
                      >
                        {device.isBlocked ? "Blocked" : "Allowed"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{device.ipAddress || "no IP"}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      ID: {device.deviceId} · Last seen: {fmtTime(device.lastSeen)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Health Checks — live */}
        <TabsContent value="health" className="space-y-4">
          {loading && healthChecks.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </div>
          ) : healthChecks.length === 0 ? (
            <EmptyState icon={Activity} title="No health checks configured" description="Configured health checks and their latest results appear here." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {healthChecks.map((check) => {
                const ok = check.status === "healthy" || check.status === "ok";
                return (
                  <Card key={check.id} className="bg-card border-border">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-foreground">{check.name}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {check.status}
                        </span>
                      </div>
                      {check.message && <p className="text-sm text-muted-foreground">{check.message}</p>}
                      <p className="text-xs text-muted-foreground mt-2">Last check: {fmtTime(check.lastCheck)}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* C2 Frameworks — same shared panel as the C2 Warroom page */}
        <TabsContent value="frameworks" className="space-y-4">
          <C2FrameworksPanel />
        </TabsContent>

        <TabsContent value="empire" className="space-y-4">
          <EmpireTab />
        </TabsContent>

        <TabsContent value="workspaces" className="space-y-4">
          <WorkspaceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
