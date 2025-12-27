import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KasmWorkspace } from '@/hooks/use-kasm-workspaces';
import {
  Code,
  Shield,
  Globe,
  Terminal,
  Lock,
  ExternalLink,
  Clock,
  Cpu,
  HardDrive,
  Activity,
  Server,
  Network,
  Copy,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const WORKSPACE_ICONS = {
  vscode: Code,
  kali: Shield,
  firefox: Globe,
  empire: Terminal,
  burp: Lock,
};

const WORKSPACE_LABELS = {
  vscode: 'VS Code IDE',
  kali: 'Kali Linux',
  firefox: 'Firefox Browser',
  empire: 'Empire C2 Client',
  burp: 'Burp Suite',
};

const STATUS_CONFIG = {
  starting: {
    color: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  running: {
    color: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  },
  stopping: {
    color: 'bg-yellow-100 text-yellow-700',
    dot: 'bg-yellow-500',
  },
  stopped: {
    color: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-500',
  },
  error: {
    color: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
};

interface WorkspaceDetailModalProps {
  workspace: KasmWorkspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WorkspaceDetailModal({
  workspace,
  open,
  onOpenChange,
}: WorkspaceDetailModalProps) {
  const Icon = WORKSPACE_ICONS[workspace.workspaceType];
  const label = WORKSPACE_LABELS[workspace.workspaceType];
  const statusConfig = STATUS_CONFIG[workspace.status];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const workspaceName = workspace.workspaceName || label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${statusConfig.color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">{workspaceName}</DialogTitle>
              <DialogDescription className="text-sm">
                {label} • {workspace.id}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Status */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Status
              </h3>
              <Badge className={`${statusConfig.color} border-none`}>
                <span className={`w-2 h-2 rounded-full ${statusConfig.dot} mr-2`}></span>
                {workspace.status.toUpperCase()}
              </Badge>
              {workspace.errorMessage && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded text-sm">
                  {workspace.errorMessage}
                </div>
              )}
            </div>

            <Separator />

            {/* Access Information */}
            {workspace.accessUrl && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Access
                  </h3>
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 font-mono text-sm break-all">
                        {workspace.accessUrl}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(workspace.accessUrl!, 'Access URL')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      className="w-full gap-2"
                      onClick={() => window.open(workspace.accessUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Workspace
                    </Button>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Timing Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-mono">{format(new Date(workspace.createdAt), 'PPpp')}</span>
                </div>
                {workspace.startedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started:</span>
                    <span className="font-mono">{format(new Date(workspace.startedAt), 'PPpp')}</span>
                  </div>
                )}
                {workspace.lastAccessed && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Accessed:</span>
                    <span className="font-mono">{format(new Date(workspace.lastAccessed), 'PPpp')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="font-mono">{format(new Date(workspace.expiresAt), 'PPpp')}</span>
                </div>
                {workspace.terminatedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terminated:</span>
                    <span className="font-mono">{format(new Date(workspace.terminatedAt), 'PPpp')}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Network Information */}
            {workspace.internalIp && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Network
                  </h3>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Internal IP:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{workspace.internalIp}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(workspace.internalIp!, 'Internal IP')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Container Information */}
            {workspace.kasmContainerId && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Container
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Container ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{workspace.kasmContainerId.substring(0, 12)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(workspace.kasmContainerId!, 'Container ID')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session ID:</span>
                    <span className="font-mono text-xs">{workspace.kasmSessionId.substring(0, 12)}</span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="resources" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Cpu className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">CPU Allocation</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CPU Cores:</span>
                    <span className="font-mono font-semibold">{workspace.cpuLimit}</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <HardDrive className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Memory Allocation</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Memory Limit:</span>
                    <span className="font-mono font-semibold">{workspace.memoryLimit}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-2">Resource Limits</p>
                  <p className="text-xs">
                    These are the maximum resources allocated to this workspace.
                    Actual usage may be lower depending on workload.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="metadata" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Workspace ID</h3>
                <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
                  <span className="font-mono text-sm break-all">{workspace.id}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(workspace.id, 'Workspace ID')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">User ID</h3>
                <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
                  <span className="font-mono text-sm break-all">{workspace.userId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(workspace.userId, 'User ID')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {workspace.operationId && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Operation ID</h3>
                  <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
                    <span className="font-mono text-sm break-all">{workspace.operationId}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(workspace.operationId!, 'Operation ID')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {workspace.metadata && Object.keys(workspace.metadata).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Custom Metadata</h3>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(workspace.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
