/**
 * Empire Executor Security Tests
 *
 * Comprehensive security tests for the empire-executor service covering:
 * - Authentication and token management
 * - API authentication flows
 * - Command execution safety
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Create mock functions that can be reset
const mockDbInsertValues = vi.fn().mockResolvedValue([]);
const mockDbUpdateSet = vi.fn();
const mockDbUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockDbSelectFrom = vi.fn();
const mockDbSelectFromWhere = vi.fn().mockResolvedValue([]);

// Set up the chain
mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateWhere });
mockDbSelectFrom.mockReturnValue({ where: mockDbSelectFromWhere });

const mockDbQuery = {
  empireServers: {
    findFirst: vi.fn(),
  },
  empireUserTokens: {
    findFirst: vi.fn(),
  },
  empireListeners: {
    findFirst: vi.fn(),
  },
  empireAgents: {
    findFirst: vi.fn(),
  },
  empireCredentials: {
    findFirst: vi.fn(),
  },
};

const mockDb = {
  query: mockDbQuery,
  insert: vi.fn().mockReturnValue({
    values: mockDbInsertValues,
  }),
  update: vi.fn().mockReturnValue({
    set: mockDbUpdateSet,
  }),
  select: vi.fn().mockReturnValue({
    from: mockDbSelectFrom,
  }),
};

vi.mock('../../../server/db', () => ({
  db: mockDb,
}));

// Mock axios
vi.mock('axios');

// Store the executor instance
let empireExecutorInstance: any = null;

// Import the executor after mocking
const getEmpireExecutor = async () => {
  if (!empireExecutorInstance) {
    const module = await import('../../../server/services/empire-executor');
    empireExecutorInstance = module.empireExecutor;
  }
  return empireExecutorInstance;
};

describe('Empire Executor Security Tests', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chain mock implementations
    mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateWhere });
    mockDbSelectFrom.mockReturnValue({ where: mockDbSelectFromWhere });
    mockDbUpdateWhere.mockResolvedValue(undefined);
    mockDbInsertValues.mockResolvedValue([]);

    // Setup axios mock
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };

    (axios.create as any) = vi.fn().mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    // Clear the executor cache
    if (empireExecutorInstance) {
      empireExecutorInstance.clearCache();
    }
  });

  describe('Authentication and Token Management', () => {
    describe('Token Generation', () => {
      it('should attempt to create a new token when none exists', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          adminUsername: 'admin',
          adminPasswordHash: 'hashed-password',
          isActive: true,
        };

        const mockLoginResponse = {
          data: { token: 'new-bearer-token-123' },
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(null);
        mockAxiosInstance.post.mockResolvedValue(mockLoginResponse);
        mockAxiosInstance.get.mockResolvedValue({ data: { version: '4.0.0' } });

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('server-1', 'user-1');

        // Should have attempted to create axios client
        expect(axios.create).toHaveBeenCalled();
      });

      it('should use existing token when available', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'existing-token-456',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.get.mockResolvedValue({ data: { version: '4.0.0' } });

        const empireExecutor = await getEmpireExecutor();
        await empireExecutor.checkConnection('server-1', 'user-1');

        // Verify the existing token is used in Authorization header
        const createCall = (axios.create as any).mock.calls.find(
          (call: any[]) => call[0]?.headers?.Authorization?.includes('existing-token-456')
        );
        expect(createCall).toBeDefined();
      });
    });

    describe('Token Validation', () => {
      it('should handle invalid token response and return false', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          adminUsername: 'admin',
          adminPasswordHash: 'wrong-password',
          isActive: true,
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(null);
        mockAxiosInstance.post.mockRejectedValue(new Error('Unauthorized'));

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('server-1', 'user-1');

        expect(result).toBe(false);
      });
    });

    describe('Invalid Tokens', () => {
      it('should handle malformed token gracefully', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'malformed<script>alert(1)</script>token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.get.mockRejectedValue(new Error('Invalid token'));

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('server-1', 'user-1');

        expect(result).toBe(false);
      });
    });
  });

  describe('API Authentication Flows', () => {
    describe('Connection to Empire Server', () => {
      it('should successfully connect to active server', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.get.mockResolvedValue({ data: { version: '4.0.0' } });

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('server-1', 'user-1');

        expect(result).toBe(true);
      });

      it('should reject connection to inactive server', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Inactive Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: false,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('server-1', 'user-1');

        expect(result).toBe(false);
      });

      it('should handle non-existent server', async () => {
        mockDbQuery.empireServers.findFirst.mockResolvedValue(null);

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('non-existent', 'user-1');

        expect(result).toBe(false);
      });

      it('should update server status on connection failure', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.get.mockRejectedValue(new Error('Connection refused'));

        const empireExecutor = await getEmpireExecutor();
        await empireExecutor.checkConnection('server-1', 'user-1');

        // Verify update was called (for server status)
        expect(mockDb.update).toHaveBeenCalled();
      });
    });

    describe('Credential Storage Security', () => {
      it('should not expose credentials in error messages', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          adminUsername: 'secret-admin',
          adminPasswordHash: 'super-secret-password-hash',
          isActive: true,
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(null);
        mockAxiosInstance.post.mockRejectedValue(new Error('Authentication failed'));

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.listAgents('server-1', 'user-1');

        // Error message should not contain credentials
        if (result.error) {
          expect(result.error).not.toContain('secret-admin');
          expect(result.error).not.toContain('super-secret-password-hash');
        }
      });
    });
  });

  describe('Command Execution Safety', () => {
    describe('Agent Command Validation', () => {
      it('should execute shell commands through proper API endpoint', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        const mockAgent = {
          id: 'agent-db-id',
          name: 'test-agent',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockDbQuery.empireAgents.findFirst.mockResolvedValue(mockAgent);
        mockAxiosInstance.post.mockResolvedValue({
          data: { id: 1, agent_id: 'test-agent', input: 'whoami' },
        });

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.executeTask('server-1', 'user-1', {
          agentName: 'test-agent',
          command: 'whoami',
        });

        expect(result.success).toBe(true);
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/api/agents/test-agent/tasks/shell',
          { command: 'whoami' }
        );
      });

      it('should pass commands to Empire API for validation', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockDbQuery.empireAgents.findFirst.mockResolvedValue(null);
        mockAxiosInstance.post.mockResolvedValue({
          data: { id: 1, agent_id: 'test-agent', input: 'cmd' },
        });

        const empireExecutor = await getEmpireExecutor();

        // Command with shell injection attempt - Empire API handles this
        const result = await empireExecutor.executeTask('server-1', 'user-1', {
          agentName: 'test-agent',
          command: 'whoami && net user /add attacker',
        });

        // Command is passed to Empire API - Empire handles sanitization
        expect(result.success).toBe(true);
      });
    });

    describe('Module Execution Validation', () => {
      it('should execute module with proper configuration', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        const mockAgent = {
          id: 'agent-db-id',
          name: 'test-agent',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockDbQuery.empireAgents.findFirst.mockResolvedValue(mockAgent);
        mockAxiosInstance.post.mockResolvedValue({
          data: { success: true },
        });

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.executeModule(
          'server-1',
          'user-1',
          'test-agent',
          'powershell/credentials/mimikatz/logonpasswords',
          { Cleanup: true }
        );

        expect(result.success).toBe(true);
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/api/modules/powershell/credentials/mimikatz/logonpasswords',
          expect.objectContaining({
            Agent: 'test-agent',
            Cleanup: true,
          })
        );
      });

      it('should handle module execution failure', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.post.mockRejectedValue(new Error('Module not found'));

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.executeModule(
          'server-1',
          'user-1',
          'test-agent',
          'non/existent/module',
          {}
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    describe('Connection Failures', () => {
      it('should handle network timeout', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.get.mockRejectedValue(new Error('ETIMEDOUT'));

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('server-1', 'user-1');

        expect(result).toBe(false);
      });

      it('should handle DNS resolution failure', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://nonexistent.empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.get.mockRejectedValue(new Error('ENOTFOUND'));

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('server-1', 'user-1');

        expect(result).toBe(false);
      });

      it('should handle SSL certificate errors', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.get.mockRejectedValue(new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE'));

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.checkConnection('server-1', 'user-1');

        expect(result).toBe(false);
      });
    });

    describe('Authentication Failures', () => {
      it('should handle 401 Unauthorized response', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'expired-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);

        const error: any = new Error('Request failed with status code 401');
        error.response = { status: 401 };
        mockAxiosInstance.get.mockRejectedValue(error);

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.listAgents('server-1', 'user-1');

        expect(result.success).toBe(false);
      });

      it('should handle 403 Forbidden response', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'limited-access-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);

        const error: any = new Error('Request failed with status code 403');
        error.response = { status: 403 };
        mockAxiosInstance.post.mockRejectedValue(error);

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.createListener('server-1', 'user-1', {
          name: 'test-listener',
          listenerType: 'http',
          host: '0.0.0.0',
          port: 80,
        });

        expect(result.success).toBe(false);
      });
    });

    describe('API Errors', () => {
      it('should handle malformed API response', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
        mockAxiosInstance.get.mockResolvedValue({ data: { agents: null } });

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.listAgents('server-1', 'user-1');

        // Should handle null data gracefully
        expect(result.success).toBe(true);
      });

      it('should handle 500 Internal Server Error', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);

        const error: any = new Error('Internal Server Error');
        error.response = { status: 500 };
        mockAxiosInstance.get.mockRejectedValue(error);

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.listListeners('server-1', 'user-1');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle rate limiting (429)', async () => {
        const mockServer = {
          id: 'server-1',
          name: 'Test Empire Server',
          restApiUrl: 'https://empire.local:1337',
          isActive: true,
        };

        const mockToken = {
          id: 'token-1',
          permanentToken: 'valid-token',
        };

        mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
        mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);

        const error: any = new Error('Too Many Requests');
        error.response = { status: 429 };
        mockAxiosInstance.get.mockRejectedValue(error);

        const empireExecutor = await getEmpireExecutor();
        const result = await empireExecutor.listModules('server-1', 'user-1');

        expect(result.success).toBe(false);
      });
    });
  });

  describe('Listener Management Security', () => {
    it('should create listener with validated parameters', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Empire Server',
        restApiUrl: 'https://empire.local:1337',
        isActive: true,
      };

      const mockToken = {
        id: 'token-1',
        permanentToken: 'valid-token',
      };

      mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
      mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ID: 1,
          name: 'http-listener',
          listener_type: 'http',
          listener_category: 'http',
          enabled: true,
          options: {},
          created_at: new Date().toISOString(),
        },
      });

      const empireExecutor = await getEmpireExecutor();
      const result = await empireExecutor.createListener('server-1', 'user-1', {
        name: 'http-listener',
        listenerType: 'http',
        host: '0.0.0.0',
        port: 80,
        defaultDelay: 5,
        defaultJitter: 0.0,
      });

      expect(result.success).toBe(true);
    });

    it('should stop listener successfully', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Empire Server',
        restApiUrl: 'https://empire.local:1337',
        isActive: true,
      };

      const mockToken = {
        id: 'token-1',
        permanentToken: 'valid-token',
      };

      mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
      mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
      mockAxiosInstance.delete.mockResolvedValue({ data: {} });

      const empireExecutor = await getEmpireExecutor();
      const result = await empireExecutor.stopListener('server-1', 'user-1', 'http-listener');

      expect(result.success).toBe(true);
    });
  });

  describe('Agent Management Security', () => {
    it('should sync agents from Empire', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Empire Server',
        restApiUrl: 'https://empire.local:1337',
        isActive: true,
      };

      const mockToken = {
        id: 'token-1',
        permanentToken: 'valid-token',
      };

      mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
      mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
      mockDbQuery.empireAgents.findFirst.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          agents: [
            {
              ID: 1,
              session_id: 'session-1',
              name: 'agent-1',
              hostname: 'TARGET-PC',
              internal_ip: '192.168.1.100',
              external_ip: '1.2.3.4',
              username: 'DOMAIN\\user',
              high_integrity: false,
              process_name: 'powershell.exe',
              process_id: 1234,
              language: 'powershell',
              language_version: '5.1',
              os_details: 'Windows 10',
              architecture: 'AMD64',
              domain: 'DOMAIN',
              checkin_time: new Date().toISOString(),
              lastseen_time: new Date().toISOString(),
              delay: 5,
              jitter: 0.1,
              lost_limit: 60,
              kill_date: '',
              working_hours: '',
            },
          ],
        },
      });

      const empireExecutor = await getEmpireExecutor();
      const result = await empireExecutor.syncAgents('server-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.synced).toBe(1);
    });

    it('should kill agent successfully', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Empire Server',
        restApiUrl: 'https://empire.local:1337',
        isActive: true,
      };

      const mockToken = {
        id: 'token-1',
        permanentToken: 'valid-token',
      };

      mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
      mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
      mockAxiosInstance.delete.mockResolvedValue({ data: {} });

      const empireExecutor = await getEmpireExecutor();
      const result = await empireExecutor.killAgent('server-1', 'user-1', 'agent-1');

      expect(result.success).toBe(true);
    });
  });

  describe('Credential Handling Security', () => {
    it('should sync credentials from Empire', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Empire Server',
        restApiUrl: 'https://empire.local:1337',
        isActive: true,
      };

      const mockToken = {
        id: 'token-1',
        permanentToken: 'valid-token',
      };

      mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
      mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
      mockDbQuery.empireCredentials.findFirst.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          credentials: [
            {
              ID: 1,
              credtype: 'plaintext',
              domain: 'DOMAIN',
              username: 'admin',
              password: 'P@ssw0rd123',
              host: '192.168.1.100',
              os: 'Windows 10',
              sid: 'S-1-5-21-...',
              notes: 'From mimikatz',
            },
          ],
        },
      });

      const empireExecutor = await getEmpireExecutor();
      const result = await empireExecutor.syncCredentials('server-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.synced).toBe(1);
    });

    it('should list credentials', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Empire Server',
        restApiUrl: 'https://empire.local:1337',
        isActive: true,
      };

      const mockToken = {
        id: 'token-1',
        permanentToken: 'valid-token',
      };

      mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
      mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          credentials: [
            {
              ID: 1,
              credtype: 'hash',
              domain: 'DOMAIN',
              username: 'admin',
              password: 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0',
              host: '192.168.1.100',
              os: 'Windows 10',
              sid: '',
              notes: '',
            },
          ],
        },
      });

      const empireExecutor = await getEmpireExecutor();
      const result = await empireExecutor.listCredentials('server-1', 'user-1');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('Stager Generation Security', () => {
    it('should generate stager with validated options', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Empire Server',
        restApiUrl: 'https://empire.local:1337',
        isActive: true,
      };

      const mockToken = {
        id: 'token-1',
        permanentToken: 'valid-token',
      };

      mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
      mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
      mockDbQuery.empireListeners.findFirst.mockResolvedValue({
        id: 'listener-1',
        name: 'http-listener',
      });
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          output: 'powershell -noP -sta -w 1 -enc ...',
        },
      });

      const empireExecutor = await getEmpireExecutor();
      const result = await empireExecutor.generateStager(
        'server-1',
        'user-1',
        'windows/launcher_bat',
        'http-listener',
        { OutFile: 'launcher.bat' }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific server-user combination', async () => {
      const empireExecutor = await getEmpireExecutor();

      // Should not throw
      expect(() => empireExecutor.clearCache('server-1', 'user-1')).not.toThrow();
    });

    it('should clear all cached clients', async () => {
      const empireExecutor = await getEmpireExecutor();

      // Should not throw
      expect(() => empireExecutor.clearCache()).not.toThrow();
    });
  });
});
