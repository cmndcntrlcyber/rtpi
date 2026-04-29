import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSysReptorHealth } from "@/hooks/useSysReptor";
import type { SysReptorHealth, SysReptorHealthReason } from "@/services/sysreptor";

interface SysReptorHealthBannerProps {
  /** Hide entirely when service is up. Default: false (show a thin "connected" pill). */
  hideWhenHealthy?: boolean;
}

const REASON_TITLES: Record<SysReptorHealthReason, string> = {
  not_configured: "Sysreptor not configured",
  profile_not_enabled: "Sysreptor profile is not enabled",
  service_unreachable: "Sysreptor is unreachable",
  timeout: "Sysreptor is not responding",
  auth_error: "Sysreptor token is invalid",
  service_error: "Sysreptor returned an error",
};

function defaultSuggestion(reason: SysReptorHealthReason | undefined): string {
  switch (reason) {
    case "not_configured":
      return "Set SYSREPTOR_API_TOKEN in your environment, then restart the API.";
    case "profile_not_enabled":
      return "Run: docker compose --profile sysreptor up -d";
    case "service_unreachable":
      return "Check container status: docker compose ps rtpi-sysreptor-app";
    case "timeout":
      return "Inspect container logs: docker compose logs rtpi-sysreptor-app";
    case "auth_error":
      return "Regenerate the API token in Sysreptor admin and update SYSREPTOR_API_TOKEN.";
    case "service_error":
      return "Check Sysreptor logs for crash details.";
    default:
      return "Check the Sysreptor service status.";
  }
}

export default function SysReptorHealthBanner({ hideWhenHealthy = false }: SysReptorHealthBannerProps) {
  const { health, loading, refetch } = useSysReptorHealth();

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-muted/40 border border-border rounded-md text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Sysreptor...
      </div>
    );
  }

  if (!health) {
    // Unreachable from the client itself (network failure to /api/v1/sysreptor/health).
    return (
      <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-md text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <span className="text-foreground">Could not reach the Sysreptor health endpoint.</span>
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={refetch}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (health.up) {
    if (hideWhenHealthy) return null;
    return <HealthyPill health={health} onRefresh={refetch} />;
  }

  return <UnhealthyBanner health={health} onRefresh={refetch} />;
}

function HealthyPill({ health, onRefresh }: { health: SysReptorHealth; onRefresh: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-green-500/10 border border-green-500/30 rounded-md text-sm">
      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      <span className="text-foreground font-medium">Sysreptor connected</span>
      {health.version && (
        <span className="text-xs text-muted-foreground">v{health.version}</span>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto h-7 px-2 text-xs"
        onClick={() => window.open(health.url, "_blank")}
      >
        Open <ExternalLink className="h-3 w-3 ml-1" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onRefresh}>
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  );
}

function UnhealthyBanner({ health, onRefresh }: { health: SysReptorHealth; onRefresh: () => void }) {
  const title = health.reason ? REASON_TITLES[health.reason] : "Sysreptor is unavailable";
  const suggestion = health.suggestion || defaultSuggestion(health.reason);

  return (
    <div className="px-4 py-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-md">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{suggestion}</p>
          {(health.error || health.url) && (
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              {health.url && <code className="bg-muted/60 px-1.5 py-0.5 rounded">{health.url}</code>}
              {health.error && <span className="truncate">{health.error}</span>}
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onRefresh}>
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </Button>
      </div>
    </div>
  );
}
