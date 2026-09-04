import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, BarChart3, Cpu, HardDrive, Wifi } from "lucide-react";
import { api } from "@/lib/api";

interface TelemetryData {
  id: string;
  implantId: string;
  category: string;
  metrics: Record<string, number>;
  anomalyScore?: number;
  collectedAt: string;
}

interface TelemetryStats {
  total: number;
  categories: Record<string, number>;
  avgAnomalyScore: number;
}

interface Props {
  implantId: string;
}

const categoryIcons: Record<string, any> = {
  system: Cpu,
  network: Wifi,
  disk: HardDrive,
};

export default function TelemetryPanel({ implantId }: Props) {
  const [data, setData] = useState<TelemetryData[]>([]);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api.get<{ telemetry: TelemetryData[] }>(`/rust-nexus/implants/${implantId}/telemetry`).catch(() => ({ telemetry: [] })),
        api.get<TelemetryStats>(`/rust-nexus/implants/${implantId}/telemetry/stats`).catch(() => null),
      ]);
      setData(d?.telemetry || []);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [implantId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Telemetry
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="font-bold tabular-nums">{stats.total}</div>
              <div className="text-muted-foreground">Samples</div>
            </div>
            <div>
              <div className="font-bold tabular-nums">{Object.keys(stats.categories).length}</div>
              <div className="text-muted-foreground">Categories</div>
            </div>
            <div>
              <div className={`font-bold tabular-nums ${stats.avgAnomalyScore > 0.5 ? "text-amber-500" : "text-green-500"}`}>
                {stats.avgAnomalyScore.toFixed(2)}
              </div>
              <div className="text-muted-foreground">Avg Anomaly</div>
            </div>
          </div>
        )}

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {data.slice(0, 15).map((t) => {
            const Icon = categoryIcons[t.category] || BarChart3;
            return (
              <div key={t.id} className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {t.anomalyScore != null && (
                    <span className={`tabular-nums ${t.anomalyScore > 0.5 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {t.anomalyScore.toFixed(2)}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {new Date(t.collectedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
          {data.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-3">No telemetry data</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
