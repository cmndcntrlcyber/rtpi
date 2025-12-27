import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KasmWorkspace } from '@/hooks/use-kasm-workspaces';
import {
  Code,
  Shield,
  Globe,
  Terminal,
  Lock,
  MoreVertical,
  ExternalLink,
  Clock,
  Trash2,
  Share2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const WORKSPACE_ICONS = {
  vscode: Code,
  kali: Shield,
  firefox: Globe,
  empire: Terminal,
  burp: Lock,
};

const STATUS_CONFIG = {
  starting: {
    color: 'bg-blue-500',
    label: 'Starting',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  running: {
    color: 'bg-green-500',
    label: 'Running',
    textColor: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  stopping: {
    color: 'bg-yellow-500',
    label: 'Stopping',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  stopped: {
    color: 'bg-gray-500',
    label: 'Stopped',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  error: {
    color: 'bg-red-500',
    label: 'Error',
    textColor: 'text-red-700',
    bgColor: 'bg-red-100',
  },
};

interface WorkspaceCardProps {
  workspace: KasmWorkspace;
  onAccess?: (workspace: KasmWorkspace) => void;
  onTerminate?: (workspace: KasmWorkspace) => void;
  onExtend?: (workspace: KasmWorkspace) => void;
  onShare?: (workspace: KasmWorkspace) => void;
  onViewDetails?: (workspace: KasmWorkspace) => void;
}

export default function WorkspaceCard({
  workspace,
  onAccess,
  onTerminate,
  onExtend,
  onShare,
  onViewDetails,
}: WorkspaceCardProps) {
  const Icon = WORKSPACE_ICONS[workspace.workspaceType];
  const statusConfig = STATUS_CONFIG[workspace.status];

  // Calculate time until expiry
  const expiryTime = new Date(workspace.expiresAt);
  const now = new Date();
  const hoursUntilExpiry = (expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isExpiringSoon = hoursUntilExpiry < 4 && hoursUntilExpiry > 0;

  const workspaceName = workspace.workspaceName || `${workspace.workspaceType.toUpperCase()} Workspace`;

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusConfig.bgColor}`}>
              <Icon className={`h-5 w-5 ${statusConfig.textColor}`} />
            </div>
            <div>
              <CardTitle className="text-base">{workspaceName}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {workspace.workspaceType.toUpperCase()}
              </CardDescription>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {workspace.status === 'running' && workspace.accessUrl && (
                <>
                  <DropdownMenuItem onClick={() => onAccess?.(workspace)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Access Workspace
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => onViewDetails?.(workspace)}>
                <Info className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {workspace.status === 'running' && (
                <>
                  <DropdownMenuItem onClick={() => onExtend?.(workspace)}>
                    <Clock className="h-4 w-4 mr-2" />
                    Extend Expiry
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare?.(workspace)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Workspace
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onTerminate?.(workspace)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Terminate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${statusConfig.bgColor} ${statusConfig.textColor} border-none`}>
            <span className={`w-2 h-2 rounded-full ${statusConfig.color} mr-2`}></span>
            {statusConfig.label}
          </Badge>
          {isExpiringSoon && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-none">
              <Clock className="h-3 w-3 mr-1" />
              Expiring Soon
            </Badge>
          )}
        </div>

        {/* Resources */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">CPU:</span>
            <span className="ml-1 font-mono">{workspace.cpuLimit}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Memory:</span>
            <span className="ml-1 font-mono">{workspace.memoryLimit}</span>
          </div>
        </div>

        {/* Timing Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          {workspace.startedAt && (
            <div className="flex justify-between">
              <span>Started:</span>
              <span>{formatDistanceToNow(new Date(workspace.startedAt), { addSuffix: true })}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Expires:</span>
            <span className={isExpiringSoon ? 'text-yellow-700 font-medium' : ''}>
              {formatDistanceToNow(new Date(workspace.expiresAt), { addSuffix: true })}
            </span>
          </div>
          {workspace.lastAccessed && (
            <div className="flex justify-between">
              <span>Last accessed:</span>
              <span>{formatDistanceToNow(new Date(workspace.lastAccessed), { addSuffix: true })}</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {workspace.status === 'error' && workspace.errorMessage && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-2 rounded text-xs">
            {workspace.errorMessage}
          </div>
        )}

        {/* Access Button */}
        {workspace.status === 'running' && workspace.accessUrl && (
          <Button
            className="w-full gap-2"
            onClick={() => onAccess?.(workspace)}
          >
            <ExternalLink className="h-4 w-4" />
            Access Workspace
          </Button>
        )}

        {workspace.status === 'starting' && (
          <Button className="w-full gap-2" disabled>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Starting...
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
