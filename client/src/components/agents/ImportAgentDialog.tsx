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
import { Bot, Sparkles, GripVertical, Server, Loader2, X, Plus } from "lucide-react";
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

interface MCPServer {
  id: string;
  name: string;
  command: string;
  status: string;
}

interface ToolContainer {
  id: string;
  name: string;
  serverId: string;
  tools: string[];
}

interface ImportAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mcpServers: MCPServer[];
  onAgentCreated: () => void;
}

// Sortable tool container item
function SortableToolContainer({
  container,
  index,
  onRemove
}: {
  container: ToolContainer;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: container.id });

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
      <div className="flex items-center justify-center w-8 h-8 bg-indigo-100 rounded-full text-indigo-600 text-sm font-bold">
        {index + 1}
      </div>
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 flex-1">
        <Server className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{container.name}</span>
        {container.tools.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {container.tools.length} tools
          </Badge>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onRemove(container.id)}
        className="hover:bg-red-50 hover:text-red-600"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ImportAgentDialog({
  open,
  onOpenChange,
  mcpServers,
  onAgentCreated,
}: ImportAgentDialogProps) {
  const [agentName, setAgentName] = useState("");
  const [agentType, setAgentType] = useState<"openai" | "anthropic">("anthropic");
  const [selectedContainers, setSelectedContainers] = useState<ToolContainer[]>([]);
  const [manualPrompt, setManualPrompt] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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
      setAgentName("");
      setAgentType("anthropic");
      setSelectedContainers([]);
      setManualPrompt("");
      setGeneratedPrompt("");
      setDescription("");
      setStep(1);
    }
  }, [open]);

  const runningServers = mcpServers.filter(s => s.status === "running");
  const availableServers = runningServers.filter(
    s => !selectedContainers.some(c => c.serverId === s.id)
  );

  const handleAddContainer = (serverId: string) => {
    const server = mcpServers.find(s => s.id === serverId);
    if (!server) return;

    const newContainer: ToolContainer = {
      id: `container-${Date.now()}`,
      name: server.name,
      serverId: server.id,
      tools: [], // Will be populated when MCP tools are discovered
    };

    setSelectedContainers([...selectedContainers, newContainer]);
  };

  const handleRemoveContainer = (containerId: string) => {
    setSelectedContainers(selectedContainers.filter(c => c.id !== containerId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedContainers.findIndex(c => c.id === active.id);
      const newIndex = selectedContainers.findIndex(c => c.id === over.id);
      setSelectedContainers(arrayMove(selectedContainers, oldIndex, newIndex));
    }
  };

  const handleGeneratePrompt = async () => {
    if (!description.trim()) {
      toast.warning("Please provide a description for the agent");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await api.post<{ prompt: string }>("/agents/generate-prompt", {
        description,
        toolContainers: selectedContainers.map(c => c.name),
        agentType,
      });

      setGeneratedPrompt(response.prompt);
      toast.success("Agent prompt generated successfully!");
    } catch (err) {
      toast.error(`Failed to generate prompt: ${err instanceof Error ? err.message : "Unknown error"}`);
      // Fallback to a template prompt
      setGeneratedPrompt(`You are an AI agent specialized in ${description}.

You have access to the following tool containers in order of execution priority:
${selectedContainers.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}

Your primary objectives:
1. Analyze the target environment using available tools
2. Execute tasks systematically following the tool order
3. Document findings and report results
4. Adapt your approach based on discovered information

Always prioritize safety and operate within authorized boundaries.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!agentName.trim()) {
      toast.warning("Please provide an agent name");
      return;
    }

    const finalPrompt = manualPrompt.trim() || generatedPrompt.trim();
    if (!finalPrompt) {
      toast.warning("Please provide or generate a system prompt");
      return;
    }

    setIsCreating(true);
    try {
      await api.post("/agents", {
        name: agentName,
        type: agentType,
        config: {
          model: agentType === "openai" ? "gpt-4o" : "claude-sonnet-4-5-20250929",
          systemPrompt: finalPrompt,
          loopEnabled: false,
          flowOrder: 0,
          enabledTools: [],
          mcpServerId: selectedContainers[0]?.serverId || "",
          toolContainers: selectedContainers.map(c => ({
            serverId: c.serverId,
            name: c.name,
            order: selectedContainers.indexOf(c),
          })),
        },
        capabilities: [],
      });

      toast.success("Agent imported successfully!");
      onAgentCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Failed to create agent: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            Import Agent
          </DialogTitle>
          <DialogDescription>
            Create a new agent with tool containers and AI-generated prompts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s
                      ? 'bg-blue-500 text-white'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 ${step > s ? 'bg-blue-500' : 'bg-secondary'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 1: Basic Information</h3>

              <div>
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="My Custom Agent"
                />
              </div>

              <div>
                <Label htmlFor="agent-type">Agent Type</Label>
                <Select value={agentType} onValueChange={(v: any) => setAgentType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Agent Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this agent should do... (e.g., 'A reconnaissance agent that discovers and maps network infrastructure')"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This description will be used to generate the system prompt
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!agentName.trim()}>
                  Next: Select Tools
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Tool Containers */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 2: Select Tool Containers</h3>
              <p className="text-sm text-muted-foreground">
                Select MCP servers and drag to reorder execution priority
              </p>

              {/* Add container dropdown */}
              {availableServers.length > 0 && (
                <div className="flex gap-2">
                  <Select onValueChange={handleAddContainer}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Add a tool container..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServers.map((server) => (
                        <SelectItem key={server.id} value={server.id}>
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            {server.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {runningServers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No running MCP servers available</p>
                  <p className="text-xs">Start an MCP server to add tool containers</p>
                </div>
              )}

              {/* Selected containers with drag-drop */}
              {selectedContainers.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedContainers.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      <Label>Tool Execution Order (drag to reorder)</Label>
                      {selectedContainers.map((container, index) => (
                        <SortableToolContainer
                          key={container.id}
                          container={container}
                          index={index}
                          onRemove={handleRemoveContainer}
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
                  Next: Configure Prompt
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Prompt Configuration */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 3: Configure System Prompt</h3>

              {/* Generate prompt button */}
              <div className="flex gap-2">
                <Button
                  onClick={handleGeneratePrompt}
                  disabled={isGenerating || !description.trim()}
                  className="flex-1"
                  variant="outline"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Prompt from Description
                    </>
                  )}
                </Button>
              </div>

              {/* Generated prompt preview */}
              {generatedPrompt && (
                <div>
                  <Label>Generated Prompt</Label>
                  <div className="bg-secondary rounded-lg p-3 text-sm max-h-40 overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-mono text-xs">{generatedPrompt}</pre>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    onClick={() => {
                      setManualPrompt(generatedPrompt);
                      setGeneratedPrompt("");
                    }}
                  >
                    Edit this prompt
                  </Button>
                </div>
              )}

              {/* Manual prompt input */}
              <div>
                <Label htmlFor="manual-prompt">
                  {generatedPrompt ? "Or write custom prompt" : "System Prompt"}
                </Label>
                <Textarea
                  id="manual-prompt"
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  placeholder="Enter a custom system prompt for the agent..."
                  rows={6}
                />
              </div>

              {/* Summary */}
              <div className="bg-secondary rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Agent Summary</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Name:</span> {agentName}</p>
                  <p><span className="text-muted-foreground">Type:</span> {agentType === "anthropic" ? "Claude" : "GPT-4"}</p>
                  <p><span className="text-muted-foreground">Tool Containers:</span> {selectedContainers.length}</p>
                  {selectedContainers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedContainers.map((c, i) => (
                        <Badge key={c.id} variant="outline" className="text-xs">
                          {i + 1}. {c.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  onClick={handleCreateAgent}
                  disabled={isCreating || (!manualPrompt.trim() && !generatedPrompt.trim())}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Agent
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
