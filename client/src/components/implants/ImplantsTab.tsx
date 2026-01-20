import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, Cpu, ListTodo, Package, Hammer } from "lucide-react";
import ImplantsTable from "./ImplantsTable";
import TasksTable from "./TasksTable";
import ImplantStatsCards from "./ImplantStatsCards";
import { BundlesTab } from "./BundlesTab";
import MultiArchBuildPanel from "./MultiArchBuildPanel";

export interface RustNexusImplant {
  id: string;
  implantName: string;
  implantType: "reconnaissance" | "exploitation" | "exfiltration" | "general";
  version: string;
  hostname: string;
  osType: string;
  osVersion?: string;
  architecture: string;
  ipAddress?: string;
  status: "registered" | "connected" | "idle" | "busy" | "disconnected" | "terminated";
  lastHeartbeat?: string;
  connectionQuality: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  autonomyLevel: number;
  aiProvider?: string;
  aiModel?: string;
  createdAt: string;
  registeredAt: string;
}

export interface RustNexusTask {
  id: string;
  implantId: string;
  taskType: string;
  taskName: string;
  taskDescription?: string;
  status: "queued" | "assigned" | "running" | "completed" | "failed" | "timeout" | "cancelled";
  priority: number;
  timeoutSeconds: number;
  progressPercentage: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  executionTimeMs?: number;
  errorMessage?: string;
}

export interface ImplantStats {
  implants: {
    total: number;
    connected: number;
    idle: number;
    busy: number;
    disconnected: number;
    terminated: number;
  };
  tasks: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  connections: {
    total: number;
    authenticated: number;
  };
}

interface ImplantsTabProps {
  bundlesRefreshTrigger?: number;
}

export default function ImplantsTab({ bundlesRefreshTrigger }: ImplantsTabProps) {
  const [implants, setImplants] = useState<RustNexusImplant[]>([]);
  const [tasks, setTasks] = useState<RustNexusTask[]>([]);
  const [stats, setStats] = useState<ImplantStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedImplantId, setSelectedImplantId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch all implants
  const fetchImplants = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/rust-nexus/implants", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setImplants(data);
      } else {
        console.error("Failed to fetch implants");
      }
    } catch (error) {
      // Error already shown via toast
    } finally {
      setLoading(false);
    }
  };

  // Fetch tasks for selected implant or all tasks
  const fetchTasks = async (implantId?: string) => {
    setLoading(true);
    try {
      const url = implantId
        ? `/api/v1/rust-nexus/implants/${implantId}/tasks?limit=100`
        : `/api/v1/rust-nexus/implants/${implants[0]?.id}/tasks?limit=100`;

      if (!implantId && !implants[0]?.id) {
        setLoading(false);
        return;
      }

      const response = await fetch(url, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        console.error("Failed to fetch tasks");
      }
    } catch (error) {
      // Error already shown via toast
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/rust-nexus/stats", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error("Failed to fetch stats");
      }
    } catch (error) {
      // Error already shown via toast
    }
  };

  // Terminate an implant
  const handleTerminateImplant = async (implantId: string) => {
    if (!confirm("Are you sure you want to terminate this implant? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/rust-nexus/implants/${implantId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        // Debug logging removed
        fetchImplants();
        fetchStats();
      } else {
        console.error("Failed to terminate implant");
      }
    } catch (error) {
      // Error already shown via toast
    }
  };

  // Refresh data
  const handleRefresh = () => {
    fetchImplants();
    fetchTasks(selectedImplantId || undefined);
    fetchStats();
    setLastRefresh(new Date());
  };

  // Initial data load
  useEffect(() => {
    fetchImplants();
    fetchStats();
  }, []);

  // Fetch tasks when implants change
  useEffect(() => {
    if (implants.length > 0) {
      fetchTasks(selectedImplantId || undefined);
    }
  }, [implants.length, selectedImplantId]);

  // Auto-refresh every 10 seconds (only when page is visible)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const startAutoRefresh = () => {
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchImplants();
          fetchStats();
          setLastRefresh(new Date());
        }
      }, 10000);
    };

    // Start immediately
    startAutoRefresh();

    // Pause/resume based on page visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        startAutoRefresh();
        // Refresh immediately when tab becomes visible
        fetchImplants();
        fetchStats();
        setLastRefresh(new Date());
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-cyan-600" />
          <h2 className="text-xl font-semibold">Implant Management</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last updated {Math.floor((Date.now() - lastRefresh.getTime()) / 1000)}s ago
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && <ImplantStatsCards stats={stats} />}

      {/* Tabs */}
      <Tabs defaultValue="implants" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="implants" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Implants ({implants.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="bundles" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Bundles
          </TabsTrigger>
          <TabsTrigger value="builds" className="flex items-center gap-2">
            <Hammer className="h-4 w-4" />
            Multi-Arch Builds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="implants" className="space-y-4">
          <ImplantsTable
            implants={implants}
            loading={loading}
            onRefresh={fetchImplants}
            onTerminate={handleTerminateImplant}
            onSelectImplant={setSelectedImplantId}
          />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <TasksTable
            tasks={tasks}
            implants={implants}
            loading={loading}
            onRefresh={() => fetchTasks(selectedImplantId || undefined)}
            selectedImplantId={selectedImplantId}
            onSelectImplant={setSelectedImplantId}
          />
        </TabsContent>

        <TabsContent value="bundles" className="space-y-4">
          <BundlesTab refreshTrigger={bundlesRefreshTrigger} />
        </TabsContent>

        <TabsContent value="builds" className="space-y-4">
          <MultiArchBuildPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
