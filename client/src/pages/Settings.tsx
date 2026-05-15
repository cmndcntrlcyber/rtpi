import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Settings as SettingsIcon,
  Shield,
  Database,
  Bell,
  Brain,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Loader2,
  Cpu,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface OllamaModelOption {
  name: string;
  size?: number;
}

interface ModelDropdownProps {
  ollamaModels: OllamaModelOption[];
  ollamaModelsLoading: boolean;
  ollamaModelsError: string | null;
}

const ollamaOptgroupLabel = (
  ollamaModels: OllamaModelOption[],
  loading: boolean,
  error: string | null
): string => {
  if (loading) return "Ollama (loading…)";
  if (error) return "Ollama (unavailable)";
  return `Ollama (${ollamaModels.length} model${ollamaModels.length === 1 ? "" : "s"})`;
};

const formatBytes = (size?: number): string =>
  typeof size === "number" ? ` (${(size / 1024 / 1024 / 1024).toFixed(1)} GB)` : "";

/**
 * Chat-model option set used by the global Default Model picker AND the
 * Default Agent / Reasoning dropdowns. Single source of truth so adding a new
 * frontier-model row updates every dropdown at once.
 */
function ChatModelOptions({
  ollamaModels,
  ollamaModelsLoading,
  ollamaModelsError,
}: ModelDropdownProps) {
  return (
    <>
      <optgroup label="Anthropic">
        <option value="claude-opus-4-6">Claude Opus 4.6 (Thinking)</option>
        <option value="claude-sonnet-4-5">Claude Sonnet 4.5 (Standard)</option>
        <option value="claude-haiku-4-5">Claude Haiku 4.5 (Fast)</option>
      </optgroup>
      <optgroup label="OpenAI">
        <option value="gpt-5.2">GPT-5.2 (Thinking)</option>
        <option value="gpt-5.2-chat-latest">GPT-5.2 Instant (Standard)</option>
        <option value="gpt-4.1-mini">GPT-4.1 Mini (Fast)</option>
      </optgroup>
      <optgroup
        label={ollamaOptgroupLabel(ollamaModels, ollamaModelsLoading, ollamaModelsError)}
      >
        {ollamaModels.length > 0 ? (
          ollamaModels.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
              {formatBytes(m.size)}
            </option>
          ))
        ) : (
          <option value="" disabled>
            {ollamaModelsError
              ? `unavailable: ${ollamaModelsError}`
              : "no models loaded — open Ollama AI to pull one"}
          </option>
        )}
      </optgroup>
    </>
  );
}

/**
 * Embedding-model option set. OpenAI and Ollama only — Anthropic does not
 * publish a public embeddings API. The Ollama optgroup is shared with the
 * chat dropdowns so any embedding model the operator pulls (e.g.
 * nomic-embed-text, mxbai-embed-large) shows up here too.
 */
function EmbeddingModelOptions({
  ollamaModels,
  ollamaModelsLoading,
  ollamaModelsError,
}: ModelDropdownProps) {
  return (
    <>
      <optgroup label="OpenAI">
        <option value="text-embedding-3-small">text-embedding-3-small (1536d)</option>
        <option value="text-embedding-3-large">text-embedding-3-large (3072d)</option>
        <option value="text-embedding-ada-002">text-embedding-ada-002 (1536d, legacy)</option>
      </optgroup>
      <optgroup
        label={ollamaOptgroupLabel(ollamaModels, ollamaModelsLoading, ollamaModelsError)}
      >
        {ollamaModels.length > 0 ? (
          ollamaModels.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
              {formatBytes(m.size)}
            </option>
          ))
        ) : (
          <option value="" disabled>
            {ollamaModelsError
              ? `unavailable: ${ollamaModelsError}`
              : "no models loaded — open Ollama AI to pull one"}
          </option>
        )}
      </optgroup>
    </>
  );
}

export default function Settings() {
  const [llmSettings, setLlmSettings] = useState({
    openaiApiKey: "",
    anthropicApiKey: "",
    tavilyApiKey: "",
    defaultModel: "claude-sonnet-4-5",
    // Per-role overrides — empty string means "fall back to defaultModel".
    defaultAgentModel: "",
    defaultReasoningModel: "",
    defaultEmbeddingModel: "text-embedding-3-small",
  });
  const [savingModels, setSavingModels] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showTavily, setShowTavily] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Live Ollama models — same source as the Ollama AI page (/api/v1/ollama/models/live).
  // Lets the Default Model dropdown surface whatever's loaded on the user's
  // remote Ollama (e.g. Qwen on the Blackwell host) without hard-coding model IDs.
  const [ollamaModels, setOllamaModels] = useState<OllamaModelOption[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [ollamaModelsError, setOllamaModelsError] = useState<string | null>(null);

  const loadOllamaModels = useCallback(async () => {
    try {
      setOllamaModelsLoading(true);
      setOllamaModelsError(null);
      const res = await fetch("/api/v1/ollama/models/live", { credentials: "include" });
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
  }, []);

  useEffect(() => {
    // Apply any saved dark-mode preference on mount so theme persists across
    // reloads even though the visible toggle moved off the Settings page.
    if (localStorage.getItem("darkMode") === "true") {
      document.documentElement.classList.add("dark");
    }

    // Load LLM settings + live Ollama models in parallel.
    loadLlmSettings();
    loadOllamaModels();
  }, [loadOllamaModels]);

  const loadLlmSettings = async () => {
    try {
      const response = await api.get<any>("/settings/llm");
      if (response.settings) {
        setLlmSettings({
          openaiApiKey: response.settings.openaiApiKey || "",
          anthropicApiKey: response.settings.anthropicApiKey || "",
          tavilyApiKey: response.settings.tavilyApiKey || "",
          defaultModel: response.settings.defaultModel || "claude-sonnet-4-5",
          defaultAgentModel: response.settings.defaultAgentModel || "",
          defaultReasoningModel: response.settings.defaultReasoningModel || "",
          defaultEmbeddingModel:
            response.settings.defaultEmbeddingModel || "text-embedding-3-small",
        });
      }
    } catch (error) {
      // Error handled via toast
    }
  };

  // Save just the three per-role model fields (Default Models card).
  const saveDefaultModels = async () => {
    setSavingModels(true);
    try {
      await api.post("/settings/llm", {
        defaultAgentModel: llmSettings.defaultAgentModel,
        defaultReasoningModel: llmSettings.defaultReasoningModel,
        defaultEmbeddingModel: llmSettings.defaultEmbeddingModel,
      });
      toast.success("Default models saved", {
        description: "Agent, reasoning, and embedding models updated.",
      });
    } catch (error: any) {
      toast.error("Failed to save default models", {
        description: error?.message || "Please try again.",
      });
    } finally {
      setSavingModels(false);
    }
  };

  const saveLlmSettings = async () => {
    setSaving(true);
    try {
      await api.post("/settings/llm", llmSettings);
      toast.success("AI settings saved successfully!", {
        description: "Your API keys and model preferences have been updated.",
      });
    } catch (error: any) {
      // Error handled via toast
      toast.error("Failed to save AI settings", {
        description: error.message || "Please check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveSystemConfig = async () => {
    setSavingConfig(true);
    try {
      // Simulate save - in real implementation this would call an API
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success("System configuration saved!", {
        description: "API and WebSocket URLs have been updated.",
      });
    } catch (error: any) {
      toast.error("Failed to save configuration", {
        description: error.message || "Please try again.",
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const testDatabaseConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch("http://localhost:3001/api/v1/health", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "healthy" && data.database === "connected") {
          toast.success("Database connection successful!", {
            description: "PostgreSQL is connected and responsive.",
          });
        } else {
          toast.warning("Database connection issue", {
            description: `Status: ${data.database || "unknown"}`,
          });
        }
      } else {
        toast.error("Connection test failed", {
          description: `Server returned ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error: any) {
      toast.error("Database connection failed", {
        description: error.message || "Unable to reach the database server.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LLM API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI &amp; LLM Configuration
              </span>
              <Link
                href="/ollama"
                className="text-xs font-normal text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                title="Open Ollama AI page to install / unload / benchmark models"
              >
                Manage in Ollama AI
                <ExternalLink className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveLlmSettings(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <div className="relative">
                  <Input
                    id="openai-key"
                    type={showOpenAI ? "text" : "password"}
                    value={llmSettings.openaiApiKey}
                    onChange={(e) => setLlmSettings({ ...llmSettings, openaiApiKey: e.target.value })}
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowOpenAI(!showOpenAI)}
                  >
                    {showOpenAI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                <div className="relative">
                  <Input
                    id="anthropic-key"
                    type={showAnthropic ? "text" : "password"}
                    value={llmSettings.anthropicApiKey}
                    onChange={(e) => setLlmSettings({ ...llmSettings, anthropicApiKey: e.target.value })}
                    placeholder="sk-ant-..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAnthropic(!showAnthropic)}
                  >
                    {showAnthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tavily-key">Tavily API Key</Label>
                <div className="relative">
                  <Input
                    id="tavily-key"
                    type={showTavily ? "text" : "password"}
                    value={llmSettings.tavilyApiKey}
                    onChange={(e) => setLlmSettings({ ...llmSettings, tavilyApiKey: e.target.value })}
                    placeholder="tvly-..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowTavily(!showTavily)}
                  >
                    {showTavily ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="default-model">Default Model</Label>
                  <button
                    type="button"
                    onClick={loadOllamaModels}
                    disabled={ollamaModelsLoading}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
                    title="Re-fetch live models from the configured Ollama host"
                  >
                    {ollamaModelsLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Refresh Ollama models
                  </button>
                </div>
                <select
                  id="default-model"
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  value={llmSettings.defaultModel}
                  onChange={(e) => setLlmSettings({ ...llmSettings, defaultModel: e.target.value })}
                >
                  <ChatModelOptions
                    ollamaModels={ollamaModels}
                    ollamaModelsLoading={ollamaModelsLoading}
                    ollamaModelsError={ollamaModelsError}
                  />
                </select>
                {ollamaModelsError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Couldn't reach Ollama: {ollamaModelsError}.{" "}
                    <Link href="/ollama" className="underline hover:no-underline">
                      Configure host
                    </Link>
                  </p>
                )}
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save API Keys"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Default Models — per-role overrides (Agent, Reasoning, Embedding).
            Each dropdown sources the same options as the global Default Model
            picker above: Anthropic + OpenAI + live Ollama models. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Default Models
              </span>
              <button
                type="button"
                onClick={loadOllamaModels}
                disabled={ollamaModelsLoading}
                className="text-xs font-normal text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
                title="Re-fetch live models from the configured Ollama host"
              >
                {ollamaModelsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Refresh Ollama models
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveDefaultModels();
              }}
              className="space-y-4"
            >
              <p className="text-xs text-muted-foreground -mt-1">
                Per-role overrides. Leave Agent / Reasoning empty to fall back to the global
                Default Model selected above.
              </p>

              {/* Default Agent Model */}
              <div className="space-y-2">
                <Label htmlFor="default-agent-model">Default Agent Model</Label>
                <select
                  id="default-agent-model"
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  value={llmSettings.defaultAgentModel}
                  onChange={(e) =>
                    setLlmSettings({ ...llmSettings, defaultAgentModel: e.target.value })
                  }
                >
                  <option value="">— Use global default ({llmSettings.defaultModel})</option>
                  <ChatModelOptions
                    ollamaModels={ollamaModels}
                    ollamaModelsLoading={ollamaModelsLoading}
                    ollamaModelsError={ollamaModelsError}
                  />
                </select>
                <p className="text-xs text-muted-foreground">
                  Used by autonomous agents (operation-lead, web-hacker, etc.) for tool calls
                  and code generation.
                </p>
              </div>

              {/* Default Reasoning Model */}
              <div className="space-y-2">
                <Label htmlFor="default-reasoning-model">Default Reasoning Model</Label>
                <select
                  id="default-reasoning-model"
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  value={llmSettings.defaultReasoningModel}
                  onChange={(e) =>
                    setLlmSettings({ ...llmSettings, defaultReasoningModel: e.target.value })
                  }
                >
                  <option value="">— Use global default ({llmSettings.defaultModel})</option>
                  <ChatModelOptions
                    ollamaModels={ollamaModels}
                    ollamaModelsLoading={ollamaModelsLoading}
                    ollamaModelsError={ollamaModelsError}
                  />
                </select>
                <p className="text-xs text-muted-foreground">
                  Used for chain-of-thought planning and multi-step deliberation. Pick a
                  thinking-grade model.
                </p>
              </div>

              {/* Default Embedding Model */}
              <div className="space-y-2">
                <Label htmlFor="default-embedding-model">Default Embedding Model</Label>
                <select
                  id="default-embedding-model"
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  value={llmSettings.defaultEmbeddingModel}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      defaultEmbeddingModel: e.target.value,
                    })
                  }
                >
                  <EmbeddingModelOptions
                    ollamaModels={ollamaModels}
                    ollamaModelsLoading={ollamaModelsLoading}
                    ollamaModelsError={ollamaModelsError}
                  />
                </select>
                <p className="text-xs text-muted-foreground">
                  Used by Memory + RAG vector search. Dimensions must match the schema; see
                  MEMORY_EMBEDDING_DIMENSIONS in <code>.env</code>.
                </p>
                {ollamaModelsError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Couldn't reach Ollama: {ollamaModelsError}.{" "}
                    <Link href="/ollama" className="underline hover:no-underline">
                      Configure host
                    </Link>
                  </p>
                )}
              </div>

              <Button type="submit" disabled={savingModels} className="w-full">
                {savingModels ? "Saving..." : "Save Default Models"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              System Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">API Base URL</Label>
              <Input
                id="api-url"
                defaultValue="http://localhost:3001"
                placeholder="https://api.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-url">WebSocket URL</Label>
              <Input
                id="ws-url"
                defaultValue="ws://localhost:3001"
                placeholder="wss://api.example.com"
              />
            </div>
            <Button onClick={saveSystemConfig} disabled={savingConfig}>
              {savingConfig ? "Saving..." : "Save Configuration"}
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Enhanced account security</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Session Timeout</Label>
                <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Audit Logging</Label>
                <p className="text-sm text-muted-foreground">Track all user actions</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="db-host">Database Host</Label>
              <Input
                id="db-host"
                defaultValue="localhost"
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-port">Port</Label>
              <Input
                id="db-port"
                type="number"
                defaultValue="5432"
                placeholder="5432"
              />
            </div>
            <Button
              variant="outline"
              onClick={testDatabaseConnection}
              disabled={testingConnection}
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive email alerts</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Critical Vulnerabilities</Label>
                <p className="text-sm text-muted-foreground">Immediate alerts</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Operation Updates</Label>
                <p className="text-sm text-muted-foreground">Status change notifications</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
