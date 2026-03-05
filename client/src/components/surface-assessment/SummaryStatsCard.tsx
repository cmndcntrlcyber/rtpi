import { Server, Network, AlertTriangle, Globe, Cpu, Mail, HardDrive } from 'lucide-react';

interface AssetBreakdown {
  domains: number;
  ips: number;
  urls: number;
  technologies: number;
  asns: number;
  emails: number;
  storageBuckets: number;
}

interface SummaryStatsCardProps {
  stats: {
    totalHosts: number;
    totalServices: number;
    totalVulnerabilities: number;
    webVulnerabilities: number;
    lastScanTimestamp?: string;
  };
  assetBreakdown?: AssetBreakdown;
}

export default function SummaryStatsCard({ stats, assetBreakdown }: SummaryStatsCardProps) {
  const formatLastScan = (timestamp?: string) => {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const buildHostSubLabel = () => {
    if (!assetBreakdown) return null;
    const parts: string[] = [];
    if (assetBreakdown.ips > 0) parts.push(`${assetBreakdown.ips} IPs`);
    if (assetBreakdown.domains > 0) parts.push(`${assetBreakdown.domains} Domains`);
    if (assetBreakdown.urls > 0) parts.push(`${assetBreakdown.urls} URLs`);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const statItems: Array<{
    label: string;
    value: number;
    icon: typeof Server;
    color: string;
    bgColor: string;
    subLabel?: string | null;
  }> = [
    {
      label: 'Total Assets',
      value: stats.totalHosts,
      icon: Server,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subLabel: buildHostSubLabel(),
    },
    {
      label: 'Services',
      value: stats.totalServices,
      icon: Network,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Vulnerabilities',
      value: stats.totalVulnerabilities,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      label: 'Web Vulns',
      value: stats.webVulnerabilities,
      icon: Globe,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  // Add technology, email, and ASN stats if data exists
  if (assetBreakdown) {
    if (assetBreakdown.technologies > 0) {
      statItems.push({
        label: 'Technologies',
        value: assetBreakdown.technologies,
        icon: Cpu,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50'
      });
    }
    if (assetBreakdown.emails > 0) {
      statItems.push({
        label: 'Emails',
        value: assetBreakdown.emails,
        icon: Mail,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50'
      });
    }
    if (assetBreakdown.asns > 0) {
      statItems.push({
        label: 'ASNs',
        value: assetBreakdown.asns,
        icon: HardDrive,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50'
      });
    }
    if (assetBreakdown.storageBuckets > 0) {
      statItems.push({
        label: 'Storage Buckets',
        value: assetBreakdown.storageBuckets,
        icon: HardDrive,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50'
      });
    }
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Summary Statistics</h3>
      <div className="space-y-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${item.bgColor}`}>
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{item.value}</span>
              </div>
              {item.subLabel && (
                <p className="text-xs text-muted-foreground ml-12 mt-1">{item.subLabel}</p>
              )}
            </div>
          );
        })}
      </div>

      {stats.lastScanTimestamp && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last scan</span>
            <span className="text-foreground font-medium">
              {formatLastScan(stats.lastScanTimestamp)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
