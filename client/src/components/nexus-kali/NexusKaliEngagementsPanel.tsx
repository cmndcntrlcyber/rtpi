import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useNexusKaliEngagements } from "@/hooks/useNexusKali";
import { api } from "@/lib/api";

function fileIcon(name: string) {
  if (/scope/i.test(name)) return <Shield className="h-3 w-3 text-blue-400 shrink-0" />;
  return <FileText className="h-3 w-3 text-muted-foreground shrink-0" />;
}

export default function NexusKaliEngagementsPanel() {
  const { engagements, loading, refresh } = useNexusKaliEngagements();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const toggleEngagement = (name: string) => {
    setExpanded(expanded === name ? null : name);
    setActiveFile(null);
    setFileContent("");
  };

  const viewFile = async (engagementName: string, fileName: string) => {
    if (activeFile === `${engagementName}/${fileName}`) {
      setActiveFile(null);
      setFileContent("");
      return;
    }
    setActiveFile(`${engagementName}/${fileName}`);
    setLoadingFile(true);
    try {
      const data = await api.get<{ content: string }>(
        `/nexus-kali/engagements/${encodeURIComponent(engagementName)}/${encodeURIComponent(fileName)}`
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
          Engagements
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {engagements.length === 0 && (
          <p className="text-xs text-muted-foreground">No engagement data found.</p>
        )}
        {engagements.map((eng) => (
          <div key={eng.name}>
            <button
              onClick={() => toggleEngagement(eng.name)}
              className="flex items-center gap-1.5 w-full text-left text-xs py-1.5 px-1 rounded hover:bg-muted/50 transition-colors"
            >
              {expanded === eng.name ? (
                <ChevronDown className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" />
              )}
              <FolderOpen className="h-3 w-3 shrink-0 text-amber-500" />
              <span className="font-medium truncate">{eng.name}</span>
              <span className="text-muted-foreground ml-auto shrink-0">
                {eng.files.length} files
              </span>
            </button>
            {expanded === eng.name && (
              <div className="ml-5 space-y-0.5 mt-0.5">
                {eng.files.map((file) => {
                  const key = `${eng.name}/${file}`;
                  return (
                    <div key={file}>
                      <button
                        onClick={() => viewFile(eng.name, file)}
                        className="flex items-center gap-1.5 w-full text-left text-xs py-1 px-1 rounded hover:bg-muted/50 transition-colors"
                      >
                        {fileIcon(file)}
                        <span className="font-mono truncate">{file}</span>
                      </button>
                      {activeFile === key && (
                        <div className="ml-5 mt-1 mb-2">
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
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
