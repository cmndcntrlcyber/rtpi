import TargetCard from "./TargetCard";

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

interface TargetListProps {
  targets: Target[];
  loading?: boolean;
  onSelect?: (target: Target) => void;
  onEdit?: (target: Target) => void;
  onDelete?: (target: Target) => void;
  onScan?: (target: Target) => void;
}

export default function TargetList({ targets, loading, onSelect, onEdit, onDelete, onScan }: TargetListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-lg p-6 border border-gray-200 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!targets || targets.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
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
        <h3 className="text-lg font-medium text-gray-900 mb-2">No targets found</h3>
        <p className="text-gray-500 mb-4">Add targets to begin scanning</p>
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
        />
      ))}
    </div>
  );
}
