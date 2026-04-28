import { useState, useRef, useEffect } from "react";
import { Bot, X, Minus, Send, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentChat } from "@/hooks/useAgentChat";
import { toast } from "sonner";
import { useOperations } from "@/hooks/useOperations";

interface AgentFloatingChatProps {
  agentId: string;
  agentName: string;
  agentRole: string;
  onClose: () => void;
  offsetIndex: number;
}

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

export default function AgentFloatingChat({
  agentId,
  agentName,
  agentRole,
  onClose,
  offsetIndex,
}: AgentFloatingChatProps) {
  const { operations } = useOperations();
  
  // Try to use the first active operation, or the first available operation
  const activeOperation = operations?.find(o => o.status === "active") || operations?.[0];
  const operationId = activeOperation?.id || null;

  const {
    messages: chatMessages,
    loading: chatLoading,
    sending: sendingMessage,
    error: chatError,
    sendMessage,
    clearConversation,
  } = useAgentChat(agentRole, operationId, agentId);

  const [isOpen, setIsOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current && isOpen) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, isOpen]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !operationId) return;
    const currentInput = chatInput.trim();
    setChatInput("");
    await sendMessage(currentInput);
  };

  useEffect(() => {
    if (chatError) {
      toast.error(`Agent Chat Error: ${chatError}`);
    }
  }, [chatError]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChatMessage();
    }
  };

  // Calculate position based on offset (cascading effect)
  const rightOffset = 24 + offsetIndex * 24; // 6rem base + offset

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{ right: `${rightOffset}px`, bottom: "24px" }}
        className={`fixed z-50 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-t-lg shadow-lg hover:bg-primary/90 transition-colors border-b-0`}
        title={`Open ${agentName} Chat`}
      >
        <Bot className="h-4 w-4" />
        <span className="text-sm font-medium">{agentName}</span>
      </button>
    );
  }

  return (
    <div
      style={{ right: `${rightOffset}px`, bottom: "24px" }}
      className={`fixed z-40 w-80 max-w-[calc(100vw-3rem)] bg-card rounded-t-lg shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.3)] border border-border border-b-0 transition-all duration-300 flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="bg-primary/10 p-1.5 rounded-md flex-shrink-0">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate" title={agentName}>{agentName}</h3>
            <p className="text-[10px] text-muted-foreground truncate capitalize">{agentRole.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors"
            title="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={chatScrollRef} className="h-80 overflow-y-auto p-3 space-y-3">
        {!operationId ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No active operation.</p>
            <p className="text-xs mt-1">Agents need an operation context to chat.</p>
          </div>
        ) : chatLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary/50 mb-2" />
            <span className="text-xs text-muted-foreground">Loading history...</span>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium text-foreground">Chat with {agentName}</p>
            <p className="text-xs mt-1 opacity-80">Ask questions, request analysis, or give instructions.</p>
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-foreground rounded-tl-sm border border-border/50"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <div className="flex items-center gap-1.5 mt-1.5 justify-end">
                  {msg.provider && msg.role === "assistant" && (
                    <span className="text-[9px] opacity-60 uppercase tracking-wider">
                      {msg.provider}
                    </span>
                  )}
                  <span className="text-[9px] opacity-60">
                    {formatTimeAgo(msg.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
        {sendingMessage && (
          <div className="flex gap-2 justify-start animate-pulse">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <div className="bg-secondary rounded-lg px-4 py-2 flex items-center">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="p-3 border-t border-border bg-background rounded-b-lg">
        <div className="flex gap-2 items-end">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={operationId ? "Type a message..." : "Operation required..."}
            className="flex-1 text-sm border-0 rounded-md bg-muted/30 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary min-h-[40px] max-h-[120px] p-2.5"
            rows={1}
            disabled={sendingMessage || !operationId}
          />
          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              onClick={handleSendChatMessage}
              disabled={!chatInput.trim() || sendingMessage || !operationId}
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
            {chatMessages.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={clearConversation}
                title="Clear conversation"
                className="h-6 w-10 text-muted-foreground hover:text-destructive shrink-0 mt-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
