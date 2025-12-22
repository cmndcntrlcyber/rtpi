import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";
import EmpireServerCard from "./EmpireServerCard";
import EmpireListenersTable from "./EmpireListenersTable";
import EmpireAgentsTable from "./EmpireAgentsTable";

interface EmpireServer {
  id: string;
  name: string;
  host: string;
  port: number;
  restApiUrl: string;
  status: string;
  version: string | null;
  lastHeartbeat: string | null;
  isActive: boolean;
}

export default function EmpireTab() {
  const [servers, setServers] = useState<EmpireServer[]>([]);
  const [listeners, setListeners] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  // Fetch Empire servers
  const fetchServers = async () => {
    try {
      const response = await fetch("/api/v1/empire/servers", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setServers(data);
        if (data.length > 0 && !selectedServerId) {
          setSelectedServerId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch Empire servers:", error);
      console.error("Operation completed");
    }
  };

  // Fetch listeners for selected server
  const fetchListeners = async (serverId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/empire/servers/${serverId}/listeners`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setListeners(data);
      }
    } catch (error) {
      console.error("Failed to fetch listeners:", error);
      console.error("Operation completed");
    } finally {
      setLoading(false);
    }
  };

  // Fetch agents for selected server
  const fetchAgents = async (serverId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/empire/servers/${serverId}/agents`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      console.error("Operation completed");
    } finally {
      setLoading(false);
    }
  };

  // Sync agents to database
  const syncAgents = async (serverId: string) => {
    try {
      const response = await fetch(`/api/v1/empire/servers/${serverId}/agents/sync`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
      console.error("Operation completed");
        fetchAgents(serverId);
      }
    } catch (error) {
      console.error("Failed to sync agents:", error);
      console.error("Operation completed");
    }
  };

  // Check connection to Empire server
  const handleCheckConnection = async (server: EmpireServer) => {
    try {
      const response = await fetch(`/api/v1/empire/servers/${server.id}/check-connection`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
      console.error("Operation completed");
        fetchServers();
      }
    } catch (error) {
      console.error("Failed to check connection:", error);
      console.error("Operation completed");
    }
  };

  // Refresh token for Empire server
  const handleRefreshToken = async (server: EmpireServer) => {
    try {
      const response = await fetch(`/api/v1/empire/tokens/${server.id}/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
      console.error("Operation completed");
      }
    } catch (error) {
      console.error("Failed to refresh token:", error);
      console.error("Operation completed");
    }
  };

  // Stop a listener
  const handleStopListener = async (listenerName: string) => {
    if (!selectedServerId) return;

    try {
      const response = await fetch(
        `/api/v1/empire/servers/${selectedServerId}/listeners/${listenerName}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
      console.error("Operation completed");
        fetchListeners(selectedServerId);
      }
    } catch (error) {
      console.error("Failed to stop listener:", error);
      console.error("Operation completed");
    }
  };

  // Kill an agent
  const handleKillAgent = async (agentName: string) => {
    if (!selectedServerId) return;

    try {
      const response = await fetch(
        `/api/v1/empire/servers/${selectedServerId}/agents/${agentName}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
      console.error("Operation completed");
        fetchAgents(selectedServerId);
      }
    } catch (error) {
      console.error("Failed to kill agent:", error);
      console.error("Operation completed");
    }
  };

  // Placeholder for execute command
  const handleExecuteCommand = (agentName: string) => {
      console.error("Operation completed");
  };

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (selectedServerId) {
      fetchListeners(selectedServerId);
      fetchAgents(selectedServerId);
    }
  }, [selectedServerId]);

  const stats = {
    servers: servers.length,
    connected: servers.filter((s) => s.status === "connected").length,
    listeners: listeners.length,
    activeListeners: listeners.filter((l) => l.enabled).length,
    agents: agents.length,
    activeAgents: agents.filter((a) => {
      const lastSeen = new Date(a.lastseen_time);
      const now = new Date();
      const minutesAgo = (now.getTime() - lastSeen.getTime()) / 1000 / 60;
      return minutesAgo < 5;
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Empire Servers</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.servers}</p>
          <p className="text-sm text-green-600 mt-1">{stats.connected} connected</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Listeners</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.listeners}</p>
          <p className="text-sm text-green-600 mt-1">{stats.activeListeners} running</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Agents</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.agents}</p>
          <p className="text-sm text-green-600 mt-1">{stats.activeAgents} active</p>
        </div>
      </div>

      {/* Empire Tabs */}
      <Tabs defaultValue="servers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="listeners">Listeners</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="servers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {servers.map((server) => (
              <EmpireServerCard
                key={server.id}
                server={server}
                onCheckConnection={handleCheckConnection}
                onRefreshToken={handleRefreshToken}
              />
            ))}
          </div>

          {servers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No Empire servers configured</p>
              <p className="text-sm text-gray-400 mt-2">
                Add an Empire server to start managing C2 operations
              </p>
              <Button className="mt-4" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Server
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="listeners" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Active Listeners</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => selectedServerId && fetchListeners(selectedServerId)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Listener
              </Button>
            </div>
          </div>

          <EmpireListenersTable
            listeners={listeners}
            onStop={handleStopListener}
          />
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Active Agents</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => selectedServerId && fetchAgents(selectedServerId)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => selectedServerId && syncAgents(selectedServerId)}
              >
                Sync to Database
              </Button>
            </div>
          </div>

          <EmpireAgentsTable
            agents={agents}
            onExecuteCommand={handleExecuteCommand}
            onKillAgent={handleKillAgent}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
