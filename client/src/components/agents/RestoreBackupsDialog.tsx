import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Archive, RotateCcw, History, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface SnapshotMeta {
  snapshotId: string;
  snapshotTime: string;
  trigger: string;
}

interface BackupListEntry {
  agentName: string;
  slug: string;
  latestSnapshotTime: string | null;
  snapshots: SnapshotMeta[];
}

interface RestoreResult {
  agentName: string;
  action: "updated" | "created" | "skipped";
  agentId: string | null;
  snapshotId: string;
  restored: { config: boolean; tactics: number; mcp: number };
  errors: string[];
}

interface RestoreBackupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored?: () => void;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function RestoreBackupsDialog({
  open,
  onOpenChange,
  onRestored,
}: RestoreBackupsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<BackupListEntry[]>([]);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [restoreAllBusy, setRestoreAllBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState<RestoreResult[] | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.get<BackupListEntry[]>("/agents/admin/backups");
      setEntries(
        Array.isArray(data)
          ? [...data].sort((a, b) => a.agentName.localeCompare(b.agentName))
          : []
      );
    } catch (err) {
      toast.error(
        `Failed to load backups: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setBulkResults(null);
      refresh();
    }
  }, [open]);

  async function restoreOne(agentName: string, snapshotId?: string) {
    setBusySlug(agentName);
    try {
      const result = await api.post<RestoreResult>("/agents/admin/restore", {
        agentName,
        snapshotId,
      });
      const errorSuffix =
        result.errors.length > 0 ? ` (${result.errors.length} warnings)` : "";
      toast.success(
        `Restored ${result.agentName}: config + ${result.restored.tactics} tactics + ${result.restored.mcp} MCP${errorSuffix}`
      );
      onRestored?.();
    } catch (err) {
      toast.error(
        `Restore failed for ${agentName}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setBusySlug(null);
    }
  }

  async function restoreAll() {
    if (!window.confirm(`Restore latest snapshot for all ${entries.length} agents?`)) {
      return;
    }
    setRestoreAllBusy(true);
    setBulkResults(null);
    try {
      const { results } = await api.post<{ results: RestoreResult[] }>(
        "/agents/admin/restore-all",
        {}
      );
      setBulkResults(results);
      const okCount = results.filter(
        (r) => r.action !== "skipped" && r.errors.length === 0
      ).length;
      toast.success(`Restore-all complete: ${okCount}/${results.length} clean`);
      onRestored?.();
    } catch (err) {
      toast.error(
        `Restore-all failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setRestoreAllBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Agent Backups
          </DialogTitle>
          <DialogDescription>
            Automatic snapshots are written every time an agent is edited
            (config, tactic, or MCP attachment). Restore by name — works even
            after a DB reset.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${entries.length} agent${entries.length === 1 ? "" : "s"} with snapshots`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={restoreAll}
              disabled={loading || restoreAllBusy || entries.length === 0}
            >
              {restoreAllBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Restore All (Latest)
            </Button>
          </div>
        </div>

        {bulkResults && (
          <div className="mb-4 rounded border bg-muted/40 p-3 text-xs">
            <div className="font-medium mb-2">Restore-all results</div>
            <ul className="space-y-1">
              {bulkResults.map((r) => (
                <li key={r.agentName} className="flex items-center gap-2">
                  <Badge
                    variant={r.action === "skipped" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {r.action}
                  </Badge>
                  <span>{r.agentName}</span>
                  <span className="text-muted-foreground">
                    config={String(r.restored.config)} · tactics={r.restored.tactics} ·
                    mcp={r.restored.mcp}
                    {r.errors.length > 0 && ` · ${r.errors.length} warning(s)`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Latest snapshot</TableHead>
              <TableHead className="text-right">Snapshots</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No snapshots yet. Edit any agent and a backup will appear here.
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <>
                <TableRow key={entry.slug}>
                  <TableCell className="font-medium">{entry.agentName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(entry.latestSnapshotTime)}
                  </TableCell>
                  <TableCell className="text-right">{entry.snapshots.length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setExpandedSlug(expandedSlug === entry.slug ? null : entry.slug)
                        }
                        title="View history"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => restoreOne(entry.agentName)}
                        disabled={busySlug === entry.agentName}
                      >
                        {busySlug === entry.agentName ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-1" />
                        )}
                        Restore latest
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedSlug === entry.slug && (
                  <TableRow key={`${entry.slug}-history`} className="bg-muted/30">
                    <TableCell colSpan={4} className="py-3">
                      <div className="text-xs font-medium mb-2">History</div>
                      <ul className="space-y-1">
                        {entry.snapshots.map((s) => (
                          <li
                            key={s.snapshotId}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {s.trigger}
                              </Badge>
                              <span>{formatRelativeTime(s.snapshotTime)}</span>
                              <span className="text-muted-foreground font-mono">
                                {s.snapshotId}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => restoreOne(entry.agentName, s.snapshotId)}
                              disabled={busySlug === entry.agentName}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restore this
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
