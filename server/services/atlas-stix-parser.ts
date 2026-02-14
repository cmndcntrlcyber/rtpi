/**
 * STIX 2.1 Parser for MITRE ATLAS Data
 * Parses STIX bundles and imports ATLAS objects into the database
 */

import { db } from "../db";
import {
  atlasTactics,
  atlasTechniques,
  atlasMitigations,
  atlasRelationships,
  atlasTechniqueTactics,
  atlasCaseStudies,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { STIXBundle, STIXObject } from "./stix-parser";

/**
 * ATLAS Import statistics
 */
export interface ATLASImportStats {
  tactics: number;
  techniques: number;
  subtechniques: number;
  mitigations: number;
  relationships: number;
  errors: string[];
}

/**
 * Parse and import an ATLAS STIX bundle
 */
export async function importATLASSTIXBundle(bundle: STIXBundle): Promise<ATLASImportStats> {
  const stats: ATLASImportStats = {
    tactics: 0,
    techniques: 0,
    subtechniques: 0,
    mitigations: 0,
    relationships: 0,
    errors: [],
  };

  console.log(`Importing ATLAS STIX bundle: ${bundle.id}`);
  console.log(`Total objects: ${bundle.objects.length}`);

  // First pass: Import core objects (tactics, techniques, mitigations)
  for (const obj of bundle.objects) {
    try {
      switch (obj.type) {
        case "x-mitre-tactic":
          await importAtlasTactic(obj);
          stats.tactics++;
          break;

        case "attack-pattern": {
          const atlasId = getAtlasId(obj);
          if (!atlasId) break; // Skip non-ATLAS attack patterns
          const isSubtechnique = obj.x_mitre_is_subtechnique === true;
          await importAtlasTechnique(obj);
          if (isSubtechnique) {
            stats.subtechniques++;
          } else {
            stats.techniques++;
          }
          break;
        }

        case "course-of-action": {
          const atlasId = getAtlasId(obj);
          if (!atlasId) break; // Skip non-ATLAS mitigations
          await importAtlasMitigation(obj);
          stats.mitigations++;
          break;
        }

        case "relationship":
          // Skip in first pass
          break;

        default:
          // Skip x-mitre-matrix, x-mitre-collection, identity, marking-definition, etc.
          break;
      }
    } catch (error: any) {
      stats.errors.push(`Error importing ${obj.type} ${obj.id}: ${error.message}`);
      console.error(`Error importing ATLAS ${obj.type} ${obj.id}:`, error);
    }
  }

  // Second pass: Import relationships
  for (const obj of bundle.objects) {
    if (obj.type === "relationship") {
      try {
        await importAtlasRelationship(obj);
        stats.relationships++;
      } catch (error: any) {
        stats.errors.push(`Error importing relationship ${obj.id}: ${error.message}`);
        console.error(`Error importing ATLAS relationship ${obj.id}:`, error);
      }
    }
  }

  // Third pass: Link techniques to tactics via kill_chain_phases
  await linkAtlasTechniquesToTactics();

  // Fourth pass: Link subtechniques to parents
  await linkSubtechniquesToParents();

  console.log("ATLAS import complete:", stats);
  return stats;
}

/**
 * Import an ATLAS tactic
 */
async function importAtlasTactic(obj: STIXObject): Promise<void> {
  const atlasId = getAtlasId(obj);
  if (!atlasId) {
    throw new Error("Tactic missing ATLAS ID");
  }

  // Determine sort order from the tactic ID (AML.TA0001 -> 1)
  const sortNum = parseInt(atlasId.replace("AML.TA", ""), 10) || 0;

  // Extract shortname from x_mitre_shortname or kill chain reference
  const shortName = obj.x_mitre_shortname || atlasId;

  const tacticData = {
    atlasId,
    name: obj.name || "",
    description: obj.description || null,
    shortName,
    xMitreShortname: obj.x_mitre_shortname || null,
    sortOrder: sortNum,
    stixId: obj.id,
    metadata: {
      domains: obj.x_mitre_domains || [],
      version: obj.x_mitre_version || null,
    },
    externalReferences: obj.external_references || [],
  };

  const existing = await db
    .select()
    .from(atlasTactics)
    .where(eq(atlasTactics.atlasId, atlasId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(atlasTactics)
      .set(tacticData)
      .where(eq(atlasTactics.id, existing[0].id));
  } else {
    await db.insert(atlasTactics).values(tacticData);
  }
}

/**
 * Import an ATLAS technique or sub-technique
 */
async function importAtlasTechnique(obj: STIXObject): Promise<void> {
  const atlasId = getAtlasId(obj);
  if (!atlasId) {
    throw new Error("Technique missing ATLAS ID");
  }

  const isSubtechnique = obj.x_mitre_is_subtechnique === true;
  const platforms = obj.x_mitre_platforms || ["ATLAS"];
  const killChainPhases = (obj.kill_chain_phases || [])
    .filter((kc: any) => kc.kill_chain_name === "mitre-atlas")
    .map((kc: any) => kc.phase_name);

  const techniqueData = {
    atlasId,
    name: obj.name || "",
    description: obj.description || null,
    isSubtechnique,
    stixId: obj.id,
    killChainPhases: killChainPhases.length > 0 ? killChainPhases : null,
    platforms: platforms.length > 0 ? platforms : null,
    deprecated: obj.x_mitre_deprecated === true,
    revoked: obj.revoked === true,
    externalReferences: obj.external_references || [],
    metadata: {
      domains: obj.x_mitre_domains || [],
      version: obj.x_mitre_version || null,
    },
  };

  const existing = await db
    .select()
    .from(atlasTechniques)
    .where(eq(atlasTechniques.atlasId, atlasId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(atlasTechniques)
      .set(techniqueData)
      .where(eq(atlasTechniques.id, existing[0].id));
  } else {
    await db.insert(atlasTechniques).values(techniqueData);
  }
}

/**
 * Import an ATLAS mitigation (course-of-action)
 */
async function importAtlasMitigation(obj: STIXObject): Promise<void> {
  const atlasId = getAtlasId(obj);
  if (!atlasId) {
    throw new Error("Mitigation missing ATLAS ID");
  }

  const mitigationData = {
    atlasId,
    name: obj.name || "",
    description: obj.description || null,
    stixId: obj.id,
    deprecated: obj.x_mitre_deprecated === true,
    revoked: obj.revoked === true,
    externalReferences: obj.external_references || [],
    metadata: {
      domains: obj.x_mitre_domains || [],
      version: obj.x_mitre_version || null,
    },
  };

  const existing = await db
    .select()
    .from(atlasMitigations)
    .where(eq(atlasMitigations.atlasId, atlasId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(atlasMitigations)
      .set(mitigationData)
      .where(eq(atlasMitigations.id, existing[0].id));
  } else {
    await db.insert(atlasMitigations).values(mitigationData);
  }
}

/**
 * Import an ATLAS relationship
 */
async function importAtlasRelationship(obj: STIXObject): Promise<void> {
  const existing = await db
    .select()
    .from(atlasRelationships)
    .where(eq(atlasRelationships.stixId, obj.id))
    .limit(1);

  const relationshipData = {
    stixId: obj.id,
    relationshipType: obj.relationship_type || "",
    sourceRef: obj.source_ref,
    targetRef: obj.target_ref,
    description: obj.description || null,
    created: obj.created ? new Date(obj.created) : null,
    modified: obj.modified ? new Date(obj.modified) : null,
    metadata: {
      domains: obj.x_mitre_domains || [],
    },
  };

  if (existing.length > 0) {
    await db
      .update(atlasRelationships)
      .set(relationshipData)
      .where(eq(atlasRelationships.id, existing[0].id));
  } else {
    await db.insert(atlasRelationships).values(relationshipData);
  }
}

/**
 * Link ATLAS techniques to tactics via kill_chain_phases
 */
async function linkAtlasTechniquesToTactics(): Promise<void> {
  const techniques = await db.select().from(atlasTechniques);
  const tactics = await db.select().from(atlasTactics);

  for (const technique of techniques) {
    if (!technique.killChainPhases || technique.killChainPhases.length === 0) {
      continue;
    }

    for (const phaseName of technique.killChainPhases) {
      const tactic = tactics.find(
        (t) => t.xMitreShortname === phaseName || t.shortName === phaseName
      );

      if (tactic) {
        const existing = await db
          .select()
          .from(atlasTechniqueTactics)
          .where(
            sql`${atlasTechniqueTactics.techniqueId} = ${technique.id} AND ${atlasTechniqueTactics.tacticId} = ${tactic.id}`
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(atlasTechniqueTactics).values({
            techniqueId: technique.id,
            tacticId: tactic.id,
          });
        }

        // Also set the primary tacticId on the technique if not set
        if (!technique.tacticId) {
          await db
            .update(atlasTechniques)
            .set({ tacticId: tactic.id })
            .where(eq(atlasTechniques.id, technique.id));
        }
      }
    }
  }
}

/**
 * Link subtechniques to their parent techniques
 */
async function linkSubtechniquesToParents(): Promise<void> {
  const techniques = await db.select().from(atlasTechniques);

  for (const technique of techniques) {
    if (technique.isSubtechnique && technique.atlasId.includes(".")) {
      const parentAtlasId = technique.atlasId.split(".").slice(0, 2).join(".");
      // For subtechniques like AML.T0000.001, parent is AML.T0000
      const parent = techniques.find(
        (t) => t.atlasId === parentAtlasId && !t.isSubtechnique
      );

      if (parent && !technique.parentTechniqueId) {
        await db
          .update(atlasTechniques)
          .set({ parentTechniqueId: parent.id })
          .where(eq(atlasTechniques.id, technique.id));
      }
    }
  }
}

/**
 * Extract ATLAS ID from external references
 */
function getAtlasId(obj: STIXObject): string | null {
  if (!obj.external_references) {
    return null;
  }

  for (const ref of obj.external_references) {
    if (ref.source_name === "mitre-atlas" && ref.external_id) {
      return ref.external_id;
    }
  }

  return null;
}

/**
 * Get ATLAS import statistics from database
 */
export async function getATLASStats(): Promise<{
  tactics: number;
  techniques: number;
  subtechniques: number;
  mitigations: number;
  caseStudies: number;
  relationships: number;
}> {
  const [tacticsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(atlasTactics);

  const [techniquesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(atlasTechniques)
    .where(eq(atlasTechniques.isSubtechnique, false));

  const [subtechniquesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(atlasTechniques)
    .where(eq(atlasTechniques.isSubtechnique, true));

  const [mitigationsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(atlasMitigations);

  const [caseStudiesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(atlasCaseStudies);

  const [relationshipsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(atlasRelationships);

  return {
    tactics: Number(tacticsCount?.count || 0),
    techniques: Number(techniquesCount?.count || 0),
    subtechniques: Number(subtechniquesCount?.count || 0),
    mitigations: Number(mitigationsCount?.count || 0),
    caseStudies: Number(caseStudiesCount?.count || 0),
    relationships: Number(relationshipsCount?.count || 0),
  };
}
