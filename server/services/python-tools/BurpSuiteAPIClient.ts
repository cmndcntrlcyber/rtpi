/**
 * BurpSuiteAPIClient - TypeScript Wrapper
 * Auto-generated from offsec-team Python tool
 *
 * BurpSuite Professional API client for security scanning operations.
    Provides methods for scan management, extension control, and result retrieval.
 */

import { spawn } from 'child_process';
import path from 'path';

export class BurpSuiteAPIClientWrapper {
  private pythonPath: string;
  private _modulePath: string;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this._modulePath = path.join(
      process.cwd(),
      './tools/offsec-team/tools/burpsuite_operator/BurpSuiteAPIClient.py'
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

from BurpSuiteAPIClient import BurpSuiteAPIClient

# Create instance
tool = BurpSuiteAPIClient()

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
   * Get BurpSuite configuration settings.
   */
  async get_burp_configuration(): Promise<any> {
    return this.executePythonMethod('get_burp_configuration', {
      
    });
  }

  /**
   * Update BurpSuite configuration settings.
   */
  async update_burp_configuration(config_updates: string): Promise<any> {
    return this.executePythonMethod('update_burp_configuration', {
      config_updates
    });
  }

  /**
   * Get current BurpSuite project information.
   */
  async get_burp_project_info(): Promise<any> {
    return this.executePythonMethod('get_burp_project_info', {
      
    });
  }

  /**
   * Export BurpSuite project to file.
   */
  async export_burp_project(file_path: string): Promise<any> {
    return this.executePythonMethod('export_burp_project', {
      file_path
    });
  }
}

/**
 * Create a new instance of the tool
 */
export function createBurpSuiteAPIClient(): BurpSuiteAPIClientWrapper {
  return new BurpSuiteAPIClientWrapper();
}
