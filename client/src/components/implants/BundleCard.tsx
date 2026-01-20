import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Download, Copy, RefreshCw, Monitor, Terminal, Package, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BundleCardProps {
  bundle: {
    id: string;
    name: string;
    platform: "windows" | "linux";
    architecture: string;
    implantType: string;
    fileSize: number;
    createdAt: string;
    publicDownloadUrl?: string;
    tokenExpiresAt?: string;
    downloadUrl: string;
  };
  onRefresh: () => void;
}

export function BundleCard({ bundle, onRefresh }: BundleCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Get token expiration status
  const getTokenStatus = (expiresAt?: string) => {
    if (!expiresAt) {
      return {
        status: "none",
        icon: Package,
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        text: "No token generated",
      };
    }

    const now = new Date();
    const expiry = new Date(expiresAt);
    const hoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining <= 0) {
      return {
        status: "expired",
        icon: XCircle,
        color: "text-red-600",
        bgColor: "bg-red-50",
        text: "Token expired",
      };
    } else if (hoursRemaining < 24) {
      return {
        status: "expiring",
        icon: AlertCircle,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
        text: `Expires in ${Math.floor(hoursRemaining)}h`,
      };
    } else {
      const days = Math.floor(hoursRemaining / 24);
      return {
        status: "active",
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-50",
        text: `Expires in ${days}d`,
      };
    }
  };

  const tokenStatus = getTokenStatus(bundle.tokenExpiresAt);
  const TokenIcon = tokenStatus.icon;

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    const url = bundle.publicDownloadUrl || bundle.downloadUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      alert("Failed to copy link to clipboard");
    }
  };

  // Download bundle
  const handleDownload = () => {
    setIsDownloading(true);
    try {
      // Use public URL if available, otherwise use authenticated endpoint
      const url = bundle.publicDownloadUrl || bundle.downloadUrl;
      window.location.href = url;
    } catch (err) {
      console.error("Failed to start download:", err);
      alert("Failed to start download");
    } finally {
      // Reset after a short delay
      setTimeout(() => setIsDownloading(false), 2000);
    }
  };

  // Regenerate token
  const handleRegenerateToken = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch(
        `/api/v1/rust-nexus/agents/bundles/${bundle.id}/generate-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            maxDownloads: 1,
            expiresInHours: 24,
            description: "Regenerated token",
          }),
        }
      );

      if (response.ok) {
        onRefresh();
        alert("Token regenerated successfully!");
      } else {
        throw new Error("Failed to regenerate token");
      }
    } catch (error) {
      console.error("Failed to regenerate token:", error);
      alert("Failed to regenerate token");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6 space-y-4">
        {/* Header: Name and Platform */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate" title={bundle.name}>
              {bundle.name}
            </h3>
          </div>
          <Badge
            variant="secondary"
            className={
              bundle.platform === "windows"
                ? "bg-blue-100 text-blue-800"
                : "bg-orange-100 text-orange-800"
            }
          >
            {bundle.platform === "windows" ? (
              <Monitor className="h-3 w-3 mr-1" />
            ) : (
              <Terminal className="h-3 w-3 mr-1" />
            )}
            {bundle.platform === "windows" ? "Win" : "Linux"}
          </Badge>
        </div>

        {/* Architecture and Type */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{bundle.architecture}</span>
          <span>•</span>
          <span>{bundle.implantType}</span>
        </div>

        {/* File Size */}
        <div className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{formatFileSize(bundle.fileSize)}</span>
        </div>

        {/* Creation Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Created {formatDistanceToNow(new Date(bundle.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Token Status */}
        <div
          className={`flex items-center gap-2 p-2 rounded-md ${tokenStatus.bgColor}`}
        >
          <TokenIcon className={`h-4 w-4 ${tokenStatus.color}`} />
          <span className={`text-sm font-medium ${tokenStatus.color}`}>
            {tokenStatus.text}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full"
            >
              {isDownloading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              className="w-full"
            >
              {copySuccess ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </>
              )}
            </Button>
          </div>

          {/* Show regenerate button if token is expired or expiring */}
          {(tokenStatus.status === "expired" || tokenStatus.status === "expiring") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRegenerateToken}
              disabled={isRegenerating}
              className="w-full"
            >
              {isRegenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Regenerate Token
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
