import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useFeatureFlag } from "@/lib/feature-flags";

interface PublishToDocmostButtonProps {
  reportId: string;
  size?: "default" | "sm";
}

interface PublishResponse {
  page: { id: string; title: string; workspaceId: string; url: string };
}

/**
 * Per-report action gated on FF_DOCMOST. Hidden when the flag is off so the
 * button doesn't tease functionality the user can't activate.
 *
 * Click → POST /docmost/pages with { reportId } → server loads the report
 * row and creates a Docmost page from its content. On success, opens the
 * new page in a new tab.
 */
export default function PublishToDocmostButton({
  reportId,
  size = "sm",
}: PublishToDocmostButtonProps) {
  const enabled = useFeatureFlag("docmost");
  const [working, setWorking] = useState(false);

  if (!enabled) return null;

  async function handleClick() {
    if (working) return;
    setWorking(true);
    try {
      const result = await api.post<PublishResponse>("/docmost/pages", { reportId });
      toast.success("Published to Docmost", {
        description: result.page.title,
        action: {
          label: "Open",
          onClick: () => window.open(result.page.url, "_blank"),
        },
      });
      // Auto-open the page so users don't have to click the toast action.
      window.open(result.page.url, "_blank");
    } catch (err: any) {
      const data = err?.data;
      if (data?.error === "Docmost not configured") {
        toast.error("Docmost is not configured. Set DOCMOST_API_TOKEN in your environment.");
      } else {
        toast.error(data?.details || data?.error || err?.message || "Publish failed");
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <Button
      size={size}
      variant="ghost"
      className="h-7 px-2"
      onClick={handleClick}
      disabled={working}
      title="Publish this report as a Docmost page"
    >
      {working ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <BookOpen className="h-3 w-3 mr-1" />
      )}
      Docmost
      {!working && <ExternalLink className="h-3 w-3 ml-1 opacity-60" />}
    </Button>
  );
}
