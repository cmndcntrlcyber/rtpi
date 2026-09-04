import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileBarChart, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";

interface HarnessEvaluation {
  id: string;
  workflowId: string;
  operationId?: string;
  status: string;
  grade?: string;
  summary?: string;
  markdownReport?: string;
  createdAt: string;
}

export default function HarnessEvaluationPanel() {
  const [evaluations, setEvaluations] = useState<HarnessEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedMarkdown, setExpandedMarkdown] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ evaluations: HarnessEvaluation[] }>("/harness-evaluations");
      setEvaluations(res.evaluations || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedMarkdown(null);
      return;
    }
    setExpandedId(id);
    try {
      const res = await api.get<{ markdown: string }>(`/harness-evaluations/${id}/markdown`);
      setExpandedMarkdown(res.markdown || "No report available.");
    } catch {
      setExpandedMarkdown("Failed to load report.");
    }
  };

  const gradeColor = (grade?: string) => {
    if (!grade) return "secondary";
    if (grade.startsWith("A")) return "default";
    if (grade.startsWith("B")) return "secondary";
    return "destructive";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileBarChart className="h-4 w-4" />
          Harness Evaluations
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {evaluations.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No evaluations yet. Run a workflow to generate one.
          </p>
        )}

        <div className="space-y-2">
          {evaluations.slice(0, 10).map((ev) => (
            <div key={ev.id} className="border rounded-md">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(ev.id)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={gradeColor(ev.grade)} className="text-[10px] px-1.5">
                    {ev.grade || "—"}
                  </Badge>
                  <span className="font-mono text-muted-foreground">
                    {ev.workflowId.slice(0, 8)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {ev.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleDateString()}
                  </span>
                  {expandedId === ev.id ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              </button>
              {expandedId === ev.id && (
                <div className="px-3 pb-3 border-t">
                  {ev.summary && (
                    <p className="text-xs text-muted-foreground mt-2 mb-2">{ev.summary}</p>
                  )}
                  {expandedMarkdown && (
                    <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {expandedMarkdown}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {evaluations.length > 10 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing 10 of {evaluations.length}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
