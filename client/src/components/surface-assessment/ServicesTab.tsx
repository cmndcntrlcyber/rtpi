import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';

interface ServicesTabProps {
  operationId: string;
}

interface ServiceGroup {
  name: string;
  port: number;
  protocol: string;
  hostCount: number;
  versions: string[];
  hosts: Array<{
    assetId: string;
    assetValue: string;
    version?: string;
    state: string;
  }>;
}

export default function ServicesTab({ operationId }: ServicesTabProps) {
  const [services, setServices] = useState<ServiceGroup[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (operationId) {
      loadServices();
    }
  }, [operationId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ services: ServiceGroup[] }>(`/surface-assessment/${operationId}/services`);
      setServices(response.services || []);
    } catch (error) {
      console.error('Failed to load services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (serviceKey: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceKey)) {
      newExpanded.delete(serviceKey);
    } else {
      newExpanded.add(serviceKey);
    }
    setExpandedServices(newExpanded);
  };

  const getServiceKey = (service: ServiceGroup) => `${service.name}-${service.port}`;

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(search.toLowerCase()) ||
    service.port.toString().includes(search)
  );

  if (!operationId) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="text-center text-muted-foreground">
          Please select an operation to view services
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-muted-foreground">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Discovered Services ({filteredServices.length})
          </h3>
          <input
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg w-64"
          />
        </div>
      </div>

      {/* Services List */}
      <div className="bg-card rounded-lg shadow-sm border border-border">
        {filteredServices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {services.length === 0 
              ? 'No services discovered yet. Run a BBOT scan to enumerate services.' 
              : 'No services match your search'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredServices.map((service) => {
              const serviceKey = getServiceKey(service);
              const isExpanded = expandedServices.has(serviceKey);

              return (
                <div key={serviceKey}>
                  {/* Service Row */}
                  <div
                    className="p-4 hover:bg-secondary cursor-pointer"
                    onClick={() => toggleExpand(serviceKey)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button className="text-muted-foreground hover:text-muted-foreground">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <Terminal className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{service.name}</p>
                            <Badge variant="outline">Port {service.port}</Badge>
                            <Badge className="uppercase text-xs">{service.protocol}</Badge>
                          </div>
                          {service.versions.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Versions: {service.versions.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{service.hostCount}</p>
                          <p className="text-xs text-muted-foreground">hosts</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Hosts */}
                  {isExpanded && service.hosts.length > 0 && (
                    <div className="px-4 pb-4 bg-secondary">
                      <div className="ml-11 border-l-2 border-purple-200 pl-4">
                        <h4 className="text-xs font-semibold text-foreground uppercase mb-2">
                          Affected Hosts ({service.hosts.length})
                        </h4>
                        <div className="space-y-2">
                          {service.hosts.map((host, idx) => (
                            <div
                              key={`${host.assetId}-${idx}`}
                              className="flex items-center justify-between bg-card p-3 rounded border border-border"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-foreground">{host.assetValue}</span>
                                {host.version && (
                                  <span className="text-xs text-muted-foreground">v{host.version}</span>
                                )}
                              </div>
                              <Badge className={host.state === 'open' ? 'bg-green-100 text-green-800' : 'bg-secondary text-foreground'}>
                                {host.state}
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
