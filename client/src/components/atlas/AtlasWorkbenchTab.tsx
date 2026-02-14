import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Brain,
  ArrowLeftRight,
  ExternalLink,
} from "lucide-react";

interface WorkbenchCollection {
  stix: {
    id: string;
    name: string;
    description: string;
    x_mitre_version?: string;
  };
  workspace: {
    workflow?: {
      state: string;
    };
  };
}

interface WorkbenchHealth {
  status: "connected" | "disconnected";
  message: string;
  apiUrl: string;
}

export default function AtlasWorkbenchTab() {
  const [health, setHealth] = useState<WorkbenchHealth | null>(null);
  const [collections, setCollections] = useState<WorkbenchCollection[]>([]);
  const [selectedTechniques, _setSelectedTechniques] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // New collection dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");

  // Sync result state
  const [syncResult, setSyncResult] = useState<{
    type: "push" | "pull";
    message: string;
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    checkHealth();
    fetchCollections();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await fetch("/api/v1/workbench/health", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      } else {
        setHealth({
          status: "disconnected",
          message: "Unable to reach Workbench API",
          apiUrl: "http://localhost:3010",
        });
      }
    } catch (error) {
      console.error("Health check failed:", error);
      setHealth({
        status: "disconnected",
        message: "Connection error",
        apiUrl: "http://localhost:3010",
      });
    }
  };

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/workbench/collections", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (error) {
      // Error already shown via toast
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async () => {
    try {
      const response = await fetch("/api/v1/workbench/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stix: {
            id: `x-mitre-collection--${crypto.randomUUID()}`,
            type: "x-mitre-collection",
            name: newCollectionName,
            description: newCollectionDesc,
            x_mitre_version: "1.0",
            x_mitre_framework: "ATLAS",
          },
          workspace: {
            workflow: {
              state: "work-in-progress",
            },
          },
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        setNewCollectionName("");
        setNewCollectionDesc("");
        fetchCollections();
        toast.success("ATLAS collection created successfully");
      } else {
        toast.error("Failed to create ATLAS collection");
      }
    } catch (error) {
      toast.error("Failed to create ATLAS collection");
    }
  };

  const pushTechniques = async () => {
    if (selectedTechniques.length === 0) {
      toast.warning("Please select ATLAS techniques to push");
      return;
    }

    try {
      setSyncing(true);
      const response = await fetch("/api/v1/workbench/sync/push-techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          techniqueIds: selectedTechniques,
          framework: "atlas",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSyncResult({
          type: "push",
          message: data.message,
          success: data.success,
          failed: data.failed,
          errors: data.errors || [],
        });
      } else {
        toast.error(data.error || "Failed to push ATLAS techniques");
      }
    } catch (error) {
      toast.error("Failed to push ATLAS techniques");
    } finally {
      setSyncing(false);
    }
  };

  const pullTechniques = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/v1/workbench/sync/pull-techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ framework: "atlas" }),
      });

      const data = await response.json();

      if (response.ok) {
        setSyncResult({
          type: "pull",
          message: data.message,
          success: data.imported,
          failed: data.failed,
          errors: data.errors || [],
        });
      } else {
        toast.error(data.error || "Failed to pull ATLAS techniques");
      }
    } catch (error) {
      toast.error("Failed to pull ATLAS techniques");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                ATLAS Workbench Connection
              </CardTitle>
              <CardDescription className="mt-1">
                Manage custom ATLAS ML/AI adversarial technique datasets and collections
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {health?.status === "connected" ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={checkHealth}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {health && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">{health.message}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">API URL:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{health.apiUrl}</code>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">ATLAS STIX Data:</span>
                <a
                  href="https://github.com/mitre-atlas/atlas-navigator-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-800 inline-flex items-center gap-1"
                >
                  atlas-navigator-data
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Operations */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-purple-600" />
            ATLAS Bidirectional Sync
          </CardTitle>
          <CardDescription>
            Push RTPI ATLAS techniques to Workbench or pull custom ATLAS techniques from Workbench
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={pushTechniques}
              disabled={syncing || health?.status !== "connected"}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Push ATLAS to Workbench
            </Button>
            <Button
              onClick={pullTechniques}
              disabled={syncing || health?.status !== "connected"}
              variant="outline"
              className="flex-1 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              <Download className="h-4 w-4 mr-2" />
              Pull ATLAS from Workbench
            </Button>
          </div>

          {/* Sync Result */}
          {syncResult && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-start gap-2">
                {syncResult.failed === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{syncResult.message}</p>
                  <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Success:</span>{" "}
                      <span className="font-medium text-green-600">{syncResult.success}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Failed:</span>{" "}
                      <span className="font-medium text-red-600">{syncResult.failed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Direction:</span>{" "}
                      <span className="font-medium">
                        {syncResult.type === "push" ? "-> Workbench" : "<- Workbench"}
                      </span>
                    </div>
                  </div>
                  {syncResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm text-muted-foreground cursor-pointer">
                        View errors ({syncResult.errors.length})
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-red-600">
                        {syncResult.errors.map((error, idx) => (
                          <li key={idx}>- {error}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collections Management */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                ATLAS Workbench Collections
              </CardTitle>
              <CardDescription>Custom ATLAS adversarial ML datasets and collections</CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={health?.status !== "connected"} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Collection
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    Create New ATLAS Collection
                  </DialogTitle>
                  <DialogDescription>
                    Create a new collection in the ATLAS Workbench
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="collection-name">Collection Name</Label>
                    <Input
                      id="collection-name"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="e.g., ML Model Extraction Techniques"
                    />
                  </div>
                  <div>
                    <Label htmlFor="collection-desc">Description</Label>
                    <Textarea
                      id="collection-desc"
                      value={newCollectionDesc}
                      onChange={(e) => setNewCollectionDesc(e.target.value)}
                      placeholder="Describe this ATLAS collection..."
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={createCollection}
                    disabled={!newCollectionName}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Create Collection
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading ATLAS collections...</div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto text-purple-300 mb-3" />
              <p className="text-muted-foreground">No ATLAS collections found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a new ATLAS collection or download STIX data from the{" "}
                <a
                  href="https://github.com/mitre-atlas/atlas-navigator-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-800 underline"
                >
                  atlas-navigator-data
                </a>{" "}
                repository to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow key={collection.stix.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-600" />
                        {collection.stix.name}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {collection.stix.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-purple-300 text-purple-700 dark:text-purple-400">
                        {collection.stix.x_mitre_version || "1.0"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          collection.workspace.workflow?.state === "work-in-progress"
                            ? "secondary"
                            : "default"
                        }
                        className={
                          collection.workspace.workflow?.state !== "work-in-progress"
                            ? "bg-purple-600"
                            : ""
                        }
                      >
                        {collection.workspace.workflow?.state || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-purple-600 hover:text-purple-800">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
