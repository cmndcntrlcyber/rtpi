import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Hourglass,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlag } from "@/lib/feature-flags";
import { api } from "@/lib/api";
import CertificatesSection from "./CertificatesSection";

type DeploymentState =
  | "down"
  | "starting"
  | "up"
  | "degraded"
  | "stopping"
  | "error"
  | "unknown";

interface Deployment {
  id: string;
  name: string;
  kind: string;
  displayName: string;
  description: string;
  composeProfile: string | null;
  containers: string[];
  desiredState: DeploymentState;
  currentState: DeploymentState;
  lastTransitionAt: string | null;
  bundle: { members: string[] } | null;
}

const STATE_ICONS: Record<DeploymentState, JSX.Element> = {
  up: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  down: <CircleSlash className="h-4 w-4 text-muted-foreground" />,
  starting: <Hourglass className="h-4 w-4 text-blue-600 animate-pulse" />,
  stopping: <Hourglass className="h-4 w-4 text-amber-600 animate-pulse" />,
  degraded: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  error: <AlertTriangle className="h-4 w-4 text-red-600" />,
  unknown: <Activity className="h-4 w-4 text-muted-foreground" />,
};

const STATE_LABEL: Record<DeploymentState, string> = {
  up: "Up",
  down: "Down",
  starting: "Starting…",
  stopping: "Stopping…",
  degraded: "Degraded",
  error: "Error",
  unknown: "Unknown",
};

/**
 * Lists every deployment + bundle from /api/v1/deployments. Admins get
 * Deploy / Teardown buttons gated on FF_FRAMEWORK_DEPLOY; non-admins see
 * read-only state. Bundles render with a "members" badge.
 */
export default function DeploymentsPanel() {
  const flag = useFeatureFlag("frameworkDeploy");
  const { isAdmin } = useAuth();
  const canDeploy = flag && isAdmin();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ deployments: Deployment[] }>("/deployments");
      setDeployments(data.deployments);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load deployments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!flag) {
    return (
      <div className="bg-muted/30 border border-border rounded-md p-4 text-xs text-muted-foreground">
        Set <code className="font-mono">FF_FRAMEWORK_DEPLOY=true</code> in your environment to enable
        per-framework deploy/teardown.
      </div>
    );
  }

  const bundles = deployments.filter((d) => d.kind === "bundle");
  const units = deployments.filter((d) => d.kind !== "bundle");

  async function transition(name: string, op: "up" | "down", isBundle: boolean) {
    setBusy(name);
    try {
      const path = isBundle ? `/deployments/bundles/${name}/${op}` : `/deployments/${name}/${op}`;
      const result = await api.post<{
        ok: boolean;
        newState: DeploymentState;
        error?: string;
      }>(path);
      if (!result.ok) {
        toast.error(`${op}: ${result.error || result.newState}`);
      } else {
        toast.success(`${name} → ${STATE_LABEL[result.newState]}`);
      }
      refresh();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || `${op} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {deployments.length} deployment{deployments.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Refresh
        </Button>
      </div>

      {bundles.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Bundles
          </h4>
          <div className="space-y-2">
            {bundles.map((d) => (
              <DeploymentRow
                key={d.id}
                deployment={d}
                canDeploy={canDeploy}
                busy={busy === d.name}
                onUp={() => transition(d.name, "up", true)}
                onDown={() => transition(d.name, "down", true)}
              />
            ))}
          </div>
        </div>
      )}

      {units.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Frameworks &amp; Services
          </h4>
          <div className="space-y-2">
            {units.map((d) => (
              <DeploymentRow
                key={d.id}
                deployment={d}
                canDeploy={canDeploy}
                busy={busy === d.name}
                onUp={() => transition(d.name, "up", false)}
                onDown={() => transition(d.name, "down", false)}
              />
            ))}
          </div>
        </div>
      )}

      <CertificatesSection />
    </div>
  );
}

function DeploymentRow({
  deployment,
  canDeploy,
  busy,
  onUp,
  onDown,
}: {
  deployment: Deployment;
  canDeploy: boolean;
  busy: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const isUp = deployment.currentState === "up";
  const isDown = deployment.currentState === "down" || deployment.currentState === "unknown";

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{STATE_ICONS[deployment.currentState]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{deployment.displayName}</span>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
              {deployment.kind}
            </Badge>
            <Badge
              variant="secondary"
              className={`text-[10px] py-0 px-1.5 ${stateColor(deployment.currentState)}`}
            >
              {STATE_LABEL[deployment.currentState]}
            </Badge>
            {deployment.composeProfile && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-muted/70 text-muted-foreground">
                profile: {deployment.composeProfile}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{deployment.description}</p>
          {deployment.bundle ? (
            <p className="text-[11px] text-muted-foreground mt-1">
              Members:{" "}
              {deployment.bundle.members.map((m, i) => (
                <code key={m} className="font-mono">
                  {i > 0 ? ", " : ""}
                  {m}
                </code>
              ))}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1">
              Containers:{" "}
              {deployment.containers.map((c, i) => (
                <code key={c} className="font-mono">
                  {i > 0 ? ", " : ""}
                  {c}
                </code>
              ))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={onUp}
            disabled={!canDeploy || busy || isUp}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            Deploy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-red-600 hover:text-red-700"
            onClick={onDown}
            disabled={!canDeploy || busy || isDown}
          >
            <Square className="h-3 w-3 mr-1" />
            Teardown
          </Button>
        </div>
      </div>
    </div>
  );
}

function stateColor(state: DeploymentState): string {
  switch (state) {
    case "up":
      return "bg-green-500/10 text-green-700 dark:text-green-300";
    case "starting":
    case "stopping":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "degraded":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "error":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}
