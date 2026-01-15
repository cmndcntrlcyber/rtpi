import { useState, useEffect } from "react";
import { reportsService, Report, ReportTemplate } from "@/services/reports";

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await reportsService.list();
      setReports(response.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch reports");
      // Error handled by component
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

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

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await reportsService.listTemplates();
      setTemplates(response.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch templates");
      // Error handled by component
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

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
