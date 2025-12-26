import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import SeverityDistributionChart from './charts/SeverityDistributionChart';
import StatusDistributionChart from './charts/StatusDistributionChart';
import SummaryStatsCard from './SummaryStatsCard';
import TopVulnerableAssetsTable from './TopVulnerableAssetsTable';
import ActivityFeed from './ActivityFeed';

interface OverviewTabProps {
  operationId: string;
}

interface OverviewData {
  stats: {
    totalHosts: number;
    totalServices: number;
    totalVulnerabilities: number;
    webVulnerabilities: number;
    lastScanTimestamp: string | null;
  };
  severityData: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  statusData: {
    open: number;
    in_progress: number;
    fixed: number;
    false_positive: number;
    accepted_risk: number;
  };
  topAssets: any[];
  recentActivity: any[];
}

export default function OverviewTab({ operationId }: OverviewTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    if (operationId) {
      loadOverviewData();
    }
  }, [operationId]);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<OverviewData>(`/surface-assessment/${operationId}/overview`);
      setData(response);
    } catch (err) {
      console.error('Failed to load overview data:', err);
      setError('Failed to load dashboard data. Please try again.');
      // Fallback to mock data on error
      setData({
        stats: {
          totalHosts: 0,
          totalServices: 0,
          totalVulnerabilities: 0,
          webVulnerabilities: 0,
          lastScanTimestamp: null,
        },
        severityData: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          informational: 0,
        },
        statusData: {
          open: 0,
          in_progress: 0,
          fixed: 0,
          false_positive: 0,
          accepted_risk: 0,
        },
        topAssets: [],
        recentActivity: [],
      });
    } finally {
      setLoading(false);
    }
  };

  // Use data from API
  const stats = data?.stats ? {
    ...data.stats,
    lastScanTimestamp: data.stats.lastScanTimestamp || undefined
  } : {
    totalHosts: 0,
    totalServices: 0,
    totalVulnerabilities: 0,
    webVulnerabilities: 0,
    lastScanTimestamp: undefined
  };

  const severityData = data?.severityData || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0
  };

  const statusData = data?.statusData || {
    open: 0,
    in_progress: 0,
    fixed: 0,
    false_positive: 0,
    accepted_risk: 0
  };

  const topAssets = data?.topAssets || [];
  const recentActivity = data?.recentActivity || [];

  if (!operationId) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="text-center text-muted-foreground">
          Please select an operation to view the dashboard
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-red-200 p-8">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={loadOverviewData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Summary Stats and Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SummaryStatsCard stats={stats} />
        <SeverityDistributionChart data={severityData} />
        <StatusDistributionChart data={statusData} />
      </div>

      {/* Middle Row: Top Assets and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopVulnerableAssetsTable assets={topAssets} />
        <ActivityFeed events={recentActivity} />
      </div>
    </div>
  );
}
