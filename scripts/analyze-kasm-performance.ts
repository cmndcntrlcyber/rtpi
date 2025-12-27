#!/usr/bin/env tsx

/**
 * Kasm Workspace Performance Analyzer
 *
 * Analyzes workspace startup times and generates performance reports
 * to help identify bottlenecks and optimization opportunities.
 *
 * Usage:
 *   tsx scripts/analyze-kasm-performance.ts [options]
 *
 * Options:
 *   --days <number>     Analyze workspaces from last N days (default: 7)
 *   --type <type>       Filter by workspace type
 *   --threshold <ms>    Highlight workspaces exceeding threshold (default: 60000)
 *   --export <file>     Export results to JSON file
 *   --verbose           Show detailed breakdown for each workspace
 */

import { db } from '../server/db';
import { kasmWorkspaces } from '@shared/schema';
import { gte, and, isNotNull } from 'drizzle-orm';

interface PerformanceMetrics {
  provisioningStartedAt?: string;
  quotaCheckDurationMs?: number;
  sessionCreateDurationMs?: number;
  startupCompletedAt?: string;
  totalStartupTimeMs?: number;
  monitoringDurationMs?: number;
  statusCheckAttempts?: number;
  averageStatusCheckDurationMs?: number;
  totalStatusCheckDurationMs?: number;
  failedAt?: string;
  totalTimeBeforeFailureMs?: number;
  failureReason?: string;
}

interface WorkspacePerformanceData {
  id: string;
  workspaceType: string;
  workspaceName: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  performance: PerformanceMetrics;
}

interface PerformanceStats {
  totalWorkspaces: number;
  successfulStarts: number;
  failedStarts: number;
  averageStartupTime: number;
  medianStartupTime: number;
  p95StartupTime: number;
  p99StartupTime: number;
  fastestStartup: number;
  slowestStartup: number;
  withinTarget: number;
  exceedingTarget: number;
  averageQuotaCheck: number;
  averageSessionCreate: number;
  averageMonitoring: number;
  byWorkspaceType: Record<string, {
    count: number;
    averageStartupTime: number;
    successRate: number;
  }>;
  bottlenecks: Array<{
    phase: string;
    averageDuration: number;
    percentageOfTotal: number;
  }>;
}

const TARGET_STARTUP_TIME_MS = 60000; // 60 seconds

async function fetchWorkspacePerformanceData(
  days: number,
  workspaceType?: string
): Promise<WorkspacePerformanceData[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const conditions = [
    gte(kasmWorkspaces.createdAt, cutoffDate),
    isNotNull(kasmWorkspaces.metadata),
  ];

  if (workspaceType) {
    conditions.push(
    kasmWorkspaces.workspaceType as any === workspaceType
    );
  }

  const workspaces = await db
    .select()
    .from(kasmWorkspaces)
    .where(and(...conditions));

  return workspaces.map(ws => ({
    id: ws.id,
    workspaceType: ws.workspaceType,
    workspaceName: ws.workspaceName || `${ws.workspaceType}-workspace`,
    status: ws.status,
    createdAt: ws.createdAt,
    startedAt: ws.startedAt,
    performance: (ws.metadata as any)?.performance || {},
  }));
}

function calculateStats(data: WorkspacePerformanceData[]): PerformanceStats {
  const successful = data.filter(w => w.status === 'running' && w.performance.totalStartupTimeMs);
  const failed = data.filter(w => w.status === 'failed');

  const startupTimes = successful
    .map(w => w.performance.totalStartupTimeMs!)
    .filter(t => t > 0)
    .sort((a, b) => a - b);

  const quotaCheckTimes = successful
    .map(w => w.performance.quotaCheckDurationMs || 0)
    .filter(t => t > 0);

  const sessionCreateTimes = successful
    .map(w => w.performance.sessionCreateDurationMs || 0)
    .filter(t => t > 0);

  const monitoringTimes = successful
    .map(w => w.performance.monitoringDurationMs || 0)
    .filter(t => t > 0);

  const average = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };

  // Calculate by workspace type
  const byWorkspaceType: Record<string, { count: number; averageStartupTime: number; successRate: number }> = {};
  const typeGroups = data.reduce((acc, w) => {
    if (!acc[w.workspaceType]) acc[w.workspaceType] = [];
    acc[w.workspaceType].push(w);
    return acc;
  }, {} as Record<string, WorkspacePerformanceData[]>);

  for (const [type, workspaces] of Object.entries(typeGroups)) {
    const typeSuccessful = workspaces.filter(w => w.status === 'running');
    const typeTimes = typeSuccessful
      .map(w => w.performance.totalStartupTimeMs!)
      .filter(t => t > 0);

    byWorkspaceType[type] = {
      count: workspaces.length,
      averageStartupTime: average(typeTimes),
      successRate: (typeSuccessful.length / workspaces.length) * 100,
    };
  }

  // Identify bottlenecks
  const avgQuota = average(quotaCheckTimes);
  const avgSession = average(sessionCreateTimes);
  const avgMonitoring = average(monitoringTimes);
  const avgTotal = average(startupTimes);

  const bottlenecks = [
    { phase: 'Quota Check', averageDuration: avgQuota, percentageOfTotal: (avgQuota / avgTotal) * 100 },
    { phase: 'Session Creation', averageDuration: avgSession, percentageOfTotal: (avgSession / avgTotal) * 100 },
    { phase: 'Monitoring', averageDuration: avgMonitoring, percentageOfTotal: (avgMonitoring / avgTotal) * 100 },
  ].sort((a, b) => b.averageDuration - a.averageDuration);

  return {
    totalWorkspaces: data.length,
    successfulStarts: successful.length,
    failedStarts: failed.length,
    averageStartupTime: average(startupTimes),
    medianStartupTime: percentile(startupTimes, 50),
    p95StartupTime: percentile(startupTimes, 95),
    p99StartupTime: percentile(startupTimes, 99),
    fastestStartup: startupTimes.length > 0 ? startupTimes[0] : 0,
    slowestStartup: startupTimes.length > 0 ? startupTimes[startupTimes.length - 1] : 0,
    withinTarget: startupTimes.filter(t => t <= TARGET_STARTUP_TIME_MS).length,
    exceedingTarget: startupTimes.filter(t => t > TARGET_STARTUP_TIME_MS).length,
    averageQuotaCheck: avgQuota,
    averageSessionCreate: avgSession,
    averageMonitoring: avgMonitoring,
    byWorkspaceType,
    bottlenecks,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printReport(stats: PerformanceStats, verbose = false) {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Kasm Workspace Performance Analysis Report             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📊 OVERVIEW');
  console.log('─'.repeat(60));
  console.log(`Total Workspaces Analyzed:    ${stats.totalWorkspaces}`);
  console.log(`Successful Starts:            ${stats.successfulStarts} (${((stats.successfulStarts / stats.totalWorkspaces) * 100).toFixed(1)}%)`);
  console.log(`Failed Starts:                ${stats.failedStarts} (${((stats.failedStarts / stats.totalWorkspaces) * 100).toFixed(1)}%)`);
  console.log();

  console.log('⏱️  STARTUP TIME METRICS');
  console.log('─'.repeat(60));
  console.log(`Average Startup Time:         ${formatDuration(stats.averageStartupTime)}`);
  console.log(`Median Startup Time:          ${formatDuration(stats.medianStartupTime)}`);
  console.log(`95th Percentile:              ${formatDuration(stats.p95StartupTime)}`);
  console.log(`99th Percentile:              ${formatDuration(stats.p99StartupTime)}`);
  console.log(`Fastest Startup:              ${formatDuration(stats.fastestStartup)}`);
  console.log(`Slowest Startup:              ${formatDuration(stats.slowestStartup)}`);
  console.log();

  console.log('🎯 TARGET PERFORMANCE (< 60s)');
  console.log('─'.repeat(60));
  const targetPercentage = (stats.withinTarget / stats.successfulStarts) * 100;
  const targetEmoji = targetPercentage >= 90 ? '✅' : targetPercentage >= 70 ? '⚠️' : '❌';
  console.log(`Within Target:                ${stats.withinTarget} (${targetPercentage.toFixed(1)}%) ${targetEmoji}`);
  console.log(`Exceeding Target:             ${stats.exceedingTarget} (${((stats.exceedingTarget / stats.successfulStarts) * 100).toFixed(1)}%)`);
  console.log();

  console.log('🔍 PHASE BREAKDOWN');
  console.log('─'.repeat(60));
  console.log(`Average Quota Check:          ${formatDuration(stats.averageQuotaCheck)}`);
  console.log(`Average Session Creation:     ${formatDuration(stats.averageSessionCreate)}`);
  console.log(`Average Monitoring:           ${formatDuration(stats.averageMonitoring)}`);
  console.log();

  console.log('🚧 BOTTLENECK ANALYSIS');
  console.log('─'.repeat(60));
  stats.bottlenecks.forEach((bottleneck, index) => {
    const indicator = index === 0 ? '🔴' : index === 1 ? '🟡' : '🟢';
    console.log(
      `${indicator} ${bottleneck.phase.padEnd(20)} ${formatDuration(bottleneck.averageDuration).padEnd(12)} ` +
      `(${bottleneck.percentageOfTotal.toFixed(1)}% of total)`
    );
  });
  console.log();

  console.log('📈 BY WORKSPACE TYPE');
  console.log('─'.repeat(60));
  Object.entries(stats.byWorkspaceType).forEach(([type, data]) => {
    const successEmoji = data.successRate >= 95 ? '✅' : data.successRate >= 80 ? '⚠️' : '❌';
    console.log(
      `${type.padEnd(15)} Count: ${String(data.count).padEnd(4)} ` +
      `Avg: ${formatDuration(data.averageStartupTime).padEnd(10)} ` +
      `Success: ${data.successRate.toFixed(1)}% ${successEmoji}`
    );
  });
  console.log();

  console.log('💡 RECOMMENDATIONS');
  console.log('─'.repeat(60));

  if (stats.averageStartupTime > TARGET_STARTUP_TIME_MS) {
    console.log('❌ Average startup time exceeds 60s target');
    console.log('   → Focus on optimizing the slowest phase:');
    console.log(`   → ${stats.bottlenecks[0].phase} (${formatDuration(stats.bottlenecks[0].averageDuration)})`);
  } else {
    console.log('✅ Average startup time within 60s target');
  }

  if (stats.exceedingTarget > stats.withinTarget) {
    console.log('❌ More workspaces exceed target than meet it');
    console.log('   → Consider image optimization and caching strategies');
  }

  if (stats.averageSessionCreate > 30000) {
    console.log('⚠️  Session creation is slow (>30s)');
    console.log('   → Optimize Docker image sizes');
    console.log('   → Use image layer caching');
    console.log('   → Pre-pull images on Kasm workers');
  }

  if (stats.failedStarts > stats.successfulStarts * 0.1) {
    console.log('⚠️  High failure rate (>10%)');
    console.log('   → Review Kasm server resources');
    console.log('   → Check Docker daemon health');
    console.log('   → Verify network connectivity');
  }

  console.log();
  console.log('─'.repeat(60));
  console.log(`Analysis completed: ${new Date().toLocaleString()}`);
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    days: 7,
    type: undefined as string | undefined,
    threshold: TARGET_STARTUP_TIME_MS,
    export: undefined as string | undefined,
    verbose: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      options.days = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--type' && args[i + 1]) {
      options.type = args[i + 1];
      i++;
    } else if (args[i] === '--threshold' && args[i + 1]) {
      options.threshold = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--export' && args[i + 1]) {
      options.export = args[i + 1];
      i++;
    } else if (args[i] === '--verbose') {
      options.verbose = true;
    }
  }

  console.log(`\nFetching workspace data from last ${options.days} days...`);
  if (options.type) {
    console.log(`Filtering by type: ${options.type}`);
  }

  const data = await fetchWorkspacePerformanceData(options.days, options.type);

  if (data.length === 0) {
    console.log('\n⚠️  No workspace data found for the specified period.\n');
    return;
  }

  const stats = calculateStats(data);
  printReport(stats, options.verbose);

  if (options.verbose) {
    console.log('\n📝 DETAILED WORKSPACE BREAKDOWN');
    console.log('─'.repeat(60));
    data
      .filter(w => w.performance.totalStartupTimeMs)
      .sort((a, b) => (b.performance.totalStartupTimeMs || 0) - (a.performance.totalStartupTimeMs || 0))
      .slice(0, 10)
      .forEach((workspace, index) => {
        const time = workspace.performance.totalStartupTimeMs!;
        const indicator = time > options.threshold ? '❌' : '✅';
        console.log(
          `${indicator} ${(index + 1).toString().padStart(2)}. ${workspace.workspaceName.padEnd(30)} ` +
          `${formatDuration(time).padEnd(10)} ${workspace.workspaceType}`
        );
      });
    console.log();
  }

  if (options.export) {
    const fs = await import('fs');
    const exportData = {
      generatedAt: new Date().toISOString(),
      options,
      stats,
      workspaces: data.map(w => ({
        id: w.id,
        type: w.workspaceType,
        name: w.workspaceName,
        status: w.status,
        createdAt: w.createdAt,
        startedAt: w.startedAt,
        performance: w.performance,
      })),
    };

    fs.writeFileSync(options.export, JSON.stringify(exportData, null, 2));
    console.log(`✅ Results exported to: ${options.export}\n`);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Error analyzing performance:', error);
  process.exit(1);
});
