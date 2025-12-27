/**
 * BurpScanOrchestrator - TypeScript Wrapper
 * Auto-generated from offsec-team Python tool
 *
 * Advanced BurpSuite scan orchestrator for automated security testing.
    Provides scan configuration, scheduling, and management capabilities.
 */

import { spawn } from 'child_process';
import path from 'path';

export class BurpScanOrchestratorWrapper {
  private pythonPath: string;
  private _modulePath: string;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this._modulePath = path.join(
      process.cwd(),
      './tools/offsec-team/tools/burpsuite_operator/BurpScanOrchestrator.py'
    );
  }

  /**
   * Execute a Python method with parameters
   */
  private async executePythonMethod(
    methodName: string,
    params: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import sys
import json
sys.path.append('/home/cmndcntrl/rtpi/tools/offsec-team/tools/burpsuite_operator')

from BurpScanOrchestrator import BurpScanOrchestrator

# Create instance
tool = BurpScanOrchestrator()

# Call method
result = tool.${methodName}(**json.loads(sys.argv[1]))

# Return result as JSON
print(json.dumps(result))
`;

      const proc = spawn(this.pythonPath, ['-c', pythonScript, JSON.stringify(params)], {
        stdio: 'pipe',
      });

      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse output: ${output}`));
          }
        } else {
          reject(new Error(`Python execution failed: ${errorOutput || output}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Schedule a scan to run at a specific time.
   */
  async schedule_scan(scan_config_id: string, schedule_time: string, recurring: boolean): Promise<any> {
    return this.executePythonMethod('schedule_scan', {
      scan_config_id, schedule_time, recurring
    });
  }

  /**
   * Stop a running scan.
   */
  async stop_scan(scan_id: string): Promise<any> {
    return this.executePythonMethod('stop_scan', {
      scan_id
    });
  }

  /**
   * Get the status of all scans in the queue.
   */
  async get_scan_queue_status(): Promise<any> {
    return this.executePythonMethod('get_scan_queue_status', {
      
    });
  }

  /**
   * Clean up completed scans older than specified days.
   */
  async cleanup_completed_scans(older_than_days: number): Promise<any> {
    return this.executePythonMethod('cleanup_completed_scans', {
      older_than_days
    });
  }
}

/**
 * Create a new instance of the tool
 */
export function createBurpScanOrchestrator(): BurpScanOrchestratorWrapper {
  return new BurpScanOrchestratorWrapper();
}
