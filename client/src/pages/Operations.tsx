import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useSearchParams } from "wouter";
import { Plus, CheckSquare, Download, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import OperationList from "@/components/operations/OperationList";
import OperationForm from "@/components/operations/OperationForm";
import OpsManagerFloatingChat from "@/components/operations/OpsManagerFloatingChat";
import { BulkActionToolbar } from "@/components/shared/BulkActionToolbar";
import { BulkConfirmDialog } from "@/components/shared/BulkConfirmDialog";
import BugBountyImportCard from "@/components/operations/BugBountyImportCard";
import { useOperations, useCreateOperation, useUpdateOperation, useDeleteOperation } from "@/hooks/useOperations";
import { api } from "@/lib/api";

export default function Operations() {
  const [, navigate] = useLocation();
  const [searchParams] = useSearchParams();
  const { operations, loading, refetch } = useOperations();
  const { create, creating } = useCreateOperation();
  const { update } = useUpdateOperation();
  const { delete: deleteOp } = useDeleteOperation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<any>(null);
  const [operationsWithWorkflows, setOperationsWithWorkflows] = useState<any[]>([]);

  // Floating chat state
  const [chatOpen, setChatOpen] = useState(searchParams.get("chat") === "open");
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);

  // Auto-select first active operation for floating chat
  useEffect(() => {
    if (!selectedOperationId && operations.length > 0) {
      const firstActive = operations.find((op) => op.status === "active");
      setSelectedOperationId((firstActive || operations[0]).id);
    }
  }, [operations, selectedOperationId]);

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<string | null>("active");

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"delete" | "status-change">("delete");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bugBountyImportOpen, setBugBountyImportOpen] = useState(false);

  const handleCreateOperation = async (data: any) => {
    try {
      if (editingOperation) {
        await update(editingOperation.id, data);
        toast.success("Operation updated successfully");
        setEditingOperation(null);
      } else {
        await create(data);
        toast.success("Operation created successfully");
      }

      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 200));

      await refetch();

      // Don't close form here - let the form handle its own closing
    } catch (err: any) {
      toast.error(`Failed to save operation: ${err.message || "Unknown error"}`);
      throw err; // Re-throw so form can show error
    }
  };

  const handleEditOperation = (operation: any) => {
    setEditingOperation(operation);
    setFormOpen(true);
  };

  const handleDeleteOperation = async (id: string) => {
    try {
      await deleteOp(id);
      await refetch();
      toast.success("Operation deleted successfully");
    } catch (err: any) {
      toast.error(`Failed to delete operation: ${err.message || "Unknown error"}`);
    }
  };

  const enrichOperationsWithWorkflows = useCallback(async () => {
    if (!operations || operations.length === 0) {
      setOperationsWithWorkflows([]);
      return;
    }

    try {
      // Fetch all workflows
      const response = await api.get<{ workflows: any[] }>("/agent-workflows");
      const workflows = response.workflows || [];

      // For each operation, find the most recent completed workflow
      const enriched = operations.map((op) => {
        const opWorkflows = workflows
          .filter((w) => w.operationId === op.id && w.status === "completed")
          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

        const latestWorkflow = opWorkflows[0];

        return {
          ...op,
          latestWorkflow: latestWorkflow?.name || undefined,
          latestWorkflowId: latestWorkflow?.id || undefined,
          latestWorkflowStatus: latestWorkflow?.status || undefined,
          latestWorkflowDate: latestWorkflow?.completedAt || undefined,
        };
      });

      setOperationsWithWorkflows(enriched);
    } catch (error) {
      // Fallback to operations without workflow data
      setOperationsWithWorkflows(operations);
    }
  }, [operations]);

  // FIX BUG #2: Handle inline status changes
  const handleStatusChange = async (operationId: string, newStatus: string) => {
    try {
      await api.patch(`/operations/${operationId}/status`, { status: newStatus });
      await refetch();
      // Re-enrich with workflows after status change
      await enrichOperationsWithWorkflows();
      toast.success("Operation status updated successfully");
    } catch (err: any) {
      toast.error(`Failed to update operation status: ${err.message || "Unknown error"}`);
      throw err; // Re-throw for component error handling
    }
  };

  const handleViewTargets = (_operationId: string) => {
    // Navigate to targets page
    // TODO: Add filtering support in targets page
    setFormOpen(false);
    navigate("/targets");
  };

  const handleAddTarget = (_operationId: string) => {
    // Navigate to targets page to add new target
    setFormOpen(false);
    navigate("/targets");
    // TODO: Pass operationId to targets page to pre-fill in add dialog
  };
  const handleDeleteClick = (operation: any) => {
    if (window.confirm(`Are you sure you want to delete operation "${operation.name}"? This action cannot be undone.`)) {
      handleDeleteOperation(operation.id);
    }
  };

  const handleSelectOperation = (operation: any) => {
    setSelectedOperationId(operation.id);
    if (!chatOpen) setChatOpen(true);
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
      // Update status for all selected operations
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.patch(`/operations/${id}/status`, { status })
        )
      );
      await refetch();
      await enrichOperationsWithWorkflows();
      handleClearSelection();
      toast.success(`Successfully updated ${selectedIds.size} operation(s)`);
    } catch (error: any) {
      toast.error(`Failed to update statuses: ${error.message || "Unknown error"}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleConfirmBulkAction = async () => {
    setBulkActionLoading(true);
    try {
      if (bulkAction === "delete") {
        // Delete all selected operations
        await Promise.all(
          Array.from(selectedIds).map((id) => deleteOp(id))
        );
        toast.success(`Successfully deleted ${selectedIds.size} operation(s)`);
      }
      await refetch();
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
      // Clear selection when exiting bulk mode
      handleClearSelection();
    }
  };

  // Fetch latest workflow for each operation
  useEffect(() => {
    enrichOperationsWithWorkflows();
  }, [operations, enrichOperationsWithWorkflows]);

  // Calculate stats from operations
  const stats = {
    total: operations.length,
    active: operations.filter((op) => op.status === "active").length,
    planning: operations.filter((op) => op.status === "planning").length,
    paused: operations.filter((op) => op.status === "paused").length,
    completed: operations.filter((op) => op.status === "completed").length,
    cancelled: operations.filter((op) => op.status === "cancelled").length,
  };

  // Filter operations based on selected status card
  const displayOperations = useMemo(() => {
    const source = operationsWithWorkflows.length > 0 ? operationsWithWorkflows : operations;
    if (!statusFilter) return source;
    return source.filter((op: any) => op.status === statusFilter);
  }, [operationsWithWorkflows, operations, statusFilter]);

  const handleStatusFilterClick = (filter: string | null) => {
    setStatusFilter((prev) => (prev === filter ? null : filter));
  };

  return (
    <div className="p-8">
      <PageHeader
        icon={Crosshair}
        title="Operations"
        description="Manage red team operations and track progress"
        actions={
          <>
            <Button
              variant={bulkMode ? "secondary" : "outline"}
              onClick={toggleBulkMode}
            >
              <CheckSquare aria-hidden="true" className="h-4 w-4 mr-2" />
              {bulkMode ? "Exit Bulk Mode" : "Bulk Select"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setBugBountyImportOpen(!bugBountyImportOpen)}
            >
              <Download aria-hidden="true" className="h-4 w-4 mr-2" />
              Import Bug Bounty
            </Button>
            <Button onClick={() => setFormOpen(true)} disabled={creating}>
              <Plus aria-hidden="true" className="h-4 w-4 mr-2" />
              New Operation
            </Button>
          </>
        }
      />

      {/* Bug Bounty Import Card */}
      {bugBountyImportOpen && (
        <div className="mb-6">
          <BugBountyImportCard
            onClose={() => setBugBountyImportOpen(false)}
            onSuccess={(operationId) => {
              setBugBountyImportOpen(false);
              refetch();
              toast.success("Bug bounty program imported successfully");
            }}
          />
        </div>
      )}

      {/* Stats Cards — clickable filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {([
          { key: null, label: "Total Operations", value: stats.total, color: "text-foreground" },
          { key: "active", label: "Active", value: stats.active, color: "text-success" },
          { key: "planning", label: "Planning", value: stats.planning, color: "text-info" },
          { key: "paused", label: "Paused", value: stats.paused, color: "text-warning" },
          { key: "completed", label: "Completed", value: stats.completed, color: "text-muted-foreground" },
          { key: "cancelled", label: "Cancelled", value: stats.cancelled, color: "text-destructive" },
        ] as const).map((card) => {
          const isActive = statusFilter === card.key;
          return (
            <button
              key={card.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleStatusFilterClick(card.key)}
              className={`text-left bg-card p-5 rounded-lg shadow-sm border transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive
                  ? "ring-2 ring-primary ring-offset-2 border-primary"
                  : "border-border"
              }`}
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{card.label}</h3>
              {loading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <p className={`text-3xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Operations List */}
      <OperationList
        operations={displayOperations}
        loading={loading}
        onSelect={handleSelectOperation}
        onEdit={handleEditOperation}
        onDelete={handleDeleteClick}
        onStatusChange={handleStatusChange}
        onWorkflowsChange={enrichOperationsWithWorkflows}
        selectable={bulkMode}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
      />

      {/* Create/Edit Form Dialog */}
      <OperationForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingOperation(null);
        }}
        onSubmit={handleCreateOperation}
        initialData={editingOperation}
        mode={editingOperation ? "edit" : "create"}
        onDelete={handleDeleteOperation}
        onViewTargets={handleViewTargets}
        onAddTarget={handleAddTarget}
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
        itemType="operation"
        onConfirm={handleConfirmBulkAction}
        loading={bulkActionLoading}
      />

      {/* Operations Manager Floating Chat */}
      <OpsManagerFloatingChat
        operationId={selectedOperationId}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
      />
    </div>
  );
}
