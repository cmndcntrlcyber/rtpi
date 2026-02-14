/* eslint-disable react-hooks/set-state-in-effect */
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Trash2, RotateCcw, Workflow } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import DynamicFieldList from "@/components/shared/DynamicFieldList";
import LinkedVulnerabilities from "./LinkedVulnerabilities";
import LinkedServices from "./LinkedServices";
import { useWorkflowTemplates } from "@/hooks/useWorkflowTemplates";

interface TargetData {
  id?: string;
  name: string;
  type: string;
  value: string;
  description?: string;
  priority?: number;
  tags?: string[];
  operationId?: string;
  discoveredServices?: any;
  metadata?: any;
}

interface Operation {
  id: string;
  name: string;
  status: string;
}

interface EditTargetDialogProps {
  open: boolean;
  target?: TargetData;
  operations: Operation[];
  onClose: () => void;
  onSave: (target: TargetData) => void;
  onDelete?: (id: string) => void;
  onViewVulnerabilities?: (targetId: string) => void;
  onAddVulnerability?: (targetId: string) => void;
  onRunAgentLoop?: (target: any) => void;
}

export default function EditTargetDialog({
  open,
  target,
  operations,
  onClose,
  onSave,
  onDelete,
  onViewVulnerabilities,
  onAddVulnerability,
  onRunAgentLoop,
}: EditTargetDialogProps) {
  const { templates: workflowTemplates } = useWorkflowTemplates();
  const [formData, setFormData] = useState<TargetData>({
    name: "",
    type: "ip",
    value: "",
    priority: 3,
    tags: [""],
  });
  const [metadataJson, setMetadataJson] = useState("");
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([]);

  // Initialize form when dialog opens or target changes
  useEffect(() => {
    if (target) {
      setFormData({
        ...target,
        tags: target.tags || [""],
      });
      setMetadataJson(
        target.metadata ? JSON.stringify(target.metadata, null, 2) : ""
      );
      setSelectedWorkflowIds(target.metadata?.workflowTemplateIds || []);
    } else {
      setFormData({
        name: "",
        type: "ip",
        value: "",
        priority: 3,
        tags: [""],
      });
      setMetadataJson("");
      setSelectedWorkflowIds([]);
    }
  }, [target, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clean up tags (remove empty values)
    const cleanTags = formData.tags?.filter((t) => t.trim() !== "") || [];

    // Parse metadata JSON field
    let metadata = null;

    try {
      if (metadataJson.trim()) {
        metadata = JSON.parse(metadataJson);
      }
    } catch (err) {
      toast.error("Invalid JSON in Metadata field");
      return;
    }

    // Merge workflow template IDs into metadata
    const mergedMetadata = {
      ...(metadata || {}),
      workflowTemplateIds: selectedWorkflowIds.length > 0 ? selectedWorkflowIds : undefined,
    };

    onSave({
      ...formData,
      tags: cleanTags,
      metadata: Object.keys(mergedMetadata).some((k) => mergedMetadata[k] !== undefined) ? mergedMetadata : null,
    });
  };

  const handleDelete = () => {
    if (target?.id && onDelete) {
      if (confirm("Are you sure you want to delete this target? All linked vulnerabilities will also be deleted.")) {
        onDelete(target.id);
      }
    }
  };

  const getValuePlaceholder = () => {
    switch (formData.type) {
      case "ip":
        return "192.168.1.100";
      case "domain":
        return "example.com";
      case "url":
        return "https://example.com/app";
      case "network":
        return "192.168.1.0/24";
      case "range":
        return "192.168.1.1-192.168.1.254";
      default:
        return "Enter value...";
    }
  };

  const isEditing = !!target?.id;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {isEditing ? "Edit Target" : "Add Target"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Basic Information
            </h3>

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Web Server 01"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ip">IP Address</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="network">Network (CIDR)</SelectItem>
                    <SelectItem value="range">IP Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="value">Value *</Label>
                <Input
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={getValuePlaceholder()}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Description of the target system..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority?.toString() || "3"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: parseInt(value) })
                  }
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Low</SelectItem>
                    <SelectItem value="2">2 - Medium-Low</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - Medium-High</SelectItem>
                    <SelectItem value="5">5 - Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="operation">Operation</Label>
                <Select
                  value={formData.operationId || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, operationId: value })
                  }
                >
                  <SelectTrigger id="operation">
                    <SelectValue placeholder="Select operation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {operations.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name} ({op.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Advanced Fields */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Advanced
            </h3>

            {/* Tags */}
            <DynamicFieldList
              label="Tags"
              values={formData.tags || [""]}
              onChange={(values) => setFormData({ ...formData, tags: values })}
              placeholder="web-server, production, external..."
              maxFields={5}
            />

            {/* Workflow Templates */}
            {workflowTemplates.length > 0 && (
              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-indigo-600" />
                  Assigned Workflows
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                  {workflowTemplates.map((wt) => (
                    <div
                      key={wt.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        selectedWorkflowIds.includes(wt.id)
                          ? 'bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800'
                          : 'hover:bg-secondary'
                      }`}
                      onClick={() => {
                        setSelectedWorkflowIds((prev) =>
                          prev.includes(wt.id)
                            ? prev.filter((id) => id !== wt.id)
                            : [...prev, wt.id]
                        );
                      }}
                    >
                      <Checkbox
                        checked={selectedWorkflowIds.includes(wt.id)}
                        onCheckedChange={(checked) => {
                          setSelectedWorkflowIds((prev) =>
                            checked
                              ? [...prev, wt.id]
                              : prev.filter((id) => id !== wt.id)
                          );
                        }}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">{wt.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({wt.configuration?.agents?.length || 0} agents)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Select workflow templates to assign to this target
                </p>
              </div>
            )}

            {/* Linked Discovered Services */}
            {isEditing && target?.id && (
              <LinkedServices targetId={target.id} />
            )}

            {/* Notes/Metadata (JSON) */}
            <div>
              <Label htmlFor="metadata">Notes/Metadata (JSON)</Label>
              <Textarea
                id="metadata"
                value={metadataJson}
                onChange={(e) => setMetadataJson(e.target.value)}
                placeholder='{"owner": "IT Department", "criticality": "high"}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional JSON object for custom metadata
              </p>
            </div>
          </div>

          {/* Linked Vulnerabilities */}
          {isEditing && target?.id && (
            <LinkedVulnerabilities
              targetId={target.id}
              onViewAll={() => {
                if (onViewVulnerabilities && target.id) {
                  onViewVulnerabilities(target.id);
                }
              }}
              onAddNew={() => {
                if (onAddVulnerability && target.id) {
                  onAddVulnerability(target.id);
                }
              }}
            />
          )}

          {/* Dialog Footer with Actions */}
          <DialogFooter className="flex justify-between items-center">
            <div className="flex-1 flex gap-2">
              {isEditing && onDelete && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
              {isEditing && onRunAgentLoop && (
                <Button 
                  type="button" 
                  onClick={() => {
                    onClose();
                    onRunAgentLoop(target);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Run Agent Loop
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {isEditing ? "Save Changes" : "Add Target"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
