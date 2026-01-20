import { useState, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Clock, CheckCircle, XCircle, Crosshair, CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { targetsService, type Target } from '@/services/targets';
import ScheduleManagerTab from './ScheduleManagerTab';

interface ScanConfigTabProps {
  operationId: string;
}

interface ScanHistory {
  id: string;
  toolName: string;
  status: string;
  targets: string[];
  assetsFound?: number;
  servicesFound?: number;
  vulnerabilitiesFound?: number;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  errorMessage?: string;
}

export default function ScanConfigTab({ operationId }: ScanConfigTabProps) {
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [scanOutput, setScanOutput] = useState<string>('');
  const [loadingOutput, setLoadingOutput] = useState(false);
  const [allTargets, setAllTargets] = useState<Target[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [targetScanLoading, setTargetScanLoading] = useState(false);
  const [bbotConfig, setBbotConfig] = useState({
    enabled: true,
    preset: 'kitchen-sink',
    modules: '',
    flags: '',  // Changed from 'safe' to empty - only use if user enters value
    args: '--force,--allow-deadly'  // Additional -- arguments (--force bypasses scope restrictions)
  });
  const [nucleiConfig, setNucleiConfig] = useState({
    enabled: true,
    severity: 'critical,high,medium',
    rateLimit: 50,
    templates: 'cves/,vulnerabilities/'
  });
  const [targets, setTargets] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if any scans are currently running
  const hasRunningScans = scanHistory.some(scan => scan.status === 'running' || scan.status === 'pending');

  useEffect(() => {
    if (operationId) {
      loadScanHistory();
    }
  }, [operationId]);

  // Start polling when there are running scans
  useEffect(() => {
    if (hasRunningScans && !isPolling) {
      setIsPolling(true);
      pollingIntervalRef.current = setInterval(async () => {
        await loadScanHistory();
      }, 5000); // Poll every 5 seconds
    } else if (!hasRunningScans && isPolling) {
      // Stop polling when no more running scans
      setIsPolling(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [hasRunningScans, isPolling]);

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    try {
      const response = await targetsService.list();
      setAllTargets(response.targets || []);
    } catch (error) {
      console.error('Failed to load targets:', error);
    }
  };

  const getSelectedTargetValue = (): string | null => {
    const target = allTargets.find(t => t.id === selectedTargetId);
    return target?.value || null;
  };

  const handleTargetNmapScan = async () => {
    if (!selectedTargetId) {
      toast.warning("Please select a target");
      return;
    }

    try {
      setTargetScanLoading(true);
      const response = await targetsService.scan(selectedTargetId);
      toast.success(`Nmap scan completed! Found ${(response as any).openPorts || 0} open ports`);

      // Reload targets to get updated scan results
      await loadTargets();
    } catch (error) {
      console.error('Failed to scan target:', error);
      toast.error(`Failed to scan target: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTargetScanLoading(false);
    }
  };

  const handleTargetBBOTScan = async () => {
    const targetValue = getSelectedTargetValue();
    if (!targetValue) {
      toast.warning("Please select a target");
      return;
    }

    try {
      setTargetScanLoading(true);

      await api.post(`/surface-assessment/${operationId}/scan/bbot`, {
        targets: [targetValue],
        config: {
          preset: bbotConfig.preset,
          modules: bbotConfig.modules,
          flags: bbotConfig.flags,
          args: bbotConfig.args,
        }
      });

      toast.success("BBOT scan started against target! Scan is running in the background.");

      // Immediately reload scan history to show the running scan
      await loadScanHistory();
    } catch (error) {
      console.error('Failed to start BBOT scan:', error);
      toast.error(`Failed to start BBOT scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTargetScanLoading(false);
    }
  };

  const handleTargetNucleiScan = async () => {
    const targetValue = getSelectedTargetValue();
    if (!targetValue) {
      toast.warning("Please select a target");
      return;
    }

    try {
      setTargetScanLoading(true);

      await api.post(`/surface-assessment/${operationId}/scan/nuclei`, {
        targets: [targetValue],
        config: nucleiConfig
      });

      toast.success("Nuclei scan started against target! Scan is running in the background.");

      // Immediately reload scan history to show the running scan
      await loadScanHistory();
    } catch (error) {
      console.error('Failed to start Nuclei scan:', error);
      toast.error(`Failed to start Nuclei scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTargetScanLoading(false);
    }
  };

  const loadScanHistory = async () => {
    try {
      const response = await api.get<{ scans: ScanHistory[]; total: number }>(`/surface-assessment/${operationId}/scans`);
      setScanHistory(response.scans || []);
    } catch (error) {
      console.error('Failed to load scan history:', error);
    }
  };

  const handleBBOTScan = async () => {
    if (!targets.trim()) {
      toast.warning("Please enter at least one target");
      return;
    }

    try {
      setLoading(true);
      const targetList = targets.split('\n').map(t => t.trim()).filter(Boolean);
      
      await api.post(`/surface-assessment/${operationId}/scan/bbot`, {
        targets: targetList,
        config: {
          preset: bbotConfig.preset,
          modules: bbotConfig.modules,
          flags: bbotConfig.flags,
          args: bbotConfig.args,  // Pass additional arguments
        }
      });
      
      toast.success("BBOT scan started successfully! Scan is running in the background.");
      setTargets(''); // Clear targets after successful start

      // Immediately reload scan history to show the running scan
      await loadScanHistory();
    } catch (error) {
      console.error('Failed to start BBOT scan:', error);
      toast.error(`Failed to start BBOT scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNucleiScan = async () => {
    if (!targets.trim()) {
      toast.warning("Please enter at least one target");
      return;
    }

    try {
      setLoading(true);
      const targetList = targets.split('\n').map(t => t.trim()).filter(Boolean);
      
      // TODO: Implement actual API call
      await api.post(`/surface-assessment/${operationId}/scan/nuclei`, {
        targets: targetList,
        config: nucleiConfig
      });
      
      toast.success("Nuclei scan started successfully");
      await loadScanHistory();
    } catch (error) {
      console.error('Failed to start Nuclei scan:', error);
      toast.error("Failed to start Nuclei scan");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-secondary text-foreground',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-secondary text-foreground',
    };
    return styles[status] || styles.pending;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return Clock;
      case 'completed':
        return CheckCircle;
      case 'failed':
        return XCircle;
      default:
        return Clock;
    }
  };

  const handleTileClick = async (scanId: string) => {
    setSelectedScanId(scanId);
    setLoadingOutput(true);
    setScanOutput('');

    try {
      const response = await api.get<{ rawOutput: string }>(`/surface-assessment/${operationId}/scan/${scanId}/output`);
      setScanOutput(response.rawOutput || 'No output available');
    } catch (error) {
      console.error('Failed to load scan output:', error);
      setScanOutput('Failed to load output. The scan may not have completed yet or output was not captured.');
    } finally {
      setLoadingOutput(false);
    }
  };

  const handleCloseDialog = () => {
    setSelectedScanId(null);
    setScanOutput('');
  };

  if (!operationId) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="text-center text-muted-foreground">
          Please select an operation to configure scans
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="manual" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="manual" className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          Manual Scans
        </TabsTrigger>
        <TabsTrigger value="scheduled" className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Scheduled Scans
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="space-y-6">
      {/* Scanner Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BBOT Configuration */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">BBOT Configuration</h3>
            <Switch
              checked={bbotConfig.enabled}
              onCheckedChange={(enabled) => setBbotConfig({ ...bbotConfig, enabled })}
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Preset</label>
              <Input
                value={bbotConfig.preset}
                onChange={(e) => setBbotConfig({ ...bbotConfig, preset: e.target.value })}
                placeholder="subdomain-enum"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Modules (comma-separated)</label>
              <Input
                value={bbotConfig.modules}
                onChange={(e) => setBbotConfig({ ...bbotConfig, modules: e.target.value })}
                placeholder="subfinder,assetfinder,amass"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Flags</label>
              <Input
                value={bbotConfig.flags}
                onChange={(e) => setBbotConfig({ ...bbotConfig, flags: e.target.value })}
                placeholder="safe"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                Additional Arguments (comma-separated)
              </label>
              <Input
                value={bbotConfig.args}
                onChange={(e) => setBbotConfig({ ...bbotConfig, args: e.target.value })}
                placeholder="--allow-deadly, --strict-scope"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Examples: --allow-deadly, --strict-scope, --force
              </p>
            </div>
          </div>
        </div>

        {/* Nuclei Configuration */}
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Nuclei Configuration</h3>
            <Switch
              checked={nucleiConfig.enabled}
              onCheckedChange={(enabled) => setNucleiConfig({ ...nucleiConfig, enabled })}
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Severity Levels</label>
              <Input
                value={nucleiConfig.severity}
                onChange={(e) => setNucleiConfig({ ...nucleiConfig, severity: e.target.value })}
                placeholder="critical,high,medium"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Rate Limit</label>
              <Input
                type="number"
                value={nucleiConfig.rateLimit}
                onChange={(e) => setNucleiConfig({ ...nucleiConfig, rateLimit: parseInt(e.target.value) || 50 })}
                placeholder="50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Templates</label>
              <Input
                value={nucleiConfig.templates}
                onChange={(e) => setNucleiConfig({ ...nucleiConfig, templates: e.target.value })}
                placeholder="cves/,vulnerabilities/"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scan Execution */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Execute Scan</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Targets (one per line)
            </label>
            <textarea
              value={targets}
              onChange={(e) => setTargets(e.target.value)}
              placeholder="example.com&#10;192.168.1.0/24&#10;https://app.example.com"
              rows={4}
              className="w-full px-4 py-2 border border-border rounded-lg font-mono text-sm"
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleBBOTScan}
              disabled={!bbotConfig.enabled || loading}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Run BBOT Scan
            </Button>
            <Button
              onClick={handleNucleiScan}
              disabled={!nucleiConfig.enabled || loading}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Run Nuclei Scan
            </Button>
          </div>
        </div>
      </div>

      {/* Target Scan */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Execute Scan Against Target</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select a target from your targets list and run scans to discover assets, services, and vulnerabilities.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Select Target
            </label>
            <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a target to scan" />
              </SelectTrigger>
              <SelectContent>
                {allTargets.length === 0 ? (
                  <SelectItem value="no-targets" disabled>
                    No targets available
                  </SelectItem>
                ) : (
                  allTargets.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {target.type || 'unknown'}
                        </Badge>
                        <span className="font-medium">{target.name || 'Unnamed'}</span>
                        {target.value && (
                          <span className="text-muted-foreground">
                            ({target.value})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedTargetId && selectedTargetId !== 'no-targets' && (
            <div className="p-3 bg-muted rounded-lg">
              {(() => {
                const selectedTarget = allTargets.find(t => t.id === selectedTargetId);
                if (!selectedTarget) return null;
                const lastScan = (selectedTarget.metadata as any)?.lastScan;
                return (
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium">Name:</span> {selectedTarget.name || 'N/A'}</p>
                    <p><span className="font-medium">Type:</span> {selectedTarget.type || 'N/A'}</p>
                    <p><span className="font-medium">Value:</span> {selectedTarget.value || 'N/A'}</p>
                    {selectedTarget.description && <p><span className="font-medium">Description:</span> {selectedTarget.description}</p>}
                    <p><span className="font-medium">Priority:</span> {selectedTarget.priority || 3}</p>
                    <p><span className="font-medium">Status:</span> {selectedTarget.status}</p>
                    {lastScan && (
                      <>
                        <p><span className="font-medium">Last Scanned:</span> {new Date(lastScan.timestamp).toLocaleString()}</p>
                        <p><span className="font-medium">Open Ports Found:</span> {lastScan.openPorts || 0}</p>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleTargetNmapScan}
              disabled={!selectedTargetId || selectedTargetId === 'no-targets' || targetScanLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Crosshair className="w-4 h-4" />
              {targetScanLoading ? 'Scanning...' : 'Nmap Scan'}
            </Button>
            <Button
              onClick={handleTargetBBOTScan}
              disabled={!selectedTargetId || selectedTargetId === 'no-targets' || targetScanLoading || !bbotConfig.enabled}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {targetScanLoading ? 'Scanning...' : 'BBOT Scan'}
            </Button>
            <Button
              onClick={handleTargetNucleiScan}
              disabled={!selectedTargetId || selectedTargetId === 'no-targets' || targetScanLoading || !nucleiConfig.enabled}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {targetScanLoading ? 'Scanning...' : 'Nuclei Scan'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Nmap:</strong> Port and service discovery | <strong>BBOT:</strong> Asset reconnaissance (uses config above) | <strong>Nuclei:</strong> Vulnerability scanning (uses config above)
          </p>
        </div>
      </div>

      {/* Scan History */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Scan History</h3>
          {isPolling && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Updating...</span>
            </div>
          )}
        </div>
        {scanHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No scans have been run yet
          </div>
        ) : (
          <div className="space-y-3">
            {scanHistory.map((scan) => {
              const StatusIcon = getStatusIcon(scan.status);
              
              return (
                <div
                  key={scan.id}
                  className="p-4 border border-border rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={() => handleTileClick(scan.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <StatusIcon className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground">{scan.toolName.toUpperCase()}</p>
                          <Badge className={getStatusBadge(scan.status)}>
                            {scan.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Targets: {scan.targets.join(', ')}
                        </p>
                        {scan.status === 'completed' && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Assets: {scan.assetsFound || 0}</span>
                            <span>Services: {scan.servicesFound || 0}</span>
                            <span>Vulns: {scan.vulnerabilitiesFound || 0}</span>
                          </div>
                        )}
                        {scan.errorMessage && (
                          <p className="text-xs text-red-600 mt-2">{scan.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {scan.completedAt && new Date(scan.completedAt).toLocaleString()}
                      {scan.duration && (
                        <p className="mt-1">Duration: {Math.round(scan.duration / 60)}min</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Output Dialog */}
      <Dialog open={!!selectedScanId} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Scan Output</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loadingOutput ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-4 text-muted-foreground">Loading output...</p>
              </div>
            ) : (
              <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs font-mono overflow-auto whitespace-pre-wrap break-words">
                {scanOutput}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </TabsContent>

      <TabsContent value="scheduled">
        <ScheduleManagerTab operationId={operationId} />
      </TabsContent>
    </Tabs>
  );
}
