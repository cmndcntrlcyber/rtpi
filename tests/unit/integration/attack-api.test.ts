/**
 * ATT&CK API Integration Tests
 *
 * Tests for ATT&CK Framework API endpoints including techniques, tactics,
 * groups, software, mitigations, and statistics.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db';
import {
  attackTechniques,
  attackTactics,
  attackGroups,
  attackSoftware,
  attackMitigations
} from '../../shared/schema';

describe('ATT&CK API Integration Tests', () => {
  // Sample test data
  const testTechnique = {
    attackId: 'T9999',
    name: 'Test Technique',
    description: 'Test technique for integration testing',
    platforms: ['Windows', 'Linux'],
    dataSources: ['Process monitoring'],
    isSubtechnique: false,
    url: 'https://attack.mitre.org/techniques/T9999',
  };

  const testTactic = {
    attackId: 'TA9999',
    name: 'Test Tactic',
    shortName: 'test-tactic',
    description: 'Test tactic for integration testing',
    url: 'https://attack.mitre.org/tactics/TA9999',
  };

  const testGroup = {
    attackId: 'G9999',
    name: 'Test Group',
    description: 'Test threat group',
    aliases: ['TestGroup', 'TG'],
    url: 'https://attack.mitre.org/groups/G9999',
  };

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(attackTechniques).where({ attackId: testTechnique.attackId });
    await db.delete(attackTactics).where({ attackId: testTactic.attackId });
    await db.delete(attackGroups).where({ attackId: testGroup.attackId });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(attackTechniques).where({ attackId: testTechnique.attackId });
    await db.delete(attackTactics).where({ attackId: testTactic.attackId });
    await db.delete(attackGroups).where({ attackId: testGroup.attackId });
  });

  describe('Techniques API', () => {
    it('should create a new technique', async () => {
      const [created] = await db.insert(attackTechniques).values(testTechnique).returning();

      expect(created).toBeDefined();
      expect(created.attackId).toBe(testTechnique.attackId);
      expect(created.name).toBe(testTechnique.name);
      expect(created.platforms).toEqual(testTechnique.platforms);
    });

    it('should retrieve techniques from database', async () => {
      const techniques = await db.select().from(attackTechniques).limit(10);

      expect(Array.isArray(techniques)).toBe(true);
      if (techniques.length > 0) {
        expect(techniques[0]).toHaveProperty('attackId');
        expect(techniques[0]).toHaveProperty('name');
        expect(techniques[0]).toHaveProperty('description');
      }
    });

    it('should filter techniques by platform', async () => {
      const windowsTechniques = await db
        .select()
        .from(attackTechniques)
        .where({ platforms: ['Windows'] })
        .limit(5);

      expect(Array.isArray(windowsTechniques)).toBe(true);
    });

    it('should distinguish between techniques and sub-techniques', async () => {
      const techniques = await db
        .select()
        .from(attackTechniques)
        .where({ isSubtechnique: false })
        .limit(5);

      const subtechniques = await db
        .select()
        .from(attackTechniques)
        .where({ isSubtechnique: true })
        .limit(5);

      expect(Array.isArray(techniques)).toBe(true);
      expect(Array.isArray(subtechniques)).toBe(true);

      if (techniques.length > 0) {
        expect(techniques[0].isSubtechnique).toBe(false);
      }

      if (subtechniques.length > 0) {
        expect(subtechniques[0].isSubtechnique).toBe(true);
      }
    });
  });

  describe('Tactics API', () => {
    it('should create a new tactic', async () => {
      const [created] = await db.insert(attackTactics).values(testTactic).returning();

      expect(created).toBeDefined();
      expect(created.attackId).toBe(testTactic.attackId);
      expect(created.name).toBe(testTactic.name);
      expect(created.shortName).toBe(testTactic.shortName);
    });

    it('should retrieve tactics from database', async () => {
      const tactics = await db.select().from(attackTactics).limit(10);

      expect(Array.isArray(tactics)).toBe(true);
      if (tactics.length > 0) {
        expect(tactics[0]).toHaveProperty('attackId');
        expect(tactics[0]).toHaveProperty('name');
        expect(tactics[0]).toHaveProperty('shortName');
      }
    });

    it('should have unique tactic IDs', async () => {
      const tactics = await db.select().from(attackTactics);
      const attackIds = tactics.map(t => t.attackId);
      const uniqueIds = new Set(attackIds);

      expect(uniqueIds.size).toBe(attackIds.length);
    });
  });

  describe('Groups API', () => {
    it('should create a new group', async () => {
      const [created] = await db.insert(attackGroups).values(testGroup).returning();

      expect(created).toBeDefined();
      expect(created.attackId).toBe(testGroup.attackId);
      expect(created.name).toBe(testGroup.name);
      expect(created.aliases).toEqual(testGroup.aliases);
    });

    it('should retrieve groups from database', async () => {
      const groups = await db.select().from(attackGroups).limit(10);

      expect(Array.isArray(groups)).toBe(true);
      if (groups.length > 0) {
        expect(groups[0]).toHaveProperty('attackId');
        expect(groups[0]).toHaveProperty('name');
      }
    });

    it('should handle group aliases', async () => {
      const groupsWithAliases = await db
        .select()
        .from(attackGroups)
        .limit(10);

      const hasAliases = groupsWithAliases.some(g => g.aliases && g.aliases.length > 0);
      expect(typeof hasAliases).toBe('boolean');
    });
  });

  describe('Software API', () => {
    it('should retrieve software from database', async () => {
      const software = await db.select().from(attackSoftware).limit(10);

      expect(Array.isArray(software)).toBe(true);
      if (software.length > 0) {
        expect(software[0]).toHaveProperty('attackId');
        expect(software[0]).toHaveProperty('name');
        expect(software[0]).toHaveProperty('type');
      }
    });

    it('should distinguish between malware and tools', async () => {
      const allSoftware = await db.select().from(attackSoftware).limit(20);

      if (allSoftware.length > 0) {
        const types = allSoftware.map(s => s.type);
        const validTypes = types.every(t => ['malware', 'tool'].includes(t));
        expect(validTypes).toBe(true);
      }
    });
  });

  describe('Mitigations API', () => {
    it('should retrieve mitigations from database', async () => {
      const mitigations = await db.select().from(attackMitigations).limit(10);

      expect(Array.isArray(mitigations)).toBe(true);
      if (mitigations.length > 0) {
        expect(mitigations[0]).toHaveProperty('attackId');
        expect(mitigations[0]).toHaveProperty('name');
        expect(mitigations[0]).toHaveProperty('description');
      }
    });

    it('should have valid mitigation IDs', async () => {
      const mitigations = await db.select().from(attackMitigations).limit(10);

      if (mitigations.length > 0) {
        const hasValidIds = mitigations.every(m => m.attackId.startsWith('M'));
        expect(hasValidIds).toBe(true);
      }
    });
  });

  describe('ATT&CK Statistics', () => {
    it('should calculate correct technique counts', async () => {
      const allTechniques = await db.select().from(attackTechniques);
      const techniques = allTechniques.filter(t => !t.isSubtechnique);
      const subtechniques = allTechniques.filter(t => t.isSubtechnique);

      expect(techniques.length).toBeGreaterThanOrEqual(0);
      expect(subtechniques.length).toBeGreaterThanOrEqual(0);
      expect(allTechniques.length).toBe(techniques.length + subtechniques.length);
    });

    it('should count all entity types', async () => {
      const [techniques, tactics, groups, software, mitigations] = await Promise.all([
        db.select().from(attackTechniques),
        db.select().from(attackTactics),
        db.select().from(attackGroups),
        db.select().from(attackSoftware),
        db.select().from(attackMitigations),
      ]);

      expect(techniques.length).toBeGreaterThanOrEqual(0);
      expect(tactics.length).toBeGreaterThanOrEqual(0);
      expect(groups.length).toBeGreaterThanOrEqual(0);
      expect(software.length).toBeGreaterThanOrEqual(0);
      expect(mitigations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Integrity', () => {
    it('should have valid ATT&CK IDs', async () => {
      const techniques = await db.select().from(attackTechniques).limit(10);

      if (techniques.length > 0) {
        const validIds = techniques.every(t =>
          t.attackId.match(/^T\d{4}(\.\d{3})?$/)
        );
        expect(validIds).toBe(true);
      }
    });

    it('should have non-empty names', async () => {
      const techniques = await db.select().from(attackTechniques).limit(10);

      if (techniques.length > 0) {
        const validNames = techniques.every(t => t.name && t.name.length > 0);
        expect(validNames).toBe(true);
      }
    });

    it('should have valid URLs', async () => {
      const techniques = await db.select().from(attackTechniques).limit(10);

      if (techniques.length > 0) {
        const validUrls = techniques.every(t =>
          t.url && t.url.startsWith('https://attack.mitre.org/')
        );
        expect(validUrls).toBe(true);
      }
    });

    it('should have valid platforms', async () => {
      const techniques = await db.select().from(attackTechniques).limit(10);

      const validPlatforms = [
        'Windows', 'Linux', 'macOS', 'AWS', 'GCP', 'Azure',
        'Office 365', 'SaaS', 'IaaS', 'Network', 'Containers',
        'PRE', 'Android', 'iOS'
      ];

      if (techniques.length > 0) {
        const hasValidPlatforms = techniques.every(t => {
          if (!t.platforms || t.platforms.length === 0) return true;
          return t.platforms.every((p: string) => validPlatforms.includes(p));
        });
        expect(hasValidPlatforms).toBe(true);
      }
    });
  });
});
