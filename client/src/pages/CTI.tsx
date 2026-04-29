import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Radar,
  Rss,
  ShieldAlert,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

type SourceKind = "rss" | "taxii" | "json" | "atom" | "github";

interface CtiSource {
  id: string;
  name: string;
  kind: SourceKind;
  url: string;
  collection: string | null;
  enabled: boolean;
  cadenceSeconds: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

interface CtiItem {
  id: string;
  sourceId: string;
  externalId: string;
  title: string | null;
  summary: string | null;
  link: string | null;
  publishedAt: string | null;
  tags: string[] | null;
}

interface SearchResult extends CtiItem {
  distance: number;
}

interface KnowledgeStats {
  sources: number;
  items: number;
  itemsEmbedded: number;
  embeddingDim: number;
}

export default function CTI() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-purple-100 p-3 rounded-lg">
          <Radar className="h-8 w-8 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cyber Threat Intelligence</h1>
          <p className="text-muted-foreground">
            Vectorized CTI feeds, indicators, and semantic search
          </p>
        </div>
      </div>

      <Tabs defaultValue="feeds" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="feeds" className="flex items-center gap-2">
            <Rss className="h-4 w-4" />
            <span>Feeds</span>
          </TabsTrigger>
          <TabsTrigger value="indicators" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>Indicators</span>
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Search</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feeds" className="mt-0">
          <FeedsTab />
        </TabsContent>
        <TabsContent value="indicators" className="mt-0">
          <IndicatorsTab />
        </TabsContent>
        <TabsContent value="search" className="mt-0">
          <SearchTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Feeds tab
// ============================================================================

function FeedsTab() {
  const { isAdmin } = useAuth();
  const canEdit = isAdmin();
  const [sources, setSources] = useState<CtiSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ sources: CtiSource[] }>("/cti/sources");
      setSources(data.sources);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load CTI sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRefreshSource(id: string) {
    setRefreshing(id);
    try {
      const result = await api.post<{
        seen: number;
        inserted: number;
        updated: number;
        error?: string;
      }>(`/cti/sources/${id}/refresh`);
      if (result.error) {
        toast.error(`Refresh: ${result.error}`);
      } else {
        toast.success(`Refresh: ${result.inserted} new, ${result.updated} updated`);
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this CTI source and all its items?")) return;
    try {
      await api.delete(`/cti/sources/${id}`);
      toast.success("Source deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sources.length} source{sources.length === 1 ? "" : "s"} configured.
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Add Source
          </Button>
        )}
      </div>

      {loading && sources.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : sources.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center justify-center text-center">
          <Rss className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No feeds configured</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Add a TAXII or RSS source above to start ingesting CTI items.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              canEdit={canEdit}
              refreshing={refreshing === s.id}
              onRefresh={() => handleRefreshSource(s.id)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <AddSourceDialog
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function SourceRow({
  source,
  canEdit,
  refreshing,
  onRefresh,
  onDelete,
}: {
  source: CtiSource;
  canEdit: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const lastRun = source.lastRunAt
    ? new Date(source.lastRunAt).toLocaleString()
    : "Never";
  const statusColor =
    source.lastRunStatus === "ok"
      ? "bg-green-500/10 text-green-700 dark:text-green-300"
      : source.lastRunStatus === "failed"
        ? "bg-red-500/10 text-red-700 dark:text-red-300"
        : "bg-muted text-muted-foreground";

  return (
    <div className="border border-border rounded-lg p-4 bg-card flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{source.name}</span>
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
            {source.kind}
          </Badge>
          {source.lastRunStatus && (
            <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 ${statusColor}`}>
              {source.lastRunStatus}
            </Badge>
          )}
          {!source.enabled && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Disabled
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{source.url}</p>
        {source.collection && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Collection: <code className="font-mono">{source.collection}</code>
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Cadence: {source.cadenceSeconds}s · Last run: {lastRun}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={onRefresh}
          disabled={refreshing || !canEdit}
        >
          {refreshing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Refresh
        </Button>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-red-600 hover:text-red-700"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function AddSourceDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SourceKind>("rss");
  const [url, setUrl] = useState("");
  const [collection, setCollection] = useState("");
  const [cadence, setCadence] = useState("3600");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name || !url) {
      toast.error("Name and URL required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/cti/sources", {
        name,
        kind,
        url,
        collection: kind === "taxii" ? collection || undefined : undefined,
        cadenceSeconds: Math.max(60, Number(cadence) || 3600),
      });
      toast.success("Source created");
      onCreated();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add CTI Source</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MITRE ATT&CK TAXII" />
          </div>
          <div>
            <Label className="text-xs">Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SourceKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rss">RSS / Atom</SelectItem>
                <SelectItem value="taxii">TAXII 2.1</SelectItem>
                <SelectItem value="json">JSON (planned)</SelectItem>
                <SelectItem value="github">GitHub (planned)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                kind === "taxii"
                  ? "https://cti-taxii.mitre.org/taxii/api/v21"
                  : "https://example.com/feed.xml"
              }
              className="font-mono text-xs"
            />
          </div>
          {kind === "taxii" && (
            <div>
              <Label className="text-xs">Collection ID</Label>
              <Input
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="95ecc380-afe9-11e4-9b6c-751b66dd541e"
                className="font-mono text-xs"
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Cadence (seconds)</Label>
            <Input value={cadence} onChange={(e) => setCadence(e.target.value)} type="number" min={60} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Indicators tab
// ============================================================================

function IndicatorsTab() {
  const [items, setItems] = useState<CtiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
      if (filter) params.q = filter;
      const data = await api.get<{ items: CtiItem[] }>("/cti/items", { params });
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter by title or summary (keyword)…"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setOffset(0);
          }}
          className="max-w-md"
        />
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No indicators ingested yet. Add a feed and run a refresh.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <ItemRow key={it.id} item={it} />
          ))}
          <div className="flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {offset + 1}–{offset + items.length}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOffset((o) => o + limit)}
              disabled={items.length < limit}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: CtiItem }) {
  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground line-clamp-2">{item.title || "(untitled)"}</p>
          {item.summary && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.summary}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.publishedAt && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(item.publishedAt).toLocaleString()}
              </span>
            )}
            {item.tags?.slice(0, 6).map((t, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] py-0 px-1.5 bg-muted/70 text-muted-foreground"
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Search tab
// ============================================================================

function SearchTab() {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api
      .get<KnowledgeStats>("/knowledge/stats")
      .then(setStats)
      .catch(() => {
        // Stats are decorative; failures shouldn't block the panel.
      });
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await api.post<{ results: SearchResult[] }>("/knowledge/search", {
        q: query.trim(),
        k: 25,
      });
      setResults(data.results);
      if (data.results.length === 0) {
        toast.info("No matches.");
      }
    } catch (err: any) {
      const code = err?.data?.error;
      if (code === "no_embedding_provider") {
        toast.error("Configure RTPI_EMBEDDING_PROVIDER + EMBEDDING_MODEL to enable search.");
      } else if (code === "dimension_mismatch") {
        toast.error(err?.data?.message || "Embedding model dimension mismatch — pick a 1536-dim model.");
      } else {
        toast.error(err?.data?.message || err?.message || "Search failed");
      }
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="bg-muted/30 rounded-md border border-border p-3 text-xs text-muted-foreground flex flex-wrap gap-4">
          <span>
            Items: <code className="font-mono">{stats.items}</code>
          </span>
          <span>
            Embedded: <code className="font-mono">{stats.itemsEmbedded}</code>
          </span>
          <span>
            Sources: <code className="font-mono">{stats.sources}</code>
          </span>
          <span>
            Embedding dim: <code className="font-mono">{stats.embeddingDim}</code>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Semantic query… e.g. 'phishing campaigns targeting financial institutions'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
          Search
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {results.length} result{results.length === 1 ? "" : "s"} (sorted by cosine distance)
          </p>
          {results.map((r) => (
            <div key={r.id} className="border border-border rounded-md p-3 bg-card">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground line-clamp-1">
                      {r.title || "(untitled)"}
                    </span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                      d={r.distance.toFixed(3)}
                    </Badge>
                  </div>
                  {r.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{r.summary}</p>
                  )}
                </div>
                {r.link && (
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
