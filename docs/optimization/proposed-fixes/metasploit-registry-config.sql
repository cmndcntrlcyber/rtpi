-- ============================================================================
-- PROPOSED — NOT AUTO-APPLIED. Review before running.
-- Stopgap for the Metasploit "banner exit-0 fabrication" defect.
-- See docs/optimization/proposed-fixes/2026-06-02-p0-stop-fabrication.md
-- ============================================================================
-- Run read-only inspection FIRST:   psql "$DATABASE_URL" -f this_file.sql
-- (the UPDATEs below are commented out — uncomment deliberately after review)
-- ============================================================================

-- 0. Inspect the offending rows. Verified live (2026-06-02): both rows have
--    config.baseCommand = "" plus a positional `target` param seeded by the
--    tool-executor self-repair, so buildCommand emits the bare target.
SELECT tool_id, name, install_status, binary_path, config
FROM tool_registry
WHERE tool_id IN ('metasploit', 'msfconsole');

-- 1. Discover which agents would invoke it via the generic path (Option A prep).
--    enabledTools is nested in agents.config; adjust the JSON path if your rows
--    differ. This is read-only.
SELECT id, name, config->'enabledTools' AS enabled_tools
FROM agents
WHERE config::text ILIKE '%metasploit%' OR config::text ILIKE '%msfconsole%';

-- ============================================================================
-- OPTION A (RECOMMENDED): do NOT make this a generic tool. Drive Metasploit via
-- metasploitExecutor.execute() (already wired at agent-workflow-orchestrator.ts:2894)
-- with an explicit module + RHOSTS. Operationally: remove 'metasploit'/'msfconsole'
-- from the generic agents' enabledTools so the bare-command path is never taken.
-- That edit lives in agents.config (app-side), not here — left to review.
-- ============================================================================

-- ============================================================================
-- OPTION B (STOPGAP ONLY): make the invocation deterministic and *loud* instead
-- of a silent banner+exit0. We cannot express a correct target scan here (the
-- config model only appends args; msfconsole needs `-x "...set RHOSTS <t>..."`).
-- So the goal of this stopgap is narrow: ensure the run is caught by the
-- evidence gate (P0-2) rather than masquerading as success.
--
-- Removing the positional `target` param prevents the bare-target arg; the fixed
-- baseCommand below runs non-interactively, emits the version banner, and exits.
-- The P0-2 banner signature (/=\[ metasploit/, /metasploit v\d/) then flags it
-- as no-evidence. This makes the failure VISIBLE; it does not make it a real scan.
--
-- Uncomment to apply (after review):
--
-- UPDATE tool_registry
-- SET config = jsonb_build_object(
--       'baseCommand', 'msfconsole -q -x "version; exit -y"',
--       'parameters', '[]'::jsonb
--     ),
--     updated_at = now()
-- WHERE tool_id IN ('metasploit', 'msfconsole');
--
-- NOTE: the tool-executor self-repair (tool-executor.ts:300-323, 579-620) may
-- re-seed an empty config on the next run if it considers the row "missing"
-- config. Confirm the repair treats a non-empty baseCommand as authoritative
-- (it checks `baseCommand.trim().length > 0`) so it does NOT overwrite this.
-- ============================================================================

-- 2. Verify after applying (read-only).
-- SELECT tool_id, config->>'baseCommand' AS base_command FROM tool_registry
-- WHERE tool_id IN ('metasploit', 'msfconsole');
