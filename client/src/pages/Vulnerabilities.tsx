import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  CheckSquare,
  Loader2,
  Copy,
  Terminal,
  ShieldAlert,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
  const [exploitVuln, setExploitVuln] = useState<any>(null);
  const [executingVulnId, setExecutingVulnId] = useState<string | null>(null);

  // Scan output dialog state
  const [executionOutputVulnIds, setExecutionOutputVulnIds] = useState<Set<string>>(new Set());
  const [outputDialogOpen, setOutputDialogOpen] = useState(false);
  const [outputVuln, setOutputVuln] = useState<any>(null);
  const [outputExecutions, setOutputExecutions] = useState<any[]>([]);
  const [outputLoading, setOutputLoading] = useState(false);
  const [draftingReport, setDraftingReport] = useState(false);

  // Report dialog state
  const [reportVulnIds, setReportVulnIds] = useState<Set<string>>(new Set());
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportVuln, setReportVuln] = useState<any>(null);
  const [reportContent, setReportContent] = useState<string>("");
  const [reportLoading, setReportLoading] = useState(false);

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

      // Check which vulnerabilities have R&D exploits, execution outputs, and reports
      checkRdExploits(vulnsRes.vulnerabilities);
      checkExecutionOutputs(vulnsRes.vulnerabilities);
      checkReports(vulnsRes.vulnerabilities);
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

  const checkExecutionOutputs = async (vulns: any[]) => {
    const idsWithOutputs = new Set<string>();
    const batch = vulns.filter(
      (v) => v.investigationStatus && v.investigationStatus !== "pending"
    );
    const results = await Promise.allSettled(
      batch.map((v) =>
        api.get<{ executions: any[] }>(`/vulnerability-rd/${v.id}/execution-history`).then((res) => ({
          vulnId: v.id,
          hasOutputs: (res.executions?.length || 0) > 0,
        }))
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.hasOutputs) {
        idsWithOutputs.add(r.value.vulnId);
      }
    }
    setExecutionOutputVulnIds(idsWithOutputs);
  };

  const checkReports = async (vulns: any[]) => {
    const idsWithReports = new Set<string>();
    const batch = vulns.filter(
      (v) => v.investigationStatus && v.investigationStatus !== "pending"
    );
    const results = await Promise.allSettled(
      batch.map((v) =>
        api.get<{ report: any }>(`/vulnerability-rd/${v.id}/report`).then((res) => ({
          vulnId: v.id,
          hasReport: !!res.report,
        }))
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.hasReport) {
        idsWithReports.add(r.value.vulnId);
      }
    }
    setReportVulnIds(idsWithReports);
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
        onClick: () => setLocation("/offsec-rd"),
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

  // Execute exploit — auto-selects best artifact (nuclei template preferred),
  // runs it against the associated target, then opens the Output dialog.
  const handleExecuteExploit = async (vulnerability: any) => {
    try {
      setExecutingVulnId(vulnerability.id);
      setExploitVuln(vulnerability);
      toast.info(`Executing scan against target for "${vulnerability.title}"...`);

      // Fetch artifacts and auto-select best one
      const res = await api.get<{ artifacts: any[] }>(`/vulnerability-rd/${vulnerability.id}/artifacts`);
      const artifacts = res.artifacts || [];
      if (artifacts.length === 0) {
        toast.error("No R&D artifacts available to execute");
        return;
      }

      // Prefer nuclei templates, fall back to poc_code
      const artifact =
        artifacts.find((a: any) => a.artifactType === "nuclei_template") ||
        artifacts[0];

      // Execute against the target
      const result = await api.post<any>(`/vulnerability-rd/${vulnerability.id}/execute-exploit`, {
        artifactId: artifact.id,
      });

      if (result.success) {
        toast.success("Scan executed successfully — opening output");
      } else {
        toast.warning("Scan completed with non-zero exit code");
      }

      // Mark this vuln as having execution output
      setExecutionOutputVulnIds((prev) => new Set([...prev, vulnerability.id]));

      // Open the Output dialog with fresh results
      handleViewOutput(vulnerability);
    } catch (error: any) {
      toast.error(error?.message || "Exploit execution failed");
    } finally {
      setExecutingVulnId(null);
    }
  };

  // View output handler
  const handleViewOutput = async (vulnerability: any) => {
    setOutputVuln(vulnerability);
    setOutputDialogOpen(true);
    setOutputExecutions([]);
    setOutputLoading(true);
    try {
      const res = await api.get<{ executions: any[] }>(`/vulnerability-rd/${vulnerability.id}/execution-history`);
      setOutputExecutions(res.executions || []);
    } catch {
      setOutputExecutions([]);
      toast.error("Failed to load execution history");
    } finally {
      setOutputLoading(false);
    }
  };

  // Draft report handler
  const handleDraftReport = async (execution: any) => {
    if (!outputVuln) return;
    try {
      setDraftingReport(true);
      const result = await api.post<any>(`/vulnerability-rd/${outputVuln.id}/draft-report`, {
        executionId: execution.id,
        scanOutput: execution.rawOutput || execution.results?.output || "No output available",
        targetUrl: (execution.targets as any)?.[0] || null,
      });
      if (result.success) {
        toast.success("Draft report generated");
        setOutputDialogOpen(false);
        // Refresh report tracking
        setReportVulnIds((prev) => new Set([...prev, outputVuln.id]));
        // Open the report immediately
        setReportVuln(outputVuln);
        setReportContent(result.report);
        setReportDialogOpen(true);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate draft report");
    } finally {
      setDraftingReport(false);
    }
  };

  // View report handler
  const handleViewReport = async (vulnerability: any) => {
    setReportVuln(vulnerability);
    setReportDialogOpen(true);
    setReportContent("");
    setReportLoading(true);
    try {
      const res = await api.get<{ report: any }>(`/vulnerability-rd/${vulnerability.id}/report`);
      setReportContent(res.report?.content || "No report available");
    } catch {
      setReportContent("Failed to load report");
      toast.error("Failed to load report");
    } finally {
      setReportLoading(false);
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

  const statCards = [
    { label: "Total Vulnerabilities", value: stats.total, color: "text-foreground" },
    { label: "Critical", value: stats.critical, color: "text-severity-critical" },
    { label: "High", value: stats.high, color: "text-severity-high" },
    { label: "Investigating", value: stats.investigating, color: "text-info" },
    { label: "Validated", value: stats.validated, color: "text-success" },
  ];

  return (
    <div className="p-8">
      <PageHeader
        icon={ShieldAlert}
        title="Vulnerabilities"
        description="Track and manage security vulnerabilities"
        actions={
          <>
            <Select value={selectedOperation} onValueChange={setSelectedOperation}>
              <SelectTrigger className="w-[220px]" aria-label="Filter by operation">
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
              <CheckSquare aria-hidden="true" className="h-4 w-4 mr-2" />
              {bulkMode ? "Exit Bulk Mode" : "Bulk Select"}
            </Button>
            <Button onClick={handleAddVulnerability}>
              <Plus aria-hidden="true" className="h-4 w-4 mr-2" />
              Add Vulnerability
            </Button>
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-card p-6 rounded-lg shadow-sm border border-border"
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{card.label}</h3>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className={`text-3xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            )}
          </div>
        ))}
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
        onViewOutput={handleViewOutput}
        onViewReport={handleViewReport}
        rdExploitVulnIds={rdExploitVulnIds}
        executionOutputVulnIds={executionOutputVulnIds}
        reportVulnIds={reportVulnIds}
        executingVulnId={executingVulnId}
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
        operations={operations}
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

      {/* Scan Output Dialog */}
      <Dialog open={outputDialogOpen} onOpenChange={setOutputDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal aria-hidden="true" className="h-5 w-5 text-amber-600" />
              Scan Output
            </DialogTitle>
            {outputVuln && (
              <p className="text-sm text-muted-foreground">
                {outputVuln.title} {outputVuln.cve && `(${outputVuln.cve})`}
              </p>
            )}
          </DialogHeader>

          {outputLoading ? (
            <div className="space-y-3 py-2" aria-busy="true" aria-live="polite">
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : outputExecutions.length === 0 ? (
            <EmptyState
              icon={Terminal}
              title="No execution output"
              description="No scan executions found for this vulnerability."
              className="border-0 bg-transparent"
            />
          ) : (
            <div className="space-y-4">
              {outputExecutions.map((execution: any, idx: number) => (
                <div key={execution.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          execution.status === "completed"
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {execution.status}
                      </Badge>
                      <span className="text-sm font-medium">{execution.toolName}</span>
                      {execution.duration != null && (
                        <span className="text-xs text-muted-foreground">{execution.duration}s</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(execution.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {(execution.targets as any)?.[0] && (
                    <p className="text-xs text-muted-foreground px-3 pt-2">
                      Target: {(execution.targets as any)[0]}
                    </p>
                  )}
                  <pre className="p-3 text-xs font-mono whitespace-pre-wrap max-h-80 overflow-y-auto bg-background">
                    {execution.rawOutput || execution.errorMessage || "No output"}
                  </pre>
                  {idx === 0 && (
                    <div className="p-3 border-t bg-muted/30">
                      <Button
                        onClick={() => handleDraftReport(execution)}
                        disabled={draftingReport}
                        className="w-full"
                      >
                        {draftingReport ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileText aria-hidden="true" className="h-4 w-4 mr-2" />
                        )}
                        {draftingReport ? "Generating Report..." : "Draft Report"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOutputDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Viewer Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText aria-hidden="true" className="h-5 w-5 text-purple-600" />
              Vulnerability Report
            </DialogTitle>
            {reportVuln && (
              <p className="text-sm text-muted-foreground">
                {reportVuln.title} {reportVuln.cve && `(${reportVuln.cve})`}
              </p>
            )}
          </DialogHeader>

          {reportLoading ? (
            <div className="space-y-3 py-2" aria-busy="true" aria-live="polite">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap max-h-[60vh] overflow-y-auto bg-background">
                {reportContent || "No report available"}
              </pre>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(reportContent);
                toast.success("Report copied to clipboard");
              }}
              disabled={!reportContent}
            >
              <Copy aria-hidden="true" className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
