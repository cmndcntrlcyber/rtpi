import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldCheck, Ban } from "lucide-react";
import { api } from "@/lib/api";

interface Certificate {
  id: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  status: string;
  fingerprint: string;
}

export default function CertificatesTab() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ certificates: Certificate[] }>("/rust-nexus/certificates");
      setCerts(res.certificates || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await api.post(`/rust-nexus/certificates/${id}/revoke`, {});
      refresh();
    } finally {
      setRevoking(null);
    }
  };

  const isExpired = (validTo: string) => new Date(validTo) < new Date();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Certificates
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {certs.map((cert) => (
            <div key={cert.id} className="flex items-center justify-between text-xs border rounded-md px-3 py-2">
              <div className="space-y-0.5">
                <div className="font-medium">{cert.subject}</div>
                <div className="text-muted-foreground font-mono text-[10px]">
                  {cert.fingerprint.slice(0, 24)}...
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={cert.status === "revoked" ? "destructive" : isExpired(cert.validTo) ? "secondary" : "default"}
                  className="text-[10px]"
                >
                  {cert.status === "revoked" ? "Revoked" : isExpired(cert.validTo) ? "Expired" : "Active"}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(cert.validTo).toLocaleDateString()}
                </span>
                {cert.status !== "revoked" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive"
                    disabled={revoking === cert.id}
                    onClick={() => revoke(cert.id)}
                    title="Revoke"
                  >
                    <Ban className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {certs.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-3">No certificates found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
