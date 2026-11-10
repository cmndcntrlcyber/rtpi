import { useState, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Clock, CheckCircle, XCircle, Crosshair, CalendarClock, StopCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { targetsService, type Target } from '@/services/targets';
import ScheduleManagerTab from './ScheduleManagerTab';

// ── Enum definitions ────────────────────────────────────────────────────────

const BBOT_PRESETS = [
  { value: 'subdomain-enum', label: 'Subdomain Enum' },
  { value: 'kitchen-sink', label: 'Kitchen Sink' },
  { value: 'web-basic', label: 'Web Basic' },
  { value: 'web-thorough', label: 'Web Thorough' },
  { value: 'cloud-enum', label: 'Cloud Enum' },
  { value: 'email-enum', label: 'Email Enum' },
  { value: 'spider', label: 'Spider' },
  { value: 'paramminer', label: 'Param Miner' },
  { value: 'dirbust-light', label: 'Dirbust Light' },
  { value: 'dirbust-heavy', label: 'Dirbust Heavy' },
  { value: 'iis-shortnames', label: 'IIS Shortnames' },
  { value: 'dotnet-audit', label: '.NET Audit' },
] as const;

const BBOT_FLAGS = [
  { value: 'safe', label: 'Safe', group: 'scope' },
  { value: 'passive', label: 'Passive', group: 'scope' },
  { value: 'active', label: 'Active', group: 'scope' },
  { value: 'aggressive', label: 'Aggressive', group: 'scope' },
  { value: 'slow', label: 'Slow', group: 'scope' },
  { value: 'subdomain-enum', label: 'Subdomain Enum', group: 'module' },
  { value: 'cloud-enum', label: 'Cloud Enum', group: 'module' },
  { value: 'email-enum', label: 'Email Enum', group: 'module' },
  { value: 'social-enum', label: 'Social Enum', group: 'module' },
  { value: 'web-basic', label: 'Web Basic', group: 'module' },
  { value: 'web-thorough', label: 'Web Thorough', group: 'module' },
  { value: 'portscanner', label: 'Port Scanner', group: 'module' },
  { value: 'service-enum', label: 'Service Enum', group: 'module' },
  { value: 'affiliates', label: 'Affiliates', group: 'module' },
  { value: 'code-enum', label: 'Code Enum', group: 'module' },
  { value: 'iis-shortnames', label: 'IIS Shortnames', group: 'module' },
] as const;

const BBOT_MODULES = [
  { value: 'subfinder', label: 'Subfinder', group: 'recon' },
  { value: 'assetfinder', label: 'Assetfinder', group: 'recon' },
  { value: 'amass', label: 'Amass', group: 'recon' },
  { value: 'dnsdumpster', label: 'DNSDumpster', group: 'recon' },
  { value: 'crt', label: 'crt.sh', group: 'recon' },
  { value: 'certspotter', label: 'CertSpotter', group: 'recon' },
  { value: 'waybackurls', label: 'Wayback URLs', group: 'recon' },
  { value: 'httpx', label: 'httpx', group: 'active' },
  { value: 'nmap', label: 'Nmap', group: 'active' },
  { value: 'sslcert', label: 'SSL Cert', group: 'active' },
  { value: 'dnsbrute', label: 'DNS Brute', group: 'active' },
  { value: 'gowitness', label: 'GoWitness', group: 'active' },
  { value: 'wappalyzer', label: 'Wappalyzer', group: 'active' },
  { value: 'shodan_dns', label: 'Shodan', group: 'api' },
  { value: 'censys', label: 'Censys', group: 'api' },
  { value: 'virustotal', label: 'VirusTotal', group: 'api' },
  { value: 'securitytrails', label: 'SecurityTrails', group: 'api' },
  { value: 'binaryedge', label: 'BinaryEdge', group: 'api' },
] as const;

const BBOT_ARGS = [
  { value: '--strict-scope', label: 'Strict Scope' },
  { value: '--no-deps', label: 'No Deps' },
  { value: '--dry-run', label: 'Dry Run' },
  { value: '--fast-mode', label: 'Fast Mode' },
  { value: '--ignore-failed-deps', label: 'Ignore Failed Deps' },
] as const;

const NUCLEI_SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-600' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-blue-500' },
  { value: 'info', label: 'Info', color: 'bg-gray-500' },
] as const;

const NUCLEI_TEMPLATES = [
  { value: 'http/cves', label: 'CVEs', group: 'http' },
  { value: 'http/vulnerabilities', label: 'Vulnerabilities', group: 'http' },
  { value: 'http/default-logins', label: 'Default Logins', group: 'http' },
  { value: 'http/exposed-panels', label: 'Exposed Panels', group: 'http' },
  { value: 'http/exposures', label: 'Exposures', group: 'http' },
  { value: 'http/misconfiguration', label: 'Misconfig', group: 'http' },
  { value: 'http/technologies', label: 'Technologies', group: 'http' },
  { value: 'http/takeovers', label: 'Takeovers', group: 'http' },
  { value: 'http/token-spray', label: 'Token Spray', group: 'http' },
  { value: 'http/iot', label: 'IoT', group: 'http' },
  { value: 'cloud', label: 'Cloud', group: 'other' },
  { value: 'network', label: 'Network', group: 'other' },
  { value: 'dns', label: 'DNS', group: 'other' },
  { value: 'ssl', label: 'SSL/TLS', group: 'other' },
  { value: 'dast', label: 'DAST', group: 'other' },
] as const;

// ── Multi-toggle component ──────────────────────────────────────────────────

function MultiToggle({ options, selected, onChange, grouped }: {
  options: readonly { value: string; label: string; group?: string; color?: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  grouped?: boolean;
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  };

  if (grouped) {
    const groups = new Map<string, typeof options[number][]>();
    for (const o of options) {
      const g = (o as any).group || 'default';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(o);
    }
    return (
      <div className="space-y-2">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group}>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{group}</span>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {items.map(o => (
                <button key={o.value} type="button" onClick={() => toggle(o.value)}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                    selected.includes(o.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => toggle(o.value)}
          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
            selected.includes(o.value)
              ? ((o as any).color ? `${(o as any).color} text-white border-transparent` : 'bg-primary text-primary-foreground border-primary')
              : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

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
    preset: 'subdomain-enum',
    modules: [] as string[],
    flags: [] as string[],
    args: [] as string[],
  });
  const [nucleiConfig, setNucleiConfig] = useState({
    enabled: true,
    severity: ['critical', 'high', 'medium'] as string[],
    rateLimit: 50,
    templates: ['http/cves', 'http/vulnerabilities'] as string[],
  });
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const hasRunningScans = scanHistory.some(scan => scan.status === 'running' || scan.status === 'pending');

  useEffect(() => {
    if (operationId) {
      loadScanHistory();
      loadTargets();
    }
  }, [operationId]);

  useEffect(() => {
    if (hasRunningScans && !isPolling) {
      setIsPolling(true);
      pollingIntervalRef.current = setInterval(async () => {
        await loadScanHistory();
      }, 5000);
    } else if (!hasRunningScans && isPolling) {
      setIsPolling(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [hasRunningScans, isPolling]);

  const loadTargets = async () => {
    try {
      const response = await targetsService.list({ operationId });
      setAllTargets(response.targets || []);
      setSelectedTargetId('');
    } catch (error) {
      console.error('Failed to load targets:', error);
    }
  };

  const getSelectedTargetValue = (): string | null => {
    const target = allTargets.find(t => t.id === selectedTargetId);
    return target?.value || null;
  };

  // Build API config objects (join arrays to comma-separated strings)
  const buildBbotApiConfig = () => ({
    preset: bbotConfig.preset,
    modules: bbotConfig.modules.join(','),
    flags: bbotConfig.flags.join(','),
    args: bbotConfig.args.join(','),
  });

  const buildNucleiApiConfig = () => ({
    severity: nucleiConfig.severity.join(','),
    rateLimit: nucleiConfig.rateLimit,
    templates: nucleiConfig.templates.join(','),
  });

  const handleTargetNmapScan = async () => {
    if (!selectedTargetId) {
      toast.warning("Please select a target");
      return;
    }
    try {
      setTargetScanLoading(true);
      const response = await targetsService.scan(selectedTargetId);
      toast.success(`Nmap scan completed! Found ${(response as any).openPorts || 0} open ports`);
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
        config: buildBbotApiConfig(),
      });
      toast.success("BBOT scan started against target! Scan is running in the background.");
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
        config: buildNucleiApiConfig(),
      });
      toast.success("Nuclei scan started against target! Scan is running in the background.");
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
      case 'running': return Clock;
      case 'completed': return CheckCircle;
      case 'failed': return XCircle;
      case 'cancelled': return StopCircle;
      default: return Clock;
    }
  };

  const handleTileClick = async (scanId: string) => {
    setSelectedScanId(scanId);
    setLoadingOutput(true);
    setScanOutput('');
    try {
      const response = await api.get<{ rawOutput: string }>(`/surface-assessment/${operationId}/scan/${scanId}/output`);
      const raw = response.rawOutput || 'No output available';
      setScanOutput(raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, ''));
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

  const handleCancelScan = async (scanId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/surface-assessment/${operationId}/scans/${scanId}/cancel`);
      toast.success("Scan cancelled");
      await loadScanHistory();
    } catch (error) {
      toast.error("Failed to cancel scan");
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
              <label className="text-sm font-medium text-foreground block mb-1.5">Preset</label>
              <Select value={bbotConfig.preset} onValueChange={(v) => setBbotConfig({ ...bbotConfig, preset: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BBOT_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Flags</label>
              <MultiToggle
                options={BBOT_FLAGS}
                selected={bbotConfig.flags}
                onChange={(flags) => setBbotConfig({ ...bbotConfig, flags })}
                grouped
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Modules</label>
              <MultiToggle
                options={BBOT_MODULES}
                selected={bbotConfig.modules}
                onChange={(modules) => setBbotConfig({ ...bbotConfig, modules })}
                grouped
              />
              <p className="text-[10px] text-muted-foreground mt-1">Leave empty to use preset defaults</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Options</label>
              <MultiToggle
                options={BBOT_ARGS}
                selected={bbotConfig.args}
                onChange={(args) => setBbotConfig({ ...bbotConfig, args })}
              />
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
              <label className="text-sm font-medium text-foreground block mb-1.5">Severity Levels</label>
              <MultiToggle
                options={NUCLEI_SEVERITIES}
                selected={nucleiConfig.severity}
                onChange={(severity) => setNucleiConfig({ ...nucleiConfig, severity })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Rate Limit</label>
              <Input
                type="number"
                value={nucleiConfig.rateLimit}
                onChange={(e) => setNucleiConfig({ ...nucleiConfig, rateLimit: parseInt(e.target.value) || 50 })}
                className="w-32"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Requests per second</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Templates</label>
              <MultiToggle
                options={NUCLEI_TEMPLATES}
                selected={nucleiConfig.templates}
                onChange={(templates) => setNucleiConfig({ ...nucleiConfig, templates })}
                grouped
              />
            </div>
          </div>
        </div>
      </div>

      {/* Execute Scan Against Target */}
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
                    <div className="flex items-start gap-2">
                      {(scan.status === 'running' || scan.status === 'pending') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => handleCancelScan(scan.id, e)}
                        >
                          <StopCircle className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                      <div className="text-right text-xs text-muted-foreground">
                        {scan.completedAt && new Date(scan.completedAt).toLocaleString()}
                        {scan.duration && (
                          <p className="mt-1">Duration: {Math.round(scan.duration / 60)}min</p>
                        )}
                      </div>
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
