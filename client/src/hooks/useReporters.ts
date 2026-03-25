import { useState, useEffect, useCallback, useRef } from "react";
import {
  reportersService,
  Reporter,
  ReporterQuestion,
  ReporterTask,
} from "@/services/reporters";

export function useReporters(filters?: { operationId?: string; status?: string }) {
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchReporters = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await reportersService.list({
        signal: abortControllerRef.current.signal,
        ...filters,
      });
      setReporters(response.reporters || []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch reporters");
    } finally {
      setLoading(false);
    }
  }, [filters?.operationId, filters?.status]);

  useEffect(() => {
    fetchReporters();
    return () => { abortControllerRef.current?.abort(); };
  }, [fetchReporters]);

  return { reporters, loading, error, refetch: fetchReporters };
}

export function usePendingQuestions(operationId?: string) {
  const [questions, setQuestions] = useState<ReporterQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await reportersService.listPendingQuestions({
        signal: abortControllerRef.current.signal,
        operationId,
      });
      setQuestions(response.questions || []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch questions");
    } finally {
      setLoading(false);
    }
  }, [operationId]);

  useEffect(() => {
    fetchQuestions();
    return () => { abortControllerRef.current?.abort(); };
  }, [fetchQuestions]);

  return { questions, loading, error, refetch: fetchQuestions };
}

export function useReporterTasks(reporterId: string) {
  const [tasks, setTasks] = useState<ReporterTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTasks = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await reportersService.listTasks(reporterId, {
        signal: abortControllerRef.current.signal,
      });
      setTasks(response.tasks || []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, [reporterId]);

  useEffect(() => {
    fetchTasks();
    return () => { abortControllerRef.current?.abort(); };
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks };
}
