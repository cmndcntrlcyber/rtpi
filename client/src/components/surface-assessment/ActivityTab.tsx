import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Search, AlertTriangle, Server, CheckCircle, XCircle, Download } from 'lucide-react';

interface ActivityTabProps {
  operationId: string;
}

interface ActivityEvent {
  id: string;
  type: 'scan_started' | 'scan_completed' | 'scan_failed' | 'vuln_discovered' | 'asset_discovered';
  title: string;
  description: string;
  timestamp: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export default function ActivityTab({ operationId }: ActivityTabProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  useEffect(() => {
    if (operationId) {
      loadActivity();
    }
  }, [operationId]);

  useEffect(() => {
    applyFilters();
  }, [events, search, typeFilter]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ events: ActivityEvent[] }>(`/surface-assessment/${operationId}/activity`);
      setEvents(response.events || []);
    } catch (error) {
      console.error('Failed to load activity:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...events];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchLower) ||
        event.description.toLowerCase().includes(searchLower)
      );
    }

    if (typeFilter.length > 0) {
      filtered = filtered.filter(event => typeFilter.includes(event.type));
    }

    setFilteredEvents(filtered);
  };

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
    return date.toLocaleString();
  };

  const toggleTypeFilter = (type: string) => {
    if (typeFilter.includes(type)) {
      setTypeFilter(typeFilter.filter(t => t !== type));
    } else {
      setTypeFilter([...typeFilter, type]);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${operationId}-${Date.now()}.json`;
    link.click();
  };

  if (!operationId) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="text-center text-muted-foreground">
          Please select an operation to view activity
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-muted-foreground">Loading activity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Export */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Activity Timeline ({filteredEvents.length})
          </h3>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary hover:bg-muted rounded"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 px-4 py-2 border border-border rounded-lg"
          />
        </div>

        {/* Type Filters */}
        <div className="flex flex-wrap gap-2">
          {['scan_started', 'scan_completed', 'scan_failed', 'vuln_discovered', 'asset_discovered'].map((type) => (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter.includes(type)
                  ? 'bg-blue-600 text-white'
                  : 'bg-secondary text-foreground hover:bg-muted'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card rounded-lg shadow-sm border border-border">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {events.length === 0 
              ? 'No activity recorded yet. Activity will appear after running scans.' 
              : 'No events match your filters'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredEvents.map((event) => {
              const { Icon, color, bg } = getEventIcon(event.type);

              return (
                <div key={event.id} className="p-4 hover:bg-secondary">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${bg} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{event.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatTimestamp(event.timestamp)}
                          </p>
                        </div>
                        {event.severity && (
                          <div className={`
                            ml-4 px-2 py-1 rounded text-xs font-medium flex-shrink-0
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
