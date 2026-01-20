import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { BundleGrid } from "./BundleGrid";

interface Bundle {
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
}

interface BundlesTabProps {
  refreshTrigger?: number;
}

export function BundlesTab({ refreshTrigger }: BundlesTabProps) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch bundles from API
  const fetchBundles = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(
        "/api/v1/rust-nexus/agents/bundles?limit=50&isActive=true",
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setBundles(data);
        setLastRefresh(new Date());
      } else {
        throw new Error("Failed to fetch bundles");
      }
    } catch (err) {
      console.error("Failed to fetch bundles:", err);
      setError("Failed to load bundles");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Manual refresh
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchBundles(false);
  };

  // Initial fetch
  useEffect(() => {
    fetchBundles(false);
  }, []);

  // React to refresh trigger from parent (when new bundle is generated)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchBundles(true);
    }
  }, [refreshTrigger]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const startAutoRefresh = () => {
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchBundles(true); // Silent refresh
        }
      }, 30000); // 30 seconds
    };

    startAutoRefresh();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        startAutoRefresh();
        fetchBundles(true); // Refresh when tab becomes visible
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-600">Agent Bundles</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View and download previously generated agent bundles
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchBundles(false)}>
            Retry
          </Button>
        </div>
      )}

      {/* Bundle grid */}
      <BundleGrid
        bundles={bundles}
        loading={loading}
        onRefresh={() => fetchBundles(true)}
      />
    </div>
  );
}
