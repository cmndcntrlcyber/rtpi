/** Classifies tool execution errors and produces structured, actionable messages. */
import { createLogger } from '../../lib/logger';

const log = createLogger('error-triage');

export type ErrorClass =
  | 'timeout'
  | 'auth'
  | 'missing_dep'
  | 'config'
  | 'runtime'
  | 'network'
  | 'permission'
  | 'unknown';

export interface TriageResult {
  errorClass: ErrorClass;
  fixAction: string | null;
  retryable: boolean;
  userMessage: string;
}

const CLASS_META: Record<ErrorClass, { fixAction: string | null; retryable: boolean }> = {
  timeout: { fixAction: 'Reduce scan scope or increase timeout', retryable: true },
  network: { fixAction: 'Verify target is reachable and network connectivity', retryable: true },
  permission: { fixAction: 'Check file/container permissions', retryable: false },
  missing_dep: { fixAction: 'Install required tool or dependency', retryable: false },
  auth: { fixAction: 'Check API keys or credentials configuration', retryable: false },
  runtime: { fixAction: 'Tool crashed — try with different arguments or smaller input', retryable: true },
  config: { fixAction: 'Fix tool arguments — check usage documentation', retryable: true },
  unknown: { fixAction: null, retryable: false },
};

const USER_MESSAGES: Record<ErrorClass, string> = {
  timeout: 'Tool execution timed out before completing',
  network: 'Network error — could not reach the target or an upstream service',
  permission: 'Permission denied during tool execution',
  missing_dep: 'A required tool or dependency is not installed',
  auth: 'Authentication or authorization failure',
  runtime: 'Tool crashed unexpectedly during execution',
  config: 'Invalid tool configuration or arguments',
  unknown: 'Tool failed with an unrecognized error',
};

type Pattern = { re: RegExp; cls: ErrorClass };

const PATTERNS: Pattern[] = [
  { re: /connection refused/i, cls: 'network' },
  { re: /ECONNREFUSED/i, cls: 'network' },
  { re: /EHOSTUNREACH/i, cls: 'network' },
  { re: /ENETUNREACH/i, cls: 'network' },
  { re: /no route to host/i, cls: 'network' },
  { re: /EACCES/i, cls: 'permission' },
  { re: /permission denied/i, cls: 'permission' },
  { re: /Operation not permitted/i, cls: 'permission' },
  { re: /command not found/i, cls: 'missing_dep' },
  { re: /No such file or directory/i, cls: 'missing_dep' },
  { re: /not installed/i, cls: 'missing_dep' },
  { re: /\b401\b/, cls: 'auth' },
  { re: /\b403\b/, cls: 'auth' },
  { re: /Unauthorized/i, cls: 'auth' },
  { re: /authentication failed/i, cls: 'auth' },
  { re: /invalid credentials/i, cls: 'auth' },
  { re: /API key/i, cls: 'auth' },
  { re: /ENOMEM/i, cls: 'runtime' },
  { re: /segfault/i, cls: 'runtime' },
  { re: /Segmentation fault/i, cls: 'runtime' },
  { re: /core dumped/i, cls: 'runtime' },
  { re: /\bkilled\b/i, cls: 'runtime' },
  { re: /invalid option/i, cls: 'config' },
  { re: /unrecognized option/i, cls: 'config' },
  { re: /missing required/i, cls: 'config' },
  { re: /\busage:/i, cls: 'config' },
];

export function triageError(
  stderr: string,
  exitCode: number,
  toolId: string,
  timedOut: boolean,
): TriageResult {
  let errorClass: ErrorClass = 'unknown';

  if (timedOut || exitCode === 124) {
    errorClass = 'timeout';
  } else {
    for (const { re, cls } of PATTERNS) {
      if (re.test(stderr)) {
        errorClass = cls;
        break;
      }
    }
  }

  const meta = CLASS_META[errorClass];
  const userMessage = `[${toolId}] ${USER_MESSAGES[errorClass]}`;

  log.debug({ toolId, errorClass, exitCode, timedOut }, 'triaged tool error');

  return {
    errorClass,
    fixAction: meta.fixAction,
    retryable: meta.retryable,
    userMessage,
  };
}

export function formatTriagedError(result: TriageResult, rawStderr: string): string {
  const lines: string[] = [
    `[ERROR: ${result.errorClass.toUpperCase()}] ${result.userMessage}`,
  ];

  if (result.fixAction !== null) {
    lines.push(`Fix: ${result.fixAction}`);
  }

  lines.push(`Retryable: ${result.retryable ? 'yes' : 'no'}`);
  lines.push(`Raw (truncated): ${rawStderr.slice(0, 500)}`);

  return lines.join('\n');
}
