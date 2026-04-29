/**
 * Container Error Classifier (v2.9.1 Phase 5)
 *
 * Maps low-level Docker / dockerode / network errors to a structured
 * taxonomy the UI can render with actionable remediation copy. Replaces
 * the brittle string-match `error.message.includes('timeout')` checks
 * that were scattered through the executor layer.
 */

export type ContainerErrorCode =
  | "container_not_found"
  | "not_running"
  | "timeout"
  | "socket_unreachable"
  | "exec_failed"
  | "invalid_command";

export interface StructuredContainerError {
  code: ContainerErrorCode;
  retryable: boolean;
  remediation: string;
  /** Original message kept for debugging surfaces. */
  message: string;
}

export class ContainerError extends Error {
  constructor(public readonly structured: StructuredContainerError) {
    super(structured.message);
    this.name = "ContainerError";
  }

  /** Convenience accessor used by API routers to choose an HTTP status. */
  get suggestedHttpStatus(): number {
    switch (this.structured.code) {
      case "container_not_found":
        return 404;
      case "not_running":
      case "socket_unreachable":
        return 503;
      case "timeout":
        return 504;
      case "invalid_command":
        return 400;
      case "exec_failed":
      default:
        return 500;
    }
  }
}

const REMEDIATION: Record<ContainerErrorCode, string> = {
  container_not_found:
    "Container does not exist. Run `docker compose ps` to confirm the expected service is up; reapply the right `--profile` if the service is profile-gated.",
  not_running:
    "Container exists but is stopped. Run `docker compose start <service>` or check logs for the most recent crash.",
  timeout:
    "Command exceeded the execution timeout. Either increase the per-tool timeout or check whether the tool is hanging on input.",
  socket_unreachable:
    "Cannot reach the Docker socket. Verify `DOCKER_HOST` env or that `/var/run/docker.sock` is mounted with the right permissions.",
  exec_failed:
    "Command execution failed inside the container. Inspect the captured stderr and exit code for the underlying cause.",
  invalid_command:
    "Command failed validation (likely a forbidden pattern or missing argument). Check the tool's parameter schema.",
};

function rem(code: ContainerErrorCode, override?: string): string {
  return override || REMEDIATION[code];
}

/**
 * Walk the Error.cause chain to find a Node errno code. Same pattern as the
 * Sysreptor classifier so AggregateError.errors arrays from undici are also
 * inspected.
 */
function extractErrnoCode(err: unknown): string | undefined {
  let current: any = err;
  for (let i = 0; i < 5 && current; i++) {
    if (typeof current.code === "string") return current.code;
    if (typeof current.statusCode === "number") return `HTTP_${current.statusCode}`;
    if (Array.isArray(current.errors)) {
      for (const sub of current.errors) {
        const c = extractErrnoCode(sub);
        if (c) return c;
      }
    }
    current = current.cause;
  }
  return undefined;
}

/**
 * Classify a thrown Error from dockerode / native fetch / fs into a
 * StructuredContainerError. Caller decides whether to throw or surface.
 */
export function classifyContainerError(
  err: unknown,
  context: { containerName?: string; cmd?: string[]; phase?: "inspect" | "exec" } = {},
): StructuredContainerError {
  const message = err instanceof Error ? err.message : String(err);
  const code = extractErrnoCode(err);
  const lowered = message.toLowerCase();

  // Validation rejections from the executor layer fly past as plain Errors.
  if (lowered.includes("dangerous pattern") || lowered.includes("invalid command")) {
    return {
      code: "invalid_command",
      retryable: false,
      remediation: rem("invalid_command"),
      message,
    };
  }

  // dockerode 'no such container' / 'container does not exist'
  if (
    code === "HTTP_404" ||
    lowered.includes("no such container") ||
    lowered.includes("container not found")
  ) {
    return {
      code: "container_not_found",
      retryable: false,
      remediation: rem("container_not_found"),
      message,
    };
  }

  // Our own assertion + dockerode 'is not running' / 'container is paused'
  if (
    lowered.includes("is not running") ||
    lowered.includes("container is not running") ||
    lowered.includes("is paused")
  ) {
    return {
      code: "not_running",
      retryable: true, // the operator can start the container and retry
      remediation: rem("not_running"),
      message,
    };
  }

  // Timeout — prefer typed AbortError over substring match, but fall back.
  if (
    code === "ABORT_ERR" ||
    lowered.includes("timeout") ||
    lowered.includes("operation timed out")
  ) {
    return {
      code: "timeout",
      retryable: true,
      remediation: rem("timeout"),
      message,
    };
  }

  // Docker socket unreachable
  if (
    code === "ECONNREFUSED" ||
    code === "EACCES" ||
    code === "ENOENT" ||
    lowered.includes("docker socket") ||
    lowered.includes("/var/run/docker.sock")
  ) {
    return {
      code: "socket_unreachable",
      retryable: true,
      remediation: rem("socket_unreachable"),
      message,
    };
  }

  return {
    code: "exec_failed",
    retryable: false,
    remediation: rem("exec_failed"),
    message,
  };
}

/**
 * Throw helper for the executor layer. Wraps the classification + ContainerError.
 */
export function throwClassified(
  err: unknown,
  context?: Parameters<typeof classifyContainerError>[1],
): never {
  if (err instanceof ContainerError) throw err;
  throw new ContainerError(classifyContainerError(err, context));
}
