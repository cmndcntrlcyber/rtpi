#!/usr/bin/env tsx
/**
 * Register Maldev Tools in Tool Registry
 * 
 * Registers the maldev container's reverse-engineering, ROP development,
 * and shellcode generation tools in the RTPI Tool Registry for discovery
 * and multi-container execution.
 */

import { db } from '../server/db';
import { toolRegistry } from '../shared/schema';
import { eq } from 'drizzle-orm';

const MALDEV_TOOLS = [
  // Binary Analysis Tools
  {
    toolId: 'radare2',
    name: 'radare2',
    category: 'reverse-engineering' as const,
    description: 'Advanced binary analysis framework with disassembler, debugger, and hex editor',
    binaryPath: '/usr/local/bin/r2',
    installMethod: 'github-source' as const,
    tags: ['reverse-engineering', 'binary-analysis', 'disassembler', 'maldev'],
  },
  {
    toolId: 'rabin2',
    name: 'rabin2',
    category: 'reverse-engineering' as const,
    description: 'Binary program info extractor (part of radare2)',
    binaryPath: '/usr/local/bin/rabin2',
    installMethod: 'github-source' as const,
    tags: ['binary-analysis', 'checksec', 'maldev'],
  },
  
  // ROP Development Tools
  {
    toolId: 'ropgadget',
    name: 'ROPgadget',
    category: 'exploitation' as const,
    description: 'ROP gadget finder and automatic ROP chain generator',
    binaryPath: '/opt/tools/ROPgadget/ROPgadget.py',
    installMethod: 'github-source' as const,
    tags: ['rop', 'gadgets', 'exploitation', 'maldev'],
  },
  {
    toolId: 'xgadget',
    name: 'xgadget',
    category: 'exploitation' as const,
    description: 'Fast ROP gadget finder written in Rust',
    binaryPath: '/home/rtpi-agent/.cargo/bin/xgadget',
    installMethod: 'cargo' as const,
    tags: ['rop', 'gadgets', 'rust', 'maldev'],
  },
  {
    toolId: 'ropper',
    name: 'Ropper',
    category: 'exploitation' as const,
    description: 'ROP gadget finder and ROP chain generator (Python)',
    binaryPath: '/usr/local/bin/ropper',
    installMethod: 'pip' as const,
    tags: ['rop', 'gadgets', 'python', 'maldev'],
  },
  
  // Python Security Libraries
  {
    toolId: 'pwntools',
    name: 'pwntools',
    category: 'exploitation' as const,
    description: 'CTF framework and exploit development library for Python',
    binaryPath: '/usr/bin/python3',
    installMethod: 'pip' as const,
    tags: ['exploitation', 'shellcode', 'rop', 'python', 'maldev'],
  },
  
  // Emulation & Analysis
  {
    toolId: 'unicorn-emu',
    name: 'Unicorn Engine',
    category: 'reverse-engineering' as const,
    description: 'Lightweight multi-architecture CPU emulator framework',
    binaryPath: '/usr/bin/python3',
    installMethod: 'pip' as const,
    tags: ['emulation', 'analysis', 'validation', 'maldev'],
  },
  {
    toolId: 'capstone',
    name: 'Capstone',
    category: 'reverse-engineering' as const,
    description: 'Multi-architecture disassembler framework',
    binaryPath: '/usr/bin/python3',
    installMethod: 'pip' as const,
    tags: ['disassembler', 'analysis', 'maldev'],
  },
  {
    toolId: 'keystone',
    name: 'Keystone',
    category: 'reverse-engineering' as const,
    description: 'Multi-architecture assembler framework',
    binaryPath: '/usr/bin/python3',
    installMethod: 'pip' as const,
    tags: ['assembler', 'shellcode', 'maldev'],
  },
  
  // Debuggers
  {
    toolId: 'gdb-multiarch',
    name: 'GDB Multi-Arch',
    category: 'reverse-engineering' as const,  // Use reverse-engineering for debuggers
    description: 'GNU Debugger with multi-architecture support',
    binaryPath: '/usr/bin/gdb-multiarch',
    installMethod: 'manual' as const,
    tags: ['debugger', 'analysis', 'maldev'],
  },
];

async function registerMaldevTools() {
  console.log('🔧 Registering Maldev Tools in Tool Registry\n');
  console.log('='.repeat(60));

  let registered = 0;
  let updated = 0;
  let  skipped = 0;

  for (const tool of MALDEV_TOOLS) {
    try {
      // Check if tool already exists
      const [existing] = await db
        .select()
        .from(toolRegistry)
        .where(eq(toolRegistry.toolId, tool.toolId))
        .limit(1);

      if (existing) {
        // Update existing entry
        await db
          .update(toolRegistry)
          .set({
            name: tool.name,
            category: tool.category,
            description: tool.description,
            binaryPath: tool.binaryPath,
            containerName: 'rtpi-maldev-agent',
            containerUser: 'rtpi-agent',
            installMethod: tool.installMethod,
            installStatus: 'installed',
            validationStatus: 'validated',
            tags: tool.tags,
            updatedAt: new Date(),
          })
          .where(eq(toolRegistry.toolId, tool.toolId));

        console.log(`✅ Updated: ${tool.name} (${tool.toolId})`);
        updated++;
      } else {
        // Insert new entry (cast to any to bypass strict typing)
        await db.insert(toolRegistry).values({
          toolId: tool.toolId,  // Add toolId field
          name: tool.name,
          category: tool.category,
          description: tool.description,
          binaryPath: tool.binaryPath,
          containerName: 'rtpi-maldev-agent',
          containerUser: 'rtpi-agent',
          installMethod: tool.installMethod,
          installStatus: 'installed',
          validationStatus: 'validated',
          tags: tool.tags,
        } as any);

        console.log(`🆕 Registered: ${tool.name} (${tool.toolId})`);
        registered++;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.log(`❌ Failed: ${tool.name} - ${err.message}`);
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Registration Summary');
  console.log('='.repeat(60));
  console.log(`
Total tools processed: ${MALDEV_TOOLS.length}
- 🆕 Newly registered: ${registered}
- ✅ Updated: ${updated}
- ❌ Skipped/Failed: ${skipped}

Tools are now available via:
- multiContainerExecutor.executeTool(toolId, args)
- Tool Registry queries
- Agent workflow orchestration
`);

  console.log('\n✅ Maldev Tool Registration Complete\n');
}

// Run registration
registerMaldevTools()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Registration failed:', error);
    process.exit(1);
  });
