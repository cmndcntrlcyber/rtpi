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

interface TargetListProps {
  targets: Target[];
  loading?: boolean;
  onSelect?: (target: Target) => void;
  onEdit?: (target: Target) => void;
  onDelete?: (target: Target) => void;
  onScan?: (target: Target) => void;
  // Bulk selection props
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export default function TargetList({
  targets,
  loading,
  onSelect,
  onEdit,
  onDelete,
  onScan,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange
}: TargetListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-card rounded-lg p-6 border border-border animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-muted rounded w-2/3"></div>
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
              <span className="text-primary mr-2">•</span>
              <span>IP addresses (e.g., 192.168.1.1)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>Domain names (e.g., example.com)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>URL endpoints (e.g., https://api.example.com)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>Network ranges (e.g., 10.0.0.0/24)</span>
            </li>
          </ul>
          <p className="mt-4 pt-4 border-t border-border">
            Click <strong>"Add Target"</strong> above to create your first target
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {targets.map((target) => (
        <TargetCard
          key={target.id}
          target={target}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onScan={onScan}
          selectable={selectable}
          selected={selectedIds.has(target.id)}
          onSelectionChange={onSelectionChange}
        />
      ))}
    </div>
  );
}
