import { useState } from "react";
import { Save, FolderOpen, Trash2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilterPresets } from "@/hooks/useFilterPresets";

interface FilterPresetsProps {
  context: string; // "vulnerabilities", "targets", "assets", etc.
  currentFilters: any;
  onLoadPreset: (filters: any) => void;
}

export default function FilterPresets({
  context,
  currentFilters,
  onLoadPreset,
}: FilterPresetsProps) {
  const { presets, loading, createPreset, deletePreset } = useFilterPresets(context);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      return;
    }

    try {
      setSaving(true);
      await createPreset(presetName, presetDescription || undefined, currentFilters, isShared);
      setSaveDialogOpen(false);
      setPresetName("");
      setPresetDescription("");
      setIsShared(false);
    } catch (error) {
      // Error handled by hook
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPreset = (preset: any) => {
    onLoadPreset(preset.filters);
    setLoadDialogOpen(false);
  };

  const handleDeletePreset = async (id: string) => {
    if (confirm("Are you sure you want to delete this filter preset?")) {
      await deletePreset(id);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSaveDialogOpen(true)}
          title="Save current filters as preset"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Filters
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setLoadDialogOpen(true)}
          disabled={loading || presets.length === 0}
          title="Load saved filter preset"
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Load Preset {presets.length > 0 && `(${presets.length})`}
        </Button>
      </div>

      {/* Save Preset Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="preset-name">Preset Name *</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., Critical vulnerabilities only"
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="preset-description">Description</Label>
              <Textarea
                id="preset-description"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                placeholder="Optional description of what this filter preset does..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-shared"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="is-shared" className="flex items-center gap-2 cursor-pointer">
                <Share2 className="h-4 w-4" />
                Share with team
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} disabled={!presetName.trim() || saving}>
              {saving ? "Saving..." : "Save Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Preset Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Filter Preset</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
            {presets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No saved filter presets yet. Save your current filters to create one!
              </div>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className="p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{preset.name}</h3>
                        {preset.isShared && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Shared
                          </span>
                        )}
                      </div>
                      {preset.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {preset.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Created {new Date(preset.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleLoadPreset(preset)}
                      >
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
