import { useState, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, ExternalLink, Terminal, Globe, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTools, useUploadToolFile, useDeleteTool, useRefreshTools } from "@/hooks/useTools";
import ToolCard from "@/components/tools/ToolCard";
import MetasploitCard from "@/components/tools/MetasploitCard";
import ConfigureToolDialog from "@/components/tools/ConfigureToolDialog";
import ToolWorkflowDesigner from "@/components/tools/ToolWorkflowDesigner";
import { Tool } from "@/services/tools";

export default function Tools() {
  const { tools, loading, refetch } = useTools();
  const { upload, uploading } = useUploadToolFile();
  const { deleteTool } = useDeleteTool();
  const { refresh, refreshing } = useRefreshTools();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [configureDialogOpen, setConfigureDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out test/invalid tools from production display
  const isValidTool = (tool: Tool) => {
    const hasInvalidName = tool.name.toLowerCase().includes('invalid');
    const hasInvalidPath =
      tool.configPath?.includes('/invalid/') ||
      tool.command?.includes('/invalid/') ||
      (tool.metadata && JSON.stringify(tool.metadata).includes('/invalid/'));
    return !hasInvalidName && !hasInvalidPath;
  };

  const validTools = tools.filter(isValidTool);

  const stats = {
    total: validTools.length,
    running: validTools.filter((t) => t.status === "running").length,
    available: validTools.filter((t) => t.status === "available").length,
  };

  const handleConfigure = (tool: Tool) => {
    setSelectedTool(tool);
    setConfigureDialogOpen(true);
  };

  const handleDelete = async (toolId: string) => {
    try {
      await deleteTool(toolId);
      toast.success("Tool deleted successfully");
      await refetch();
    } catch (err) {
      // Error handled via toast
      toast.error(`Failed to delete tool: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleSaveConfig = async (toolId: string, targetId: string, params: any) => {
    // TODO: Implement saving parameters to tool metadata
    // Debug logging removed
  };

  const handleRefreshRegistry = async () => {
    try {
      const result = await refresh();
      toast.success(
        `Registry refreshed: ${result.added} added, ${result.updated} updated (${result.summary.installed}/${result.total} installed)`
      );
      await refetch();
    } catch (err) {
      toast.error(`Failed to refresh registry: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTool) return;

    try {
      await upload(selectedTool.id, file);
      toast.success(`File uploaded successfully for ${selectedTool.name}`);
      await refetch();
      setUploadDialogOpen(false);
      setSelectedTool(null);
    } catch (err) {
      // Error handled via toast
      toast.error(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const statCards = [
    { label: "Total Tools", value: stats.total, color: "text-foreground" },
    { label: "Running", value: stats.running, color: "text-success" },
    { label: "Available", value: stats.available, color: "text-info" },
  ];

  return (
    <div className="p-8">
      <PageHeader
        icon={Wrench}
        title="Security Tools"
        description="Manage and launch security tooling, frameworks, and workspaces."
        actions={
          <Button
            onClick={handleRefreshRegistry}
            disabled={refreshing}
            variant="outline"
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            {refreshing ? 'Refreshing...' : 'Refresh Registry'}
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-card p-6 rounded-lg shadow-sm border border-border"
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{card.label}</h3>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className={`text-3xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Featured Tools */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-1 bg-primary rounded-full" />
          <h2 className="text-xl font-semibold">Featured Tools</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-info shadow-sm hover:shadow-lg transition-shadow bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10 text-info">
                  <Globe aria-hidden="true" className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold">Kasm Workspaces</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    Browser-based Security Environments
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Access full desktop environments with pre-installed security tools in isolated containerized workspaces
              </p>
              <Button
                onClick={() => window.open("https://kasm.local", "_blank")}
                className="w-full"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4 mr-2" />
                Launch Kasm
              </Button>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning shadow-sm hover:shadow-lg transition-shadow bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10 text-warning">
                  <Terminal aria-hidden="true" className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold">PowerShell Empire</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    Post-Exploitation Framework
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manage command and control operations with agents, listeners, and powerful post-exploitation capabilities
              </p>
              <Button
                onClick={() => window.open("http://localhost:1337", "_blank")}
                className="w-full"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4 mr-2" />
                Open Console
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tools Tabs */}
      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList>
          <TabsTrigger value="catalog">Tools Catalog</TabsTrigger>
          <TabsTrigger value="workflows">Workflow Designer</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-live="polite">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          ) : validTools.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No tools configured"
              description="Contact an administrator to add security tools to the registry."
            />
          ) : (
            <>
              {/* Metasploit tools get special treatment */}
              {validTools
                .filter((tool) => tool.name.toLowerCase().includes("metasploit"))
                .map((tool) => (
                  <div key={tool.id} className="mb-6">
                    <MetasploitCard tool={tool} />
                  </div>
                ))}

              {/* Other tools in grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {validTools
                  .filter((tool) => !tool.name.toLowerCase().includes("metasploit"))
                  .map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      onConfigure={handleConfigure}
                      onDelete={handleDelete}
                    />
                  ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <ToolWorkflowDesigner />
        </TabsContent>
      </Tabs>

      {/* Configure Dialog */}
      <ConfigureToolDialog
        open={configureDialogOpen}
        tool={selectedTool}
        onClose={() => {
          setConfigureDialogOpen(false);
          setSelectedTool(null);
        }}
        onSave={handleSaveConfig}
      />

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File for {selectedTool?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tool-file">Select File</Label>
              <Input
                id="tool-file"
                type="file"
                accept=".jar,.zip,.tar,.gz"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: JAR, ZIP, TAR, GZ (max 100MB)
              </p>
            </div>
            {uploading && (
              <p className="text-sm text-info">Uploading... Please wait.</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setUploadDialogOpen(false);
                setSelectedTool(null);
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
