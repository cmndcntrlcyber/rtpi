import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Workflow, Bot, GripVertical, X, Save, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WorkflowTemplate, WorkflowTemplateConfig } from "@/hooks/useWorkflowTemplates";

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  config: any;
}

interface SelectedAgent {
  id: string;
  name: string;
  type: string;
  order: number;
}

interface WorkflowEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkflowTemplate | null;
  agents: Agent[];
  onSave: (templateId: string, configuration: WorkflowTemplateConfig) => Promise<void>;
}

function SortableAgentRow({
  agent,
  index,
  onRemove,
}: {
  agent: SelectedAgent;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: agent.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center p-3 bg-secondary border border-border rounded-lg gap-3"
    >
      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full text-blue-600 dark:text-blue-400 text-sm font-bold">
        {index + 1}
      </div>
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 flex-1">
        <Bot className="h-4 w-4 text-blue-500" />
        <span className="font-medium text-foreground">{agent.name}</span>
        <Badge variant="outline" className="text-xs capitalize">
          {agent.type}
        </Badge>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onRemove(agent.id)}
        className="hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function WorkflowEditDialog({
  open,
  onOpenChange,
  template,
  agents,
  onSave,
}: WorkflowEditDialogProps) {
  const [selectedAgents, setSelectedAgents] = useState<SelectedAgent[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize from template when dialog opens
  useEffect(() => {
    if (open && template) {
      const templateAgents = template.configuration?.agents || [];
      const mapped: SelectedAgent[] = templateAgents
        .map((ta) => {
          const agent = agents.find((a) => a.id === ta.agentId);
          if (!agent) return null;
          return {
            id: agent.id,
            name: agent.name,
            type: agent.type,
            order: ta.order,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a!.order - b!.order) as SelectedAgent[];
      setSelectedAgents(mapped);
    }
  }, [open, template, agents]);

  const availableAgents = agents.filter(
    (a) => !selectedAgents.some((sa) => sa.id === a.id)
  );

  const handleAddAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    setSelectedAgents((prev) => [
      ...prev,
      {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        order: prev.length,
      },
    ]);
  };

  const handleRemoveAgent = (agentId: string) => {
    setSelectedAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selectedAgents.findIndex((a) => a.id === active.id);
      const newIndex = selectedAgents.findIndex((a) => a.id === over.id);
      const reordered = arrayMove(selectedAgents, oldIndex, newIndex);
      setSelectedAgents(reordered.map((a, i) => ({ ...a, order: i })));
    }
  };

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    try {
      const updatedConfig: WorkflowTemplateConfig = {
        ...template.configuration,
        agents: selectedAgents.map((a) => ({ agentId: a.id, order: a.order })),
      };
      await onSave(template.id, updatedConfig);
    } catch {
      toast.error("Failed to save workflow template");
    } finally {
      setIsSaving(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-indigo-500" />
            Edit Workflow: {template.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}

          {/* Add agent dropdown */}
          {availableAgents.length > 0 && (
            <div>
              <Label className="mb-2 block">Add Agent</Label>
              <Select onValueChange={handleAddAgent} value="">
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent to add..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {agent.name}
                        <Badge variant="outline" className="text-xs capitalize ml-2">
                          {agent.type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Agent list with drag-and-drop */}
          {selectedAgents.length > 0 ? (
            <div>
              <Label className="mb-2 block">
                Agent Execution Order (drag to reorder)
              </Label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedAgents.map((a) => a.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {selectedAgents.map((agent, index) => (
                      <SortableAgentRow
                        key={agent.id}
                        agent={agent}
                        index={index}
                        onRemove={handleRemoveAgent}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No agents assigned</p>
              <p className="text-xs">Use the dropdown above to add agents</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
