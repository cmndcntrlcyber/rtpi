/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

interface LinkedTargetsProps {
  operationId?: string;
  onViewAll?: () => void;
  onAddNew?: () => void;
}

export default function LinkedTargets({
  operationId,
  onViewAll,
  onAddNew,
}: LinkedTargetsProps) {
  const [targets, setTargets] = useState<any[]>([]);

  const loadTargets = async () => {
    if (!operationId) return;

    try {
      const response = await api.get<{ targets: any[] }>("/targets");
      // Filter targets for this operation
      const filtered = response.targets.filter(
        (t) => t.operationId === operationId
      );
      setTargets(filtered);
    } catch (error) {
      // Error already shown via toast
    }
  };

  useEffect(() => {
    if (operationId) {
      loadTargets();
    }
  }, [operationId, loadTargets]);

  const total = targets.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Linked Targets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target Count */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {total} {total === 1 ? "Target" : "Targets"}
          </span>
          {total === 0 && (
            <span className="text-sm text-muted-foreground">No targets linked</span>
          )}
        </div>

        {/* Target List */}
        {total > 0 && (
          <div className="space-y-2">
            {targets.slice(0, 3).map((target) => (
              <div
                key={target.id}
                className="flex items-center justify-between p-2 bg-secondary rounded border border-border hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-foreground truncate">
                    {target.name}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {target.type}: {target.value}
                </Badge>
              </div>
            ))}
            {total > 3 && (
              <p className="text-xs text-muted-foreground italic">
                + {total - 3} more targets
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {total > 0 && onViewAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewAll}
              className="flex-1"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View All
            </Button>
          )}
          {onAddNew && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddNew}
              className="flex-1"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Target
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
