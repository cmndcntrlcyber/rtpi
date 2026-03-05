import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

interface Vulnerability {
  id: string;
  owaspId: string;
  name: string;
  description: string;
  riskRating: string;
  commonExamples: string[];
  preventionStrategies: string[];
  exampleAttackScenarios: string[];
  cweMappings: string[];
}

const riskBadgeColor: Record<string, string> = {
  Critical: "bg-red-600 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-yellow-500 text-black",
  Low: "bg-blue-500 text-white",
};

export default function VulnerabilitiesTable() {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVulnerabilities();
  }, []);

  const fetchVulnerabilities = async () => {
    try {
      const res = await fetch("/api/v1/owasp-llm/vulnerabilities", { credentials: "include" });
      if (res.ok) setVulnerabilities(await res.json());
    } catch (e) {
      console.error("Failed to fetch vulnerabilities:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading vulnerabilities...</div>;

  if (vulnerabilities.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
        No vulnerabilities imported yet. Click "Import OWASP LLM Top 10" above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vulnerabilities.map((v) => (
        <div key={v.id} className="bg-card rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => toggle(v.id)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {expanded.has(v.id) ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-mono text-sm text-muted-foreground">{v.owaspId}</span>
              <span className="font-semibold">{v.name}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskBadgeColor[v.riskRating] || "bg-gray-500 text-white"}`}>
              {v.riskRating}
            </span>
          </button>

          {expanded.has(v.id) && (
            <div className="border-t border-border p-4 space-y-4">
              <p className="text-sm text-muted-foreground">{v.description}</p>

              <div>
                <h4 className="text-sm font-semibold mb-2">Common Examples</h4>
                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                  {v.commonExamples?.map((ex, i) => <li key={i}>{ex}</li>)}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Attack Scenarios</h4>
                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                  {v.exampleAttackScenarios?.map((sc, i) => <li key={i}>{sc}</li>)}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Prevention Strategies</h4>
                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                  {v.preventionStrategies?.map((ps, i) => <li key={i}>{ps}</li>)}
                </ul>
              </div>

              {v.cweMappings && v.cweMappings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">CWE Mappings</h4>
                  <div className="flex gap-2 flex-wrap">
                    {v.cweMappings.map((cwe, i) => (
                      <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                        {cwe}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
