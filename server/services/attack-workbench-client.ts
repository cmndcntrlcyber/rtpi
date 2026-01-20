/**
 * ATT&CK Workbench REST API Client
 *
 * Provides integration with MITRE ATT&CK Workbench for managing custom ATT&CK datasets,
 * techniques, groups, software, and collections.
 *
 * API Documentation: https://github.com/center-for-threat-informed-defense/attack-workbench-rest-api
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

interface WorkbenchConfig {
  apiUrl: string;
  timeout?: number;
}

interface WorkbenchTechnique {
  stix: {
    id: string;
    type: string;
    name: string;
    description: string;
    external_references?: Array<{
      source_name: string;
      external_id?: string;
      url?: string;
    }>;
    x_mitre_platforms?: string[];
    x_mitre_data_sources?: string[];
    kill_chain_phases?: Array<{
      kill_chain_name: string;
      phase_name: string;
    }>;
  };
  workspace: {
    workflow?: {
      state: string;
    };
    collections?: string[];
  };
}

interface WorkbenchCollection {
  stix: {
    id: string;
    type: string;
    name: string;
    description: string;
    x_mitre_version?: string;
  };
  workspace: {
    workflow?: {
      state: string;
    };
  };
}

interface WorkbenchGroup {
  stix: {
    id: string;
    type: string;
    name: string;
    description: string;
    aliases?: string[];
  };
}

interface WorkbenchSoftware {
  stix: {
    id: string;
    type: string;
    name: string;
    description: string;
    x_mitre_platforms?: string[];
  };
}

interface WorkbenchMitigation {
  stix: {
    id: string;
    type: string;
    name: string;
    description: string;
  };
}

interface WorkbenchRelationship {
  stix: {
    id: string;
    type: string;
    source_ref: string;
    target_ref: string;
    relationship_type: string;
  };
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors: string[];
  items?: any[];
}

export class AttackWorkbenchClient {
  private client: AxiosInstance;
  private apiUrl: string;

  constructor(config: WorkbenchConfig) {
    this.apiUrl = config.apiUrl || process.env.WORKBENCH_API_URL || 'http://localhost:3010';

    this.client = axios.create({
      baseURL: `${this.apiUrl}/api`,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add error interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('Workbench API Error:', error.message);
        if (error.response) {
          console.error('Response:', error.response.status, error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test connection to Workbench API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/collections');
      return response.status === 200;
    } catch (error: any) {
      // 401 means the API is responding (just needs auth), so connection is good
      if (error.response && error.response.status === 401) {
        return true;
      }
      console.error('Failed to connect to Workbench:', error.message);
      return false;
    }
  }

  // ========== Techniques ==========

  /**
   * Get all techniques from Workbench
   */
  async getTechniques(params?: {
    limit?: number;
    offset?: number;
    state?: string;
    includeRevoked?: boolean;
    includeDeprecated?: boolean;
  }): Promise<WorkbenchTechnique[]> {
    try {
      const response = await this.client.get('/techniques', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch techniques:', error);
      return [];
    }
  }

  /**
   * Get a single technique by STIX ID
   */
  async getTechnique(stixId: string): Promise<WorkbenchTechnique | null> {
    try {
      const response = await this.client.get(`/techniques/${stixId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch technique ${stixId}:`, error);
      return null;
    }
  }

  /**
   * Create a new technique in Workbench
   */
  async createTechnique(technique: Partial<WorkbenchTechnique>): Promise<WorkbenchTechnique | null> {
    try {
      const response = await this.client.post('/techniques', technique);
      return response.data;
    } catch (error) {
      console.error('Failed to create technique:', error);
      return null;
    }
  }

  /**
   * Update an existing technique
   */
  async updateTechnique(stixId: string, technique: Partial<WorkbenchTechnique>): Promise<WorkbenchTechnique | null> {
    try {
      const response = await this.client.put(`/techniques/${stixId}`, technique);
      return response.data;
    } catch (error) {
      console.error(`Failed to update technique ${stixId}:`, error);
      return null;
    }
  }

  /**
   * Delete a technique
   */
  async deleteTechnique(stixId: string): Promise<boolean> {
    try {
      await this.client.delete(`/techniques/${stixId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete technique ${stixId}:`, error);
      return false;
    }
  }

  // ========== Collections ==========

  /**
   * Get all collections
   */
  async getCollections(): Promise<WorkbenchCollection[]> {
    try {
      const response = await this.client.get('/collections');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch collections:', error);
      return [];
    }
  }

  /**
   * Get a single collection by STIX ID
   */
  async getCollection(stixId: string): Promise<WorkbenchCollection | null> {
    try {
      const response = await this.client.get(`/collections/${stixId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch collection ${stixId}:`, error);
      return null;
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(collection: Partial<WorkbenchCollection>): Promise<WorkbenchCollection | null> {
    try {
      const response = await this.client.post('/collections', collection);
      return response.data;
    } catch (error) {
      console.error('Failed to create collection:', error);
      return null;
    }
  }

  /**
   * Get collection bundle (all objects in a collection as STIX bundle)
   */
  async getCollectionBundle(stixId: string): Promise<any> {
    try {
      const response = await this.client.get(`/collections/${stixId}/bundle`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch collection bundle ${stixId}:`, error);
      return null;
    }
  }

  // ========== Groups ==========

  /**
   * Get all groups
   */
  async getGroups(): Promise<WorkbenchGroup[]> {
    try {
      const response = await this.client.get('/groups');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      return [];
    }
  }

  /**
   * Create a new group
   */
  async createGroup(group: Partial<WorkbenchGroup>): Promise<WorkbenchGroup | null> {
    try {
      const response = await this.client.post('/groups', group);
      return response.data;
    } catch (error) {
      console.error('Failed to create group:', error);
      return null;
    }
  }

  // ========== Software ==========

  /**
   * Get all software
   */
  async getSoftware(): Promise<WorkbenchSoftware[]> {
    try {
      const response = await this.client.get('/software');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch software:', error);
      return [];
    }
  }

  /**
   * Create new software
   */
  async createSoftware(software: Partial<WorkbenchSoftware>): Promise<WorkbenchSoftware | null> {
    try {
      const response = await this.client.post('/software', software);
      return response.data;
    } catch (error) {
      console.error('Failed to create software:', error);
      return null;
    }
  }

  // ========== Mitigations ==========

  /**
   * Get all mitigations
   */
  async getMitigations(): Promise<WorkbenchMitigation[]> {
    try {
      const response = await this.client.get('/mitigations');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch mitigations:', error);
      return [];
    }
  }

  /**
   * Create a new mitigation
   */
  async createMitigation(mitigation: Partial<WorkbenchMitigation>): Promise<WorkbenchMitigation | null> {
    try {
      const response = await this.client.post('/mitigations', mitigation);
      return response.data;
    } catch (error) {
      console.error('Failed to create mitigation:', error);
      return null;
    }
  }

  // ========== Relationships ==========

  /**
   * Get all relationships
   */
  async getRelationships(params?: {
    sourceRef?: string;
    targetRef?: string;
    relationshipType?: string;
  }): Promise<WorkbenchRelationship[]> {
    try {
      const response = await this.client.get('/relationships', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch relationships:', error);
      return [];
    }
  }

  /**
   * Create a new relationship
   */
  async createRelationship(relationship: Partial<WorkbenchRelationship>): Promise<WorkbenchRelationship | null> {
    try {
      const response = await this.client.post('/relationships', relationship);
      return response.data;
    } catch (error) {
      console.error('Failed to create relationship:', error);
      return null;
    }
  }

  // ========== Sync Operations ==========

  /**
   * Send RTPI technique to Workbench
   * Maps RTPI technique format to Workbench format
   */
  async sendTechniqueToWorkbench(rtpiTechnique: {
    attackId: string;
    name: string;
    description: string;
    platforms?: string[];
    tactics?: string[];
    dataSources?: string[];
  }): Promise<SyncResult> {
    const errors: string[] = [];

    try {
      // Convert RTPI technique to Workbench format
      const workbenchTechnique: Partial<WorkbenchTechnique> = {
        stix: {
          id: `attack-pattern--${this.generateUUID()}`,
          type: 'attack-pattern',
          name: rtpiTechnique.name,
          description: rtpiTechnique.description,
          external_references: [
            {
              source_name: 'mitre-attack',
              external_id: rtpiTechnique.attackId,
              url: `https://attack.mitre.org/techniques/${rtpiTechnique.attackId}`,
            },
          ],
          x_mitre_platforms: rtpiTechnique.platforms || [],
          x_mitre_data_sources: rtpiTechnique.dataSources || [],
          kill_chain_phases: (rtpiTechnique.tactics || []).map((tactic) => ({
            kill_chain_name: 'mitre-attack',
            phase_name: tactic.toLowerCase().replace(/\s+/g, '-'),
          })),
        },
        workspace: {
          workflow: {
            state: 'work-in-progress',
          },
        },
      };

      const result = await this.createTechnique(workbenchTechnique);

      if (result) {
        return {
          success: true,
          synced: 1,
          errors: [],
          items: [result],
        };
      } else {
        errors.push('Failed to create technique in Workbench');
      }
    } catch (error) {
      errors.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      success: false,
      synced: 0,
      errors,
    };
  }

  /**
   * Pull techniques from Workbench to RTPI
   * Returns techniques in RTPI format
   */
  async pullTechniquesFromWorkbench(): Promise<SyncResult> {
    const errors: string[] = [];
    const rtpiTechniques: any[] = [];

    try {
      const techniques = await this.getTechniques();

      for (const technique of techniques) {
        try {
          // Convert Workbench format to RTPI format
          const attackIdRef = technique.stix.external_references?.find(
            (ref) => ref.source_name === 'mitre-attack'
          );

          const rtpiTechnique = {
            attackId: attackIdRef?.external_id || 'CUSTOM',
            name: technique.stix.name,
            description: technique.stix.description,
            platforms: technique.stix.x_mitre_platforms || [],
            dataSources: technique.stix.x_mitre_data_sources || [],
            tactics: (technique.stix.kill_chain_phases || []).map(
              (phase) => phase.phase_name
            ),
            stixId: technique.stix.id,
          };

          rtpiTechniques.push(rtpiTechnique);
        } catch (error) {
          errors.push(
            `Failed to convert technique ${technique.stix.name}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }

      return {
        success: errors.length === 0,
        synced: rtpiTechniques.length,
        errors,
        items: rtpiTechniques,
      };
    } catch (error) {
      errors.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        synced: 0,
        errors,
      };
    }
  }

  // ========== Utilities ==========

  /**
   * Generate a UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// Export singleton instance
export const workbenchClient = new AttackWorkbenchClient({
  apiUrl: process.env.WORKBENCH_API_URL || 'http://localhost:3010',
});
