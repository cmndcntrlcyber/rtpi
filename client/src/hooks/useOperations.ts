import { useState, useEffect } from "react";
import { operationsService } from "@/services/operations";

interface Operation {
  id: string;
  name: string;
  description?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  createdBy: string;
  type?: string;
  targets?: number;
  findings?: number;
}

export function useOperations() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOperations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await operationsService.list();
      setOperations(response.operations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch operations");
      // Error handled by component
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, []);

  return {
    operations,
    loading,
    error,
    refetch: fetchOperations,
  };
}

export function useCreateOperation() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (data: Partial<Operation>) => {
    try {
      setCreating(true);
      setError(null);
      const response = await operationsService.create(data);
      return response.operation;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create operation");
      // Error handled by component
      throw err;
    } finally {
      setCreating(false);
    }
  };

  return {
    create,
    creating,
    error,
  };
}

export function useUpdateOperation() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (id: string, data: Partial<Operation>) => {
    try {
      setUpdating(true);
      setError(null);
      const response = await operationsService.update(id, data);
      return response.operation;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update operation");
      // Error handled by component
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  return {
    update,
    updating,
    error,
  };
}

export function useDeleteOperation() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteOperation = async (id: string) => {
    try {
      setDeleting(true);
      setError(null);
      await operationsService.delete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete operation");
      // Error handled by component
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return {
    delete: deleteOperation,
    deleting,
    error,
  };
}
