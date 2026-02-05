import { useState, useEffect } from 'react';
import { toast } from "sonner";
import { api } from '@/lib/api';
import { Search, AlertTriangle, Server, CheckCircle, XCircle, Download, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [scanOutput, setScanOutput] = useState<string>('');
  const [loadingOutput, setLoadingOutput] = useState(false);

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
        return { Icon: Search, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' };
      case 'scan_completed':
        return { Icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' };
      case 'scan_failed':
        return { Icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' };
      case 'vuln_discovered':
        return { Icon: AlertTriangle, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950' };
      case 'asset_discovered':
        return { Icon: Server, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950' };
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

  const handleDeleteScan = async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this scan record?")) return;

    try {
      await api.delete(`/surface-assessment/${operationId}/scans/${scanId}`);
      toast.success("Scan deleted");
      loadActivity();
    } catch (error) {
      console.error('Failed to delete scan:', error);
      toast.error("Failed to delete scan");
    }
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
          <div className="divide-y divide-border">
            {filteredEvents.map((event) => {
              const { Icon, color, bg } = getEventIcon(event.type);

              return (
                <div
                  key={event.id}
                  className="p-4 hover:bg-secondary cursor-pointer transition-colors"
                  onClick={() => handleTileClick(event.id)}
                >
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
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          {event.severity && (
                            <div className={`
                              px-2 py-1 rounded text-xs font-medium
                              ${event.severity === 'critical' ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300' : ''}
                              ${event.severity === 'high' ? 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300' : ''}
                              ${event.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300' : ''}
                              ${event.severity === 'low' ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300' : ''}
                              ${event.severity === 'info' ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300' : ''}
                            `}>
                              {event.severity}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteScan(e, event.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
    </div>
  );
}
