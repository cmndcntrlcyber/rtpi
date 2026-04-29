import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useFeatureFlag } from "@/lib/feature-flags";

type DocmostHealthReason =
  | "not_configured"
  | "service_unreachable"
  | "timeout"
  | "auth_error"
  | "service_error";

interface DocmostHealth {
  up: boolean;
  url: string;
  tokenConfigured: boolean;
  workspace?: { id: string; name: string };
  version?: string;
  reason?: DocmostHealthReason;
  error?: string;
  suggestion?: string;
}

const REASON_TITLES: Record<DocmostHealthReason, string> = {
  not_configured: "Docmost not configured",
  service_unreachable: "Docmost is unreachable",
  timeout: "Docmost is not responding",
  auth_error: "Docmost token is invalid",
  service_error: "Docmost returned an error",
};

function defaultSuggestion(reason?: DocmostHealthReason): string {
  switch (reason) {
    case "not_configured":
      return "Create an API token in Docmost admin and set DOCMOST_API_TOKEN.";
    case "service_unreachable":
      return "Run: docker compose --profile docmost up -d";
    case "timeout":
      return "Check Docmost container logs.";
    case "auth_error":
      return "Regenerate the API token in Docmost admin and update DOCMOST_API_TOKEN.";
    case "service_error":
      return "Inspect Docmost logs for crash details.";
    default:
      return "Check the Docmost service status.";
  }
}

/**
 * Banner that surfaces Docmost availability. Hidden entirely when the
 * FF_DOCMOST flag is off so users who don't run Docmost don't see noise.
 */
export default function DocmostHealthBanner() {
  const enabled = useFeatureFlag("docmost");
  const [health, setHealth] = useState<DocmostHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const fetchHealth = async () => {
      try {
        const result = await api.get<DocmostHealth>("/docmost/health");
        if (active) setHealth(result);
      } catch {
        if (active) setHealth(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchHealth();
    const id = window.setInterval(fetchHealth, 30_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [enabled]);

  if (!enabled) return null;

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-muted/40 border border-border rounded-md text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Docmost...
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-md text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <span className="text-foreground">Could not reach the Docmost health endpoint.</span>
      </div>
    );
  }

  if (health.up) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-green-500/10 border border-green-500/30 rounded-md text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-foreground font-medium">Docmost connected</span>
        {health.workspace?.name && (
          <span className="text-xs text-muted-foreground">
            workspace: <code className="font-mono">{health.workspace.name}</code>
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-2 text-xs"
          onClick={() => window.open(health.url, "_blank")}
        >
          Open <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  const title = REASON_TITLES[health.reason ?? "service_error"];
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
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </Button>
      </div>
    </div>
  );
}
