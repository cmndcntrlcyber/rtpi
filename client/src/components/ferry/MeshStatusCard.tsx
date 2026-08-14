import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Cpu, AlertTriangle, Shield } from "lucide-react";
import { useFerryHealth } from "@/hooks/useFerry";

function barometerColor(value: number): string {
  if (value < 0.3) return "text-blue-500";
  if (value < 0.7) return "text-amber-500";
  return "text-red-500";
}

function barometerBg(value: number): string {
  if (value < 0.3) return "bg-blue-500";
  if (value < 0.7) return "bg-amber-500";
  return "bg-red-500";
}

export default function MeshStatusCard() {
  const { health, agents, anomaly, loading } = useFerryHealth();

  const isConnected = health?.status === "ok" || health?.status === "healthy";
  const barometer = anomaly?.barometer ?? 0;
  const healthyCount = agents.length;

  if (!isConnected && !loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          <Shield className="h-5 w-5 mx-auto mb-1 opacity-50" />
          Ferry gateway not connected
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Mesh Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Connected Agents</div>
            <div className="text-2xl font-bold tabular-nums">{healthyCount}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Noise Barometer</div>
            <div className={`text-2xl font-bold tabular-nums ${barometerColor(barometer)}`}>
              {barometer.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Barometer gauge */}
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barometerBg(barometer)}`}
              style={{ width: `${Math.min(barometer * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Normal</span>
            <span>Elevated</span>
            <span>Critical</span>
          </div>
        </div>

        {anomaly?.throttling_active && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            GML rate throttling active
          </div>
        )}

        {/* Per-agent summary */}
        {agents.length > 0 && (
          <div className="space-y-1.5">
            {agents.slice(0, 5).map((agent) => (
              <div key={agent.peer_id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{agent.peer_id.slice(0, 12)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{agent.os}</span>
                  {anomaly?.agent_attributions[agent.peer_id] != null && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {anomaly.agent_attributions[agent.peer_id].toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {agents.length > 5 && (
              <div className="text-xs text-muted-foreground text-center">
                +{agents.length - 5} more
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
