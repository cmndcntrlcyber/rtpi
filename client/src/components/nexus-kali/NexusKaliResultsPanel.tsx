import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { useNexusKaliResults } from "@/hooks/useNexusKali";
import { api } from "@/lib/api";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NexusKaliResultsPanel() {
  const { results, loading, refresh } = useNexusKaliResults();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState(false);

  const toggleFile = async (filename: string) => {
    if (expanded === filename) {
      setExpanded(null);
      setFileContent("");
      return;
    }
    setExpanded(filename);
    setLoadingFile(true);
    try {
      const data = await api.get<{ content: string }>(
        `/nexus-kali/results/${encodeURIComponent(filename)}`
      );
      setFileContent(data?.content || "(empty)");
    } catch {
      setFileContent("(failed to load)");
    } finally {
      setLoadingFile(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Scan Results
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {results.length === 0 && (
          <p className="text-xs text-muted-foreground">No scan results found.</p>
        )}
        {results.map((file) => (
          <div key={file.name}>
            <button
              onClick={() => toggleFile(file.name)}
              className="flex items-center justify-between w-full text-left text-xs py-1.5 px-1 rounded hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {expanded === file.name ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="font-mono truncate">{file.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-muted-foreground tabular-nums">{formatSize(file.size)}</span>
              </div>
            </button>
            {expanded === file.name && (
              <div className="ml-6 mt-1 mb-2">
                {loadingFile ? (
                  <div className="text-xs text-muted-foreground">Loading...</div>
                ) : (
                  <pre className="text-xs font-mono bg-muted/30 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                    {fileContent}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
