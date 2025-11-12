import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Server, Activity, Clock, Plus } from "lucide-react";
import { useAgents } from "@/hooks/useAgents";
import { useMCPServers } from "@/hooks/useMCPServers";

export default function Agents() {
  const { agents, loading: agentsLoading, refetch: refetchAgents } = useAgents();
  const { servers: mcpServers, loading: serversLoading, refetch: refetchServers } = useMCPServers();
  
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    type: "openai" as any,
    config: {},
    capabilities: [],
  });
  const [newServer, setNewServer] = useState({
    name: "",
    command: "",
    args: [],
    autoRestart: true,
  });

  const handleCreateAgent = async () => {
    try {
      const response = await fetch("/api/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newAgent),
      });

      if (!response.ok) throw new Error("Failed to create agent");

      await refetchAgents();
      setAgentDialogOpen(false);
      setNewAgent({ name: "", type: "openai", config: {}, capabilities: [] });
    } catch (err) {
      console.error("Failed to create agent:", err);
      alert("Failed to create agent");
    }
  };

  const handleCreateServer = async () => {
    try {
      const response = await fetch("/api/v1/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newServer),
      });

      if (!response.ok) throw new Error("Failed to create MCP server");

      await refetchServers();
      setServerDialogOpen(false);
      setNewServer({ name: "", command: "", args: [], autoRestart: true });
    } catch (err) {
      console.error("Failed to create MCP server:", err);
      alert("Failed to create MCP server");
    }
  };

  const stats = {
    aiAgents: agents.length,
    active: agents.filter((a) => a.status === "running").length,
    mcpServers: mcpServers.length,
    connected: mcpServers.filter((s) => s.status === "running").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">AI Agents & MCP Servers</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">AI Agents</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.aiAgents}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Active Agents</h3>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">MCP Servers</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.mcpServers}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Connected</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.connected}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ai">AI Agents</TabsTrigger>
          <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setAgentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Import Agent
            </Button>
          </div>

          {agentsLoading ? (
            <p className="text-gray-500">Loading AI agents...</p>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No AI agents configured</p>
              <p className="text-sm text-gray-500 mb-4">Import an AI agent to get started</p>
              <Button onClick={() => setAgentDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Import Agent
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <Card key={agent.id} className="bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white mr-3">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                          <p className="text-sm text-gray-500">{agent.type}</p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${
                          agent.status === "running"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-gray-500/10 text-gray-600"
                        }`}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Activity className="h-4 w-4 mr-2" />
                        <span>{agent.tasksCompleted} tasks</span>
                      </div>
                      {agent.lastActivity && (
                        <div className="flex items-center text-gray-600">
                          <Clock className="h-4 w-4 mr-2" />
                          <span>{new Date(agent.lastActivity).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mcp" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setServerDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add MCP Server
            </Button>
          </div>

          {serversLoading ? (
            <p className="text-gray-500">Loading MCP servers...</p>
          ) : mcpServers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No MCP servers configured</p>
              <p className="text-sm text-gray-500 mb-4">Add an MCP server to get started</p>
              <Button onClick={() => setServerDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add MCP Server
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mcpServers.map((server) => (
                <Card key={server.id} className="bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white mr-3">
                          <Server className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{server.name}</h3>
                          <p className="text-sm text-gray-500">MCP Server</p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${
                          server.status === "running"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-gray-500/10 text-gray-600"
                        }`}
                      >
                        {server.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-2 truncate">
                      {server.command}
                    </div>
                    {server.autoRestart && (
                      <div className="text-xs text-gray-500">
                        Auto-restart enabled
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Import Agent Dialog */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import AI Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="GPT-4 Analysis Agent"
              />
            </div>
            <div>
              <Label htmlFor="agent-type">Agent Type</Label>
              <Select value={newAgent.type} onValueChange={(value: any) => setNewAgent({ ...newAgent, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="mcp_server">MCP Server</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAgent} disabled={!newAgent.name}>
                Import Agent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add MCP Server Dialog */}
      <Dialog open={serverDialogOpen} onOpenChange={setServerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="server-name">Server Name</Label>
              <Input
                id="server-name"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                placeholder="Tavily Search Server"
              />
            </div>
            <div>
              <Label htmlFor="server-command">Command</Label>
              <Input
                id="server-command"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                placeholder="npx -y tavily-mcp@latest"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-restart"
                checked={newServer.autoRestart}
                onChange={(e) => setNewServer({ ...newServer, autoRestart: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="auto-restart">Auto-restart on failure</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setServerDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateServer} disabled={!newServer.name || !newServer.command}>
                Add Server
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
