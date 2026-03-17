import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  FileText,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Shield,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface BurpSuiteActivationPanelProps {
  operationId: string;
}

interface ActivationStatus {
  jarUploaded: boolean;
  jarFilename: string | null;
  jarFileSize: number | null;
  licenseUploaded: boolean;
  licenseFilename: string | null;
  licenseType: string | null;
  licenseExpiryDate: string | null;
  activationStatus: "dormant" | "activating" | "active" | "error";
  mcpHealthCheckPassed: boolean;
  errorMessage: string | null;
}

const DEFAULT_STATUS: ActivationStatus = {
  jarUploaded: false,
  jarFilename: null,
  jarFileSize: null,
  licenseUploaded: false,
  licenseFilename: null,
  licenseType: null,
  licenseExpiryDate: null,
  activationStatus: "dormant",
  mcpHealthCheckPassed: false,
  errorMessage: null,
};

const MAX_JAR_SIZE = 800 * 1024 * 1024; // 800MB
const MAX_LICENSE_SIZE = 10 * 1024; // 10KB
const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB per chunk (within Cloudflare's 100MB limit)

export default function BurpSuiteActivationPanel({
  operationId: _operationId,
}: BurpSuiteActivationPanelProps) {
  const [status, setStatus] = useState<ActivationStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [jarUploading, setJarUploading] = useState(false);
  const [licenseUploading, setLicenseUploading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [jarDragging, setJarDragging] = useState(false);
  const [licenseDragging, setLicenseDragging] = useState(false);
  const [jarProgress, setJarProgress] = useState(0);

  const jarInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/burp-activation/status", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch BurpSuite activation status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while activating
  useEffect(() => {
    if (status.activationStatus !== "activating") return;
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [status.activationStatus, fetchStatus]);

  const filesUploaded = (status.jarUploaded ? 1 : 0) + (status.licenseUploaded ? 1 : 0);

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  };

  // --- JAR Upload ---

  const handleJarSelect = async (file: File) => {
    const isJar = file.name.endsWith(".jar");
    const isInstaller = file.name.endsWith(".sh");
    if (!isJar && !isInstaller) {
      toast.error("Only .jar and .sh installer files are allowed");
      return;
    }
    if (file.size > MAX_JAR_SIZE) {
      toast.error(`File too large (${formatFileSize(file.size)}). Maximum is 800MB.`);
      return;
    }

    setJarUploading(true);
    setJarProgress(0);

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Step 1: Initialize chunked upload session
      const initRes = await fetch("/api/v1/burp-activation/upload-jar/chunked/init", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          totalChunks,
          totalSize: file.size,
        }),
      });
      if (!initRes.ok) {
        const data = await initRes.json();
        throw new Error(data.error || "Failed to initialize upload");
      }
      const { uploadId } = await initRes.json();

      // Step 2: Upload chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const chunkForm = new FormData();
        chunkForm.append("chunk", chunk, `chunk-${i}`);

        const chunkRes = await fetch(
          `/api/v1/burp-activation/upload-jar/chunked/${uploadId}/${i}`,
          { method: "POST", credentials: "include", body: chunkForm }
        );
        if (!chunkRes.ok) {
          const data = await chunkRes.json();
          throw new Error(data.error || `Chunk ${i + 1}/${totalChunks} failed`);
        }

        setJarProgress(Math.round(((i + 1) / totalChunks) * 90)); // 0-90% for chunks
      }

      // Step 3: Complete — reassemble and process
      setJarProgress(95);
      const completeRes = await fetch(
        `/api/v1/burp-activation/upload-jar/chunked/${uploadId}/complete`,
        { method: "POST", credentials: "include" }
      );
      if (!completeRes.ok) {
        const data = await completeRes.json();
        throw new Error(data.error || "Failed to finalize upload");
      }

      setJarProgress(100);
      toast.success("File uploaded successfully");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setJarUploading(false);
      setJarProgress(0);
      if (jarInputRef.current) jarInputRef.current.value = "";
    }
  };

  const handleRemoveJar = async () => {
    try {
      const res = await fetch("/api/v1/burp-activation/jar", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove JAR");
      toast.success("JAR file removed");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove JAR file");
    }
  };

  // --- License Upload ---

  const handleLicenseSelect = async (file: File) => {
    if (!file.name.endsWith(".txt")) {
      toast.error("Only .txt license files are allowed");
      return;
    }
    if (file.size > MAX_LICENSE_SIZE) {
      toast.error(`File too large (${formatFileSize(file.size)}). Maximum is 10KB.`);
      return;
    }

    setLicenseUploading(true);
    try {
      const formData = new FormData();
      formData.append("license", file);
      const res = await fetch("/api/v1/burp-activation/upload-license", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Upload failed");
      }
      toast.success("License file uploaded successfully");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload license file");
    } finally {
      setLicenseUploading(false);
      if (licenseInputRef.current) licenseInputRef.current.value = "";
    }
  };

  const handleRemoveLicense = async () => {
    try {
      const res = await fetch("/api/v1/burp-activation/license", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove license");
      toast.success("License file removed");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove license file");
    }
  };

  // --- Activation ---

  const handleActivate = async () => {
    setActivating(true);
    try {
      const res = await fetch("/api/v1/burp-activation/activate", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Activation failed");
      }
      toast.success("BurpSuite activation started");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to activate BurpSuite");
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const res = await fetch("/api/v1/burp-activation/deactivate", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Deactivation failed");
      }
      toast.success("BurpSuite deactivated");
      setConfirmDeactivate(false);
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate BurpSuite");
    } finally {
      setDeactivating(false);
    }
  };

  // --- Drag helpers ---

  const makeDragHandlers = (
    setDragging: (v: boolean) => void,
    onDrop: (file: File) => void,
  ) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onDrop(file);
    },
  });

  // --- Status badge ---

  const statusBadge = () => {
    switch (status.activationStatus) {
      case "dormant":
        return (
          <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">
            Dormant
          </Badge>
        );
      case "activating":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse">
            Activating
          </Badge>
        );
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            Active
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
            Error
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading BurpSuite status...</span>
        </div>
      </div>
    );
  }

  const isActive = status.activationStatus === "active";
  const isActivating = status.activationStatus === "activating";
  const bothUploaded = status.jarUploaded && status.licenseUploaded;

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">BurpSuite Pro Activation</h3>
        </div>
        {statusBadge()}
      </div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          Upload BurpSuite Pro JAR and license to activate scanning
        </p>
        <span className="text-xs text-muted-foreground">
          {filesUploaded}/2 files uploaded{bothUploaded ? " — ready" : ""}
        </span>
      </div>

      {/* Error banner */}
      {status.errorMessage && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-800 dark:text-red-400">{status.errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* JAR Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {status.jarUploaded ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
            )}
            <span className="text-sm font-medium text-foreground">JAR File</span>
          </div>

          {status.jarUploaded && status.jarFilename ? (
            <div className="flex items-center justify-between bg-secondary rounded-lg p-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileArchive className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {status.jarFilename}
                  </p>
                  {status.jarFileSize && (
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(status.jarFileSize)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveJar}
                disabled={isActive || isActivating}
                className="text-muted-foreground hover:text-red-500 flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                jarDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground"
              } ${jarUploading ? "pointer-events-none opacity-60" : ""}`}
              {...makeDragHandlers(setJarDragging, handleJarSelect)}
              onClick={() => !jarUploading && jarInputRef.current?.click()}
            >
              {jarUploading ? (
                <>
                  <Loader2 className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-spin" />
                  <p className="text-sm font-medium text-foreground">
                    Uploading... {jarProgress}%
                  </p>
                  <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${jarProgress}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Drop BurpSuite file here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">.jar or .sh installer, up to 800MB</p>
                </>
              )}
              <input
                ref={jarInputRef}
                type="file"
                accept=".jar,.sh"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleJarSelect(f);
                }}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* License Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {status.licenseUploaded ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
            )}
            <span className="text-sm font-medium text-foreground">License File</span>
          </div>

          {status.licenseUploaded && status.licenseFilename ? (
            <div className="flex items-center justify-between bg-secondary rounded-lg p-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {status.licenseFilename}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {status.licenseType && <span>{status.licenseType}</span>}
                    {status.licenseExpiryDate && (
                      <>
                        <span className="text-muted-foreground/40">|</span>
                        <span>Expires {status.licenseExpiryDate}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveLicense}
                disabled={isActive || isActivating}
                className="text-muted-foreground hover:text-red-500 flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                licenseDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground"
              } ${licenseUploading ? "pointer-events-none opacity-60" : ""}`}
              {...makeDragHandlers(setLicenseDragging, handleLicenseSelect)}
              onClick={() => !licenseUploading && licenseInputRef.current?.click()}
            >
              {licenseUploading ? (
                <Loader2 className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              )}
              <p className="text-sm font-medium text-foreground">
                {licenseUploading ? "Uploading..." : "Drop license file here"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">.txt files, up to 10KB</p>
              <input
                ref={licenseInputRef}
                type="file"
                accept=".txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLicenseSelect(f);
                }}
                className="hidden"
              />
            </div>
          )}
        </div>
      </div>

      {/* Activation Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          {isActive && (
            <div className="flex items-center gap-2">
              <Activity
                className={`h-4 w-4 ${
                  status.mcpHealthCheckPassed ? "text-green-500" : "text-yellow-500"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                MCP {status.mcpHealthCheckPassed ? "Connected" : "Unhealthy"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isActive || isActivating ? (
            confirmDeactivate ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Confirm?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeactivate}
                  disabled={deactivating}
                >
                  {deactivating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <PowerOff className="h-4 w-4 mr-1" />
                  )}
                  Deactivate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDeactivate(false)}
                  disabled={deactivating}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeactivate(true)}
                disabled={isActivating}
              >
                <PowerOff className="h-4 w-4 mr-1" />
                {isActivating ? "Activating..." : "Deactivate"}
              </Button>
            )
          ) : (
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={!bothUploaded || activating}
            >
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Power className="h-4 w-4 mr-1" />
              )}
              Activate BurpSuite
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
