/**
 * STIX 2.1 Parser for MITRE ATT&CK Data
 * Parses STIX bundles and imports ATT&CK objects into the database
 */

import { db } from "../db";
import {
  attackTactics,
  attackTechniques,
  attackGroups,
  attackSoftware,
  attackMitigations,
  attackDataSources,
  attackCampaigns,
  attackRelationships,
  attackTechniqueTactics,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * STIX 2.1 Bundle interface
 */
export interface STIXBundle {
  type: "bundle";
  id: string;
  objects: STIXObject[];
}

/**
 * STIX 2.1 Object interface
 */
export interface STIXObject {
  type: string;
  id: string;
  created: string;
  modified: string;
  name?: string;
  description?: string;
  x_mitre_version?: string;
  x_mitre_attack_spec_version?: string;
  x_mitre_domains?: string[];
  x_mitre_modified_by_ref?: string;
  external_references?: ExternalReference[];
  [key: string]: any;
}

export interface ExternalReference {
  source_name: string;
  external_id?: string;
  url?: string;
  description?: string;
}

/**
 * Import statistics
 */
export interface ImportStats {
  tactics: number;
  techniques: number;
  subtechniques: number;
  groups: number;
  software: number;
  mitigations: number;
  dataSources: number;
  campaigns: number;
  relationships: number;
  errors: string[];
}

/**
 * Parse and import a STIX bundle
 */
export async function importSTIXBundle(bundle: STIXBundle): Promise<ImportStats> {
  const stats: ImportStats = {
    tactics: 0,
    techniques: 0,
    subtechniques: 0,
    groups: 0,
    software: 0,
    mitigations: 0,
    dataSources: 0,
    campaigns: 0,
    relationships: 0,
    errors: [],
  };

  console.log(`Importing STIX bundle: ${bundle.id}`);
  console.log(`Total objects: ${bundle.objects.length}`);

  // First pass: Import core objects
  for (const obj of bundle.objects) {
    try {
      switch (obj.type) {
        case "x-mitre-tactic":
          await importTactic(obj);
          stats.tactics++;
          break;

        case "attack-pattern":
          const isSubtechnique = obj.x_mitre_is_subtechnique === true;
          await importTechnique(obj);
          if (isSubtechnique) {
            stats.subtechniques++;
          } else {
            stats.techniques++;
          }
          break;

        case "intrusion-set":
          await importGroup(obj);
          stats.groups++;
          break;

        case "malware":
        case "tool":
          await importSoftware(obj);
          stats.software++;
          break;

        case "course-of-action":
          await importMitigation(obj);
          stats.mitigations++;
          break;

        case "x-mitre-data-source":
          await importDataSource(obj);
          stats.dataSources++;
          break;

        case "campaign":
          await importCampaign(obj);
          stats.campaigns++;
          break;

        case "relationship":
          // Skip relationships in first pass
          break;

        default:
          // Skip unknown types
          break;
      }
    } catch (error: any) {
      stats.errors.push(`Error importing ${obj.type} ${obj.id}: ${error.message}`);
      console.error(`Error importing ${obj.type} ${obj.id}:`, error);
    }
  }

  // Second pass: Import relationships
  for (const obj of bundle.objects) {
    if (obj.type === "relationship") {
      try {
        await importRelationship(obj);
        stats.relationships++;
      } catch (error: any) {
        stats.errors.push(`Error importing relationship ${obj.id}: ${error.message}`);
        console.error(`Error importing relationship ${obj.id}:`, error);
      }
    }
  }

  // Third pass: Link techniques to tactics via kill_chain_phases
  await linkTechniquesToTactics();

  console.log("Import complete:", stats);
  return stats;
}

/**
 * Import a tactic
 */
async function importTactic(obj: STIXObject): Promise<void> {
  const attackId = getAttackId(obj);
  if (!attackId) {
    throw new Error("Tactic missing ATT&CK ID");
  }

  const existing = await db.query.attackTactics.findFirst({
    where: eq(attackTactics.stixId, obj.id),
  });

  const tacticData = {
    attackId,
    name: obj.name || "",
    description: obj.description || null,
    shortName: obj.x_mitre_shortname || null,
    xMitreShortname: obj.x_mitre_shortname || null,
    stixId: obj.id,
    created: new Date(obj.created),
    modified: new Date(obj.modified),
    metadata: {
      domains: obj.x_mitre_domains || [],
      version: obj.x_mitre_version || null,
    },
  };

  if (existing) {
    await db
      .update(attackTactics)
      .set(tacticData)
      .where(eq(attackTactics.id, existing.id));
  } else {
    await db.insert(attackTactics).values(tacticData);
  }
}

/**
 * Import a technique or sub-technique
 */
async function importTechnique(obj: STIXObject): Promise<void> {
  const attackId = getAttackId(obj);
  if (!attackId) {
    throw new Error("Technique missing ATT&CK ID");
  }

  const isSubtechnique = obj.x_mitre_is_subtechnique === true;

  const existing = await db.query.attackTechniques.findFirst({
    where: eq(attackTechniques.stixId, obj.id),
  });

  // Extract platforms
  const platforms = obj.x_mitre_platforms || [];

  // Extract kill chain phases
  const killChainPhases = (obj.kill_chain_phases || []).map(
    (kc: any) => kc.phase_name
  );

  const techniqueData = {
    attackId,
    name: obj.name || "",
    description: obj.description || null,
    isSubtechnique,
    stixId: obj.id,
    killChainPhases,
    platforms: platforms.length > 0 ? platforms : null,
    permissionsRequired: obj.x_mitre_permissions_required || null,
    effectivePermissions: obj.x_mitre_effective_permissions || null,
    defenseBypassed: obj.x_mitre_defense_bypassed || null,
    dataSources: obj.x_mitre_data_sources || null,
    detection: obj.x_mitre_detection || null,
    version: obj.x_mitre_version || null,
    created: new Date(obj.created),
    modified: new Date(obj.modified),
    deprecated: obj.x_mitre_deprecated === true,
    revoked: obj.revoked === true,
    externalReferences: obj.external_references || [],
    xMitreVersion: obj.x_mitre_version || null,
    xMitreDetection: obj.x_mitre_detection || null,
    xMitreDataSources: obj.x_mitre_data_sources || null,
    xMitreContributors: obj.x_mitre_contributors || null,
    xMitrePlatforms: obj.x_mitre_platforms || null,
    xMitreIsSubtechnique: isSubtechnique,
    xMitreImpactType: obj.x_mitre_impact_type || null,
    metadata: {
      domains: obj.x_mitre_domains || [],
    },
  };

  if (existing) {
    await db
      .update(attackTechniques)
      .set(techniqueData)
      .where(eq(attackTechniques.id, existing.id));
  } else {
    await db.insert(attackTechniques).values(techniqueData);
  }

  // Handle parent-child relationships for sub-techniques
  if (isSubtechnique && attackId.includes(".")) {
    const parentId = attackId.split(".")[0];
    const parentTechnique = await db.query.attackTechniques.findFirst({
      where: eq(attackTechniques.attackId, parentId),
    });

    if (parentTechnique && existing) {
      await db
        .update(attackTechniques)
        .set({ parentTechniqueId: parentTechnique.id })
        .where(eq(attackTechniques.id, existing.id));
    }
  }
}

/**
 * Import a threat actor group
 */
async function importGroup(obj: STIXObject): Promise<void> {
  const attackId = getAttackId(obj);
  if (!attackId) {
    throw new Error("Group missing ATT&CK ID");
  }

  const existing = await db.query.attackGroups.findFirst({
    where: eq(attackGroups.stixId, obj.id),
  });

  const groupData = {
    attackId,
    name: obj.name || "",
    description: obj.description || null,
    aliases: obj.aliases || null,
    stixId: obj.id,
    version: obj.x_mitre_version || null,
    created: new Date(obj.created),
    modified: new Date(obj.modified),
    deprecated: obj.x_mitre_deprecated === true,
    revoked: obj.revoked === true,
    externalReferences: obj.external_references || [],
    xMitreVersion: obj.x_mitre_version || null,
    xMitreContributors: obj.x_mitre_contributors || null,
    metadata: {
      domains: obj.x_mitre_domains || [],
    },
  };

  if (existing) {
    await db
      .update(attackGroups)
      .set(groupData)
      .where(eq(attackGroups.id, existing.id));
  } else {
    await db.insert(attackGroups).values(groupData);
  }
}

/**
 * Import malware or tool
 */
async function importSoftware(obj: STIXObject): Promise<void> {
  const attackId = getAttackId(obj);
  if (!attackId) {
    throw new Error("Software missing ATT&CK ID");
  }

  const existing = await db.query.attackSoftware.findFirst({
    where: eq(attackSoftware.stixId, obj.id),
  });

  const softwareData = {
    attackId,
    name: obj.name || "",
    description: obj.description || null,
    softwareType: obj.type, // "malware" or "tool"
    aliases: obj.x_mitre_aliases || null,
    platforms: obj.x_mitre_platforms || null,
    stixId: obj.id,
    version: obj.x_mitre_version || null,
    created: new Date(obj.created),
    modified: new Date(obj.modified),
    deprecated: obj.x_mitre_deprecated === true,
    revoked: obj.revoked === true,
    externalReferences: obj.external_references || [],
    xMitreVersion: obj.x_mitre_version || null,
    xMitreContributors: obj.x_mitre_contributors || null,
    xMitrePlatforms: obj.x_mitre_platforms || null,
    metadata: {
      domains: obj.x_mitre_domains || [],
    },
  };

  if (existing) {
    await db
      .update(attackSoftware)
      .set(softwareData)
      .where(eq(attackSoftware.id, existing.id));
  } else {
    await db.insert(attackSoftware).values(softwareData);
  }
}

/**
 * Import a mitigation
 */
async function importMitigation(obj: STIXObject): Promise<void> {
  const attackId = getAttackId(obj);
  if (!attackId) {
    throw new Error("Mitigation missing ATT&CK ID");
  }

  const existing = await db.query.attackMitigations.findFirst({
    where: eq(attackMitigations.stixId, obj.id),
  });

  const mitigationData = {
    attackId,
    name: obj.name || "",
    description: obj.description || null,
    stixId: obj.id,
    version: obj.x_mitre_version || null,
    created: new Date(obj.created),
    modified: new Date(obj.modified),
    deprecated: obj.x_mitre_deprecated === true,
    revoked: obj.revoked === true,
    externalReferences: obj.external_references || [],
    xMitreVersion: obj.x_mitre_version || null,
    metadata: {
      domains: obj.x_mitre_domains || [],
    },
  };

  if (existing) {
    await db
      .update(attackMitigations)
      .set(mitigationData)
      .where(eq(attackMitigations.id, existing.id));
  } else {
    await db.insert(attackMitigations).values(mitigationData);
  }
}

/**
 * Import a data source
 */
async function importDataSource(obj: STIXObject): Promise<void> {
  const attackId = getAttackId(obj);
  if (!attackId) {
    throw new Error("Data source missing ATT&CK ID");
  }

  const existing = await db.query.attackDataSources.findFirst({
    where: eq(attackDataSources.stixId, obj.id),
  });

  const dataSourceData = {
    attackId,
    name: obj.name || "",
    description: obj.description || null,
    stixId: obj.id,
    platforms: obj.x_mitre_platforms || null,
    collectionLayers: obj.x_mitre_collection_layers || null,
    dataComponents: obj.x_mitre_data_source_ref || [],
    version: obj.x_mitre_version || null,
    created: new Date(obj.created),
    modified: new Date(obj.modified),
    externalReferences: obj.external_references || [],
    xMitreVersion: obj.x_mitre_version || null,
    metadata: {
      domains: obj.x_mitre_domains || [],
    },
  };

  if (existing) {
    await db
      .update(attackDataSources)
      .set(dataSourceData)
      .where(eq(attackDataSources.id, existing.id));
  } else {
    await db.insert(attackDataSources).values(dataSourceData);
  }
}

/**
 * Import a campaign
 */
async function importCampaign(obj: STIXObject): Promise<void> {
  const attackId = getAttackId(obj);
  if (!attackId) {
    throw new Error("Campaign missing ATT&CK ID");
  }

  const existing = await db.query.attackCampaigns.findFirst({
    where: eq(attackCampaigns.stixId, obj.id),
  });

  const campaignData = {
    attackId,
    name: obj.name || "",
    description: obj.description || null,
    aliases: obj.aliases || null,
    firstSeen: obj.first_seen ? new Date(obj.first_seen) : null,
    lastSeen: obj.last_seen ? new Date(obj.last_seen) : null,
    stixId: obj.id,
    version: obj.x_mitre_version || null,
    created: new Date(obj.created),
    modified: new Date(obj.modified),
    externalReferences: obj.external_references || [],
    xMitreVersion: obj.x_mitre_version || null,
    xMitreFirstSeenCitation: obj.x_mitre_first_seen_citation || null,
    xMitreLastSeenCitation: obj.x_mitre_last_seen_citation || null,
    metadata: {
      domains: obj.x_mitre_domains || [],
    },
  };

  if (existing) {
    await db
      .update(attackCampaigns)
      .set(campaignData)
      .where(eq(attackCampaigns.id, existing.id));
  } else {
    await db.insert(attackCampaigns).values(campaignData);
  }
}

/**
 * Import a relationship
 */
async function importRelationship(obj: STIXObject): Promise<void> {
  const existing = await db.query.attackRelationships.findFirst({
    where: eq(attackRelationships.stixId, obj.id),
  });

  const relationshipData = {
    stixId: obj.id,
    relationshipType: obj.relationship_type || "",
    sourceType: getObjectType(obj.source_ref) as any,
    sourceRef: obj.source_ref,
    targetType: getObjectType(obj.target_ref) as any,
    targetRef: obj.target_ref,
    description: obj.description || null,
    created: new Date(obj.created),
    modified: new Date(obj.modified),
    metadata: {
      domains: obj.x_mitre_domains || [],
    },
  };

  if (existing) {
    await db
      .update(attackRelationships)
      .set(relationshipData)
      .where(eq(attackRelationships.id, existing.id));
  } else {
    await db.insert(attackRelationships).values(relationshipData);
  }
}

/**
 * Link techniques to tactics via kill_chain_phases
 */
async function linkTechniquesToTactics(): Promise<void> {
  const techniques = await db.query.attackTechniques.findMany();
  const tactics = await db.query.attackTactics.findMany();

  for (const technique of techniques) {
    if (!technique.killChainPhases || technique.killChainPhases.length === 0) {
      continue;
    }

    for (const phaseName of technique.killChainPhases) {
      const tactic = tactics.find(
        (t) => t.xMitreShortname === phaseName || t.shortName === phaseName
      );

      if (tactic) {
        // Check if mapping already exists
        const existing = await db.query.attackTechniqueTactics.findFirst({
          where: (table, { and, eq }) =>
            and(
              eq(table.techniqueId, technique.id),
              eq(table.tacticId, tactic.id)
            ),
        });

        if (!existing) {
          await db.insert(attackTechniqueTactics).values({
            techniqueId: technique.id,
            tacticId: tactic.id,
          });
        }
      }
    }
  }
}

/**
 * Extract ATT&CK ID from external references
 */
function getAttackId(obj: STIXObject): string | null {
  if (!obj.external_references) {
    return null;
  }

  for (const ref of obj.external_references) {
    if (ref.source_name === "mitre-attack" && ref.external_id) {
      return ref.external_id;
    }
  }

  return null;
}

/**
 * Get object type from STIX ID
 */
function getObjectType(stixId: string): string {
  if (stixId.startsWith("attack-pattern--")) return "technique";
  if (stixId.startsWith("x-mitre-tactic--")) return "tactic";
  if (stixId.startsWith("intrusion-set--")) return "group";
  if (stixId.startsWith("malware--")) return "software";
  if (stixId.startsWith("tool--")) return "software";
  if (stixId.startsWith("course-of-action--")) return "mitigation";
  if (stixId.startsWith("x-mitre-data-source--")) return "data-source";
  if (stixId.startsWith("campaign--")) return "campaign";
  return "technique"; // Default
}

/**
 * Get import statistics
 */
export async function getImportStatistics(): Promise<{
  tactics: number;
  techniques: number;
  subtechniques: number;
  groups: number;
  software: number;
  mitigations: number;
  dataSources: number;
  campaigns: number;
  relationships: number;
}> {
  const [tacticsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackTactics);

  const [techniquesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackTechniques)
    .where(eq(attackTechniques.isSubtechnique, false));

  const [subtechniquesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackTechniques)
    .where(eq(attackTechniques.isSubtechnique, true));

  const [groupsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackGroups);

  const [softwareCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackSoftware);

  const [mitigationsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackMitigations);

  const [dataSourcesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackDataSources);

  const [campaignsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackCampaigns);

  const [relationshipsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackRelationships);

  return {
    tactics: Number(tacticsCount?.count || 0),
    techniques: Number(techniquesCount?.count || 0),
    subtechniques: Number(subtechniquesCount?.count || 0),
    groups: Number(groupsCount?.count || 0),
    software: Number(softwareCount?.count || 0),
    mitigations: Number(mitigationsCount?.count || 0),
    dataSources: Number(dataSourcesCount?.count || 0),
    campaigns: Number(campaignsCount?.count || 0),
    relationships: Number(relationshipsCount?.count || 0),
  };
}
