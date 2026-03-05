import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Clock, ClipboardCheck } from "lucide-react";

interface Vulnerability {
  id: string;
  owaspId: string;
  name: string;
  riskRating: string;
}

interface Coverage {
  id: string;
  operationId: string;
  frameworkType: string;
  frameworkElementId: string;
  frameworkElementExternalId: string;
  coverageStatus: string;
  notes: string | null;
  testResults: any;
}

const statusOptions = [
  { value: "planned", label: "Planned", icon: Circle, color: "text-muted-foreground" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-blue-500" },
  { value: "tested", label: "Tested", icon: ClipboardCheck, color: "text-orange-500" },
  { value: "validated", label: "Validated", icon: CheckCircle2, color: "text-green-500" },
];

export default function OWASPLLMAssessment() {
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOp, setSelectedOp] = useState<string>("");
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [coverage, setCoverage] = useState<Map<string, Coverage>>(new Map());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/operations", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/v1/owasp-llm/vulnerabilities", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([opsData, vulnData]) => {
        const ops = opsData.operations || [];
        setOperations(ops);
        setVulns(vulnData);
        if (ops.length > 0) setSelectedOp(ops[0].id);
      })
      .catch((e) => console.error("Failed to load assessment data:", e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedOp) fetchCoverage();
  }, [selectedOp]);

  const fetchCoverage = async () => {
    try {
      const res = await fetch(`/api/v1/framework-mappings/coverage/${selectedOp}`, { credentials: "include" });
      if (res.ok) {
        const data: Coverage[] = await res.json();
        const map = new Map<string, Coverage>();
        const notesMap = new Map<string, string>();
        for (const c of data) {
          if (c.frameworkType === "OWASP_LLM") {
            map.set(c.frameworkElementId, c);
            notesMap.set(c.frameworkElementId, c.notes || "");
          }
        }
        setCoverage(map);
        setNotes(notesMap);
      }
    } catch (e) {
      console.error("Failed to fetch coverage:", e);
    }
  };

  const updateCoverage = async (vulnId: string, externalId: string, status: string) => {
    const existing = coverage.get(vulnId);
    try {
      if (existing?.id) {
        await fetch(`/api/v1/framework-mappings/coverage/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ coverageStatus: status, notes: notes.get(vulnId) || "" }),
        });
      } else {
        await fetch("/api/v1/framework-mappings/coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            operationId: selectedOp,
            frameworkType: "OWASP_LLM",
            frameworkElementId: vulnId,
            frameworkElementExternalId: externalId,
            coverageStatus: status,
            notes: notes.get(vulnId) || "",
          }),
        });
      }
      await fetchCoverage();
    } catch (e) {
      console.error("Failed to update coverage:", e);
    }
  };

  const saveNotes = async (vulnId: string, externalId: string) => {
    const existing = coverage.get(vulnId);
    const currentNotes = notes.get(vulnId) || "";
    try {
      if (existing?.id) {
        await fetch(`/api/v1/framework-mappings/coverage/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ notes: currentNotes }),
        });
      } else {
        await fetch("/api/v1/framework-mappings/coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            operationId: selectedOp,
            frameworkType: "OWASP_LLM",
            frameworkElementId: vulnId,
            frameworkElementExternalId: externalId,
            coverageStatus: "planned",
            notes: currentNotes,
          }),
        });
      }
      await fetchCoverage();
    } catch (e) {
      console.error("Failed to save notes:", e);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading assessment...</div>;

  // Stats
  const statCounts = { planned: 0, in_progress: 0, tested: 0, validated: 0 };
  for (const c of coverage.values()) {
    if (c.coverageStatus in statCounts) statCounts[c.coverageStatus as keyof typeof statCounts]++;
  }

  return (
    <div className="space-y-6">
      {/* Operation Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">OWASP LLM Assessment</h3>
          <p className="text-sm text-muted-foreground">Track testing coverage per operation</p>
        </div>
        {operations.length > 0 && (
          <Select value={selectedOp} onValueChange={setSelectedOp}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select operation" />
            </SelectTrigger>
            <SelectContent>
              {operations.map((op) => (
                <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statusOptions.map((s) => (
          <div key={s.value} className="bg-card p-3 rounded-lg border border-border text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
            <p className="text-2xl font-bold">{statCounts[s.value as keyof typeof statCounts]}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {!selectedOp ? (
        <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
          Select an operation to begin assessment.
        </div>
      ) : (
        <div className="space-y-3">
          {vulns.map((v) => {
            const cov = coverage.get(v.id);
            const currentStatus = cov?.coverageStatus || "";
            return (
              <div key={v.id} className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{v.owaspId}</span>
                    <span className="font-semibold">{v.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${v.riskRating === "Critical" ? "bg-red-600 text-white" : v.riskRating === "High" ? "bg-orange-500 text-white" : "bg-yellow-500 text-black"}`}>
                      {v.riskRating}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {statusOptions.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => updateCoverage(v.id, v.owaspId, s.value)}
                        className={`px-3 py-1 rounded text-xs transition-colors ${currentStatus === s.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={notes.get(v.id) || ""}
                  onChange={(e) => setNotes((prev) => new Map(prev).set(v.id, e.target.value))}
                  onBlur={() => saveNotes(v.id, v.owaspId)}
                  placeholder="Test notes and findings..."
                  className="w-full bg-muted/50 border border-border rounded p-2 text-sm resize-none h-16 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
