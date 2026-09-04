/**
 * Tool output evidence assessment.
 *
 * Distinguishes "the tool actually ran and produced output" from "the tool was
 * misinvoked and printed a banner / nothing" (e.g. an interactive REPL launched
 * with no script, which exits 0). This is the backstop against architectural
 * hallucinated-success: a zero exit code is NECESSARY but NOT SUFFICIENT to call
 * a step real.
 *
 * Pure module — no DB / IO imports — so it is cheap to unit test and safe to
 * import from both tool-executor and the workflow orchestrator.
 *
 * Background: tool_registry rows with an empty `baseCommand` + a positional
 * `target` param cause buildCommand to emit the bare target as the whole command
 * (see tool-executor.ts buildCommand happy path). msfconsole then prints its
 * splash, exits 0, and the orchestrator counted that as success. The signatures
 * below catch that class of no-op without punishing an honest empty scan.
 */

export interface ToolEvidence {
  /** true when the output represents real tool work. */
  hasEvidence: boolean;
  /** human-readable rationale; logged so it shows up in the defect Pareto. */
  reason: string;
}

/** Output shorter than this (and unstructured) is treated as "did no work". */
export const MIN_EVIDENCE_BYTES = 48;

/**
 * Signatures of "launched but did no work" output. Deliberately conservative —
 * each should match a tool that started up and exited without performing its
 * task, never the substantive output of a real run.
 */
export const NO_WORK_SIGNATURES: RegExp[] = [
  /=\[ metasploit/i, // msfconsole splash art header
  /metasploit v\d/i, // version banner
  /\bmsf\d?\s*>\s*$/i, // a bare msf prompt with no command output after it
  /^#\s*no-target-supplied/i, // our own stub sentinel command echoed back
];

function hasStructuredOutput(parsedOutput: unknown): boolean {
  if (parsedOutput === null || parsedOutput === undefined) return false;
  if (Array.isArray(parsedOutput)) return parsedOutput.length > 0;
  if (typeof parsedOutput === "object") return Object.keys(parsedOutput as object).length > 0;
  // A primitive (string/number/bool) parsed result still counts as a finding.
  return String(parsedOutput).trim().length > 0;
}

/**
 * Assess whether a tool execution produced real evidence of work.
 *
 * @param command       the command string that was actually executed
 * @param target        the resolved target value passed to the tool
 * @param stdout        captured stdout (may be truncated)
 * @param parsedOutput  structured parse of the output, if any
 */
export function assessToolEvidence(
  command: string | null | undefined,
  target: string | null | undefined,
  stdout: string | null | undefined,
  parsedOutput: unknown,
): ToolEvidence {
  const cmd = (command || "").trim();
  const out = (stdout || "").trim();
  const tgt = (target ?? "").toString().trim();

  // 1. Command shape — misconfiguration detection. The command stored now
  //    includes binaryPath (e.g. "nmap 20.157.93.108"), so we check:
  //    a) Legacy: command IS just the bare target (no binary prefix at all)
  //    b) The no-target-supplied sentinel (anywhere in cmd)
  if (tgt && cmd === tgt) {
    return { hasEvidence: false, reason: "command was bare target (misconfigured baseCommand)" };
  }
  if (/(?:^|\s)#\s*no-target-supplied/.test(cmd)) {
    return { hasEvidence: false, reason: "no-target-supplied sentinel command" };
  }

  // 2. Structured findings are always real evidence.
  if (hasStructuredOutput(parsedOutput)) {
    return { hasEvidence: true, reason: "parsed structured output present" };
  }

  // 3. Banner-only output → launched but idle. Bounded by length so a real run
  //    that merely happens to mention "metasploit" deep in long output is safe.
  if (out.length < 2000 && NO_WORK_SIGNATURES.some((re) => re.test(out))) {
    return { hasEvidence: false, reason: "output matched a launched-but-idle banner signature" };
  }

  // 4. Trivially short output with no structure → nothing meaningful happened.
  if (out.length < MIN_EVIDENCE_BYTES) {
    return { hasEvidence: false, reason: `output too short (${out.length}b) to be real work` };
  }

  // 5. Substantive output (incl. an honest "0 hosts up" style empty result).
  return { hasEvidence: true, reason: "substantive stdout" };
}
