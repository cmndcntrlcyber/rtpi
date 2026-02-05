import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Workflow, Bot, Server, Target, Play, Save, GripVertical, Loader2, X, Plus, ChevronRight } from "lucide-react";
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
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  config: any;
}

interface MCPServer {
  id: string;
  name: string;
  command: string;
  status: string;
}

interface Operation {
  id: string;
  name: string;
  status: string;
}

interface Target {
  id: string;
  name: string;
  ipAddress?: string;
  hostname?: string;
}

interface WorkflowBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  mcpServers: MCPServer[];
  operations: Operation[];
  targets: Target[];
  onWorkflowCreated: () => void;
}

interface SelectedAgent {
  id: string;
  name: string;
  type: string;
  order: number;
}

// Sortable agent item for workflow
function SortableWorkflowAgent({
  agent,
  index,
  onRemove
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
      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-blue-600 text-sm font-bold">
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
        <span className="font-medium">{agent.name}</span>
        <Badge variant="outline" className="text-xs capitalize">
          {agent.type}
        </Badge>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onRemove(agent.id)}
        className="hover:bg-red-50 hover:text-red-600"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function WorkflowBuilder({
  open,
  onOpenChange,
  agents,
  mcpServers,
  operations,
  targets,
  onWorkflowCreated,
}: WorkflowBuilderProps) {
  const [workflowName, setWorkflowName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<SelectedAgent[]>([]);
  const [selectedMCPs, setSelectedMCPs] = useState<string[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [step, setStep] = useState(1);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setWorkflowName("");
      setDescription("");
      setSelectedAgents([]);
      setSelectedMCPs([]);
      setSelectedOperationId("");
      setSelectedTargetId("");
      setSaveAsTemplate(false);
      setStep(1);
    }
  }, [open]);

  const runningServers = mcpServers.filter(s => s.status === "running");
  const availableAgents = agents.filter(
    a => !selectedAgents.some(sa => sa.id === a.id)
  );

  const handleAddAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const newAgent: SelectedAgent = {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      order: selectedAgents.length,
    };

    setSelectedAgents([...selectedAgents, newAgent]);
  };

  const handleRemoveAgent = (agentId: string) => {
    setSelectedAgents(selectedAgents.filter(a => a.id !== agentId));
  };

  const handleToggleMCP = (mcpId: string) => {
    if (selectedMCPs.includes(mcpId)) {
      setSelectedMCPs(selectedMCPs.filter(id => id !== mcpId));
    } else {
      setSelectedMCPs([...selectedMCPs, mcpId]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedAgents.findIndex(a => a.id === active.id);
      const newIndex = selectedAgents.findIndex(a => a.id === over.id);
      const reordered = arrayMove(selectedAgents, oldIndex, newIndex);
      // Update order property
      setSelectedAgents(reordered.map((a, i) => ({ ...a, order: i })));
    }
  };

  const handleSaveTemplate = async () => {
    if (!workflowName.trim()) {
      toast.warning("Please provide a workflow name");
      return;
    }

    setIsCreating(true);
    try {
      await api.post("/agents/workflow-templates", {
        name: workflowName,
        description,
        agents: selectedAgents.map(a => ({ agentId: a.id, order: a.order })),
        mcpServerIds: selectedMCPs,
        isActive: true,
      });

      toast.success("Workflow template saved!");
      onWorkflowCreated();
    } catch (err) {
      toast.error(`Failed to save template: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleExecuteWorkflow = async () => {
    if (!workflowName.trim()) {
      toast.warning("Please provide a workflow name");
      return;
    }

    if (selectedAgents.length === 0) {
      toast.warning("Please select at least one agent");
      return;
    }

    if (!selectedTargetId) {
      toast.warning("Please select a target");
      return;
    }

    setIsExecuting(true);
    try {
      const response = await api.post<{ workflow: any }>("/agent-workflows/start", {
        name: workflowName,
        targetId: selectedTargetId,
        operationId: selectedOperationId || undefined,
        workflowType: "custom",
        agents: selectedAgents.map(a => ({ agentId: a.id, order: a.order })),
        mcpServerIds: selectedMCPs,
        metadata: {
          description,
          createdVia: "workflow-builder",
        },
      });

      toast.success("Workflow started successfully!");
      onWorkflowCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Failed to start workflow: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const totalSteps = 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-indigo-500" />
            Create Workflow
          </DialogTitle>
          <DialogDescription>
            Build a custom agent workflow with specific execution order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step indicators */}
          <div className="flex items-center justify-between mb-6 px-4">
            {[
              { num: 1, label: "Name" },
              { num: 2, label: "Agents" },
              { num: 3, label: "MCPs" },
              { num: 4, label: "Target" },
              { num: 5, label: "Execute" },
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center">
                <div
                  className={`flex flex-col items-center cursor-pointer ${step >= s.num ? 'text-blue-500' : 'text-muted-foreground'}`}
                  onClick={() => step > s.num && setStep(s.num)}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                      step >= s.num
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-secondary border-border'
                    }`}
                  >
                    {s.num}
                  </div>
                  <span className="text-xs mt-1">{s.label}</span>
                </div>
                {idx < 4 && (
                  <ChevronRight className={`h-5 w-5 mx-2 ${step > s.num ? 'text-blue-500' : 'text-muted-foreground'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 1: Name Your Workflow</h3>

              <div>
                <Label htmlFor="workflow-name">Workflow Name *</Label>
                <Input
                  id="workflow-name"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="My Custom Workflow"
                />
              </div>

              <div>
                <Label htmlFor="workflow-description">Description (optional)</Label>
                <Textarea
                  id="workflow-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!workflowName.trim()}>
                  Next: Select Agents
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Select Agents */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 2: Select Agents</h3>
              <p className="text-sm text-muted-foreground">
                Select agents and drag to set execution order
              </p>

              {/* Add agent dropdown */}
              {availableAgents.length > 0 && (
                <div className="flex gap-2">
                  <Select onValueChange={handleAddAgent}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Add an agent..." />
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

              {agents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No agents available</p>
                  <p className="text-xs">Create agents first to add them to workflows</p>
                </div>
              )}

              {/* Selected agents with drag-drop */}
              {selectedAgents.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedAgents.map(a => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      <Label>Agent Execution Order (drag to reorder)</Label>
                      {selectedAgents.map((agent, index) => (
                        <SortableWorkflowAgent
                          key={agent.id}
                          agent={agent}
                          index={index}
                          onRemove={handleRemoveAgent}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)}>
                  Next: Select MCPs
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Select MCPs */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 3: Select MCP Servers</h3>
              <p className="text-sm text-muted-foreground">
                Select MCP servers to provide tools for the agents (optional)
              </p>

              {runningServers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No running MCP servers</p>
                  <p className="text-xs">Start MCP servers to provide tools</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {runningServers.map((server) => (
                    <div
                      key={server.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMCPs.includes(server.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-secondary border-border hover:bg-secondary/80'
                      }`}
                      onClick={() => handleToggleMCP(server.id)}
                    >
                      <Checkbox
                        checked={selectedMCPs.includes(server.id)}
                        className="mr-3"
                      />
                      <Server className="h-4 w-4 text-green-500 mr-2" />
                      <div className="flex-1">
                        <span className="font-medium">{server.name}</span>
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {server.command}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                        Running
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setStep(4)}>
                  Next: Select Target
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Select Target/Operation */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 4: Select Target</h3>

              <div>
                <Label htmlFor="target-select">Target *</Label>
                <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a target..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          {target.name}
                          {target.ipAddress && (
                            <span className="text-xs text-muted-foreground">
                              ({target.ipAddress})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {operations.length > 0 && (
                <div>
                  <Label htmlFor="operation-select">Operation (optional)</Label>
                  <Select
                    value={selectedOperationId || "none"}
                    onValueChange={(val) => setSelectedOperationId(val === "none" ? "" : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Link to an operation..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No operation</SelectItem>
                      {operations.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button onClick={() => setStep(5)} disabled={!selectedTargetId}>
                  Next: Review & Execute
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Review & Execute */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 5: Review & Execute</h3>

              {/* Summary */}
              <div className="bg-secondary rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Workflow Summary</h4>
                <div className="text-sm space-y-2">
                  <p><span className="text-muted-foreground">Name:</span> {workflowName}</p>
                  {description && (
                    <p><span className="text-muted-foreground">Description:</span> {description}</p>
                  )}
                  <div>
                    <span className="text-muted-foreground">Agents ({selectedAgents.length}):</span>
                    {selectedAgents.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedAgents.map((a, i) => (
                          <Badge key={a.id} variant="outline" className="text-xs">
                            {i + 1}. {a.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground ml-1">None selected</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">MCP Servers ({selectedMCPs.length}):</span>
                    {selectedMCPs.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedMCPs.map((id) => {
                          const server = mcpServers.find(s => s.id === id);
                          return server ? (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {server.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground ml-1">None selected</span>
                    )}
                  </div>
                  <p>
                    <span className="text-muted-foreground">Target:</span>{" "}
                    {targets.find(t => t.id === selectedTargetId)?.name || "Not selected"}
                  </p>
                </div>
              </div>

              {/* Save as template option */}
              <div
                className={`flex items-center p-3 rounded-lg border cursor-pointer ${
                  saveAsTemplate ? 'bg-indigo-50 border-indigo-200' : 'bg-secondary border-border'
                }`}
                onClick={() => setSaveAsTemplate(!saveAsTemplate)}
              >
                <Checkbox checked={saveAsTemplate} className="mr-3" />
                <div>
                  <span className="font-medium">Save as template</span>
                  <p className="text-xs text-muted-foreground">
                    Save this workflow configuration for future use
                  </p>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(4)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  {saveAsTemplate && (
                    <Button
                      variant="outline"
                      onClick={handleSaveTemplate}
                      disabled={isCreating}
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Template
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={handleExecuteWorkflow}
                    disabled={isExecuting || selectedAgents.length === 0 || !selectedTargetId}
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Execute Workflow
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
