import { useState, useEffect } from 'react';
import { toast } from "sonner";
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Server, Globe, Network, Trash2, CheckSquare, Square } from 'lucide-react';

interface AssetsTabProps {
  operationId: string;
}

interface Asset {
  id: string;
  value: string;
  type: string;
  hostname?: string;
  ipAddress?: string;
  status: string;
  discoveryMethod: string;
  operatingSystem?: string;
  services: Service[];
  vulnerabilityCount: number;
  lastSeenAt: string;
}

interface Service {
  id: string;
  name: string;
  port: number;
  protocol: string;
  version?: string;
  state: string;
}

export default function AssetsTab({ operationId }: AssetsTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (operationId) {
      loadAssets();
    }
  }, [operationId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ assets: Asset[] }>(`/surface-assessment/${operationId}/assets`);
      setAssets(response.assets || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (assetId: string) => {
    const newExpanded = new Set(expandedAssets);
    if (newExpanded.has(assetId)) {
      newExpanded.delete(assetId);
    } else {
      newExpanded.add(assetId);
    }
    setExpandedAssets(newExpanded);
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'domain':
        return Globe;
      case 'ip':
        return Server;
      default:
        return Network;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      down: 'bg-red-100 text-red-800',
      unreachable: 'bg-secondary text-foreground',
    };
    return colors[status] || 'bg-secondary text-foreground';
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Delete this asset and all its services?")) return;

    try {
      await api.delete(`/surface-assessment/${operationId}/assets/${assetId}`);
      toast.success("Asset deleted");
      loadAssets();
    } catch (error) {
      console.error('Failed to delete asset:', error);
      toast.error("Failed to delete asset");
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Delete this service?")) return;

    try {
      await api.delete(`/surface-assessment/${operationId}/services/${serviceId}`);
      toast.success("Service deleted");
      loadAssets();
    } catch (error) {
      console.error('Failed to delete service:', error);
      toast.error("Failed to delete service");
    }
  };

  const handleToggleSelect = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const handleSelectAll = () => {
    const newSelected = new Set(filteredAssets.map(a => a.id));
    setSelectedAssets(newSelected);
  };

  const handleSelectNone = () => {
    setSelectedAssets(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedAssets.size === 0) return;
    if (!confirm(`Delete ${selectedAssets.size} selected assets and all their services?`)) return;

    try {
      await api.delete(`/surface-assessment/${operationId}/assets/bulk`, { ids: Array.from(selectedAssets) });
      toast.success(`${selectedAssets.size} assets deleted`);
      setSelectedAssets(new Set());
      loadAssets();
    } catch (error) {
      console.error('Failed to bulk delete assets:', error);
      toast.error("Failed to delete assets");
    }
  };

  const filteredAssets = assets.filter(asset =>
    asset.value.toLowerCase().includes(search.toLowerCase()) ||
    asset.hostname?.toLowerCase().includes(search.toLowerCase())
  );

  if (!operationId) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="text-center text-muted-foreground">
          Please select an operation to view assets
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-muted-foreground">Loading assets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-foreground">
            Discovered Assets ({filteredAssets.length})
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg w-64"
            />
          </div>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-4">
            {selectedAssets.size === 0 ? (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm text-foreground hover:text-foreground"
              >
                <Square className="w-4 h-4" />
                <span>Select All ({filteredAssets.length})</span>
              </button>
            ) : (
              <button
                onClick={handleSelectNone}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{selectedAssets.size} selected</span>
              </button>
            )}
          </div>

          {selectedAssets.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete ({selectedAssets.size})
            </Button>
          )}
        </div>
      </div>

      {/* Assets List */}
      <div className="bg-card rounded-lg shadow-sm border border-border">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {assets.length === 0 
              ? 'No assets discovered yet. Run a BBOT scan to discover assets.' 
              : 'No assets match your search'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAssets.map((asset) => {
              const Icon = getAssetIcon(asset.type);
              const isExpanded = expandedAssets.has(asset.id);

              return (
                <div key={asset.id}>
                  {/* Asset Row */}
                  <div
                    className="p-4 hover:bg-secondary cursor-pointer"
                    onClick={() => toggleExpand(asset.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedAssets.has(asset.id)}
                          onChange={() => handleToggleSelect(asset.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                        />
                        <button className="text-muted-foreground hover:text-muted-foreground">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{asset.value}</p>
                            <Badge className="uppercase text-xs">{asset.type}</Badge>
                            <Badge className={getStatusColor(asset.status)}>
                              {asset.status}
                            </Badge>
                          </div>
                          {asset.hostname && asset.hostname !== asset.value && (
                            <p className="text-xs text-muted-foreground mt-1">{asset.hostname}</p>
                          )}
                          {asset.operatingSystem && (
                            <p className="text-xs text-muted-foreground mt-1">OS: {asset.operatingSystem}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{asset.services.length}</p>
                          <p className="text-xs text-muted-foreground">services</p>
                        </div>
                        {asset.vulnerabilityCount > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-600">{asset.vulnerabilityCount}</p>
                            <p className="text-xs text-muted-foreground">vulns</p>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id); }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Services */}
                  {isExpanded && asset.services.length > 0 && (
                    <div className="px-4 pb-4 bg-secondary">
                      <div className="ml-11 border-l-2 border-blue-200 pl-4">
                        <h4 className="text-xs font-semibold text-foreground uppercase mb-2">
                          Services ({asset.services.length})
                        </h4>
                        <div className="space-y-2">
                          {asset.services.map((service) => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between bg-card p-3 rounded border border-border"
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{service.port}/{service.protocol}</Badge>
                                <span className="text-sm font-medium text-foreground">{service.name}</span>
                                {service.version && (
                                  <span className="text-xs text-muted-foreground">v{service.version}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={service.state === 'open' ? 'bg-green-100 text-green-800' : 'bg-secondary text-foreground'}>
                                  {service.state}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteService(service.id); }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
