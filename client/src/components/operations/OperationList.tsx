import OperationCard from "./OperationCard";

interface Operation {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;  // FIX BUG #2: Match database field names
  endDate?: string;    // FIX BUG #2: Match database field names
  createdBy: string;
  type?: string;
  targets?: number;
  findings?: number;
}

interface OperationListProps {
  operations: Operation[];
  loading?: boolean;
  onSelect?: (operation: Operation) => void;
  onEdit?: (operation: Operation) => void;
  onDelete?: (operation: Operation) => void;
  onStatusChange?: (operationId: string, newStatus: string) => Promise<void>; // FIX BUG #2
  onWorkflowsChange?: () => void; // FIX BUG #2
}

export default function OperationList({ operations, loading, onSelect, onEdit, onDelete, onStatusChange, onWorkflowsChange }: OperationListProps) {
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

  if (!operations || operations.length === 0) {
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No operations found</h3>
        <p className="text-gray-500 mb-4">Get started by creating your first operation</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {operations.map((operation) => (
        <OperationCard
          key={operation.id}
          operation={operation}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onWorkflowsChange={onWorkflowsChange}
        />
      ))}
    </div>
  );
}
