import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, X, FileText, Play, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { RustNexusTask, RustNexusImplant } from "./ImplantsTab";

interface TasksTableProps {
  tasks: RustNexusTask[];
  implants: RustNexusImplant[];
  loading: boolean;
  onRefresh: () => void;
  selectedImplantId: string | null;
  onSelectImplant: (implantId: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "default";
    case "running":
      return "outline";
    case "failed":
      return "destructive";
    case "queued":
      return "secondary";
    case "cancelled":
      return "secondary";
    default:
      return "secondary";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "running":
      return <Play className="h-3 w-3 mr-1" />;
    case "queued":
      return <Clock className="h-3 w-3 mr-1" />;
    default:
      return null;
  }
};

export default function TasksTable({
  tasks,
  implants,
  loading,
  onRefresh,
  selectedImplantId,
  onSelectImplant,
}: TasksTableProps) {
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);

  const handleCancelTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to cancel this task?")) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/rust-nexus/tasks/${taskId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        // Debug logging removed
        onRefresh();
      } else {
        console.error("Failed to cancel task");
      }
    } catch (error) {
      // Error already shown via toast
    }
  };

  const handleViewResults = async (taskId: string) => {
    setViewingTaskId(taskId);
    // TODO: Open results modal
    // Debug logging removed
  };

  return (
    <div className="space-y-4">
      {/* Filter by implant */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Filter by Implant:</label>
        <Select
          value={selectedImplantId || "all"}
          onValueChange={(value) => onSelectImplant(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All implants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Implants</SelectItem>
            {implants.map((implant) => (
              <SelectItem key={implant.id} value={implant.id}>
                {implant.implantName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tasks Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Task Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Implant</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Loading tasks...
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No tasks found
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => {
                const implant = implants.find((i) => i.id === task.implantId);
                const duration = task.executionTimeMs
                  ? `${(task.executionTimeMs / 1000).toFixed(2)}s`
                  : task.startedAt
                  ? formatDistanceToNow(new Date(task.startedAt))
                  : "N/A";

                return (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Badge variant={getStatusColor(task.status)} className="capitalize">
                        {getStatusIcon(task.status)}
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{task.taskName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {task.taskType.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {implant?.implantName || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-2 w-1 rounded ${
                              i < task.priority ? "bg-blue-600" : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                task.status === "completed"
                                  ? "bg-green-500"
                                  : task.status === "failed"
                                  ? "bg-red-500"
                                  : "bg-blue-500"
                              }`}
                              style={{ width: `${task.progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs">{task.progressPercentage}%</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{duration}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {(task.status === "completed" || task.status === "failed") && (
                            <DropdownMenuItem onClick={() => handleViewResults(task.id)}>
                              <FileText className="h-4 w-4 mr-2" />
                              View Results
                            </DropdownMenuItem>
                          )}
                          {(task.status === "queued" || task.status === "running") && (
                            <DropdownMenuItem
                              onClick={() => handleCancelTask(task.id)}
                              className="text-red-600"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel Task
                            </DropdownMenuItem>
                          )}
                          {task.errorMessage && (
                            <>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1 text-xs text-red-600">
                                Error: {task.errorMessage}
                              </div>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
