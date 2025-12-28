import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Download, Trash2, RefreshCw, Circle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OllamaModel {
  id: string;
  modelName: string;
  modelTag: string;
  modelSize: number | null;
  parameterSize: string | null;
  quantization: string | null;
  downloadedAt: string;
  lastUsed: string | null;
  usageCount: number;
  status: "available" | "downloading" | "loading" | "loaded" | "unloaded" | "error";
  metadata: Record<string, any>;
}

const statusConfig = {
  available: { icon: CheckCircle2, color: "text-green-500", label: "Available" },
  downloading: { icon: Loader2, color: "text-blue-500", label: "Downloading", spin: true },
  loading: { icon: Loader2, color: "text-blue-500", label: "Loading", spin: true },
  loaded: { icon: Circle, color: "text-green-500", label: "Loaded" },
  unloaded: { icon: Circle, color: "text-gray-400", label: "Unloaded" },
  error: { icon: XCircle, color: "text-red-500", label: "Error" },
};

export function ModelManager() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState("");
  const [downloading, setDownloading] = useState<Record<string, number>>({});

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async (showError = true) => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/ollama/models", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load models");
      const data = await response.json();
      setModels(data);
    } catch (error) {
      if (showError) {
        toast.error("Failed to load models. Is Ollama running?");
      }
      console.error("Load models error:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncModels = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/v1/ollama/models/sync", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to sync models");
      const result = await response.json();

      toast.success(`Sync Complete: Added ${result.added}, Updated ${result.updated}, Removed ${result.removed}`);

      await loadModels();
    } catch (error) {
      toast.error("Failed to sync models with Ollama");
      console.error("Sync error:", error);
    } finally {
      setSyncing(false);
    }
  };

  const downloadModel = async () => {
    if (!newModelName.trim()) {
      toast.error("Please enter a model name");
      return;
    }

    try {
      setDownloading(prev => ({ ...prev, [newModelName]: 0 }));
      setDownloadDialogOpen(false);

      const response = await fetch("/api/v1/ollama/models/pull", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName: newModelName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to download model");
      }

      const result = await response.json();

      if (result.success) {
        toast.success(`Downloading ${newModelName}...`);

        // Poll for status updates
        pollModelStatus(newModelName);
      } else {
        throw new Error(result.error || "Download failed");
      }

      setNewModelName("");
    } catch (error: any) {
      setDownloading(prev => {
        const next = { ...prev };
        delete next[newModelName];
        return next;
      });
      toast.error(`Download Failed: ${error.message}`);
    }
  };

  const pollModelStatus = async (modelName: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/ollama/models/${encodeURIComponent(modelName)}/status`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to get status");

        const model = await response.json();

        if (model.status === "available") {
          clearInterval(interval);
          setDownloading(prev => {
            const next = { ...prev };
            delete next[modelName];
            return next;
          });
          toast.success(`${modelName} is now available`);
          await loadModels(false); // Don't show error toast on silent refresh
        } else if (model.status === "error") {
          clearInterval(interval);
          setDownloading(prev => {
            const next = { ...prev };
            delete next[modelName];
            return next;
          });
          toast.error(`Failed to download ${modelName}`);
          await loadModels(false); // Don't show error toast on silent refresh
        }
      } catch (error) {
        clearInterval(interval);
        setDownloading(prev => {
          const next = { ...prev };
          delete next[modelName];
          return next;
        });
        // Silent failure - don't show toast here as it's a polling error
      }
    }, 2000);

    // Stop polling after 10 minutes
    setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
  };

  const deleteModel = async (modelName: string) => {
    try {
      const response = await fetch(`/api/v1/ollama/models/${encodeURIComponent(modelName)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete model");
      }

      toast.success(`${modelName} has been removed`);

      await loadModels(false); // Don't show error toast on silent refresh
    } catch (error: any) {
      toast.error(`Delete Failed: ${error.message}`);
    } finally {
      setDeleteDialogOpen(false);
      setSelectedModel(null);
    }
  };

  const unloadModel = async (modelName: string) => {
    try {
      const response = await fetch(`/api/v1/ollama/models/${encodeURIComponent(modelName)}/unload`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unload model");
      }

      toast.success(`${modelName} has been unloaded from memory`);

      await loadModels(false); // Don't show error toast on silent refresh
    } catch (error: any) {
      toast.error(`Unload Failed: ${error.message}`);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 ** 2);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusBadge = (status: OllamaModel["status"]) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color} ${config.spin ? 'animate-spin' : ''}`} />
        {config.label}
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={syncModels} disabled={syncing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Models
          </Button>
        </div>

        <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download Model
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download Model</DialogTitle>
              <DialogDescription>
                Enter the name of the model to download from Ollama library
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="model-name">Model Name</Label>
                <Input
                  id="model-name"
                  placeholder="e.g., llama3:8b, qwen2.5-coder:7b"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && downloadModel()}
                />
                <p className="text-sm text-muted-foreground">
                  Popular models: llama3:8b, qwen2.5-coder:7b, mistral:7b
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={downloadModel}>Download</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {Object.entries(downloading).map(([modelName, progress]) => (
        <div key={modelName} className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{modelName}</span>
            <Badge variant="outline">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Downloading
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      ))}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Parameters</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No models found. Download a model to get started.
                </TableCell>
              </TableRow>
            ) : (
              models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium">
                    {model.modelName}
                    {model.modelTag !== "latest" && (
                      <span className="text-muted-foreground">:{model.modelTag}</span>
                    )}
                  </TableCell>
                  <TableCell>{formatBytes(model.modelSize)}</TableCell>
                  <TableCell>{model.parameterSize || "Unknown"}</TableCell>
                  <TableCell>{getStatusBadge(model.status)}</TableCell>
                  <TableCell>{model.usageCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {model.lastUsed
                      ? formatDistanceToNow(new Date(model.lastUsed), { addSuffix: true })
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {model.status === "loaded" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unloadModel(model.modelName)}
                        >
                          Unload
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedModel(model.modelName);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedModel}</strong>?
              This will remove the model from your system and free up disk space.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedModel(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedModel && deleteModel(selectedModel)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
