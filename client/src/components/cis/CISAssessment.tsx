import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Clock, ClipboardCheck } from "lucide-react";

interface Safeguard {
  id: string;
  safeguardId: string;
  controlId: string;
  name: string;
  implementationGroup: number | null;
}

interface CISControl {
  id: string;
  controlId: string;
  name: string;
  safeguards: Safeguard[];
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

export default function CISAssessment() {
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOp, setSelectedOp] = useState<string>("");
  const [controls, setControls] = useState<CISControl[]>([]);
  const [coverage, setCoverage] = useState<Map<string, Coverage>>(new Map());
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/operations", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/v1/cis/all", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([opsData, controlsData]) => {
        const ops = opsData.operations || [];
        setOperations(ops);
        setControls(controlsData);
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
          if (c.frameworkType === "CIS") {
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

  const updateCoverage = async (sgId: string, externalId: string, status: string) => {
    const existing = coverage.get(sgId);
    try {
      if (existing?.id) {
        await fetch(`/api/v1/framework-mappings/coverage/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ coverageStatus: status, notes: notesMap.get(sgId) || "" }),
        });
      } else {
        await fetch("/api/v1/framework-mappings/coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            operationId: selectedOp,
            frameworkType: "CIS",
            frameworkElementId: sgId,
            frameworkElementExternalId: externalId,
            coverageStatus: status,
            notes: notesMap.get(sgId) || "",
          }),
        });
      }
      await fetchCoverage();
    } catch (e) {
      console.error("Failed to update coverage:", e);
    }
  };

  const saveNotes = async (sgId: string, externalId: string) => {
    const existing = coverage.get(sgId);
    const currentNotes = notesMap.get(sgId) || "";
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
            frameworkType: "CIS",
            frameworkElementId: sgId,
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
  const allSafeguards = controls.flatMap((c) => c.safeguards);
  const statCounts = { planned: 0, in_progress: 0, tested: 0, validated: 0 };
  for (const c of coverage.values()) {
    if (c.coverageStatus in statCounts) statCounts[c.coverageStatus as keyof typeof statCounts]++;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">CIS Controls Assessment</h3>
          <p className="text-sm text-muted-foreground">
            Track safeguard coverage per operation ({allSafeguards.length} safeguards across {controls.length} controls)
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

      {/* Progress by Control */}
      {controls.map((ctrl) => {
        const ctrlCovered = ctrl.safeguards.filter((sg) => {
          const cov = coverage.get(sg.id);
          return cov && (cov.coverageStatus === "tested" || cov.coverageStatus === "validated");
        }).length;
        const pct = ctrl.safeguards.length > 0 ? Math.round((ctrlCovered / ctrl.safeguards.length) * 100) : 0;

        return (
          <div key={ctrl.id} className="bg-card p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{ctrl.controlId}: {ctrl.name}</span>
              <span className="text-xs text-muted-foreground">{ctrlCovered}/{ctrl.safeguards.length} ({pct}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
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
          {controls.map((ctrl) => (
            <div key={ctrl.id}>
              <h4 className="text-sm font-bold mb-2 text-muted-foreground">
                {ctrl.controlId}: {ctrl.name}
              </h4>
              <div className="space-y-2">
                {ctrl.safeguards.map((sg) => {
                  const cov = coverage.get(sg.id);
                  const currentStatus = cov?.coverageStatus || "";
                  return (
                    <div key={sg.id} className="bg-card rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{sg.safeguardId}</span>
                          <span className="text-sm font-medium">{sg.name}</span>
                          {sg.implementationGroup && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-muted font-mono">
                              IG{sg.implementationGroup}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {statusOptions.map((s) => (
                            <button
                              key={s.value}
                              onClick={() => updateCoverage(sg.id, sg.safeguardId, s.value)}
                              className={`px-2 py-0.5 rounded text-xs transition-colors ${currentStatus === s.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={notesMap.get(sg.id) || ""}
                        onChange={(e) => setNotesMap((prev) => new Map(prev).set(sg.id, e.target.value))}
                        onBlur={() => saveNotes(sg.id, sg.safeguardId)}
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
      )}
    </div>
  );
}
