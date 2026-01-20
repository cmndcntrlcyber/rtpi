import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export interface AssetQuestion {
  id: string;
  assetId: string | null;
  operationId: string;
  question: string;
  questionType: string;
  askedBy: string;
  answer: string | null;
  answerSource: string | null;
  answeredByUserId: string | null;
  answeredByAgentId: string | null;
  status: string;
  askedAt: string;
  answeredAt: string | null;
  helpful: boolean | null;
}

export function useAssetQuestions(operationId: string, status?: string) {
  const [questions, setQuestions] = useState<AssetQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (status) params.append("status", status);

      const response = await api.get(
        `/operations-management/questions/${operationId}?${params.toString()}`
      );
      setQuestions(response.questions || []);
    } catch (err: any) {
      console.error("Failed to fetch asset questions:", err);
      setError(err.response?.data?.error || err.message || "Failed to fetch asset questions");
    } finally {
      setLoading(false);
    }
  };

  const answerQuestion = async (questionId: string, answer: string, helpful?: boolean) => {
    try {
      const response = await api.post(`/operations-management/questions/${questionId}/answer`, {
        answer,
        helpful,
      });

      // Update local state
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? response.question : q))
      );

      return response.question;
    } catch (err: any) {
      console.error("Failed to answer question:", err);
      throw new Error(err.response?.data?.error || err.message || "Failed to answer question");
    }
  };

  useEffect(() => {
    if (operationId) {
      fetchQuestions();

      // Poll every 2 minutes
      const interval = setInterval(fetchQuestions, 2 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [operationId, status]);

  return {
    questions,
    loading,
    error,
    refetch: fetchQuestions,
    answerQuestion,
  };
}
