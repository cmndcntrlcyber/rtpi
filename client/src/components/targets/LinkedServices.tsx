import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface LinkedServicesProps {
  targetId?: string;
}

interface LinkedService {
  id: string;
  name: string;
  port: number;
  protocol: string;
  version?: string;
  state: string;
  banner?: string;
  discoveryMethod: string;
  discoveredAt: string;
}

interface LinkedAsset {
  id: string;
  value: string;
  type: string;
  hostname?: string;
  ipAddress?: string;
  status: string;
  discoveryMethod: string;
}

export default function LinkedServices({ targetId }: LinkedServicesProps) {
  const [services, setServices] = useState<LinkedService[]>([]);
  const [asset, setAsset] = useState<LinkedAsset | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetId) return;

    const loadServices = async () => {
      setLoading(true);
      try {
        const response = await api.get<{
          services: LinkedService[];
          asset: LinkedAsset | null;
        }>(`/targets/${targetId}/linked-services`);
        setServices(response.services || []);
        setAsset(response.asset || null);
      } catch {
        // Silently handle - target may not have linked assets
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, [targetId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Linked Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading linked services...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!asset && services.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Linked Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No discovered asset linked. Run a BBOT or Nmap scan to discover services.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-4 w-4" />
          Linked Services
          {services.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {services.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Linked Asset Info */}
        {asset && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b border-border">
            <span>Linked to asset:</span>
            <Badge variant="outline">{asset.type.toUpperCase()}</Badge>
            <span className="font-medium text-foreground">{asset.value}</span>
            <Badge className={asset.status === "active" ? "bg-green-100 text-green-800" : "bg-secondary text-foreground"}>
              {asset.status}
            </Badge>
            <span className="text-xs">via {asset.discoveryMethod}</span>
          </div>
        )}

        {/* Services List */}
        {services.length > 0 ? (
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between bg-secondary p-3 rounded border border-border"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {service.port}/{service.protocol}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {service.name}
                  </span>
                  {service.version && (
                    <span className="text-xs text-muted-foreground">
                      v{service.version}
                    </span>
                  )}
                </div>
                <Badge
                  className={
                    service.state === "open"
                      ? "bg-green-100 text-green-800"
                      : "bg-secondary text-foreground"
                  }
                >
                  {service.state}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Asset linked but no services discovered yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
