import { routeReasoning } from "../inference/inference-router";
import {
  VoteFieldType,
  VoteRequest,
  VoterConfig,
  VotingResult,
} from "../../../shared/types/voting-types";
import { createLogger } from "../../lib/logger";

const log = createLogger("voting-panel");

const BASE_TEMPERATURES = [0.3, 0.5, 0.7];

function buildVoterConfigs(count: number): VoterConfig[] {
  const configs: VoterConfig[] = [];
  for (let i = 0; i < count; i++) {
    configs.push({ temperature: BASE_TEMPERATURES[i % BASE_TEMPERATURES.length] });
  }
  return configs;
}

function buildVoterPrompt(request: VoteRequest): string {
  return `${request.context ? request.context + "\n\n" : ""}${request.prompt}\n\nRespond with ONLY valid JSON matching this schema:\n${JSON.stringify(request.schema, null, 2)}\n\nEach field should have the type indicated. Categorical fields should be a single string label. Numerical fields should be a number. Boolean fields should be true or false.`;
}

function majorityVote<V>(values: V[]): V {
  const counts = new Map<string, { value: V; count: number }>();
  for (const v of values) {
    const key = JSON.stringify(v);
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { value: v, count: 1 });
    }
  }
  let best: { value: V; count: number } = { value: values[0], count: 0 };
  for (const entry of counts.values()) {
    if (entry.count > best.count) {
      best = entry;
    }
  }
  return best.value;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function aggregateField(
  fieldName: string,
  fieldType: VoteFieldType,
  votes: Record<string, unknown>[],
  requiredUnanimousFields: string[],
): unknown {
  const values = votes.map((v) => v[fieldName]).filter((v) => v !== undefined);
  if (values.length === 0) return fieldType === "boolean" ? false : fieldType === "numerical" ? 0 : "";

  if (fieldType === "categorical") {
    return majorityVote(values);
  }

  if (fieldType === "numerical") {
    const nums = values.filter((v) => typeof v === "number") as number[];
    if (nums.length === 0) return 0;
    return median(nums);
  }

  if (fieldType === "boolean") {
    const bools = values.filter((v) => typeof v === "boolean") as boolean[];
    if (bools.length === 0) return false;
    if (requiredUnanimousFields.includes(fieldName)) {
      return bools.every((b) => b === true);
    }
    const threshold = Math.ceil(bools.length / 2);
    const trueCount = bools.filter((b) => b).length;
    return trueCount >= threshold;
  }

  return values[0];
}

function computeFieldAgreement(
  fieldName: string,
  consensusValue: unknown,
  votes: Record<string, unknown>[],
): number {
  if (votes.length === 0) return 0;
  const agreeing = votes.filter((v) => JSON.stringify(v[fieldName]) === JSON.stringify(consensusValue));
  return agreeing.length / votes.length;
}

export class VotingPanel {
  async vote<T = Record<string, unknown>>(request: VoteRequest): Promise<VotingResult<T>> {
    const voterCount = request.voterCount || parseInt(process.env.VOTING_PANEL_SIZE || "3");
    const configs = buildVoterConfigs(voterCount);
    const prompt = buildVoterPrompt(request);

    const results = await Promise.allSettled(
      configs.map((config) =>
        routeReasoning({
          messages: [{ role: "user", content: prompt }],
          temperature: config.temperature,
          ...(config.modelOverride ? { explicitModel: config.modelOverride } : {}),
          responseFormat: { type: "json_object" },
        }),
      ),
    );

    const validVotes: Record<string, unknown>[] = [];
    for (const result of results) {
      if (result.status === "rejected") {
        log.warn("Voter failed: %s", result.reason?.message ?? result.reason);
        continue;
      }
      try {
        const text = result.value.response.text;
        const parsed = JSON.parse(text);
        validVotes.push(parsed);
      } catch (e) {
        log.warn("Voter response failed to parse as JSON");
      }
    }

    if (validVotes.length === 0) {
      return {
        consensus: {} as T,
        votes: [],
        confidence: 0,
        voterCount,
        agreementByField: {},
      };
    }

    const requiredUnanimousFields = request.requiredUnanimousFields || [];
    const consensus: Record<string, unknown> = {};
    const agreementByField: Record<string, number> = {};

    for (const [fieldName, fieldType] of Object.entries(request.schema)) {
      consensus[fieldName] = aggregateField(fieldName, fieldType, validVotes, requiredUnanimousFields);
      agreementByField[fieldName] = computeFieldAgreement(fieldName, consensus[fieldName], validVotes);
    }

    const fieldKeys = Object.keys(request.schema);
    const overallConfidence =
      fieldKeys.length > 0
        ? fieldKeys.reduce((sum, k) => sum + agreementByField[k], 0) / fieldKeys.length
        : 0;

    return {
      consensus: consensus as T,
      votes: validVotes as T[],
      confidence: validVotes.length === 1 ? 1 / voterCount : overallConfidence,
      voterCount,
      agreementByField,
    };
  }
}

export const votingPanel = new VotingPanel();
