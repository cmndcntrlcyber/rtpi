import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Send,
  X,
  AlertTriangle,
  ChevronUp,
  Clock,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";

interface Question {
  id: string;
  reporterId: string;
  question: string;
  context: Record<string, any>;
  priority: number;
  status: string;
  response?: string;
  createdAt: string;
}

interface Reporter {
  id: string;
  name: string;
  pageId: string;
}

interface QuestionWithReporter {
  question: Question;
  reporter: Reporter | null;
}

interface QuestionQueueProps {
  operationId?: string;
  onAction?: () => void;
}

export default function QuestionQueue({ operationId, onAction }: QuestionQueueProps) {
  const [questions, setQuestions] = useState<QuestionWithReporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithReporter | null>(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [response, setResponse] = useState("");
  const [generateTask, setGenerateTask] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestions();
    const interval = setInterval(loadQuestions, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [operationId]);

  const loadQuestions = async () => {
    try {
      const endpoint = operationId
        ? `/reporters/questions/pending?operationId=${operationId}`
        : "/reporters/questions/pending";
      const data = await api.get<{ questions: Question[] }>(endpoint);

      // Enrich with reporter data
      const enriched: QuestionWithReporter[] = [];
      for (const question of data.questions || []) {
        let reporter: Reporter | null = null;
        try {
          const reporterData = await api.get<{ reporter: Reporter }>(`/reporters/${question.reporterId}`);
          reporter = reporterData.reporter;
        } catch {
          // Reporter not found
        }
        enriched.push({ question, reporter });
      }

      setQuestions(enriched);
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = (questionData: QuestionWithReporter) => {
    setSelectedQuestion(questionData);
    setResponse("");
    setGenerateTask(true);
    setResponseDialogOpen(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedQuestion || !response.trim()) return;

    setSubmitting(true);
    try {
      await api.put(`/reporters/questions/${selectedQuestion.question.id}/respond`, {
        response,
        generateTask,
      });

      toast.success("Response submitted successfully");
      setResponseDialogOpen(false);
      await loadQuestions();
      onAction?.();
    } catch (err) {
      toast.error("Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async (questionId: string) => {
    try {
      await api.put(`/reporters/questions/${questionId}/respond`, {
        response: "Dismissed by operator",
      });
      toast.success("Question dismissed");
      await loadQuestions();
      onAction?.();
    } catch (err) {
      toast.error("Failed to dismiss question");
    }
  };

  const handleEscalate = async (questionId: string) => {
    try {
      await api.post(`/reporters/questions/${questionId}/escalate`, {});
      toast.success("Question escalated");
      await loadQuestions();
      onAction?.();
    } catch (err) {
      toast.error("Failed to escalate question");
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "bg-red-100 text-red-700";
    if (priority >= 5) return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-700";
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No pending questions</p>
        <p className="text-sm">Questions from reporters will appear here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {questions.map(({ question, reporter }) => (
          <div
            key={question.id}
            className={`p-4 rounded-lg border ${
              question.priority >= 8
                ? "border-red-200 bg-red-50"
                : "border-border bg-secondary"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {question.priority >= 8 && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  <Badge variant="secondary" className={getPriorityColor(question.priority)}>
                    Priority: {question.priority}
                  </Badge>
                  {reporter && (
                    <Badge variant="outline">
                      {reporter.name}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(question.createdAt)}
                  </span>
                </div>

                <p className="font-medium mb-2">{question.question}</p>

                {question.context && Object.keys(question.context).length > 0 && (
                  <div className="text-sm text-muted-foreground bg-background p-2 rounded border">
                    <p className="font-medium text-xs mb-1">Context:</p>
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(question.context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  onClick={() => handleRespond({ question, reporter })}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Respond
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEscalate(question.id)}
                >
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Escalate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(question.id)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Respond to Question
            </DialogTitle>
            <DialogDescription>
              Provide a response and optionally generate a task for the reporter
            </DialogDescription>
          </DialogHeader>

          {selectedQuestion && (
            <div className="space-y-4 py-4">
              {/* Original question */}
              <div className="bg-secondary p-3 rounded-lg">
                <p className="font-medium text-sm mb-1">Question:</p>
                <p>{selectedQuestion.question.question}</p>
                {selectedQuestion.reporter && (
                  <p className="text-xs text-muted-foreground mt-2">
                    From: {selectedQuestion.reporter.name}
                  </p>
                )}
              </div>

              {/* Response input */}
              <div>
                <Label htmlFor="response">Your Response</Label>
                <Textarea
                  id="response"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Enter your response or instructions for the reporter..."
                  rows={4}
                />
              </div>

              {/* Generate task checkbox */}
              <div
                className={`flex items-center p-3 rounded-lg border cursor-pointer ${
                  generateTask ? "bg-blue-50 border-blue-200" : "bg-secondary border-border"
                }`}
                onClick={() => setGenerateTask(!generateTask)}
              >
                <Checkbox checked={generateTask} className="mr-3" />
                <div>
                  <span className="font-medium">Generate task from response</span>
                  <p className="text-xs text-muted-foreground">
                    Automatically create a task for the reporter based on your response
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setResponseDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitResponse}
                  disabled={submitting || !response.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Response
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
