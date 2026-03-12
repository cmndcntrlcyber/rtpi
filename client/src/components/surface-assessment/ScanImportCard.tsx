import { useState, useRef } from "react";
import { Upload, CheckCircle2, AlertCircle, FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScanImportCardProps {
  operationId: string;
}

type UploadState = "idle" | "selected" | "uploading" | "success" | "error";
type ToolHint = "auto" | "bbot" | "nuclei" | "nmap" | "burp";

interface ImportResult {
  success: boolean;
  scanId: string;
  detectedTool: string;
  stats: { assetsFound: number; servicesFound: number; vulnerabilitiesFound: number };
  pipelineTriggered: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function ScanImportCard({ operationId }: ScanImportCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [toolHint, setToolHint] = useState<ToolHint>("auto");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".json") && !selectedFile.name.endsWith(".jsonl")) {
      setErrorMessage("Only JSON and JSONL files are supported.");
      setState("error");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File too large (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`
      );
      setState("error");
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setState("selected");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleImport = async () => {
    if (!file) return;

    setState("uploading");
    setErrorMessage(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (toolHint !== "auto") {
        formData.append("toolHint", toolHint);
      }

      const response = await fetch(`/api/v1/scan-import/${operationId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Import failed");
      }

      setResult(data);
      setState("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Import failed");
      setState("error");
    }
  };

  const resetState = () => {
    setState("idle");
    setFile(null);
    setToolHint("auto");
    setErrorMessage(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-2">Import Scan Data</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload JSON output from security tools to import assets, services, and vulnerabilities.
          Imported data will trigger the automated workflow pipeline.
        </p>

        {/* Idle / Drag-and-drop zone */}
        {(state === "idle" || state === "selected") && (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : state === "selected"
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.jsonl"
                className="hidden"
                onChange={handleInputChange}
              />

              {state === "idle" ? (
                <>
                  <FileJson className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drop a JSON file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports BBOT, Nuclei, Nmap, and Burp Suite JSON output (up to 50MB)
                  </p>
                </>
              ) : (
                <>
                  <FileJson className="h-10 w-10 mx-auto mb-3 text-green-500" />
                  <p className="text-sm font-medium">{file?.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatFileSize(file?.size || 0)} — Click to change file
                  </p>
                </>
              )}
            </div>

            {/* Tool hint selector + import button */}
            {state === "selected" && (
              <div className="flex items-center gap-3 mt-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">
                    Tool Format
                  </label>
                  <select
                    value={toolHint}
                    onChange={(e) => setToolHint(e.target.value as ToolHint)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="bbot">BBOT</option>
                    <option value="nuclei">Nuclei</option>
                    <option value="nmap">Nmap</option>
                    <option value="burp">Burp Suite</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" size="sm" onClick={resetState}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleImport}>
                    <Upload className="h-4 w-4 mr-1" />
                    Import
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Uploading state */}
        {state === "uploading" && (
          <div className="text-center py-8">
            <Loader2 className="h-10 w-10 mx-auto mb-3 text-primary animate-spin" />
            <p className="text-sm font-medium">Importing scan data...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Parsing {file?.name}, storing results, and triggering workflows
            </p>
          </div>
        )}

        {/* Success state */}
        {state === "success" && result && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Import Successful
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Detected format: <span className="font-medium">{result.detectedTool.toUpperCase()}</span>
                </p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span>
                    <span className="font-semibold">{result.stats.assetsFound}</span> assets
                  </span>
                  <span>
                    <span className="font-semibold">{result.stats.servicesFound}</span> services
                  </span>
                  <span>
                    <span className="font-semibold">{result.stats.vulnerabilitiesFound}</span> vulnerabilities
                  </span>
                </div>
                {result.pipelineTriggered && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Workflow pipeline triggered automatically.
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={resetState}>
              Import Another
            </Button>
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Import Failed</p>
                <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={resetState}>
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Supported formats info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-sm font-medium mb-2">Supported Formats</h4>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">BBOT</span> — JSONL event output
            <span className="block text-[10px]">bbot -t target --json</span>
          </div>
          <div>
            <span className="font-medium text-foreground">Nuclei</span> — JSONL findings
            <span className="block text-[10px]">nuclei -target url -json</span>
          </div>
          <div>
            <span className="font-medium text-foreground">Nmap</span> — XML-to-JSON converted
            <span className="block text-[10px]">nmap -oX output.xml (convert to JSON)</span>
          </div>
          <div>
            <span className="font-medium text-foreground">Burp Suite</span> — Issue export JSON
            <span className="block text-[10px]">Scanner {'>'} Export issues as JSON</span>
          </div>
        </div>
      </div>
    </div>
  );
}
