import { useState } from 'react';
import { useKasmWorkspaces, useTerminateWorkspace, useExtendWorkspace, KasmWorkspace } from '@/hooks/use-kasm-workspaces';
import WorkspaceLauncher from './WorkspaceLauncher';
import WorkspaceCard from './WorkspaceCard';
import WorkspaceDetailModal from './WorkspaceDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function WorkspaceTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedWorkspace, setSelectedWorkspace] = useState<KasmWorkspace | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<KasmWorkspace | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data: workspaces, isLoading, error, refetch } = useKasmWorkspaces();
  const terminateMutation = useTerminateWorkspace();
  const extendMutation = useExtendWorkspace();

  // Filter workspaces
  const filteredWorkspaces = workspaces?.filter((workspace) => {
    // Search filter
    const matchesSearch =
      workspace.workspaceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workspace.workspaceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workspace.id.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' || workspace.status === statusFilter;

    // Type filter
    const matchesType = typeFilter === 'all' || workspace.workspaceType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleAccessWorkspace = (workspace: KasmWorkspace) => {
    if (workspace.accessUrl) {
      window.open(workspace.accessUrl, '_blank');
      toast.success('Opening workspace', {
        description: `Launching ${workspace.workspaceName || workspace.workspaceType} in new tab`,
      });
    }
  };

  const handleTerminate = async () => {
    if (!workspaceToDelete) return;

    try {
      await terminateMutation.mutateAsync(workspaceToDelete.id);
      toast.success('Workspace terminated', {
        description: `${workspaceToDelete.workspaceName || workspaceToDelete.workspaceType} has been terminated`,
      });
      setWorkspaceToDelete(null);
    } catch (error) {
      toast.error('Failed to terminate workspace', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleExtend = async (workspace: KasmWorkspace) => {
    try {
      await extendMutation.mutateAsync({
        workspaceId: workspace.id,
        hours: 24,
      });
      toast.success('Workspace extended', {
        description: 'Expiry extended by 24 hours',
      });
    } catch (error) {
      toast.error('Failed to extend workspace', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleViewDetails = (workspace: KasmWorkspace) => {
    setSelectedWorkspace(workspace);
    setDetailModalOpen(true);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h3 className="text-lg font-semibold">Failed to load workspaces</h3>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kasm Workspaces</h2>
          <p className="text-sm text-muted-foreground">
            Browser-based development and security testing environments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <WorkspaceLauncher />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="starting">Starting</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vscode">VS Code</SelectItem>
            <SelectItem value="kali">Kali Linux</SelectItem>
            <SelectItem value="firefox">Firefox</SelectItem>
            <SelectItem value="empire">Empire C2</SelectItem>
            <SelectItem value="burp">Burp Suite</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {workspaces && workspaces.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Workspaces</div>
            <div className="text-2xl font-bold mt-1">{workspaces.length}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Running</div>
            <div className="text-2xl font-bold mt-1 text-green-600">
              {workspaces.filter(w => w.status === 'running').length}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Starting</div>
            <div className="text-2xl font-bold mt-1 text-blue-600">
              {workspaces.filter(w => w.status === 'starting').length}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Errors</div>
            <div className="text-2xl font-bold mt-1 text-red-600">
              {workspaces.filter(w => w.status === 'error').length}
            </div>
          </div>
        </div>
      )}

      {/* Workspace Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredWorkspaces && filteredWorkspaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              onAccess={handleAccessWorkspace}
              onTerminate={(w) => setWorkspaceToDelete(w)}
              onExtend={handleExtend}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 border border-dashed border-border rounded-lg">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">No workspaces found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Launch your first workspace to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && typeFilter === 'all' && (
              <WorkspaceLauncher />
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!workspaceToDelete} onOpenChange={() => setWorkspaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently terminate {workspaceToDelete?.workspaceName || 'this workspace'}.
              All data in the workspace will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTerminate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Modal */}
      {selectedWorkspace && (
        <WorkspaceDetailModal
          workspace={selectedWorkspace}
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
        />
      )}
    </div>
  );
}
