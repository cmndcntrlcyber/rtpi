import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Clock, ClipboardCheck } from "lucide-react";

interface Subcategory {
  id: string;
  subcategoryId: string;
  name: string;
  description: string | null;
}

interface Category {
  id: string;
  categoryId: string;
  name: string;
  subcategories: Subcategory[];
}

interface NISTFunction {
  id: string;
  functionId: string;
  name: string;
  categories: Category[];
}

interface Coverage {
  id: string;
  operationId: string;
  frameworkType: string;
  frameworkElementId: string;
  frameworkElementExternalId: string;
  coverageStatus: string;
  notes: string | null;
}

const statusOptions = [
  { value: "planned", label: "Planned", icon: Circle, color: "text-muted-foreground" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-blue-500" },
  { value: "tested", label: "Tested", icon: ClipboardCheck, color: "text-orange-500" },
  { value: "validated", label: "Validated", icon: CheckCircle2, color: "text-green-500" },
];

const functionColors: Record<string, string> = {
  GOVERN: "border-l-blue-600",
  MAP: "border-l-purple-600",
  MEASURE: "border-l-orange-500",
  MANAGE: "border-l-green-600",
};

export default function NISTAIAssessment() {
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOp, setSelectedOp] = useState<string>("");
  const [tree, setTree] = useState<NISTFunction[]>([]);
  const [coverage, setCoverage] = useState<Map<string, Coverage>>(new Map());
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/operations", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/v1/nist-ai/all", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([opsData, treeData]) => {
        const ops = opsData.operations || [];
        setOperations(ops);
        setTree(treeData);
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
        const notes = new Map<string, string>();
        for (const c of data) {
          if (c.frameworkType === "NIST_AI_RMF") {
            map.set(c.frameworkElementId, c);
            notes.set(c.frameworkElementId, c.notes || "");
          }
        }
        setCoverage(map);
        setNotesMap(notes);
      }
    } catch (e) {
      console.error("Failed to fetch coverage:", e);
    }
  };

  const updateCoverage = async (subId: string, externalId: string, status: string) => {
    const existing = coverage.get(subId);
    try {
      if (existing?.id) {
        await fetch(`/api/v1/framework-mappings/coverage/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ coverageStatus: status, notes: notesMap.get(subId) || "" }),
        });
      } else {
        await fetch("/api/v1/framework-mappings/coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            operationId: selectedOp,
            frameworkType: "NIST_AI_RMF",
            frameworkElementId: subId,
            frameworkElementExternalId: externalId,
            coverageStatus: status,
            notes: notesMap.get(subId) || "",
          }),
        });
      }
      await fetchCoverage();
    } catch (e) {
      console.error("Failed to update coverage:", e);
    }
  };

  const saveNotes = async (subId: string, externalId: string) => {
    const existing = coverage.get(subId);
    const currentNotes = notesMap.get(subId) || "";
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
            frameworkType: "NIST_AI_RMF",
            frameworkElementId: subId,
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

  // Gather all subcategories for stats
  const allSubs = tree.flatMap((f) => f.categories.flatMap((c) => c.subcategories));
  const statCounts = { planned: 0, in_progress: 0, tested: 0, validated: 0 };
  for (const c of coverage.values()) {
    if (c.coverageStatus in statCounts) statCounts[c.coverageStatus as keyof typeof statCounts]++;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">NIST AI RMF Assessment</h3>
          <p className="text-sm text-muted-foreground">
            Track compliance coverage per operation ({allSubs.length} subcategories)
          </p>
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

      {/* Progress by Function */}
      {tree.map((func) => {
        const funcSubs = func.categories.flatMap((c) => c.subcategories);
        const funcCoveredCount = funcSubs.filter((s) => {
          const cov = coverage.get(s.id);
          return cov && (cov.coverageStatus === "tested" || cov.coverageStatus === "validated");
        }).length;
        const pct = funcSubs.length > 0 ? Math.round((funcCoveredCount / funcSubs.length) * 100) : 0;

        return (
          <div key={func.id} className="bg-card p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{func.functionId}: {func.name}</span>
              <span className="text-xs text-muted-foreground">{funcCoveredCount}/{funcSubs.length} ({pct}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}

      {!selectedOp ? (
        <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
          Select an operation to begin assessment.
        </div>
      ) : (
        <div className="space-y-4">
          {tree.map((func) => (
            <div key={func.id}>
              <h4 className="text-sm font-bold mb-2 text-muted-foreground">
                {func.functionId}: {func.name}
              </h4>
              {func.categories.map((cat) => (
                <div key={cat.id} className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 ml-2">
                    {cat.categoryId}: {cat.name}
                  </p>
                  <div className="space-y-2">
                    {cat.subcategories.map((sub) => {
                      const cov = coverage.get(sub.id);
                      const currentStatus = cov?.coverageStatus || "";
                      return (
                        <div
                          key={sub.id}
                          className={`bg-card rounded-lg border border-border border-l-4 ${functionColors[func.functionId] || ""} p-3`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{sub.subcategoryId}</span>
                              <span className="text-sm font-medium">{sub.name}</span>
                            </div>
                            <div className="flex gap-1">
                              {statusOptions.map((s) => (
                                <button
                                  key={s.value}
                                  onClick={() => updateCoverage(sub.id, sub.subcategoryId, s.value)}
                                  className={`px-2 py-0.5 rounded text-xs transition-colors ${currentStatus === s.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            value={notesMap.get(sub.id) || ""}
                            onChange={(e) => setNotesMap((prev) => new Map(prev).set(sub.id, e.target.value))}
                            onBlur={() => saveNotes(sub.id, sub.subcategoryId)}
                            placeholder="Assessment notes..."
                            className="w-full bg-muted/50 border border-border rounded p-2 text-xs resize-none h-12 focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
