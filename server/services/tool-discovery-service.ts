/**
 * Tool Discovery Service
 * Discovers and validates tools from Dockerfile.tools and /opt/tools/
 */

import { dockerExecutor } from './docker-executor';

export interface DiscoveredTool {
  toolId: string;
  name: string;
  category: string;
  description: string;
  command: string;
  installMethod: 'apt' | 'pip' | 'binary' | 'github' | 'installer';
  installPath?: string;
  githubUrl?: string;
  isInstalled: boolean;
  version?: string;
  dockerImage: string;
  metadata?: Record<string, any>;
}

/**
 * Predefined tools based on Dockerfile.tools
 */
const DOCKERFILE_TOOLS: Omit<DiscoveredTool, 'isInstalled' | 'version'>[] = [
  // Reconnaissance
  {
    toolId: 'nmap',
    name: 'Nmap',
    category: 'reconnaissance',
    description: 'Network exploration tool and security/port scanner. Discovers hosts and services on a network.',
    command: 'nmap',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Target IP, domain, or CIDR range' },
        ports: { required: false, type: 'string', description: 'Port specification (e.g., -p 80,443 or -p-)' },
        scanType: { required: false, type: 'string', description: 'Scan type (-sS, -sT, -sV, etc.)' },
      },
      commandTemplate: 'nmap {scanType} {ports} {target}',
    },
  },
  {
    toolId: 'nbtscan',
    name: 'Nbtscan',
    category: 'reconnaissance',
    description: 'NetBIOS scanner for Windows networks. Scans for NetBIOS name information.',
    command: 'nbtscan',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Target IP range' },
      },
      commandTemplate: 'nbtscan {target}',
    },
  },
  {
    toolId: 'bbot',
    name: 'BBOT',
    category: 'reconnaissance',
    description: 'OSINT automation tool for attack surface reconnaissance. Discovers subdomains, IPs, URLs, and more.',
    command: 'bbot',
    installMethod: 'pip',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        targets: { required: true, type: 'array', description: 'Target domains or IPs' },
        preset: { required: false, type: 'string', description: 'Scan preset (subdomain-enum, cloud-enum, web-thorough)' },
      },
      commandTemplate: 'bbot -t {targets} -p {preset} -y --no-deps --json',
    },
  },

  // Vulnerability Scanning
  {
    toolId: 'nuclei',
    name: 'Nuclei',
    category: 'scanning',
    description: 'Fast and customizable vulnerability scanner. Uses YAML templates to detect security vulnerabilities.',
    command: 'nuclei',
    installMethod: 'binary',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        targets: { required: true, type: 'array', description: 'Target URLs or hosts' },
        severity: { required: false, type: 'string', description: 'Severity filter (critical,high,medium,low,info)' },
        templates: { required: false, type: 'string', description: 'Template paths or tags' },
      },
      commandTemplate: 'nuclei -u {targets} -severity {severity} -json -silent',
    },
  },

  // Exploitation
  {
    toolId: 'metasploit',
    name: 'Metasploit Framework',
    category: 'exploitation',
    description: 'The world\'s most used penetration testing framework. Includes exploit modules, payloads, and auxiliary modules.',
    command: 'msfconsole',
    installMethod: 'installer',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        resource: { required: false, type: 'string', description: 'Resource script to execute' },
        commands: { required: false, type: 'array', description: 'Commands to execute' },
      },
      commandTemplate: 'msfconsole {resource} -x \'{commands}\'',
      requiresInteractive: true,
    },
  },
  {
    toolId: 'searchsploit',
    name: 'SearchSploit',
    category: 'exploitation',
    description: 'Command-line search tool for Exploit-DB. Search and examine exploits from the Exploit Database.',
    command: 'searchsploit',
    installMethod: 'github',
    installPath: '/opt/tools/exploitdb',
    githubUrl: 'https://github.com/offensive-security/exploitdb',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        query: { required: true, type: 'string', description: 'Search query' },
        json: { required: false, type: 'boolean', description: 'Output as JSON' },
      },
      commandTemplate: 'searchsploit {json} {query}',
    },
  },

  // Password Cracking
  {
    toolId: 'hashcat',
    name: 'Hashcat',
    category: 'password-cracking',
    description: 'World\'s fastest password cracker. Supports numerous hash types and attack modes.',
    command: 'hashcat',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        hashFile: { required: true, type: 'string', description: 'File containing hashes' },
        hashType: { required: true, type: 'number', description: 'Hash type (-m parameter)' },
        attackMode: { required: true, type: 'number', description: 'Attack mode (0=dictionary, 3=mask)' },
        wordlist: { required: false, type: 'string', description: 'Wordlist file path' },
      },
      commandTemplate: 'hashcat -m {hashType} -a {attackMode} {hashFile} {wordlist}',
    },
  },
  {
    toolId: 'hydra',
    name: 'Hydra',
    category: 'password-cracking',
    description: 'Fast network logon cracker supporting numerous protocols. Performs brute force attacks against login forms.',
    command: 'hydra',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Target host' },
        service: { required: true, type: 'string', description: 'Service to attack (ssh, ftp, http-post-form)' },
        userList: { required: false, type: 'string', description: 'Username list file' },
        passwordList: { required: false, type: 'string', description: 'Password list file' },
      },
      commandTemplate: 'hydra -L {userList} -P {passwordList} {target} {service}',
    },
  },

  // Active Directory
  {
    toolId: 'bloodhound-python',
    name: 'BloodHound (Python)',
    category: 'active-directory',
    description: 'Active Directory relationship mapper. Reveals hidden relationships and attack paths in AD environments.',
    command: 'bloodhound-python',
    installMethod: 'pip',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        domain: { required: true, type: 'string', description: 'Domain to enumerate' },
        username: { required: true, type: 'string', description: 'Username for authentication' },
        password: { required: false, type: 'string', description: 'Password' },
        dc: { required: false, type: 'string', description: 'Domain controller IP' },
      },
      commandTemplate: 'bloodhound-python -d {domain} -u {username} -p {password} -dc {dc} -c All',
    },
  },
  {
    toolId: 'impacket',
    name: 'Impacket',
    category: 'active-directory',
    description: 'Collection of Python classes for working with network protocols. Essential for Windows/AD penetration testing.',
    command: 'impacket-secretsdump',
    installMethod: 'pip',
    dockerImage: 'rtpi-tools',
    metadata: {
      tools: {
        psexec: 'impacket-psexec',
        smbexec: 'impacket-smbexec',
        wmiexec: 'impacket-wmiexec',
        secretsdump: 'impacket-secretsdump',
        GetNPUsers: 'impacket-GetNPUsers',
        GetUserSPNs: 'impacket-GetUserSPNs',
      },
    },
  },

  // Post Exploitation (GitHub /opt/tools/)
  {
    toolId: 'powersploit',
    name: 'PowerSploit',
    category: 'post-exploitation',
    description: 'PowerShell post-exploitation framework. Collection of Microsoft PowerShell modules for penetration testing.',
    command: 'pwsh',
    installMethod: 'github',
    installPath: '/opt/tools/PowerSploit',
    githubUrl: 'https://github.com/PowerShellMafia/PowerSploit',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        module: { required: true, type: 'string', description: 'PowerSploit module to load' },
        command: { required: true, type: 'string', description: 'PowerShell command to execute' },
      },
      commandTemplate: 'pwsh -Command \'Import-Module /opt/tools/PowerSploit/{module}; {command}\'',
    },
  },
  {
    toolId: 'winpwn',
    name: 'WinPwn',
    category: 'post-exploitation',
    description: 'Windows post-exploitation toolkit. Automation for internal penetration testing.',
    command: 'pwsh',
    installMethod: 'github',
    installPath: '/opt/tools/WinPwn',
    githubUrl: 'https://github.com/S3cur3Th1sSh1t/WinPwn',
    dockerImage: 'rtpi-tools',
    metadata: {
      installPath: '/opt/tools/WinPwn',
    },
  },
  {
    toolId: 'bloodhound-repo',
    name: 'BloodHound',
    category: 'active-directory',
    description: 'BloodHound repository with queries and tools for Active Directory analysis.',
    command: 'bloodhound',
    installMethod: 'github',
    installPath: '/opt/tools/BloodHound',
    githubUrl: 'https://github.com/BloodHoundAD/BloodHound',
    dockerImage: 'rtpi-tools',
    metadata: {
      installPath: '/opt/tools/BloodHound',
    },
  },

  // Network Analysis
  {
    toolId: 'tshark',
    name: 'Wireshark (tshark)',
    category: 'network',
    description: 'Network protocol analyzer. Capture and analyze network traffic.',
    command: 'tshark',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        interface: { required: false, type: 'string', description: 'Network interface' },
        filter: { required: false, type: 'string', description: 'Capture filter' },
        readFile: { required: false, type: 'string', description: 'Read from pcap file' },
      },
      commandTemplate: 'tshark -i {interface} -f \'{filter}\' -r {readFile}',
    },
  },
  {
    toolId: 'proxychains',
    name: 'Proxychains',
    category: 'network',
    description: 'Force any TCP connection through proxy chains. Useful for anonymity and pivoting.',
    command: 'proxychains4',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        command: { required: true, type: 'string', description: 'Command to run through proxy' },
      },
      commandTemplate: 'proxychains4 {command}',
    },
  },

  // Web Application
  {
    toolId: 'gobuster',
    name: 'Gobuster',
    category: 'web-application',
    description: 'Directory/file & DNS busting tool. Fast brute forcing for web directories and DNS subdomains.',
    command: 'gobuster',
    installMethod: 'binary',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        mode: { required: true, type: 'string', description: 'Mode (dir, dns, vhost)' },
        url: { required: false, type: 'string', description: 'Target URL (for dir mode)' },
        wordlist: { required: true, type: 'string', description: 'Wordlist path' },
      },
      commandTemplate: 'gobuster {mode} -u {url} -w {wordlist}',
    },
  },

  // Development
  {
    toolId: 'python3',
    name: 'Python3',
    category: 'other',
    description: 'Python programming language. For custom script development and tool execution.',
    command: 'python3',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        script: { required: false, type: 'string', description: 'Python script path' },
        code: { required: false, type: 'string', description: 'Python code to execute' },
      },
      commandTemplate: 'python3 {script} -c \'{code}\'',
    },
  },
  {
    toolId: 'powershell',
    name: 'PowerShell',
    category: 'other',
    description: 'PowerShell Core. Cross-platform automation and scripting language.',
    command: 'pwsh',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        script: { required: false, type: 'string', description: 'PowerShell script path' },
        command: { required: false, type: 'string', description: 'PowerShell command to execute' },
      },
      commandTemplate: 'pwsh -File {script} -Command \'{command}\'',
    },
  },
  {
    toolId: 'nodejs',
    name: 'Node.js',
    category: 'other',
    description: 'Node.js JavaScript runtime. For executing JavaScript-based security tools and scripts.',
    command: 'node',
    installMethod: 'installer',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        script: { required: false, type: 'string', description: 'JavaScript file path' },
        code: { required: false, type: 'string', description: 'JavaScript code to execute' },
      },
      commandTemplate: 'node {script} -e \'{code}\'',
    },
  },

  // SSL/TLS
  {
    toolId: 'certbot',
    name: 'Certbot',
    category: 'other',
    description: 'Let\'s Encrypt certificate management tool. Useful for SSL/TLS testing and certificate operations.',
    command: 'certbot',
    installMethod: 'apt',
    dockerImage: 'rtpi-tools',
    metadata: {
      parameterSchema: {
        command: { required: true, type: 'string', description: 'Certbot command (certificates, renew)' },
        domain: { required: false, type: 'string', description: 'Domain name' },
      },
      commandTemplate: 'certbot {command} {domain}',
    },
  },
];

/**
 * Extract a clean version string from raw command output.
 * Returns undefined if no version pattern is found (avoids storing error messages).
 */
function parseVersionString(raw: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();

  // Reject if it looks like an error message
  if (/OCI runtime|exec failed|not found|No such file|Permission denied|unable to start/i.test(trimmed)) {
    return undefined;
  }

  // Try to extract a version number pattern
  const patterns = [
    /v?(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9._-]+)?)/,
    /version\s+v?(\d+\.\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[0].substring(0, 50);
    }
  }

  // If short and no error indicators, keep as-is
  if (trimmed.length <= 50 && !/error|failed|denied/i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

/**
 * Check if a tool is installed in the rtpi-tools container
 */
async function checkToolInstalled(command: string): Promise<{ installed: boolean; version?: string }> {
  try {
    // Try to get the tool's version or verify it exists
    const result = await dockerExecutor.exec('rtpi-tools', ['which', command], {
      timeout: 10000,
    });

    if (result.exitCode === 0 && result.stdout.trim()) {
      // Tool exists, try to get version
      try {
        const versionResult = await dockerExecutor.exec('rtpi-tools', [command, '--version'], {
          timeout: 10000,
        });
        const rawOutput = versionResult.stdout.split('\n')[0] || versionResult.stderr.split('\n')[0];
        const version = parseVersionString(rawOutput);
        return { installed: true, version };
      } catch {
        return { installed: true };
      }
    }

    return { installed: false };
  } catch {
    return { installed: false };
  }
}

/**
 * Check if a directory exists in the container
 */
async function checkDirectoryExists(path: string): Promise<boolean> {
  try {
    const result = await dockerExecutor.exec('rtpi-tools', ['test', '-d', path], {
      timeout: 5000,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Discover GitHub tools in /opt/tools/
 */
async function discoverGitHubTools(): Promise<string[]> {
  try {
    const result = await dockerExecutor.exec('rtpi-tools', ['ls', '-1', '/opt/tools/'], {
      timeout: 10000,
    });

    if (result.exitCode === 0) {
      return result.stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== 'custom'); // Exclude 'custom' directory
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Discover all tools from Dockerfile.tools and /opt/tools/
 */
export async function discoverTools(): Promise<DiscoveredTool[]> {
  const discoveredTools: DiscoveredTool[] = [];

  console.log('Starting tool discovery...');

  // Check predefined tools
  for (const tool of DOCKERFILE_TOOLS) {
    let isInstalled = false;
    let version: string | undefined;

    if (tool.installMethod === 'github' && tool.installPath) {
      // For GitHub tools, check if directory exists
      isInstalled = await checkDirectoryExists(tool.installPath);
    } else {
      // For other tools, check if binary exists
      const result = await checkToolInstalled(tool.command);
      isInstalled = result.installed;
      version = result.version;
    }

    discoveredTools.push({
      ...tool,
      isInstalled,
      version,
    });

    console.log(`  - ${tool.name}: ${isInstalled ? 'installed' : 'not found'}`);
  }

  // Discover additional GitHub tools in /opt/tools/
  const gitHubDirs = await discoverGitHubTools();
  const knownGitHubToolIds = DOCKERFILE_TOOLS
    .filter(t => t.installMethod === 'github')
    .map(t => t.installPath?.split('/').pop()?.toLowerCase());

  for (const dirName of gitHubDirs) {
    // Skip if we already have this tool defined
    if (knownGitHubToolIds.includes(dirName.toLowerCase())) {
      continue;
    }

    // Add unknown GitHub tool
    discoveredTools.push({
      toolId: dirName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: dirName,
      category: 'other',
      description: `Custom tool from /opt/tools/${dirName}`,
      command: dirName.toLowerCase(),
      installMethod: 'github',
      installPath: `/opt/tools/${dirName}`,
      dockerImage: 'rtpi-tools',
      isInstalled: true,
    });

    console.log(`  - ${dirName} (custom GitHub tool): installed`);
  }

  console.log(`Tool discovery complete. Found ${discoveredTools.length} tools.`);

  return discoveredTools;
}

/**
 * Get a summary of discovered tools
 */
export function getDiscoverySummary(tools: DiscoveredTool[]): {
  total: number;
  installed: number;
  notInstalled: number;
  byCategory: Record<string, number>;
  byMethod: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const byMethod: Record<string, number> = {};

  for (const tool of tools) {
    byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
    byMethod[tool.installMethod] = (byMethod[tool.installMethod] || 0) + 1;
  }

  return {
    total: tools.length,
    installed: tools.filter(t => t.isInstalled).length,
    notInstalled: tools.filter(t => !t.isInstalled).length,
    byCategory,
    byMethod,
  };
}
