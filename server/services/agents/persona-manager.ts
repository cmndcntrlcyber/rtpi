import { db } from "../../db";
import { personaProfiles } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import {
  AgentPersona,
  PersonaPerformance,
  TaskPerformanceUpdate,
} from "../../../shared/types/agent-persona";
import { createLogger } from "../../lib/logger";

const log = createLogger("persona-manager");

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export class PersonaManager {
  private cache: Map<string, CacheEntry<AgentPersona>> = new Map();
  private performanceCache: Map<string, PersonaPerformance> = new Map();

  async getPersona(agentType: string): Promise<AgentPersona | null> {
    const cached = this.cache.get(agentType);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    try {
      const rows = await db
        .select()
        .from(personaProfiles)
        .where(eq(personaProfiles.agentType, agentType))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      const persona: AgentPersona = {
        agentType: row.agentType,
        displayName: row.displayName,
        methodology: row.methodology,
        expertiseDomains: row.expertiseDomains as string[],
        behavioralConstraints: row.behavioralConstraints as AgentPersona["behavioralConstraints"],
      };

      this.cache.set(agentType, {
        value: persona,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return persona;
    } catch (err: any) {
      log.warn(
        `Failed to load persona for ${agentType}: ${err.message ?? err}`
      );
      return null;
    }
  }

  async updatePerformance(
    agentType: string,
    update: TaskPerformanceUpdate
  ): Promise<void> {
    try {
      const rows = await db
        .select()
        .from(personaProfiles)
        .where(eq(personaProfiles.agentType, agentType))
        .limit(1);

      if (rows.length === 0) {
        log.warn(`No persona profile found for ${agentType}, skipping performance update`);
        return;
      }

      const row = rows[0];
      const existing: PersonaPerformance = (row.performanceHistory as PersonaPerformance) ?? {
        tasksCompleted: 0,
        avgIterations: 0,
        successRate: 0,
        avgFindingsPerTask: 0,
        lastUpdated: new Date().toISOString(),
      };

      const updated: PersonaPerformance = {
        tasksCompleted: existing.tasksCompleted + 1,
        avgIterations:
          existing.avgIterations * 0.7 + update.iterations * 0.3,
        successRate:
          existing.successRate * 0.7 + (update.success ? 1 : 0) * 0.3,
        avgFindingsPerTask:
          existing.avgFindingsPerTask * 0.7 + update.findingsCount * 0.3,
        lastUpdated: new Date().toISOString(),
      };

      await db
        .update(personaProfiles)
        .set({ performanceHistory: updated })
        .where(eq(personaProfiles.agentType, agentType));

      this.performanceCache.set(agentType, updated);
    } catch (err: any) {
      log.warn(
        `Failed to update performance for ${agentType}: ${err.message ?? err}`
      );
    }
  }

  formatPersonaForPrompt(persona: AgentPersona): string {
    const lines: string[] = [];

    lines.push(`## Agent Identity`);
    lines.push(`You are **${persona.displayName}**.`);
    lines.push(``);
    lines.push(`## Methodology`);
    lines.push(persona.methodology);
    lines.push(``);
    lines.push(`## Expertise Domains`);
    lines.push(persona.expertiseDomains.join(", "));
    lines.push(``);
    lines.push(`## Behavioral Constraints`);
    lines.push(
      `- Risk tolerance: ${persona.behavioralConstraints.maxRiskTolerance}`
    );

    if (persona.behavioralConstraints.requiresApprovalFor.length > 0) {
      lines.push(
        `- Requires approval for: ${persona.behavioralConstraints.requiresApprovalFor.join(", ")}`
      );
    }

    if (persona.behavioralConstraints.prohibitedActions.length > 0) {
      lines.push(
        `- Prohibited: ${persona.behavioralConstraints.prohibitedActions.join(", ")}`
      );
    }

    return lines.join("\n");
  }

  clearCache(): void {
    this.cache.clear();
    this.performanceCache.clear();
  }
}

export const personaManager = new PersonaManager();
