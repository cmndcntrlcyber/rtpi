import { AlertTriangle, Trash2, Archive, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type BulkActionType = "delete" | "archive" | "status-change" | "custom";

interface BulkConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: BulkActionType;
  itemCount: number;
  itemType?: string;
  actionLabel?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

const actionConfig: Record<
  BulkActionType,
  {
    icon: React.ReactNode;
    title: string;
    confirmLabel: string;
    variant: "default" | "destructive";
  }
> = {
  delete: {
    icon: <Trash2 className="h-5 w-5 text-destructive" />,
    title: "Delete Items",
    confirmLabel: "Delete",
    variant: "destructive",
  },
  archive: {
    icon: <Archive className="h-5 w-5 text-blue-600" />,
    title: "Archive Items",
    confirmLabel: "Archive",
    variant: "default",
  },
  "status-change": {
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    title: "Change Status",
    confirmLabel: "Confirm",
    variant: "default",
  },
  custom: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    title: "Confirm Action",
    confirmLabel: "Confirm",
    variant: "default",
  },
};

export function BulkConfirmDialog({
  open,
  onOpenChange,
  actionType,
  itemCount,
  itemType = "item",
  actionLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading = false,
}: BulkConfirmDialogProps) {
  const config = actionConfig[actionType];
  const finalTitle = title || config.title;
  const finalConfirmLabel = confirmLabel || config.confirmLabel;

  const getDescription = () => {
    if (description) return description;

    const itemText = itemCount === 1 ? itemType : `${itemType}s`;
    const action = actionLabel || actionType;

    switch (actionType) {
      case "delete":
        return (
          <>
            Are you sure you want to delete {itemCount} {itemText}?{" "}
            <span className="font-semibold text-destructive">
              This action cannot be undone.
            </span>
          </>
        );
      case "archive":
        return `Are you sure you want to archive ${itemCount} ${itemText}? You can restore them later from the archive.`;
      case "status-change":
        return `This will update the status of ${itemCount} ${itemText}.`;
      default:
        return `Are you sure you want to ${action} ${itemCount} ${itemText}?`;
    }
  };

  const handleConfirm = async () => {
    await onConfirm();
    if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {finalTitle}
          </DialogTitle>
          <DialogDescription className="text-left pt-2">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {itemCount > 0 && (
          <div className="bg-secondary/30 rounded-lg p-4 my-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Items affected:
              </span>
              <span className="text-sm font-bold text-foreground">
                {itemCount}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={config.variant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : finalConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
