import { useState, useEffect, useCallback, useRef } from "react";
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchOperations = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await operationsService.list({
        signal: abortControllerRef.current.signal,
      });
      setOperations(response.operations || []);
    } catch (err) {
      // Ignore abort errors - these are expected when unmounting
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch operations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOperations();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchOperations]);

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
