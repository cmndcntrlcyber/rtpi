import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Terminal, Play, RefreshCw, Zap } from "lucide-react";
import { Tool } from "@/services/tools";
import { useTargets } from "@/hooks/useTargets";
import ModuleSelector from "./ModuleSelector";
import TerminalOutput from "./TerminalOutput";
import { api } from "@/lib/api";

interface MetasploitCardProps {
  tool: Tool;
}

export default function MetasploitCard({ tool }: MetasploitCardProps) {
  const { targets } = useTargets();
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [modules, setModules] = useState<any>({ modules: {} });
  const [selectedModules, setSelectedModules] = useState<Record<string, string>>({});
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState("");
  const [primaryModule, setPrimaryModule] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load modules on mount
  useEffect(() => {
    loadModules();
  }, []);

  // Update primary module when selections change
  useEffect(() => {
    const exploitPath = selectedModules.exploit;
    if (exploitPath) {
      setPrimaryModule({
        type: "exploit",
        path: exploitPath,
      });
    } else if (selectedModules.auxiliary) {
      setPrimaryModule({
        type: "auxiliary",
        path: selectedModules.auxiliary,
      });
    } else {
      setPrimaryModule(null);
    }
  }, [selectedModules]);

  const loadModules = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/v1/metasploit/modules");
      
      // Get all module types
      const modulesData: any = { modules: {} };
      for (const type of response.data.categories) {
        const typeResponse = await api.get(`/api/v1/metasploit/modules/${type}`);
        modulesData.modules[type] = typeResponse.data.categories;
      }
      
      setModules(modulesData);
    } catch (error) {
      console.error("Failed to load modules:", error);
      setModules({ modules: {} });
    } finally {
      setLoading(false);
    }
  };

  const handleModuleChange = (type: string, path: string) => {
    setSelectedModules((prev) => ({
      ...prev,
      [type]: path,
    }));
  };

  const handleParameterChange = (key: string, value: string) => {
    setParameters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAutoSelect = async () => {
    if (!selectedTarget) {
      alert("Please select a target first");
      return;
    }

    try {
      const response = await api.post("/api/v1/metasploit/auto-select", {
        targetId: selectedTarget,
      });

      const { selectedModule } = response.data;
      
      // Set the selected module
      setSelectedModules({
        [selectedModule.type]: selectedModule.path,
      });

      // Set parameters
      setParameters(selectedModule.parameters || {});

      alert(`Auto-selected: ${selectedModule.type}/${selectedModule.path}`);
    } catch (error) {
      console.error("Auto-select failed:", error);
      alert("Failed to auto-select module");
    }
  };

  const handleExecute = async () => {
    if (!selectedTarget) {
      alert("Please select a target");
      return;
    }

    if (!primaryModule) {
      alert("Please select at least one module");
      return;
    }

    try {
      setIsExecuting(true);
      setOutput(""); // Clear previous output

      const response = await api.post("/api/v1/metasploit/execute", {
        toolId: tool.id,
        targetId: selectedTarget,
        module: {
          type: primaryModule.type,
          path: primaryModule.path,
          parameters,
        },
      });

      const { result } = response.data;
      
      // Display output
      const fullOutput = [
        `=== Metasploit Execution ===`,
        `Module: ${result.moduleUsed}`,
        `Status: ${result.success ? "SUCCESS" : "FAILED"}`,
        `Duration: ${result.duration}ms`,
        `Timestamp: ${result.timestamp}`,
        ``,
        `=== Output ===`,
        result.output,
        ``,
      ];

      if (result.stderr) {
        fullOutput.push(`=== Errors ===`);
        fullOutput.push(result.stderr);
      }

      setOutput(fullOutput.join("\n"));
    } catch (error: any) {
      console.error("Execution failed:", error);
      const errorMsg = error.response?.data?.details || error.message || "Unknown error";
      setOutput(`Execution failed: ${errorMsg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusColor = () => {
    if (isExecuting) return "bg-yellow-500/10 text-yellow-600";
    if (tool.status === "running") return "bg-green-500/10 text-green-600";
    return "bg-gray-500/10 text-gray-600";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-red-600" />
              {tool.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={getStatusColor()}>
                {isExecuting ? "Executing" : tool.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target Selection */}
          <div className="space-y-2">
            <Label htmlFor="target-select">Target</Label>
            <div className="flex gap-2">
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger id="target-select" className="flex-1">
                  <SelectValue placeholder="Select target..." />
                </SelectTrigger>
                <SelectContent>
                  {targets.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No targets available
                    </SelectItem>
                  ) : (
                    targets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.name || target.hostname || target.ipAddress || target.domain || target.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoSelect}
                disabled={!selectedTarget || isExecuting}
                title="Auto-select module based on target"
              >
                <Zap className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Primary Module Display */}
          {primaryModule && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-md">
              <p className="text-xs font-semibold text-indigo-900 mb-1">Primary Module:</p>
              <p className="text-sm font-mono text-indigo-800">
                {primaryModule.type}/{primaryModule.path}
              </p>
            </div>
          )}

          {/* Module Selector Grid */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading modules...</p>
            </div>
          ) : (
            <ModuleSelector
              modules={modules.modules}
              selectedModules={selectedModules}
              onModuleChange={handleModuleChange}
            />
          )}

          {/* Module Parameters */}
          {primaryModule && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Module Parameters</h3>
              
              {/* Common parameters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="param-lhost">LHOST</Label>
                  <Input
                    id="param-lhost"
                    placeholder="Attacker IP"
                    value={parameters.LHOST || ""}
                    onChange={(e) => handleParameterChange("LHOST", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="param-lport">LPORT</Label>
                  <Input
                    id="param-lport"
                    placeholder="4444"
                    value={parameters.LPORT || ""}
                    onChange={(e) => handleParameterChange("LPORT", e.target.value)}
                  />
                </div>
              </div>

              {/* Payload selection for exploits */}
              {primaryModule.type === "exploit" && selectedModules.payload && (
                <div className="space-y-2">
                  <Label>Payload</Label>
                  <Input
                    value={selectedModules.payload}
                    disabled
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Execute Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleExecute}
              disabled={!selectedTarget || !primaryModule || isExecuting}
              className="flex-1"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Execute Module
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Terminal Output */}
      <TerminalOutput
        output={output}
        title="Metasploit Output"
        isExecuting={isExecuting}
      />
    </div>
  );
}
