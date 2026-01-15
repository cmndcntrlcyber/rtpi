/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import OperationList from "@/components/operations/OperationList";
import OperationForm from "@/components/operations/OperationForm";
import { BulkActionToolbar } from "@/components/shared/BulkActionToolbar";
import { BulkConfirmDialog } from "@/components/shared/BulkConfirmDialog";
import { useOperations, useCreateOperation, useUpdateOperation, useDeleteOperation } from "@/hooks/useOperations";
import { api } from "@/lib/api";

export default function Operations() {
  const [, navigate] = useLocation();
  const { operations, loading, refetch } = useOperations();
  const { create, creating } = useCreateOperation();
  const { update } = useUpdateOperation();
  const { delete: deleteOp } = useDeleteOperation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<any>(null);
  const [operationsWithWorkflows, setOperationsWithWorkflows] = useState<any[]>([]);

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"delete" | "status-change">("delete");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

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

  const enrichOperationsWithWorkflows = async () => {
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
  };

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
    setEditingOperation(operation);
    setFormOpen(true);
  };

  const handleSelectOperation = (operation: any) => {
    // TODO: Navigate to operation details or open details view
    // Operation selection handler - currently not implemented
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
    completed: operations.filter((op) => op.status === "completed").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Operations</h1>
          <p className="text-muted-foreground mt-1">
            Manage red team operations and track progress
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
          <Button onClick={() => setFormOpen(true)} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            New Operation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Total Operations
          </h3>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active</h3>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Planning</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.planning}</p>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Completed</h3>
          <p className="text-3xl font-bold text-muted-foreground">{stats.completed}</p>
        </div>
      </div>

      {/* Operations List */}
      <OperationList
        operations={operationsWithWorkflows.length > 0 ? operationsWithWorkflows : operations}
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
    </div>
  );
}
