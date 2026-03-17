/**
 * BurpSuite Pro JAR Upload Card
 * 
 * Handles upload and validation of BurpSuite Professional JAR file
 */

import { useState, useRef } from "react";
import { Upload, CheckCircle2, AlertCircle, FileArchive, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

interface BurpSuiteJarUploadCardProps {
  onUploadComplete: (fileInfo: JarFileInfo) => void;
  onRemove: () => void;
  existingFile?: JarFileInfo | null;
}

export interface JarFileInfo {
  filename: string;
  size: number;
  hash: string;
  uploadedAt: Date;
}

type UploadState = "idle" | "selected" | "uploading" | "success" | "error";

export default function BurpSuiteJarUploadCard({ 
  onUploadComplete,
  onRemove,
  existingFile
}: BurpSuiteJarUploadCardProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>(existingFile ? "success" : "idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE = 800 * 1024 * 1024; // 800MB
  const MIN_JAR_SIZE = 100 * 1024 * 1024; // 100MB (Burp JAR is large)
  const MIN_INSTALLER_SIZE = 50 * 1024 * 1024; // 50MB (.sh installer is smaller)

  const handleFileSelect = (selectedFile: File) => {
    const isJar = selectedFile.name.endsWith(".jar");
    const isInstaller = selectedFile.name.endsWith(".sh");

    if (!isJar && !isInstaller) {
      setErrorMessage("Only .jar and .sh installer files are allowed");
      setState("error");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File too large (${(selectedFile.size / 1024 / 1024).toFixed(0)}MB). Maximum is 800MB.`
      );
      setState("error");
      return;
    }

    const minSize = isInstaller ? MIN_INSTALLER_SIZE : MIN_JAR_SIZE;
    if (selectedFile.size < minSize) {
      setErrorMessage(
        `File too small (${(selectedFile.size / 1024 / 1024).toFixed(0)}MB). BurpSuite Pro ${isInstaller ? 'installer' : 'JAR'} is typically >${(minSize / 1024 / 1024).toFixed(0)}MB.`
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

  const handleUpload = async () => {
    if (!file || !user) return;

    setState("uploading");
    setProgress(0);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("jar", file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          setState("success");
          setProgress(100);

          // Notify parent component
          onUploadComplete({
            filename: response.filename,
            size: response.size,
            hash: response.hash || "",
            uploadedAt: new Date(),
          });
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setErrorMessage(errorData.error || "Upload failed");
          setState("error");
        }
      });

      xhr.addEventListener("error", () => {
        setErrorMessage("Network error during upload");
        setState("error");
      });

      xhr.addEventListener("timeout", () => {
        setErrorMessage("Upload timed out");
        setState("error");
      });

      xhr.open("POST", "/api/v1/burp-activation/upload-jar");
      xhr.withCredentials = true;
      xhr.timeout = 300000; // 5 minutes for large JAR
      xhr.send(formData);
    } catch (err: any) {
      setErrorMessage(err.message || "Upload failed");
      setState("error");
    }
  };

  const handleRemoveFile = async () => {
    if (!confirm("Remove BurpSuite Pro JAR file? This will require deactivation if currently active.")) {
      return;
    }

    try {
      const response = await fetch("/api/v1/burp-activation/jar", {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        resetState();
        onRemove();
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.error || "Failed to remove file");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to remove file");
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">BurpSuite Pro</h3>
          <p className="text-sm text-muted-foreground">
            Upload .jar or .sh installer file
          </p>
        </div>
        {state === "success" && (
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        )}
      </div>

      {state === "idle" && !existingFile && (
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
          <FileArchive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium text-foreground">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            .jar or .sh installer (BurpSuite Pro)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jar,.sh"
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
              <Button size="sm" onClick={handleUpload}>
                Upload JAR
              </Button>
            </div>
          </div>
        </div>
      )}

      {state === "uploading" && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm font-medium">Uploading BurpSuite Pro...</p>
            <p className="text-xs text-muted-foreground mt-1">
              This may take several minutes
            </p>
          </div>
          <Progress value={progress} className="w-full" />
          <p className="text-xs text-center text-muted-foreground">
            {progress}% complete
          </p>
        </div>
      )}

      {(state === "success" || existingFile) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-400">
                {existingFile?.filename || file?.name}
              </p>
              <p className="text-xs text-green-600">
                {formatFileSize(existingFile?.size || file?.size || 0)} • Uploaded
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleRemoveFile}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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
