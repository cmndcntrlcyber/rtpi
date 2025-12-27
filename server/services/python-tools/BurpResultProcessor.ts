/**
 * BurpResultProcessor - TypeScript Wrapper
 * Auto-generated from offsec-team Python tool
 *
 * Advanced BurpSuite scan result processor for security analysis.
    Provides result extraction, filtering, correlation, and transformation.
 */

import { spawn } from 'child_process';
import path from 'path';

export class BurpResultProcessorWrapper {
  private pythonPath: string;
  private _modulePath: string;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this._modulePath = path.join(
      process.cwd(),
      './tools/offsec-team/tools/burpsuite_operator/BurpResultProcessor.py'
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

from BurpResultProcessor import BurpResultProcessor

# Create instance
tool = BurpResultProcessor()

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
   * Filter findings based on specified criteria.
   */
  async filter_findings(findings: string, filter_criteria: string): Promise<any> {
    return this.executePythonMethod('filter_findings', {
      findings, filter_criteria
    });
  }

  /**
   * Export scan results to various formats.
   */
  async export_results_to_format(findings: string, export_format: string): Promise<any> {
    return this.executePythonMethod('export_results_to_format', {
      findings, export_format
    });
  }
}

/**
 * Create a new instance of the tool
 */
export function createBurpResultProcessor(): BurpResultProcessorWrapper {
  return new BurpResultProcessorWrapper();
}
