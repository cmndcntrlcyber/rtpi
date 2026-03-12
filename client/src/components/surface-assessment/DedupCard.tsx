import { useState, useEffect } from "react";
import { Loader2, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface DedupCardProps {
  operationId: string;
}

interface DedupAnalysis {
  duplicateAssets: number;
  duplicateServices: number;
  duplicateVulnerabilities: number;
  totalDuplicateRows: number;
}

interface DedupResult extends DedupAnalysis {
  assetsRemoved: number;
  servicesRemoved: number;
  vulnerabilitiesRemoved: number;
  servicesReassigned: number;
}

export default function DedupCard({ operationId }: DedupCardProps) {
  const [analysis, setAnalysis] = useState<DedupAnalysis | null>(null);
  const [result, setResult] = useState<DedupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<DedupAnalysis>(
        `/surface-assessment/${operationId}/dedup/analyze`
      );
      setAnalysis(data);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (operationId) loadAnalysis();
  }, [operationId]);

  const runDedup = async () => {
    try {
      setRunning(true);
      setError(null);
      const data = await api.post<DedupResult>(
        `/surface-assessment/${operationId}/dedup/run`
      );
      setResult(data);
      // Refresh analysis to show updated counts
      const updated = await api.get<DedupAnalysis>(
        `/surface-assessment/${operationId}/dedup/analyze`
      );
      setAnalysis(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deduplicate");
    } finally {
      setRunning(false);
    }
  };

  const hasDuplicates = analysis && analysis.totalDuplicateRows > 0;

  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Data Deduplication</h3>
          <p className="text-sm text-muted-foreground">
            Find and merge duplicate assets, services, and vulnerabilities
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadAnalysis}
          disabled={loading || running}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive mb-4">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading && !analysis && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing duplicates...
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          {hasDuplicates ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <DupStat label="Duplicate Assets" count={analysis.duplicateAssets} />
                <DupStat label="Duplicate Services" count={analysis.duplicateServices} />
                <DupStat label="Duplicate Vulns" count={analysis.duplicateVulnerabilities} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {analysis.totalDuplicateRows} total duplicate rows found
                </p>
                <Button
                  onClick={runDedup}
                  disabled={running}
                  variant="destructive"
                  size="sm"
                >
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deduplicating...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deduplicate
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              No duplicates found — data is clean
            </div>
          )}

          {result && (
            <div className="mt-4 p-3 rounded-md bg-muted/50 text-sm space-y-1">
              <p className="font-medium text-foreground">Deduplication complete</p>
              <p className="text-muted-foreground">
                Removed {result.assetsRemoved} assets, {result.servicesRemoved} services, {result.vulnerabilitiesRemoved} vulnerabilities
              </p>
              {result.servicesReassigned > 0 && (
                <p className="text-muted-foreground">
                  Reassigned {result.servicesReassigned} services to surviving assets
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DupStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="text-center p-3 rounded-md bg-muted/50">
      <p className="text-2xl font-bold text-foreground">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
