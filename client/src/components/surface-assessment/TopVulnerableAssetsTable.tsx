import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

interface Asset {
  id: string;
  value: string;
  type: string;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  lastSeen: string;
}

interface TopVulnerableAssetsTableProps {
  assets: Asset[];
  onViewAll?: () => void;
}

export default function TopVulnerableAssetsTable({ assets, onViewAll }: TopVulnerableAssetsTableProps) {
  const topAssets = assets.slice(0, 5);

  const getSeverityBadge = (count: number, severity: 'critical' | 'high' | 'medium' | 'low') => {
    if (count === 0) return null;
    
    const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'default',
      low: 'secondary'
    };
    
    const colors: Record<string, string> = {
      critical: 'bg-red-600 hover:bg-red-700',
      high: 'bg-orange-600 hover:bg-orange-700',
      medium: 'bg-yellow-600 hover:bg-yellow-700',
      low: 'bg-green-600 hover:bg-green-700'
    };
    
    return (
      <Badge className={`${colors[severity]} text-white`}>
        {count}
      </Badge>
    );
  };

  if (topAssets.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Most Vulnerable Assets</h3>
        <div className="text-center py-8 text-gray-500">
          No assets with vulnerabilities found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Most Vulnerable Assets</h3>
        {onViewAll && assets.length > 5 && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        {topAssets.map((asset) => (
          <div
            key={asset.id}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {asset.value}
                </p>
                <span className="text-xs text-gray-500 uppercase">
                  {asset.type}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {getSeverityBadge(asset.vulnerabilities.critical, 'critical')}
                {getSeverityBadge(asset.vulnerabilities.high, 'high')}
                {getSeverityBadge(asset.vulnerabilities.medium, 'medium')}
                {getSeverityBadge(asset.vulnerabilities.low, 'low')}
              </div>
            </div>
            <div className="ml-4 text-right">
              <p className="text-2xl font-bold text-gray-900">
                {asset.vulnerabilities.total}
              </p>
              <p className="text-xs text-gray-500">vulns</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
