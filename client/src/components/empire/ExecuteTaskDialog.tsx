import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Terminal, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExecuteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string | null;
  agentName: string;
}

interface ModuleOption {
  name: string;
  description: string;
  required: boolean;
  value: string | number | boolean;
}

interface Module {
  name: string;
  category: string;
  description: string;
  author: string[];
  options: Record<string, ModuleOption>;
}

interface TaskResult {
  id: string;
  status: "pending" | "success" | "error";
  output?: string;
  error?: string;
}

export default function ExecuteTaskDialog({
  open,
  onOpenChange,
  serverId,
  agentName,
}: ExecuteTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingModules, setFetchingModules] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [shellCommand, setShellCommand] = useState("");
  const [taskMode, setTaskMode] = useState<"shell" | "module">("shell");
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);

  // Fetch available modules
  const fetchModules = async () => {
    if (!serverId) return;

    setFetchingModules(true);
    try {
      const response = await fetch(
        `/api/v1/empire/servers/${serverId}/modules`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setModules(data);
      }
    } catch (error) {
      // Error already shown via toast
    } finally {
      setFetchingModules(false);
    }
  };

  useEffect(() => {
    if (open && serverId) {
      fetchModules();
      setTaskResult(null);
    }
  }, [open, serverId]);

  // Initialize form data when module changes
  useEffect(() => {
    if (selectedModule) {
      const module = modules.find((m) => m.name === selectedModule);
      if (module) {
        const initialData: Record<string, any> = {};
        Object.entries(module.options).forEach(([key, option]) => {
          initialData[key] = option.value;
        });
        setFormData(initialData);
      }
    }
  }, [selectedModule, modules]);

  const handleExecuteShell = async () => {
    if (!serverId || !shellCommand.trim()) return;

    setLoading(true);
    setTaskResult({ id: "", status: "pending" });

    try {
      const response = await fetch(
        `/api/v1/empire/servers/${serverId}/agents/${agentName}/shell`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            command: shellCommand,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to execute shell command");
      }

      const result = await response.json();
      setTaskResult({
        id: result.taskID || "",
        status: "success",
        output: "Command queued successfully. Check agent output for results.",
      });
      setShellCommand("");
    } catch (error: any) {
      // Error already shown via toast
      setTaskResult({
        id: "",
        status: "error",
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteModule = async () => {
    if (!serverId || !selectedModule) return;

    setLoading(true);
    setTaskResult({ id: "", status: "pending" });

    try {
      const response = await fetch(
        `/api/v1/empire/servers/${serverId}/agents/${agentName}/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            module: selectedModule,
            options: formData,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to execute module");
      }

      const result = await response.json();
      setTaskResult({
        id: result.taskID || "",
        status: "success",
        output: "Module execution queued successfully. Check agent output for results.",
      });
      setSelectedModule("");
      setFormData({});
    } catch (error: any) {
      // Error already shown via toast
      setTaskResult({
        id: "",
        status: "error",
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const currentModule = modules.find((m) => m.name === selectedModule);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execute Task on Agent: {agentName}</DialogTitle>
          <DialogDescription>
            Execute shell commands or Empire modules on the agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mode Selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={taskMode === "shell" ? "default" : "outline"}
              onClick={() => setTaskMode("shell")}
              className="flex-1"
            >
              <Terminal className="h-4 w-4 mr-2" />
              Shell Command
            </Button>
            <Button
              type="button"
              variant={taskMode === "module" ? "default" : "outline"}
              onClick={() => setTaskMode("module")}
              className="flex-1"
            >
              Module Execution
            </Button>
          </div>

          {/* Shell Command Mode */}
          {taskMode === "shell" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shellCommand">Shell Command</Label>
                <Textarea
                  id="shellCommand"
                  placeholder="whoami"
                  value={shellCommand}
                  onChange={(e) => setShellCommand(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a shell command to execute on the agent
                </p>
              </div>

              <Button
                onClick={handleExecuteShell}
                disabled={loading || !shellCommand.trim()}
                className="w-full"
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Execute Shell Command
              </Button>
            </div>
          )}

          {/* Module Mode */}
          {taskMode === "module" && (
            <div className="space-y-4">
              {fetchingModules ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Loading modules...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="module">Module</Label>
                    <Select
                      value={selectedModule}
                      onValueChange={setSelectedModule}
                    >
                      <SelectTrigger id="module">
                        <SelectValue placeholder="Select module" />
                      </SelectTrigger>
                      <SelectContent>
                        {modules.map((module) => (
                          <SelectItem key={module.name} value={module.name}>
                            {module.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentModule && (
                      <div className="space-y-1">
                        <Badge variant="outline">{currentModule.category}</Badge>
                        <p className="text-xs text-muted-foreground">
                          {currentModule.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {currentModule && (
                    <div className="border-t pt-4 space-y-3">
                      <h4 className="font-medium">Module Options</h4>
                      {Object.entries(currentModule.options).map(
                        ([key, option]) => (
                          <div key={key} className="space-y-2">
                            <Label
                              htmlFor={key}
                              className="flex items-center gap-2"
                            >
                              {key}
                              {option.required && (
                                <span className="text-red-500 text-xs">*</span>
                              )}
                            </Label>
                            <Input
                              id={key}
                              type={
                                typeof option.value === "number"
                                  ? "number"
                                  : "text"
                              }
                              value={formData[key] || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  [key]:
                                    typeof option.value === "number"
                                      ? parseInt(e.target.value, 10)
                                      : e.target.value,
                                })
                              }
                              required={option.required}
                              placeholder={String(option.value)}
                            />
                            {option.description && (
                              <p className="text-xs text-muted-foreground">
                                {option.description}
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleExecuteModule}
                    disabled={loading || !selectedModule}
                    className="w-full"
                  >
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Execute Module
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Task Result */}
          {taskResult && (
            <div
              className={`p-4 rounded-lg border ${
                taskResult.status === "success"
                  ? "bg-green-50 border-green-200"
                  : taskResult.status === "error"
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex items-start gap-2">
                {taskResult.status === "success" ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : taskResult.status === "error" ? (
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Loader2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {taskResult.status === "success"
                      ? "Task Submitted"
                      : taskResult.status === "error"
                      ? "Execution Failed"
                      : "Processing..."}
                  </p>
                  {taskResult.output && (
                    <p className="text-sm mt-1">{taskResult.output}</p>
                  )}
                  {taskResult.error && (
                    <p className="text-sm mt-1 text-red-700">{taskResult.error}</p>
                  )}
                  {taskResult.id && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      Task ID: {taskResult.id}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
