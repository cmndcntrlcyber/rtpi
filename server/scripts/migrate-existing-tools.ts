/**
 * Migration script to register existing tools (Nmap, Metasploit, BBOT) in the new tool framework
 * Run with: npx tsx scripts/migrate-existing-tools.ts
 */

import { registerTool } from '../services/tool-registry-manager';
import type { ToolConfiguration } from '../../shared/types/tool-config';

/**
 * Nmap Configuration
 */
const nmapConfig: ToolConfiguration = {
  toolId: 'nmap',
  name: 'Nmap',
  version: '7.94',
  category: 'reconnaissance',
  description: 'Network Mapper - Network discovery and security auditing tool',
  installMethod: 'docker',
  dockerImage: 'rtpi-tools',
  binaryPath: '/usr/bin/nmap',
  baseCommand: 'sudo nmap',
  workingDirectory: '/tmp',
  parameters: [
    {
      name: 'target',
      type: 'string',
      description: 'Target IP address, hostname, or CIDR range',
      required: true,
      placeholder: '192.168.1.0/24',
      helpText: 'Can be IP, hostname, IP range, or CIDR notation',
    },
    {
      name: 'Pn',
      type: 'boolean',
      description: 'Skip host discovery (treat all hosts as online)',
      required: false,
      defaultValue: true,
      helpText: 'Useful when hosts block ping probes',
    },
    {
      name: 'sV',
      type: 'boolean',
      description: 'Version detection - probe open ports to determine service/version info',
      required: false,
      defaultValue: true,
      helpText: 'Enables service and version detection',
    },
    {
      name: 'p',
      type: 'string',
      description: 'Port specification',
      required: false,
      defaultValue: '1-65535',
      placeholder: '1-65535 or 80,443,8080',
      helpText: 'Specify ports to scan (range or comma-separated list)',
    },
    {
      name: 'T',
      type: 'enum',
      description: 'Timing template (0=paranoid, 5=insane)',
      required: false,
      defaultValue: '4',
      enumValues: ['0', '1', '2', '3', '4', '5'],
      helpText: 'Higher values = faster but less stealthy scans',
    },
    {
      name: 'v',
      type: 'number',
      description: 'Verbosity level (0-10)',
      required: false,
      defaultValue: 5,
      helpText: 'Higher values provide more detailed output',
    },
    {
      name: 'oX',
      type: 'string',
      description: 'Output to XML file',
      required: false,
      placeholder: '/tmp/nmap-scan.xml',
      helpText: 'Save scan results in XML format',
    },
  ],
  outputParser: {
    parserName: 'nmap-xml-parser',
    parserType: 'xml',
    outputFormat: 'nmap-xml',
    xmlPaths: {
      hosts: '//host',
      ports: '//port',
      services: '//service',
    },
  },
  tests: [
    {
      testType: 'execution',
      testCommand: '--version',
      expectedExitCode: 0,
      expectedOutput: 'Nmap version',
      timeout: 5000,
    },
    {
      testType: 'execution',
      testCommand: '-sn 127.0.0.1',
      expectedExitCode: 0,
      timeout: 10000,
    },
  ],
  healthCheckCommand: '--version',
  tags: ['scanner', 'network', 'reconnaissance', 'port-scanning'],
  notes: 'Nmap is the industry standard for network discovery and security auditing',
  homepage: 'https://nmap.org',
  documentation: 'https://nmap.org/book/man.html',
};

/**
 * Metasploit Framework Configuration
 */
const metasploitConfig: ToolConfiguration = {
  toolId: 'metasploit',
  name: 'Metasploit Framework',
  version: '6.3.0',
  category: 'exploitation',
  description: 'Penetration testing framework for exploit development and execution',
  installMethod: 'docker',
  dockerImage: 'rtpi-tools',
  binaryPath: '/usr/bin/msfconsole',
  baseCommand: 'msfconsole -q -x',
  workingDirectory: '/root/.msf4',
  parameters: [
    {
      name: 'module-type',
      type: 'enum',
      description: 'Type of Metasploit module',
      required: true,
      enumValues: ['exploit', 'auxiliary', 'payload', 'encoder', 'post', 'evasion', 'nop'],
      defaultValue: 'auxiliary',
      helpText: 'Exploit for exploits, Auxiliary for scanners, etc.',
    },
    {
      name: 'module-path',
      type: 'string',
      description: 'Module path (e.g., scanner/ssh/ssh_version)',
      required: true,
      placeholder: 'scanner/ssh/ssh_version',
      helpText: 'Path to the module within Metasploit',
    },
    {
      name: 'RHOST',
      type: 'ip-address',
      description: 'Target IP address or hostname',
      required: true,
      placeholder: '192.168.1.100',
      helpText: 'Remote host target for the module',
    },
    {
      name: 'RPORT',
      type: 'port',
      description: 'Target port',
      required: false,
      placeholder: '22',
      helpText: 'Remote port for the service',
    },
    {
      name: 'LHOST',
      type: 'ip-address',
      description: 'Local host IP (for reverse connections)',
      required: false,
      placeholder: '192.168.1.10',
      helpText: 'Your attack machine IP for reverse shells',
    },
    {
      name: 'LPORT',
      type: 'port',
      description: 'Local port (for reverse connections)',
      required: false,
      defaultValue: 4444,
      helpText: 'Listening port for reverse shells',
    },
    {
      name: 'PAYLOAD',
      type: 'string',
      description: 'Payload to use (for exploits)',
      required: false,
      placeholder: 'windows/meterpreter/reverse_tcp',
      helpText: 'Payload path for exploits',
    },
  ],
  outputParser: {
    parserName: 'metasploit-console-parser',
    parserType: 'regex',
    outputFormat: 'text',
    regexPatterns: {
      success: '\\[\\+\\].*$',
      errors: '\\[-\\].*$',
      info: '\\[\\*\\].*$',
      sessions: 'Session (\\d+) opened',
    },
  },
  tests: [
    {
      testType: 'execution',
      testCommand: '-v',
      expectedExitCode: 0,
      expectedOutputRegex: 'metasploit|framework',
      timeout: 10000,
    },
  ],
  healthCheckCommand: '-v',
  tags: ['exploitation', 'penetration-testing', 'framework', 'metasploit'],
  notes: 'Metasploit Framework - the most widely used penetration testing framework',
  homepage: 'https://www.metasploit.com',
  documentation: 'https://docs.metasploit.com',
};

/**
 * BBOT Configuration
 */
const bbotConfig: ToolConfiguration = {
  toolId: 'bbot',
  name: 'BBOT',
  version: '1.1.0',
  category: 'reconnaissance',
  description: 'Bighuge BLS OSINT Tool - Recursive internet scanner for attack surface mapping',
  installMethod: 'docker',
  dockerImage: 'rtpi-tools',
  binaryPath: '/usr/local/bin/bbot',
  baseCommand: 'bbot',
  workingDirectory: '/tmp',
  parameters: [
    {
      name: 't',
      type: 'array',
      description: 'Target domains, IPs, or CIDRs',
      required: true,
      placeholder: 'example.com,192.168.1.0/24',
      helpText: 'Comma-separated list of scan targets',
    },
    {
      name: 'p',
      type: 'string',
      description: 'Preset configuration',
      required: false,
      placeholder: 'subdomain-enum',
      helpText: 'Use predefined scan presets (subdomain-enum, web-basic, etc.)',
    },
    {
      name: 'm',
      type: 'array',
      description: 'Modules to enable',
      required: false,
      placeholder: 'httpx,nmap,sslcert',
      helpText: 'Comma-separated list of BBOT modules',
    },
    {
      name: 'f',
      type: 'array',
      description: 'Flags to enable',
      required: false,
      placeholder: 'subdomain-enum,active',
      helpText: 'Module flags for filtering',
    },
    {
      name: 'allow-deadly',
      type: 'boolean',
      description: 'Allow modules that can disrupt targets',
      required: false,
      defaultValue: false,
      helpText: 'Enable aggressive/intrusive scanning modules',
    },
    {
      name: 'no-deps',
      type: 'boolean',
      description: 'Skip dependency installation',
      required: false,
      defaultValue: true,
      helpText: 'Prevent sudo prompts in Docker',
    },
    {
      name: 'y',
      type: 'boolean',
      description: 'Auto-confirm prompts',
      required: false,
      defaultValue: true,
      helpText: 'Skip interactive confirmations',
    },
    {
      name: 'json',
      type: 'boolean',
      description: 'Output in JSON format',
      required: false,
      defaultValue: true,
      helpText: 'Enable JSON output for parsing',
    },
    {
      name: 'v',
      type: 'boolean',
      description: 'Verbose output',
      required: false,
      defaultValue: true,
      helpText: 'Enable detailed logging',
    },
  ],
  outputParser: {
    parserName: 'bbot-json-parser',
    parserType: 'json',
    outputFormat: 'json',
    jsonPaths: {
      domains: 'domains',
      ips: 'ips',
      urls: 'urls',
      ports: 'ports',
      technologies: 'technologies',
    },
  },
  tests: [
    {
      testType: 'execution',
      testCommand: '--version',
      expectedExitCode: 0,
      expectedOutput: 'BBOT',
      timeout: 5000,
    },
    {
      testType: 'execution',
      testCommand: '--help',
      expectedExitCode: 0,
      expectedOutput: 'modules',
      timeout: 5000,
    },
  ],
  healthCheckCommand: '--version',
  tags: ['reconnaissance', 'osint', 'attack-surface', 'subdomain-enum'],
  notes: 'BBOT is a recursive internet scanner designed for attack surface mapping and subdomain enumeration',
  homepage: 'https://github.com/blacklanternsecurity/bbot',
  documentation: 'https://www.blacklanternsecurity.com/bbot/',
};

/**
 * Main migration function
 */
async function migrateTools() {
  console.log('🔄 Starting tool migration to new framework...\n');

  const tools = [
    { name: 'Nmap', config: nmapConfig },
    { name: 'Metasploit Framework', config: metasploitConfig },
    { name: 'BBOT', config: bbotConfig },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const tool of tools) {
    try {
      console.log(`📦 Registering ${tool.name}...`);
      const toolId = await registerTool(tool.config, 'system');
      console.log(`✅ ${tool.name} registered successfully with ID: ${toolId}\n`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to register ${tool.name}:`, error.message);

      // If tool already exists, that's okay
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  ${tool.name} already registered, skipping...\n`);
        successCount++;
      } else {
        failCount++;
        console.error('Full error:', error, '\n');
      }
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📈 Total: ${tools.length}`);

  if (failCount === 0) {
    console.log('\n✨ All tools migrated successfully!');
  } else {
    console.log('\n⚠️  Some tools failed to migrate. Check errors above.');
    process.exit(1);
  }
}

// Run migration
migrateTools()
  .then(() => {
    console.log('\n🎉 Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed with unhandled error:', error);
    process.exit(1);
  });
