import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Plus, CheckSquare, Search, Crosshair, Loader2, FileCode, Copy, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import VulnerabilityList from "@/components/vulnerabilities/VulnerabilityList";
import EditVulnerabilityDialog from "@/components/vulnerabilities/EditVulnerabilityDialog";
import SendToRDDialog from "@/components/vulnerabilities/SendToRDDialog";
import { BulkActionToolbar } from "@/components/shared/BulkActionToolbar";
import { BulkConfirmDialog } from "@/components/shared/BulkConfirmDialog";
import { api } from "@/lib/api";
import { useLocation } from "wouter";

const VULN_ORDER_KEY = "rtpi-vuln-order";
const VULN_GROUPS_KEY = "rtpi-vuln-groups-expanded";

function loadVulnOrder(): Record<string, string[]> {
  try {
    const stored = localStorage.getItem(VULN_ORDER_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {};
}

function loadExpandedGroups(): Set<string> {
  try {
    const stored = localStorage.getItem(VULN_GROUPS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set();
}

export default function Vulnerabilities() {
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState<any>(null);

  // R&D dialog state
  const [rdDialogOpen, setRdDialogOpen] = useState(false);
  const [rdVulnerability, setRdVulnerability] = useState<any>(null);
  const [, setLocation] = useLocation();

  // Execute exploit state
  const [rdExploitVulnIds, setRdExploitVulnIds] = useState<Set<string>>(new Set());
  const [exploitDialogOpen, setExploitDialogOpen] = useState(false);
  const [exploitVuln, setExploitVuln] = useState<any>(null);
  const [exploitArtifacts, setExploitArtifacts] = useState<any[]>([]);
  const [exploitLoading, setExploitLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"delete" | "status-change">("delete");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Operation filter
  const [selectedOperation, setSelectedOperation] = useState<string>("all");

  // Group & ordering state
  const [vulnOrder, setVulnOrder] = useState<Record<string, string[]>>(loadVulnOrder);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(loadExpandedGroups);
  const [initialGroupSet, setInitialGroupSet] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-expand first group on initial load
  useEffect(() => {
    if (!initialGroupSet && !loading && vulnerabilities.length > 0 && expandedGroups.size === 0) {
      const firstGroupKey = vulnerabilities[0]?.operationId || "__unassigned__";
      setExpandedGroups(new Set([firstGroupKey]));
      setInitialGroupSet(true);
    }
  }, [loading, vulnerabilities, expandedGroups.size, initialGroupSet]);

  const loadData = async () => {
    try {
      const [vulnsRes, targetsRes, opsRes] = await Promise.all([
        api.get<{ vulnerabilities: any[] }>("/vulnerabilities"),
        api.get<{ targets: any[] }>("/targets"),
        api.get<{ operations: any[] }>("/operations"),
      ]);
      setVulnerabilities(vulnsRes.vulnerabilities);
      setTargets(targetsRes.targets);
      setOperations(opsRes.operations);

      // Check which vulnerabilities have R&D exploits available
      checkRdExploits(vulnsRes.vulnerabilities);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const checkRdExploits = async (vulns: any[]) => {
    const idsWithExploits = new Set<string>();
    // Check in parallel (limit to 10 concurrent)
    const batch = vulns.filter(
      (v) => v.investigationStatus && v.investigationStatus !== "pending"
    );
    const results = await Promise.allSettled(
      batch.map((v) =>
        api.get<{ artifacts: any[] }>(`/vulnerability-rd/${v.id}/artifacts`).then((res) => ({
          vulnId: v.id,
          hasArtifacts: (res.artifacts?.length || 0) > 0,
        }))
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.hasArtifacts) {
        idsWithExploits.add(r.value.vulnId);
      }
    }
    setRdExploitVulnIds(idsWithExploits);
  };

  const handleToggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      localStorage.setItem(VULN_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleDragEnd = useCallback((groupKey: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setVulnOrder((prev) => {
      const groupVulnIds = prev[groupKey] ||
        vulnerabilities
          .filter((v) => (v.operationId || "__unassigned__") === groupKey)
          .map((v) => v.id);

      const oldIndex = groupVulnIds.indexOf(active.id as string);
      const newIndex = groupVulnIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const newOrder = arrayMove(groupVulnIds, oldIndex, newIndex);
      const updated = { ...prev, [groupKey]: newOrder };
      localStorage.setItem(VULN_ORDER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [vulnerabilities]);

  const handleAddVulnerability = () => {
    setSelectedVulnerability(null);
    setEditDialogOpen(true);
  };

  const handleSelectVulnerability = (vulnerability: any) => {
    setSelectedVulnerability(vulnerability);
    setEditDialogOpen(true);
  };

  const handleEditVulnerability = (vulnerability: any) => {
    setSelectedVulnerability(vulnerability);
    setEditDialogOpen(true);
  };

  const handleSaveVulnerability = async (vulnerability: any) => {
    try {
      const payload = {
        title: vulnerability.title,
        description: vulnerability.description,
        severity: vulnerability.severity,
        cvssScore: vulnerability.cvssScore,
        cvssVector: vulnerability.cvssVector,
        cveId: vulnerability.cveId,
        cweId: vulnerability.cweId,
        targetId: vulnerability.targetId,
        operationId: vulnerability.operationId,
        proofOfConcept: vulnerability.proofOfConcept,
        remediation: vulnerability.remediation,
        references: vulnerability.references,
        status: vulnerability.status,
      };

      if (vulnerability.id) {
        await api.put(`/vulnerabilities/${vulnerability.id}`, payload);
      } else {
        await api.post("/vulnerabilities", payload);
      }
      setEditDialogOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Failed to save vulnerability");
    }
  };

  const handleDeleteVulnerability = async (id: string) => {
    try {
      await api.delete(`/vulnerabilities/${id}`);
      setEditDialogOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Failed to delete vulnerability");
    }
  };

  // R&D handlers
  const handleSendToRD = (vulnerability: any) => {
    setRdVulnerability(vulnerability);
    setRdDialogOpen(true);
  };

  const handleRDSuccess = (_projectId: string) => {
    toast.success("R&D Project created! View it in OffSec Team.", {
      action: {
        label: "View",
        onClick: () => setLocation("/offsec-team"),
      },
    });
  };

  // Investigation handler
  const handleInvestigate = async (vulnerability: any) => {
    try {
      await api.post(`/vulnerability-investigation/${vulnerability.id}/investigate`);
      toast.success(`Investigation triggered for "${vulnerability.title}"`);
      await loadData();
    } catch (error) {
      toast.error("Failed to trigger investigation");
    }
  };

  // Execute exploit handlers
  const handleExecuteExploit = async (vulnerability: any) => {
    setExploitVuln(vulnerability);
    setExploitDialogOpen(true);
    setExecutionResult(null);
    setExploitLoading(true);
    try {
      const res = await api.get<{ artifacts: any[] }>(`/vulnerability-rd/${vulnerability.id}/artifacts`);
      setExploitArtifacts(res.artifacts || []);
    } catch {
      setExploitArtifacts([]);
      toast.error("Failed to load R&D artifacts");
    } finally {
      setExploitLoading(false);
    }
  };

  const handleRunExploit = async (artifactId: string) => {
    if (!exploitVuln) return;
    try {
      setExecuting(true);
      setExecutionResult(null);
      const result = await api.post<any>(`/vulnerability-rd/${exploitVuln.id}/execute-exploit`, {
        artifactId,
      });
      setExecutionResult(result);
      if (result.success) {
        toast.success("Exploit executed successfully");
      } else {
        toast.warning("Exploit completed with non-zero exit code");
      }
    } catch (error: any) {
      toast.error(error?.message || "Exploit execution failed");
      setExecutionResult({ success: false, output: error?.message || "Execution failed", exitCode: -1 });
    } finally {
      setExecuting(false);
    }
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

  const handleBulkStatusChange = async (status: string) => {
    setBulkAction("status-change");
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.patch(`/vulnerabilities/${id}`, { status })
        )
      );
      await loadData();
      handleClearSelection();
    } catch (error) {
      toast.error("Failed to update statuses");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleConfirmBulkAction = async () => {
    setBulkActionLoading(true);
    try {
      if (bulkAction === "delete") {
        await Promise.all(
          Array.from(selectedIds).map((id) => api.delete(`/vulnerabilities/${id}`))
        );
      }
      await loadData();
      handleClearSelection();
      setConfirmDialogOpen(false);
    } catch (error) {
      toast.error("Bulk operation failed");
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

  // Filter vulnerabilities by selected operation AND exclude vulnerabilities from completed/cancelled operations
  const filteredVulnerabilities = useMemo(() => {
    // Get IDs of active operations (exclude completed/cancelled)
    const activeOperationIds = new Set(
      operations
        .filter((op) => op.status !== "completed" && op.status !== "cancelled")
        .map((op) => op.id)
    );

    // Filter vulnerabilities
    let filtered = vulnerabilities.filter((v) => {
      // Exclude vulnerabilities from completed/cancelled operations
      if (v.operationId && !activeOperationIds.has(v.operationId)) {
        return false;
      }
      return true;
    });

    // Further filter by selected operation if not "all"
    if (selectedOperation !== "all") {
      filtered = filtered.filter((v) => v.operationId === selectedOperation);
    }

    return filtered;
  }, [vulnerabilities, operations, selectedOperation]);

  // Calculate stats from filtered vulnerabilities
  const stats = {
    total: filteredVulnerabilities.length,
    critical: filteredVulnerabilities.filter((v) => v.severity === "critical").length,
    high: filteredVulnerabilities.filter((v) => v.severity === "high").length,
    open: filteredVulnerabilities.filter((v) => v.status === "open").length,
    remediated: filteredVulnerabilities.filter((v) => v.status === "remediated").length,
    investigating: filteredVulnerabilities.filter((v) => v.investigationStatus === "investigating").length,
    validated: filteredVulnerabilities.filter((v) => v.investigationStatus === "validated").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vulnerabilities</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage security vulnerabilities
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
          <Button onClick={handleAddVulnerability}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vulnerability
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Total Vulnerabilities
          </h3>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Critical</h3>
          <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">High</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.high}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Investigating</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.investigating}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Validated</h3>
          <p className="text-3xl font-bold text-green-600">{stats.validated}</p>
        </div>
      </div>

      {/* Vulnerabilities List — grouped by operation */}
      <VulnerabilityList
        vulnerabilities={filteredVulnerabilities}
        operations={operations}
        loading={loading}
        onSelect={handleSelectVulnerability}
        onEdit={handleEditVulnerability}
        onDelete={(v) => handleDeleteVulnerability(v.id)}
        onSendToRD={handleSendToRD}
        onInvestigate={handleInvestigate}
        onExecuteExploit={handleExecuteExploit}
        rdExploitVulnIds={rdExploitVulnIds}
        selectable={bulkMode}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        expandedGroups={expandedGroups}
        onToggleGroup={handleToggleGroup}
        vulnOrder={vulnOrder}
        onDragEnd={handleDragEnd}
      />

      {/* Edit Dialog */}
      <EditVulnerabilityDialog
        open={editDialogOpen}
        vulnerability={selectedVulnerability}
        targets={targets}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveVulnerability}
        onDelete={handleDeleteVulnerability}
      />

      {/* Bulk Action Toolbar */}
      {bulkMode && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onClearSelection={handleClearSelection}
          onDelete={handleBulkDelete}
          onChangeStatus={handleBulkStatusChange}
        />
      )}

      {/* Bulk Action Confirmation Dialog */}
      <BulkConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        actionType={bulkAction}
        itemCount={selectedIds.size}
        itemType="vulnerability"
        onConfirm={handleConfirmBulkAction}
        loading={bulkActionLoading}
      />

      {/* Send to R&D Dialog */}
      <SendToRDDialog
        open={rdDialogOpen}
        vulnerability={rdVulnerability}
        onClose={() => setRdDialogOpen(false)}
        onSuccess={handleRDSuccess}
      />

      {/* Execute Exploit Dialog */}
      <Dialog open={exploitDialogOpen} onOpenChange={setExploitDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-green-600" />
              Execute R&D Exploit
            </DialogTitle>
            {exploitVuln && (
              <p className="text-sm text-muted-foreground">
                {exploitVuln.title} {exploitVuln.cve && `(${exploitVuln.cve})`}
              </p>
            )}
          </DialogHeader>

          {exploitLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-green-600 mr-2" />
              <span className="text-muted-foreground">Loading R&D artifacts...</span>
            </div>
          ) : exploitArtifacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileCode className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No exploitable artifacts found for this vulnerability</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select an R&D-generated exploit to execute against the target:
              </p>
              {exploitArtifacts.map((artifact: any) => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge
                      className={
                        artifact.artifactType === "poc_code"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-orange-100 text-orange-800"
                      }
                    >
                      {artifact.artifactType === "poc_code" ? "POC Code" : "Nuclei Template"}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {artifact.filename || artifact.id.substring(0, 8)}
                    </span>
                    {artifact.language && (
                      <Badge variant="outline" className="text-xs">
                        {artifact.language}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(artifact.content || "");
                        toast.success("Copied to clipboard");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRunExploit(artifact.id)}
                      disabled={executing}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {executing ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Crosshair className="h-4 w-4 mr-1" />
                      )}
                      Execute
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Execution Result */}
          {executionResult && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="h-4 w-4" />
                <span className="font-medium text-sm">Execution Result</span>
                <Badge
                  className={
                    executionResult.success
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {executionResult.success ? "Success" : `Exit ${executionResult.exitCode}`}
                </Badge>
                {executionResult.duration && (
                  <span className="text-xs text-muted-foreground">
                    {(executionResult.duration / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {executionResult.targetUrl && (
                <p className="text-xs text-muted-foreground mb-2">
                  Target: {executionResult.targetUrl}
                </p>
              )}
              <pre className="p-3 bg-muted rounded-lg text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                {executionResult.output || "No output"}
              </pre>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExploitDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
