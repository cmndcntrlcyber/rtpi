import { useState, useEffect } from "react";
import { Shield } from "lucide-react";

interface Mitigation {
  id: string;
  vulnerabilityId: string;
  name: string;
  description: string;
  implementationGuidance: string | null;
  effectiveness: string | null;
  cost: string | null;
}

interface Vulnerability {
  id: string;
  owaspId: string;
  name: string;
}

const effectivenessBadge: Record<string, string> = {
  High: "bg-green-600 text-white",
  Medium: "bg-yellow-500 text-black",
  Low: "bg-red-500 text-white",
};

export default function MitigationsTable() {
  const [mitigations, setMitigations] = useState<Mitigation[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/owasp-llm/mitigations", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/v1/owasp-llm/vulnerabilities", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([m, vulnList]) => {
        setMitigations(m);
        setVulns(vulnList);
      })
      .catch((e) => console.error("Failed to fetch mitigations:", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">Loading mitigations...</div>;

  if (mitigations.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
        No mitigations available. Re-import OWASP LLM Top 10 to populate.
      </div>
    );
  }

  const vulnMap = new Map(vulns.map((v) => [v.id, v]));
  const grouped = new Map<string, Mitigation[]>();
  for (const m of mitigations) {
    const list = grouped.get(m.vulnerabilityId) || [];
    list.push(m);
    grouped.set(m.vulnerabilityId, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([vulnId, mits]) => {
        const vuln = vulnMap.get(vulnId);
        return (
          <div key={vulnId} className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 bg-muted/30 border-b border-border">
              <h3 className="font-semibold">
                <span className="font-mono text-sm text-muted-foreground mr-2">{vuln?.owaspId}</span>
                {vuln?.name}
              </h3>
            </div>
            <div className="divide-y divide-border">
              {mits.map((m) => (
                <div key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-medium">{m.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                      {m.implementationGuidance && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{m.implementationGuidance}</p>
                      )}
                    </div>
                    {m.effectiveness && (
                      <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${effectivenessBadge[m.effectiveness] || "bg-gray-500 text-white"}`}>
                        {m.effectiveness}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
