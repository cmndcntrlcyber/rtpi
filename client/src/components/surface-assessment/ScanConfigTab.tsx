import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, CheckCircle, XCircle } from 'lucide-react';

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
  const [bbotConfig, setBbotConfig] = useState({
    enabled: true,
    preset: 'subdomain-enum',
    modules: '',
    flags: '',  // Changed from 'safe' to empty - only use if user enters value
    args: ''  // Additional -- arguments like --allow-deadly
  });
  const [nucleiConfig, setNucleiConfig] = useState({
    enabled: true,
    severity: 'critical,high,medium',
    rateLimit: 50,
    templates: 'cves/,vulnerabilities/'
  });
  const [targets, setTargets] = useState('');

  useEffect(() => {
    if (operationId) {
      loadScanHistory();
    }
  }, [operationId]);

  const loadScanHistory = async () => {
    try {
      // TODO: Load from API
      setScanHistory([]);
    } catch (error) {
      console.error('Failed to load scan history:', error);
    }
  };

  const handleBBOTScan = async () => {
    if (!targets.trim()) {
      alert('Please enter at least one target');
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
      
      alert(`BBOT scan started successfully! Scan is running in the background.`);
      setTargets(''); // Clear targets after successful start
      
      // Reload scan history after a short delay
      setTimeout(() => {
        loadScanHistory();
      }, 2000);
    } catch (error) {
      console.error('Failed to start BBOT scan:', error);
      alert(`Failed to start BBOT scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNucleiScan = async () => {
    if (!targets.trim()) {
      alert('Please enter at least one target');
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
      
      alert('Nuclei scan started successfully');
      await loadScanHistory();
    } catch (error) {
      console.error('Failed to start Nuclei scan:', error);
      alert('Failed to start Nuclei scan');
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
    <div className="space-y-6">
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

      {/* Scan History */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Scan History</h3>
        {scanHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No scans have been run yet
          </div>
        ) : (
          <div className="space-y-3">
            {scanHistory.map((scan) => {
              const StatusIcon = getStatusIcon(scan.status);
              
              return (
                <div key={scan.id} className="p-4 border border-border rounded-lg hover:border-blue-300 transition-colors">
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
    </div>
  );
}
