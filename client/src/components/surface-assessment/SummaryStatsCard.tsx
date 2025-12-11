import { Server, Network, AlertTriangle, Globe, TrendingUp, TrendingDown } from 'lucide-react';

interface SummaryStatsCardProps {
  stats: {
    totalHosts: number;
    totalServices: number;
    totalVulnerabilities: number;
    webVulnerabilities: number;
    lastScanTimestamp?: string;
  };
}

export default function SummaryStatsCard({ stats }: SummaryStatsCardProps) {
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

  const statItems = [
    {
      label: 'Total Hosts',
      value: stats.totalHosts,
      icon: Server,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
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

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Summary Statistics</h3>
      <div className="space-y-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{item.value}</span>
            </div>
          );
        })}
      </div>
      
      {stats.lastScanTimestamp && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Last scan</span>
            <span className="text-gray-700 font-medium">
              {formatLastScan(stats.lastScanTimestamp)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
