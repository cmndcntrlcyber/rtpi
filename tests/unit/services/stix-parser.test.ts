import { describe, it, expect, vi } from 'vitest';
import { importSTIXBundle, getImportStatistics, type STIXBundle } from '../../../server/services/stix-parser';

// Mock the database
vi.mock('../../../server/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }),
    query: {
      attackTactics: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attackTechniques: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attackGroups: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attackSoftware: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attackMitigations: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

describe('STIX Parser Service', () => {
  describe('importSTIXBundle', () => {
    it('should import a valid STIX bundle with tactics', async () => {
      const bundle: STIXBundle = {
        type: 'bundle',
        id: 'bundle--test-123',
        objects: [
          {
            type: 'x-mitre-tactic',
            id: 'x-mitre-tactic--test-1',
            created: '2024-01-01T00:00:00.000Z',
            modified: '2024-01-01T00:00:00.000Z',
            name: 'Initial Access',
            description: 'Test tactic',
            x_mitre_shortname: 'initial-access',
            external_references: [
              {
                source_name: 'mitre-attack',
                external_id: 'TA0001',
                url: 'https://attack.mitre.org/tactics/TA0001',
              },
            ],
          },
        ],
      };

      const stats = await importSTIXBundle(bundle);

      expect(stats.tactics).toBe(1);
      expect(stats.errors).toHaveLength(0);
    });

    it('should import attack patterns as techniques', async () => {
      const bundle: STIXBundle = {
        type: 'bundle',
        id: 'bundle--test-123',
        objects: [
          {
            type: 'attack-pattern',
            id: 'attack-pattern--test-1',
            created: '2024-01-01T00:00:00.000Z',
            modified: '2024-01-01T00:00:00.000Z',
            name: 'Phishing',
            description: 'Test technique',
            x_mitre_is_subtechnique: false,
            kill_chain_phases: [
              {
                kill_chain_name: 'mitre-attack',
                phase_name: 'initial-access',
              },
            ],
            external_references: [
              {
                source_name: 'mitre-attack',
                external_id: 'T1566',
                url: 'https://attack.mitre.org/techniques/T1566',
              },
            ],
          },
        ],
      };

      const stats = await importSTIXBundle(bundle);

      expect(stats.techniques).toBe(1);
      expect(stats.errors).toHaveLength(0);
    });

    it('should import subtechniques', async () => {
      const bundle: STIXBundle = {
        type: 'bundle',
        id: 'bundle--test-123',
        objects: [
          {
            type: 'attack-pattern',
            id: 'attack-pattern--test-2',
            created: '2024-01-01T00:00:00.000Z',
            modified: '2024-01-01T00:00:00.000Z',
            name: 'Spearphishing Attachment',
            description: 'Test subtechnique',
            x_mitre_is_subtechnique: true,
            kill_chain_phases: [
              {
                kill_chain_name: 'mitre-attack',
                phase_name: 'initial-access',
              },
            ],
            external_references: [
              {
                source_name: 'mitre-attack',
                external_id: 'T1566.001',
                url: 'https://attack.mitre.org/techniques/T1566/001',
              },
            ],
          },
        ],
      };

      const stats = await importSTIXBundle(bundle);

      expect(stats.subtechniques).toBe(1);
      expect(stats.errors).toHaveLength(0);
    });

    it('should import intrusion sets as groups', async () => {
      const bundle: STIXBundle = {
        type: 'bundle',
        id: 'bundle--test-123',
        objects: [
          {
            type: 'intrusion-set',
            id: 'intrusion-set--test-1',
            created: '2024-01-01T00:00:00.000Z',
            modified: '2024-01-01T00:00:00.000Z',
            name: 'APT28',
            description: 'Test group',
            aliases: ['Fancy Bear', 'Sofacy'],
            external_references: [
              {
                source_name: 'mitre-attack',
                external_id: 'G0007',
                url: 'https://attack.mitre.org/groups/G0007',
              },
            ],
          },
        ],
      };

      const stats = await importSTIXBundle(bundle);

      expect(stats.groups).toBe(1);
      expect(stats.errors).toHaveLength(0);
    });

    it('should import malware and tools as software', async () => {
      const bundle: STIXBundle = {
        type: 'bundle',
        id: 'bundle--test-123',
        objects: [
          {
            type: 'malware',
            id: 'malware--test-1',
            created: '2024-01-01T00:00:00.000Z',
            modified: '2024-01-01T00:00:00.000Z',
            name: 'Emotet',
            description: 'Test malware',
            x_mitre_platforms: ['Windows'],
            external_references: [
              {
                source_name: 'mitre-attack',
                external_id: 'S0367',
                url: 'https://attack.mitre.org/software/S0367',
              },
            ],
          },
          {
            type: 'tool',
            id: 'tool--test-1',
            created: '2024-01-01T00:00:00.000Z',
            modified: '2024-01-01T00:00:00.000Z',
            name: 'Mimikatz',
            description: 'Test tool',
            x_mitre_platforms: ['Windows'],
            external_references: [
              {
                source_name: 'mitre-attack',
                external_id: 'S0002',
                url: 'https://attack.mitre.org/software/S0002',
              },
            ],
          },
        ],
      };

      const stats = await importSTIXBundle(bundle);

      expect(stats.software).toBe(2);
      expect(stats.errors).toHaveLength(0);
    });

    it('should import course-of-action as mitigations', async () => {
      const bundle: STIXBundle = {
        type: 'bundle',
        id: 'bundle--test-123',
        objects: [
          {
            type: 'course-of-action',
            id: 'course-of-action--test-1',
            created: '2024-01-01T00:00:00.000Z',
            modified: '2024-01-01T00:00:00.000Z',
            name: 'User Training',
            description: 'Test mitigation',
            external_references: [
              {
                source_name: 'mitre-attack',
                external_id: 'M1017',
                url: 'https://attack.mitre.org/mitigations/M1017',
              },
            ],
          },
        ],
      };

      const stats = await importSTIXBundle(bundle);

      expect(stats.mitigations).toBe(1);
      expect(stats.errors).toHaveLength(0);
    });

    it('should handle empty bundle', async () => {
      const bundle: STIXBundle = {
        type: 'bundle',
        id: 'bundle--empty',
        objects: [],
      };

      const stats = await importSTIXBundle(bundle);

      expect(stats.tactics).toBe(0);
      expect(stats.techniques).toBe(0);
      expect(stats.groups).toBe(0);
      expect(stats.software).toBe(0);
      expect(stats.mitigations).toBe(0);
      expect(stats.errors).toHaveLength(0);
    });

    it('should collect errors for invalid objects', async () => {
      const bundle: STIXBundle = {
        type: 'bundle',
        id: 'bundle--test-123',
        objects: [
          {
            type: 'x-mitre-tactic',
            id: 'invalid-tactic',
            created: '2024-01-01T00:00:00.000Z',
            modified: '2024-01-01T00:00:00.000Z',
            // Missing required fields
          },
        ],
      };

      const stats = await importSTIXBundle(bundle);

      // Should continue processing despite errors
      expect(stats.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getImportStatistics', () => {
    it('should return current statistics', async () => {
      const stats = await getImportStatistics();

      expect(stats).toHaveProperty('tactics');
      expect(stats).toHaveProperty('techniques');
      expect(stats).toHaveProperty('groups');
      expect(stats).toHaveProperty('software');
      expect(stats).toHaveProperty('mitigations');
    });
  });
});
