import { useState, useEffect } from "react";
import { Activity, Shield, Terminal, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentWebSocket, type AgentEvent, type ApprovalRequest } from "@/hooks/useAgentWebSocket";

export default function EngagementDashboard() {
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>("");
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { connected, events, pendingApprovals, approve, deny, subscribe } = useAgentWebSocket({
    autoConnect: true,
  });

  // Load operations
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<{ operations: any[] }>("/operations");
        setOperations(res.operations || []);
        const active = res.operations?.filter((op: any) => op.status === "active") || [];
        if (active.length > 0) {
          setSelectedOperation(active[0].id);
        }
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Subscribe to selected operation's events
  useEffect(() => {
    if (selectedOperation) {
      subscribe([selectedOperation]);
    }
  }, [selectedOperation, subscribe]);

  // Load workflows for selected operation
  useEffect(() => {
    if (!selectedOperation) return;
    const loadWorkflows = async () => {
      try {
        const res = await api.get<any[]>(`/agent-workflows?operationId=${selectedOperation}`);
        setWorkflows(Array.isArray(res) ? res : []);
      } catch {
        setWorkflows([]);
      }
    };
    loadWorkflows();
    const interval = setInterval(loadWorkflows, 10000);
    return () => clearInterval(interval);
  }, [selectedOperation]);

  // Filter events for selected operation
  const operationEvents = events.filter(
    (e) => !selectedOperation || e.operationId === selectedOperation || !e.operationId,
  );

  const toolEvents = operationEvents.filter((e) => e.type === "tool_execution");
  const activityEvents = operationEvents.filter((e) => e.type === "agent_activity" || e.type === "workflow_update");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Engagement Dashboard</h1>
          <p className="text-muted-foreground">Real-time agent activity and workflow monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={connected ? "default" : "destructive"} className="flex items-center gap-1">
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Live" : "Disconnected"}
          </Badge>
          <Select value={selectedOperation} onValueChange={setSelectedOperation}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select operation..." />
            </SelectTrigger>
            <SelectContent>
              {operations.map((op) => (
                <SelectItem key={op.id} value={op.id}>
                  {op.name} ({op.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Approval Requests Banner */}
      {pendingApprovals.length > 0 && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Pending Approvals ({pendingApprovals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovals.map((req) => (
              <div key={req.approvalId} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div>
                  <p className="font-medium">{req.tool}</p>
                  <p className="text-sm text-muted-foreground">{req.reason}</p>
                  {req.args.length > 0 && (
                    <p className="text-xs font-mono text-muted-foreground mt-1">{req.args.join(" ")}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => deny(req.approvalId, "Denied by operator")}>
                    Deny
                  </Button>
                  <Button size="sm" onClick={() => approve(req.approvalId, "Approved by operator")}>
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Agent Activity</TabsTrigger>
          <TabsTrigger value="tools">Tool Executions ({toolEvents.length})</TabsTrigger>
          <TabsTrigger value="workflows">Workflows ({workflows.length})</TabsTrigger>
        </TabsList>

        {/* Agent Activity Tab */}
        <TabsContent value="activity" className="space-y-3">
          {activityEvents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No agent activity yet. Start a workflow to see real-time events.
              </CardContent>
            </Card>
          ) : (
            activityEvents.slice(0, 50).map((event) => (
              <Card key={event.eventId} className="py-0">
                <CardContent className="py-3 flex items-center gap-3">
                  <Activity className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {event.agentName && <Badge variant="outline" className="text-xs">{event.agentName}</Badge>}
                      <span className="text-sm">{event.data?.summary || event.data?.message || event.data?.action || "Activity"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tool Executions Tab */}
        <TabsContent value="tools" className="space-y-3">
          {toolEvents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No tool executions recorded yet.
              </CardContent>
            </Card>
          ) : (
            toolEvents.slice(0, 50).map((event) => (
              <Card key={event.eventId} className="py-0">
                <CardContent className="py-3 flex items-center gap-3">
                  <Terminal className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{event.data?.tool}</span>
                      <Badge variant={event.data?.exitCode === 0 ? "default" : "destructive"} className="text-xs">
                        {event.data?.exitCode === 0 ? "OK" : `exit ${event.data?.exitCode}`}
                      </Badge>
                      {event.data?.iteration && (
                        <span className="text-xs text-muted-foreground">iter {event.data.iteration}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {event.agentName && <span>{event.agentName}</span>}
                      {event.data?.outputLength && <span>{event.data.outputLength} bytes</span>}
                      <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-3">
          {workflows.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No workflows for this operation.
              </CardContent>
            </Card>
          ) : (
            workflows.map((wf: any) => (
              <Card key={wf.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{wf.name || wf.workflowType || "Workflow"}</p>
                      <p className="text-sm text-muted-foreground">
                        {wf.currentAgentId ? `Current agent: ${wf.currentAgentId}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        wf.status === "completed" ? "default" :
                        wf.status === "running" ? "secondary" :
                        wf.status === "failed" ? "destructive" : "outline"
                      }>
                        {wf.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {wf.status === "running" && <Clock className="h-3 w-3 mr-1 animate-spin" />}
                        {wf.status}
                      </Badge>
                      {wf.progress !== undefined && (
                        <span className="text-sm text-muted-foreground">{wf.progress}%</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
