import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, ExternalLink, Terminal, Globe } from "lucide-react";
import { useTools, useUploadToolFile, useDeleteTool } from "@/hooks/useTools";
import ToolCard from "@/components/tools/ToolCard";
import MetasploitCard from "@/components/tools/MetasploitCard";
import ConfigureToolDialog from "@/components/tools/ConfigureToolDialog";
import { Tool } from "@/services/tools";

export default function Tools() {
  const { tools, loading, refetch } = useTools();
  const { upload, uploading } = useUploadToolFile();
  const { deleteTool } = useDeleteTool();
  
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [configureDialogOpen, setConfigureDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = {
    total: tools.length,
    running: tools.filter((t) => t.status === "running").length,
    available: tools.filter((t) => t.status === "available").length,
  };

  const handleConfigure = (tool: Tool) => {
    setSelectedTool(tool);
    setConfigureDialogOpen(true);
  };

  const handleDelete = async (toolId: string) => {
    try {
      await deleteTool(toolId);
      alert("Tool deleted successfully");
      await refetch();
    } catch (err) {
      console.error("Failed to delete tool:", err);
      alert("Failed to delete tool: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleSaveConfig = async (toolId: string, targetId: string, params: any) => {
    // TODO: Implement saving parameters to tool metadata
    console.log("Saving config:", { toolId, targetId, params });
  };


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTool) return;

    try {
      await upload(selectedTool.id, file);
      alert(`File uploaded successfully for ${selectedTool.name}`);
      await refetch();
      setUploadDialogOpen(false);
      setSelectedTool(null);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Security Tools</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Tools</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Running</h3>
          <p className="text-3xl font-bold text-green-600">{stats.running}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Available</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.available}</p>
        </div>
      </div>

      {/* Featured Tools */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Featured Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Kasm Workspaces
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Access full desktop environments with pre-installed security tools
              </p>
              <Button onClick={() => window.open("https://kasm.local", "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Launch Kasm
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                PowerShell Empire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Manage command and control operations
              </p>
              <Button onClick={() => window.open("http://localhost:1337", "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Console
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tools Catalog */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Tools Catalog</h2>
        {loading ? (
          <p className="text-gray-500">Loading tools...</p>
        ) : tools.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No tools configured</p>
            <p className="text-sm text-gray-500">Contact administrator to add security tools</p>
          </div>
        ) : (
          <>
            {/* Metasploit tools get special treatment */}
            {tools
              .filter((tool) => tool.name.toLowerCase().includes("metasploit"))
              .map((tool) => (
                <div key={tool.id} className="mb-6">
                  <MetasploitCard tool={tool} />
                </div>
              ))}

            {/* Other tools in grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools
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
      </div>

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
              <p className="text-xs text-gray-500 mt-1">
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
