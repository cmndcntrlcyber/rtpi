import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, RefreshCw, Trash2 } from "lucide-react";

interface EmpireServer {
  id: string;
  name: string;
  host: string;
  port: number;
  restApiUrl: string;
  status: string;
  version: string | null;
  lastHeartbeat: string | null;
  isActive: boolean;
}

interface EmpireServerCardProps {
  server: EmpireServer;
  onCheckConnection: (server: EmpireServer) => void;
  onRefreshToken: (server: EmpireServer) => void;
  onDelete: (server: EmpireServer) => void;
}

export default function EmpireServerCard({
  server,
  onCheckConnection,
  onRefreshToken,
  onDelete,
}: EmpireServerCardProps) {
  const isConnected = server.status === "connected";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{server.name}</CardTitle>
            <CardDescription>
              {server.host}:{server.port}
            </CardDescription>
          </div>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className={isConnected ? "bg-green-600" : "bg-gray-400"}
          >
            {isConnected ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {server.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Version:</span>
            <p className="font-medium">{server.version || "Unknown"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Last Heartbeat:</span>
            <p className="font-medium">
              {server.lastHeartbeat
                ? new Date(server.lastHeartbeat).toLocaleString()
                : "Never"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCheckConnection(server)}
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Connection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRefreshToken(server)}
            className="flex-1"
          >
            Refresh Token
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(server)}
            className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
