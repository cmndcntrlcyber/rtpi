import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Plus, RotateCcw, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import TargetList from "@/components/targets/TargetList";
import EditTargetDialog from "@/components/targets/EditTargetDialog";
import { BulkActionToolbar } from "@/components/shared/BulkActionToolbar";
import { BulkConfirmDialog } from "@/components/shared/BulkConfirmDialog";
import { api } from "@/lib/api";

const TARGET_ORDER_KEY = "rtpi-target-order";
const TARGET_GROUPS_KEY = "rtpi-target-groups-expanded";

function loadTargetOrder(): Record<string, string[]> {
  try {
    const stored = localStorage.getItem(TARGET_ORDER_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {};
}

function loadExpandedGroups(): Set<string> {
  try {
    const stored = localStorage.getItem(TARGET_GROUPS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set();
}

export default function Targets() {
  const [, navigate] = useLocation();
  const [targets, setTargets] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [loopDialogOpen, setLoopDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [runningLoop, setRunningLoop] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<string>("all");

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"delete" | "archive" | "custom">("delete");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Per-group Scan All / Delete All state
  const [scanGroupDialogOpen, setScanGroupDialogOpen] = useState(false);
  const [scanGroupLoading, setScanGroupLoading] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);
  const [actionGroupKey, setActionGroupKey] = useState<string | null>(null);

  // Group & ordering state
  const [targetOrder, setTargetOrder] = useState<Record<string, string[]>>(loadTargetOrder);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(loadExpandedGroups);
  const [initialGroupSet, setInitialGroupSet] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-expand first group on initial load if nothing is expanded
  useEffect(() => {
    if (!initialGroupSet && !loading && targets.length > 0 && expandedGroups.size === 0) {
      const firstGroupKey = targets[0]?.operationId || "__unassigned__";
      setExpandedGroups(new Set([firstGroupKey]));
      setInitialGroupSet(true);
    }
  }, [loading, targets, expandedGroups.size, initialGroupSet]);

  const loadData = async () => {
    try {
      const [targetsRes, operationsRes, agentsRes] = await Promise.all([
        api.get<{ targets: any[] }>("/targets"),
        api.get<{ operations: any[] }>("/operations"),
        api.get<{ agents: any[] }>("/agents"),
      ]);
      setTargets(targetsRes.targets);
      setOperations(operationsRes.operations);
      setAgents(agentsRes.agents || []);
    } catch (error: any) {
      toast.error(`Failed to load data: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      localStorage.setItem(TARGET_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleDragEnd = useCallback((groupKey: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTargetOrder((prev) => {
      // Get current order for this group, or build from targets
      const groupTargetIds = prev[groupKey] ||
        targets
          .filter((t) => (t.operationId || "__unassigned__") === groupKey)
          .map((t) => t.id);

      const oldIndex = groupTargetIds.indexOf(active.id as string);
      const newIndex = groupTargetIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const newOrder = arrayMove(groupTargetIds, oldIndex, newIndex);
      const updated = { ...prev, [groupKey]: newOrder };
      localStorage.setItem(TARGET_ORDER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [targets]);

  const handleRunAgentLoop = (target: any) => {
    setSelectedTarget(target);
    setLoopDialogOpen(true);
  };

  const handleExecuteLoop = async () => {
    if (!selectedAgent || !selectedTarget) return;

    setRunningLoop(true);
    try {
      await api.post("/agent-loops/start", {
        agentId: selectedAgent,
        targetId: selectedTarget.id,
        initialInput: `Analyze target ${selectedTarget.name} (${selectedTarget.value}) for security vulnerabilities`,
      });

      toast.success(`Agent loop started successfully for target: ${selectedTarget.name}`);
      setLoopDialogOpen(false);
      setSelectedAgent("");
    } catch (error: any) {
      toast.error(`Failed to start agent loop: ${error.message || "Unknown error"}`);
    } finally {
      setRunningLoop(false);
    }
  };

  const handleAddTarget = () => {
    setSelectedTarget(null);
    setEditDialogOpen(true);
  };

  const handleSelectTarget = (target: any) => {
    setSelectedTarget(target);
    setEditDialogOpen(true);
  };

  const handleEditTarget = (target: any) => {
    setSelectedTarget(target);
    setEditDialogOpen(true);
  };

  const handleSaveTarget = async (target: any) => {
    try {
      if (target.id) {
        await api.put(`/targets/${target.id}`, target);
        toast.success("Target updated successfully");
      } else {
        await api.post("/targets", target);
        toast.success("Target created successfully");
      }
      setEditDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(`Failed to save target: ${error.message || "Unknown error"}`);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await api.delete(`/targets/${id}`);
      setEditDialogOpen(false);
      await loadData();
      toast.success("Target deleted successfully");
    } catch (error: any) {
      toast.error(`Failed to delete target: ${error.message || "Unknown error"}`);
    }
  };

  const handleScanTarget = async (target: any) => {
    if (!confirm(`Start nmap scan on ${target.name} (${target.value})?\n\nThis will scan all 65535 ports and may take several minutes.`)) {
      return;
    }

    try {
      toast.info(`Scanning ${target.name}... This may take up to 10 minutes for a full port scan.`);

      const response = await api.post(`/targets/${target.id}/scan`);

      const { openPorts, scanDuration } = response;
      const durationSeconds = (scanDuration / 1000).toFixed(2);

      toast.success(
        `Scan completed! Target: ${target.name} | Duration: ${durationSeconds}s | Open Ports: ${openPorts}`
      );

      await loadData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.details || error.message || "Unknown error";
      toast.error(`Scan failed: ${errorMsg}`);
    }
  };

  const handleViewVulnerabilities = (_targetId: string) => {
    setEditDialogOpen(false);
    navigate("/vulnerabilities");
  };

  const handleAddVulnerability = (_targetId: string) => {
    setEditDialogOpen(false);
    navigate("/vulnerabilities");
  };

  // Bulk selection handlers
  const handleSelectionChange = (id: string, selected: boolean) => {
    const newSelection = new Set(selectedIds);
    if (selected) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedIds(newSelection);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    setBulkAction("delete");
    setConfirmDialogOpen(true);
  };

  const handleConfirmBulkAction = async () => {
    setBulkActionLoading(true);
    try {
      if (bulkAction === "delete") {
        await Promise.all(
          Array.from(selectedIds).map((id) => api.delete(`/targets/${id}`))
        );
        toast.success(`Successfully deleted ${selectedIds.size} target(s)`);
      }
      await loadData();
      handleClearSelection();
      setConfirmDialogOpen(false);
    } catch (error: any) {
      toast.error(`Bulk operation failed: ${error.message || "Unknown error"}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    if (bulkMode) {
      handleClearSelection();
    }
  };

  // Get targets for a specific group
  const getGroupTargets = (groupKey: string) =>
    targets.filter((t) => (t.operationId || "__unassigned__") === groupKey);

  const getGroupLabel = (groupKey: string) => {
    if (groupKey === "__unassigned__") return "Unassigned";
    return operations.find((op) => op.id === groupKey)?.name || "Unknown Operation";
  };

  // Per-group Scan All
  const handleScanGroup = async () => {
    if (!actionGroupKey) return;
    const groupTargets = getGroupTargets(actionGroupKey);
    setScanGroupLoading(true);
    try {
      let completed = 0;
      let failed = 0;
      for (const target of groupTargets) {
        try {
          await api.post(`/targets/${target.id}/scan`);
          completed++;
        } catch {
          failed++;
        }
      }
      toast.success(
        `Scan complete: ${completed} started${failed > 0 ? `, ${failed} failed` : ""}`
      );
      await loadData();
    } catch (error: any) {
      toast.error(`Scan failed: ${error.message || "Unknown error"}`);
    } finally {
      setScanGroupLoading(false);
      setScanGroupDialogOpen(false);
      setActionGroupKey(null);
    }
  };

  // Per-group Delete All
  const handleDeleteGroup = async () => {
    if (!actionGroupKey) return;
    const groupTargets = getGroupTargets(actionGroupKey);
    setDeleteGroupLoading(true);
    try {
      await Promise.all(groupTargets.map((t) => api.delete(`/targets/${t.id}`)));
      toast.success(`Deleted ${groupTargets.length} target(s)`);
      await loadData();
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message || "Unknown error"}`);
    } finally {
      setDeleteGroupLoading(false);
      setDeleteGroupDialogOpen(false);
      setActionGroupKey(null);
    }
  };

  const handleOpenScanGroup = (groupKey: string) => {
    setActionGroupKey(groupKey);
    setScanGroupDialogOpen(true);
  };

  const handleOpenDeleteGroup = (groupKey: string) => {
    setActionGroupKey(groupKey);
    setDeleteGroupDialogOpen(true);
  };

  // Filter targets by selected operation AND exclude targets from completed/cancelled operations
  const filteredTargets = useMemo(() => {
    // Get IDs of active operations (exclude completed/cancelled)
    const activeOperationIds = new Set(
      operations
        .filter((op) => op.status !== "completed" && op.status !== "cancelled")
        .map((op) => op.id)
    );

    // Filter targets
    let filtered = targets.filter((t) => {
      // Exclude targets from completed/cancelled operations
      if (t.operationId && !activeOperationIds.has(t.operationId)) {
        return false;
      }
      return true;
    });

    // Further filter by selected operation if not "all"
    if (selectedOperation !== "all") {
      filtered = filtered.filter((t) => t.operationId === selectedOperation);
    }

    return filtered;
  }, [targets, operations, selectedOperation]);

  // Calculate stats from filtered targets
  const stats = {
    total: filteredTargets.length,
    active: filteredTargets.filter((t) => t.status === "active").length,
    scanning: filteredTargets.filter((t) => t.status === "scanning").length,
    vulnerable: filteredTargets.filter((t) => t.status === "vulnerable").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Targets</h1>
          <p className="text-muted-foreground mt-1">
            Manage target systems and infrastructure
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedOperation} onValueChange={setSelectedOperation}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by operation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Operations</SelectItem>
              {operations
                .filter((op) => op.status === "active")
                .map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            variant={bulkMode ? "secondary" : "outline"}
            onClick={toggleBulkMode}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            {bulkMode ? "Exit Bulk Mode" : "Bulk Select"}
          </Button>
          <Button onClick={handleAddTarget}>
            <Plus className="h-4 w-4 mr-2" />
            Add Target
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Targets</h3>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active</h3>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Scanning</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.scanning}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Vulnerable</h3>
          <p className="text-3xl font-bold text-red-600">{stats.vulnerable}</p>
        </div>
      </div>

      {/* Targets List — grouped by operation */}
      <TargetList
        targets={filteredTargets}
        operations={operations}
        loading={loading}
        onSelect={handleSelectTarget}
        onEdit={handleEditTarget}
        onDelete={(t) => handleDeleteTarget(t.id)}
        onScan={handleScanTarget}
        onScanGroup={handleOpenScanGroup}
        onDeleteGroup={handleOpenDeleteGroup}
        selectable={bulkMode}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        expandedGroups={expandedGroups}
        onToggleGroup={handleToggleGroup}
        targetOrder={targetOrder}
        onDragEnd={handleDragEnd}
      />

      {/* Edit Dialog */}
      <EditTargetDialog
        open={editDialogOpen}
        target={selectedTarget}
        operations={operations}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveTarget}
        onDelete={handleDeleteTarget}
        onViewVulnerabilities={handleViewVulnerabilities}
        onAddVulnerability={handleAddVulnerability}
        onRunAgentLoop={handleRunAgentLoop}
      />

      {/* Agent Loop Dialog */}
      <Dialog open={loopDialogOpen} onOpenChange={setLoopDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-600" />
              Run Agent Loop
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Target</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTarget?.name} ({selectedTarget?.type}: {selectedTarget?.value})
              </p>
            </div>

            <div>
              <Label htmlFor="agent-select">Select Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder="Choose an agent with loop enabled" />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter((a) => a.config?.loopEnabled)
                    .map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {agents.filter((a) => a.config?.loopEnabled).length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  No agents with loop configuration found. Please configure an agent first.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLoopDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteLoop}
              disabled={!selectedAgent || runningLoop}
            >
              {runningLoop ? "Starting..." : "Start Agent Loop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Toolbar */}
      {bulkMode && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onClearSelection={handleClearSelection}
          onDelete={handleBulkDelete}
        />
      )}

      {/* Bulk Action Confirmation Dialog */}
      <BulkConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        actionType={bulkAction}
        itemCount={selectedIds.size}
        itemType="target"
        onConfirm={handleConfirmBulkAction}
        loading={bulkActionLoading}
      />

      {/* Per-group Scan All Confirmation Dialog */}
      <BulkConfirmDialog
        open={scanGroupDialogOpen}
        onOpenChange={(open) => { setScanGroupDialogOpen(open); if (!open) setActionGroupKey(null); }}
        actionType="custom"
        itemCount={actionGroupKey ? getGroupTargets(actionGroupKey).length : 0}
        itemType="target"
        title={`Scan All — ${actionGroupKey ? getGroupLabel(actionGroupKey) : ""}`}
        description={`This will start nmap scans on all ${actionGroupKey ? getGroupTargets(actionGroupKey).length : 0} target(s) in this operation. Each scan covers all 65535 ports and may take several minutes per target.`}
        confirmLabel="Scan All"
        onConfirm={handleScanGroup}
        loading={scanGroupLoading}
      />

      {/* Per-group Delete All Confirmation Dialog */}
      <BulkConfirmDialog
        open={deleteGroupDialogOpen}
        onOpenChange={(open) => { setDeleteGroupDialogOpen(open); if (!open) setActionGroupKey(null); }}
        actionType="delete"
        itemCount={actionGroupKey ? getGroupTargets(actionGroupKey).length : 0}
        itemType="target"
        title={`Delete All — ${actionGroupKey ? getGroupLabel(actionGroupKey) : ""}`}
        description={`Are you sure you want to delete all ${actionGroupKey ? getGroupTargets(actionGroupKey).length : 0} target(s) in this operation? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={handleDeleteGroup}
        loading={deleteGroupLoading}
      />
    </div>
  );
}
