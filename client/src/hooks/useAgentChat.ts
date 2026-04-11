import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  agentRole: string;
  operationId: string;
  messageCount: number;
  totalTokensUsed: number;
  lastMessageAt: string | null;
  createdAt: string;
}

interface SendMessageResponse {
  conversationId: string;
  message: {
    id: string;
    role: "assistant";
    content: string;
    createdAt: string;
  };
  provider: string;
  model: string;
  tokensUsed: number;
}

export function useAgentChat(agentRole: string, operationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  // Load existing conversation when operationId changes
  useEffect(() => {
    if (!operationId) {
      setMessages([]);
      setConversationId(null);
      loadedRef.current = null;
      return;
    }

    // Avoid reloading the same conversation
    const key = `${agentRole}:${operationId}`;
    if (loadedRef.current === key) return;

    const loadConversation = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<{
          conversation: Conversation | null;
          messages: ChatMessage[];
        }>(`/agent-chat/${agentRole}/conversation`, {
          params: { operationId },
        });

        if (data.conversation) {
          setConversationId(data.conversation.id);
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              provider: m.provider,
              model: m.model,
              tokensUsed: m.tokensUsed,
              createdAt: m.createdAt,
            }))
          );
        } else {
          setConversationId(null);
          setMessages([]);
        }
        loadedRef.current = key;
      } catch (err: any) {
        console.error("Failed to load conversation:", err);
        // Don't show error for missing conversations — just start fresh
        setMessages([]);
        setConversationId(null);
        loadedRef.current = key;
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [agentRole, operationId]);

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!operationId || !content.trim()) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setSending(true);
      setError(null);

      try {
        const data = await api.post<SendMessageResponse>(
          `/agent-chat/${agentRole}/message`,
          {
            operationId,
            message: content.trim(),
            conversationId: conversationId || undefined,
          }
        );

        setConversationId(data.conversationId);

        const assistantMessage: ChatMessage = {
          id: data.message.id,
          role: "assistant",
          content: data.message.content,
          provider: data.provider,
          model: data.model,
          tokensUsed: data.tokensUsed,
          createdAt: data.message.createdAt,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: any) {
        setError(err.message || "Failed to send message");
        // Remove the optimistic user message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setSending(false);
      }
    },
    [agentRole, operationId, conversationId]
  );

  // Clear conversation (archive and start fresh)
  const clearConversation = useCallback(async () => {
    if (!operationId) return;

    try {
      await api.delete(`/agent-chat/${agentRole}/conversation`, {
        operationId,
      });
      setMessages([]);
      setConversationId(null);
      loadedRef.current = null; // Allow reload
    } catch (err: any) {
      setError(err.message || "Failed to clear conversation");
    }
  }, [agentRole, operationId]);

  return {
    messages,
    conversationId,
    loading,
    sending,
    error,
    sendMessage,
    clearConversation,
  };
}
