import { useState, useEffect } from "react";
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
  Database,
  ArrowLeftRight,
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

export default function WorkbenchTab() {
  const [health, setHealth] = useState<WorkbenchHealth | null>(null);
  const [collections, setCollections] = useState<WorkbenchCollection[]>([]);
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);
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
      console.error("Failed to fetch collections:", error);
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
      } else {
        alert("Failed to create collection");
      }
    } catch (error) {
      console.error("Failed to create collection:", error);
      alert("Failed to create collection");
    }
  };

  const pushTechniques = async () => {
    if (selectedTechniques.length === 0) {
      alert("Please select techniques to push");
      return;
    }

    try {
      setSyncing(true);
      const response = await fetch("/api/v1/workbench/sync/push-techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ techniqueIds: selectedTechniques }),
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
        alert(data.error || "Failed to push techniques");
      }
    } catch (error) {
      console.error("Failed to push techniques:", error);
      alert("Failed to push techniques");
    } finally {
      setSyncing(false);
    }
  };

  const pullTechniques = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/v1/workbench/sync/pull-techniques", {
        method: "POST",
        credentials: "include",
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
        alert(data.error || "Failed to pull techniques");
      }
    } catch (error) {
      console.error("Failed to pull techniques:", error);
      alert("Failed to pull techniques");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                ATT&CK Workbench Connection
              </CardTitle>
              <CardDescription className="mt-1">
                Manage custom ATT&CK datasets and collections
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Bidirectional Sync
          </CardTitle>
          <CardDescription>
            Push RTPI techniques to Workbench or pull custom techniques from Workbench
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={pushTechniques}
              disabled={syncing || health?.status !== "connected"}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              Push to Workbench
            </Button>
            <Button
              onClick={pullTechniques}
              disabled={syncing || health?.status !== "connected"}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Pull from Workbench
            </Button>
          </div>

          {/* Sync Result */}
          {syncResult && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
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
                        {syncResult.type === "push" ? "→ Workbench" : "← Workbench"}
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
                          <li key={idx}>• {error}</li>
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workbench Collections</CardTitle>
              <CardDescription>Custom ATT&CK datasets and collections</CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={health?.status !== "connected"}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Collection
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Collection</DialogTitle>
                  <DialogDescription>
                    Create a new collection in ATT&CK Workbench
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="collection-name">Collection Name</Label>
                    <Input
                      id="collection-name"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="e.g., Operation XYZ Custom Techniques"
                    />
                  </div>
                  <div>
                    <Label htmlFor="collection-desc">Description</Label>
                    <Textarea
                      id="collection-desc"
                      value={newCollectionDesc}
                      onChange={(e) => setNewCollectionDesc(e.target.value)}
                      placeholder="Describe this collection..."
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createCollection} disabled={!newCollectionName}>
                    Create Collection
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading collections...</div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No collections found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a new collection to get started
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
                    <TableCell className="font-medium">{collection.stix.name}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {collection.stix.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
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
                      >
                        {collection.workspace.workflow?.state || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost">
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
