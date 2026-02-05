import { useState, useEffect, useCallback, useRef } from "react";
import { reportsService, Report, ReportTemplate } from "@/services/reports";

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchReports = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await reportsService.list({
        signal: abortControllerRef.current.signal,
      });
      setReports(response.reports || []);
    } catch (err) {
      // Ignore abort errors - these are expected when unmounting
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchReports]);

  return {
    reports,
    loading,
    error,
    refetch: fetchReports,
  };
}

export function useReportTemplates() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTemplates = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await reportsService.listTemplates({
        signal: abortControllerRef.current.signal,
      });
      setTemplates(response.templates || []);
    } catch (err) {
      // Ignore abort errors - these are expected when unmounting
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
  };
}

export function useCreateReport() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (data: Partial<Report>) => {
    try {
      setCreating(true);
      setError(null);
      const response = await reportsService.create(data);
      return response.report;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create report");
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

export function useCreateTemplate() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (data: Partial<ReportTemplate>) => {
    try {
      setCreating(true);
      setError(null);
      const response = await reportsService.createTemplate(data);
      return response.template;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
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

export function useDeleteReport() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteReport = async (id: string) => {
    try {
      setDeleting(true);
      setError(null);
      await reportsService.delete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete report");
      // Error handled by component
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return {
    delete: deleteReport,
    deleting,
    error,
  };
}
