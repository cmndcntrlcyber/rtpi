/* eslint-disable react-hooks/set-state-in-effect */
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Play, Save, Sparkles, Copy, Check, Shield, KeyRound, Crosshair } from "lucide-react";
import { Tool } from "@/services/tools";
import { useTargets } from "@/hooks/useTargets";
import { useExecuteDockerTool } from "@/hooks/useTools";

interface ConfigureToolDialogProps {
  open: boolean;
  tool: Tool | null;
  agentId?: string;
  onClose: () => void;
  onSave?: (toolId: string, targetId: string, params: any) => void;
}

export default function ConfigureToolDialog({
  open,
  tool,
  agentId,
  onClose,
  onSave,
}: ConfigureToolDialogProps) {
  const { targets } = useTargets();
  const { executeDocker, executing } = useExecuteDockerTool();
  const queryClient = useQueryClient();

  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [params, setParams] = useState<Record<string, any>>({});
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [generatedCommand, setGeneratedCommand] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [credentialInfo, setCredentialInfo] = useState<{ used: boolean; test: number; harvested: number } | null>(null);
  const [selectedTacticId, setSelectedTacticId] = useState<string>("");
  const [selectedTechniqueIds, setSelectedTechniqueIds] = useState<Set<string>>(new Set());
  const [attackMappingChanged, setAttackMappingChanged] = useState(false);

  // Fetch all available tactics
  const { data: allTacticsData } = useQuery({
    queryKey: ['attack-tactics'],
    queryFn: async () => {
      const res = await fetch('/api/v1/attack/tactics', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });
  const allTactics = Array.isArray(allTacticsData) ? allTacticsData : (allTacticsData as any)?.tactics || [];

  // Fetch tool's current tactic + techniques
  const { data: toolMappingData } = useQuery({
    queryKey: ['tool-tactics', tool?.id],
    queryFn: async () => {
      if (!tool) return { tactics: [], techniques: [] };
      const res = await fetch(`/api/v1/tools/registry/${tool.id}/tactics`, { credentials: 'include' });
      if (!res.ok) return { tactics: [], techniques: [] };
      return res.json();
    },
    enabled: open && !!tool,
  });

  // Fetch techniques for the selected tactic
  const { data: tacticTechniquesData } = useQuery({
    queryKey: ['techniques-by-tactic', selectedTacticId],
    queryFn: async () => {
      if (!selectedTacticId) return { techniques: [] };
      const res = await fetch(`/api/v1/tools/techniques-by-tactic/${selectedTacticId}`, { credentials: 'include' });
      if (!res.ok) return { techniques: [] };
      return res.json();
    },
    enabled: !!selectedTacticId,
  });
  const availableTechniques = tacticTechniquesData?.techniques || [];

  // Sync tool mapping into local state when loaded
  useEffect(() => {
    if (toolMappingData) {
      const tactics = toolMappingData.tactics || [];
      const techniques = toolMappingData.techniques || [];
      setSelectedTacticId(tactics[0]?.tacticId || "");
      setSelectedTechniqueIds(new Set(techniques.map((t: any) => t.techniqueId)));
      setAttackMappingChanged(false);
    }
  }, [toolMappingData]);

  const handleTacticChange = (tacticId: string) => {
    setSelectedTacticId(tacticId);
    // Clear techniques when tactic changes since they belong to the old tactic
    setSelectedTechniqueIds(new Set());
    setAttackMappingChanged(true);
  };

  const toggleTechnique = (techniqueId: string) => {
    setSelectedTechniqueIds(prev => {
      const next = new Set(prev);
      if (next.has(techniqueId)) {
        next.delete(techniqueId);
      } else {
        if (next.size >= 3) {
          toast.warning("Maximum 3 techniques per tool");
          return prev;
        }
        next.add(techniqueId);
      }
      return next;
    });
    setAttackMappingChanged(true);
  };

  const saveAttackMapping = async () => {
    if (!tool || !selectedTacticId) return;
    if (selectedTechniqueIds.size === 0) {
      toast.warning("Select at least 1 technique");
      return;
    }
    try {
      const res = await fetch(`/api/v1/tools/registry/${tool.id}/tactics`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tacticId: selectedTacticId,
          techniqueIds: [...selectedTechniqueIds],
        }),
      });
      if (!res.ok) throw new Error('Failed to save ATT&CK mapping');
      toast.success('ATT&CK mapping updated');
      setAttackMappingChanged(false);
      queryClient.invalidateQueries({ queryKey: ['tool-registry'] });
      queryClient.invalidateQueries({ queryKey: ['tool-tactics', tool.id] });
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    }
  };

  // Initialize form when tool changes
  useEffect(() => {
    if (tool) {
      setParams({});
      setSelectedTargetId("");
      setExecutionResult(null);
      setGeneratedCommand(null);
      setCopied(false);
      setCredentialInfo(null);

      // Pre-populate with saved params if available
      if (tool.metadata?.targets && selectedTargetId) {
        const savedParams = tool.metadata.targets[selectedTargetId]?.lastParams;
        if (savedParams) {
          setParams(savedParams);
        }
      }
    }
  }, [tool, open]);

  // Update params when target changes (load saved params)
  useEffect(() => {
    if (tool && selectedTargetId && tool.metadata?.targets) {
      const savedParams = tool.metadata.targets[selectedTargetId]?.lastParams;
      if (savedParams) {
        setParams(savedParams);
      }
    }
  }, [selectedTargetId, tool]);

  const handleParamChange = (paramName: string, value: any) => {
    setParams((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleSave = () => {
    if (!tool || !selectedTargetId) {
      toast.warning("Please select a target");
      return;
    }

    if (onSave) {
      onSave(tool.id, selectedTargetId, params);
    }
    
    toast.success("Configuration saved successfully");
  };

  const handleExecute = async () => {
    if (!tool) return;

    // Validate required fields
    const schema = tool.metadata?.parameterSchema || {};
    const missingRequired = Object.entries(schema)
      .filter(([_, config]: [string, any]) => config.required && !params[_])
      .map(([name]) => name);

    if (!selectedTargetId && !agentId) {
      toast.warning("Please select a target");
      return;
    }

    if (missingRequired.length > 0) {
      toast.warning(`Please fill in required fields: ${missingRequired.join(", ")}`);
      return;
    }

    try {
      const execPayload: any = {
        targetId: selectedTargetId,
        agentId,
        params,
      };

      // If AI-generated command exists, use it directly
      if (generatedCommand) {
        execPayload.command = generatedCommand.split(/\s+/);
      }

      const result = await executeDocker(tool.id, execPayload);
      
      setExecutionResult(result);

      // Check for non-zero exit code
      if (result.result?.exitCode && result.result.exitCode !== 0) {
        toast.warning(`Tool exited with code ${result.result.exitCode}`);
      } else {
        toast.success(`Tool ${tool.name} executed successfully!`);
      }

      // Auto-save params after successful execution
      if (onSave && selectedTargetId) {
        onSave(tool.id, selectedTargetId, params);
      }
    } catch (err: any) {
      console.error("Execution error:", err);
      const errMsg = err?.message || "Unknown error";
      const details = err?.data?.details;
      toast.error(`Execution failed: ${errMsg}`, details ? { description: details } : undefined);
    }
  };

  const handleGenerateCommand = async () => {
    if (!tool || !selectedTargetId) {
      toast.warning("Please select a target first");
      return;
    }

    setGenerating(true);
    setGeneratedCommand(null);
    setCredentialInfo(null);

    try {
      const response = await fetch(`/api/v1/tools/registry/${tool.id}/generate-command`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: selectedTargetId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await response.json();
      setGeneratedCommand(data.command);
      if (data.credentialSources) {
        setCredentialInfo({
          used: data.credentialsUsed,
          test: data.credentialSources.test || 0,
          harvested: data.credentialSources.harvested || 0,
        });
      }
      toast.success(`Command generated via ${data.provider}`);
    } catch (err: any) {
      toast.error(`Failed to generate command: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCommand = () => {
    if (generatedCommand) {
      navigator.clipboard.writeText(generatedCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Command copied to clipboard");
    }
  };

  const renderParameterField = (paramName: string, paramConfig: any) => {
    const isRequired = paramConfig.required || false;
    const paramType = paramConfig.type || "string";
    const description = paramConfig.description || "";

    const inputId = `param-${paramName}`;

    switch (paramType) {
      case "number":
        return (
          <div key={paramName}>
            <Label htmlFor={inputId}>
              {paramName.charAt(0).toUpperCase() + paramName.slice(1).replace(/([A-Z])/g, " $1")}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={inputId}
              type="number"
              value={params[paramName] || ""}
              onChange={(e) => handleParamChange(paramName, parseInt(e.target.value) || "")}
              placeholder={description}
              required={isRequired}
            />
          </div>
        );

      case "boolean":
        return (
          <div key={paramName} className="flex items-center gap-2">
            <input
              id={inputId}
              type="checkbox"
              checked={params[paramName] || false}
              onChange={(e) => handleParamChange(paramName, e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-border rounded"
            />
            <Label htmlFor={inputId} className="mb-0">
              {paramName.charAt(0).toUpperCase() + paramName.slice(1).replace(/([A-Z])/g, " $1")}
            </Label>
          </div>
        );

      default: // string
        return (
          <div key={paramName}>
            <Label htmlFor={inputId}>
              {paramName.charAt(0).toUpperCase() + paramName.slice(1).replace(/([A-Z])/g, " $1")}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={inputId}
              type="text"
              value={params[paramName] || ""}
              onChange={(e) => handleParamChange(paramName, e.target.value)}
              placeholder={description}
              required={isRequired}
            />
          </div>
        );
    }
  };

  if (!tool) return null;

  const parameterSchema = tool.metadata?.parameterSchema || {};
  const hasParameters = Object.keys(parameterSchema).length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure {tool.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tool Info */}
          <div className="bg-secondary p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-foreground mb-2">Tool Information</h4>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Category:</span> {tool.category.replace(/_/g, " ")}
              </p>
              {tool.description && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Description:</span> {tool.description}
                </p>
              )}
              {tool.command && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Command:</span>{" "}
                  <code className="bg-muted px-1 rounded text-xs">{tool.command}</code>
                </p>
              )}
            </div>
          </div>

          {/* MITRE ATT&CK Mapping */}
          {!agentId && allTactics.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4" />
                  MITRE ATT&CK Mapping
                </Label>
                {attackMappingChanged && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={saveAttackMapping}
                    disabled={!selectedTacticId || selectedTechniqueIds.size === 0}
                  >
                    Save Mapping
                  </Button>
                )}
              </div>

              {/* Tactic Select (exactly 1) */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Tactic (1 required)</Label>
                <Select value={selectedTacticId} onValueChange={handleTacticChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tactic..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allTactics
                      .sort((a: any, b: any) => (a.attackId || '').localeCompare(b.attackId || ''))
                      .map((tactic: any) => (
                      <SelectItem key={tactic.id} value={tactic.id}>
                        {tactic.attackId}: {tactic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Techniques Picker (1-3) — shown after tactic is selected */}
              {selectedTacticId && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    <Crosshair className="h-3 w-3 inline mr-1" />
                    Techniques (select 1-3)
                    <span className="ml-2 text-purple-400">{selectedTechniqueIds.size}/3</span>
                  </Label>
                  {availableTechniques.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Loading techniques...</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-border rounded-lg">
                      {availableTechniques
                        .sort((a: any, b: any) => (a.attackId || '').localeCompare(b.attackId || ''))
                        .map((tech: any) => (
                        <Badge
                          key={tech.id}
                          variant="outline"
                          className={`text-xs cursor-pointer transition-colors ${
                            selectedTechniqueIds.has(tech.id)
                              ? 'bg-purple-950/30 text-purple-300 border-purple-700'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => toggleTechnique(tech.id)}
                        >
                          {tech.attackId}: {tech.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Target Selection - Only show if no agentId */}
          {!agentId && (
            <div>
              <Label htmlFor="target-select">
                Target <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                <SelectTrigger id="target-select">
                  <SelectValue placeholder="Select target..." />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.name} ({target.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* AI Command Generation */}
          {!agentId && selectedTargetId && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateCommand}
                  disabled={generating}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  {generating ? "Generating..." : "Generate Command"}
                </Button>
              </div>

              {generatedCommand && (
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-200">Generated Command</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={handleCopyCommand} className="text-gray-400 hover:text-white">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <pre className="text-xs bg-black text-green-400 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                    {generatedCommand}
                  </pre>
                  {credentialInfo && (
                    <div className="mt-2 flex items-center gap-2">
                      <KeyRound className={`h-3.5 w-3.5 ${credentialInfo.used ? 'text-amber-400' : 'text-gray-600'}`} />
                      {credentialInfo.used ? (
                        <span className="text-xs text-amber-400">
                          Credentials applied
                          {credentialInfo.test > 0 && ` (${credentialInfo.test} test)`}
                          {credentialInfo.harvested > 0 && ` (${credentialInfo.harvested} harvested)`}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {credentialInfo.test + credentialInfo.harvested > 0
                            ? 'Credentials available but not applicable to this tool'
                            : 'No operation credentials found'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Parameters Form */}
          {hasParameters ? (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Parameters</h4>
              <div className="space-y-4">
                {Object.entries(parameterSchema).map(([paramName, paramConfig]: [string, any]) =>
                  renderParameterField(paramName, paramConfig)
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No configuration parameters available for this tool
            </div>
          )}

          {/* Execution Result */}
          {executionResult && (
            <div className="bg-secondary p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-foreground mb-2">Execution Result</h4>
              <pre className="text-xs bg-primary text-green-400 p-3 rounded overflow-auto max-h-48">
                {typeof executionResult.result === "string"
                  ? executionResult.result
                  : JSON.stringify(executionResult.result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {hasParameters && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleSave}
              disabled={!selectedTargetId && !agentId}
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save
            </Button>
          )}
          <Button
            type="button"
            onClick={handleExecute}
            disabled={executing || (!selectedTargetId && !agentId)}
          >
            <Play className="h-4 w-4 mr-1.5" />
            {executing ? "Executing..." : "Execute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
