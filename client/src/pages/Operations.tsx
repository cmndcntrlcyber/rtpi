import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import OperationList from "@/components/operations/OperationList";
import OperationForm from "@/components/operations/OperationForm";
import { useOperations, useCreateOperation, useUpdateOperation, useDeleteOperation } from "@/hooks/useOperations";
import { api } from "@/lib/api";

export default function Operations() {
  const [, navigate] = useLocation();
  const { operations, loading, refetch } = useOperations();
  const { create, creating } = useCreateOperation();
  const { update, updating } = useUpdateOperation();
  const { delete: deleteOp, deleting } = useDeleteOperation();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<any>(null);
  const [operationsWithWorkflows, setOperationsWithWorkflows] = useState<any[]>([]);

  const handleCreateOperation = async (data: any) => {
    try {
      console.log("Saving operation:", data);
      
      if (editingOperation) {
        console.log("Updating operation:", editingOperation.id);
        await update(editingOperation.id, data);
        setEditingOperation(null);
      } else {
        console.log("Creating new operation");
        const result = await create(data);
        console.log("Operation created:", result);
      }
      
      console.log("Refetching operations list...");
      
      // Add small delay to ensure database has committed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await refetch();
      
      console.log("Operations refetched successfully");
      console.log("Current operations count:", operations.length);
      
      // Don't close form here - let the form handle its own closing
    } catch (err: any) {
      console.error("Failed to save operation:", err);
      alert(`Failed to save operation: ${err.message || "Unknown error"}`);
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
    } catch (err) {
      console.error("Failed to delete operation:", err);
      alert("Failed to delete operation");
    }
  };

  const handleViewTargets = (operationId: string) => {
    // Navigate to targets page
    // TODO: Add filtering support in targets page
    setFormOpen(false);
    navigate("/targets");
  };

  const handleAddTarget = (operationId: string) => {
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
    console.log("Selected operation:", operation);
  };

  // Fetch latest workflow for each operation
  useEffect(() => {
    enrichOperationsWithWorkflows();
  }, [operations]);

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
      console.error("Failed to fetch workflows for operations:", error);
      // Fallback to operations without workflow data
      setOperationsWithWorkflows(operations);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Operations</h1>
          <p className="text-gray-600 mt-1">
            Manage red team operations and track progress
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={creating}>
          <Plus className="h-4 w-4 mr-2" />
          New Operation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Total Operations
          </h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Active</h3>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Planning</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.planning}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Completed</h3>
          <p className="text-3xl font-bold text-gray-600">{stats.completed}</p>
        </div>
      </div>

      {/* Operations List */}
      <OperationList
        operations={operationsWithWorkflows.length > 0 ? operationsWithWorkflows : operations}
        loading={loading}
        onSelect={handleSelectOperation}
        onEdit={handleEditOperation}
        onDelete={handleDeleteClick}
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
    </div>
  );
}
