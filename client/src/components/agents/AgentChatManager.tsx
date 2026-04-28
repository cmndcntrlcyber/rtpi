import { useAgentChatManager } from "@/contexts/AgentChatContext";
import AgentFloatingChat from "./AgentFloatingChat";

export default function AgentChatManager() {
  const { activeChats, closeAgentChat } = useAgentChatManager();

  if (activeChats.length === 0) return null;

  return (
    <>
      {activeChats.map((chat, index) => (
        <AgentFloatingChat
          key={chat.agentId}
          agentId={chat.agentId}
          agentName={chat.agentName}
          agentRole={chat.agentRole}
          onClose={() => closeAgentChat(chat.agentId)}
          offsetIndex={index}
        />
      ))}
    </>
  );
}
