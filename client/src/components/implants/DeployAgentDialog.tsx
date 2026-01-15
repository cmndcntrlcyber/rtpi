import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download,
  Link2,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Terminal,
  Monitor,
} from "lucide-react";

interface Feature {
  name: string;
  description: string;
}

interface DeployAgentDialogProps {
  open: boolean;
  onClose: () => void;
  platform: "windows" | "linux";
}

export default function DeployAgentDialog({
  open,
  onClose,
  platform,
}: DeployAgentDialogProps) {
  // Form state
  const [name, setName] = useState("");
  const [architecture, setArchitecture] = useState("x64");
  const [implantType, setImplantType] = useState("general");
  const [controllerUrl, setControllerUrl] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [autonomyLevel, setAutonomyLevel] = useState(1);

  // Token options
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [tokenDescription, setTokenDescription] = useState("");

  // Available features
  const [availableFeatures, setAvailableFeatures] = useState<Feature[]>([]);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedBundle, setGeneratedBundle] = useState<{
    id: string;
    downloadUrl: string;
    fileSize: number;
  } | null>(null);
  const [generatedToken, setGeneratedToken] = useState<{
    downloadUrl: string;
    expiresAt: string;
    maxDownloads: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName(`agent-${Date.now().toString(36)}`);
      setArchitecture("x64");
      setImplantType("general");
      setControllerUrl(window.location.origin);
      setSelectedFeatures([]);
      setAutonomyLevel(1);
      setMaxDownloads(1);
      setExpiresInHours(24);
      setTokenDescription("");
      setGeneratedBundle(null);
      setGeneratedToken(null);
      setError(null);
      setCopied(false);

      // Fetch available features
      fetchFeatures();
    }
  }, [open]);

  const fetchFeatures = async () => {
    try {
      const response = await fetch("/api/v1/rust-nexus/agents/features", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableFeatures(data.features || []);
      }
    } catch (err) {
      // Error already shown via toast
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/rust-nexus/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          platform,
          architecture,
          features: selectedFeatures,
          implantType,
          controllerUrl,
          autonomyLevel,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate agent");
      }

      const data = await response.json();
      setGeneratedBundle({
        id: data.bundle.id,
        downloadUrl: data.bundle.downloadUrl,
        fileSize: data.bundle.fileSize,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (generatedBundle) {
      window.location.href = generatedBundle.downloadUrl;
    }
  };

  const handleGenerateToken = async () => {
    if (!generatedBundle) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/rust-nexus/agents/bundles/${generatedBundle.id}/generate-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            maxDownloads,
            expiresInHours,
            description: tokenDescription,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate token");
      }

      const data = await response.json();
      setGeneratedToken({
        downloadUrl: data.token.downloadUrl,
        expiresAt: data.token.expiresAt,
        maxDownloads: data.token.maxDownloads,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Error already shown via toast
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {platform === "windows" ? (
              <Monitor className="h-5 w-5 text-blue-500" />
            ) : (
              <Terminal className="h-5 w-5 text-orange-500" />
            )}
            Deploy {platform === "windows" ? "Windows" : "Linux"} Agent
          </DialogTitle>
          <DialogDescription>
            Generate a pre-configured agent bundle with certificates and
            configuration ready to deploy.
          </DialogDescription>
        </DialogHeader>

        {!generatedBundle ? (
          // Configuration Form
          <div className="space-y-6 py-4">
            {/* Agent Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-agent"
              />
            </div>

            {/* Architecture & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Architecture</Label>
                <Select value={architecture} onValueChange={setArchitecture}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="x64">x64 (64-bit)</SelectItem>
                    <SelectItem value="x86">x86 (32-bit)</SelectItem>
                    {platform === "linux" && (
                      <SelectItem value="arm64">ARM64</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Implant Type</Label>
                <Select value={implantType} onValueChange={setImplantType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Purpose</SelectItem>
                    <SelectItem value="reconnaissance">Reconnaissance</SelectItem>
                    <SelectItem value="exploitation">Exploitation</SelectItem>
                    <SelectItem value="exfiltration">Exfiltration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Controller URL */}
            <div className="grid gap-2">
              <Label htmlFor="controllerUrl">Controller URL</Label>
              <Input
                id="controllerUrl"
                value={controllerUrl}
                onChange={(e) => setControllerUrl(e.target.value)}
                placeholder="https://rtpi.example.com:8443"
              />
              <p className="text-xs text-muted-foreground">
                The URL agents will connect to for C2 communication
              </p>
            </div>

            {/* Autonomy Level */}
            <div className="grid gap-2">
              <Label>
                Autonomy Level: <span className="font-bold">{autonomyLevel}</span>
              </Label>
              <input
                type="range"
                min="1"
                max="10"
                value={autonomyLevel}
                onChange={(e) => setAutonomyLevel(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                1 = Manual control only, 10 = Full autonomous operation
              </p>
            </div>

            {/* Features */}
            {availableFeatures.length > 0 && (
              <div className="grid gap-2">
                <Label>Build Features (Optional)</Label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg">
                  {availableFeatures.map((feature) => (
                    <div key={feature.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={feature.name}
                        checked={selectedFeatures.includes(feature.name)}
                        onCheckedChange={() => toggleFeature(feature.name)}
                      />
                      <label
                        htmlFor={feature.name}
                        className="text-sm cursor-pointer"
                        title={feature.description}
                      >
                        {feature.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-100 text-red-800 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        ) : (
          // Generated Bundle Result
          <Tabs defaultValue="download" className="py-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="download">
                <Download className="h-4 w-4 mr-2" />
                Download
              </TabsTrigger>
              <TabsTrigger value="share">
                <Link2 className="h-4 w-4 mr-2" />
                Share Link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="download" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Bundle Ready</CardTitle>
                  <CardDescription>
                    Your agent bundle has been generated and is ready to download.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        {platform} / {architecture} •{" "}
                        {formatFileSize(generatedBundle.fileSize)}
                      </p>
                    </div>
                    <Badge variant="secondary">{implantType}</Badge>
                  </div>

                  <Button onClick={handleDownload} className="w-full" size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    Download Bundle (.zip)
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="share" className="space-y-4 mt-4">
              {!generatedToken ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Generate Shareable Link</CardTitle>
                    <CardDescription>
                      Create a time-limited download link for customers or external
                      deployment.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Max Downloads</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={maxDownloads}
                          onChange={(e) => setMaxDownloads(Number(e.target.value))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Expires In (hours)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="720"
                          value={expiresInHours}
                          onChange={(e) => setExpiresInHours(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Description (Optional)</Label>
                      <Input
                        value={tokenDescription}
                        onChange={(e) => setTokenDescription(e.target.value)}
                        placeholder="Customer name or deployment target"
                      />
                    </div>

                    <Button
                      onClick={handleGenerateToken}
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Generate Link
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      Link Generated
                    </CardTitle>
                    <CardDescription>
                      Share this link with customers for one-click agent download.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Input
                        value={generatedToken.downloadUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(generatedToken.downloadUrl)}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(generatedToken.downloadUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Max Downloads</p>
                        <p className="font-medium">{generatedToken.maxDownloads}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expires</p>
                        <p className="font-medium">
                          {new Date(generatedToken.expiresAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          {!generatedBundle ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={loading || !name || !controllerUrl}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Agent
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
