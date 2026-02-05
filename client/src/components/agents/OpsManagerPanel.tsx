import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  MessageSquare,
  ListTodo,
  Users,
  Play,
  Pause,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import QuestionQueue from "./QuestionQueue";

interface OpsManagerStatus {
  isActive: boolean;
  pendingQuestions: number;
  activeReporters: number;
  totalTasksAssigned: number;
}

interface Reporter {
  id: string;
  name: string;
  pageId: string;
  status: string;
  lastPollAt: string | null;
  totalPolls: number;
  totalQuestions: number;
  totalTasks: number;
}

interface OpsManagerPanelProps {
  operationId?: string;
}

export default function OpsManagerPanel({ operationId }: OpsManagerPanelProps) {
  const [status, setStatus] = useState<OpsManagerStatus | null>(null);
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [operationId]);

  const loadData = async () => {
    try {
      // Load status
      const statusResponse = await api.get<{ status: OpsManagerStatus }>("/reporters/ops-manager/status").catch(() => ({
        status: { isActive: false, pendingQuestions: 0, activeReporters: 0, totalTasksAssigned: 0 }
      }));
      setStatus(statusResponse.status);

      // Load reporters
      const reportersResponse = await api.get<{ reporters: Reporter[] }>(
        operationId ? `/reporters?operationId=${operationId}` : "/reporters"
      );
      setReporters(reportersResponse.reporters || []);
    } catch (err) {
      console.error("Failed to load ops manager data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  const handleStartReporter = async (reporterId: string) => {
    try {
      await api.post(`/reporters/${reporterId}/start`, {});
      await loadData();
      toast.success("Reporter started");
    } catch (err) {
      toast.error("Failed to start reporter");
    }
  };

  const handleStopReporter = async (reporterId: string) => {
    try {
      await api.post(`/reporters/${reporterId}/stop`, {});
      await loadData();
      toast.success("Reporter stopped");
    } catch (err) {
      toast.error("Failed to stop reporter");
    }
  };

  const handlePollReporter = async (reporterId: string) => {
    try {
      await api.post(`/reporters/${reporterId}/poll`, {});
      await loadData();
      toast.success("Poll triggered");
    } catch (err) {
      toast.error("Failed to poll reporter");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold">
                  {status?.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <Activity className={`h-8 w-8 ${status?.isActive ? 'text-green-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Questions</p>
                <p className="text-2xl font-bold">{status?.pendingQuestions || 0}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Reporters</p>
                <p className="text-2xl font-bold">{status?.activeReporters || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Assigned</p>
                <p className="text-2xl font-bold">{status?.totalTasksAssigned || 0}</p>
              </div>
              <ListTodo className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-600" />
              Operations Manager
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="questions">
            <TabsList>
              <TabsTrigger value="questions">
                Question Queue
                {(status?.pendingQuestions || 0) > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-700">
                    {status?.pendingQuestions}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="reporters">
                Reporters
                <Badge variant="secondary" className="ml-2">
                  {reporters.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="questions" className="mt-4">
              <QuestionQueue operationId={operationId} onAction={loadData} />
            </TabsContent>

            <TabsContent value="reporters" className="mt-4">
              {reporters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No reporters configured</p>
                  <p className="text-sm">Create a reporter to start monitoring</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reporters.map((reporter) => (
                    <div
                      key={reporter.id}
                      className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${
                          reporter.status === 'active' ? 'bg-green-500' :
                          reporter.status === 'polling' ? 'bg-blue-500 animate-pulse' :
                          reporter.status === 'error' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`} />
                        <div>
                          <h4 className="font-medium">{reporter.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {reporter.pageId}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground text-right">
                          <p>Polls: {reporter.totalPolls}</p>
                          <p>Questions: {reporter.totalQuestions}</p>
                        </div>

                        <Badge
                          variant="secondary"
                          className={`capitalize ${
                            reporter.status === 'active' ? 'bg-green-100 text-green-700' :
                            reporter.status === 'error' ? 'bg-red-100 text-red-700' :
                            ''
                          }`}
                        >
                          {reporter.status}
                        </Badge>

                        <div className="flex gap-1">
                          {reporter.status === 'active' ? (
                            <Button size="sm" variant="ghost" onClick={() => handleStopReporter(reporter.id)}>
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleStartReporter(reporter.id)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handlePollReporter(reporter.id)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
