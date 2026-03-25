import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ExternalLink,
  Download,
  RefreshCw,
  AlertCircle,
  Loader2,
  FileText,
  Search,
} from "lucide-react";
import {
  useSysReptorStatus,
  useSysReptorProjects,
} from "@/hooks/useSysReptor";
import { sysReptorService, SysReptorProject } from "@/services/sysreptor";

interface SysReptorProjectsListProps {
  operationId?: string;
}

export default function SysReptorProjectsList({ operationId }: SysReptorProjectsListProps) {
  const { status, loading: statusLoading } = useSysReptorStatus();
  const { projects, loading: projectsLoading, refetch } = useSysReptorProjects();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filteredProjects = filter
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.tags?.some((t) => t.toLowerCase().includes(filter.toLowerCase()))
      )
    : projects;

  const handleSync = async (project: SysReptorProject) => {
    if (!operationId) {
      toast.error("No operation selected for sync");
      return;
    }

    try {
      setSyncing(project.id);
      const result = await sysReptorService.syncProject(project.id, operationId);
      toast.success(`Synced: ${result.added} added, ${result.skipped} skipped`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const handleDownloadPDF = async (project: SysReptorProject) => {
    try {
      setDownloading(project.id);
      const response = await fetch(`/api/v1/sysreptor/projects/${project.id}/pdf`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF download failed");
    } finally {
      setDownloading(null);
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking SysReptor connection...
      </div>
    );
  }

  if (!status?.connected && !status?.tokenConfigured) {
    return (
      <div className="text-center py-8 bg-card rounded-lg border border-border">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">SysReptor Not Configured</p>
        <p className="text-xs text-muted-foreground mt-1">
          Set SYSREPTOR_URL and SYSREPTOR_API_TOKEN in your environment to enable report export.
        </p>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="text-center py-8 bg-card rounded-lg border border-border">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">SysReptor Unreachable</p>
        <p className="text-xs text-muted-foreground mt-1">
          Cannot connect to {status?.url}. Check that SysReptor is running.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">SysReptor Projects</h3>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs">
            Connected
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 3 && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                className="h-7 w-40 pl-7 text-xs"
                placeholder="Filter projects..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          )}
          <Button size="sm" variant="ghost" className="h-7" onClick={refetch}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {projectsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-6 bg-card rounded-lg border border-border">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {filter ? "No matching projects" : "No SysReptor projects yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Export an operation to create a professional report.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-foreground truncate">
                    {project.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    {project.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {project.updated && (
                      <span className="text-[10px] text-muted-foreground">
                        Updated {new Date(project.updated).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                {operationId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => handleSync(project)}
                    disabled={syncing === project.id}
                  >
                    {syncing === project.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Sync
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => handleDownloadPDF(project)}
                  disabled={downloading === project.id}
                >
                  {downloading === project.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3 mr-1" />
                  )}
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => window.open(`${status?.url}/projects/${project.id}`, "_blank")}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
