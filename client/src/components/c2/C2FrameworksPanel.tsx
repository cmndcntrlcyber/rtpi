import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Power, PowerOff, RefreshCw, Loader2, ExternalLink, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

// Shared between the C2 Warroom (Empire) page and the Infrastructure page so
// both surfaces reflect the SAME C2 framework instances from one source
// (GET /api/v1/c2-warroom/frameworks). Self-contained: fetches + polls itself.

export interface C2Framework {
  id: string;
  name: string;
  description: string;
  source: string;
  containerStatus: "running" | "stopped" | "not_found";
  activated: boolean;
  healthy: boolean;
  uiPort: number;
  uiUrl: string | null;
}

const POLL_INTERVAL_MS = 20000;

function frameworkUiUrl(fw: C2Framework): string {
  if (fw.uiUrl) return fw.uiUrl;
  // Build from the browser's host so it works regardless of where the UI runs.
  return `${window.location.protocol}//${window.location.hostname}:${fw.uiPort}`;
}

function StatusBadge({ fw }: { fw: C2Framework }) {
  if (fw.containerStatus === "not_found") {
    return <Badge variant="outline" className="text-muted-foreground">Not Deployed</Badge>;
  }
  if (fw.containerStatus === "stopped") {
    return <Badge variant="outline" className="text-destructive border-destructive/30">Stopped</Badge>;
  }
  if (fw.activated && fw.healthy) {
    return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Active</Badge>;
  }
  if (fw.activated) {
    return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Activating</Badge>;
  }
  return <Badge variant="secondary">Dormant</Badge>;
}

export default function C2FrameworksPanel() {
  const [frameworks, setFrameworks] = useState<C2Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const inFlight = useRef(false);

  const fetchFrameworks = useCallback(async (showSpinner = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get<{ frameworks: C2Framework[] }>("/c2-warroom/frameworks");
      setFrameworks(res.frameworks || []);
    } catch {
      // Endpoint can fail if containers aren't running — show empty, not an error wall.
      setFrameworks([]);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  // Initial load + background poll so status stays live without manual refresh.
  useEffect(() => {
    fetchFrameworks(true);
    const interval = setInterval(() => fetchFrameworks(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchFrameworks]);

  const handleToggle = async (fw: C2Framework) => {
    const action = fw.activated ? "deactivate" : "activate";
    try {
      setToggling((prev) => new Set(prev).add(fw.id));
      await api.post(`/c2-warroom/${fw.id}/${action}`);
      toast.success(`${fw.name} ${action}d`);
      setTimeout(() => fetchFrameworks(false), 2000);
    } catch {
      toast.error(`Failed to ${action} ${fw.name}`);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(fw.id);
        return next;
      });
    }
  };

  const openUi = (fw: C2Framework) => {
    window.open(frameworkUiUrl(fw), "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">C2 Frameworks</h2>
        <Button variant="outline" size="sm" onClick={() => fetchFrameworks(true)} disabled={loading}>
          <RefreshCw aria-hidden="true" className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-live="polite">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {frameworks.map((fw) => (
            <Card key={fw.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-info/10 p-2 rounded-lg">
                    <Shield aria-hidden="true" className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{fw.name}</CardTitle>
                    <StatusBadge fw={fw} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">{fw.description}</CardDescription>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                  <a
                    href={fw.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                  >
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    Source
                  </a>
                </div>

                <div className="space-y-2">
                  {/* Open the framework's own UI in a new browser tab. */}
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => openUi(fw)}
                    disabled={fw.containerStatus !== "running"}
                    title={
                      fw.containerStatus !== "running"
                        ? "Framework container is not running"
                        : `Open ${fw.name} UI in a new tab`
                    }
                  >
                    <ExternalLink aria-hidden="true" className="h-4 w-4 mr-2" />
                    Open UI
                  </Button>

                  {fw.containerStatus !== "not_found" && (
                    <Button
                      className="w-full"
                      variant={fw.activated ? "destructive" : "default"}
                      onClick={() => handleToggle(fw)}
                      disabled={toggling.has(fw.id) || fw.containerStatus === "stopped"}
                    >
                      {toggling.has(fw.id) ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" />
                      ) : fw.activated ? (
                        <PowerOff aria-hidden="true" className="h-4 w-4 mr-2" />
                      ) : (
                        <Power aria-hidden="true" className="h-4 w-4 mr-2" />
                      )}
                      {fw.activated ? "Deactivate" : "Activate"}
                    </Button>
                  )}

                  {fw.containerStatus === "not_found" && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Container not deployed. Run docker compose to build.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
