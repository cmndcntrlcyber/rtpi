/**
 * Skills Catalog API — unified list of all skills available to agents.
 *
 * Merges two sources into a single list, with namespaced IDs so the
 * Edit AI Agent dialog's dual listbox can mix them without collision:
 *
 *   - Tool skills: per-tool SKILL.md files under skills/tools/{registry}/<id>.md
 *     (generated when FF_TOOL_SKILL_GENERATION is on). ID shape:
 *     `tool:<registry>:<rowId>` — e.g. `tool:security:nmap-row-uuid`.
 *   - Bug-hunter skills: rows in `knowledge_base` whose category is
 *     `bug_hunter_skill` (seeded by `npm run bug-hunter:import-skills`).
 *     ID shape: `bh:<knowledge_base.id>` for individual chunks, or the
 *     aggregate `skill:<filename>` tag when grouping is requested.
 *
 * Endpoint:
 *   GET /api/v1/skills/available
 *     ?kind=tool|bug_hunter        (optional filter)
 *     ?grouped=true                (bug-hunter chunks collapse to one row per skill)
 *
 * Mounted in server/index.ts as /api/v1/skills (sibling of skill-import).
 */

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { ensureAuthenticated } from "../../auth/middleware";
import { loadSkillSummary } from "../../services/skills/skill-loader";
import { listAllRegisteredTools } from "../../services/skill-generator";

const router = Router();
router.use(ensureAuthenticated);

export interface CatalogSkill {
  id: string;
  kind: "tool" | "bug_hunter";
  displayName: string;
  summary: string;
  source: string;
  tags: string[];
}

router.get("/available", async (req, res) => {
  const kindFilter = req.query.kind as string | undefined;
  const grouped = req.query.grouped === "true" || req.query.grouped === "1";
  const out: CatalogSkill[] = [];

  // Tool skills — only include ones that actually have a generated SKILL.md.
  if (kindFilter !== "bug_hunter") {
    try {
      const rows = await listAllRegisteredTools();
      const summaries = await Promise.all(
        rows.map(async (r) => ({
          row: r,
          summary: await loadSkillSummary(r.registry, r.rowId).catch(() => null),
        })),
      );
      for (const { row, summary } of summaries) {
        if (!summary) continue;
        out.push({
          id: `tool:${row.registry}:${row.rowId}`,
          kind: "tool",
          displayName: row.displayName,
          summary: summary.summary?.slice(0, 400) ?? "",
          source: `${row.registry} registry`,
          tags: [`registry:${row.registry}`],
        });
      }
    } catch (err) {
      console.warn("[skills-catalog] tool-skill enumeration failed:", err);
    }
  }

  // Bug-hunter skills — knowledge_base rows tagged category=bug_hunter_skill.
  if (kindFilter !== "tool") {
    try {
      if (grouped) {
        // Collapse to one row per parent skill, picking the summary chunk
        // (or the whole-file chunk) when available so the displayed text
        // is the frontmatter description, not a section excerpt.
        const rows = await db.execute<{
          skill: string;
          ids: string[];
          summary: string | null;
          title: string;
          tags: string[];
        }>(sql`
          WITH base AS (
            SELECT id::text AS id,
                   title,
                   summary,
                   tags,
                   regexp_replace(
                     coalesce((SELECT t FROM unnest(tags) AS t WHERE t LIKE 'skill:%' LIMIT 1), ''),
                     '^skill:', ''
                   ) AS skill,
                   CASE
                     WHEN tags @> ARRAY['chunk:summary']::text[] THEN 0
                     WHEN tags @> ARRAY['chunk:whole']::text[]   THEN 1
                     WHEN tags @> ARRAY['chunk:meta']::text[]    THEN 2
                     ELSE 3
                   END AS rank
              FROM knowledge_base
             WHERE category = 'bug_hunter_skill'
          ),
          chosen AS (
            SELECT DISTINCT ON (skill) skill, id, title, summary, tags
              FROM base
             WHERE skill <> ''
             ORDER BY skill, rank ASC
          )
          SELECT chosen.skill,
                 chosen.title,
                 chosen.summary,
                 chosen.tags,
                 ARRAY(
                   SELECT id::text FROM knowledge_base k
                    WHERE category = 'bug_hunter_skill'
                      AND k.tags @> ARRAY['skill:' || chosen.skill]::text[]
                 ) AS ids
            FROM chosen
            ORDER BY chosen.skill ASC
        `);
        for (const r of rows) {
          out.push({
            id: `bh:skill:${r.skill}`,
            kind: "bug_hunter",
            displayName: r.skill,
            summary: (r.summary ?? r.title).slice(0, 400),
            source: "bug-hunter knowledge base",
            tags: (r.tags ?? []).filter((t) => !t.startsWith("hash:")).slice(0, 8),
          });
        }
      } else {
        const rows = await db.execute<{
          id: string;
          title: string;
          summary: string | null;
          tags: string[];
        }>(sql`
          SELECT id::text AS id, title, summary, tags
            FROM knowledge_base
           WHERE category = 'bug_hunter_skill'
             AND NOT (tags @> ARRAY['chunk:meta']::text[])
           ORDER BY title ASC
           LIMIT 1000
        `);
        for (const r of rows) {
          out.push({
            id: `bh:${r.id}`,
            kind: "bug_hunter",
            displayName: r.title,
            summary: (r.summary ?? "").slice(0, 400),
            source: "bug-hunter knowledge base",
            tags: (r.tags ?? []).filter((t) => !t.startsWith("hash:")).slice(0, 8),
          });
        }
      }
    } catch (err) {
      console.warn("[skills-catalog] bug-hunter enumeration failed:", err);
    }
  }

  res.json({
    total: out.length,
    byKind: {
      tool: out.filter((s) => s.kind === "tool").length,
      bug_hunter: out.filter((s) => s.kind === "bug_hunter").length,
    },
    skills: out,
  });
});

export default router;
