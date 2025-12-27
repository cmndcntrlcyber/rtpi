import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Plus,
  Trash2,
  Save,
  FolderPlus,
  GripVertical,
  X,
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
      console.error("Failed to fetch techniques:", error);
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
        setOperations(data);
      }
    } catch (error) {
      console.error("Failed to fetch operations:", error);
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

      alert("Kill chain saved to operation successfully!");
      setSaveDialogOpen(false);
      setSelectedTechniques([]);
    } catch (error) {
      console.error("Failed to save kill chain:", error);
      alert("Failed to save kill chain");
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
    alert("Collection created successfully!");
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
                    {collections.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name} ({col.techniqueIds.length} techniques)
                      </SelectItem>
                    ))}
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
          <div className="flex gap-2">
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
                  {operations.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
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
    </div>
  );
}
