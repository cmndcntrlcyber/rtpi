import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Safeguard {
  id: string;
  safeguardId: string;
  controlId: string;
  name: string;
  description: string | null;
  implementationGroup: number | null;
  assetType: string | null;
  securityFunction: string | null;
}

interface CISControl {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  assetType: string | null;
  securityFunction: string | null;
  safeguards: Safeguard[];
}

const igBadge: Record<number, string> = {
  1: "bg-green-600 text-white",
  2: "bg-yellow-500 text-black",
  3: "bg-red-600 text-white",
};

const sfBadge: Record<string, string> = {
  Identify: "bg-blue-600 text-white",
  Protect: "bg-green-600 text-white",
  Detect: "bg-yellow-500 text-black",
  Respond: "bg-orange-500 text-white",
  Recover: "bg-purple-600 text-white",
};

export default function CISControlsTable() {
  const [controls, setControls] = useState<CISControl[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filterIG, setFilterIG] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/v1/cis/all", { credentials: "include" })
      .then((r) => r.json())
      .then(setControls)
      .catch((e) => console.error("Failed to fetch CIS controls:", e))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading controls...</div>;

  if (controls.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border text-center text-muted-foreground">
        No controls imported yet. Click "Import CIS Controls v8" above.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Implementation Group:</span>
        {[null, 1, 2, 3].map((ig) => (
          <button
            key={ig ?? "all"}
            onClick={() => setFilterIG(ig)}
            className={`px-3 py-1 rounded text-xs transition-colors ${filterIG === ig ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            {ig === null ? "All" : `IG${ig}`}
          </button>
        ))}
      </div>

      {controls.map((ctrl) => {
        const filteredSafeguards = filterIG
          ? ctrl.safeguards.filter((sg) => sg.implementationGroup !== null && sg.implementationGroup <= filterIG)
          : ctrl.safeguards;

        return (
          <div key={ctrl.id} className="bg-card rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => toggle(ctrl.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {expanded.has(ctrl.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-mono text-sm text-muted-foreground">{ctrl.controlId}</span>
                <span className="font-semibold">{ctrl.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {ctrl.securityFunction && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${sfBadge[ctrl.securityFunction] || "bg-gray-500 text-white"}`}>
                    {ctrl.securityFunction}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {filteredSafeguards.length} safeguards
                </span>
              </div>
            </button>

            {expanded.has(ctrl.id) && (
              <div className="border-t border-border p-4 space-y-3">
                {ctrl.description && (
                  <p className="text-sm text-muted-foreground mb-3">{ctrl.description}</p>
                )}
                {filteredSafeguards.map((sg) => (
                  <div key={sg.id} className="bg-muted/30 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{sg.safeguardId}</span>
                        <span className="text-sm font-medium">{sg.name}</span>
                      </div>
                      <div className="flex gap-1">
                        {sg.implementationGroup && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${igBadge[sg.implementationGroup] || "bg-gray-500 text-white"}`}>
                            IG{sg.implementationGroup}
                          </span>
                        )}
                        {sg.securityFunction && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${sfBadge[sg.securityFunction] || "bg-gray-500 text-white"}`}>
                            {sg.securityFunction}
                          </span>
                        )}
                      </div>
                    </div>
                    {sg.description && (
                      <p className="text-xs text-muted-foreground">{sg.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
