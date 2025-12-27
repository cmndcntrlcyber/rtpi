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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Power,
  Settings,
  Info,
  Trash2,
  Activity,
  Circle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { RustNexusImplant } from "./ImplantsTab";
import ImplantDetailModal from "./ImplantDetailModal";

interface ImplantsTableProps {
  implants: RustNexusImplant[];
  loading: boolean;
  onRefresh: () => void;
  onTerminate: (implantId: string) => void;
  onSelectImplant: (implantId: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "connected":
      return "bg-green-500";
    case "idle":
      return "bg-blue-500";
    case "busy":
      return "bg-yellow-500";
    case "disconnected":
      return "bg-gray-400";
    case "terminated":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    connected: "default",
    idle: "secondary",
    busy: "outline",
    disconnected: "secondary",
    terminated: "destructive",
  };

  return (
    <Badge variant={variants[status] || "secondary"} className="capitalize">
      <Circle className={`h-2 w-2 mr-1 ${getStatusColor(status)}`} fill="currentColor" />
      {status}
    </Badge>
  );
};

const getImplantTypeIcon = (type: string) => {
  const colors: Record<string, string> = {
    reconnaissance: "text-blue-600",
    exploitation: "text-red-600",
    exfiltration: "text-purple-600",
    general: "text-gray-600",
  };

  return (
    <Badge variant="outline" className={`capitalize ${colors[type] || "text-gray-600"}`}>
      {type}
    </Badge>
  );
};

export default function ImplantsTable({
  implants,
  loading,
  onRefresh,
  onTerminate,
  onSelectImplant,
}: ImplantsTableProps) {
  const [selectedImplant, setSelectedImplant] = useState<RustNexusImplant | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const handleViewDetails = (implant: RustNexusImplant) => {
    setSelectedImplant(implant);
    setDetailModalOpen(true);
  };

  const handleUpdateConfig = (implant: RustNexusImplant) => {
    // TODO: Open configuration dialog
    console.log("Update config for", implant.implantName);
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Implant Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead>Last Heartbeat</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Loading implants...
                </TableCell>
              </TableRow>
            ) : implants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No implants registered yet
                </TableCell>
              </TableRow>
            ) : (
              implants.map((implant) => (
                <TableRow
                  key={implant.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectImplant(implant.id)}
                >
                  <TableCell>{getStatusBadge(implant.status)}</TableCell>
                  <TableCell className="font-medium">{implant.implantName}</TableCell>
                  <TableCell>{getImplantTypeIcon(implant.implantType)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">{implant.hostname}</span>
                      <span className="text-xs text-muted-foreground">
                        {implant.osType} {implant.osVersion && `(${implant.osVersion})`}
                      </span>
                      {implant.ipAddress && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {implant.ipAddress}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{implant.version}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="text-green-600">✓ {implant.totalTasksCompleted}</span>
                      {implant.totalTasksFailed > 0 && (
                        <span className="text-red-600">✗ {implant.totalTasksFailed}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {implant.lastHeartbeat
                      ? formatDistanceToNow(new Date(implant.lastHeartbeat), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Activity
                          className={`h-4 w-4 ${
                            implant.connectionQuality > 80
                              ? "text-green-600"
                              : implant.connectionQuality > 50
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        />
                        <span className="text-sm">{implant.connectionQuality}%</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleViewDetails(implant)}>
                          <Info className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateConfig(implant)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onTerminate(implant.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Terminate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Modal */}
      {selectedImplant && (
        <ImplantDetailModal
          implant={selectedImplant}
          open={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedImplant(null);
          }}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
