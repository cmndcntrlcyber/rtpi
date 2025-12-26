import { Search, AlertTriangle, Server, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'scan_started' | 'scan_completed' | 'scan_failed' | 'vuln_discovered' | 'asset_discovered';
  title: string;
  description: string;
  timestamp: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  onViewAll?: () => void;
}

export default function ActivityFeed({ events, onViewAll }: ActivityFeedProps) {
  const recentEvents = events.slice(0, 5);

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'scan_started':
        return { Icon: Search, color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'scan_completed':
        return { Icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' };
      case 'scan_failed':
        return { Icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' };
      case 'vuln_discovered':
        return { Icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' };
      case 'asset_discovered':
        return { Icon: Server, color: 'text-purple-600', bg: 'bg-purple-50' };
      default:
        return { Icon: Search, color: 'text-muted-foreground', bg: 'bg-secondary' };
    }
  };

  const formatTimestamp = (timestamp: string) => {
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

  if (recentEvents.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-muted-foreground">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        {onViewAll && events.length > 5 && (
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
        {recentEvents.map((event) => {
          const { Icon, color, bg } = getEventIcon(event.type);
          
          return (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className={`p-2 rounded-lg ${bg} flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimestamp(event.timestamp)}
                </p>
              </div>
              {event.severity && (
                <div className={`
                  px-2 py-1 rounded text-xs font-medium flex-shrink-0
                  ${event.severity === 'critical' ? 'bg-red-100 text-red-800' : ''}
                  ${event.severity === 'high' ? 'bg-orange-100 text-orange-800' : ''}
                  ${event.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                  ${event.severity === 'low' ? 'bg-green-100 text-green-800' : ''}
                  ${event.severity === 'info' ? 'bg-blue-100 text-blue-800' : ''}
                `}>
                  {event.severity}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
