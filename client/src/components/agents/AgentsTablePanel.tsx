import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  Bot,
  Plus,
  Import as ImportIcon,
  MessageSquare,
  Pencil,
  Trash2,
  Activity,
  Archive,
  Clock,
  RotateCcw,
  Zap,
  MoveRight,
  Ban,
} from "lucide-react";
import type { Agent } from "@/hooks/useAgents";

interface Tactic {
  id: string;
  attackId: string;
  name: string;
}

interface Tool {
  id: string;
  name: string;
  category: string;
}

interface AgentsTablePanelProps {
  agents: Agent[];
  tactics: Tactic[];
  tools: Tool[];
  searchQuery?: string;
  onNewAgent?: () => void;
  onImportAgent?: () => void;
  onRestoreBackups?: () => void;
  onChatAgent?: (agent: Agent) => void;
  onEditAgent?: (agent: Agent) => void;
  onDeleteAgent?: (agentId: string) => void;
  onAssignTactic?: (agentId: string, tacticId: string) => void;
  onRemoveTactic?: (agentId: string) => void;
  onStartLoop?: (agentId: string) => void;
}

/**
 * v2.9.3 — operator surface for AI Agents, mirrored from DefaultServersPanel.
 *
 * Each agent is a collapsible row. Header row shows name + type + status pill;
 * click to expand the detail row, which contains tactic management dropdowns,
 * capability text, enabled-tools list, loop config, stats, and the action bar
 * (Chat / Edit / Delete / Start Loop).
 */
export function AgentsTablePanel({
  agents,
  tactics,
  tools,
  searchQuery = "",
  onNewAgent,
  onImportAgent,
  onRestoreBackups,
  onChatAgent,
  onEditAgent,
  onDeleteAgent,
  onAssignTactic,
  onRemoveTactic,
  onStartLoop,
}: AgentsTablePanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(agentId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredAgents = useMemo(() => {
    if (normalizedQuery.length === 0) return agents;
    return agents.filter((a) =>
      [a.name, a.type, a.status, a.tactic?.name ?? "", a.tactic?.attackId ?? ""]
        .some((s) => s.toLowerCase().includes(normalizedQuery)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, normalizedQuery]);

  const counts = useMemo(() => {
    let running = 0;
    for (const a of agents) {
      if (a.status === "running") running += 1;
    }
    return { total: agents.length, running };
  }, [agents]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle>AI Agents</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.total} agent{counts.total === 1 ? "" : "s"}
            {counts.running > 0 && <> · {counts.running} running</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRestoreBackups && (
            <Button variant="outline" size="sm" onClick={onRestoreBackups} title="View backups & restore">
              <Archive className="h-4 w-4 mr-2" />
              Backups
            </Button>
          )}
          {onNewAgent && (
            <Button variant="outline" size="sm" onClick={onNewAgent}>
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          )}
          {onImportAgent && (
            <Button size="sm" onClick={onImportAgent}>
              <ImportIcon className="h-4 w-4 mr-2" />
              Import Agent
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAgents.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="py-12 text-center text-muted-foreground">
                  {normalizedQuery.length > 0 ? (
                    <>
                      <p className="text-sm">No agents match &quot;{searchQuery}&quot;</p>
                      <p className="text-xs mt-1">Clear the filter to see the full list.</p>
                    </>
                  ) : (
                    <>
                      <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No AI agents configured</p>
                      <p className="text-xs mt-1">Use New Agent or Import Agent above to add one.</p>
                    </>
                  )}
                </TableCell>
              </TableRow>
            )}
            {filteredAgents.map((agent) => {
              const isOpen = expanded.has(agent.id);
              const config = agent.config as Record<string, unknown> | undefined;
              const loopEnabled = Boolean(config?.loopEnabled);
              const loopPartnerId = config?.loopPartnerId as string | undefined;
              const loopPartner = loopEnabled && loopPartnerId
                ? agents.find((a) => a.id === loopPartnerId)
                : null;
              const enabledTools = (config?.enabledTools as string[] | undefined) ?? [];

              return (
                <Fragment key={agent.id}>
                  <TableRow
                    onClick={() => toggleRow(agent.id)}
                    className="cursor-pointer hover:bg-secondary/40"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Bot className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {agent.type}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <AgentStatusBadge status={agent.status} />
                    </TableCell>
                  </TableRow>

                  {isOpen && (
                    <TableRow
                      key={`${agent.id}-details`}
                      className="bg-secondary/20 hover:bg-secondary/20"
                    >
                      <TableCell colSpan={2} className="py-4">
                        <div className="space-y-4">
                          {/* Tactic */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {agent.tactic ? (
                              <Badge
                                variant="secondary"
                                className="bg-amber-500/10 text-amber-600 text-xs"
                              >
                                {agent.tactic.attackId} — {agent.tactic.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No tactic assigned
                              </span>
                            )}

                            <div className="ml-auto flex items-center gap-1">
                              {!agent.tactic && onAssignTactic && tactics.length > 0 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      title="Assign to tactic"
                                    >
                                      <Plus className="h-4 w-4 text-green-600" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {tactics.map((t) => (
                                      <DropdownMenuItem
                                        key={t.id}
                                        onClick={() => onAssignTactic(agent.id, t.id)}
                                      >
                                        {t.attackId} — {t.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {agent.tactic && onAssignTactic && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      title="Move to different tactic"
                                    >
                                      <MoveRight className="h-4 w-4 text-blue-600" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {tactics
                                      .filter((t) => t.id !== agent.tactic?.tacticId)
                                      .map((t) => (
                                        <DropdownMenuItem
                                          key={t.id}
                                          onClick={() => onAssignTactic(agent.id, t.id)}
                                        >
                                          {t.attackId} — {t.name}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {agent.tactic && onRemoveTactic && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  title="Remove from tactic"
                                  onClick={() => onRemoveTactic(agent.id)}
                                >
                                  <Ban className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Capabilities */}
                          <div className="p-3 bg-secondary/40 rounded">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                              Capabilities
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {capabilityText(agent.type)}
                            </p>
                          </div>

                          {/* Tools enabled */}
                          {enabledTools.length > 0 && (
                            <div className="p-3 bg-indigo-500/5 rounded border-l-4 border-indigo-600">
                              <div className="flex items-center gap-2 mb-2">
                                <Zap className="h-4 w-4 text-indigo-600" />
                                <div className="text-xs uppercase tracking-wide text-foreground">
                                  Tools enabled
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                {enabledTools.slice(0, 3).map((toolId) => {
                                  const tool = tools.find((t) => t.id === toolId);
                                  return tool ? (
                                    <div key={toolId}>
                                      • {tool.name} ({tool.category.replace(/_/g, " ")})
                                    </div>
                                  ) : null;
                                })}
                                {enabledTools.length > 3 && (
                                  <div className="text-indigo-600 font-medium">
                                    + {enabledTools.length - 3} more tools
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Loop config */}
                          {loopEnabled && loopPartner && (
                            <div className="p-3 bg-blue-500/5 rounded border-l-4 border-blue-600">
                              <div className="flex items-center gap-2 mb-2">
                                <RotateCcw className="h-4 w-4 text-blue-600" />
                                <div className="text-xs uppercase tracking-wide text-foreground">
                                  Loop enabled
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Partner: {loopPartner.name}</div>
                                <div>
                                  Max iterations: {(config?.maxLoopIterations as number | undefined) ?? 5}
                                </div>
                                <div>
                                  Exit: {(config?.loopExitCondition as string | undefined) ?? "functional_poc"}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center text-muted-foreground">
                              <Activity className="h-4 w-4 mr-2" />
                              <span>{agent.tasksCompleted ?? 0} tasks</span>
                            </div>
                            {agent.lastActivity && (
                              <div className="flex items-center text-muted-foreground">
                                <Clock className="h-4 w-4 mr-2" />
                                <span>{new Date(agent.lastActivity).toLocaleTimeString()}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            {loopEnabled && loopPartner && onStartLoop && (
                              <Button size="sm" onClick={() => onStartLoop(agent.id)}>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Start Loop
                              </Button>
                            )}
                            {onChatAgent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onChatAgent(agent)}
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Chat
                              </Button>
                            )}
                            {onEditAgent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEditAgent(agent)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            {onDeleteAgent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDeleteAgent(agent.id)}
                                className="hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function capabilityText(type: string): string {
  switch (type) {
    case "openai":
    case "anthropic":
      return "Advanced reasoning, vulnerability analysis, comprehensive reporting, ethical assessment";
    case "ollama":
      return "Local / self-hosted inference via the configured Ollama host (private workloads, on-prem, or remote GPU)";
    case "mcp_server":
      return "Tool integration, automated workflows, external service connectivity";
    case "custom":
      return "Custom AI processing and analysis";
    default:
      return "Custom AI processing and analysis";
  }
}

function AgentStatusBadge({ status }: { status: string }) {
  if (status === "running") {
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-200">
        Running
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge className="bg-red-500/10 text-red-600 border-red-200">Error</Badge>
    );
  }
  if (status === "idle") {
    return <Badge variant="outline">Idle</Badge>;
  }
  return <Badge variant="outline">{status || "stopped"}</Badge>;
}
