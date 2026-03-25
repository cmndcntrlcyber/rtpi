import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Radio,
  Plus,
  Play,
  Square,
  RefreshCw,
  Trash2,
  MessageCircle,
  ListTodo,
  Clock,
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";
import { useReporters, usePendingQuestions } from "@/hooks/useReporters";
import { reportersService, Reporter, ReporterQuestion } from "@/services/reporters";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-600",
  polling: "bg-blue-500/10 text-blue-600",
  idle: "bg-gray-500/10 text-gray-600",
  paused: "bg-yellow-500/10 text-yellow-600",
  error: "bg-red-500/10 text-red-600",
};

export default function AdminReporters() {
  const { isAdmin, isOperator } = useAuth();
  const { reporters, loading, error, refetch } = useReporters();
  const { questions: pendingQuestions, refetch: refetchQuestions } = usePendingQuestions();

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [respondOpen, setRespondOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<ReporterQuestion | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responding, setResponding] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskReporterId, setTaskReporterId] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const canManage = isAdmin() || isOperator();

  if (!canManage) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Access denied. Admin or Operator privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredReporters = statusFilter === "all"
    ? reporters
    : reporters.filter((r) => r.status === statusFilter);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      setCreating(true);
      await reportersService.create({
        name: form.get("name") as string,
        pageId: (form.get("pageId") as string) || undefined,
        pageUrl: (form.get("pageUrl") as string) || undefined,
        pollIntervalMs: parseInt(form.get("pollInterval") as string) * 60000 || 3600000,
        tags: (form.get("tags") as string)?.split(",").map((t) => t.trim()).filter(Boolean) || [],
      });
      toast.success("Reporter created");
      setCreateOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create reporter");
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await reportersService.start(id);
      toast.success("Reporter started");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start reporter");
    }
  };

  const handleStop = async (id: string) => {
    try {
      await reportersService.stop(id);
      toast.success("Reporter stopped");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to stop reporter");
    }
  };

  const handlePoll = async (id: string) => {
    try {
      await reportersService.poll(id);
      toast.success("Poll triggered");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to trigger poll");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete reporter "${name}"? This cannot be undone.`)) return;
    try {
      await reportersService.delete(id);
      toast.success("Reporter deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete reporter");
    }
  };

  const handleRespond = async () => {
    if (!selectedQuestion || !responseText.trim()) return;
    try {
      setResponding(true);
      await reportersService.respondToQuestion(selectedQuestion.id, responseText.trim());
      toast.success("Response submitted");
      setRespondOpen(false);
      setSelectedQuestion(null);
      setResponseText("");
      refetchQuestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!taskReporterId) return;
    const form = new FormData(e.currentTarget);
    try {
      setCreatingTask(true);
      await reportersService.createTask(taskReporterId, {
        taskName: form.get("taskName") as string,
        taskDescription: (form.get("taskDescription") as string) || undefined,
        taskType: (form.get("taskType") as string) || undefined,
        priority: parseInt(form.get("priority") as string) || 5,
      });
      toast.success("Task assigned");
      setTaskOpen(false);
      setTaskReporterId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  };

  const stats = {
    total: reporters.length,
    active: reporters.filter((r) => r.status === "active" || r.status === "polling").length,
    paused: reporters.filter((r) => r.status === "paused" || r.status === "idle").length,
    pendingQuestions: pendingQuestions.length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Radio className="h-8 w-8" />
            Reporter Agents
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage reporter agents that monitor pages and generate intelligence
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Reporter
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Reporters</h3>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active</h3>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Paused / Idle</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.paused}</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Pending Questions</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.pendingQuestions}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Pending Questions Section */}
      {pendingQuestions.length > 0 && (
        <Card className="mb-6 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-600" />
              Pending Questions ({pendingQuestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingQuestions.slice(0, 5).map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between px-3 py-2 rounded border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium truncate">{q.question}</p>
                    <p className="text-xs text-muted-foreground">
                      Priority: {q.priority} &bull; {new Date(q.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedQuestion(q);
                      setResponseText("");
                      setRespondOpen(true);
                    }}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Respond
                  </Button>
                </div>
              ))}
              {pendingQuestions.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{pendingQuestions.length - 5} more questions
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-sm">Filter:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="polling">Polling</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="h-8" onClick={refetch}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Reporters Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReporters.length === 0 ? (
            <div className="text-center py-12">
              <Radio className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {statusFilter !== "all" ? "No reporters with this status" : "No reporters yet"}
              </p>
              <Button className="mt-3" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Reporter
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Page</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Polls</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Q&A</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Last Poll</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReporters.map((reporter) => (
                    <tr key={reporter.id} className="border-b hover:bg-accent/30 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium">{reporter.name}</p>
                          {reporter.tags && reporter.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {reporter.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`text-xs ${STATUS_COLORS[reporter.status] || ""}`}>
                          {reporter.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {reporter.pageId || reporter.pageUrl || "-"}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm">{reporter.totalPolls}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm">{reporter.totalQuestions}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-muted-foreground">
                          {reporter.lastPollAt
                            ? new Date(reporter.lastPollAt).toLocaleString()
                            : "Never"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 justify-end">
                          {(reporter.status === "idle" || reporter.status === "paused") && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleStart(reporter.id)}>
                              <Play className="h-3 w-3 mr-1" />
                              Start
                            </Button>
                          )}
                          {(reporter.status === "active" || reporter.status === "polling") && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleStop(reporter.id)}>
                              <Square className="h-3 w-3 mr-1" />
                              Stop
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handlePoll(reporter.id)}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => {
                              setTaskReporterId(reporter.id);
                              setTaskOpen(true);
                            }}
                          >
                            <ListTodo className="h-3 w-3" />
                          </Button>
                          {isAdmin() && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(reporter.id, reporter.name)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Reporter Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Reporter</DialogTitle>
            <DialogDescription>
              Create a reporter agent to monitor a page and generate intelligence.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" placeholder="Dashboard Reporter" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pageId">Page ID</Label>
              <Input id="pageId" name="pageId" placeholder="e.g., targets, vulnerabilities, operations" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pageUrl">Page URL</Label>
              <Input id="pageUrl" name="pageUrl" placeholder="e.g., /targets" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pollInterval">Poll Interval (minutes)</Label>
              <Input id="pollInterval" name="pollInterval" type="number" defaultValue="60" min="1" max="1440" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" name="tags" placeholder="recon, targets, daily" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Reporter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Respond to Question Dialog */}
      {selectedQuestion && (
        <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Respond to Question</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded p-3">
                <p className="text-sm font-medium">{selectedQuestion.question}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Priority: {selectedQuestion.priority} &bull; {new Date(selectedQuestion.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="response">Your Response</Label>
                <Textarea
                  id="response"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Provide your response..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRespondOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRespond} disabled={responding || !responseText.trim()}>
                {responding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Submit Response
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task to Reporter</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taskName">Task Name *</Label>
              <Input id="taskName" name="taskName" placeholder="Investigate anomaly" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskDescription">Description</Label>
              <Textarea id="taskDescription" name="taskDescription" placeholder="Detailed instructions..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskType">Task Type</Label>
              <Select name="taskType" defaultValue="investigation">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigation">Investigation</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="reporting">Reporting</SelectItem>
                  <SelectItem value="data_collection">Data Collection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-10)</Label>
              <Input id="priority" name="priority" type="number" defaultValue="5" min="1" max="10" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTaskOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingTask}>
                {creatingTask ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ListTodo className="h-4 w-4 mr-2" />}
                Assign Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
