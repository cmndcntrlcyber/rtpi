-- v2.9.1 Phase 6: per-agent inference provider override + tool-choice
-- Lets specific agents pin themselves to a provider (e.g. always run a code
-- generation agent against vLLM-served Qwen2.5-Coder-14B even when the
-- registry default is set to OpenAI). NULL falls back to the registry's
-- resolveDefault() chain.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS inference_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS tool_choice_strategy TEXT;
