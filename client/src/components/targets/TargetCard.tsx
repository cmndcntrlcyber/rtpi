import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe, Server, Radio, Edit, Trash2, Scan } from "lucide-react";

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
  onSelect?: (target: Target) => void;
  onEdit?: (target: Target) => void;
  onDelete?: (target: Target) => void;
  onScan?: (target: Target) => void;
  // Bulk selection props
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export default function TargetCard({
  target,
  onSelect,
  onEdit,
  onDelete,
  onScan,
  selectable = false,
  selected = false,
  onSelectionChange
}: TargetCardProps) {
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

  return (
    <Card
      className={`bg-card border-border hover:shadow-md cursor-pointer transition-all ${
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

        {/* Target Details */}
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

        {/* Description if exists */}
        {target.description && (
          <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-gray-100 line-clamp-2">
            {target.description}
          </p>
        )}

        {/* Action Buttons */}
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
