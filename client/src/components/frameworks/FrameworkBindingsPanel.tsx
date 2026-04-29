import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Bot,
  Wrench,
  Plus,
  X,
  Loader2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export type FrameworkType = "owasp_llm" | "nist_ai" | "cis_v8" | "atlas" | "attck";
export type BindingKind = "tool" | "agent" | "workflow";
export type BindingStrength = "primary" | "supports" | "validates";

interface FrameworkBindingsPanelProps {
  frameworkType: FrameworkType;
  /** Canonical ID of the control / category / safeguard (e.g. "LLM01", "GV.OC-01", "1.1"). */
  externalId: string;
}

interface ExpandedBinding {
  id: string;
  frameworkType: FrameworkType;
  frameworkElementExternalId: string;
  bindingKind: BindingKind;
  targetId: string;
  strength: BindingStrength;
  confidence: number | null;
  rationale: string | null;
  targetName: string | null;
}

interface ToolOption {
  id: string;
  name: string;
  category?: string;
}

interface AgentOption {
  id: string;
  name: string;
  type?: string;
}

const STRENGTH_LABEL: Record<BindingStrength, string> = {
  primary: "Primary",
  supports: "Supports",
  validates: "Validates",
};

const STRENGTH_COLOR: Record<BindingStrength, string> = {
  primary: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  supports: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  validates: "bg-green-500/10 text-green-700 dark:text-green-300",
};

/**
 * Reusable bindings editor for a single framework element. Lets admins attach
 * tools or agents with a strength label; non-admins see read-only chips.
 */
export default function FrameworkBindingsPanel({
  frameworkType,
  externalId,
}: FrameworkBindingsPanelProps) {
  const { isAdmin } = useAuth();
  const canEdit = isAdmin();

  const [bindings, setBindings] = useState<ExpandedBinding[]>([]);
  const [tools, setTools] = useState<ToolOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [pickKind, setPickKind] = useState<BindingKind>("tool");
  const [pickTarget, setPickTarget] = useState<string>("");
  const [pickStrength, setPickStrength] = useState<BindingStrength>("supports");

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ bindings: ExpandedBinding[] }>(
        `/frameworks/${frameworkType}/${encodeURIComponent(externalId)}/bindings`,
      );
      setBindings(data.bindings || []);
    } catch (err) {
      // Surface only on edit pages — read-only render still works with empty list.
      console.warn("[FrameworkBindingsPanel] refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, [frameworkType, externalId]);

  // Lazy-load options only when admin opens the picker, but listing the
  // bindings always runs.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadOptions = useCallback(async () => {
    if (tools.length > 0 && agents.length > 0) return;
    try {
      const [toolsData, agentsData] = await Promise.all([
        api.get<{ tools: ToolOption[] }>("/tools"),
        api.get<{ agents: AgentOption[] }>("/agents"),
      ]);
      setTools(toolsData.tools || []);
      setAgents(agentsData.agents || []);
    } catch (err) {
      toast.error("Failed to load tools/agents");
    }
  }, [tools.length, agents.length]);

  async function handleCreate() {
    if (!pickTarget) {
      toast.error("Select a target");
      return;
    }
    setAdding(true);
    try {
      await api.post("/frameworks/bindings", {
        frameworkType,
        frameworkElementExternalId: externalId,
        bindingKind: pickKind,
        targetId: pickTarget,
        strength: pickStrength,
      });
      setPickTarget("");
      await refresh();
      toast.success("Binding added");
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Failed to add binding";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(bindingId: string) {
    try {
      await api.delete(`/frameworks/bindings/${bindingId}`);
      setBindings((prev) => prev.filter((b) => b.id !== bindingId));
      toast.success("Binding removed");
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Failed to remove binding";
      toast.error(msg);
    }
  }

  const targetOptions = pickKind === "tool" ? tools : agents;

  // Group bindings by kind for cleaner display.
  const toolBindings = bindings.filter((b) => b.bindingKind === "tool");
  const agentBindings = bindings.filter((b) => b.bindingKind === "agent");

  return (
    <div className="bg-muted/30 rounded-md border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">Tools & Agents</h4>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {bindings.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground italic">
          No tools or agents bound to this control yet.
          {canEdit && " Use the form below to add one."}
        </p>
      )}

      {(toolBindings.length > 0 || agentBindings.length > 0) && (
        <div className="space-y-2">
          {toolBindings.length > 0 && (
            <BindingGroup
              icon={<Wrench className="h-3 w-3" />}
              label="Tools"
              bindings={toolBindings}
              canEdit={canEdit}
              onRemove={handleRemove}
            />
          )}
          {agentBindings.length > 0 && (
            <BindingGroup
              icon={<Bot className="h-3 w-3" />}
              label="Agents"
              bindings={agentBindings}
              canEdit={canEdit}
              onRemove={handleRemove}
            />
          )}
        </div>
      )}

      {canEdit && (
        <div
          className="border-t border-border pt-3 space-y-2"
          onMouseEnter={loadOptions}
          onFocusCapture={loadOptions}
        >
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[110px]">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Kind
              </label>
              <Select
                value={pickKind}
                onValueChange={(v) => {
                  setPickKind(v as BindingKind);
                  setPickTarget("");
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tool">Tool</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-[2] min-w-[180px]">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Target
              </label>
              <Select
                value={pickTarget}
                onValueChange={setPickTarget}
                onOpenChange={(open) => {
                  if (open) loadOptions();
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue
                    placeholder={
                      targetOptions.length === 0
                        ? `Select ${pickKind}…`
                        : `Pick a ${pickKind}`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Strength
              </label>
              <Select
                value={pickStrength}
                onValueChange={(v) => setPickStrength(v as BindingStrength)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="supports">Supports</SelectItem>
                  <SelectItem value="validates">Validates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={adding || !pickTarget}
              className="h-8"
            >
              {adding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BindingGroup({
  icon,
  label,
  bindings,
  canEdit,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  bindings: ExpandedBinding[];
  canEdit: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {bindings.map((b) => (
          <div
            key={b.id}
            className="inline-flex items-center gap-1.5 bg-card border border-border rounded-md px-2 py-1"
          >
            <span className="text-xs font-medium">
              {b.targetName ?? <em className="text-muted-foreground">(deleted)</em>}
            </span>
            <Badge
              variant="secondary"
              className={`text-[10px] py-0 px-1.5 ${STRENGTH_COLOR[b.strength]}`}
            >
              {STRENGTH_LABEL[b.strength]}
            </Badge>
            {canEdit && (
              <button
                type="button"
                onClick={() => onRemove(b.id)}
                className="text-muted-foreground hover:text-red-600"
                aria-label="Remove binding"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
