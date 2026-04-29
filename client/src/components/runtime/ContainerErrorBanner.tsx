import {
  AlertTriangle,
  Clock,
  ServerOff,
  XCircle,
  Plug,
  ShieldAlert,
} from "lucide-react";

export type ContainerErrorCode =
  | "container_not_found"
  | "not_running"
  | "timeout"
  | "socket_unreachable"
  | "exec_failed"
  | "invalid_command"
  | "tool_execution_failed"
  | "mcp_not_running"
  | "mcp_invocation_failed";

interface StructuredError {
  code?: ContainerErrorCode | string;
  retryable?: boolean;
  remediation?: string;
  message?: string;
  /** Some endpoints return `error: "tool_execution_failed"` and put the
   *  taxonomy code in a separate field; we accept both. */
  error?: string;
}

interface ContainerErrorBannerProps {
  error: StructuredError | null | undefined;
  onRetry?: () => void;
}

const ICON: Record<ContainerErrorCode, JSX.Element> = {
  container_not_found: <ServerOff className="h-4 w-4 text-red-600" />,
  not_running: <ServerOff className="h-4 w-4 text-amber-600" />,
  timeout: <Clock className="h-4 w-4 text-amber-600" />,
  socket_unreachable: <Plug className="h-4 w-4 text-red-600" />,
  exec_failed: <XCircle className="h-4 w-4 text-red-600" />,
  invalid_command: <ShieldAlert className="h-4 w-4 text-red-600" />,
  tool_execution_failed: <XCircle className="h-4 w-4 text-red-600" />,
  mcp_not_running: <ServerOff className="h-4 w-4 text-amber-600" />,
  mcp_invocation_failed: <XCircle className="h-4 w-4 text-red-600" />,
};

const TITLE: Record<ContainerErrorCode, string> = {
  container_not_found: "Container does not exist",
  not_running: "Container is not running",
  timeout: "Execution timed out",
  socket_unreachable: "Docker socket unreachable",
  exec_failed: "Tool execution failed",
  invalid_command: "Command rejected by validation",
  tool_execution_failed: "Tool execution failed",
  mcp_not_running: "MCP server is not running",
  mcp_invocation_failed: "MCP tool call failed",
};

/**
 * Renders a structured error from the runtime taxonomy. Usage:
 *
 *   <ContainerErrorBanner error={result?.error} onRetry={refetch} />
 *
 * Falls through to a generic banner when `code` doesn't match the taxonomy,
 * so consumers can pass any error shape without checking shape first.
 */
export default function ContainerErrorBanner({ error, onRetry }: ContainerErrorBannerProps) {
  if (!error) return null;

  const code = (error.code ?? error.error) as ContainerErrorCode | undefined;
  const known = code && code in TITLE;
  const title = known ? TITLE[code as ContainerErrorCode] : "Operation failed";
  const icon = known ? ICON[code as ContainerErrorCode] : <AlertTriangle className="h-4 w-4 text-red-600" />;

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{title}</span>
          {error.retryable && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              retryable
            </span>
          )}
        </div>
        {error.remediation && (
          <p className="text-xs text-muted-foreground mt-1">{error.remediation}</p>
        )}
        {error.message && error.message !== error.remediation && (
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 font-mono break-all">
            {error.message}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs px-2 py-1 rounded hover:bg-red-500/10 text-red-700 dark:text-red-300 flex-shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}
