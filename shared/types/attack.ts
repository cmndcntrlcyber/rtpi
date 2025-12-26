import { attackTechniques, attackTactics } from "@shared/schema";

/**
 * Infer Technique type from database schema
 * This ensures type safety and keeps the type in sync with the schema
 */
export type Technique = typeof attackTechniques.$inferSelect;

/**
 * Technique with nested sub-techniques for hierarchical display
 */
export interface TechniqueWithSubtechniques extends Technique {
  subtechniques?: Technique[];
}

/**
 * Infer Tactic type from database schema
 */
export type Tactic = typeof attackTactics.$inferSelect;

/**
 * Simplified Technique type for ATT&CK Navigator export
 * Only includes the fields needed for export
 */
export interface NavigatorTechnique {
  attackId: string;
  name: string;
  description?: string | null;
  killChainPhases?: string[] | null;
  platforms?: string[] | null;
}
