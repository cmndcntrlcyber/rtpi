import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Server, Globe, Network } from 'lucide-react';

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
      unreachable: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredAssets = assets.filter(asset =>
    asset.value.toLowerCase().includes(search.toLowerCase()) ||
    asset.hostname?.toLowerCase().includes(search.toLowerCase())
  );

  if (!operationId) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          Please select an operation to view assets
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading assets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Discovered Assets ({filteredAssets.length})
          </h3>
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg w-64"
          />
        </div>
      </div>

      {/* Assets List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
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
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleExpand(asset.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button className="text-gray-400 hover:text-gray-600">
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
                            <p className="text-sm font-medium text-gray-900">{asset.value}</p>
                            <Badge className="uppercase text-xs">{asset.type}</Badge>
                            <Badge className={getStatusColor(asset.status)}>
                              {asset.status}
                            </Badge>
                          </div>
                          {asset.hostname && asset.hostname !== asset.value && (
                            <p className="text-xs text-gray-500 mt-1">{asset.hostname}</p>
                          )}
                          {asset.operatingSystem && (
                            <p className="text-xs text-gray-600 mt-1">OS: {asset.operatingSystem}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{asset.services.length}</p>
                          <p className="text-xs text-gray-500">services</p>
                        </div>
                        {asset.vulnerabilityCount > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-600">{asset.vulnerabilityCount}</p>
                            <p className="text-xs text-gray-500">vulns</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Services */}
                  {isExpanded && asset.services.length > 0 && (
                    <div className="px-4 pb-4 bg-gray-50">
                      <div className="ml-11 border-l-2 border-blue-200 pl-4">
                        <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                          Services ({asset.services.length})
                        </h4>
                        <div className="space-y-2">
                          {asset.services.map((service) => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between bg-white p-3 rounded border border-gray-200"
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{service.port}/{service.protocol}</Badge>
                                <span className="text-sm font-medium text-gray-900">{service.name}</span>
                                {service.version && (
                                  <span className="text-xs text-gray-500">v{service.version}</span>
                                )}
                              </div>
                              <Badge className={service.state === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                {service.state}
                              </Badge>
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
