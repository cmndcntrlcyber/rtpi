import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import VulnerabilityList from "@/components/vulnerabilities/VulnerabilityList";
import EditVulnerabilityDialog from "@/components/vulnerabilities/EditVulnerabilityDialog";
import SendToRDDialog from "@/components/vulnerabilities/SendToRDDialog";
import { BulkActionToolbar } from "@/components/shared/BulkActionToolbar";
import { BulkConfirmDialog } from "@/components/shared/BulkConfirmDialog";
import { api } from "@/lib/api";
import { useLocation } from "wouter";

export default function Vulnerabilities() {
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState<any>(null);

  // R&D dialog state
  const [rdDialogOpen, setRdDialogOpen] = useState(false);
  const [rdVulnerability, setRdVulnerability] = useState<any>(null);
  const [, setLocation] = useLocation();

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"delete" | "status-change">("delete");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vulnsRes, targetsRes] = await Promise.all([
        api.get<{ vulnerabilities: any[] }>("/vulnerabilities"),
        api.get<{ targets: any[] }>("/targets"),
      ]);
      setVulnerabilities(vulnsRes.vulnerabilities);
      setTargets(targetsRes.targets);
    } catch (error) {
      // Error handled via toast
    } finally {
      setLoading(false);
    }
  };

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
      // Only send editable fields (exclude timestamps which cause date conversion errors)
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

      // Debug logging removed

      if (vulnerability.id) {
        // Update existing
        await api.put(`/vulnerabilities/${vulnerability.id}`, payload);
      } else {
        // Create new
        await api.post("/vulnerabilities", payload);
      }
      setEditDialogOpen(false);
      await loadData();
    } catch (error) {
      // Error handled via toast
      toast.error("Failed to save vulnerability");
    }
  };

  const handleDeleteVulnerability = async (id: string) => {
    try {
      await api.delete(`/vulnerabilities/${id}`);
      setEditDialogOpen(false);
      await loadData();
    } catch (error) {
      // Error handled via toast
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
      // Update status for all selected vulnerabilities
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.patch(`/vulnerabilities/${id}`, { status })
        )
      );
      await loadData();
      handleClearSelection();
    } catch (error) {
      // Error handled via toast
      toast.error("Failed to update statuses");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleConfirmBulkAction = async () => {
    setBulkActionLoading(true);
    try {
      if (bulkAction === "delete") {
        // Delete all selected vulnerabilities
        await Promise.all(
          Array.from(selectedIds).map((id) => api.delete(`/vulnerabilities/${id}`))
        );
      }
      await loadData();
      handleClearSelection();
      setConfirmDialogOpen(false);
    } catch (error) {
      // Error handled via toast
      toast.error("Bulk operation failed");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    if (bulkMode) {
      // Clear selection when exiting bulk mode
      handleClearSelection();
    }
  };

  // Calculate stats
  const stats = {
    total: vulnerabilities.length,
    critical: vulnerabilities.filter((v) => v.severity === "critical").length,
    high: vulnerabilities.filter((v) => v.severity === "high").length,
    open: vulnerabilities.filter((v) => v.status === "open").length,
    remediated: vulnerabilities.filter((v) => v.status === "remediated").length,
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Remediated</h3>
          <p className="text-3xl font-bold text-green-600">{stats.remediated}</p>
        </div>
      </div>

      {/* Vulnerabilities List */}
      <VulnerabilityList
        vulnerabilities={vulnerabilities}
        loading={loading}
        onSelect={handleSelectVulnerability}
        onEdit={handleEditVulnerability}
        onDelete={(v) => handleDeleteVulnerability(v.id)}
        onSendToRD={handleSendToRD}
        selectable={bulkMode}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
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
    </div>
  );
}
