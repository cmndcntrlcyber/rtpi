import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface FilterPreset {
  id: string;
  userId: string;
  name: string;
  description?: string;
  context: string;
  filters: any;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useFilterPresets(context: string) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ presets: FilterPreset[] }>(
        `/filter-presets?context=${context}`
      );
      setPresets(response.presets || []);
    } catch (err: any) {
      setError(err.message || "Failed to load filter presets");
      toast.error("Failed to load filter presets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, [context]);

  const createPreset = async (
    name: string,
    description: string | undefined,
    filters: any,
    isShared: boolean = false
  ) => {
    try {
      const response = await api.post<{ preset: FilterPreset }>("/filter-presets", {
        name,
        description,
        context,
        filters,
        isShared,
      });

      setPresets((prev) => [...prev, response.preset]);
      toast.success("Filter preset saved successfully");
      return response.preset;
    } catch (err: any) {
      toast.error("Failed to save filter preset");
      throw err;
    }
  };

  const updatePreset = async (
    id: string,
    updates: Partial<Omit<FilterPreset, "id" | "userId" | "createdAt" | "updatedAt">>
  ) => {
    try {
      const response = await api.put<{ preset: FilterPreset }>(
        `/filter-presets/${id}`,
        updates
      );

      setPresets((prev) =>
        prev.map((p) => (p.id === id ? response.preset : p))
      );
      toast.success("Filter preset updated successfully");
      return response.preset;
    } catch (err: any) {
      toast.error("Failed to update filter preset");
      throw err;
    }
  };

  const deletePreset = async (id: string) => {
    try {
      await api.delete(`/filter-presets/${id}`);
      setPresets((prev) => prev.filter((p) => p.id !== id));
      toast.success("Filter preset deleted successfully");
    } catch (err: any) {
      toast.error("Failed to delete filter preset");
      throw err;
    }
  };

  return {
    presets,
    loading,
    error,
    createPreset,
    updatePreset,
    deletePreset,
    refetch: fetchPresets,
  };
}
