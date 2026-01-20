import { useState, useRef, useEffect } from "react";
import { Download, Upload, ExternalLink, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { exportToNavigator, generateNavigatorLayer } from "@/utils/attack-navigator-export";
import type { NavigatorTechnique } from "@shared/types/attack";

interface ATTCKNavigatorProps {
  operationId?: string;
}

export default function ATTCKNavigator({ operationId }: ATTCKNavigatorProps) {
  const [view, setView] = useState<"iframe" | "custom">("iframe");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The official MITRE ATT&CK Navigator hosted by MITRE
  const navigatorUrl = "https://mitre-attack.github.io/attack-navigator/";

  const handleExportLayer = async () => {
    if (!operationId) {
      toast.error("No operation selected");
      return;
    }

    try {
      setLoading(true);

      // Get operation coverage (mapped techniques)
      const coverage = await api.get<any[]>(`/attack/operations/${operationId}/coverage`);

      if (!coverage || coverage.length === 0) {
        toast.warning("No techniques mapped to this operation yet");
        return;
      }

      // Extract techniques for export
      const techniques: NavigatorTechnique[] = coverage.map((mapping: any) => ({
        attackId: mapping.technique.attackId,
        name: mapping.technique.name,
        description: mapping.technique.description,
        killChainPhases: mapping.technique.killChainPhases,
        platforms: mapping.technique.platforms,
      }));

      // Generate and download the layer
      exportToNavigator(techniques, {
        layerName: `Operation ${operationId}`,
        description: `ATT&CK techniques for operation ${operationId}`,
        filename: `operation-${operationId}-attack-layer.json`,
      });

      toast.success("Navigator layer exported successfully");
    } catch (error: any) {
      console.error("Failed to export layer:", error);
      toast.error("Failed to export layer");
    } finally {
      setLoading(false);
    }
  };

  const handleImportLayer = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const content = await file.text();
      const layer = JSON.parse(content);

      // Validate it's a navigator layer
      if (!layer.techniques || !Array.isArray(layer.techniques)) {
        toast.error("Invalid navigator layer file");
        return;
      }

      // Load the layer into the iframe if in iframe mode
      if (view === "iframe" && iframeRef.current) {
        // Post message to navigator iframe to load the layer
        // Note: This requires the navigator to be configured to accept postMessage
        iframeRef.current.contentWindow?.postMessage(
          {
            type: "loadLayer",
            layer: layer,
          },
          "*"
        );
      }

      toast.success(`Loaded layer with ${layer.techniques.length} techniques`);
    } catch (error: any) {
      console.error("Failed to import layer:", error);
      toast.error("Failed to import layer file");
    } finally {
      setLoading(false);
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRefreshIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">ATT&CK Navigator</h3>
          </div>

          <div className="flex items-center gap-2">
            {operationId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLayer}
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Layer
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleImportLayer}
              disabled={loading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Layer
            </Button>

            {view === "iframe" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshIframe}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={navigatorUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </Card>

      {/* Navigator Content */}
      <Tabs value={view} onValueChange={(v) => setView(v as "iframe" | "custom")}>
        <TabsList>
          <TabsTrigger value="iframe">Navigator (Embedded)</TabsTrigger>
          <TabsTrigger value="custom">Custom View</TabsTrigger>
        </TabsList>

        <TabsContent value="iframe" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <iframe
              ref={iframeRef}
              src={navigatorUrl}
              className="w-full border-0"
              style={{ height: "calc(100vh - 280px)", minHeight: "600px" }}
              title="MITRE ATT&CK Navigator"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          <Card className="p-8">
            <div className="text-center space-y-4">
              <Layers className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Custom ATT&CK View</h3>
                <p className="text-muted-foreground">
                  Custom React-based ATT&CK visualization coming soon.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  For now, use the embedded Navigator or export layer files.
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button onClick={() => setView("iframe")}>
                  Switch to Embedded Navigator
                </Button>
                {operationId && (
                  <Button variant="outline" onClick={handleExportLayer}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Current Layer
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <div className="text-blue-600 dark:text-blue-400 mt-0.5">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              About ATT&CK Navigator
            </p>
            <p className="text-blue-800 dark:text-blue-200">
              The MITRE ATT&CK Navigator is a web-based tool for annotating and exploring ATT&CK matrices.
              Export layer files from RTPI operations to visualize technique coverage, or import existing layers for analysis.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
