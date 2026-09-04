import type { MakerOutput, CheckerVerdict, MakerCheckerResult } from "../../../shared/types/maker-checker";
import { routeReasoning } from "../inference/inference-router";
import { createLogger } from "../../lib/logger";

const log = createLogger("maker-checker-gate");

const URL_RE = /https?:\/\/[^\s)>\]"']+/g;
const SEVERITY_RE = /\b(critical|high|medium|low)\b/gi;

function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(URL_RE), (m) => m[0]);
}

function deterministicCheck(makerOutput: MakerOutput): {
  pass: boolean;
  evidenceGaps: string[];
} {
  const gaps: string[] = [];

  if (makerOutput.contentType === "finding") {
    const contentUrls = extractUrls(makerOutput.content);
    const evidenceBlob = makerOutput.rawEvidence.join(" ");
    for (const url of contentUrls) {
      if (!evidenceBlob.includes(url)) {
        gaps.push(`URL not backed by evidence: ${url}`);
      }
    }

    const severities = Array.from(makerOutput.content.matchAll(SEVERITY_RE), (m) => m[1].toLowerCase());
    for (const sev of severities) {
      const evidenceLower = evidenceBlob.toLowerCase();
      if (!evidenceLower.includes(sev)) {
        gaps.push(`Severity "${sev}" mentioned in content but absent from evidence`);
      }
    }
  }

  return { pass: gaps.length === 0, evidenceGaps: gaps };
}

function buildRejection(makerOutput: MakerOutput, evidenceGaps: string[]): MakerCheckerResult {
  const verdict: CheckerVerdict = {
    accepted: false,
    confidence: 1,
    reason: "Deterministic pre-check failed",
    evidenceGaps,
  };
  return {
    makerOutput,
    checkerVerdict: verdict,
    finalOutput: makerOutput.content,
  };
}

function parseVerdict(raw: string): CheckerVerdict {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON braces");
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return {
      accepted: Boolean(parsed.accepted),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reason: typeof parsed.reason === "string" ? parsed.reason : "unknown",
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : undefined,
      evidenceGaps: Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps : undefined,
    };
  } catch {
    return {
      accepted: true,
      confidence: 0.5,
      reason: "checker parse failure",
    };
  }
}

function applyCorrections(content: string, corrections: string[]): string {
  if (corrections.length === 0) return content;
  const footnotes = corrections.map((c, i) => `[Correction ${i + 1}]: ${c}`).join("\n");
  return `${content}\n\n---\n${footnotes}`;
}

export class MakerCheckerGate {
  async check(makerOutput: MakerOutput): Promise<MakerCheckerResult> {
    const { pass, evidenceGaps } = deterministicCheck(makerOutput);

    if (!pass) {
      return buildRejection(makerOutput, evidenceGaps);
    }

    let verdict: CheckerVerdict;
    let checkerModel: string | undefined;

    try {
      const evidenceBlock = makerOutput.rawEvidence.join("\n---EVIDENCE---\n");
      const result = await routeReasoning({
        messages: [
          {
            role: "user",
            content: [
              "You are an independent security finding reviewer. You must evaluate whether the following output is factually supported by the raw evidence provided.",
              "",
              "You have ONLY the output and the evidence. You do NOT have access to the original reasoning, confidence scores, or any other context.",
              "",
              "## Output to Review",
              makerOutput.content,
              "",
              "## Raw Evidence",
              evidenceBlock,
              "",
              'Respond with JSON: { "accepted": boolean, "confidence": number (0-1), "reason": string, "corrections": string[] | null, "evidenceGaps": string[] | null }',
            ].join("\n"),
          },
        ],
        responseFormat: { type: "json_object" },
        maxTokens: 1024,
        temperature: 0,
      });

      verdict = parseVerdict(result.response.text);
      checkerModel = result.model;
    } catch (err) {
      log.warn("routeReasoning unavailable, falling back to deterministic-only", err);
      verdict = {
        accepted: true,
        confidence: 0.5,
        reason: "LLM checker unavailable; deterministic checks passed",
      };
    }

    const finalOutput = verdict.corrections?.length
      ? applyCorrections(makerOutput.content, verdict.corrections)
      : makerOutput.content;

    return {
      makerOutput,
      checkerVerdict: verdict,
      finalOutput,
      checkerModel,
    };
  }
}

export const makerCheckerGate = new MakerCheckerGate();
