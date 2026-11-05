import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Container, Activity, Clock } from "lucide-react";
import { useNexusKaliStatus } from "@/hooks/useNexusKali";

export default function NexusKaliStatusPanel() {
  const { status, loading, refresh } = useNexusKaliStatus();

  const isRunning = status?.running === true;
  const isHealthy = status?.healthy === true;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Container className="h-4 w-4" />
          Nexus Kali
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={isRunning ? (isHealthy ? "default" : "secondary") : "destructive"}
            className="text-xs"
          >
            {isRunning ? (isHealthy ? "Healthy" : "Degraded") : "Stopped"}
          </Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isRunning && (
          <p className="text-xs text-muted-foreground">
            nexus-kali container is not running. Start it with docker compose up.
          </p>
        )}

        {isRunning && (
          <>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-lg font-bold flex items-center justify-center gap-1">
                  <Activity className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-xs text-muted-foreground">Running</div>
              </div>
              <div>
                <div className="text-sm font-bold truncate">
                  {status?.uptime || "—"}
                </div>
                <div className="text-xs text-muted-foreground">Uptime</div>
              </div>
            </div>

            {status?.image && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono truncate">{status.image}</span>
              </div>
            )}

            {status?.containerId && (
              <div className="text-xs text-muted-foreground font-mono truncate">
                ID: {status.containerId}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
