import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, AlertTriangle, RefreshCw, Gauge } from "lucide-react";
import { useFerryHealth } from "@/hooks/useFerry";
import { api } from "@/lib/api";

export default function GmlAnomalyPanel() {
  const { anomaly, agents, loading, refresh } = useFerryHealth(15000);
  const [adjusting, setAdjusting] = useState<string | null>(null);

  const barometer = anomaly?.barometer ?? 0;
  const attributions = anomaly?.agent_attributions ?? {};
  const sorted = Object.entries(attributions).sort(([, a], [, b]) => b - a);

  const handleRateAdjust = async (agentId: string) => {
    setAdjusting(agentId);
    try {
      await api.post("/ferry/rate-adjust", { agent_id: agentId });
      refresh();
    } catch {
      // handled
    } finally {
      setAdjusting(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          GML Anomaly Detection
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barometer */}
        <div className="flex items-center gap-3">
          <Gauge className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Global Noise Barometer</span>
              <span className={`text-sm font-bold tabular-nums ${
                barometer < 0.3 ? "text-blue-500" :
                barometer < 0.7 ? "text-amber-500" : "text-red-500"
              }`}>
                {barometer.toFixed(3)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  barometer < 0.3 ? "bg-blue-500" :
                  barometer < 0.7 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(barometer * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Throttling status */}
        {anomaly?.throttling_active && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Rate throttling active — agents operating at reduced capacity
          </div>
        )}

        {/* Per-agent attribution scores */}
        {sorted.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Per-Agent Anomaly Scores</div>
            <div className="space-y-1">
              {sorted.map(([peerId, score]) => {
                const agent = agents.find((a) => a.peer_id === peerId);
                return (
                  <div key={peerId} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono truncate max-w-[120px]">
                        {peerId.slice(0, 12)}
                      </span>
                      {agent && (
                        <span className="text-muted-foreground">{agent.os}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            score < 0.3 ? "bg-blue-500" :
                            score < 0.7 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(score * 100, 100)}%` }}
                        />
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 tabular-nums min-w-[40px] text-center">
                        {score.toFixed(2)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={adjusting === peerId}
                        onClick={() => handleRateAdjust(peerId)}
                        title="Adjust rate"
                      >
                        <RefreshCw className={`h-2.5 w-2.5 ${adjusting === peerId ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sorted.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No anomaly data available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
