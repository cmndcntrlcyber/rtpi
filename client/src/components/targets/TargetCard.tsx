import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe, Server, Radio, Edit, Trash2, Scan, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Target {
  id: string;
  name: string;
  type: string;
  value: string;
  description?: string;
  priority?: number;
  tags?: string[];
  operationId?: string;
  discoveredServices?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface TargetCardProps {
  target: Target;
  variant?: "card" | "row";
  sortable?: boolean;
  onSelect?: (target: Target) => void;
  onEdit?: (target: Target) => void;
  onDelete?: (target: Target) => void;
  onScan?: (target: Target) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export default function TargetCard({
  target,
  variant = "card",
  sortable = false,
  onSelect,
  onEdit,
  onDelete,
  onScan,
  selectable = false,
  selected = false,
  onSelectionChange
}: TargetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: target.id, disabled: !sortable });

  const style = sortable
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined;

  const handleClick = () => {
    if (onSelect) {
      onSelect(target);
    }
  };

  const getTypeIcon = () => {
    switch (target.type) {
      case 'domain':
        return <Globe className="h-5 w-5" />;
      case 'network':
      case 'range':
        return <Radio className="h-5 w-5" />;
      default:
        return <Server className="h-5 w-5" />;
    }
  };

  const getBadgeColor = () => {
    if (target.priority && target.priority >= 4) return "bg-red-500/10 text-red-600";
    if (target.priority && target.priority >= 3) return "bg-orange-500/10 text-orange-600";
    return "bg-blue-500/10 text-blue-600";
  };

  const handleSelectionChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectionChange) {
      onSelectionChange(target.id, !selected);
    }
  };

  if (variant === "row") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-all ${
          selected ? "ring-2 ring-primary ring-offset-1" : ""
        }`}
        onClick={handleClick}
      >
        {sortable && (
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {selectable && (
          <div onClick={handleSelectionChange} className="flex-shrink-0">
            <Checkbox checked={selected} />
          </div>
        )}

        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
          {getTypeIcon()}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="font-semibold text-sm text-foreground truncate max-w-[200px]">
            {target.name}
          </span>
          <span className="font-mono text-xs text-muted-foreground truncate max-w-[180px] hidden sm:inline">
            {target.value}
          </span>
          <Badge variant="secondary" className="text-xs flex-shrink-0 hidden md:inline-flex">
            {target.type}
          </Badge>
          {target.priority && (
            <Badge variant="secondary" className={`text-xs flex-shrink-0 ${getBadgeColor()}`}>
              P{target.priority}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {onScan && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={(e) => { e.stopPropagation(); onScan(target); }}
            >
              <Scan className="h-3 w-3 mr-1" />
              Scan
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={(e) => { e.stopPropagation(); onEdit(target); }}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); onDelete(target); }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Original card variant
  return (
    <Card
      className={`bg-card border-border shadow-sm hover:shadow-lg cursor-pointer transition-all duration-200 ${
        selected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center flex-1 gap-3">
            {selectable && (
              <div onClick={handleSelectionChange}>
                <Checkbox checked={selected} />
              </div>
            )}
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
              {getTypeIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{target.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs">
                  {target.type}
                </Badge>
                {target.priority && (
                  <Badge variant="secondary" className={`text-xs ${getBadgeColor()}`}>
                    P{target.priority}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm mb-3">
          <div className="flex items-center text-muted-foreground">
            <Radio className="h-3 w-3 mr-2" />
            <span className="truncate font-mono text-xs">{target.value}</span>
          </div>
          {target.updatedAt && (
            <div className="text-xs text-muted-foreground">
              Updated: {new Date(target.updatedAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {target.description && (
          <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-gray-100 line-clamp-2">
            {target.description}
          </p>
        )}

        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          {onScan && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onScan(target);
              }}
              className="flex-1"
            >
              <Scan className="h-3 w-3 mr-1" />
              Scan
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(target);
              }}
              className="flex-1"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(target);
              }}
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
