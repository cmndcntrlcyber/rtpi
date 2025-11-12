import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Server, Radio, Edit, Trash2, Scan } from "lucide-react";

interface Target {
  id: string;
  hostname?: string;
  ipAddress?: string;
  domain?: string;
  port?: number;
  status: string;
  operationId?: string;
  notes?: string;
  lastScanAt?: string;
}

interface TargetCardProps {
  target: Target;
  onSelect?: (target: Target) => void;
  onEdit?: (target: Target) => void;
  onDelete?: (target: Target) => void;
  onScan?: (target: Target) => void;
}

const statusColors = {
  active: "bg-green-500/10 text-green-400",
  inactive: "bg-gray-500/10 text-gray-400",
  scanning: "bg-blue-500/10 text-blue-400",
  vulnerable: "bg-red-500/10 text-red-400",
  secured: "bg-green-500/10 text-green-400",
};

export default function TargetCard({ target, onSelect, onEdit, onDelete, onScan }: TargetCardProps) {
  const handleClick = () => {
    if (onSelect) {
      onSelect(target);
    }
  };

  const displayName = target.hostname || target.domain || target.ipAddress || "Unknown Target";

  return (
    <Card 
      className="bg-white border-gray-200 hover:shadow-md cursor-pointer transition-all"
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center flex-1">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white mr-3">
              <Server className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
              {target.ipAddress && (
                <p className="text-sm text-gray-500 flex items-center mt-0.5">
                  <Radio className="h-3 w-3 mr-1" />
                  {target.ipAddress}
                  {target.port && `:${target.port}`}
                </p>
              )}
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={`${statusColors[target.status as keyof typeof statusColors]} px-2 py-1 text-xs font-medium ml-2`}
          >
            {target.status}
          </Badge>
        </div>

        {/* Target Details */}
        <div className="space-y-2 text-sm mb-3">
          {target.domain && (
            <div className="flex items-center text-gray-600">
              <Globe className="h-4 w-4 mr-2" />
              <span className="truncate">{target.domain}</span>
            </div>
          )}
          {target.lastScanAt && (
            <div className="text-xs text-gray-500">
              Last scan: {new Date(target.lastScanAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Notes if exist */}
        {target.notes && (
          <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100 line-clamp-2">
            {target.notes}
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
