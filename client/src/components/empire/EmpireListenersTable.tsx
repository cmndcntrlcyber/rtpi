import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayCircle, StopCircle } from "lucide-react";

interface EmpireListener {
  ID: number;
  name: string;
  module: string;
  listener_type: string;
  listener_category: string;
  enabled: boolean;
  options: Record<string, any>;
  created_at: string;
}

interface EmpireListenersTableProps {
  listeners: EmpireListener[];
  onStop: (listenerName: string) => void;
}

export default function EmpireListenersTable({
  listeners,
  onStop,
}: EmpireListenersTableProps) {
  if (listeners.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No listeners configured</p>
        <p className="text-sm text-gray-400 mt-2">
          Create a listener to start accepting agent connections
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listeners.map((listener) => (
            <TableRow key={listener.ID}>
              <TableCell className="font-medium">{listener.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{listener.listener_type}</Badge>
              </TableCell>
              <TableCell>{listener.listener_category}</TableCell>
              <TableCell className="font-mono text-sm">
                {listener.options?.Host || "N/A"}:{listener.options?.Port || "N/A"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={listener.enabled ? "default" : "secondary"}
                  className={listener.enabled ? "bg-green-600" : "bg-gray-400"}
                >
                  {listener.enabled ? (
                    <PlayCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <StopCircle className="h-3 w-3 mr-1" />
                  )}
                  {listener.enabled ? "Running" : "Stopped"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {new Date(listener.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {listener.enabled && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onStop(listener.name)}
                  >
                    <StopCircle className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
