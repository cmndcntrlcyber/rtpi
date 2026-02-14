import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileJson, CheckCircle2, AlertCircle } from "lucide-react";

interface ImportStats {
  tactics: number;
  techniques: number;
  subtechniques: number;
  groups: number;
  software: number;
  mitigations: number;
  dataSources: number;
  campaigns: number;
  relationships: number;
  errors: string[];
}

export default function StixImportDialog() {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-trigger file picker when dialog opens
  useEffect(() => {
    if (open && !importing && !stats && !error) {
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, importing, stats, error]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setError(null);
    setStats(null);

    try {
      // Validate file type
      if (!file.name.endsWith(".json")) {
        throw new Error("Please upload a JSON file");
      }

      setProgress(10);

      // Read file
      const fileContent = await file.text();
      setProgress(20);

      // Parse JSON
      const bundle = JSON.parse(fileContent);
      setProgress(30);

      if (bundle.type !== "bundle") {
        throw new Error("Invalid STIX bundle format");
      }

      // Upload to server
      const formData = new FormData();
      formData.append("file", file);

      setProgress(40);

      const response = await fetch("/api/v1/attack/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      setProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to import STIX bundle");
      }

      const result = await response.json();
      setProgress(100);
      setStats(result.stats);
    } catch (err: any) {
      setError(err.message);
      console.error("Import failed:", err.message);
    } finally {
      setImporting(false);
    }
  };

  const resetDialog = () => {
    setProgress(0);
    setStats(null);
    setError(null);
    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setTimeout(resetDialog, 300);
      }
    }}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Import STIX Data
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import MITRE ATT&CK STIX Bundle</DialogTitle>
          <DialogDescription>
            Upload a STIX 2.1 JSON bundle from MITRE ATT&CK to populate the database
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!importing && !stats && !error && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <FileJson className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-sm font-medium text-foreground">
                    Click to upload STIX JSON file
                  </span>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  Download from{" "}
                  <a
                    href="https://github.com/mitre-attack/attack-stix-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    MITRE ATT&CK STIX Repository
                  </a>
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Download ATT&CK Data
                </h4>
                <p className="text-xs text-blue-700 mb-3">
                  Get the latest Enterprise ATT&CK STIX bundle:
                </p>
                <code className="block text-xs bg-blue-100 p-2 rounded mb-2 text-blue-900">
                  wget https://github.com/mitre-attack/attack-stix-data/raw/master/enterprise-attack/enterprise-attack.json
                </code>
                <p className="text-xs text-blue-600">
                  Or visit{" "}
                  <a
                    href="https://github.com/mitre-attack/attack-stix-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    GitHub Repository
                  </a>
                </p>
              </div>
            </div>
          )}

          {importing && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm font-medium">Importing STIX data...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This may take a few minutes for large bundles
                </p>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">
                {progress}% complete
              </p>
            </div>
          )}

          {stats && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Import Completed Successfully</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Tactics</p>
                  <p className="text-2xl font-bold text-foreground">{stats.tactics}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Techniques</p>
                  <p className="text-2xl font-bold text-foreground">{stats.techniques}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Sub-techniques</p>
                  <p className="text-2xl font-bold text-foreground">{stats.subtechniques}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Groups</p>
                  <p className="text-2xl font-bold text-foreground">{stats.groups}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Software</p>
                  <p className="text-2xl font-bold text-foreground">{stats.software}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Mitigations</p>
                  <p className="text-2xl font-bold text-foreground">{stats.mitigations}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Relationships</p>
                  <p className="text-2xl font-bold text-foreground">{stats.relationships}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Campaigns</p>
                  <p className="text-2xl font-bold text-foreground">{stats.campaigns}</p>
                </div>
              </div>

              {stats.errors && stats.errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-900 mb-2">
                    {stats.errors.length} warnings/errors during import
                  </p>
                  <div className="max-h-32 overflow-y-auto">
                    {stats.errors.slice(0, 5).map((err, idx) => (
                      <p key={idx} className="text-xs text-yellow-700 mb-1">
                        {err}
                      </p>
                    ))}
                    {stats.errors.length > 5 && (
                      <p className="text-xs text-yellow-600">
                        ... and {stats.errors.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button onClick={() => setOpen(false)} className="w-full">
                Close
              </Button>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Import Failed</span>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>

              <Button onClick={resetDialog} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
