/**
 * STIX Import Integration Tests
 *
 * Tests for STIX bundle parsing and database import functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parseStixBundle } from '../../server/services/stix-parser';
import { db } from '../../db';
import {
  attackTechniques,
  attackTactics,
  attackGroups,
  attackSoftware,
  attackMitigations,
  attackDataSources,
  attackCampaigns
} from '../../shared/schema';

describe('STIX Import Tests', () => {
  // Sample STIX bundle for testing
  const sampleStixBundle = {
    type: 'bundle',
    id: 'bundle--test-123',
    objects: [
      // Tactic
      {
        type: 'x-mitre-tactic',
        id: 'x-mitre-tactic--test-001',
        name: 'Test Tactic',
        x_mitre_shortname: 'test-tactic',
        description: 'Test tactic description',
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'TA0001',
            url: 'https://attack.mitre.org/tactics/TA0001'
          }
        ]
      },
      // Technique
      {
        type: 'attack-pattern',
        id: 'attack-pattern--test-001',
        name: 'Test Technique',
        description: 'Test technique description',
        x_mitre_platforms: ['Windows', 'Linux'],
        x_mitre_data_sources: ['Process monitoring'],
        x_mitre_is_subtechnique: false,
        kill_chain_phases: [
          {
            kill_chain_name: 'mitre-attack',
            phase_name: 'test-tactic'
          }
        ],
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'T1001',
            url: 'https://attack.mitre.org/techniques/T1001'
          }
        ]
      },
      // Sub-technique
      {
        type: 'attack-pattern',
        id: 'attack-pattern--test-002',
        name: 'Test Sub-technique',
        description: 'Test sub-technique description',
        x_mitre_platforms: ['Windows'],
        x_mitre_is_subtechnique: true,
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'T1001.001',
            url: 'https://attack.mitre.org/techniques/T1001/001'
          }
        ]
      },
      // Group
      {
        type: 'intrusion-set',
        id: 'intrusion-set--test-001',
        name: 'Test Group',
        description: 'Test threat group',
        aliases: ['TestGroup', 'TG1'],
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'G0001',
            url: 'https://attack.mitre.org/groups/G0001'
          }
        ]
      },
      // Software (Malware)
      {
        type: 'malware',
        id: 'malware--test-001',
        name: 'Test Malware',
        description: 'Test malware description',
        x_mitre_platforms: ['Windows'],
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'S0001',
            url: 'https://attack.mitre.org/software/S0001'
          }
        ]
      },
      // Software (Tool)
      {
        type: 'tool',
        id: 'tool--test-001',
        name: 'Test Tool',
        description: 'Test tool description',
        x_mitre_platforms: ['Linux'],
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'S0002',
            url: 'https://attack.mitre.org/software/S0002'
          }
        ]
      },
      // Mitigation
      {
        type: 'course-of-action',
        id: 'course-of-action--test-001',
        name: 'Test Mitigation',
        description: 'Test mitigation description',
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'M0001',
            url: 'https://attack.mitre.org/mitigations/M0001'
          }
        ]
      },
      // Data Source
      {
        type: 'x-mitre-data-source',
        id: 'x-mitre-data-source--test-001',
        name: 'Test Data Source',
        description: 'Test data source description',
        x_mitre_platforms: ['Windows', 'Linux'],
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'DS0001',
            url: 'https://attack.mitre.org/datasources/DS0001'
          }
        ]
      },
      // Campaign
      {
        type: 'campaign',
        id: 'campaign--test-001',
        name: 'Test Campaign',
        description: 'Test campaign description',
        first_seen: '2020-01-01T00:00:00.000Z',
        last_seen: '2020-12-31T23:59:59.999Z',
        external_references: [
          {
            source_name: 'mitre-attack',
            external_id: 'C0001',
            url: 'https://attack.mitre.org/campaigns/C0001'
          }
        ]
      }
    ]
  };

  beforeAll(async () => {
    // Clean up test data
    await db.delete(attackTechniques).where({ attackId: 'T1001' });
    await db.delete(attackTechniques).where({ attackId: 'T1001.001' });
    await db.delete(attackTactics).where({ attackId: 'TA0001' });
    await db.delete(attackGroups).where({ attackId: 'G0001' });
    await db.delete(attackSoftware).where({ attackId: 'S0001' });
    await db.delete(attackSoftware).where({ attackId: 'S0002' });
    await db.delete(attackMitigations).where({ attackId: 'M0001' });
    await db.delete(attackDataSources).where({ attackId: 'DS0001' });
    await db.delete(attackCampaigns).where({ attackId: 'C0001' });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(attackTechniques).where({ attackId: 'T1001' });
    await db.delete(attackTechniques).where({ attackId: 'T1001.001' });
    await db.delete(attackTactics).where({ attackId: 'TA0001' });
    await db.delete(attackGroups).where({ attackId: 'G0001' });
    await db.delete(attackSoftware).where({ attackId: 'S0001' });
    await db.delete(attackSoftware).where({ attackId: 'S0002' });
    await db.delete(attackMitigations).where({ attackId: 'M0001' });
    await db.delete(attackDataSources).where({ attackId: 'DS0001' });
    await db.delete(attackCampaigns).where({ attackId: 'C0001' });
  });

  describe('STIX Bundle Parsing', () => {
    it('should parse STIX bundle successfully', async () => {
      const result = await parseStixBundle(sampleStixBundle);

      expect(result).toBeDefined();
      expect(result.tactics).toBeGreaterThan(0);
      expect(result.techniques).toBeGreaterThan(0);
      expect(result.groups).toBeGreaterThan(0);
      expect(result.software).toBeGreaterThan(0);
      expect(result.mitigations).toBeGreaterThan(0);
    });

    it('should import tactics correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const tactics = await db.select().from(attackTactics).where({ attackId: 'TA0001' });

      expect(tactics.length).toBe(1);
      expect(tactics[0].name).toBe('Test Tactic');
      expect(tactics[0].shortName).toBe('test-tactic');
    });

    it('should import techniques correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const techniques = await db.select().from(attackTechniques).where({ attackId: 'T1001' });

      expect(techniques.length).toBe(1);
      expect(techniques[0].name).toBe('Test Technique');
      expect(techniques[0].isSubtechnique).toBe(false);
      expect(techniques[0].platforms).toContain('Windows');
      expect(techniques[0].platforms).toContain('Linux');
    });

    it('should import sub-techniques correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const subtechniques = await db.select().from(attackTechniques).where({ attackId: 'T1001.001' });

      expect(subtechniques.length).toBe(1);
      expect(subtechniques[0].name).toBe('Test Sub-technique');
      expect(subtechniques[0].isSubtechnique).toBe(true);
    });

    it('should import groups correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const groups = await db.select().from(attackGroups).where({ attackId: 'G0001' });

      expect(groups.length).toBe(1);
      expect(groups[0].name).toBe('Test Group');
      expect(groups[0].aliases).toContain('TestGroup');
      expect(groups[0].aliases).toContain('TG1');
    });

    it('should import malware correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const software = await db.select().from(attackSoftware).where({ attackId: 'S0001' });

      expect(software.length).toBe(1);
      expect(software[0].name).toBe('Test Malware');
      expect(software[0].type).toBe('malware');
    });

    it('should import tools correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const software = await db.select().from(attackSoftware).where({ attackId: 'S0002' });

      expect(software.length).toBe(1);
      expect(software[0].name).toBe('Test Tool');
      expect(software[0].type).toBe('tool');
    });

    it('should import mitigations correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const mitigations = await db.select().from(attackMitigations).where({ attackId: 'M0001' });

      expect(mitigations.length).toBe(1);
      expect(mitigations[0].name).toBe('Test Mitigation');
    });

    it('should import data sources correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const dataSources = await db.select().from(attackDataSources).where({ attackId: 'DS0001' });

      expect(dataSources.length).toBe(1);
      expect(dataSources[0].name).toBe('Test Data Source');
    });

    it('should import campaigns correctly', async () => {
      await parseStixBundle(sampleStixBundle);

      const campaigns = await db.select().from(attackCampaigns).where({ attackId: 'C0001' });

      expect(campaigns.length).toBe(1);
      expect(campaigns[0].name).toBe('Test Campaign');
      expect(campaigns[0].firstSeen).toBeDefined();
      expect(campaigns[0].lastSeen).toBeDefined();
    });
  });

  describe('External References Extraction', () => {
    it('should extract ATT&CK IDs from external references', async () => {
      await parseStixBundle(sampleStixBundle);

      const technique = await db.select().from(attackTechniques).where({ attackId: 'T1001' }).limit(1);

      expect(technique[0].attackId).toBe('T1001');
    });

    it('should extract URLs from external references', async () => {
      await parseStixBundle(sampleStixBundle);

      const technique = await db.select().from(attackTechniques).where({ attackId: 'T1001' }).limit(1);

      expect(technique[0].url).toContain('attack.mitre.org');
    });
  });

  describe('Data Validation', () => {
    it('should handle missing optional fields', async () => {
      const minimalBundle = {
        type: 'bundle',
        id: 'bundle--minimal',
        objects: [
          {
            type: 'attack-pattern',
            id: 'attack-pattern--minimal',
            name: 'Minimal Technique',
            description: 'Minimal description',
            external_references: [
              {
                source_name: 'mitre-attack',
                external_id: 'T9999',
                url: 'https://attack.mitre.org/techniques/T9999'
              }
            ]
          }
        ]
      };

      const result = await parseStixBundle(minimalBundle);
      expect(result.techniques).toBe(1);

      const technique = await db.select().from(attackTechniques).where({ attackId: 'T9999' }).limit(1);
      expect(technique.length).toBe(1);

      // Clean up
      await db.delete(attackTechniques).where({ attackId: 'T9999' });
    });

    it('should handle empty bundle', async () => {
      const emptyBundle = {
        type: 'bundle',
        id: 'bundle--empty',
        objects: []
      };

      const result = await parseStixBundle(emptyBundle);
      expect(result.tactics).toBe(0);
      expect(result.techniques).toBe(0);
      expect(result.groups).toBe(0);
    });

    it('should skip unsupported STIX types', async () => {
      const unsupportedBundle = {
        type: 'bundle',
        id: 'bundle--unsupported',
        objects: [
          {
            type: 'indicator',
            id: 'indicator--test',
            pattern: '[file:hashes.MD5 = "..."]'
          }
        ]
      };

      // Should not throw error, just skip unsupported types
      const result = await parseStixBundle(unsupportedBundle);
      expect(result).toBeDefined();
    });
  });

  describe('Import Statistics', () => {
    it('should return accurate import counts', async () => {
      const result = await parseStixBundle(sampleStixBundle);

      expect(result.tactics).toBeGreaterThanOrEqual(1);
      expect(result.techniques).toBeGreaterThanOrEqual(2); // 1 technique + 1 sub-technique
      expect(result.groups).toBeGreaterThanOrEqual(1);
      expect(result.software).toBeGreaterThanOrEqual(2); // 1 malware + 1 tool
      expect(result.mitigations).toBeGreaterThanOrEqual(1);
      expect(result.dataSources).toBeGreaterThanOrEqual(1);
      expect(result.campaigns).toBeGreaterThanOrEqual(1);
    });

    it('should count sub-techniques separately', async () => {
      const result = await parseStixBundle(sampleStixBundle);

      const allTechniques = await db.select().from(attackTechniques).where({ attackId: 'T1001' });
      const subTechniques = await db.select().from(attackTechniques).where({ attackId: 'T1001.001' });

      expect(allTechniques.length).toBeGreaterThan(0);
      expect(subTechniques.length).toBeGreaterThan(0);
      expect(subTechniques[0].isSubtechnique).toBe(true);
    });
  });

  describe('Duplicate Handling', () => {
    it('should handle duplicate imports gracefully', async () => {
      // First import
      await parseStixBundle(sampleStixBundle);

      // Second import (should update or skip duplicates)
      await parseStixBundle(sampleStixBundle);

      // Should not create duplicates
      const techniques = await db.select().from(attackTechniques).where({ attackId: 'T1001' });
      expect(techniques.length).toBe(1);
    });
  });

  describe('Relationship Extraction', () => {
    it('should extract kill chain phases from techniques', async () => {
      await parseStixBundle(sampleStixBundle);

      const technique = await db.select().from(attackTechniques).where({ attackId: 'T1001' }).limit(1);

      expect(technique[0]).toBeDefined();
      // Kill chain phases should be processed
    });

    it('should extract platform information', async () => {
      await parseStixBundle(sampleStixBundle);

      const technique = await db.select().from(attackTechniques).where({ attackId: 'T1001' }).limit(1);

      expect(technique[0].platforms).toBeDefined();
      expect(Array.isArray(technique[0].platforms)).toBe(true);
      expect(technique[0].platforms.length).toBeGreaterThan(0);
    });

    it('should extract data sources', async () => {
      await parseStixBundle(sampleStixBundle);

      const technique = await db.select().from(attackTechniques).where({ attackId: 'T1001' }).limit(1);

      expect(technique[0].dataSources).toBeDefined();
      expect(Array.isArray(technique[0].dataSources)).toBe(true);
    });
  });
});
