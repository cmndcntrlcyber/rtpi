import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Database,
  Search,
  Plus,
  Trash2,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

/**
 * Status payload from GET /api/v1/offsec-rd/knowledge/status. When `ready` is
 * true the install banner is hidden and the readiness chip is shown instead.
 */
interface KnowledgeStatus {
  ready: boolean;
  pgvectorInstalled: boolean;
  tableExists: boolean;
  embeddingReady: boolean;
  totalArticles: number;
  categoryCount?: number;
  pocCount?: number;
  techniqueCount?: number;
}

interface Article {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  category: string;
  tags: string[] | null;
  contentType: string | null;
  sourceUrl: string | null;
  author: string | null;
  attackTactics: string[] | null;
  attackTechniques: string[] | null;
  createdAt: string | null;
  similarity?: number | null;
  source?: string;
}

const CONTENT_TYPES = ["article", "tutorial", "paper", "poc", "tool_doc", "technique"];

export default function KnowledgeBaseTab() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [statusError, setStatusError] = useState(false);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [preview, setPreview] = useState<Article | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    contentType: "article",
    summary: "",
    content: "",
    tags: "",
    sourceUrl: "",
  });

  const fetchStatus = () => {
    fetch("/api/v1/offsec-rd/knowledge/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => setStatus(data as KnowledgeStatus))
      .catch(() => setStatusError(true));
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 50 };
      if (search.trim()) params.search = search.trim();
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (typeFilter !== "all") params.contentType = typeFilter;
      const res = await api.get<{ articles: Article[] }>("/offsec-rd/knowledge", { params });
      setArticles(res.articles || []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load articles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.category.trim()) {
      toast.error("Title, category, and content are required");
      return;
    }
    setCreating(true);
    try {
      await api.post("/offsec-rd/knowledge", {
        title: form.title.trim(),
        category: form.category.trim(),
        contentType: form.contentType,
        summary: form.summary || undefined,
        content: form.content,
        tags: form.tags
          ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
        sourceUrl: form.sourceUrl || undefined,
      });
      toast.success(`Article "${form.title.trim()}" created`);
      setCreateOpen(false);
      setForm({ title: "", category: "", contentType: "article", summary: "", content: "", tags: "", sourceUrl: "" });
      fetchStatus();
      fetchArticles();
    } catch (error: any) {
      toast.error(error?.data?.message || error?.message || "Failed to create article");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (article: Article) => {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    setDeletingId(article.id);
    try {
      await api.delete(`/offsec-rd/knowledge/${article.id}`);
      toast.success("Article deleted");
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
      fetchStatus();
    } catch (error: any) {
      toast.error(error?.data?.message || error?.message || "Failed to delete article");
    } finally {
      setDeletingId(null);
    }
  };

  const categories = Array.from(new Set(articles.map((a) => a.category))).sort();
  const ready = status?.ready === true;

  return (
    <div>
      {/* Readiness banner */}
      {!ready && (
        <Alert className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {statusError ? (
              <>Could not reach the readiness endpoint. The Knowledge Base feature requires the{" "}
                <code className="bg-muted px-1 py-0.5 rounded">pgvector</code> PostgreSQL extension
                and the <code className="bg-muted px-1 py-0.5 rounded">knowledge_base</code> table.</>
            ) : (
              <>
                The Knowledge Base feature requires the{" "}
                <code className="bg-muted px-1 py-0.5 rounded">pgvector</code> PostgreSQL extension
                {status && !status.pgvectorInstalled ? " (missing)" : ""} and the{" "}
                <code className="bg-muted px-1 py-0.5 rounded">knowledge_base</code> table
                {status && !status.tableExists ? " (missing)" : ""}. Apply{" "}
                <code className="bg-muted px-1 py-0.5 rounded">migrations/0045_add_knowledge_base.sql</code>{" "}
                to provision the prerequisites. Full-text search still works without embeddings.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      {ready && (
        <Alert className="mb-8 border-emerald-500/40">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertDescription>
            Knowledge Base is ready. <code className="bg-muted px-1 py-0.5 rounded">pgvector</code>{" "}
            installed, <code className="bg-muted px-1 py-0.5 rounded">knowledge_base</code> table
            present, embedding column sized at <code className="bg-muted px-1 py-0.5 rounded">vector(2560)</code>.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{status?.totalArticles ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{status?.categoryCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">POCs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{status?.pocCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Techniques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{status?.techniqueCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + filters + create */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <form
          className="flex-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            fetchArticles();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search articles (semantic + full-text)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {CONTENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Article
        </Button>
      </div>

      {/* Article list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search.trim() ? "No articles match your search" : "No articles yet"}
            </p>
            {!ready && (
              <div className="mt-6 max-w-md mx-auto text-left">
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Installing pgvector</p>
                    <pre className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto">
                      <code>CREATE EXTENSION IF NOT EXISTS vector;</code>
                    </pre>
                    <p className="mt-2">Then apply the knowledge_base migration.</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-foreground truncate">{a.title}</h3>
                      <Badge variant="outline">{a.category}</Badge>
                      {a.contentType && (
                        <Badge variant="secondary" className="capitalize">
                          {a.contentType.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {typeof a.similarity === "number" && (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                          {Math.round(a.similarity * 100)}% match
                        </Badge>
                      )}
                    </div>
                    {a.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{a.summary}</p>
                    )}
                    {a.tags && a.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {a.tags.slice(0, 6).map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setPreview(a)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(a)}
                      disabled={deletingId === a.id}
                      title="Delete"
                    >
                      {deletingId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <BookOpen className="h-5 w-5" />
              {preview?.title}
              {preview?.category && <Badge variant="outline">{preview.category}</Badge>}
              {preview?.contentType && (
                <Badge variant="secondary" className="capitalize">
                  {preview.contentType.replace(/_/g, " ")}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[65vh] space-y-3">
            {preview?.summary && (
              <p className="text-sm text-muted-foreground italic">{preview.summary}</p>
            )}
            {preview?.sourceUrl && (
              <a
                href={preview.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-500 hover:underline break-all"
              >
                {preview.sourceUrl}
              </a>
            )}
            <pre className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap font-mono">
              {preview?.content}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setPreview(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              New Knowledge Article
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="kb-title">Title *</Label>
              <Input
                id="kb-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., SSRF to RCE via gopher://"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kb-category">Category *</Label>
                <Input
                  id="kb-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g., Web Application Security"
                />
              </div>
              <div>
                <Label htmlFor="kb-type">Content Type</Label>
                <Select value={form.contentType} onValueChange={(v) => setForm({ ...form, contentType: v })}>
                  <SelectTrigger id="kb-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="kb-summary">Summary</Label>
              <Textarea
                id="kb-summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="One-line summary (also used for embedding)…"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="kb-content">Content *</Label>
              <Textarea
                id="kb-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Markdown body…"
                rows={8}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kb-tags">Tags (comma-separated)</Label>
                <Input
                  id="kb-tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="ssrf, rce, web"
                />
              </div>
              <div>
                <Label htmlFor="kb-source">Source URL</Label>
                <Input
                  id="kb-source"
                  value={form.sourceUrl}
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.title.trim() || !form.content.trim() || !form.category.trim()}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Article
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
