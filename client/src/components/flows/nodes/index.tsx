/**
 * Custom node types for the agent-flow canvas. Each node follows the existing
 * ToolNode/AtlasTechniqueNode Card pattern and exposes typed <Handle> ports
 * (see portTypes.ts). The node `data` shapes are the serialization contract with
 * the backend projection in server/api/v1/agent-flows.ts.
 */
import { Handle, Position } from "reactflow";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Server, Wrench, Zap, GitBranch, Repeat, Sparkles } from "lucide-react";
import { PORT_COLORS, STATUS_COLORS, PortType } from "./portTypes";

function PortHandle({
  type,
  position,
  id,
  portType,
  top,
  label,
}: {
  type: "source" | "target";
  position: Position;
  id: string;
  portType: PortType;
  top?: string;
  label?: string;
}) {
  return (
    <Handle
      type={type}
      position={position}
      id={id}
      title={label ?? `${portType} ${type}`}
      style={{
        background: PORT_COLORS[portType],
        width: 10,
        height: 10,
        border: "2px solid var(--background, #fff)",
        ...(top ? { top } : {}),
      }}
    />
  );
}

function statusRing(status?: string): string {
  const color = status ? STATUS_COLORS[status] : undefined;
  return color ? `0 0 0 2px ${color}` : "none";
}

// ---------------------------------------------------------------------------
// Agent node — mirrors the editable agent attributes (model, prompt, tools, etc.)
// ---------------------------------------------------------------------------
export function AgentNode({ data, selected }: any) {
  const inLoop = Array.isArray(data?.loopAgentIds) && data.loopAgentIds.length > 0;
  return (
    <Card
      className={`p-3 min-w-[210px] border-2 ${
        selected ? "border-blue-600" : "border-blue-400"
      } bg-blue-50 dark:bg-blue-950`}
      style={{ boxShadow: statusRing(data?.status) }}
    >
      <PortHandle type="target" position={Position.Left} id="seq-in" portType="sequence" top="32%" label="sequence in" />
      <PortHandle type="target" position={Position.Left} id="handoff-in" portType="handoff" top="68%" label="handoff in (receive control)" />
      <PortHandle type="target" position={Position.Top} id="mcp-in" portType="mcp" label="MCP in" />
      <PortHandle type="target" position={Position.Bottom} id="loop-in" portType="loop" top="70%" label="loop in" />

      <div className="flex items-center gap-2 mb-1">
        <Bot className="h-4 w-4 text-blue-600" />
        <span className="font-semibold text-sm truncate">{data?.label || "Agent"}</span>
      </div>
      {/* Model — auto-populated from the Agent-LLM tab; read-only on the node. */}
      <div className="flex items-center gap-1 mb-1 text-[11px]">
        <span className="text-muted-foreground">model:</span>
        <span className="font-mono truncate" title={data?.config?.model || "unset"}>
          {data?.config?.model || <span className="text-amber-600">unset</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-1">
        {data?.agentType && <Badge variant="outline" className="text-[10px]">{data.agentType}</Badge>}
        {inLoop && (
          <Badge className="text-[10px] bg-violet-500 hover:bg-violet-500">
            <Repeat className="h-3 w-3 mr-1" />loop
          </Badge>
        )}
      </div>
      {data?.status && (
        <div className="text-[10px] text-muted-foreground">status: {data.status}</div>
      )}
      {data?.invalid && (
        <Badge variant="destructive" className="text-[10px] mt-1">⚠ {data.invalidReason || "invalid"}</Badge>
      )}

      <PortHandle type="source" position={Position.Right} id="seq-out" portType="sequence" top="28%" label="sequence out" />
      <PortHandle type="source" position={Position.Right} id="data-out" portType="data" top="52%" label="data out" />
      <PortHandle type="source" position={Position.Right} id="handoff-out" portType="handoff" top="76%" label="handoff out (delegate control)" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function McpServerNode({ data, selected }: any) {
  return (
    <Card
      className={`p-3 min-w-[180px] border-2 ${
        selected ? "border-emerald-600" : "border-emerald-400"
      } bg-emerald-50 dark:bg-emerald-950`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Server className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold text-sm truncate">{data?.label || "MCP Server"}</span>
      </div>
      {data?.status && <Badge variant="outline" className="text-[10px]">{data.status}</Badge>}
      {data?.invalid && (
        <Badge variant="destructive" className="text-[10px] mt-1">⚠ {data.invalidReason || "missing"}</Badge>
      )}
      <PortHandle type="source" position={Position.Right} id="mcp-out" portType="mcp" label="tools out" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function SecurityToolNode({ data, selected }: any) {
  return (
    <Card
      className={`p-3 min-w-[180px] border-2 ${
        selected ? "border-indigo-600" : "border-indigo-400"
      } bg-indigo-50 dark:bg-indigo-950`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Wrench className="h-4 w-4 text-indigo-600" />
        <span className="font-semibold text-sm truncate">{data?.label || "Tool"}</span>
      </div>
      {data?.category && <Badge variant="outline" className="text-[10px]">{data.category}</Badge>}
      {data?.command && (
        <div className="text-[10px] mt-1 font-mono bg-black/10 px-1.5 py-0.5 rounded truncate">
          {data.command}
        </div>
      )}
      <PortHandle type="source" position={Position.Right} id="data-out" portType="data" label="result out" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skill node — a generated tool SKILL.md or bug-hunter knowledge skill, dragged
// from the palette. Attaches to an agent via the data port; carries skillId so
// the graph JSON records the association (no orchestrator wiring yet).
// ---------------------------------------------------------------------------
export function SkillNode({ data, selected }: any) {
  return (
    <Card
      className={`p-3 min-w-[180px] border-2 ${
        selected ? "border-teal-600" : "border-teal-400"
      } bg-teal-50 dark:bg-teal-950`}
    >
      <PortHandle type="target" position={Position.Left} id="data-in" portType="data" label="attach to agent" />
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-teal-600" />
        <span className="font-semibold text-sm truncate">{data?.label || "Skill"}</span>
      </div>
      {data?.skillKind && <Badge variant="outline" className="text-[10px]">{data.skillKind}</Badge>}
      {data?.summary && (
        <div className="text-[10px] mt-1 text-muted-foreground line-clamp-2">{data.summary}</div>
      )}
      <PortHandle type="source" position={Position.Right} id="data-out" portType="data" label="skill out" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function TriggerNode({ data, selected }: any) {
  return (
    <Card
      className={`p-3 min-w-[160px] border-2 ${
        selected ? "border-amber-600" : "border-amber-400"
      } bg-amber-50 dark:bg-amber-950`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-amber-600" />
        <span className="font-semibold text-sm">{data?.label || "Trigger"}</span>
      </div>
      <Badge variant="outline" className="text-[10px]">{data?.event || "manual"}</Badge>
      <PortHandle type="source" position={Position.Right} id="seq-out" portType="sequence" label="fire" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function ConditionNode({ data, selected }: any) {
  return (
    <Card
      className={`p-3 min-w-[180px] border-2 ${
        selected ? "border-amber-600" : "border-amber-500"
      } bg-amber-50 dark:bg-amber-950`}
    >
      <PortHandle type="target" position={Position.Left} id="seq-in" portType="sequence" label="in" />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="h-4 w-4 text-amber-600" />
        <span className="font-semibold text-sm">{data?.label || "Condition"}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">
        {(data?.conditionType || "context_has")}
        {data?.field ? ` · ${data.field}` : ""}
        {data?.operator ? ` ${data.operator}` : ""}
        {data?.value !== undefined && data?.value !== "" ? ` ${data.value}` : ""}
      </div>
      <PortHandle type="source" position={Position.Right} id="true-out" portType="sequence" top="35%" label="true" />
      <PortHandle type="source" position={Position.Right} id="false-out" portType="sequence" top="70%" label="false" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loop node — the "Add To Loop" group. Holds N agent ids that round-robin.
// ---------------------------------------------------------------------------
export function LoopNode({ data, selected }: any) {
  const count = Array.isArray(data?.agentIds) ? data.agentIds.length : 0;
  return (
    <Card
      className={`p-3 min-w-[190px] border-2 ${
        selected ? "border-violet-600" : "border-violet-400"
      } bg-violet-50 dark:bg-violet-950`}
    >
      <PortHandle type="target" position={Position.Left} id="loop-in" portType="loop" label="loop in" />
      <div className="flex items-center gap-2 mb-1">
        <Repeat className="h-4 w-4 text-violet-600" />
        <span className="font-semibold text-sm">{data?.label || "Analysis Loop"}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">{count} agent{count === 1 ? "" : "s"}</Badge>
        <Badge variant="outline" className="text-[10px]">×{data?.maxIterations ?? 5}</Badge>
        <Badge variant="outline" className="text-[10px]">{data?.exitCondition || "functional_poc"}</Badge>
      </div>
      <PortHandle type="source" position={Position.Right} id="loop-out" portType="loop" label="loop out" />
    </Card>
  );
}

export const flowNodeTypes = {
  agentNode: AgentNode,
  mcpServerNode: McpServerNode,
  securityToolNode: SecurityToolNode,
  skillNode: SkillNode,
  triggerNode: TriggerNode,
  conditionNode: ConditionNode,
  loopNode: LoopNode,
};
