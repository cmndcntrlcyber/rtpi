#!/usr/bin/env tsx

/**
 * Kasm Workspace Load Testing Script
 *
 * Simulates multiple concurrent users provisioning and using workspaces
 * to test system performance under load.
 *
 * Usage:
 *   tsx scripts/load-test-kasm.ts [options]
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
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  private logError(message: string, verbose: boolean = false): void {
    if (!verbose || this.config.verbose) {
      console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
    }
  }
}

function printResults(results: LoadTestResults): void {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║    Load Test Results                                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('Test Overview:');
  console.log(`  Duration: ${Math.round(results.totalDuration)}s`);
  console.log(`  Concurrent Users: ${results.users}`);
  console.log(`  Total Workspaces: ${results.totalWorkspaces}`);
  console.log();

  console.log('Success Metrics:');
  console.log(`  Successful Provisions: ${results.successfulProvisions} (${((results.successfulProvisions / results.totalWorkspaces) * 100).toFixed(1)}%)`);
  console.log(`  Failed Provisions: ${results.failedProvisions} (${results.errorRate.toFixed(1)}%)`);
  console.log(`  Throughput: ${results.throughput.toFixed(2)} workspaces/minute`);
  console.log();

  console.log('Startup Time Metrics:');
  console.log(`  Average: ${(results.averageStartupTime / 1000).toFixed(2)}s`);
  console.log(`  Median: ${(results.medianStartupTime / 1000).toFixed(2)}s`);
  console.log(`  P95: ${(results.p95StartupTime / 1000).toFixed(2)}s`);
  console.log(`  Min: ${(results.minStartupTime / 1000).toFixed(2)}s`);
  console.log(`  Max: ${(results.maxStartupTime / 1000).toFixed(2)}s`);
  console.log();

  const targetCompliance = results.workspaceResults.filter(
    r => r.startupTime && r.startupTime < 60000
  ).length;
  const complianceRate = (targetCompliance / results.successfulProvisions) * 100;

  console.log('Performance Target (<60s):');
  console.log(`  Within Target: ${targetCompliance} (${complianceRate.toFixed(1)}%)`);
  console.log(`  Exceeding Target: ${results.successfulProvisions - targetCompliance}`);
  console.log();

  if (results.errors.length > 0) {
    console.log('Errors:');
    console.log(`  Total Errors: ${results.errors.length}`);
    if (results.config.verbose) {
      results.errors.slice(0, 10).forEach((error, i) => {
        console.log(`  ${i + 1}. [${error.userId}] ${error.error}`);
      });
      if (results.errors.length > 10) {
        console.log(`  ... and ${results.errors.length - 10} more`);
      }
    }
    console.log();
  }

  console.log('Recommendations:');
  if (results.errorRate > 10) {
    console.log('  ❌ High error rate (>10%) - investigate system capacity');
  } else if (results.errorRate > 5) {
    console.log('  ⚠️  Moderate error rate (>5%) - monitor system health');
  } else {
    console.log('  ✅ Low error rate (<5%) - system performing well');
  }

  if (results.averageStartupTime > 60000) {
    console.log('  ❌ Average startup time exceeds 60s target');
    console.log('     → Review performance optimization guide');
  } else {
    console.log('  ✅ Average startup time within 60s target');
  }

  if (results.throughput < 1) {
    console.log('  ⚠️  Low throughput (<1 workspace/min)');
    console.log('     → Consider scaling Kasm workers');
  }

  console.log();
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
    console.log(`Results exported to: ${config.export}`);
  }

  process.exit(results.errorRate < 10 ? 0 : 1);
}

main().catch(error => {
  console.error('Load test failed:', error);
  process.exit(1);
});
