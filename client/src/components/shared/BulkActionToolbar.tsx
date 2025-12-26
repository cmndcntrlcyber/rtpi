import { X, Trash2, CheckCircle2, XCircle, Archive, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline";
  action: () => void | Promise<void>;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions?: BulkAction[];
  // Common bulk actions
  onDelete?: () => void;
  onArchive?: () => void;
  onChangeStatus?: (status: string) => void;
  onAddTags?: () => void;
  // Custom quick actions (shown as buttons)
  quickActions?: BulkAction[];
}

export function BulkActionToolbar({
  selectedCount,
  onClearSelection,
  actions = [],
  onDelete,
  onArchive,
  onChangeStatus,
  onAddTags,
  quickActions = [],
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  const hasCommonActions = onDelete || onArchive || onChangeStatus || onAddTags;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
        {/* Selection Count */}
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">
            {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
          </span>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Quick Actions */}
        {quickActions.map((action) => (
          <Button
            key={action.id}
            size="sm"
            variant={action.variant || "outline"}
            onClick={action.action}
            className="h-8"
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </Button>
        ))}

        {/* Common Actions Dropdown */}
        {hasCommonActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onChangeStatus && (
                <>
                  <DropdownMenuItem onClick={() => onChangeStatus("active")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Mark as Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeStatus("completed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" />
                    Mark as Completed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeStatus("archived")}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {onAddTags && (
                <>
                  <DropdownMenuItem onClick={onAddTags}>
                    <Tag className="h-4 w-4 mr-2" />
                    Add Tags
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {onArchive && (
                <>
                  <DropdownMenuItem onClick={onArchive}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Custom Actions Dropdown */}
        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                More Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {actions.map((action, index) => (
                <div key={action.id}>
                  <DropdownMenuItem onClick={action.action}>
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    {action.label}
                  </DropdownMenuItem>
                  {index < actions.length - 1 && <DropdownMenuSeparator />}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="h-6 w-px bg-border" />

        {/* Clear Selection */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          className="h-8"
        >
          <X className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
    </div>
  );
}
