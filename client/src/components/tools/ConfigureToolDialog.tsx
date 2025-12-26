/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Play, Save } from "lucide-react";
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
  
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [params, setParams] = useState<Record<string, any>>({});
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Initialize form when tool changes
  useEffect(() => {
    if (tool) {
      setParams({});
      setSelectedTargetId("");
      setExecutionResult(null);
      
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
      alert("Please select a target");
      return;
    }

    if (onSave) {
      onSave(tool.id, selectedTargetId, params);
    }
    
    alert("Configuration saved successfully");
  };

  const handleExecute = async () => {
    if (!tool) return;

    // Validate required fields
    const schema = tool.metadata?.parameterSchema || {};
    const missingRequired = Object.entries(schema)
      .filter(([_, config]: [string, any]) => config.required && !params[_])
      .map(([name]) => name);

    if (!selectedTargetId && !agentId) {
      alert("Please select a target");
      return;
    }

    if (missingRequired.length > 0) {
      alert(`Please fill in required fields: ${missingRequired.join(", ")}`);
      return;
    }

    try {
      const result = await executeDocker(tool.id, {
        targetId: selectedTargetId,
        agentId,
        params,
      });
      
      setExecutionResult(result);
      alert(`Tool ${tool.name} executed successfully!`);
      
      // Auto-save params after successful execution
      if (onSave && selectedTargetId) {
        onSave(tool.id, selectedTargetId, params);
      }
    } catch (err) {
      console.error("Execution error:", err);
      alert("Execution failed: " + (err instanceof Error ? err.message : "Unknown error"));
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
                      {target.hostname || target.ipAddress || target.domain || "Target"} 
                      {target.port && `:${target.port}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
