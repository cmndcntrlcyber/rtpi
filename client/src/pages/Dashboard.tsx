import { useLocation } from "wouter";
import { Activity, Loader2, ClipboardList } from "lucide-react";
import { useOperations } from "@/hooks/useOperations";
import { useTargets } from "@/hooks/useTargets";
import { useVulnerabilities } from "@/hooks/useVulnerabilities";
import { useAgents } from "@/hooks/useAgents";
import { useReporterAgents } from "@/hooks/useReporterAgents";

export default function Dashboard() {
  const [, navigate] = useLocation();

  // Fetch real data
  const { operations, loading: opsLoading, error: opsError } = useOperations();
  const { targets, loading: targetsLoading, error: targetsError } = useTargets();
  const { vulnerabilities, loading: vulnLoading, error: vulnError } = useVulnerabilities();
  const { agents, loading: agentsLoading, error: agentsError } = useAgents();
  const { agents: reporters, loading: reportersLoading } = useReporterAgents();

  // Calculate statistics
  const stats = {
    activeOperations: operations.filter((op) => op.status === "active").length,
    targets: targets.length,
    vulnerabilities: vulnerabilities.length,
    activeAgents: agents.filter((a) => a.status === "running").length,
    activeReporters: reporters.length,
  };

  // Check if any data is loading
  const loading = opsLoading || targetsLoading || vulnLoading || agentsLoading || reportersLoading;
  const hasError = opsError || targetsError || vulnError || agentsError;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">RTPI Dashboard</h1>

      {hasError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <p className="font-medium">Failed to load some dashboard data</p>
          <p className="text-sm">{opsError || targetsError || vulnError || agentsError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Active Operations */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/operations")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Operations</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
            {loading ? <><Loader2 className="h-6 w-6 animate-spin" /> Loading...</> : stats.activeOperations}
          </p>
        </div>

        {/* Targets */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/targets")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Targets</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            {loading ? <><Loader2 className="h-6 w-6 animate-spin" /> Loading...</> : stats.targets}
          </p>
        </div>

        {/* Vulnerabilities */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/vulnerabilities")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Vulnerabilities</h3>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
            {loading ? <><Loader2 className="h-6 w-6 animate-spin" /> Loading...</> : stats.vulnerabilities}
          </p>
        </div>

        {/* Active Agents */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/agents")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Agents</h3>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
            {loading ? <><Loader2 className="h-6 w-6 animate-spin" /> Loading...</> : stats.activeAgents}
          </p>
        </div>

        {/* Operations Manager */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/operations-manager")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Operations Manager
          </h3>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            {loading ? <><Loader2 className="h-6 w-6 animate-spin" /> Loading...</> : stats.activeReporters}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Reporter agents active
          </p>
        </div>
      </div>

      {/* RTPI Image */}
      <div className="mb-8">
        <img src="/RTPI.png" alt="RTPI" className="w-full rounded-lg shadow border border-border" />
      </div>

      {/* Recent Activity */}
      <div className="bg-card p-6 rounded-lg shadow border border-border">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </h2>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            {/* Show recent operations */}
            {operations.slice(0, 5).map((op) => (
              <div
                key={op.id}
                className="flex items-center justify-between p-3 bg-secondary rounded cursor-pointer hover:bg-secondary/80"
                onClick={() => navigate("/operations")}
              >
                <div>
                  <p className="font-medium">{op.name}</p>
                  <p className="text-sm text-muted-foreground">Operation · {op.status}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {op.startedAt ? new Date(op.startedAt).toLocaleDateString() : "Recent"}
                </span>
              </div>
            ))}
            
            {operations.length === 0 && (
              <p className="text-muted-foreground">No recent activity to display</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
