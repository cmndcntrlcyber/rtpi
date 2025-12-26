import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Shield, Database, Bell, Moon, Sun, Brain, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

export default function Settings() {
  const [darkMode, setDarkMode] = useState(false);
  const [llmSettings, setLlmSettings] = useState({
    openaiApiKey: "",
    anthropicApiKey: "",
    tavilyApiKey: "",
    defaultModel: "claude-sonnet-4-5-20250929",
  });
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showTavily, setShowTavily] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check for saved dark mode preference
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
    
    // Load LLM settings
    loadLlmSettings();
  }, []);

  const loadLlmSettings = async () => {
    try {
      const response = await api.get<any>("/settings/llm");
      if (response.settings) {
        setLlmSettings({
          openaiApiKey: response.settings.openaiApiKey || "",
          anthropicApiKey: response.settings.anthropicApiKey || "",
          tavilyApiKey: response.settings.tavilyApiKey || "",
          defaultModel: response.settings.defaultModel || "claude-sonnet-4-5-20250929",
        });
      }
    } catch (error) {
      console.error("Failed to load LLM settings:", error);
    }
  };

  const saveLlmSettings = async () => {
    setSaving(true);
    try {
      await api.post("/settings/llm", llmSettings);
      alert("LLM settings saved successfully!");
    } catch (error) {
      console.error("Failed to save LLM settings:", error);
      alert("Failed to save LLM settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    localStorage.setItem("darkMode", enabled.toString());
    
    if (enabled) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LLM API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI & LLM Configuration
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
                <Label htmlFor="default-model">Default Model</Label>
                <select
                  id="default-model"
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  value={llmSettings.defaultModel}
                  onChange={(e) => setLlmSettings({ ...llmSettings, defaultModel: e.target.value })}
                >
                  <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                  <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
                  <option value="claude-3-5-sonnet-20241022">Claude Sonnet 3.5</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="o1">O1</option>
                  <option value="o1-mini">O1 Mini</option>
                </select>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save API Keys"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Toggle dark theme</p>
              </div>
              <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
            </div>
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
                defaultValue="http://localhost:3000"
                placeholder="https://api.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-url">WebSocket URL</Label>
              <Input
                id="ws-url"
                defaultValue="ws://localhost:3000"
                placeholder="wss://api.example.com"
              />
            </div>
            <Button>Save Configuration</Button>
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
            <Button variant="outline">Test Connection</Button>
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
