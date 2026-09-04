export type VoteFieldType = "categorical" | "numerical" | "boolean";

export type VoteSchema = Record<string, VoteFieldType>;

export interface VoterConfig {
  temperature: number;
  modelOverride?: string;
}

export interface VotingResult<T = Record<string, unknown>> {
  consensus: T;
  votes: T[];
  confidence: number;
  voterCount: number;
  agreementByField: Record<string, number>;
}

export interface VoteRequest {
  prompt: string;
  schema: VoteSchema;
  voterCount?: number;
  context?: string;
  requiredUnanimousFields?: string[];
}
