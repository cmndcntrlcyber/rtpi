import { useState, useRef, useEffect } from "react";
import { Bot, X, Minus, Send, Play, Power, PowerOff, HelpCircle, Loader2, MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReporterAgents } from "@/hooks/useReporterAgents";
import { useAssetQuestions } from "@/hooks/useAssetQuestions";
import { useOperationsManagement } from "@/hooks/useOperationsManagement";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface OpsManagerFloatingChatProps {
  operationId: string | null;
  isOpen: boolean;
  onToggle: () => void;
}

const questionTypeColors: Record<string, string> = {
  context: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  scope: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  priority: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  classification: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  verification: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function OpsManagerFloatingChat({
  operationId,
  isOpen,
  onToggle,
}: OpsManagerFloatingChatProps) {
  const { agents } = useReporterAgents();
  const {
    questions,
    answerQuestion,
  } = useAssetQuestions(operationId || "", "pending");
  const {
    data: opsData,
    enableHourlyReporting,
    disableHourlyReporting,
    triggerNow,
  } = useOperationsManagement(operationId || "");

  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [viewMode, setViewMode] = useState<"chat" | "features">("features");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; timestamp: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const pendingCount = questions.length;
  const hourlyReportingEnabled = opsData?.operation?.hourlyReportingEnabled || false;
  const operationName = opsData?.operation?.name || "No operation";
  const activeReporters = opsData?.stats?.activeReporters || 0;

  // Auto-scroll to bottom when new questions or chat messages arrive
  useEffect(() => {
    if (scrollRef.current && isOpen && viewMode === "features") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [questions.length, isOpen, viewMode]);

  useEffect(() => {
    if (chatScrollRef.current && isOpen && viewMode === "chat") {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, isOpen, viewMode]);

  const handleAnswerSubmit = async () => {
    if (!answeringId || !answerText.trim()) return;

    setSubmitting(true);
    try {
      await answerQuestion(answeringId, answerText.trim());
      toast.success("Question answered");
      setAnsweringId(null);
      setAnswerText("");
    } catch (err: any) {
      toast.error(err.message || "Failed to answer question");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerNow = async () => {
    setTriggering(true);
    try {
      await triggerNow();
      toast.success("Workflow triggered successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger workflow");
    } finally {
      setTriggering(false);
    }
  };

  const handleToggleReporting = async () => {
    setToggling(true);
    try {
      if (hourlyReportingEnabled) {
        await disableHourlyReporting();
        toast.success("Hourly reporting disabled");
      } else {
        await enableHourlyReporting();
        toast.success("Hourly reporting enabled");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle reporting");
    } finally {
      setToggling(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !operationId) return;

    const userMessage = {
      role: "user" as const,
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    const currentInput = chatInput.trim();
    setChatInput("");
    setSendingMessage(true);

    try {
      // Send message with conversation history to Operations Manager agent
      const response = await api.post("/operations-management/chat", {
        operationId,
        message: currentInput,
        conversationHistory: chatMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMessage = {
        role: "assistant" as const,
        content: response.response || "I'm processing your request...",
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
      
      // Show provider info in console for debugging
      console.log(`[OpsManager Chat] Response from ${response.provider} (${response.model}), ${response.tokensUsed} tokens`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      // Remove user message on error
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChatMessage();
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform duration-200 hover:scale-110 ${
          isOpen
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground"
        }`}
        title="Operations Manager"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <div className="relative">
            <Bot className="h-6 w-6" />
            {pendingCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {pendingCount}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] bg-card rounded-lg shadow-xl border border-border transition-all duration-300 ${
          isOpen
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">Operations Manager</h3>
            {operationId ? (
              <p className="text-xs text-muted-foreground truncate">{operationName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Select an operation</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">{activeReporters} reporters</span>
            <button
              onClick={onToggle}
              className="p-1 rounded hover:bg-secondary"
              title="Minimize"
            >
              <Minus className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Mode Toggle */}
        {operationId && (
          <div className="px-4 pt-3 pb-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "chat" | "features")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chat" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="features" className="text-xs relative">
                  <Zap className="h-3 w-3 mr-1" />
                  Features
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Content */}
        {!operationId ? (
          <div className="p-6 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Click on an operation to start</p>
          </div>
        ) : viewMode === "chat" ? (
          <>
            {/* Chat Messages */}
            <div ref={chatScrollRef} className="max-h-[300px] overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Start a conversation with Operations Manager</p>
                  <p className="text-[10px] mt-1">Ask about operations status, progress, or next steps</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-[9px] mt-1 opacity-70">
                        {formatTimeAgo(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {sendingMessage && (
                <div className="flex gap-2 justify-start">
                  <div className="flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="bg-secondary rounded-lg px-3 py-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask Operations Manager anything..."
                  className="flex-1 text-sm border border-border rounded-md p-2 bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary min-h-[40px] max-h-[100px]"
                  rows={1}
                  disabled={sendingMessage}
                />
                <Button
                  size="sm"
                  onClick={handleSendChatMessage}
                  disabled={!chatInput.trim() || sendingMessage}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Quick Actions */}
            <div className="flex gap-2 p-3 border-b border-border">
              <Button
                size="sm"
                variant="outline"
                onClick={handleTriggerNow}
                disabled={triggering}
                className="flex-1 text-xs"
              >
                {triggering ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Trigger Scan
              </Button>
              <Button
                size="sm"
                variant={hourlyReportingEnabled ? "destructive" : "outline"}
                onClick={handleToggleReporting}
                disabled={toggling}
                className="flex-1 text-xs"
              >
                {toggling ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : hourlyReportingEnabled ? (
                  <PowerOff className="h-3 w-3 mr-1" />
                ) : (
                  <Power className="h-3 w-3 mr-1" />
                )}
                {hourlyReportingEnabled ? "Disable" : "Enable"} Reporting
              </Button>
            </div>

            {/* Questions Feed */}
            <div ref={scrollRef} className="max-h-[300px] overflow-y-auto p-3 space-y-3">
              {questions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No pending questions</p>
                </div>
              ) : (
                questions.map((q) => (
                  <div
                    key={q.id}
                    className="bg-secondary/50 rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <Bot className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              questionTypeColors[q.questionType] || "bg-secondary text-foreground"
                            }`}
                          >
                            {q.questionType}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimeAgo(q.askedAt)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{q.question}</p>
                      </div>
                    </div>

                    {answeringId === q.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Type your response..."
                          className="w-full text-sm border border-border rounded-md p-2 bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleAnswerSubmit}
                            disabled={!answerText.trim() || submitting}
                            className="text-xs"
                          >
                            {submitting ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3 mr-1" />
                            )}
                            Send
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAnsweringId(null);
                              setAnswerText("");
                            }}
                            className="text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAnsweringId(q.id)}
                        className="mt-1 text-xs text-primary"
                      >
                        Answer
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
