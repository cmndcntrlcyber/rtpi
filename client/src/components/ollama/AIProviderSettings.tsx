import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

interface AIProviderConfig {
  provider: "auto" | "ollama" | "openai" | "anthropic";
  model?: string;
  temperature: number;
  maxTokens: number;
  useCache: boolean;
  preferLocal: boolean;
  ollamaHost: string;
}

const DEFAULT_OLLAMA_HOST = "http://localhost:11434";

interface ProviderStatus {
  ollama: boolean;
  openai: boolean;
  anthropic: boolean;
}

const RECOMMENDED_MODELS = {
  ollama: [
    { value: "llama3:8b", label: "Llama 3 8B (General)" },
    { value: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder 7B (Code)" },
    { value: "mistral:7b", label: "Mistral 7B (Fast)" },
    { value: "codellama:13b", label: "Code Llama 13B (Code)" },
  ],
  openai: [
    { value: "gpt-5.2", label: "GPT-5.2 (Thinking)" },
    { value: "gpt-5.2-chat-latest", label: "GPT-5.2 Instant (Standard)" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini (Fast)" },
  ],
  anthropic: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6 (Thinking)" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (Standard)" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (Fast)" },
  ],
};

export function AIProviderSettings() {
  const [config, setConfig] = useState<AIProviderConfig>({
    provider: "auto",
    temperature: 0.7,
    maxTokens: 2048,
    useCache: true,
    preferLocal: true,
    ollamaHost: DEFAULT_OLLAMA_HOST,
  });
  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<{ name: string; size?: number }[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [ollamaModelsError, setOllamaModelsError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    ollama: false,
    openai: false,
    anthropic: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    checkProviderStatus();
    void loadOllamaModels();
  }, []);

  // Refresh model list whenever the user switches to Ollama (or Auto, which may prefer Ollama).
  useEffect(() => {
    if (config.provider === "ollama" || config.provider === "auto") {
      void loadOllamaModels();
    }
  }, [config.provider]);

  const loadOllamaModels = async () => {
    try {
      setOllamaModelsLoading(true);
      setOllamaModelsError(null);
      const res = await fetch("/api/v1/ollama/models/live");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOllamaModels([]);
        setOllamaModelsError(data.details || data.error || `HTTP ${res.status}`);
        return;
      }
      setOllamaModels(Array.isArray(data.models) ? data.models : []);
    } catch (e: any) {
      setOllamaModels([]);
      setOllamaModelsError(e?.message || "Network error");
    } finally {
      setOllamaModelsLoading(false);
    }
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/settings/ai-provider");
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          // Map backend response fields to component config shape.
          // The backend returns { openaiApiKey, anthropicApiKey, tavilyApiKey, defaultModel }
          // but this component uses { provider, model, temperature, maxTokens, useCache, preferLocal }.
          // Merge only the relevant field to preserve defaults.
          setConfig((prev) => ({
            ...prev,
            model: data.settings.defaultModel || prev.model,
            ollamaHost: data.settings.ollamaHost || prev.ollamaHost,
          }));
        }
      }
    } catch (error: any) {
      toast.error(`Failed to load settings: ${error.message || "Network error"}`);
    } finally {
      setLoading(false);
    }
  };

  const checkProviderStatus = async () => {
    try {
      // Check Ollama
      const ollamaResponse = await fetch("/api/v1/ollama/health");
      const ollamaHealthy = ollamaResponse.ok;

      // Check OpenAI (via backend)
      const openaiResponse = await fetch("/api/v1/settings/ai-provider/status/openai");
      const openaiData = await openaiResponse.json();

      // Check Anthropic (via backend)
      const anthropicResponse = await fetch("/api/v1/settings/ai-provider/status/anthropic");
      const anthropicData = await anthropicResponse.json();

      setProviderStatus({
        ollama: ollamaHealthy,
        openai: openaiData.connected || false,
        anthropic: anthropicData.connected || false,
      });

      // Show status check results
      toast.info("Provider status checked", {
        description: `Ollama: ${ollamaHealthy ? "✓" : "✗"} | OpenAI: ${openaiData.connected ? "✓" : "✗"} | Anthropic: ${anthropicData.connected ? "✓" : "✗"}`,
      });
    } catch (error: any) {
      toast.error(`Failed to check provider status: ${error.message || "Network error"}`);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      // Send only the fields the backend understands
      const response = await fetch("/api/v1/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultModel: config.model,
          ollamaHost: config.ollamaHost,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to save settings");
      }

      toast.success("AI provider settings have been updated");
      // Refresh Ollama availability and model list after endpoint change.
      void checkProviderStatus();
      void loadOllamaModels();
    } catch (error: any) {
      toast.error(`Save Failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const testOllamaConnection = async () => {
    try {
      setTestingOllama(true);
      const url = (config.ollamaHost || "").trim().replace(/\/+$/, "");
      if (!url) {
        toast.error("Enter an Ollama endpoint first");
        return;
      }
      try { new URL(url); } catch {
        toast.error("Invalid URL — expected e.g. http://localhost:11434");
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        const count = Array.isArray(data.models) ? data.models.length : 0;
        toast.success(`Ollama reachable at ${url} — ${count} model(s) available`);
        void loadOllamaModels();
      } finally {
        clearTimeout(timer);
      }
    } catch (error: any) {
      const msg = error?.name === "AbortError" ? "Timed out after 5s" : (error?.message || "Connection failed");
      toast.error(`Ollama unreachable: ${msg}`);
    } finally {
      setTestingOllama(false);
    }
  };

  const getProviderBadge = (provider: keyof ProviderStatus) => {
    const available = providerStatus[provider];
    return (
      <Badge variant={available ? "default" : "secondary"} className="ml-2">
        {available ? (
          <>
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Available
          </>
        ) : (
          <>
            <XCircle className="h-3 w-3 mr-1" />
            Unavailable
          </>
        )}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="provider">AI Provider</Label>
          <Select
            value={config.provider}
            onValueChange={(value: any) => setConfig({ ...config, provider: value })}
          >
            <SelectTrigger id="provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                Auto (Prefer Local)
              </SelectItem>
              <SelectItem value="ollama">
                Ollama (Local)
                {getProviderBadge("ollama")}
              </SelectItem>
              <SelectItem value="openai">
                OpenAI
                {getProviderBadge("openai")}
              </SelectItem>
              <SelectItem value="anthropic">
                Anthropic
                {getProviderBadge("anthropic")}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Select "Auto" to automatically choose the best available provider, preferring local models
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ollamaHost">Ollama API Endpoint</Label>
          <div className="flex gap-2">
            <Input
              id="ollamaHost"
              type="url"
              placeholder={DEFAULT_OLLAMA_HOST}
              value={config.ollamaHost}
              onChange={(e) => setConfig({ ...config, ollamaHost: e.target.value })}
              spellCheck={false}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              onClick={testOllamaConnection}
              disabled={testingOllama}
            >
              {testingOllama ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Base URL of the Ollama HTTP API. Default is <code>{DEFAULT_OLLAMA_HOST}</code>.
            Use e.g. <code>http://ollama:11434</code> when running inside Docker, or a remote URL for a GPU host.
            Persisted to <code>OLLAMA_HOST</code> in <code>.env</code>.
          </p>
        </div>

        {config.provider !== "auto" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="model">Model</Label>
              {config.provider === "ollama" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadOllamaModels}
                  disabled={ollamaModelsLoading}
                  className="h-7 px-2"
                >
                  {ollamaModelsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  {!ollamaModelsLoading && "Refresh"}
                </Button>
              )}
            </div>
            <Select
              value={config.model}
              onValueChange={(value) => setConfig({ ...config, model: value })}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder={
                  config.provider === "ollama" && ollamaModelsLoading
                    ? "Loading models…"
                    : "Select a model"
                } />
              </SelectTrigger>
              <SelectContent>
                {config.provider === "ollama" && ollamaModels.length === 0 && !ollamaModelsLoading && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {ollamaModelsError
                      ? `Ollama unreachable: ${ollamaModelsError}`
                      : "No models installed on this Ollama server"}
                  </div>
                )}
                {config.provider === "ollama" &&
                  ollamaModels.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}{m.size ? ` — ${formatBytes(m.size)}` : ""}
                    </SelectItem>
                  ))}
                {config.provider === "openai" &&
                  RECOMMENDED_MODELS.openai.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                {config.provider === "anthropic" &&
                  RECOMMENDED_MODELS.anthropic.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {config.provider === "ollama"
                ? "Live list from the Ollama server. Click Refresh to re-sync."
                : "Select the default model for AI operations"}
            </p>
          </div>
        )}

        {config.provider === "auto" && (
          <div className="space-y-2">
            <Label htmlFor="custom-model">Custom Model (Optional)</Label>
            <Input
              id="custom-model"
              placeholder="e.g., llama3:8b"
              value={config.model || ""}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Leave empty to use recommended models for each provider
            </p>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Model Parameters</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature">Temperature</Label>
              <span className="text-sm text-muted-foreground">{config.temperature.toFixed(1)}</span>
            </div>
            <Input
              id="temperature"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Lower values (0.0-0.3) are more focused and deterministic.
              Higher values (0.7-1.0) are more creative and diverse.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokens">Max Tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              min={256}
              max={8192}
              step={256}
              value={config.maxTokens}
              onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2048 })}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of tokens in the AI response (256-8192)
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Advanced Options</h3>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="useCache">Response Caching</Label>
            <p className="text-sm text-muted-foreground">
              Cache AI responses to reduce redundant API calls
            </p>
          </div>
          <Switch
            id="useCache"
            checked={config.useCache}
            onCheckedChange={(checked) => setConfig({ ...config, useCache: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="preferLocal">Prefer Local Models</Label>
            <p className="text-sm text-muted-foreground">
              Try Ollama first before falling back to cloud providers
            </p>
          </div>
          <Switch
            id="preferLocal"
            checked={config.preferLocal}
            onCheckedChange={(checked) => setConfig({ ...config, preferLocal: checked })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={checkProviderStatus}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Check Provider Status
        </Button>
        <Button onClick={saveSettings} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
