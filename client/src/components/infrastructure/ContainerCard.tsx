import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container, Play, Square, RotateCw } from "lucide-react";

interface ContainerData {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports?: string[];
  created: string;
}

interface ContainerCardProps {
  container: ContainerData;
  onStart?: (container: ContainerData) => void;
  onStop?: (container: ContainerData) => void;
  onRestart?: (container: ContainerData) => void;
}

const statusColors = {
  running: "bg-green-500/10 text-green-600",
  stopped: "bg-gray-500/10 text-gray-600",
  paused: "bg-yellow-500/10 text-yellow-600",
  restarting: "bg-blue-500/10 text-blue-600",
  exited: "bg-red-500/10 text-red-600",
};

export default function ContainerCard({ container, onStart, onStop, onRestart }: ContainerCardProps) {
  const isRunning = container.state === "running";

  return (
    <Card className="bg-white border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center flex-1">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white mr-3">
              <Container className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{container.name}</h3>
              <p className="text-sm text-gray-500 truncate">{container.image}</p>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={`${statusColors[container.state as keyof typeof statusColors]} px-2 py-1 text-xs font-medium ml-2`}
          >
            {container.state}
          </Badge>
        </div>

        {/* Ports */}
        {container.ports && container.ports.length > 0 && (
          <div className="mb-3 text-sm text-gray-600">
            <span className="font-medium">Ports:</span> {container.ports.join(", ")}
          </div>
        )}

        {/* Created Date */}
        <div className="text-xs text-gray-500 mb-4">
          Created: {new Date(container.created).toLocaleDateString()}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isRunning && onStart && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStart(container)}
              className="flex-1 text-green-600 hover:bg-green-50"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          {isRunning && onStop && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStop(container)}
              className="flex-1 text-red-600 hover:bg-red-50"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
          {onRestart && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRestart(container)}
              className="flex-1"
            >
              <RotateCw className="h-3 w-3 mr-1" />
              Restart
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
