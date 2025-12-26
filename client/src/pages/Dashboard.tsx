import { useLocation } from "wouter";
import { Activity } from "lucide-react";
import { useOperations } from "@/hooks/useOperations";
import { useTargets } from "@/hooks/useTargets";
import { useVulnerabilities } from "@/hooks/useVulnerabilities";
import { useAgents } from "@/hooks/useAgents";

export default function Dashboard() {
  const [, navigate] = useLocation();
  
  // Fetch real data
  const { operations, loading: opsLoading } = useOperations();
  const { targets, loading: targetsLoading } = useTargets();
  const { vulnerabilities, loading: vulnLoading } = useVulnerabilities();
  const { agents, loading: agentsLoading } = useAgents();

  // Calculate statistics
  const stats = {
    activeOperations: operations.filter((op) => op.status === "active").length,
    targets: targets.length,
    vulnerabilities: vulnerabilities.length,
    activeAgents: agents.filter((a) => a.status === "running").length,
  };

  // Check if any data is loading
  const loading = opsLoading || targetsLoading || vulnLoading || agentsLoading;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">RTPI Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Active Operations */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/operations")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Operations</h3>
          <p className="text-3xl font-bold text-green-600">
            {loading ? "..." : stats.activeOperations}
          </p>
        </div>

        {/* Targets */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/targets")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Targets</h3>
          <p className="text-3xl font-bold text-blue-600">
            {loading ? "..." : stats.targets}
          </p>
        </div>

        {/* Vulnerabilities */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/vulnerabilities")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Vulnerabilities</h3>
          <p className="text-3xl font-bold text-red-600">
            {loading ? "..." : stats.vulnerabilities}
          </p>
        </div>

        {/* Active Agents */}
        <div
          className="bg-card p-6 rounded-lg shadow border border-border cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate("/agents")}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Agents</h3>
          <p className="text-3xl font-bold text-purple-600">
            {loading ? "..." : stats.activeAgents}
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
