import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Activity, Loader2, ClipboardList, GripVertical, Clock, ChevronDown, ChevronRight } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOperations } from "@/hooks/useOperations";
import { useTargets } from "@/hooks/useTargets";
import { useVulnerabilities } from "@/hooks/useVulnerabilities";
import { useAgents } from "@/hooks/useAgents";
import { useReporterAgents } from "@/hooks/useReporterAgents";
import { useWorkflows, type WorkflowDetails } from "@/hooks/useWorkflows";
import SummaryStatsCard from "@/components/surface-assessment/SummaryStatsCard";
import SeverityDistributionChart from "@/components/surface-assessment/charts/SeverityDistributionChart";
import StatusDistributionChart from "@/components/surface-assessment/charts/StatusDistributionChart";
import WorkflowProgressCard from "@/components/agents/WorkflowProgressCard";
import WorkflowDetailsDialog from "@/components/agents/WorkflowDetailsDialog";

const DASHBOARD_ROW_ORDER_KEY = "rtpi-dashboard-row-order";
const DEFAULT_ROW_ORDER = ["operations", "targets", "vulnerabilities", "surface-assessment"];

interface DashboardRowStat {
  label: string;
  value: number | string;
  color: string;
}

interface DashboardRowConfig {
  id: string;
  title: string;
  navigateTo: string;
  stats: DashboardRowStat[];
  loading: boolean;
}

interface SurfaceOverviewData {
  stats: {
    totalHosts: number;
    totalServices: number;
    totalVulnerabilities: number;
    webVulnerabilities: number;
    lastScanTimestamp: string | null;
  };
  assetBreakdown: {
    domains: number;
    ips: number;
    urls: number;
    technologies: number;
    asns: number;
    emails: number;
    storageBuckets: number;
  };
  severityData: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  statusData: {
    open: number;
    in_progress: number;
    fixed: number;
    false_positive: number;
    accepted_risk: number;
  };
}

function SortableDashboardRow({
  row,
  onNavigate,
}: {
  row: DashboardRowConfig;
  onNavigate: (path: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="cursor-pointer"
      onClick={() => onNavigate(row.navigateTo)}
    >
      {/* Row header with drag handle and title */}
      <div className="flex items-center gap-2 mb-3">
        <div
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{row.title}</h3>
      </div>

      {/* Stat cards grid — matches individual page presentation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {row.stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-lg transition-shadow"
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {stat.label}
            </h3>
            <p className={`text-3xl font-bold ${stat.color}`}>
              {row.loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                stat.value
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableSurfaceAssessmentRow({
  surfaceData,
  surfaceLoading,
  onNavigate,
}: {
  surfaceData: SurfaceOverviewData;
  surfaceLoading: boolean;
  onNavigate: (path: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: "surface-assessment" });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="cursor-pointer"
      onClick={() => onNavigate("/surface-assessment")}
    >
      {/* Row header with drag handle and title */}
      <div className="flex items-center gap-2 mb-3">
        <div
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Surface Assessment</h3>
      </div>

      {surfaceLoading ? (
        <div className="bg-card rounded-lg shadow-sm border border-border p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-4 text-muted-foreground">Loading surface assessment data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" onClick={(e) => e.stopPropagation()}>
          <div onClick={() => onNavigate("/surface-assessment")} className="cursor-pointer">
            <SummaryStatsCard
              stats={{
                totalHosts: surfaceData.stats.totalHosts,
                totalServices: surfaceData.stats.totalServices,
                totalVulnerabilities: surfaceData.stats.totalVulnerabilities,
                webVulnerabilities: surfaceData.stats.webVulnerabilities,
                lastScanTimestamp: surfaceData.stats.lastScanTimestamp || undefined,
              }}
              assetBreakdown={surfaceData.assetBreakdown}
            />
          </div>
          <div onClick={() => onNavigate("/surface-assessment")} className="cursor-pointer">
            <SeverityDistributionChart data={surfaceData.severityData} />
          </div>
          <div onClick={() => onNavigate("/surface-assessment")} className="cursor-pointer">
            <StatusDistributionChart data={surfaceData.statusData} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();

  // Fetch real data
  const { operations, loading: opsLoading, error: opsError } = useOperations();
  const { targets, loading: targetsLoading, error: targetsError } = useTargets();
  const { vulnerabilities, loading: vulnLoading, error: vulnError } = useVulnerabilities();
  const { agents, loading: agentsLoading, error: agentsError } = useAgents();
  const { agents: reporters, loading: reportersLoading } = useReporterAgents();
  const { runningWorkflows, allNonRunning, getWorkflowDetails, cancelWorkflow } = useWorkflows();

  // Workflow state
  const [workflowTasksMap, setWorkflowTasksMap] = useState<Record<string, any[]>>({});
  const [workflowDetailsOpen, setWorkflowDetailsOpen] = useState(false);
  const [selectedWorkflowDetails, setSelectedWorkflowDetails] = useState<WorkflowDetails | null>(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState({ active: true, history: false });

  const handleViewWorkflowDetails = async (workflowId: string) => {
    try {
      const details = await getWorkflowDetails(workflowId);
      if (details) {
        setSelectedWorkflowDetails(details);
        setWorkflowDetailsOpen(true);
      }
    } catch {
      toast.error("Failed to load workflow details");
    }
  };

  const handleCancelWorkflow = async (workflowId: string) => {
    if (!confirm("Are you sure you want to cancel this workflow?")) return;
    try {
      await cancelWorkflow(workflowId);
      toast.success("Workflow cancelled successfully");
    } catch {
      toast.error("Failed to cancel workflow");
    }
  };

  // Poll tasks for running workflows
  useEffect(() => {
    const loadTasksForWorkflows = async () => {
      const activeWorkflows = runningWorkflows.filter(
        (w) => w.status === "running" || w.status === "pending"
      );
      if (activeWorkflows.length === 0) return;

      const tasksMap: Record<string, any[]> = {};
      for (const workflow of activeWorkflows) {
        try {
          const response = await api.get<{ tasks: any[] }>(`/agent-workflows/${workflow.id}/tasks`);
          tasksMap[workflow.id] = response.tasks || [];
        } catch {
          // ignore
        }
      }
      setWorkflowTasksMap((prev) => ({ ...prev, ...tasksMap }));
    };

    if (runningWorkflows.length > 0) loadTasksForWorkflows();
    const pollInterval = setInterval(() => {
      if (runningWorkflows.some((w) => w.status === "running" || w.status === "pending")) {
        loadTasksForWorkflows();
      }
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [runningWorkflows.length]);

  // Surface assessment full overview data
  const [surfaceData, setSurfaceData] = useState<SurfaceOverviewData>({
    stats: { totalHosts: 0, totalServices: 0, totalVulnerabilities: 0, webVulnerabilities: 0, lastScanTimestamp: null },
    assetBreakdown: { domains: 0, ips: 0, urls: 0, technologies: 0, asns: 0, emails: 0, storageBuckets: 0 },
    severityData: { critical: 0, high: 0, medium: 0, low: 0, informational: 0 },
    statusData: { open: 0, in_progress: 0, fixed: 0, false_positive: 0, accepted_risk: 0 },
  });
  const [surfaceLoading, setSurfaceLoading] = useState(true);

  useEffect(() => {
    const activeOp = operations.find((op) => op.status === "active") || operations[0];
    if (!activeOp || opsLoading) return;

    let cancelled = false;
    const fetchSurfaceData = async () => {
      try {
        setSurfaceLoading(true);
        const response = await api.get<SurfaceOverviewData>(`/surface-assessment/${activeOp.id}/overview`);
        if (!cancelled) {
          setSurfaceData(response);
        }
      } catch {
        // Surface assessment data unavailable - keep defaults
      } finally {
        if (!cancelled) {
          setSurfaceLoading(false);
        }
      }
    };

    fetchSurfaceData();
    return () => { cancelled = true; };
  }, [operations, opsLoading]);

  // Row order persistence
  const [rowOrder, setRowOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_ROW_ORDER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          Array.isArray(parsed) &&
          DEFAULT_ROW_ORDER.every((id) => parsed.includes(id)) &&
          parsed.length === DEFAULT_ROW_ORDER.length
        ) {
          return parsed;
        }
      }
    } catch {
      // Fall through to default
    }
    return DEFAULT_ROW_ORDER;
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = rowOrder.indexOf(active.id as string);
      const newIndex = rowOrder.indexOf(over.id as string);
      const newOrder = arrayMove(rowOrder, oldIndex, newIndex);
      setRowOrder(newOrder);
      localStorage.setItem(DASHBOARD_ROW_ORDER_KEY, JSON.stringify(newOrder));
    }
  };

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

  // Row configurations for generic stat rows
  const rowConfigMap: Record<string, DashboardRowConfig> = {
    operations: {
      id: "operations",
      title: "Operations",
      navigateTo: "/operations",
      loading: opsLoading,
      stats: [
        { label: "Total Operations", value: operations.length, color: "text-foreground" },
        { label: "Active", value: operations.filter((op) => op.status === "active").length, color: "text-green-600" },
        { label: "Planning", value: operations.filter((op) => op.status === "planning").length, color: "text-blue-600" },
        { label: "Completed", value: operations.filter((op) => op.status === "completed").length, color: "text-muted-foreground" },
      ],
    },
    targets: {
      id: "targets",
      title: "Targets",
      navigateTo: "/targets",
      loading: targetsLoading,
      stats: [
        { label: "Total Targets", value: targets.length, color: "text-foreground" },
        { label: "Active", value: targets.filter((t) => t.status === "active").length, color: "text-green-600" },
        { label: "Scanning", value: targets.filter((t) => t.status === "scanning").length, color: "text-blue-600" },
        { label: "Vulnerable", value: targets.filter((t) => t.status === "vulnerable").length, color: "text-red-600" },
      ],
    },
    vulnerabilities: {
      id: "vulnerabilities",
      title: "Vulnerabilities",
      navigateTo: "/vulnerabilities",
      loading: vulnLoading,
      stats: [
        { label: "Total Vulnerabilities", value: vulnerabilities.length, color: "text-foreground" },
        { label: "Critical", value: vulnerabilities.filter((v) => v.severity === "critical").length, color: "text-red-600" },
        { label: "High", value: vulnerabilities.filter((v) => v.severity === "high").length, color: "text-orange-600" },
        { label: "Remediated", value: vulnerabilities.filter((v) => v.status === "remediated").length, color: "text-green-600" },
      ],
    },
  };

  return (
    <div className="relative p-8">
      {/* RTPI Background Image - sticky behind content */}
      <div className="sticky top-0 -z-10 -mt-8 -mx-8 mb-8 pointer-events-none flex items-center justify-center overflow-hidden h-[60vh]">
        <img src="/RTPI.png" alt="RTPI" className="max-w-[600px] w-full opacity-20" />
      </div>

      <h1 className="text-3xl font-bold mb-8 -mt-[52vh]">RTPI Dashboard</h1>

      {hasError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <p className="font-medium">Failed to load some dashboard data</p>
          <p className="text-sm">{opsError || targetsError || vulnError || agentsError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
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
          onClick={() => navigate("/operations?chat=open")}
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

      {/* Linked Data Rows - Drag and Drop Reorderable */}
      <div className="mb-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rowOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {rowOrder.map((id) => {
                if (id === "surface-assessment") {
                  return (
                    <SortableSurfaceAssessmentRow
                      key={id}
                      surfaceData={surfaceData}
                      surfaceLoading={surfaceLoading}
                      onNavigate={navigate}
                    />
                  );
                }
                const row = rowConfigMap[id];
                if (!row) return null;
                return (
                  <SortableDashboardRow
                    key={row.id}
                    row={row}
                    onNavigate={navigate}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Active Workflows & Workflow History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Workflows */}
        <Card className="bg-card">
          <CardHeader
            className="cursor-pointer hover:bg-secondary/50 rounded-t-lg transition-colors"
            onClick={() => setExpandedWorkflows((prev) => ({ ...prev, active: !prev.active }))}
          >
            <CardTitle className="flex items-center gap-2">
              {expandedWorkflows.active ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Activity className="h-5 w-5 text-blue-600" />
              Active Workflows
              <Badge variant="secondary" className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                {runningWorkflows.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          {expandedWorkflows.active && runningWorkflows.length > 0 ? (
            <CardContent>
              <div className="space-y-4">
                {runningWorkflows.map((workflow) => (
                  <WorkflowProgressCard
                    key={workflow.id}
                    workflow={workflow}
                    tasks={workflowTasksMap[workflow.id] || []}
                    agents={agents}
                    onCancel={handleCancelWorkflow}
                    onViewDetails={handleViewWorkflowDetails}
                  />
                ))}
              </div>
            </CardContent>
          ) : runningWorkflows.length === 0 ? (
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No active workflows</p>
                <p className="text-xs mt-1">Execute a workflow to see progress here.</p>
              </div>
            </CardContent>
          ) : null}
        </Card>

        {/* Workflow History */}
        <Card className="bg-card">
          <CardHeader
            className="cursor-pointer hover:bg-secondary/50 rounded-t-lg transition-colors"
            onClick={() => setExpandedWorkflows((prev) => ({ ...prev, history: !prev.history }))}
          >
            <CardTitle className="flex items-center gap-2">
              {expandedWorkflows.history ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Clock className="h-5 w-5 text-muted-foreground" />
              Workflow History
              <Badge variant="secondary" className="ml-2">
                {allNonRunning.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          {expandedWorkflows.history && allNonRunning.length > 0 ? (
            <CardContent>
              <div className="space-y-3 max-h-[470px] overflow-y-auto pr-1">
                {allNonRunning.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="p-3 bg-secondary rounded border border-border hover:bg-secondary/80 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-foreground">
                          {workflow.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {workflow.completedAt
                            ? new Date(workflow.completedAt).toLocaleString()
                            : new Date(workflow.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${
                          workflow.status === "completed"
                            ? "bg-green-500/10 text-green-600"
                            : workflow.status === "failed"
                            ? "bg-red-500/10 text-red-600"
                            : "bg-secondary/10 text-muted-foreground"
                        }`}
                      >
                        {workflow.status.toUpperCase()}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewWorkflowDetails(workflow.id)}
                      className="w-full text-xs"
                    >
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          ) : allNonRunning.length === 0 ? (
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No workflow history</p>
                <p className="text-xs mt-1">Completed workflows will appear here.</p>
              </div>
            </CardContent>
          ) : null}
        </Card>
      </div>

      {/* Workflow Details Dialog */}
      <WorkflowDetailsDialog
        open={workflowDetailsOpen}
        onOpenChange={setWorkflowDetailsOpen}
        workflowDetails={selectedWorkflowDetails}
        agents={agents}
      />
    </div>
  );
}
