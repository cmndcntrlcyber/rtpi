import { HelpCircle, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { useState } from "react";

interface AssetQuestionCardProps {
  question: {
    id: string;
    question: string;
    questionType: string;
    askedAt: string;
    answer: string | null;
    status: string;
    answeredAt: string | null;
  };
  onAnswer?: (questionId: string, answer: string) => Promise<void>;
}

const questionTypeColors: Record<string, string> = {
  context: "text-blue-600",
  scope: "text-purple-600",
  priority: "text-orange-600",
  classification: "text-green-600",
  verification: "text-red-600",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  answered: "secondary",
  dismissed: "outline",
  escalated: "destructive",
};

export function AssetQuestionCard({ question, onAnswer }: AssetQuestionCardProps) {
  const [isAnswering, setIsAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!answer.trim() || !onAnswer) return;

    try {
      setSubmitting(true);
      await onAnswer(question.id, answer);
      setIsAnswering(false);
      setAnswer("");
    } catch (error) {
      console.error("Failed to submit answer:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow border border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <HelpCircle className="h-6 w-6 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={questionTypeColors[question.questionType] || "text-gray-600"}
              >
                {question.questionType}
              </Badge>
              <Badge variant={statusVariant[question.status] || "outline"}>
                {question.status}
              </Badge>
            </div>
            <p className="font-medium mb-2">{question.question}</p>
            <p className="text-sm text-muted-foreground">
              Asked {formatDistanceToNow(new Date(question.askedAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>

      {question.status === "answered" && question.answer ? (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 mt-4">
          <div className="flex items-start gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-100 mb-1">Answer:</p>
              <p className="text-sm text-green-800 dark:text-green-200">{question.answer}</p>
              {question.answeredAt && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  Answered{" "}
                  {formatDistanceToNow(new Date(question.answeredAt), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : question.status === "pending" ? (
        <div className="mt-4">
          {!isAnswering ? (
            <Button onClick={() => setIsAnswering(true)} size="sm" className="w-full">
              Answer Question
            </Button>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                className="w-full"
              />
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={!answer.trim() || submitting} size="sm">
                  {submitting ? "Submitting..." : "Submit Answer"}
                </Button>
                <Button
                  onClick={() => {
                    setIsAnswering(false);
                    setAnswer("");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
