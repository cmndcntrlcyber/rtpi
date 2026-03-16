import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Plus,
  Trash2,
  Save,
  FolderPlus,
  GripVertical,
  X,
  FlaskConical,
  Download,
  Copy,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { Technique } from "@shared/types/attack";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Operation {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface SelectedTechnique extends Technique {
  order: number;
  notes?: string;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  techniqueIds: string[];
}

export default function PlannerTab() {
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [selectedTechniques, setSelectedTechniques] = useState<SelectedTechnique[]>([]);
  const [filteredTechniques, setFilteredTechniques] = useState<Technique[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string>("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTactic, setFilterTactic] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");

  // Dialog states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");

  // Test plan state
  const [testPlanDialogOpen, setTestPlanDialogOpen] = useState(false);
  const [testPlanMarkdown, setTestPlanMarkdown] = useState("");
  const [testPlanGenerating, setTestPlanGenerating] = useState(false);
  const [testPlanError, setTestPlanError] = useState<string | null>(null);
  const [testPlanMetadata, setTestPlanMetadata] = useState<{
    provider?: string;
    model?: string;
    tokensUsed?: number;
    durationMs?: number;
    truncated?: boolean;
  } | null>(null);
  const [testPlanContext, setTestPlanContext] = useState("");
  const [testPlanPlatform, setTestPlanPlatform] = useState("all");

  // OPSEC constraints state
  const [opsecDialogOpen, setOpsecDialogOpen] = useState(false);
  const [opsecConstraints, setOpsecConstraints] = useState<string[]>([]);
  const [newConstraint, setNewConstraint] = useState("");

  // Drag state
  const [draggedTechnique, setDraggedTechnique] = useState<Technique | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch all techniques
  const fetchTechniques = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/attack/techniques?subtechniques=exclude", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTechniques(data);
        setFilteredTechniques(data);
      }
    } catch (error) {
      // Error already shown via toast
    } finally {
      setLoading(false);
    }
  };

  // Fetch operations
  const fetchOperations = async () => {
    try {
      const response = await fetch("/api/v1/operations", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setOperations(data.operations || []);
      }
    } catch (error) {
      // Error already shown via toast
    }
  };

  // Fetch collections (from localStorage for now)
  const fetchCollections = () => {
    const stored = localStorage.getItem("attack-collections");
    if (stored) {
      setCollections(JSON.parse(stored));
    }
  };

  useEffect(() => {
    fetchTechniques();
    fetchOperations();
    fetchCollections();
  }, []);

  // Apply search and filters
  useEffect(() => {
    let filtered = techniques;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.attackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Tactic filter
    if (filterTactic !== "all") {
      filtered = filtered.filter((t) =>
        t.killChainPhases?.includes(filterTactic)
      );
    }

    // Platform filter
    if (filterPlatform !== "all") {
      filtered = filtered.filter((t) =>
        t.platforms?.some(p => p === filterPlatform)
      );
    }

    setFilteredTechniques(filtered);
  }, [searchTerm, filterTactic, filterPlatform, techniques]);

  // Get unique tactics and platforms
  const allTactics = Array.from(
    new Set(techniques.flatMap((t) => t.killChainPhases || []))
  ).sort();

  const allPlatforms = Array.from(
    new Set(techniques.flatMap((t) => t.platforms || []))
  ).sort();

  // Drag and drop handlers
  const handleDragStart = (technique: Technique) => {
    setDraggedTechnique(technique);
  };

  const handleDragStartReorder = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDrop = () => {
    if (draggedTechnique) {
      // Check if already in list
      if (!selectedTechniques.find((t) => t.id === draggedTechnique.id)) {
        setSelectedTechniques([
          ...selectedTechniques,
          { ...draggedTechnique, order: selectedTechniques.length },
        ]);
      }
      setDraggedTechnique(null);
    }
  };

  const handleDropReorder = (targetIndex: number) => {
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      const reordered = [...selectedTechniques];
      const [removed] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, removed);

      // Update order numbers
      const updated = reordered.map((t, idx) => ({ ...t, order: idx }));
      setSelectedTechniques(updated);
    }
    setDraggedIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Add technique by clicking
  const addTechnique = (technique: Technique) => {
    if (!selectedTechniques.find((t) => t.id === technique.id)) {
      setSelectedTechniques([
        ...selectedTechniques,
        { ...technique, order: selectedTechniques.length },
      ]);
    }
  };

  // Remove technique
  const removeTechnique = (techniqueId: string) => {
    setSelectedTechniques(
      selectedTechniques
        .filter((t) => t.id !== techniqueId)
        .map((t, idx) => ({ ...t, order: idx }))
    );
  };

  // Save to operation
  const saveToOperation = async () => {
    if (!selectedOperationId || selectedTechniques.length === 0) {
      return;
    }

    setSaving(true);
    try {
      // Save each technique mapping
      for (const technique of selectedTechniques) {
        await fetch(`/api/v1/attack/operations/${selectedOperationId}/techniques`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            techniqueId: technique.id,
            tacticId: null, // Can be enhanced to select specific tactic
            status: "planned",
            coveragePercentage: 0,
            notes: technique.notes || null,
          }),
        });
      }

      toast.success("Kill chain saved to operation successfully!");
      setSaveDialogOpen(false);
      setSelectedTechniques([]);
    } catch (error) {
      // Error already shown via toast
      toast.error("Failed to save kill chain");
    } finally {
      setSaving(false);
    }
  };

  // Create collection
  const createCollection = () => {
    if (!newCollectionName || selectedTechniques.length === 0) {
      return;
    }

    const newCollection: Collection = {
      id: `col-${Date.now()}`,
      name: newCollectionName,
      description: newCollectionDescription,
      techniqueIds: selectedTechniques.map((t) => t.id),
    };

    const updated = [...collections, newCollection];
    setCollections(updated);
    localStorage.setItem("attack-collections", JSON.stringify(updated));

    setNewCollectionName("");
    setNewCollectionDescription("");
    setCollectionDialogOpen(false);
    toast.success("Collection created successfully!");
  };

  // Load collection
  const loadCollection = (collectionId: string) => {
    const collection = collections.find((c) => c.id === collectionId);
    if (collection) {
      const collectionTechniques = techniques
        .filter((t) => collection.techniqueIds.includes(t.id))
        .map((t, idx) => ({ ...t, order: idx }));

      setSelectedTechniques(collectionTechniques);
      setSelectedCollectionId(collectionId);
    }
  };

  // Delete collection
  const deleteCollection = (collectionId: string) => {
    if (confirm("Are you sure you want to delete this collection?")) {
      const updated = collections.filter((c) => c.id !== collectionId);
      setCollections(updated);
      localStorage.setItem("attack-collections", JSON.stringify(updated));

      if (selectedCollectionId === collectionId) {
        setSelectedCollectionId("");
      }
    }
  };

  // Polling interval ref for cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Stop polling when dialog closes
  useEffect(() => {
    if (!testPlanDialogOpen && testPlanGenerating) {
      stopPolling();
      setTestPlanGenerating(false);
    }
  }, [testPlanDialogOpen, testPlanGenerating, stopPolling]);

  // Generate test plan (async job + polling)
  const generateTestPlan = async () => {
    if (selectedTechniques.length === 0) return;

    stopPolling();
    setTestPlanGenerating(true);
    setTestPlanError(null);
    setTestPlanMarkdown("");
    setTestPlanMetadata(null);
    setTestPlanDialogOpen(true);

    try {
      // Submit the job — returns immediately with a jobId
      const response = await fetch("/api/v1/attack/generate-test-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          techniques: selectedTechniques.map((t) => ({
            id: t.id,
            attackId: t.attackId,
            name: t.name,
            description: t.description,
            killChainPhases: t.killChainPhases,
            platforms: t.platforms,
          })),
          operationContext: testPlanContext || undefined,
          targetPlatform: testPlanPlatform !== "all" ? testPlanPlatform : undefined,
          opsecConstraints: opsecConstraints.length > 0 ? opsecConstraints : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || err.details || `HTTP ${response.status}`);
      }

      const { jobId } = await response.json();

      // Poll for status every 3 seconds
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/v1/attack/test-plan-status/${jobId}`, {
            credentials: "include",
          });

          if (!statusRes.ok) {
            stopPolling();
            setTestPlanError("Failed to check generation status");
            setTestPlanGenerating(false);
            return;
          }

          const data = await statusRes.json();

          if (data.status === "completed") {
            stopPolling();
            setTestPlanMarkdown(data.markdown);
            setTestPlanMetadata(data.metadata);
            setTestPlanGenerating(false);
            toast.success("Test plan generated successfully!");
          } else if (data.status === "failed") {
            stopPolling();
            setTestPlanError(data.error || "AI generation failed");
            setTestPlanGenerating(false);
            toast.error(data.error || "Test plan generation failed");
          }
          // status === "generating" — keep polling
        } catch {
          stopPolling();
          setTestPlanError("Lost connection while generating test plan");
          setTestPlanGenerating(false);
        }
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start test plan generation";
      setTestPlanError(message);
      setTestPlanGenerating(false);
      toast.error(message);
    }
  };

  const copyTestPlan = async () => {
    try {
      await navigator.clipboard.writeText(testPlanMarkdown);
      toast.success("Test plan copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const downloadTestPlan = () => {
    const blob = new Blob([testPlanMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    a.download = `test-plan-${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Test plan downloaded");
  };

  // OPSEC constraint helpers
  const OPSEC_PRESETS = [
    "No PowerShell",
    "No touching disk",
    "Avoid LSASS",
    "No network scanning",
    "Living off the land only",
    "No admin tools (PsExec, WMI)",
    "Avoid EDR-hooked APIs",
    "No C2 beaconing",
  ];

  const addConstraint = (constraint: string) => {
    const trimmed = constraint.trim();
    if (trimmed && !opsecConstraints.includes(trimmed)) {
      setOpsecConstraints([...opsecConstraints, trimmed]);
    }
    setNewConstraint("");
  };

  const removeConstraint = (constraint: string) => {
    setOpsecConstraints(opsecConstraints.filter((c) => c !== constraint));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Technique Catalog */}
      <Card>
        <CardHeader>
          <CardTitle>Technique Catalog</CardTitle>
          <CardDescription>
            Search and filter techniques, then drag them to your kill chain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search techniques..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2">Tactic</Label>
              <Select value={filterTactic} onValueChange={setFilterTactic}>
                <SelectTrigger>
                  <SelectValue placeholder="All tactics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tactics</SelectItem>
                  {allTactics.map((tactic) => (
                    <SelectItem key={tactic} value={tactic}>
                      {tactic.replace(/-/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2">Platform</Label>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {allPlatforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Collections */}
          {collections.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2">Load Collection</Label>
              <div className="flex gap-2">
                <Select value={selectedCollectionId} onValueChange={loadCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select collection..." />
                  </SelectTrigger>
                  <SelectContent>
                    {collections?.length > 0 ? (
                      collections.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name} ({col.techniqueIds.length} techniques)
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No collections saved</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedCollectionId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteCollection(selectedCollectionId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="text-sm text-muted-foreground">
            {filteredTechniques.length} of {techniques.length} techniques
          </div>

          {/* Technique List */}
          <div className="border rounded-lg max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filteredTechniques.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No techniques found</div>
            ) : (
              <div className="divide-y">
                {filteredTechniques.map((technique) => (
                  <div
                    key={technique.id}
                    draggable
                    onDragStart={() => handleDragStart(technique)}
                    className="p-3 hover:bg-secondary cursor-move transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {technique.attackId}
                          </Badge>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-sm truncate">{technique.name}</p>
                        {technique.killChainPhases && technique.killChainPhases.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {technique.killChainPhases.slice(0, 2).map((phase) => (
                              <Badge key={phase} variant="secondary" className="text-xs">
                                {phase.replace(/-/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => addTechnique(technique)}
                        disabled={selectedTechniques.some((t) => t.id === technique.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right Panel - Operation Kill Chain */}
      <Card>
        <CardHeader>
          <CardTitle>Operation Kill Chain</CardTitle>
          <CardDescription>
            Build your attack sequence by dragging techniques here
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setSaveDialogOpen(true)}
              disabled={selectedTechniques.length === 0}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              Save to Operation
            </Button>
            <Button
              variant="outline"
              onClick={() => setCollectionDialogOpen(true)}
              disabled={selectedTechniques.length === 0}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Save as Collection
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => setOpsecDialogOpen(true)}
            className="w-full"
          >
            <ShieldAlert className="h-4 w-4 mr-2" />
            OPSEC Constraints{opsecConstraints.length > 0 ? ` (${opsecConstraints.length})` : ""}
          </Button>
          <Button
            variant="secondary"
            onClick={generateTestPlan}
            disabled={selectedTechniques.length === 0 || testPlanGenerating}
            className="w-full"
          >
            {testPlanGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4 mr-2" />
            )}
            {testPlanGenerating ? "Generating Test Plan..." : "Generate Test Plan"}
          </Button>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-border rounded-lg min-h-[400px] p-4"
          >
            {selectedTechniques.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
                <GripVertical className="h-12 w-12 mb-4 text-gray-300" />
                <p className="font-medium">Drop techniques here</p>
                <p className="text-sm">Drag from the catalog or click the + button</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedTechniques.map((technique, index) => (
                  <div
                    key={technique.id}
                    draggable
                    onDragStart={() => handleDragStartReorder(index)}
                    onDrop={() => handleDropReorder(index)}
                    onDragOver={handleDragOver}
                    className="bg-card border rounded-lg p-3 hover:shadow-md transition-all cursor-move"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-sm font-medium">{index + 1}</span>
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {technique.attackId}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm">{technique.name}</p>
                        {technique.killChainPhases && technique.killChainPhases.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {technique.killChainPhases.slice(0, 2).map((phase) => (
                              <Badge key={phase} variant="secondary" className="text-xs">
                                {phase.replace(/-/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTechnique(technique.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedTechniques.length} technique{selectedTechniques.length !== 1 ? "s" : ""} selected
          </div>
        </CardContent>
      </Card>

      {/* Save to Operation Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Kill Chain to Operation</DialogTitle>
            <DialogDescription>
              Select an operation to save this attack sequence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="operation">Operation</Label>
              <Select value={selectedOperationId} onValueChange={setSelectedOperationId}>
                <SelectTrigger id="operation">
                  <SelectValue placeholder="Select operation..." />
                </SelectTrigger>
                <SelectContent>
                  {operations?.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name}
                    </SelectItem>
                  )) || <SelectItem value="none" disabled>No operations available</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              This will add {selectedTechniques.length} technique{selectedTechniques.length !== 1 ? "s" : ""} to the operation's coverage matrix.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveToOperation} disabled={!selectedOperationId || saving}>
              {saving ? "Saving..." : "Save Kill Chain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as Collection Dialog */}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Collection</DialogTitle>
            <DialogDescription>
              Create a reusable collection of techniques
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="collection-name">Collection Name</Label>
              <Input
                id="collection-name"
                placeholder="e.g., Initial Access Techniques"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="collection-desc">Description (Optional)</Label>
              <Input
                id="collection-desc"
                placeholder="Describe this collection..."
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Saving {selectedTechniques.length} technique{selectedTechniques.length !== 1 ? "s" : ""}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCollection} disabled={!newCollectionName}>
              Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OPSEC Constraints Dialog */}
      <Dialog open={opsecDialogOpen} onOpenChange={setOpsecDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              OPSEC Constraints
            </DialogTitle>
            <DialogDescription>
              Define operational security constraints. The AI will avoid restricted tools and suggest alternatives.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Add custom constraint */}
            <div className="flex gap-2">
              <Input
                placeholder="e.g., No PowerShell due to script block logging"
                value={newConstraint}
                onChange={(e) => setNewConstraint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newConstraint.trim()) {
                    addConstraint(newConstraint);
                  }
                }}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => addConstraint(newConstraint)}
                disabled={!newConstraint.trim()}
              >
                Add
              </Button>
            </div>

            {/* Quick-add presets */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Quick add</Label>
              <div className="flex flex-wrap gap-1.5">
                {OPSEC_PRESETS.filter((p) => !opsecConstraints.includes(p)).map((preset) => (
                  <Badge
                    key={preset}
                    variant="outline"
                    className="cursor-pointer hover:bg-secondary transition-colors text-xs"
                    onClick={() => addConstraint(preset)}
                  >
                    + {preset}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Active constraints */}
            {opsecConstraints.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Active constraints</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => setOpsecConstraints([])}
                  >
                    Clear all
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {opsecConstraints.map((constraint) => (
                    <div
                      key={constraint}
                      className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-md px-3 py-1.5"
                    >
                      <span className="text-sm">{constraint}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeConstraint(constraint)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {opsecConstraints.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No constraints set. The test plan will include all available techniques.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setOpsecDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Test Plan Dialog */}
      <Dialog open={testPlanDialogOpen} onOpenChange={setTestPlanDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Red Team Test Plan
            </DialogTitle>
            <DialogDescription>
              AI-generated threat intelligence and test procedures for your kill chain
            </DialogDescription>
          </DialogHeader>

          {/* Generation in progress */}
          {testPlanGenerating && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  Researching {selectedTechniques.length} technique{selectedTechniques.length !== 1 ? "s" : ""}...
                </span>
              </div>
              <Progress value={undefined} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">
                The AI agent is investigating threat intelligence, real-world attacks, and generating test procedures. This may take a minute.
              </p>
            </div>
          )}

          {/* Error state */}
          {testPlanError && !testPlanGenerating && (
            <div className="py-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-medium text-destructive">Generation Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{testPlanError}</p>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={generateTestPlan}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Result */}
          {testPlanMarkdown && !testPlanGenerating && (
            <>
              <div className="flex items-center justify-between gap-2 pb-2 border-b">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {testPlanMetadata && (
                    <>
                      <span>Provider: {testPlanMetadata.provider}</span>
                      <span>Model: {testPlanMetadata.model}</span>
                      <span>Tokens: {testPlanMetadata.tokensUsed?.toLocaleString()}</span>
                      <span>Time: {((testPlanMetadata.durationMs || 0) / 1000).toFixed(1)}s</span>
                      {testPlanMetadata.truncated && (
                        <Badge variant="destructive" className="text-xs">Truncated</Badge>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyTestPlan}>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadTestPlan}>
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="prose prose-sm prose-invert max-w-none p-4 bg-secondary/30 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                    {testPlanMarkdown}
                  </pre>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestPlanDialogOpen(false)}>
              Close
            </Button>
            {testPlanMarkdown && !testPlanGenerating && (
              <Button onClick={generateTestPlan}>
                <FlaskConical className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
