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
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface AIProviderConfig {
  provider: "auto" | "ollama" | "openai" | "anthropic";
  model?: string;
  temperature: number;
  maxTokens: number;
  useCache: boolean;
  preferLocal: boolean;
}

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
    { value: "gpt-4-turbo-preview", label: "GPT-4 Turbo (Best)" },
    { value: "gpt-4", label: "GPT-4 (Balanced)" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Fast)" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Best)" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus (Creative)" },
    { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet (Balanced)" },
  ],
};

export function AIProviderSettings() {
  const [config, setConfig] = useState<AIProviderConfig>({
    provider: "auto",
    temperature: 0.7,
    maxTokens: 2048,
    useCache: true,
    preferLocal: true,
  });
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
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/settings/ai-provider");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
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
        openai: openaiData.available || false,
        anthropic: anthropicData.available || false,
      });
    } catch (error) {
      console.error("Failed to check provider status:", error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/v1/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      toast.success("AI provider settings have been updated");
    } catch (error: any) {
      toast.error(`Save Failed: ${error.message}`);
    } finally {
      setSaving(false);
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

        {config.provider !== "auto" && (
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={config.model}
              onValueChange={(value) => setConfig({ ...config, model: value })}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {config.provider === "ollama" &&
                  RECOMMENDED_MODELS.ollama.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
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
              Select the default model for AI operations
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
