import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, X } from "lucide-react";

interface EditReportDialogProps {
  open: boolean;
  onClose: () => void;
  report: any;
  onSave: (reportId: string, content: string) => void;
}

export default function EditReportDialog({
  open,
  onClose,
  report,
  onSave,
}: EditReportDialogProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load report content when dialog opens
  useEffect(() => {
    if (open && report) {
      loadReportContent();
    }
  }, [open, report]);

  const loadReportContent = async () => {
    setLoading(true);
    try {
      // Try to fetch content from API
      const response = await fetch(`/api/v1/reports/${report.id}/content`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const reportContent = await response.text();
        setContent(reportContent);
      } else {
        // If API doesn't exist, create default content
        setContent(generateDefaultContent());
      }
    } catch (error) {
      console.error("Error loading report content:", error);
      // Fallback to default content
      setContent(generateDefaultContent());
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultContent = () => {
    return `# ${report.name}

**Report Type:** ${report.type}
**Generated:** ${new Date(report.generatedAt).toLocaleDateString()}
**Status:** ${report.status}

## Executive Summary

[Add your executive summary here]

## Methodology

[Describe the testing methodology used]

## Findings

[Add your detailed findings here]

## Recommendations

[Add your recommendations here]

## Conclusion

[Add your conclusion here]

---

*This report was generated using the RTPI Red Team Platform.*
`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // For now, we'll just close the dialog and show success
      // In a real implementation, you'd save to the API
      onSave(report.id, content);
      onClose();
    } catch (error) {
      console.error("Error saving report:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setContent("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit Report: {report?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-muted-foreground">Loading report content...</div>
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Edit your report content here..."
              className="min-h-96 font-mono text-sm resize-none"
              style={{ height: "600px" }}
            />
          )}
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            <X className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving..." : "Save Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
