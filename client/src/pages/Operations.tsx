import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import OperationList from "@/components/operations/OperationList";
import OperationForm from "@/components/operations/OperationForm";
import { useOperations, useCreateOperation, useUpdateOperation, useDeleteOperation } from "@/hooks/useOperations";

export default function Operations() {
  const { operations, loading, refetch } = useOperations();
  const { create, creating } = useCreateOperation();
  const { update, updating } = useUpdateOperation();
  const { delete: deleteOp, deleting } = useDeleteOperation();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [operationToDelete, setOperationToDelete] = useState<any>(null);

  const handleCreateOperation = async (data: any) => {
    try {
      if (editingOperation) {
        await update(editingOperation.id, data);
        setEditingOperation(null);
      } else {
        await create(data);
      }
      await refetch();
    } catch (err) {
      console.error("Failed to save operation:", err);
    }
  };

  const handleEditOperation = (operation: any) => {
    setEditingOperation(operation);
    setFormOpen(true);
  };

  const handleDeleteOperation = (operation: any) => {
    setOperationToDelete(operation);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (operationToDelete) {
      try {
        await deleteOp(operationToDelete.id);
        await refetch();
        setDeleteConfirmOpen(false);
        setOperationToDelete(null);
      } catch (err) {
        console.error("Failed to delete operation:", err);
      }
    }
  };

  const handleSelectOperation = (operation: any) => {
    // TODO: Navigate to operation details or open details view
    console.log("Selected operation:", operation);
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
        operations={operations}
        loading={loading}
        onSelect={handleSelectOperation}
        onEdit={handleEditOperation}
        onDelete={handleDeleteOperation}
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
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && operationToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-2">Delete Operation</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{operationToDelete.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setOperationToDelete(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
