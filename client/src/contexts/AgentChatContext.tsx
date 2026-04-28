import { createContext, useContext, useState, ReactNode } from "react";

export interface ActiveAgentChat {
  agentId: string;
  agentName: string;
  agentRole: string;
}

interface AgentChatContextType {
  activeChats: ActiveAgentChat[];
  openAgentChat: (agentId: string, agentName: string, agentRole: string) => void;
  closeAgentChat: (agentId: string) => void;
}

const AgentChatContext = createContext<AgentChatContextType | undefined>(undefined);

export function AgentChatProvider({ children }: { children: ReactNode }) {
  const [activeChats, setActiveChats] = useState<ActiveAgentChat[]>([]);

  const openAgentChat = (agentId: string, agentName: string, agentRole: string) => {
    setActiveChats((prev) => {
      if (prev.some((chat) => chat.agentId === agentId)) {
        return prev;
      }
      return [...prev, { agentId, agentName, agentRole }];
    });
  };

  const closeAgentChat = (agentId: string) => {
    setActiveChats((prev) => prev.filter((chat) => chat.agentId !== agentId));
  };

  return (
    <AgentChatContext.Provider
      value={{
        activeChats,
        openAgentChat,
        closeAgentChat,
      }}
    >
      {children}
    </AgentChatContext.Provider>
  );
}

export function useAgentChatManager() {
  const context = useContext(AgentChatContext);
  if (context === undefined) {
    throw new Error("useAgentChatManager must be used within an AgentChatProvider");
  }
  return context;
}
