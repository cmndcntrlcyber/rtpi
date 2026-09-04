import { useState } from "react";
import { Server, Plus, X, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAgents } from "@/hooks/useAgents";
import { useMCPServers } from "@/hooks/useMCPServers";

/**
 * Agent ↔ MCP attachment manager. Drives the same endpoints as the agent edit
 * dialog (POST /agents/:id/mcp/attach, DELETE /agents/:id/mcp/:serverId) so the
 * canvas surface and the dialog stay consistent.
 */
export default function AgentMcpPanel() {
  const { agents, refetch: refetchAgents } = useAgents();
  const { servers } = useMCPServers();
  const [query, setQuery] = useState("");
  const [pendingByAgent, setPendingByAgent] = useState<Record<string, string>>({});

  const serverName = (id: string) => servers.find((s) => s.id === id)?.name || id.slice(0, 8);
  const runningServers = servers.filter((s) => s.status === "running");

  const attach = async (agentId: string) => {
    const serverId = pendingByAgent[agentId];
    if (!serverId) return;
    try {
      await api.post(`/agents/${agentId}/mcp/attach`, { mcpServerId: serverId });
      toast.success("MCP server attached");
      setPendingByAgent((p) => ({ ...p, [agentId]: "" }));
      await refetchAgents();
    } catch (err: any) {
      toast.error(err?.message || "Failed to attach");
    }
  };

  const detach = async (agentId: string, serverId: string) => {
    try {
      await api.delete(`/agents/${agentId}/mcp/${serverId}`);
      toast.success("MCP server detached");
      await refetchAgents();
    } catch (err: any) {
      toast.error(err?.message || "Failed to detach");
    }
  };

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search agents…"
        className="h-8 text-xs"
      />
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {filtered.map((a) => {
          const attached: string[] = a.config?.mcpServerIds || [];
          return (
            <div key={a.id} className="border border-border rounded p-2 text-xs">
              <div className="flex items-center gap-1.5 mb-1.5 font-medium">
                <Bot className="h-3.5 w-3.5 text-blue-600" />
                <span className="truncate">{a.name}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {attached.length === 0 ? (
                  <span className="text-muted-foreground">No MCP servers attached</span>
                ) : (
                  attached.map((sid, i) => (
                    <Badge key={sid} variant="outline" className="text-[10px] gap-1">
                      <Server className="h-3 w-3" />
                      {serverName(sid)}
                      {i === 0 && <span className="text-emerald-600">·primary</span>}
                      <button onClick={() => detach(a.id, sid)} title="Detach">
                        <X className="h-3 w-3 text-red-500" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex items-center gap-1">
                <Select
                  value={pendingByAgent[a.id] || ""}
                  onValueChange={(v) => setPendingByAgent((p) => ({ ...p, [a.id]: v }))}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Attach server…" />
                  </SelectTrigger>
                  <SelectContent>
                    {runningServers
                      .filter((s) => !attached.includes(s.id))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => attach(a.id)} disabled={!pendingByAgent[a.id]}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
