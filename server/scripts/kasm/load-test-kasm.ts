#!/usr/bin/env tsx

/**
 * Kasm Workspace Load Testing Script
 *
 * Simulates multiple concurrent users provisioning and using workspaces
 * to test system performance under load.
 *
 * Usage:
 *   tsx server/scripts/kasm/load-test-kasm.ts [options]
 *
 * Options:
 *   --users <number>        Number of concurrent users (default: 10)
 *   --workspaces <number>   Workspaces per user (default: 2)
 *   --duration <minutes>    Test duration in minutes (default: 30)
 *   --ramp-up <minutes>     Ramp-up time in minutes (default: 5)
 *   --api-url <url>         API base URL (default: http://localhost:3001)
 *   --export <file>         Export results to JSON file
 *   --verbose               Show detailed logs
 */

import axios, { AxiosInstance } from 'axios';
import { performance } from 'perf_hooks';
import { createLogger } from '../../lib/logger';
const log = createLogger("load-test-kasm");

interface LoadTestConfig {
  users: number;
  workspacesPerUser: number;
  durationMinutes: number;
  rampUpMinutes: number;
  apiUrl: string;
  export?: string;
  verbose: boolean;
}

interface UserSession {
  userId: string;
  username: string;
  token: string;
  client: AxiosInstance;
}

interface WorkspaceResult {
  userId: string;
  workspaceId: string;
  workspaceType: string;
  provisionStartTime: number;
  provisionEndTime?: number;
  startupTime?: number;
  status: 'provisioning' | 'starting' | 'running' | 'failed';
  errorMessage?: string;
}

interface LoadTestResults {
  config: LoadTestConfig;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  users: number;
  totalWorkspaces: number;
  successfulProvisions: number;
  failedProvisions: number;
  averageStartupTime: number;
  medianStartupTime: number;
  p95StartupTime: number;
  maxStartupTime: number;
  minStartupTime: number;
  throughput: number; // Workspaces per minute
  errorRate: number; // Percentage
  workspaceResults: WorkspaceResult[];
  errors: Array<{
    timestamp: Date;
    userId: string;
    error: string;
  }>;
}

const WORKSPACE_TYPES = ['vscode', 'firefox', 'kali'];

class LoadTester {
  private config: LoadTestConfig;
  private sessions: UserSession[] = [];
  private workspaceResults: WorkspaceResult[] = [];
  private errors: Array<{ timestamp: Date; userId: string; error: string }> = [];
  private startTime?: Date;
  private endTime?: Date;

  constructor(config: LoadTestConfig) {
    this.config = config;
  }

  /**
   * Create test users and authenticate
   */
  private async createTestUsers(): Promise<void> {
    this.log(`Creating ${this.config.users} test users...`);

    for (let i = 0; i < this.config.users; i++) {
      const username = `loadtest-user-${i}-${Date.now()}`;
      const password = 'LoadTest123!@#';

      try {
        // Register user
        await axios.post(`${this.config.apiUrl}/api/v1/auth/register`, {
          username,
          password,
          email: `${username}@loadtest.local`,
        });

        // Login
        const loginResponse = await axios.post(
          `${this.config.apiUrl}/api/v1/auth/login`,
          { username, password },
          { withCredentials: true }
        );

        const token = loginResponse.data.token;
        const userId = loginResponse.data.user.id;

        // Create axios client with auth
        const client = axios.create({
          baseURL: this.config.apiUrl,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        });

        this.sessions.push({
          userId,
          username,
          token,
          client,
        });

        this.log(`Created user: ${username}`, true);
      } catch (error: any) {
        this.logError(`Failed to create user ${username}: ${error.message}`);
        this.errors.push({
          timestamp: new Date(),
          userId: 'setup',
          error: `Failed to create user ${username}: ${error.message}`,
        });
      }
    }

    this.log(`Successfully created ${this.sessions.length} users`);
  }

  /**
   * Provision a workspace for a user
   */
  private async provisionWorkspace(session: UserSession): Promise<WorkspaceResult> {
    const workspaceType = WORKSPACE_TYPES[Math.floor(Math.random() * WORKSPACE_TYPES.length)];
    const provisionStartTime = performance.now();

    const result: WorkspaceResult = {
      userId: session.userId,
      workspaceId: '',
      workspaceType,
      provisionStartTime,
      status: 'provisioning',
    };

    try {
      // Provision workspace
      const response = await session.client.post('/api/v1/kasm-workspaces', {
        workspaceType,
        workspaceName: `loadtest-${workspaceType}-${Date.now()}`,
        cpuLimit: '2',
        memoryLimit: '4096M',
      });

      result.workspaceId = response.data.id;
      result.status = 'starting';

      this.log(`Provisioned ${workspaceType} workspace for ${session.username}`, true);

      // Monitor startup
      const startupSuccess = await this.monitorWorkspaceStartup(session, result.workspaceId);

      if (startupSuccess) {
        result.provisionEndTime = performance.now();
        result.startupTime = result.provisionEndTime - result.provisionStartTime;
        result.status = 'running';
        this.log(
          `Workspace ${result.workspaceId} started in ${Math.round(result.startupTime)}ms`,
          true
        );
      } else {
        result.status = 'failed';
        result.errorMessage = 'Startup timeout';
        this.logError(`Workspace ${result.workspaceId} failed to start`);
      }
    } catch (error: any) {
      result.status = 'failed';
      result.errorMessage = error.message;
      this.logError(`Failed to provision workspace for ${session.username}: ${error.message}`);
      this.errors.push({
        timestamp: new Date(),
        userId: session.userId,
        error: `Provision failed: ${error.message}`,
      });
    }

    this.workspaceResults.push(result);
    return result;
  }

  /**
   * Monitor workspace startup until running or timeout
   */
  private async monitorWorkspaceStartup(
    session: UserSession,
    workspaceId: string,
    timeout: number = 120000
  ): Promise<boolean> {
    const startTime = performance.now();

    while (performance.now() - startTime < timeout) {
      try {
        const response = await session.client.get(`/api/v1/kasm-workspaces/${workspaceId}`);
        const status = response.data.status;

        if (status === 'running') {
          return true;
        } else if (status === 'failed' || status === 'error') {
          return false;
        }

        // Wait 3 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error: any) {
        this.logError(`Error checking workspace status: ${error.message}`, true);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return false; // Timeout
  }

  /**
   * Simulate user activity for duration
   */
  private async simulateUserActivity(session: UserSession, durationMs: number): Promise<void> {
    const endTime = Date.now() + durationMs;

    // Provision initial workspaces
    const provisionPromises: Promise<WorkspaceResult>[] = [];
    for (let i = 0; i < this.config.workspacesPerUser; i++) {
      provisionPromises.push(this.provisionWorkspace(session));
      // Stagger provisions to avoid thundering herd
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await Promise.all(provisionPromises);

    // Keep workspaces alive with periodic activity
    while (Date.now() < endTime) {
      try {
        // List workspaces
        await session.client.get('/api/v1/kasm-workspaces');

        // Check resource usage
        await session.client.get('/api/v1/kasm-workspaces/resources');

        // Wait 30 seconds before next activity
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error: any) {
        this.logError(`Activity error for ${session.username}: ${error.message}`, true);
      }
    }

    // Cleanup - terminate workspaces
    try {
      const response = await session.client.get('/api/v1/kasm-workspaces');
      const workspaces = response.data;

      for (const workspace of workspaces) {
        try {
          await session.client.delete(`/api/v1/kasm-workspaces/${workspace.id}`);
          this.log(`Terminated workspace ${workspace.id}`, true);
        } catch (error: any) {
          this.logError(`Failed to terminate workspace ${workspace.id}: ${error.message}`, true);
        }
      }
    } catch (error: any) {
      this.logError(`Cleanup error for ${session.username}: ${error.message}`);
    }
  }

  /**
   * Run load test
   */
  async run(): Promise<LoadTestResults> {
    this.log('╔══════════════════════════════════════════════════════╗');
    this.log('║    Kasm Workspace Load Test                         ║');
    this.log('╚══════════════════════════════════════════════════════╝');
    this.log('');
    this.log(`Configuration:`);
    this.log(`  Users: ${this.config.users}`);
    this.log(`  Workspaces per user: ${this.config.workspacesPerUser}`);
    this.log(`  Duration: ${this.config.durationMinutes} minutes`);
    this.log(`  Ramp-up: ${this.config.rampUpMinutes} minutes`);
    this.log('');

    this.startTime = new Date();

    // Create test users
    await this.createTestUsers();

    if (this.sessions.length === 0) {
      throw new Error('No test users created, aborting load test');
    }

    // Ramp up users
    this.log(`Starting ramp-up period (${this.config.rampUpMinutes} minutes)...`);
    const rampUpDelayMs =
      (this.config.rampUpMinutes * 60 * 1000) / this.sessions.length;
    const testDurationMs = this.config.durationMinutes * 60 * 1000;

    const userPromises: Promise<void>[] = [];

    for (let i = 0; i < this.sessions.length; i++) {
      const session = this.sessions[i];

      // Start user activity with ramp-up delay
      setTimeout(() => {
        userPromises.push(this.simulateUserActivity(session, testDurationMs));
      }, i * rampUpDelayMs);
    }

    // Wait for all users to complete
    this.log('All users ramped up, test in progress...');
    await Promise.all(userPromises);

    this.endTime = new Date();
    this.log('Load test completed!');

    // Calculate results
    return this.calculateResults();
  }

  /**
   * Calculate and return test results
   */
  private calculateResults(): LoadTestResults {
    const successful = this.workspaceResults.filter(
      r => r.status === 'running' && r.startupTime
    );
    const failed = this.workspaceResults.filter(r => r.status === 'failed');

    const startupTimes = successful
      .map(r => r.startupTime!)
      .filter(t => t > 0)
      .sort((a, b) => a - b);

    const average = startupTimes.length > 0
      ? startupTimes.reduce((a, b) => a + b, 0) / startupTimes.length
      : 0;

    const median = startupTimes.length > 0
      ? startupTimes[Math.floor(startupTimes.length / 2)]
      : 0;

    const p95Index = Math.floor(startupTimes.length * 0.95);
    const p95 = startupTimes.length > 0 ? startupTimes[p95Index] : 0;

    const totalDuration =
      this.endTime && this.startTime
        ? (this.endTime.getTime() - this.startTime.getTime()) / 1000
        : 0;

    const throughput = successful.length / (totalDuration / 60); // Per minute

    return {
      config: this.config,
      startTime: this.startTime!,
      endTime: this.endTime!,
      totalDuration,
      users: this.sessions.length,
      totalWorkspaces: this.workspaceResults.length,
      successfulProvisions: successful.length,
      failedProvisions: failed.length,
      averageStartupTime: average,
      medianStartupTime: median,
      p95StartupTime: p95,
      maxStartupTime: startupTimes.length > 0 ? startupTimes[startupTimes.length - 1] : 0,
      minStartupTime: startupTimes.length > 0 ? startupTimes[0] : 0,
      throughput,
      errorRate: (failed.length / this.workspaceResults.length) * 100,
      workspaceResults: this.workspaceResults,
      errors: this.errors,
    };
  }

  private log(message: string, verbose: boolean = false): void {
    if (!verbose || this.config.verbose) {
      log.info(`[${new Date().toISOString()}] ${message}`);
    }
  }

  private logError(message: string, verbose: boolean = false): void {
    if (!verbose || this.config.verbose) {
      log.error(`[${new Date().toISOString()}] ERROR: ${message}`);
    }
  }
}

function printResults(results: LoadTestResults): void {
  log.info('\n╔══════════════════════════════════════════════════════╗');
  log.info('║    Load Test Results                                 ║');
  log.info('╚══════════════════════════════════════════════════════╝\n');

  log.info('Test Overview:');
  log.info(`  Duration: ${Math.round(results.totalDuration)}s`);
  log.info(`  Concurrent Users: ${results.users}`);
  log.info(`  Total Workspaces: ${results.totalWorkspaces}`);
  log.info();

  log.info('Success Metrics:');
  log.info(`  Successful Provisions: ${results.successfulProvisions} (${((results.successfulProvisions / results.totalWorkspaces) * 100).toFixed(1)}%)`);
  log.info(`  Failed Provisions: ${results.failedProvisions} (${results.errorRate.toFixed(1)}%)`);
  log.info(`  Throughput: ${results.throughput.toFixed(2)} workspaces/minute`);
  log.info();

  log.info('Startup Time Metrics:');
  log.info(`  Average: ${(results.averageStartupTime / 1000).toFixed(2)}s`);
  log.info(`  Median: ${(results.medianStartupTime / 1000).toFixed(2)}s`);
  log.info(`  P95: ${(results.p95StartupTime / 1000).toFixed(2)}s`);
  log.info(`  Min: ${(results.minStartupTime / 1000).toFixed(2)}s`);
  log.info(`  Max: ${(results.maxStartupTime / 1000).toFixed(2)}s`);
  log.info();

  const targetCompliance = results.workspaceResults.filter(
    r => r.startupTime && r.startupTime < 60000
  ).length;
  const complianceRate = (targetCompliance / results.successfulProvisions) * 100;

  log.info('Performance Target (<60s):');
  log.info(`  Within Target: ${targetCompliance} (${complianceRate.toFixed(1)}%)`);
  log.info(`  Exceeding Target: ${results.successfulProvisions - targetCompliance}`);
  log.info();

  if (results.errors.length > 0) {
    log.info('Errors:');
    log.info(`  Total Errors: ${results.errors.length}`);
    if (results.config.verbose) {
      results.errors.slice(0, 10).forEach((error, i) => {
        log.info(`  ${i + 1}. [${error.userId}] ${error.error}`);
      });
      if (results.errors.length > 10) {
        log.info(`  ... and ${results.errors.length - 10} more`);
      }
    }
    log.info();
  }

  log.info('Recommendations:');
  if (results.errorRate > 10) {
    log.info('  ❌ High error rate (>10%) - investigate system capacity');
  } else if (results.errorRate > 5) {
    log.info('  ⚠️  Moderate error rate (>5%) - monitor system health');
  } else {
    log.info('  ✅ Low error rate (<5%) - system performing well');
  }

  if (results.averageStartupTime > 60000) {
    log.info('  ❌ Average startup time exceeds 60s target');
    log.info('     → Review performance optimization guide');
  } else {
    log.info('  ✅ Average startup time within 60s target');
  }

  if (results.throughput < 1) {
    log.info('  ⚠️  Low throughput (<1 workspace/min)');
    log.info('     → Consider scaling Kasm workers');
  }

  log.info();
}

async function main() {
  const args = process.argv.slice(2);
  const config: LoadTestConfig = {
    users: 10,
    workspacesPerUser: 2,
    durationMinutes: 30,
    rampUpMinutes: 5,
    apiUrl: process.env.API_URL || 'http://localhost:3001',
    verbose: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--users' && args[i + 1]) {
      config.users = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--workspaces' && args[i + 1]) {
      config.workspacesPerUser = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--duration' && args[i + 1]) {
      config.durationMinutes = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--ramp-up' && args[i + 1]) {
      config.rampUpMinutes = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--api-url' && args[i + 1]) {
      config.apiUrl = args[i + 1];
      i++;
    } else if (args[i] === '--export' && args[i + 1]) {
      config.export = args[i + 1];
      i++;
    } else if (args[i] === '--verbose') {
      config.verbose = true;
    }
  }

  const loadTester = new LoadTester(config);
  const results = await loadTester.run();

  printResults(results);

  if (config.export) {
    const fs = await import('fs');
    fs.writeFileSync(config.export, JSON.stringify(results, null, 2));
    log.info(`Results exported to: ${config.export}`);
  }

  process.exit(results.errorRate < 10 ? 0 : 1);
}

main().catch(error => {
  log.error('Load test failed:', error);
  process.exit(1);
});
