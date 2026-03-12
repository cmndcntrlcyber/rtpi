import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TargetCard from "./TargetCard";

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

interface Operation {
  id: string;
  name: string;
  [key: string]: any;
}

interface TargetGroup {
  key: string;
  label: string;
  targets: Target[];
}

interface TargetListProps {
  targets: Target[];
  operations?: Operation[];
  loading?: boolean;
  onSelect?: (target: Target) => void;
  onEdit?: (target: Target) => void;
  onDelete?: (target: Target) => void;
  onScan?: (target: Target) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string, selected: boolean) => void;
  expandedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  targetOrder: Record<string, string[]>;
  onDragEnd: (groupKey: string, event: DragEndEvent) => void;
}

function TargetGroupSection({
  group,
  expanded,
  onToggle,
  targetOrder,
  onDragEnd,
  onSelect,
  onEdit,
  onDelete,
  onScan,
  selectable,
  selectedIds,
  onSelectionChange,
}: {
  group: TargetGroup;
  expanded: boolean;
  onToggle: () => void;
  targetOrder: string[];
  onDragEnd: (event: DragEndEvent) => void;
  onSelect?: (target: Target) => void;
  onEdit?: (target: Target) => void;
  onDelete?: (target: Target) => void;
  onScan?: (target: Target) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string, selected: boolean) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort targets according to saved order
  const sortedTargets = useMemo(() => {
    if (!targetOrder || targetOrder.length === 0) return group.targets;
    const orderMap = new Map(targetOrder.map((id, idx) => [id, idx]));
    return [...group.targets].sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? Infinity;
      const bIdx = orderMap.get(b.id) ?? Infinity;
      return aIdx - bIdx;
    });
  }, [group.targets, targetOrder]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Group header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="font-semibold text-sm text-foreground">{group.label}</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {group.targets.length} target{group.targets.length !== 1 ? "s" : ""}
        </Badge>
      </button>

      {/* Collapsible target rows */}
      {expanded && (
        <div className="max-h-[350px] overflow-y-auto border-t border-border">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={sortedTargets.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="p-2 space-y-1">
                {sortedTargets.map((target) => (
                  <TargetCard
                    key={target.id}
                    target={target}
                    variant="row"
                    sortable
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onScan={onScan}
                    selectable={selectable}
                    selected={selectedIds?.has(target.id)}
                    onSelectionChange={onSelectionChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

export default function TargetList({
  targets,
  operations = [],
  loading,
  onSelect,
  onEdit,
  onDelete,
  onScan,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  expandedGroups,
  onToggleGroup,
  targetOrder,
  onDragEnd,
}: TargetListProps) {
  // Build operation lookup
  const operationMap = useMemo(() => {
    const map = new Map<string, string>();
    operations.forEach((op) => map.set(op.id, op.name));
    return map;
  }, [operations]);

  // Group targets by operation
  const groups = useMemo(() => {
    const groupMap = new Map<string, Target[]>();

    targets.forEach((target) => {
      const key = target.operationId || "__unassigned__";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(target);
    });

    const result: TargetGroup[] = [];
    // Named operations first (sorted by name)
    const namedGroups: TargetGroup[] = [];
    groupMap.forEach((groupTargets, key) => {
      if (key === "__unassigned__") return;
      namedGroups.push({
        key,
        label: operationMap.get(key) || "Unknown Operation",
        targets: groupTargets,
      });
    });
    namedGroups.sort((a, b) => a.label.localeCompare(b.label));
    result.push(...namedGroups);

    // Unassigned last
    const unassigned = groupMap.get("__unassigned__");
    if (unassigned) {
      result.push({ key: "__unassigned__", label: "Unassigned", targets: unassigned });
    }

    return result;
  }, [targets, operationMap]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border animate-pulse">
            <div className="w-4 h-4 bg-muted rounded" />
            <div className="w-7 h-7 bg-muted rounded-full" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-3 bg-muted rounded w-1/5" />
            <div className="ml-auto flex gap-1">
              <div className="h-7 w-14 bg-muted rounded" />
              <div className="h-7 w-12 bg-muted rounded" />
              <div className="h-7 w-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!targets || targets.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <div className="mx-auto w-24 h-24 mb-4 text-gray-300">
          <svg
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No targets found</h3>
        <p className="text-muted-foreground mb-4">
          Targets are the systems, networks, or applications you want to assess.
        </p>
        <div className="max-w-md mx-auto text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground mb-3">Get started by adding:</p>
          <ul className="text-left space-y-2">
            <li className="flex items-start">
              <span className="text-primary mr-2">&bull;</span>
              <span>IP addresses (e.g., 192.168.1.1)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">&bull;</span>
              <span>Domain names (e.g., example.com)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">&bull;</span>
              <span>URL endpoints (e.g., https://api.example.com)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">&bull;</span>
              <span>Network ranges (e.g., 10.0.0.0/24)</span>
            </li>
          </ul>
          <p className="mt-4 pt-4 border-t border-border">
            Click <strong>&quot;Add Target&quot;</strong> above to create your first target
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <TargetGroupSection
          key={group.key}
          group={group}
          expanded={expandedGroups.has(group.key)}
          onToggle={() => onToggleGroup(group.key)}
          targetOrder={targetOrder[group.key] || []}
          onDragEnd={(event) => onDragEnd(group.key, event)}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onScan={onScan}
          selectable={selectable}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
        />
      ))}
    </div>
  );
}
