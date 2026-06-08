-- FF_TOOL_SKILL_GENERATION — per-tool SKILL.md generation columns
--
-- Each registry row (mcp_servers, tool_registry, security_tools) gains a
-- pointer to its generated SKILL.md, the timestamp of the last generation,
-- and a hash of the source metadata so the generator can skip regen when
-- nothing meaningful has changed.
--
-- All columns are nullable: rows registered before FF_TOOL_SKILL_GENERATION
-- was enabled simply have NULL pointers, and the runtime treats "no skill"
-- as "fall back to name-only inference" (the pre-existing behavior).
--
-- Idempotent: each ALTER uses IF NOT EXISTS so re-runs and partial-applies
-- are safe.

ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "skill_path" text;
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "skill_generated_at" timestamp;
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "skill_source_hash" text;

ALTER TABLE "tool_registry" ADD COLUMN IF NOT EXISTS "skill_path" text;
ALTER TABLE "tool_registry" ADD COLUMN IF NOT EXISTS "skill_generated_at" timestamp;
ALTER TABLE "tool_registry" ADD COLUMN IF NOT EXISTS "skill_source_hash" text;

ALTER TABLE "security_tools" ADD COLUMN IF NOT EXISTS "skill_path" text;
ALTER TABLE "security_tools" ADD COLUMN IF NOT EXISTS "skill_generated_at" timestamp;
ALTER TABLE "security_tools" ADD COLUMN IF NOT EXISTS "skill_source_hash" text;
