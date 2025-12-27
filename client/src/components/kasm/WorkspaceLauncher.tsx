import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProvisionWorkspace, useResourceUsage } from '@/hooks/use-kasm-workspaces';
import { Loader2, Plus, Code, Shield, Globe, Terminal, Lock } from 'lucide-react';
import { toast } from 'sonner';

const WORKSPACE_TYPES = [
  {
    value: 'vscode',
    label: 'VS Code IDE',
    description: 'Full development environment with multiple languages',
    icon: Code,
    defaultCpu: '2',
    defaultMemory: '4096M',
  },
  {
    value: 'kali',
    label: 'Kali Linux',
    description: 'Complete pentesting suite with security tools',
    icon: Shield,
    defaultCpu: '4',
    defaultMemory: '8192M',
  },
  {
    value: 'firefox',
    label: 'Firefox Browser',
    description: 'Web browser for application testing',
    icon: Globe,
    defaultCpu: '2',
    defaultMemory: '2048M',
  },
  {
    value: 'empire',
    label: 'Empire C2 Client',
    description: 'PowerShell Empire command and control',
    icon: Terminal,
    defaultCpu: '1',
    defaultMemory: '2048M',
  },
  {
    value: 'burp',
    label: 'Burp Suite',
    description: 'Web application security testing (requires JAR upload)',
    icon: Lock,
    defaultCpu: '4',
    defaultMemory: '8192M',
  },
] as const;

export default function WorkspaceLauncher() {
  const [open, setOpen] = useState(false);
  const [workspaceType, setWorkspaceType] = useState<string>('vscode');
  const [workspaceName, setWorkspaceName] = useState('');
  const [cpuLimit, setCpuLimit] = useState('2');
  const [memoryLimit, setMemoryLimit] = useState('4096M');
  const [expiryHours, setExpiryHours] = useState(24);

  const provisionMutation = useProvisionWorkspace();
  const { data: resourceUsage } = useResourceUsage();

  const selectedType = WORKSPACE_TYPES.find(t => t.value === workspaceType);

  const handleTypeChange = (value: string) => {
    setWorkspaceType(value);
    const type = WORKSPACE_TYPES.find(t => t.value === value);
    if (type) {
      setCpuLimit(type.defaultCpu);
      setMemoryLimit(type.defaultMemory);
    }
  };

  const handleProvision = async () => {
    try {
      await provisionMutation.mutateAsync({
        workspaceType: workspaceType as any,
        workspaceName: workspaceName || undefined,
        cpuLimit,
        memoryLimit,
        expiryHours,
      });

      toast.success('Workspace provisioning started', {
        description: `${selectedType?.label} workspace is being created`,
      });

      setOpen(false);
      setWorkspaceName('');
    } catch (error) {
      toast.error('Failed to provision workspace', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Check if user can provision more workspaces
  const canProvision = resourceUsage
    ? resourceUsage.workspaceCount < resourceUsage.workspaceLimit
    : true;

  const SelectedIcon = selectedType?.icon || Code;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Launch Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Launch Workspace</DialogTitle>
          <DialogDescription>
            Provision a new Kasm workspace for security testing and development
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Resource Usage Warning */}
          {resourceUsage && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Workspaces:</span>
                  <span className="font-mono">
                    {resourceUsage.workspaceCount}/{resourceUsage.workspaceLimit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CPU Usage:</span>
                  <span className="font-mono">
                    {resourceUsage.totalCpuUsage}/{resourceUsage.cpuLimit} cores
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory Usage:</span>
                  <span className="font-mono">
                    {(resourceUsage.totalMemoryUsage / 1024).toFixed(1)}/
                    {(resourceUsage.memoryLimit / 1024).toFixed(1)} GB
                  </span>
                </div>
              </div>
            </div>
          )}

          {!canProvision && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm">
              You've reached your workspace limit. Terminate an existing workspace to create a new one.
            </div>
          )}

          {/* Workspace Type */}
          <div className="space-y-2">
            <Label>Workspace Type</Label>
            <Select value={workspaceType} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKSPACE_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {selectedType && (
              <div className="bg-muted p-4 rounded-lg flex gap-4">
                <div className="bg-background p-3 rounded-lg">
                  <SelectedIcon className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{selectedType.label}</h4>
                  <p className="text-sm text-muted-foreground">{selectedType.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="workspaceName">Workspace Name (Optional)</Label>
            <Input
              id="workspaceName"
              placeholder="My Testing Workspace"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </div>

          {/* Resource Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpuLimit">CPU Cores</Label>
              <Select value={cpuLimit} onValueChange={setCpuLimit}>
                <SelectTrigger id="cpuLimit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Core</SelectItem>
                  <SelectItem value="2">2 Cores</SelectItem>
                  <SelectItem value="4">4 Cores</SelectItem>
                  <SelectItem value="8">8 Cores</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="memoryLimit">Memory</Label>
              <Select value={memoryLimit} onValueChange={setMemoryLimit}>
                <SelectTrigger id="memoryLimit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2048M">2 GB</SelectItem>
                  <SelectItem value="4096M">4 GB</SelectItem>
                  <SelectItem value="8192M">8 GB</SelectItem>
                  <SelectItem value="16384M">16 GB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expiry Time */}
          <div className="space-y-2">
            <Label htmlFor="expiryHours">Auto-Terminate After</Label>
            <Select value={expiryHours.toString()} onValueChange={(v) => setExpiryHours(Number(v))}>
              <SelectTrigger id="expiryHours">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Hour</SelectItem>
                <SelectItem value="4">4 Hours</SelectItem>
                <SelectItem value="8">8 Hours</SelectItem>
                <SelectItem value="24">24 Hours</SelectItem>
                <SelectItem value="48">48 Hours</SelectItem>
                <SelectItem value="72">72 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleProvision}
            disabled={!canProvision || provisionMutation.isPending}
          >
            {provisionMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Launch Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
