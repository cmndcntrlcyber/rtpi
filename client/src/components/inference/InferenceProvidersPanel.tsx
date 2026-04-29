import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Cpu,
  Cloud,
  ServerCog,
  Brain,
  Save,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

type ProviderId = "vllm" | "ollama" | "openai" | "anthropic";

interface Capabilities {
  chat: boolean;
  embed: boolean;
  toolCalls: boolean;
  vision: boolean;
  streaming: boolean;
}

interface ProbeResult {
  ok: boolean;
  durationMs: number;
  defaultModel?: string;
  availableModels?: string[];
  error?: string;
}

interface ProviderInfo {
  id: ProviderId;
  displayName: string;
  description: string;
  capabilities: Capabilities;
  configured: boolean;
  endpoint?: string;
  defaultModel?: string;
  lastProbe?: ProbeResult;
  lastProbeAt?: string;
}

interface ProvidersResponse {
  providers: ProviderInfo[];
  default: ProviderId;
}

const PROVIDER_ICONS: Record<ProviderId, JSX.Element> = {
  vllm: <ServerCog className="h-5 w-5 text-purple-600" />,
  ollama: <Cpu className="h-5 w-5 text-blue-600" />,
  openai: <Cloud className="h-5 w-5 text-emerald-600" />,
  anthropic: <Brain className="h-5 w-5 text-orange-600" />,
};

/**
 * Renders the registered inference providers with capability badges, latest
 * probe status, and (for vllm/ollama) inline endpoint + default-model editing.
 *
 * Backed by /api/v1/inference. Read endpoints are open to all authenticated
 * users; PATCH requires admin and is gated client-side.
 */
export default function InferenceProvidersPanel() {
  const { isAdmin } = useAuth();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [defaultProvider, setDefaultProvider] = useState<ProviderId | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState<ProviderId | null>(null);

  const refresh = useCallback(async (forceProbe = false) => {
    try {
      setLoading(true);
      const data = await api.get<ProvidersResponse>(
        `/inference/providers${forceProbe ? "?probe=true" : ""}`,
      );
      setProviders(data.providers);
      setDefaultProvider(data.default);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load inference providers",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleProbe(id: ProviderId) {
    setProbing(id);
    try {
      const data = await api.post<{ probe: ProbeResult }>(
        `/inference/providers/${id}/probe`,
      );
      setProviders((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, lastProbe: data.probe, lastProbeAt: new Date().toISOString() }
            : p,
        ),
      );
      toast[data.probe.ok ? "success" : "error"](
        `${id}: ${data.probe.ok ? "reachable" : data.probe.error || "unreachable"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Probe failed");
    } finally {
      setProbing(null);
    }
  }

  if (loading && providers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading inference providers...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Default provider
          </p>
          <p className="text-sm text-foreground font-mono">
            {defaultProvider ?? "—"}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refresh(true)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Probe all
        </Button>
      </div>

      <div className="space-y-2">
        {providers.map((p) => (
          <ProviderRow
            key={p.id}
            provider={p}
            isDefault={p.id === defaultProvider}
            canEdit={isAdmin() && (p.id === "vllm" || p.id === "ollama")}
            probing={probing === p.id}
            onProbe={() => handleProbe(p.id)}
            onPatched={() => refresh()}
          />
        ))}
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  isDefault,
  canEdit,
  probing,
  onProbe,
  onPatched,
}: {
  provider: ProviderInfo;
  isDefault: boolean;
  canEdit: boolean;
  probing: boolean;
  onProbe: () => void;
  onPatched: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [endpoint, setEndpoint] = useState(provider.endpoint ?? "");
  const [defaultModel, setDefaultModel] = useState(provider.defaultModel ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEndpoint(provider.endpoint ?? "");
    setDefaultModel(provider.defaultModel ?? "");
  }, [provider.endpoint, provider.defaultModel]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/inference/providers/${provider.id}`, {
        endpoint,
        defaultModel: provider.id === "vllm" ? defaultModel : undefined,
      });
      toast.success(`${provider.displayName} updated`);
      setEditing(false);
      onPatched();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Failed to update provider");
    } finally {
      setSaving(false);
    }
  }

  const probe = provider.lastProbe;
  const statusIcon = probe ? (
    probe.ok ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    )
  ) : (
    <span className="h-4 w-4 inline-block rounded-full bg-muted" />
  );

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{PROVIDER_ICONS[provider.id]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{provider.displayName}</span>
            {isDefault && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary">
                Default
              </Badge>
            )}
            {!provider.configured && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                Not configured
              </Badge>
            )}
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {statusIcon}
              {probe ? (probe.ok ? `${probe.durationMs}ms` : probe.error) : "Unprobed"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>

          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(provider.capabilities).map(([k, v]) =>
              v ? (
                <Badge
                  key={k}
                  variant="secondary"
                  className="text-[10px] py-0 px-1.5 bg-muted/70 text-muted-foreground"
                >
                  {k}
                </Badge>
              ) : null,
            )}
          </div>

          {!editing && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Endpoint:</span>{" "}
                <code className="bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                  {provider.endpoint || "—"}
                </code>
              </div>
              <div>
                <span className="font-medium">Default model:</span>{" "}
                <code className="bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                  {provider.defaultModel || "—"}
                </code>
              </div>
            </div>
          )}

          {editing && (
            <div className="mt-3 space-y-2 bg-muted/40 p-3 rounded">
              <div>
                <Label className="text-xs">Endpoint</Label>
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="h-8 text-xs font-mono mt-1"
                  placeholder={provider.id === "vllm" ? "http://rtpi-vllm:8000" : "http://localhost:11434"}
                />
              </div>
              {provider.id === "vllm" && (
                <div>
                  <Label className="text-xs">Default model</Label>
                  <Input
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="h-8 text-xs font-mono mt-1"
                    placeholder="Qwen/Qwen3.5-9B"
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onProbe} disabled={probing}>
              {probing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Probe
            </Button>
            {canEdit && !editing && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
            {canEdit && editing && (
              <>
                <Button size="sm" variant="default" className="h-7 px-2" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => {
                    setEditing(false);
                    setEndpoint(provider.endpoint ?? "");
                    setDefaultModel(provider.defaultModel ?? "");
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>

          {probe?.availableModels && probe.availableModels.length > 0 && (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                {probe.availableModels.length} model{probe.availableModels.length === 1 ? "" : "s"} reported
              </summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {probe.availableModels.slice(0, 25).map((m) => (
                  <code
                    key={m}
                    className="text-[11px] bg-muted/60 px-1.5 py-0.5 rounded font-mono"
                  >
                    {m}
                  </code>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
