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
import { Circle, Skull, Terminal } from "lucide-react";

interface EmpireAgent {
  ID: number;
  session_id: string;
  name: string;
  hostname: string;
  internal_ip: string;
  external_ip: string;
  username: string;
  high_integrity: boolean;
  process_name: string;
  process_id: number;
  language: string;
  os_details: string;
  architecture: string;
  checkin_time: string;
  lastseen_time: string;
}

interface EmpireAgentsTableProps {
  agents: EmpireAgent[];
  onExecuteCommand: (agentName: string) => void;
  onKillAgent: (agentName: string) => void;
}

export default function EmpireAgentsTable({
  agents,
  onExecuteCommand,
  onKillAgent,
}: EmpireAgentsTableProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No active agents</p>
        <p className="text-sm text-gray-400 mt-2">
          Deploy a stager to get agent callbacks
        </p>
      </div>
    );
  }

  const getStatusBadge = (agent: EmpireAgent) => {
    const lastSeen = new Date(agent.lastseen_time);
    const now = new Date();
    const minutesAgo = (now.getTime() - lastSeen.getTime()) / 1000 / 60;

    if (minutesAgo < 5) {
      return (
        <Badge variant="default" className="bg-green-600">
          <Circle className="h-2 w-2 mr-1 fill-current" />
          Active
        </Badge>
      );
    } else if (minutesAgo < 60) {
      return (
        <Badge variant="default" className="bg-yellow-600">
          <Circle className="h-2 w-2 mr-1 fill-current" />
          Stale
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-gray-400">
          <Circle className="h-2 w-2 mr-1 fill-current" />
          Lost
        </Badge>
      );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Integrity</TableHead>
            <TableHead>Process</TableHead>
            <TableHead>OS</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Seen</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.ID}>
              <TableCell className="font-medium font-mono">{agent.name}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium">{agent.hostname}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    {agent.internal_ip}
                  </p>
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {agent.username}
              </TableCell>
              <TableCell>
                <Badge
                  variant={agent.high_integrity ? "destructive" : "secondary"}
                >
                  {agent.high_integrity ? "HIGH" : "LOW"}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {agent.process_name} ({agent.process_id})
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="text-sm">{agent.language}</p>
                  <p className="text-xs text-gray-500">{agent.architecture}</p>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(agent)}</TableCell>
              <TableCell className="text-sm text-gray-500">
                {new Date(agent.lastseen_time).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onExecuteCommand(agent.name)}
                  >
                    <Terminal className="h-4 w-4 mr-1" />
                    Shell
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onKillAgent(agent.name)}
                  >
                    <Skull className="h-4 w-4 mr-1" />
                    Kill
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
