/**
 * Typed, color-coded ports for the agent-flow canvas (Langflow-style).
 * A connection is valid only when both ends share a port type. MCP→agent works
 * because both ends are the `mcp` type. The port type is encoded in the handle id
 * prefix so the canvas can validate connections without extra metadata.
 */

export type PortType = "data" | "sequence" | "mcp" | "loop" | "handoff";

export const PORT_COLORS: Record<PortType, string> = {
  data: "#6366f1", // indigo
  sequence: "#f59e0b", // amber
  mcp: "#10b981", // emerald
  loop: "#8b5cf6", // violet
  handoff: "#f43f5e", // rose
};

/** Infer a port's data type from its handle id prefix. */
export function portTypeOf(handleId?: string | null): PortType | null {
  if (!handleId) return null;
  if (handleId.startsWith("handoff")) return "handoff";
  if (handleId.startsWith("seq") || handleId.startsWith("true") || handleId.startsWith("false")) {
    return "sequence";
  }
  if (handleId.startsWith("mcp")) return "mcp";
  if (handleId.startsWith("loop")) return "loop";
  if (handleId.startsWith("data")) return "data";
  return null;
}

/** Live execution status → node accent color. */
export const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8", // slate
  running: "#3b82f6", // blue
  completed: "#22c55e", // green
  failed: "#ef4444", // red
  skipped: "#a3a3a3", // neutral
};
