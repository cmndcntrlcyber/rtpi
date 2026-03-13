import { useState, useRef } from "react";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  Loader2,
  Globe,
  ExternalLink,
  Shield,
  ShieldOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BugBountyImportCardProps {
  operationId?: string;
  onSuccess?: (operationId: string) => void;
  onClose?: () => void;
}

type ImportMode = "url" | "upload";
type CardState = "input" | "previewing" | "preview" | "importing" | "success" | "error";

interface ScopeEntry {
  identifier: string;
  assetType: string;
  rtpiTargetType: string | null;
  eligibleForBounty: boolean;
  eligibleForSubmission: boolean;
  maxSeverity: string;
  instruction?: string;
}

interface PreviewResult {
  programName: string;
  platform: string;
  inScope: ScopeEntry[];
  outOfScope: ScopeEntry[];
  targetsToCreate: number;
  nonTargetableAssets: number;
  burpConfigPresent: boolean;
}

interface ImportResult {
  success: boolean;
  operationId: string;
  operationName: string;
  targetsCreated: number;
  scopeEntriesTotal: number;
  scopeEntriesSkipped: number;
  burpConfigStored: boolean;
  autoActivated: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function BugBountyImportCard({ operationId: existingOperationId, onSuccess, onClose }: BugBountyImportCardProps) {
  const isExistingOperation = !!existingOperationId;
  const csvInputRef = useRef<HTMLInputElement>(null);
  const burpInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ImportMode>("upload");
  const [state, setState] = useState<CardState>("input");

  // URL mode
  const [programSlug, setProgramSlug] = useState("");

  // Upload mode
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [burpFile, setBurpFile] = useState<File | null>(null);

  // Options
  const [operationName, setOperationName] = useState("");
  const [autoActivate, setAutoActivate] = useState(false);

  // Results
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOutOfScope, setShowOutOfScope] = useState(false);

  const handleFileSelect = (file: File, type: "csv" | "burp") => {
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`);
      setState("error");
      return;
    }

    if (type === "csv") {
      if (!file.name.endsWith(".csv")) {
        setErrorMessage("CSV file expected (.csv extension).");
        setState("error");
        return;
      }
      setCsvFile(file);
    } else {
      if (!file.name.endsWith(".json")) {
        setErrorMessage("JSON file expected (.json extension).");
        setState("error");
        return;
      }
      setBurpFile(file);
    }
    setErrorMessage(null);
  };

  const handlePreview = async () => {
    setState("previewing");
    setErrorMessage(null);

    try {
      if (mode === "upload") {
        if (!csvFile && !burpFile) {
          throw new Error("Please select at least one file.");
        }

        const formData = new FormData();
        if (csvFile) formData.append("csvFile", csvFile);
        if (burpFile) formData.append("burpJsonFile", burpFile);

        const response = await fetch("/api/v1/bug-bounty-import/preview", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Preview failed");
        setPreview(data);
      } else {
        // URL mode — we'd need to fetch on server side, use from-url with a preview flag
        // For MVP, create a temporary preview by fetching and parsing server-side
        if (!programSlug.trim()) {
          throw new Error("Please enter a program slug.");
        }

        // For URL mode preview, we'll use the upload preview with fetched content
        // This requires the server to support URL preview — for now, skip preview for URL mode
        setPreview({
          programName: `Bug Bounty: ${programSlug}`,
          platform: "hackerone",
          inScope: [],
          outOfScope: [],
          targetsToCreate: 0,
          nonTargetableAssets: 0,
          burpConfigPresent: false,
        });
      }
      setState("preview");
    } catch (err: any) {
      setErrorMessage(err.message || "Preview failed");
      setState("error");
    }
  };

  const handleImport = async () => {
    setState("importing");
    setErrorMessage(null);

    try {
      let response: Response;

      if (isExistingOperation) {
        // Import into existing operation
        const formData = new FormData();
        if (csvFile) formData.append("csvFile", csvFile);
        if (burpFile) formData.append("burpJsonFile", burpFile);
        formData.append("operationId", existingOperationId!);

        response = await fetch("/api/v1/bug-bounty-import/into-operation", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      } else if (mode === "url") {
        response = await fetch("/api/v1/bug-bounty-import/from-url", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "hackerone",
            programSlug: programSlug.trim(),
            operationName: operationName.trim() || undefined,
            autoActivate,
          }),
        });
      } else {
        const formData = new FormData();
        if (csvFile) formData.append("csvFile", csvFile);
        if (burpFile) formData.append("burpJsonFile", burpFile);
        if (operationName.trim()) formData.append("operationName", operationName.trim());
        formData.append("autoActivate", autoActivate.toString());

        response = await fetch("/api/v1/bug-bounty-import/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");

      setResult(data);
      setState("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Import failed");
      setState("error");
    }
  };

  const resetState = () => {
    setState("input");
    setCsvFile(null);
    setBurpFile(null);
    setProgramSlug("");
    setOperationName("");
    setAutoActivate(false);
    setPreview(null);
    setResult(null);
    setErrorMessage(null);
    setShowOutOfScope(false);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (burpInputRef.current) burpInputRef.current.value = "";
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-red-500";
      case "high": return "text-orange-500";
      case "medium": return "text-yellow-500";
      case "low": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {isExistingOperation ? "Import Scope into Operation" : "Import Bug Bounty Program"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isExistingOperation
              ? "Upload HackerOne scope files to add targets to this operation."
              : "Import scope from HackerOne to auto-create an operation with targets."}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Input State */}
      {state === "input" && (
        <>
          {/* Mode toggle (hidden when importing into existing operation) */}
          {!isExistingOperation && (
            <div className="flex gap-2">
              <Button
                variant={mode === "upload" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("upload")}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload Files
              </Button>
              <Button
                variant={mode === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("url")}
              >
                <Globe className="h-4 w-4 mr-1" />
                Fetch from URL
              </Button>
            </div>
          )}

          {mode === "url" && !isExistingOperation ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  HackerOne Program Slug
                </label>
                <input
                  type="text"
                  value={programSlug}
                  onChange={(e) => setProgramSlug(e.target.value)}
                  placeholder="e.g., doordash"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Fetches from https://hackerone.com/teams/{programSlug || "{slug}"}/assets/...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* CSV file input */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Scope CSV File
                </label>
                <div
                  className={`border border-dashed rounded-md p-3 cursor-pointer transition-colors hover:border-primary/50 ${
                    csvFile ? "border-green-500/50 bg-green-500/5" : "border-border"
                  }`}
                  onClick={() => csvInputRef.current?.click()}
                >
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f, "csv");
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className={`h-4 w-4 ${csvFile ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className="text-sm">
                      {csvFile ? csvFile.name : "Click to select CSV scope file"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Burp JSON file input */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Burp Project Config JSON <span className="text-muted-foreground">(optional)</span>
                </label>
                <div
                  className={`border border-dashed rounded-md p-3 cursor-pointer transition-colors hover:border-primary/50 ${
                    burpFile ? "border-green-500/50 bg-green-500/5" : "border-border"
                  }`}
                  onClick={() => burpInputRef.current?.click()}
                >
                  <input
                    ref={burpInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f, "burp");
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <FileJson className={`h-4 w-4 ${burpFile ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className="text-sm">
                      {burpFile ? burpFile.name : "Click to select Burp project config"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Options (hidden when importing into existing operation) */}
          {!isExistingOperation && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Operation Name <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="text"
                  value={operationName}
                  onChange={(e) => setOperationName(e.target.value)}
                  placeholder="Auto-generated from program name"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoActivate}
                  onChange={(e) => setAutoActivate(e.target.checked)}
                  className="rounded border-input"
                />
                Auto-activate operation (start scan pipeline immediately)
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {(mode === "upload" || isExistingOperation) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePreview}
                disabled={!csvFile && !burpFile}
              >
                Preview Scope
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleImport}
              disabled={isExistingOperation ? (!csvFile && !burpFile) : (mode === "url" ? !programSlug.trim() : (!csvFile && !burpFile))}
            >
              <Upload className="h-4 w-4 mr-1" />
              {isExistingOperation ? "Import Targets" : mode === "url" ? "Fetch & Import" : "Import"}
            </Button>
          </div>
        </>
      )}

      {/* Previewing state */}
      {state === "previewing" && (
        <div className="text-center py-6">
          <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
          <p className="text-sm">Parsing scope files...</p>
        </div>
      )}

      {/* Preview state */}
      {state === "preview" && preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{preview.programName}</span>
            <span className="text-muted-foreground">
              {preview.targetsToCreate} targets to create
              {preview.nonTargetableAssets > 0 && `, ${preview.nonTargetableAssets} metadata-only`}
            </span>
          </div>

          {/* In-scope table */}
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2">Identifier</th>
                  <th className="text-left p-2">Asset Type</th>
                  <th className="text-left p-2">Target Type</th>
                  <th className="text-center p-2">Bounty</th>
                  <th className="text-left p-2">Max Severity</th>
                </tr>
              </thead>
              <tbody>
                {preview.inScope.map((entry, i) => (
                  <tr key={i} className={`border-t border-border ${entry.rtpiTargetType ? "" : "opacity-50"}`}>
                    <td className="p-2 font-mono">{entry.identifier}</td>
                    <td className="p-2">{entry.assetType}</td>
                    <td className="p-2">
                      {entry.rtpiTargetType ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                          {entry.rtpiTargetType}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">metadata only</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {entry.eligibleForBounty ? (
                        <Shield className="h-3.5 w-3.5 mx-auto text-green-500" />
                      ) : (
                        <ShieldOff className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                      )}
                    </td>
                    <td className={`p-2 ${severityColor(entry.maxSeverity)}`}>
                      {entry.maxSeverity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Out of scope (collapsible) */}
          {preview.outOfScope.length > 0 && (
            <div>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowOutOfScope(!showOutOfScope)}
              >
                {showOutOfScope ? "Hide" : "Show"} {preview.outOfScope.length} out-of-scope entries
              </button>
              {showOutOfScope && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-border/50 bg-muted/20">
                  {preview.outOfScope.map((entry, i) => (
                    <div key={i} className="px-2 py-1 text-xs text-muted-foreground border-b border-border/30 last:border-0">
                      <span className="font-mono">{entry.identifier}</span>
                      <span className="ml-2">({entry.assetType})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetState}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-1" />
              Create Operation
            </Button>
          </div>
        </div>
      )}

      {/* Importing state */}
      {state === "importing" && (
        <div className="text-center py-6">
          <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
          <p className="text-sm">Creating operation and targets...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Parsing scope, creating operation, importing targets
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
              <p className="text-sm mt-1">{result.operationName}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{result.targetsCreated}</span> targets created
                </span>
                <span>
                  <span className="font-semibold text-foreground">{result.scopeEntriesTotal}</span> scope entries
                </span>
                {result.scopeEntriesSkipped > 0 && (
                  <span>{result.scopeEntriesSkipped} non-targetable</span>
                )}
                {result.burpConfigStored && (
                  <span className="text-blue-500">Burp config stored</span>
                )}
              </div>
              {result.autoActivated && (
                <p className="text-xs text-muted-foreground mt-2">
                  Scan pipeline triggered automatically.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onSuccess?.(result.operationId);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Go to Operation
            </Button>
            <Button variant="outline" size="sm" onClick={resetState}>
              Import Another
            </Button>
          </div>
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
  );
}
