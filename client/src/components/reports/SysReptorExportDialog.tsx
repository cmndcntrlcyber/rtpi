import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { useSysReptorDesigns, useExportToSysReptor } from "@/hooks/useSysReptor";

interface SysReptorExportDialogProps {
  open: boolean;
  onClose: () => void;
  operationId: string;
  operationName?: string;
}

export default function SysReptorExportDialog({
  open,
  onClose,
  operationId,
  operationName,
}: SysReptorExportDialogProps) {
  const { designs, loading: designsLoading } = useSysReptorDesigns();
  const { exportOperation, exporting } = useExportToSysReptor();

  const [selectedDesign, setSelectedDesign] = useState("");
  const [projectName, setProjectName] = useState("");
  const [tags, setTags] = useState("rtpi,automated");

  useEffect(() => {
    if (open && operationName) {
      setProjectName(`${operationName} - Pentest Report`);
    }
  }, [open, operationName]);

  const handleExport = async () => {
    if (!selectedDesign) {
      toast.error("Please select a report design template");
      return;
    }

    try {
      const result = await exportOperation({
        operationId,
        designId: selectedDesign,
        name: projectName || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      });

      toast.success(`Exported ${result.findingsExported} findings to SysReptor`);
      onClose();

      if (result.project?.url) {
        window.open(result.project.url, "_blank");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  const handleClose = () => {
    if (!exporting) {
      setSelectedDesign("");
      setProjectName("");
      setTags("rtpi,automated");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export to SysReptor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="sysreptor-design">Report Design *</Label>
            {designsLoading ? (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading designs...
              </div>
            ) : designs.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                No designs found. Create a design template in SysReptor first.
              </p>
            ) : (
              <Select value={selectedDesign} onValueChange={setSelectedDesign}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a design..." />
                </SelectTrigger>
                <SelectContent>
                  {designs.map((design) => (
                    <SelectItem key={design.id} value={design.id}>
                      {design.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="sysreptor-name">Project Name</Label>
            <Input
              id="sysreptor-name"
              className="mt-1"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Leave empty to auto-generate"
            />
          </div>

          <div>
            <Label htmlFor="sysreptor-tags">Tags (comma-separated)</Label>
            <Input
              id="sysreptor-tags"
              className="mt-1"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="rtpi, automated, web"
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={exporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || !selectedDesign || designs.length === 0}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Export to SysReptor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
