import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
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
  Loader2,
  RefreshCw,
  Settings2,
  RotateCcw,
  Download,
  Pencil,
  Play,
  Square,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useMcpCatalog, type CatalogEntry } from "@/hooks/useMcpCatalog";
import type { MCPServer } from "@/hooks/useMCPServers";
import { ConfigureSecretsDialog } from "./ConfigureSecretsDialog";

interface DefaultServersPanelProps {
  /**
   * Called after sync/reset/configure mutations so the parent's
   * `useMCPServers().refetch()` can refresh the existing server list.
   */
  onChange?: () => void;
  /** Open the parent's edit dialog for the given server row. */
  onEditServer?: (serverId: string) => void;
  /** Start the given server row via the parent's handler. */
  onStartServer?: (serverId: string) => void;
  /** Stop a running server row. */
  onStopServer?: (serverId: string) => void;
  /**
   * Delete the given server row. For managed rows the panel pre-confirms with
   * managed-row language and passes force=true; for user rows it passes
   * force=false (the backend's managed guard only triggers on seedKey rows).
   */
  onDeleteServer?: (serverId: string, force: boolean) => void;
  /** Open the parent's "Add MCP Server" dialog. Renders a button in the header. */
  onAddServer?: () => void;
  /**
   * Bulk-start every installed row whose status is not "running". The parent
   * is responsible for the actual API calls + summary toast; the panel just
   * gathers eligible IDs and renders the trigger button.
   */
  onStartAll?: (serverIds: string[]) => Promise<void>;
  /**
   * User-created MCP server rows (no seed_key). Rendered after the catalog
   * group with a "Custom servers" divider. Pass `mcpServers.filter(s => !s.seedKey)`
   * from the parent.
   */
  userServers?: MCPServer[];
  /**
   * Free-text filter shared with the parent (Agents.tsx → AI Agents tab).
   * Matches against catalog entry name + seedKey + command, and user server
   * name + command. Empty/whitespace = no filter.
   */
  searchQuery?: string;
}

/**
 * v2.9.3 Phase 4 — operator surface for the built-in MCP catalog.
 *
 * Lists every entry in `DEFAULT_MCP_CATALOG` (server-side) with status pills
 * (Installed / Needs config / Not installed) and per-row actions for
 * install/sync, configure-secrets, and reset-to-defaults. User-created MCP
 * rows are managed by the parent's existing UI; this panel is exclusively
 * for the managed catalog.
 *
 * Hidden when `loading=false && entries.length === 0`, which is what the
 * server returns when FF_DEFAULT_MCP_SERVERS is off — keeps the page clean
 * for deployments that haven't opted in.
 */
export function DefaultServersPanel({
  onChange,
  onEditServer,
  onStartServer,
  onStopServer,
  onDeleteServer,
  onAddServer,
  onStartAll,
  userServers = [],
  searchQuery = "",
}: DefaultServersPanelProps) {
  const { entries, loading, error, sync, reset, configure } = useMcpCatalog();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [startingAll, setStartingAll] = useState(false);
  const [configEntry, setConfigEntry] = useState<CatalogEntry | null>(null);
  // Set of row keys whose detail subrow is expanded. Collapsed by default —
  // operators see a compact name+status row and click the name to reveal
  // command + action buttons. Catalog rows key by seedKey; user rows by
  // `user:${id}` to avoid collisions with future seedKey namespaces.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(rowKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }

  // Filter both lists against the shared search query. Match is OR across
  // the searchable fields; case-insensitive; empty query passes everything.
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesQuery = (haystack: string[]): boolean => {
    if (normalizedQuery.length === 0) return true;
    return haystack.some((s) => s.toLowerCase().includes(normalizedQuery));
  };

  const filteredCatalog = useMemo(
    () =>
      entries.filter((e) =>
        matchesQuery([e.name, e.seedKey, e.command, e.args.join(" ")]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, normalizedQuery],
  );

  const filteredUserServers = useMemo(
    () =>
      userServers.filter((s) =>
        matchesQuery([s.name, s.command, s.status]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userServers, normalizedQuery],
  );

  // Eligible rows for Start all: installed (catalog) or any (user-created)
  // whose status is not already "running". We don't pre-skip needsConfig or
  // disabled-by-default rows — preflight on the server catches those with a
  // structured error so the operator can see the reason in the row's last
  // error after the bulk attempt.
  const startableIds = useMemo(() => {
    const ids: string[] = [];
    for (const entry of filteredCatalog) {
      if (entry.installed && entry.serverId && entry.status !== "running") {
        ids.push(entry.serverId);
      }
    }
    for (const s of filteredUserServers) {
      if (s.status !== "running") {
        ids.push(s.id);
      }
    }
    return ids;
  }, [filteredCatalog, filteredUserServers]);

  const counts = useMemo(() => {
    let installed = 0;
    let needsConfig = 0;
    for (const e of entries) {
      if (e.installed) installed += 1;
      if (e.needsConfig) needsConfig += 1;
    }
    return { total: entries.length, installed, needsConfig };
  }, [entries]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading default MCP catalog…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Failed to load default MCP catalog: {error}
        </CardContent>
      </Card>
    );
  }

  // Note: no early return when entries is empty — the panel now also hosts
  // user-created servers (no seedKey), the Add MCP Server button, and a
  // shared empty-state. It must render even when FF_DEFAULT_MCP_SERVERS is
  // off and the catalog is empty.

  async function runSync() {
    setSyncing(true);
    try {
      const result = await sync();
      toast.success(
        `Catalog synced: ${result.inserted} added, ${result.alreadyPresent} already present`,
      );
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function runStartAll() {
    if (!onStartAll || startableIds.length === 0) return;
    setStartingAll(true);
    try {
      await onStartAll(startableIds);
      onChange?.();
    } finally {
      setStartingAll(false);
    }
  }

  async function runReset(entry: CatalogEntry) {
    if (!entry.serverId) return;
    setBusyKey(entry.seedKey);
    try {
      await reset(entry.serverId);
      toast.success(`${entry.name} reset to catalog defaults`);
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div>
            <CardTitle>MCP Servers</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Built-in catalog · {counts.installed}/{counts.total} installed
              {counts.needsConfig > 0 && (
                <> · {counts.needsConfig} need configuration</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onAddServer && (
              <Button size="sm" onClick={onAddServer}>
                <Plus className="h-4 w-4 mr-2" />
                Add MCP Server
              </Button>
            )}
            {onStartAll && (
              <Button
                variant="outline"
                size="sm"
                onClick={runStartAll}
                disabled={startingAll || startableIds.length === 0}
                title={
                  startableIds.length === 0
                    ? "No stopped servers to start"
                    : `Start ${startableIds.length} stopped server${startableIds.length === 1 ? "" : "s"}`
                }
              >
                {startingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start all
                {startableIds.length > 0 && !startingAll && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded bg-secondary text-muted-foreground">
                    {startableIds.length}
                  </span>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={runSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync catalog
            </Button>
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
              {filteredCatalog.length === 0 && filteredUserServers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-12 text-center text-muted-foreground">
                    {normalizedQuery.length > 0 ? (
                      <>
                        <p className="text-sm">No MCP servers match &quot;{searchQuery}&quot;</p>
                        <p className="text-xs mt-1">Clear the filter to see the full list.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm">No MCP servers configured</p>
                        <p className="text-xs mt-1">
                          Use Add MCP Server above to register one, or enable
                          <code className="mx-1 px-1 bg-secondary rounded">FF_DEFAULT_MCP_SERVERS</code>
                          to seed the built-in catalog.
                        </p>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {filteredCatalog.map((entry) => {
                const busy = busyKey === entry.seedKey;
                const isOpen = expanded.has(entry.seedKey);
                return (
                  <Fragment key={entry.seedKey}>
                    {/* Header row — always visible. Click name to toggle. */}
                    <TableRow
                      onClick={() => toggleRow(entry.seedKey)}
                      className="cursor-pointer hover:bg-secondary/40"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">{entry.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {entry.seedKey}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge entry={entry} />
                      </TableCell>
                    </TableRow>

                    {/* Details row — visible only when expanded. */}
                    {isOpen && (
                      <TableRow
                        key={`${entry.seedKey}-details`}
                        className="bg-secondary/20 hover:bg-secondary/20"
                      >
                        <TableCell colSpan={2} className="py-4">
                          <div className="space-y-3">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                Command
                              </div>
                              <code className="text-xs text-muted-foreground block break-all">
                                {entry.command} {entry.args.join(" ")}
                              </code>
                            </div>

                            {entry.requiredSecrets.length > 0 && (
                              <div>
                                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                  Required secrets
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">
                                  {entry.requiredSecrets.join(", ")}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 pt-2">
                              {!entry.installed && (
                                <Button size="sm" variant="outline" onClick={runSync} disabled={syncing}>
                                  <Download className="h-3 w-3 mr-1" />
                                  Install
                                </Button>
                              )}
                              {entry.installed && entry.requiredSecrets.length > 0 && (
                                <Button
                                  size="sm"
                                  variant={entry.needsConfig ? "default" : "outline"}
                                  onClick={() => setConfigEntry(entry)}
                                  disabled={busy}
                                >
                                  <Settings2 className="h-3 w-3 mr-1" />
                                  Configure
                                </Button>
                              )}
                              {entry.installed && entry.serverId && onEditServer && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onEditServer(entry.serverId!)}
                                  disabled={busy}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                              {entry.installed &&
                                entry.serverId &&
                                entry.status !== "running" &&
                                onStartServer && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onStartServer(entry.serverId!)}
                                    disabled={busy}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Start
                                  </Button>
                                )}
                              {entry.installed &&
                                entry.serverId &&
                                entry.status === "running" &&
                                onStopServer && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onStopServer(entry.serverId!)}
                                    disabled={busy}
                                  >
                                    <Square className="h-3 w-3 mr-1" />
                                    Stop
                                  </Button>
                                )}
                              {entry.installed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => runReset(entry)}
                                  disabled={busy}
                                >
                                  {busy ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                  )}
                                  Reset
                                </Button>
                              )}
                              {entry.installed && entry.serverId && onDeleteServer && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const confirmMsg =
                                      `Delete the managed default "${entry.name}"?\n\n` +
                                      `This is a built-in catalog row. Use Reset instead if you ` +
                                      `just want to restore catalog defaults. To delete anyway, ` +
                                      `the row will be removed with force=true and re-seeded on ` +
                                      `the next catalog sync.`;
                                    if (window.confirm(confirmMsg)) {
                                      onDeleteServer(entry.serverId!, true);
                                    }
                                  }}
                                  disabled={busy}
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

              {/* Custom servers section — only rendered when there are
                  user-created (non-seedKey) rows. Same toggle behavior as
                  catalog rows; simpler action bar (no Configure / Reset). */}
              {filteredUserServers.length > 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={2}
                    className="py-2 px-3 text-xs uppercase tracking-wide text-muted-foreground bg-secondary/30"
                  >
                    Custom servers
                  </TableCell>
                </TableRow>
              )}
              {filteredUserServers.map((server) => {
                const rowKey = `user:${server.id}`;
                const isOpen = expanded.has(rowKey);
                return (
                  <Fragment key={rowKey}>
                    <TableRow
                      onClick={() => toggleRow(rowKey)}
                      className="cursor-pointer hover:bg-secondary/40"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">{server.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Custom MCP server
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserServerStatusBadge status={server.status} />
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow
                        key={`${rowKey}-details`}
                        className="bg-secondary/20 hover:bg-secondary/20"
                      >
                        <TableCell colSpan={2} className="py-4">
                          <div className="space-y-3">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                Command
                              </div>
                              <code className="text-xs text-muted-foreground block break-all">
                                {server.command} {(server.args ?? []).join(" ")}
                              </code>
                            </div>
                            {server.lastError && (
                              <div>
                                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                  Last error
                                </div>
                                <code className="text-xs text-destructive block break-all">
                                  {server.lastError}
                                </code>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 pt-2">
                              {onEditServer && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onEditServer(server.id)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                              {server.status !== "running" && onStartServer && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onStartServer(server.id)}
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Start
                                </Button>
                              )}
                              {server.status === "running" && onStopServer && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onStopServer(server.id)}
                                >
                                  <Square className="h-3 w-3 mr-1" />
                                  Stop
                                </Button>
                              )}
                              {onDeleteServer && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Delete the MCP server "${server.name}"?`,
                                      )
                                    ) {
                                      onDeleteServer(server.id, false);
                                    }
                                  }}
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

      <ConfigureSecretsDialog
        open={configEntry !== null}
        onOpenChange={(open) => {
          if (!open) setConfigEntry(null);
        }}
        entry={configEntry}
        onConfigure={async (serverId, env) => {
          await configure(serverId, env);
          onChange?.();
        }}
      />
    </>
  );
}

function StatusBadge({ entry }: { entry: CatalogEntry }) {
  if (!entry.installed) {
    return <Badge variant="outline">Not installed</Badge>;
  }
  if (entry.needsConfig) {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
        Needs config
      </Badge>
    );
  }
  if (entry.status === "running") {
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-200">
        Running
      </Badge>
    );
  }
  if (entry.status === "error") {
    return (
      <Badge className="bg-red-500/10 text-red-600 border-red-200">Error</Badge>
    );
  }
  return (
    <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
      Installed
    </Badge>
  );
}

function UserServerStatusBadge({ status }: { status: string }) {
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
  return <Badge variant="outline">{status || "stopped"}</Badge>;
}
