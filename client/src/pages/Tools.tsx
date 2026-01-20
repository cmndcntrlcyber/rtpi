import { useState, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, ExternalLink, Terminal, Globe } from "lucide-react";
import { useTools, useUploadToolFile, useDeleteTool } from "@/hooks/useTools";
import ToolCard from "@/components/tools/ToolCard";
import MetasploitCard from "@/components/tools/MetasploitCard";
import ConfigureToolDialog from "@/components/tools/ConfigureToolDialog";
import ToolWorkflowDesigner from "@/components/tools/ToolWorkflowDesigner";
import { Tool } from "@/services/tools";

export default function Tools() {
  const { tools, loading, refetch } = useTools();
  const { upload, uploading } = useUploadToolFile();
  const { deleteTool } = useDeleteTool();

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

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Security Tools</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Tools</h3>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Running</h3>
          <p className="text-3xl font-bold text-green-600">{stats.running}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Available</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.available}</p>
        </div>
      </div>

      {/* Featured Tools */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-1 bg-primary rounded-full" />
          <h2 className="text-xl font-semibold">Featured Tools</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-blue-50/50 to-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Globe className="h-6 w-6" />
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
                <ExternalLink className="h-4 w-4 mr-2" />
                Launch Kasm
              </Button>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-purple-50/50 to-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                  <Terminal className="h-6 w-6" />
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
                <ExternalLink className="h-4 w-4 mr-2" />
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
            <p className="text-muted-foreground">Loading tools...</p>
          ) : validTools.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-border">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No tools configured</p>
              <p className="text-sm text-muted-foreground">Contact administrator to add security tools</p>
            </div>
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
              <p className="text-sm text-blue-600">Uploading... Please wait.</p>
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
