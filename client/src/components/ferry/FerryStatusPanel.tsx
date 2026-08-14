import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Radio, Activity, AlertTriangle } from "lucide-react";
import { useFerryHealth } from "@/hooks/useFerry";

export default function FerryStatusPanel() {
  const { health, agents, anomaly, loading, refresh } = useFerryHealth();

  const isConnected = health?.status === "ok" || health?.status === "healthy";
  const isDisabled = health?.status === "disabled";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Radio className="h-4 w-4" />
          Ferry Gateway
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={isDisabled ? "secondary" : isConnected ? "default" : "destructive"}
            className="text-xs"
          >
            {isDisabled ? "Disabled" : isConnected ? "Connected" : "Unreachable"}
          </Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isDisabled && (
          <p className="text-xs text-muted-foreground">
            FF_FERRY_BRIDGE is disabled. Enable it to connect to nexus-harness.
          </p>
        )}

        {isConnected && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold">{agents.length}</div>
                <div className="text-xs text-muted-foreground">Agents</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {anomaly ? anomaly.barometer.toFixed(2) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Barometer</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {health?.version || "—"}
                </div>
                <div className="text-xs text-muted-foreground">Version</div>
              </div>
            </div>

            {anomaly?.throttling_active && (
              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                GML throttling active
              </div>
            )}

            {agents.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Connected Agents</div>
                {agents.map((agent) => (
                  <div key={agent.peer_id} className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate max-w-[160px]">{agent.peer_id.slice(0, 16)}...</span>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-green-500" />
                      <span className="text-muted-foreground">{agent.os}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
