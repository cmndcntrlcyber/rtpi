import { useState, useEffect } from "react";

interface AttackVector {
  id: string;
  vulnerabilityId: string;
  name: string;
  description: string;
  attackComplexity: string | null;
  prerequisites: string[] | null;
  payloadExamples: string[] | null;
}

interface Vulnerability {
  id: string;
  owaspId: string;
  name: string;
}

export default function AttackVectorsTable() {
  const [vectors, setVectors] = useState<AttackVector[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/owasp-llm/attack-vectors", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/v1/owasp-llm/vulnerabilities", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([v, vulnList]) => {
        setVectors(v);
        setVulns(vulnList);
      })
      .catch((e) => console.error("Failed to fetch attack vectors:", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">Loading attack vectors...</div>;

  if (vectors.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
        No attack vectors available. Re-import OWASP LLM Top 10 to populate.
      </div>
    );
  }

  const vulnMap = new Map(vulns.map((v) => [v.id, v]));
  const grouped = new Map<string, AttackVector[]>();
  for (const vec of vectors) {
    const list = grouped.get(vec.vulnerabilityId) || [];
    list.push(vec);
    grouped.set(vec.vulnerabilityId, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([vulnId, vecs]) => {
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
              {vecs.map((vec) => (
                <div key={vec.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{vec.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{vec.description}</p>
                    </div>
                    {vec.attackComplexity && (
                      <span className="px-2 py-0.5 bg-muted rounded text-xs shrink-0">
                        {vec.attackComplexity}
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
