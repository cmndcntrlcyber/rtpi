import { db } from "../db";
import { atlasTactics, atlasTechniques, atlasCaseStudies } from "@shared/schema";
import fs from "fs/promises";
import { eq } from "drizzle-orm";

interface ATLASMatrix {
  name: string;
  techniques: Array<{
    techniqueID: string;
    tactic: string;
    enabled: boolean;
    metadata?: any;
  }>;
}

interface ATLASImportStats {
  tactics: number;
  techniques: number;
  caseStudies: number;
}

export async function importATLASMatrix(filePath: string): Promise<ATLASImportStats> {
  const content = await fs.readFile(filePath, 'utf-8');
  const matrix: ATLASMatrix = JSON.parse(content);

  const stats: ATLASImportStats = {
    tactics: 0,
    techniques: 0,
    caseStudies: 0,
  };

  // Extract unique tactics from techniques
  const tacticMap = new Map<string, { id: string; name: string; sortOrder: number }>();

  const tacticOrder = [
    'reconnaissance',
    'resource-development',
    'initial-access',
    'ml-attack-staging',
    'ml-model-access',
    'execution',
    'persistence',
    'privilege-escalation',
    'defense-evasion',
    'credential-access',
    'discovery',
    'collection',
    'exfiltration',
    'impact',
  ];

  tacticOrder.forEach((tactic, index) => {
    tacticMap.set(tactic, {
      id: `AML.TA${String(index + 1).padStart(4, '0')}`,
      name: tactic.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      sortOrder: index + 1,
    });
  });

  // Insert tactics
  for (const [tacticName, tacticData] of tacticMap) {
    await db.insert(atlasTactics).values({
      atlasId: tacticData.id,
      name: tacticData.name,
      shortName: tacticName,
      sortOrder: tacticData.sortOrder,
      description: `ATLAS ${tacticData.name} tactic`,
    }).onConflictDoNothing();
    stats.tactics++;
  }

  // Fetch tactic IDs for reference
  const tacticsInDb = await db.select().from(atlasTactics);
  const tacticIdMap = new Map(tacticsInDb.map(t => [t.shortName!, t.id]));

  // Insert techniques
  for (const technique of matrix.techniques) {
    if (!technique.enabled) continue;

    const tacticId = tacticIdMap.get(technique.tactic);

    await db.insert(atlasTechniques).values({
      atlasId: technique.techniqueID,
      name: `ATLAS Technique ${technique.techniqueID}`,
      tacticId: tacticId,
      description: JSON.stringify(technique.metadata || {}),
      platforms: ['ATLAS'],
    }).onConflictDoNothing();

    stats.techniques++;
  }

  return stats;
}

export async function getATLASStats() {
  const tacticsCount = await db.select().from(atlasTactics);
  const techniquesCount = await db.select().from(atlasTechniques);
  const caseStudiesCount = await db.select().from(atlasCaseStudies);

  return {
    tactics: tacticsCount.length,
    techniques: techniquesCount.length,
    caseStudies: caseStudiesCount.length,
  };
}
