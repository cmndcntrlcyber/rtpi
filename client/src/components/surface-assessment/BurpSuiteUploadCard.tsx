import { useState, useRef } from "react";
import { Upload, CheckCircle2, AlertCircle, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

interface BurpSuiteUploadCardProps {
  operationId: string;
}

type UploadState = "idle" | "selected" | "uploading" | "success" | "error";

export default function BurpSuiteUploadCard({ operationId }: BurpSuiteUploadCardProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const MAX_JAR_SIZE = 800 * 1024 * 1024; // 800MB -- matches server limit

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".jar")) {
      setErrorMessage("Only JAR files are allowed");
      setState("error");
      return;
    }

    if (selectedFile.size > MAX_JAR_SIZE) {
      setErrorMessage(
        `File too large (${(selectedFile.size / 1024 / 1024).toFixed(0)}MB). Maximum is ${MAX_JAR_SIZE / 1024 / 1024}MB.`
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
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
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
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks — stays under Cloudflare's 100MB limit

  /**
   * Upload a single chunk via XHR with per-chunk progress tracking
   */
  const uploadChunk = (
    uploadId: string,
    chunkIndex: number,
    chunkBlob: Blob,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("chunk", chunkBlob);

      const xhr = new XMLHttpRequest();

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.message || errorData.error || `Chunk ${chunkIndex} failed`));
          } catch {
            reject(new Error(`Chunk ${chunkIndex} failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () => reject(new Error(`Network error on chunk ${chunkIndex}`)));
      xhr.addEventListener("timeout", () => reject(new Error(`Chunk ${chunkIndex} timed out`)));

      xhr.open("POST", `/api/v1/burp-builder/upload/chunked/${uploadId}/${chunkIndex}`);
      xhr.withCredentials = true;
      xhr.timeout = 120000; // 2 minutes per chunk (50MB)
      xhr.send(formData);
    });
  };

  const handleEmbed = async () => {
    if (!file || !user) return;

    setState("uploading");
    setProgress(0);
    setErrorMessage(null);

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Phase 1: Initialize chunked upload (0-2%)
      const initResponse = await fetch("/api/v1/burp-builder/upload/chunked/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: user.id,
          fileName: file.name,
          totalChunks,
          totalSize: file.size,
        }),
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new Error(errorData.message || errorData.error || "Failed to initialize upload");
      }

      const { uploadId } = await initResponse.json();
      setProgress(2);

      // Phase 2: Upload chunks sequentially (2-55%)
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        await uploadChunk(uploadId, i, chunkBlob);

        const chunkPercent = 2 + Math.round(((i + 1) / totalChunks) * 53);
        setProgress(chunkPercent);
      }

      // Phase 3: Reassemble chunks on server (55-65%)
      setProgress(57);
      const completeResponse = await fetch(
        `/api/v1/burp-builder/upload/chunked/${uploadId}/complete`,
        { method: "POST", credentials: "include" },
      );

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || errorData.error || "Failed to reassemble JAR");
      }

      setProgress(65);

      // Phase 4: Build Docker image (65-95%)
      const buildResponse = await fetch(`/api/v1/burp-builder/build/${user.id}`, {
        method: "POST",
        credentials: "include",
      });

      setProgress(90);

      if (!buildResponse.ok) {
        const errorData = await buildResponse.json();
        throw new Error(errorData.message || errorData.error || "Failed to build BurpSuite image");
      }

      setProgress(100);
      setState("success");

      // Auto-reset after 2 seconds
      setTimeout(() => {
        resetState();
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setState("error");
    }
  };

  const resetState = () => {
    setState("idle");
    setFile(null);
    setProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-1">BurpSuite Pro Integration</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Upload BurpSuite Pro .jar file to embed into the application
      </p>

      {state === "idle" && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium text-foreground">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            JAR files only, up to 800MB (BurpSuite Pro)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jar"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {state === "selected" && file && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-secondary rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FileArchive className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetState}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleEmbed}>
                Embed BurpSuite
              </Button>
            </div>
          </div>
        </div>
      )}

      {state === "uploading" && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm font-medium">Embedding BurpSuite Pro...</p>
            <p className="text-xs text-muted-foreground mt-1">
              {progress < 2
                ? "Initializing upload..."
                : progress < 55
                  ? "Uploading JAR file (chunked)..."
                  : progress < 65
                    ? "Reassembling on server..."
                    : "Building Docker image..."}
            </p>
          </div>
          <Progress value={progress} className="w-full" />
          <p className="text-xs text-center text-muted-foreground">
            {progress}% complete
          </p>
        </div>
      )}

      {state === "success" && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-600">
            BurpSuite Pro embedded successfully
          </span>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-800 dark:text-red-400">
              {errorMessage || "Upload failed"}
            </span>
          </div>
          <Button onClick={resetState} variant="outline" className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
