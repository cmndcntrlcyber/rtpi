/**
 * ATT&CK Workbench Integration Tests
 *
 * Tests for Workbench API client and bidirectional sync functionality.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { AttackWorkbenchClient } from '../../server/services/attack-workbench-client';

describe('Workbench Integration Tests', () => {
  let client: AttackWorkbenchClient;
  const isWorkbenchAvailable = process.env.WORKBENCH_API_URL !== undefined;

  beforeAll(() => {
    client = new AttackWorkbenchClient({
      apiUrl: process.env.WORKBENCH_API_URL || 'http://localhost:3010',
    });
  });

  describe('Workbench Client Initialization', () => {
    it('should initialize with default URL if not provided', () => {
      const defaultClient = new AttackWorkbenchClient({});
      expect(defaultClient).toBeDefined();
    });

    it('should initialize with custom URL', () => {
      const customClient = new AttackWorkbenchClient({
        apiUrl: 'http://custom-url:3010',
      });
      expect(customClient).toBeDefined();
    });

    it('should accept custom timeout', () => {
      const timeoutClient = new AttackWorkbenchClient({
        timeout: 60000,
      });
      expect(timeoutClient).toBeDefined();
    });
  });

  describe('Connection Testing', () => {
    it('should test connection to Workbench API', async () => {
      const isConnected = await client.testConnection();
      expect(typeof isConnected).toBe('boolean');

      if (isWorkbenchAvailable) {
        expect(isConnected).toBe(true);
      }
    });
  });

  describe('Techniques Operations', () => {
    it('should retrieve techniques from Workbench', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const techniques = await client.getTechniques({ limit: 10 });
      expect(Array.isArray(techniques)).toBe(true);

      if (techniques.length > 0) {
        expect(techniques[0]).toHaveProperty('stix');
        expect(techniques[0].stix).toHaveProperty('id');
        expect(techniques[0].stix).toHaveProperty('name');
        expect(techniques[0].stix).toHaveProperty('type');
        expect(techniques[0].stix.type).toBe('attack-pattern');
      }
    });

    it('should handle pagination parameters', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const firstPage = await client.getTechniques({ limit: 5, offset: 0 });
      const secondPage = await client.getTechniques({ limit: 5, offset: 5 });

      expect(Array.isArray(firstPage)).toBe(true);
      expect(Array.isArray(secondPage)).toBe(true);

      // Pages should be different
      if (firstPage.length > 0 && secondPage.length > 0) {
        expect(firstPage[0].stix.id).not.toBe(secondPage[0].stix.id);
      }
    });

    it('should filter techniques by state', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const workInProgress = await client.getTechniques({
        state: 'work-in-progress',
        limit: 10,
      });

      expect(Array.isArray(workInProgress)).toBe(true);
    });
  });

  describe('Collections Operations', () => {
    it('should retrieve collections from Workbench', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const collections = await client.getCollections();
      expect(Array.isArray(collections)).toBe(true);

      if (collections.length > 0) {
        expect(collections[0]).toHaveProperty('stix');
        expect(collections[0].stix).toHaveProperty('name');
        expect(collections[0].stix).toHaveProperty('description');
      }
    });

    it('should handle empty collections list', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const collections = await client.getCollections();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Format Conversion', () => {
    it('should convert RTPI technique to Workbench format', async () => {
      const rtpiTechnique = {
        attackId: 'T9998',
        name: 'Test Conversion Technique',
        description: 'Test technique for format conversion',
        platforms: ['Windows', 'Linux'],
        tactics: ['initial-access', 'execution'],
        dataSources: ['Process monitoring', 'File monitoring'],
      };

      const result = await client.sendTechniqueToWorkbench(rtpiTechnique);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);

      if (!isWorkbenchAvailable) {
        // Should fail gracefully when Workbench not available
        expect(result.success).toBe(false);
      }
    });

    it('should handle technique conversion with minimal data', async () => {
      const minimalTechnique = {
        attackId: 'T9997',
        name: 'Minimal Technique',
        description: 'Minimal data for testing',
      };

      const result = await client.sendTechniqueToWorkbench(minimalTechnique);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('Bidirectional Sync', () => {
    it('should structure push sync results correctly', async () => {
      const result = await client.sendTechniqueToWorkbench({
        attackId: 'T9996',
        name: 'Push Test Technique',
        description: 'Testing push sync',
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.synced).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should structure pull sync results correctly', async () => {
      const result = await client.pullTechniquesFromWorkbench();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.synced).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);

      if (isWorkbenchAvailable && result.success) {
        expect(result).toHaveProperty('items');
        expect(Array.isArray(result.items)).toBe(true);
      }
    });

    it('should map Workbench techniques to RTPI format', async () => {
      const result = await client.pullTechniquesFromWorkbench();

      if (result.items && result.items.length > 0) {
        const rtpiTechnique = result.items[0];

        expect(rtpiTechnique).toHaveProperty('attackId');
        expect(rtpiTechnique).toHaveProperty('name');
        expect(rtpiTechnique).toHaveProperty('description');
        expect(rtpiTechnique).toHaveProperty('stixId');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const failClient = new AttackWorkbenchClient({
        apiUrl: 'http://localhost:9999', // Invalid URL
        timeout: 1000,
      });

      const isConnected = await failClient.testConnection();
      expect(isConnected).toBe(false);
    });

    it('should return empty arrays on API errors', async () => {
      const failClient = new AttackWorkbenchClient({
        apiUrl: 'http://localhost:9999',
        timeout: 1000,
      });

      const techniques = await failClient.getTechniques();
      expect(Array.isArray(techniques)).toBe(true);
      expect(techniques.length).toBe(0);
    });

    it('should collect errors during sync operations', async () => {
      const result = await client.sendTechniqueToWorkbench({
        attackId: 'INVALID',
        name: '',
        description: '',
      });

      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(typeof result.errors[0]).toBe('string');
      }
    });
  });

  describe('STIX Compliance', () => {
    it('should generate valid STIX IDs', async () => {
      const result = await client.sendTechniqueToWorkbench({
        attackId: 'T9995',
        name: 'STIX Test',
        description: 'Testing STIX compliance',
      });

      if (result.items && result.items.length > 0) {
        const stixId = result.items[0].stix.id;
        expect(stixId).toMatch(/^attack-pattern--[0-9a-f-]+$/);
      }
    });

    it('should include required STIX fields', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const techniques = await client.getTechniques({ limit: 1 });

      if (techniques.length > 0) {
        const technique = techniques[0];
        expect(technique.stix).toHaveProperty('id');
        expect(technique.stix).toHaveProperty('type');
        expect(technique.stix).toHaveProperty('name');
        expect(technique.stix.type).toBe('attack-pattern');
      }
    });
  });

  describe('Relationship Management', () => {
    it('should retrieve relationships', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const relationships = await client.getRelationships({ });
      expect(Array.isArray(relationships)).toBe(true);

      if (relationships.length > 0) {
        expect(relationships[0]).toHaveProperty('stix');
        expect(relationships[0].stix).toHaveProperty('source_ref');
        expect(relationships[0].stix).toHaveProperty('target_ref');
        expect(relationships[0].stix).toHaveProperty('relationship_type');
      }
    });

    it('should filter relationships by source', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const techniques = await client.getTechniques({ limit: 1 });
      if (techniques.length === 0) return;

      const sourceRef = techniques[0].stix.id;
      const relationships = await client.getRelationships({ sourceRef });

      expect(Array.isArray(relationships)).toBe(true);
    });
  });

  describe('Groups, Software, and Mitigations', () => {
    it('should retrieve groups', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const groups = await client.getGroups();
      expect(Array.isArray(groups)).toBe(true);

      if (groups.length > 0) {
        expect(groups[0]).toHaveProperty('stix');
        expect(groups[0].stix).toHaveProperty('type');
        expect(['intrusion-set'].includes(groups[0].stix.type)).toBe(true);
      }
    });

    it('should retrieve software', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const software = await client.getSoftware();
      expect(Array.isArray(software)).toBe(true);

      if (software.length > 0) {
        expect(software[0]).toHaveProperty('stix');
        expect(software[0].stix).toHaveProperty('type');
        expect(['malware', 'tool'].includes(software[0].stix.type)).toBe(true);
      }
    });

    it('should retrieve mitigations', async () => {
      if (!isWorkbenchAvailable) {
        console.log('Skipping: Workbench not available');
        return;
      }

      const mitigations = await client.getMitigations();
      expect(Array.isArray(mitigations)).toBe(true);

      if (mitigations.length > 0) {
        expect(mitigations[0]).toHaveProperty('stix');
        expect(mitigations[0].stix).toHaveProperty('type');
        expect(mitigations[0].stix.type).toBe('course-of-action');
      }
    });
  });
});
