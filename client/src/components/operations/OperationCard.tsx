import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Target, AlertCircle, Clock, Edit, Trash2 } from "lucide-react";

interface Operation {
  id: string;
  name: string;
  description?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  createdBy: string;
  type?: string;
  targets?: number;
  findings?: number;
}

interface OperationCardProps {
  operation: Operation;
  onSelect?: (operation: Operation) => void;
  onEdit?: (operation: Operation) => void;
  onDelete?: (operation: Operation) => void;
}

const statusColors = {
  planning: "bg-blue-500/10 text-blue-400",
  active: "bg-green-500/10 text-green-400",
  paused: "bg-yellow-500/10 text-yellow-400",
  completed: "bg-gray-500/10 text-gray-400",
  failed: "bg-red-500/10 text-red-400"
};

export default function OperationCard({ operation, onSelect, onEdit, onDelete }: OperationCardProps) {
  const handleClick = () => {
    if (onSelect) {
      onSelect(operation);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getColorFromName = (name: string) => {
    const colors = ['bg-blue-600', 'bg-green-600', 'bg-red-600', 'bg-purple-600', 'bg-yellow-600', 'bg-indigo-600'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Card 
      className="bg-white border-gray-200 hover:shadow-md cursor-pointer transition-all"
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3 ${getColorFromName(operation.name)}`}>
              {getInitials(operation.name)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{operation.name}</h3>
              <p className="text-sm text-gray-500 flex items-center mt-0.5">
                <Users className="h-3 w-3 mr-1" />
                Created by {operation.createdBy}
              </p>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={`${statusColors[operation.status as keyof typeof statusColors]} px-2 py-1 text-xs font-medium`}
          >
            {operation.status}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            <span>{formatDate(operation.startedAt)}</span>
          </div>
          <div className="flex items-center text-gray-600">
            {operation.completedAt ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                <span>Ended {formatDate(operation.completedAt)}</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                <span>In progress</span>
              </>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          {operation.type && (
            <Badge variant="outline" className="text-xs">
              {operation.type}
            </Badge>
          )}
          <div className="flex items-center text-xs text-gray-500">
            <Target className="h-3 w-3 mr-1" />
            <span>{operation.targets || 0} targets</span>
          </div>
          {operation.findings !== undefined && (
            <div className="flex items-center text-xs text-gray-500">
              <AlertCircle className="h-3 w-3 mr-1" />
              <span>{operation.findings} findings</span>
            </div>
          )}
        </div>

        {/* Description if exists */}
        {operation.description && (
          <p className="text-sm text-gray-600 mt-3 line-clamp-2">
            {operation.description}
          </p>
        )}

        {/* Action Buttons */}
        {(onEdit || onDelete) && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(operation);
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
                  onDelete(operation);
                }}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
