import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  Edit2,
  Calendar,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

// ============================================================================
// Types
// ============================================================================

interface ScanSchedule {
  id: string;
  operationId: string;
  name: string;
  description?: string;
  cronExpression: string;
  toolConfig: {
    bbot?: {
      targets: string[];
      flags?: string[];
      config?: Record<string, any>;
    };
    nuclei?: {
      targets: string[];
      templates?: string[];
      severity?: string[];
      config?: Record<string, any>;
    };
  };
  targets: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  failureCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CronPreset {
  name: string;
  expression: string;
  readable: string;
}

interface ScheduleStatistics {
  total: number;
  enabled: number;
  disabled: number;
  lastRun: string | null;
}

// ============================================================================
// Main Component
// ============================================================================

interface ScheduleManagerTabProps {
  operationId: string;
}

export default function ScheduleManagerTab({ operationId }: ScheduleManagerTabProps) {
  const [schedules, setSchedules] = useState<ScanSchedule[]>([]);
  const [statistics, setStatistics] = useState<ScheduleStatistics | null>(null);
  const [cronPresets, setCronPresets] = useState<CronPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScanSchedule | null>(null);

  useEffect(() => {
    loadSchedules();
    loadCronPresets();
    loadStatistics();
  }, [operationId]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const data = await api.get<ScanSchedule[]>(`/scan-schedules?operationId=${operationId}`);
      setSchedules(data);
    } catch (error) {
      console.error("Failed to load schedules:", error);
      toast.error("Failed to load scan schedules");
    } finally {
      setLoading(false);
    }
  };

  const loadCronPresets = async () => {
    try {
      const data = await api.get<CronPreset[]>("/scan-schedules/presets/list");
      setCronPresets(data);
    } catch (error) {
      console.error("Failed to load cron presets:", error);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await api.get<ScheduleStatistics>("/scan-schedules/statistics/summary");
      setStatistics(data);
    } catch (error) {
      console.error("Failed to load statistics:", error);
    }
  };

  const handleToggleSchedule = async (schedule: ScanSchedule) => {
    try {
      const endpoint = schedule.enabled
        ? `/scan-schedules/${schedule.id}/disable`
        : `/scan-schedules/${schedule.id}/enable`;
      await api.post(endpoint, {});
      toast.success(`Schedule ${schedule.enabled ? "disabled" : "enabled"} successfully`);
      loadSchedules();
      loadStatistics();
    } catch (error) {
      toast.error(`Failed to ${schedule.enabled ? "disable" : "enable"} schedule`);
    }
  };

  const handleTriggerSchedule = async (scheduleId: string) => {
    try {
      await api.post(`/scan-schedules/${scheduleId}/trigger`, {});
      toast.success("Schedule triggered successfully");
      loadSchedules();
    } catch (error) {
      toast.error("Failed to trigger schedule");
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    try {
      await api.delete(`/scan-schedules/${scheduleId}`);
      toast.success("Schedule deleted successfully");
      loadSchedules();
      loadStatistics();
    } catch (error) {
      toast.error("Failed to delete schedule");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Statistics */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Scan Schedules</h2>
          <p className="text-muted-foreground mt-1">
            Automate security scans with cron expressions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadSchedules} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <ScheduleForm
                operationId={operationId}
                cronPresets={cronPresets}
                onSuccess={() => {
                  setCreateDialogOpen(false);
                  loadSchedules();
                  loadStatistics();
                }}
                onCancel={() => setCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
                <p className="text-2xl font-bold text-foreground">{statistics.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-cyan-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Enabled</p>
                <p className="text-2xl font-bold text-green-600">{statistics.enabled}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disabled</p>
                <p className="text-2xl font-bold text-muted-foreground">{statistics.disabled}</p>
              </div>
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Run</p>
                <p className="text-sm font-medium text-foreground">
                  {statistics.lastRun
                    ? format(new Date(statistics.lastRun), "MMM d, h:mm a")
                    : "Never"}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </Card>
        </div>
      )}

      {/* Schedules Table */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-foreground">Configured Schedules</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Tools</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">No schedules configured</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click "Create Schedule" to get started
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">{schedule.name}</div>
                        {schedule.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {schedule.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {schedule.cronExpression}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {schedule.toolConfig.bbot && (
                          <Badge variant="outline" className="text-xs">
                            BBOT
                          </Badge>
                        )}
                        {schedule.toolConfig.nuclei && (
                          <Badge variant="outline" className="text-xs">
                            Nuclei
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={schedule.enabled ? "default" : "secondary"}
                        className={schedule.enabled ? "bg-green-600" : ""}
                      >
                        {schedule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {schedule.lastRun ? (
                        <div className="text-sm">
                          {format(new Date(schedule.lastRun), "MMM d, h:mm a")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {schedule.nextRun ? (
                        <div className="text-sm">
                          {format(new Date(schedule.nextRun), "MMM d, h:mm a")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600">{schedule.runCount} runs</span>
                        {schedule.failureCount > 0 && (
                          <span className="text-red-600">{schedule.failureCount} fails</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTriggerSchedule(schedule.id)}
                          title="Run now"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSchedule(schedule)}
                          title={schedule.enabled ? "Disable" : "Enable"}
                        >
                          {schedule.enabled ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSchedule(schedule)}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingSchedule} onOpenChange={() => setEditingSchedule(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {editingSchedule && (
            <ScheduleForm
              operationId={operationId}
              cronPresets={cronPresets}
              existingSchedule={editingSchedule}
              onSuccess={() => {
                setEditingSchedule(null);
                loadSchedules();
                loadStatistics();
              }}
              onCancel={() => setEditingSchedule(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Schedule Form Component
// ============================================================================

interface ScheduleFormProps {
  operationId: string;
  cronPresets: CronPreset[];
  existingSchedule?: ScanSchedule;
  onSuccess: () => void;
  onCancel: () => void;
}

function ScheduleForm({
  operationId,
  cronPresets,
  existingSchedule,
  onSuccess,
  onCancel,
}: ScheduleFormProps) {
  const [name, setName] = useState(existingSchedule?.name || "");
  const [description, setDescription] = useState(existingSchedule?.description || "");
  const [cronExpression, setCronExpression] = useState(existingSchedule?.cronExpression || "");
  const [cronReadable, setCronReadable] = useState("");
  const [targets, setTargets] = useState(
    existingSchedule?.targets.join("\n") || ""
  );
  const [toolType, setToolType] = useState<"bbot" | "nuclei">(
    existingSchedule?.toolConfig.bbot ? "bbot" : "nuclei"
  );
  const [bbotFlags, setBbotFlags] = useState("");
  const [nucleiTemplates, setNucleiTemplates] = useState("");
  const [nucleiSeverity, setNucleiSeverity] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(existingSchedule?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);

  const validateCronExpression = async (expression: string) => {
    if (!expression.trim()) {
      setCronReadable("");
      return;
    }

    try {
      const result = await api.post<{ isValid: boolean; readable: string | null }>(
        "/scan-schedules/validate-cron",
        { cronExpression: expression }
      );
      setCronReadable(result.isValid ? result.readable || "" : "Invalid cron expression");
    } catch (error) {
      setCronReadable("Invalid cron expression");
    }
  };

  useEffect(() => {
    if (cronExpression) {
      validateCronExpression(cronExpression);
    }
  }, [cronExpression]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const targetsArray = targets
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);

      const toolConfig: any = {};
      if (toolType === "bbot") {
        toolConfig.bbot = {
          targets: targetsArray,
          flags: bbotFlags
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean),
        };
      } else {
        toolConfig.nuclei = {
          targets: targetsArray,
          templates: nucleiTemplates
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          severity: nucleiSeverity,
        };
      }

      const payload = {
        name,
        description,
        operationId,
        cronExpression,
        toolConfig,
        targets: targetsArray,
        enabled,
      };

      if (existingSchedule) {
        await api.put(`/scan-schedules/${existingSchedule.id}`, payload);
        toast.success("Schedule updated successfully");
      } else {
        await api.post("/scan-schedules", payload);
        toast.success("Schedule created successfully");
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to save schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {existingSchedule ? "Edit Schedule" : "Create New Schedule"}
        </DialogTitle>
        <DialogDescription>
          Configure automated security scans with cron expressions
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        {/* Name */}
        <div>
          <Label htmlFor="name">Schedule Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Weekly Vulnerability Scan"
            required
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of this schedule"
            rows={2}
          />
        </div>

        {/* Cron Expression */}
        <div>
          <Label htmlFor="cron">Cron Expression *</Label>
          <div className="flex gap-2">
            <Input
              id="cron"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="e.g., 0 2 * * 1 (Mondays at 2 AM)"
              required
              className="flex-1"
            />
            <Select value={cronExpression} onValueChange={setCronExpression}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Use preset" />
              </SelectTrigger>
              <SelectContent>
                {cronPresets.map((preset) => (
                  <SelectItem key={preset.expression} value={preset.expression}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cronReadable && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" />
              {cronReadable}
            </p>
          )}
        </div>

        {/* Tool Type */}
        <div>
          <Label>Scan Tool *</Label>
          <Select value={toolType} onValueChange={(v: any) => setToolType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bbot">BBOT (Reconnaissance)</SelectItem>
              <SelectItem value="nuclei">Nuclei (Vulnerability Scanning)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Targets */}
        <div>
          <Label htmlFor="targets">Targets * (one per line)</Label>
          <Textarea
            id="targets"
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            placeholder="example.com&#10;192.168.1.0/24&#10;10.0.0.1"
            rows={4}
            required
          />
        </div>

        {/* Tool-specific config */}
        {toolType === "bbot" && (
          <div>
            <Label htmlFor="bbotFlags">BBOT Flags (comma-separated)</Label>
            <Input
              id="bbotFlags"
              value={bbotFlags}
              onChange={(e) => setBbotFlags(e.target.value)}
              placeholder="e.g., -f subdomain-enum, -f cloud-enum"
            />
          </div>
        )}

        {toolType === "nuclei" && (
          <>
            <div>
              <Label htmlFor="nucleiTemplates">Templates (comma-separated)</Label>
              <Input
                id="nucleiTemplates"
                value={nucleiTemplates}
                onChange={(e) => setNucleiTemplates(e.target.value)}
                placeholder="e.g., cves, vulnerabilities, exposures"
              />
            </div>
            <div>
              <Label>Severity Filter</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {["critical", "high", "medium", "low", "info"].map((sev) => (
                  <Button
                    key={sev}
                    type="button"
                    variant={nucleiSeverity.includes(sev) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (nucleiSeverity.includes(sev)) {
                        setNucleiSeverity(nucleiSeverity.filter((s) => s !== sev));
                      } else {
                        setNucleiSeverity([...nucleiSeverity, sev]);
                      }
                    }}
                  >
                    {sev}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Enabled */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="enabled" className="cursor-pointer">
            Enable schedule immediately
          </Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : existingSchedule ? "Update Schedule" : "Create Schedule"}
        </Button>
      </div>
    </form>
  );
}
