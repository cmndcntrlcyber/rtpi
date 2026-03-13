/**
 * BurpSuite License Upload Card
 * 
 * Handles upload and validation of BurpSuite Professional license file
 */

import { useState, useRef } from "react";
import { Upload, CheckCircle2, AlertCircle, FileText, X, Calendar, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

interface BurpSuiteLicenseUploadCardProps {
  onUploadComplete: (licenseInfo: LicenseFileInfo) => void;
  onRemove: () => void;
  existingLicense?: LicenseFileInfo | null;
}

export interface LicenseFileInfo {
  filename: string;
  type: 'pro' | 'enterprise';
  expiryDate?: Date;
  uploadedAt: Date;
}

type UploadState = "idle" | "selected" | "uploading" | "success" | "error";

export default function BurpSuiteLicenseUploadCard({ 
  onUploadComplete,
  onRemove,
  existingLicense
}: BurpSuiteLicenseUploadCardProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>(existingLicense ? "success" : "idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseFileInfo | null>(existingLicense || null);

  const MAX_LICENSE_SIZE = 10 * 1024; // 10KB (licenses are small text files)

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".txt")) {
      setErrorMessage("Only .txt license files are allowed");
      setState("error");
      return;
    }

    if (selectedFile.size > MAX_LICENSE_SIZE) {
      setErrorMessage(
        `File too large (${(selectedFile.size / 1024).toFixed(1)}KB). License files should be <10KB.`
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
      formData.append("license", file);

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

          // Extract license info from validation
          const licInfo: LicenseFileInfo = {
            filename: response.filename,
            type: response.validation?.type || 'pro',
            expiryDate: response.validation?.expiryDate ? new Date(response.validation.expiryDate) : undefined,
            uploadedAt: new Date(),
          };

          setLicenseInfo(licInfo);
          onUploadComplete(licInfo);
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

      xhr.open("POST", "/api/v1/burp-activation/upload-license");
      xhr.withCredentials = true;
      xhr.timeout = 30000; // 30 seconds (small file)
      xhr.send(formData);
    } catch (err: any) {
      setErrorMessage(err.message || "Upload failed");
      setState("error");
    }
  };

  const handleRemoveFile = async () => {
    if (!confirm("Remove BurpSuite license file? This will require deactivation if currently active.")) {
      return;
    }

    try {
      const response = await fetch("/api/v1/burp-activation/license", {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        resetState();
        setLicenseInfo(null);
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

  const formatExpiryDate = (date?: Date): string => {
    if (!date) return "Perpetual";
    const dateObj = new Date(date);
    const now = new Date();
    const daysUntilExpiry = Math.floor((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return "Expired";
    if (daysUntilExpiry < 30) return `Expires in ${daysUntilExpiry} days`;
    return dateObj.toLocaleDateString();
  };

  const displayLicenseInfo = licenseInfo || existingLicense;

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">BurpSuite License</h3>
          <p className="text-sm text-muted-foreground">
            Upload Burp_Suite_Professional_license.txt
          </p>
        </div>
        {state === "success" && (
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        )}
      </div>

      {state === "idle" && !existingLicense && (
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
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium text-foreground">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Text files only, max 10KB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {state === "selected" && file && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-secondary rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetState}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleUpload}>
                Upload License
              </Button>
            </div>
          </div>
        </div>
      )}

      {state === "uploading" && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm font-medium">Uploading and validating license...</p>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {(state === "success" || existingLicense) && displayLicenseInfo && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 dark:text-green-400 truncate">
                {displayLicenseInfo.filename || file?.name}
              </p>
              <div className="flex flex-wrap gap-3 mt-1">
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Shield className="h-3 w-3" />
                  {displayLicenseInfo.type === 'enterprise' ? 'Enterprise' : 'Professional'}
                </div>
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Calendar className="h-3 w-3" />
                  {formatExpiryDate(displayLicenseInfo.expiryDate)}
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleRemoveFile}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
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
