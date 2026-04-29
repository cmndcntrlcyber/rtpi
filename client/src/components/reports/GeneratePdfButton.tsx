import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FilePlus2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useFeatureFlag } from "@/lib/feature-flags";

interface GeneratePdfButtonProps {
  reportId: string;
  reportName: string;
  /** Optional override of size variant; defaults to "sm" to fit row layouts. */
  size?: "default" | "sm";
  variant?: "default" | "ghost" | "outline";
}

interface PdfJob {
  id: string;
  reportId: string;
  status: "queued" | "rendering" | "completed" | "failed";
  fileSize?: number;
  error?: string;
  durationMs?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  downloadUrl?: string | null;
}

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_MS = 5 * 60 * 1000; // give up after 5 min

/**
 * Render-PDF action gated on FF_PDF_NATIVE. Hidden entirely when the flag is
 * off so the button doesn't tease functionality the user can't activate.
 *
 * Click → POST /reports/:id/pdf → poll GET /reports/jobs/:jobId until
 * completed/failed → trigger browser download on success.
 */
export default function GeneratePdfButton({
  reportId,
  reportName,
  size = "sm",
  variant = "ghost",
}: GeneratePdfButtonProps) {
  const enabled = useFeatureFlag("pdfNative");
  const [working, setWorking] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => () => {
    cancelledRef.current = true;
  }, []);

  if (!enabled) return null;

  async function pollJob(jobId: string): Promise<PdfJob> {
    const deadline = Date.now() + POLL_MAX_MS;
    while (!cancelledRef.current) {
      const { job } = await api.get<{ job: PdfJob }>(`/reports/jobs/${jobId}`);
      if (job.status === "completed" || job.status === "failed") {
        return job;
      }
      setStatusLabel(job.status === "rendering" ? "Rendering…" : "Queued…");
      if (Date.now() > deadline) {
        throw new Error("Render did not complete within 5 minutes.");
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error("Cancelled");
  }

  async function downloadCompleted(jobId: string, suggestedName: string): Promise<void> {
    const response = await fetch(`/api/v1/reports/jobs/${jobId}/download`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${suggestedName}.${contentType.includes("html") ? "html" : "pdf"}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async function handleClick(): Promise<void> {
    if (working) return;
    setWorking(true);
    setStatusLabel("Queueing…");
    try {
      const { jobId } = await api.post<{ jobId: string; status: string }>(
        `/reports/${reportId}/pdf`,
        {},
      );
      const job = await pollJob(jobId);
      if (job.status === "failed") {
        toast.error(job.error || "PDF render failed");
        return;
      }
      const safeName = reportName.replace(/[^a-z0-9]+/gi, "_");
      await downloadCompleted(jobId, safeName);
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF render failed");
    } finally {
      if (!cancelledRef.current) {
        setWorking(false);
        setStatusLabel(null);
      }
    }
  }

  return (
    <Button
      size={size}
      variant={variant}
      className="h-7 px-2"
      onClick={handleClick}
      disabled={working}
    >
      {working ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <FilePlus2 className="h-3 w-3 mr-1" />
      )}
      {working ? statusLabel ?? "Working…" : "PDF"}
    </Button>
  );
}
