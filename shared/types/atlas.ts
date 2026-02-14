import { atlasTechniques, atlasTactics, atlasMitigations } from "@shared/schema";

/**
 * Infer AtlasTechnique type from database schema
 */
export type AtlasTechnique = typeof atlasTechniques.$inferSelect;

/**
 * Technique with nested sub-techniques for hierarchical display
 */
export interface AtlasTechniqueWithSubtechniques extends AtlasTechnique {
  subtechniques?: AtlasTechnique[];
}

/**
 * Infer AtlasTactic type from database schema
 */
export type AtlasTactic = typeof atlasTactics.$inferSelect;

/**
 * Infer AtlasMitigation type from database schema
 */
export type AtlasMitigation = typeof atlasMitigations.$inferSelect;

/**
 * Simplified Technique type for ATLAS Navigator export
 */
export interface AtlasNavigatorTechnique {
  atlasId: string;
  name: string;
  description?: string | null;
  killChainPhases?: string[] | null;
  platforms?: string[] | null;
}
