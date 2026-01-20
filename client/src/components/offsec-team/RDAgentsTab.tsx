import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Activity, CheckCircle, AlertCircle, Clock, Code, Shield, Zap, Database, Cloud, FlaskConical } from "lucide-react";
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  config: any;
  capabilities: string[];
  tasksCompleted: number;
  tasksFailed: number;
  lastActivity: string | null;
}

export default function RDAgentsTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchRDAgents();
  }, []);

  const fetchRDAgents = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ agents: Agent[] }>("/agents");
      // Filter for R&D agents
      const rdAgents = response.agents.filter(
        (agent: Agent) => agent.config?.category === "R&D"
      );
      setAgents(rdAgents);
    } catch (error: any) {
      toast.error("Failed to load R&D agents");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getAgentIcon = (agentName: string) => {
    if (agentName.includes("Burp")) return Shield;
    if (agentName.includes("Empire")) return Zap;
    if (agentName.includes("Fuzzing")) return Activity;
    if (agentName.includes("Framework")) return Code;
    if (agentName.includes("Maldev")) return Database;
    if (agentName.includes("Azure")) return Cloud;
    return FlaskConical;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "idle":
        return "bg-green-100 text-green-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "idle":
        return <CheckCircle className="h-4 w-4" />;
      case "running":
        return <Activity className="h-4 w-4 animate-pulse" />;
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const filteredAgents = filter === "all"
    ? agents
    : agents.filter(agent => agent.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-muted-foreground">Loading R&D agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total R&D Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{agents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {agents.filter(a => a.status === "idle" || a.status === "running").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasks Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {agents.reduce((sum, a) => sum + a.tasksCompleted, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {agents.length > 0
                ? Math.round(
                    (agents.reduce((sum, a) => sum + a.tasksCompleted, 0) /
                      (agents.reduce((sum, a) => sum + a.tasksCompleted + a.tasksFailed, 0) || 1)) *
                      100
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({agents.length})
        </Button>
        <Button
          variant={filter === "idle" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("idle")}
        >
          Idle ({agents.filter(a => a.status === "idle").length})
        </Button>
        <Button
          variant={filter === "running" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("running")}
        >
          Running ({agents.filter(a => a.status === "running").length})
        </Button>
        <Button
          variant={filter === "error" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("error")}
        >
          Error ({agents.filter(a => a.status === "error").length})
        </Button>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => {
          const Icon = getAgentIcon(agent.name);
          return (
            <Card key={agent.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize mt-1">
                        {agent.type} Agent
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(agent.status)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(agent.status)}
                      {agent.status}
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Capabilities */}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Capabilities
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.slice(0, 3).map((cap, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {cap}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{agent.capabilities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Special Info */}
                  {agent.config?.repositories && (
                    <div className="flex items-center gap-2 text-sm">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {agent.config.repositories} repositories
                      </span>
                    </div>
                  )}

                  {agent.config?.primaryLanguage && (
                    <div className="flex items-center gap-2 text-sm">
                      <Code className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {agent.config.primaryLanguage}
                      </span>
                    </div>
                  )}

                  {/* Metrics */}
                  <div className="pt-3 border-t border-border">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-semibold text-foreground">
                          {agent.tasksCompleted}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Failed</p>
                        <p className="font-semibold text-foreground">
                          {agent.tasksFailed}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAgents.length === 0 && (
        <div className="text-center py-12">
          <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No agents found with the selected filter</p>
        </div>
      )}
    </div>
  );
}
