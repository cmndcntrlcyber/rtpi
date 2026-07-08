/**
 * Tool Discovery Service
 * Discovers and validates tools from Dockerfile.tools and /opt/tools/
 */

import { dockerExecutor } from './docker-executor';
import { createLogger } from '../lib/logger';
const log = createLogger("tool-discovery-service");

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
 * Tools installed in specialized offsec-agent containers.
 * Same shape as DOCKERFILE_TOOLS but each entry specifies its real container.
 */
const SPECIALIZED_CONTAINER_TOOLS: Omit<DiscoveredTool, 'isInstalled' | 'version'>[] = [
  // ── rtpi-fuzzing-agent ────────────────────────────────────────────────
  {
    toolId: 'ffuf',
    name: 'ffuf',
    category: 'fuzzing',
    description: 'Fast web fuzzer written in Go. Discovers directories, vhosts, and parameters.',
    command: 'ffuf',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL with FUZZ keyword' },
        wordlist: { required: true, type: 'string', description: 'Wordlist file path' },
      },
      commandTemplate: 'ffuf -u {url} -w {wordlist} -o /tmp/ffuf-out.json -of json',
    },
  },
  {
    toolId: 'feroxbuster-fuzzing',
    name: 'Feroxbuster',
    category: 'fuzzing',
    description: 'Recursive content discovery tool written in Rust. Fast forced browsing.',
    command: 'feroxbuster',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
        wordlist: { required: false, type: 'string', description: 'Wordlist file path' },
      },
      commandTemplate: 'feroxbuster -u {url} -w {wordlist} --json',
    },
  },
  {
    toolId: 'dirsearch-fuzzing',
    name: 'Dirsearch',
    category: 'fuzzing',
    description: 'Web path scanner for discovering directories and files on web servers.',
    command: 'dirsearch',
    installMethod: 'pip',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'dirsearch -u {url} --format json -o /tmp/dirsearch-out.json',
    },
  },
  {
    toolId: 'wfuzz',
    name: 'Wfuzz',
    category: 'fuzzing',
    description: 'Web application fuzzer for brute forcing parameters, directories, and more.',
    command: 'wfuzz',
    installMethod: 'pip',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL with FUZZ keyword' },
        wordlist: { required: true, type: 'string', description: 'Wordlist file path' },
      },
      commandTemplate: 'wfuzz -w {wordlist} {url}',
    },
  },
  {
    toolId: 'sqlmap-fuzzing',
    name: 'SQLMap',
    category: 'web-application',
    description: 'Automatic SQL injection and database takeover tool.',
    command: 'sqlmap',
    installMethod: 'pip',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL with injectable parameter' },
        batch: { required: false, type: 'boolean', description: 'Non-interactive mode' },
      },
      commandTemplate: 'sqlmap -u {url} --batch --output-dir=/tmp/sqlmap-out',
    },
  },
  {
    toolId: 'wpscan-fuzzing',
    name: 'WPScan',
    category: 'web-application',
    description: 'WordPress security scanner. Detects vulnerable plugins, themes, and misconfigurations.',
    command: 'wpscan',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'WordPress site URL' },
      },
      commandTemplate: 'wpscan --url {url} --format json --no-banner',
    },
  },
  {
    toolId: 'amass',
    name: 'Amass',
    category: 'reconnaissance',
    description: 'In-depth attack surface mapping and asset discovery using OSINT.',
    command: 'amass',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        domain: { required: true, type: 'string', description: 'Target domain' },
      },
      commandTemplate: 'amass enum -d {domain} -json /tmp/amass-out.json',
    },
  },
  {
    toolId: 'arjun-fuzzing',
    name: 'Arjun',
    category: 'web-application',
    description: 'HTTP parameter discovery suite. Finds hidden GET/POST parameters.',
    command: 'arjun',
    installMethod: 'pip',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'arjun -u {url} -oJ /tmp/arjun-out.json',
    },
  },
  {
    toolId: 'nuclei-fuzzing',
    name: 'Nuclei (Fuzzing)',
    category: 'scanning',
    description: 'Fast vulnerability scanner with YAML templates, in the fuzzing agent container.',
    command: 'nuclei',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        targets: { required: true, type: 'array', description: 'Target URLs or hosts' },
        severity: { required: false, type: 'string', description: 'Severity filter' },
      },
      commandTemplate: 'nuclei -u {targets} -severity {severity} -json -silent',
    },
  },
  {
    toolId: 'httpx-fuzzing',
    name: 'httpx (Fuzzing)',
    category: 'reconnaissance',
    description: 'Fast HTTP probe tool. Detects live hosts, status codes, titles, and tech.',
    command: 'httpx',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        targets: { required: true, type: 'array', description: 'Target hosts or URLs' },
      },
      commandTemplate: 'echo {targets} | httpx -json -silent',
    },
  },
  {
    toolId: 'naabu',
    name: 'Naabu',
    category: 'reconnaissance',
    description: 'Fast port scanner written in Go. SYN/CONNECT scanning with service detection.',
    command: 'naabu',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        host: { required: true, type: 'string', description: 'Target host or CIDR' },
        ports: { required: false, type: 'string', description: 'Port range (e.g., 1-1000)' },
      },
      commandTemplate: 'naabu -host {host} -p {ports} -json -silent',
    },
  },
  {
    toolId: 'subfinder',
    name: 'Subfinder',
    category: 'reconnaissance',
    description: 'Passive subdomain discovery tool using multiple sources.',
    command: 'subfinder',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        domain: { required: true, type: 'string', description: 'Target domain' },
      },
      commandTemplate: 'subfinder -d {domain} -json -silent',
    },
  },
  {
    toolId: 'dnsx',
    name: 'dnsx',
    category: 'reconnaissance',
    description: 'Fast DNS toolkit for running multiple probes and record resolution.',
    command: 'dnsx',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        domain: { required: true, type: 'string', description: 'Target domain or list' },
      },
      commandTemplate: 'echo {domain} | dnsx -json -silent',
    },
  },
  {
    toolId: 'shuffledns',
    name: 'ShuffleDNS',
    category: 'reconnaissance',
    description: 'Wrapper around massdns for active DNS brute-forcing with wildcard filtering.',
    command: 'shuffledns',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        domain: { required: true, type: 'string', description: 'Target domain' },
        wordlist: { required: true, type: 'string', description: 'Subdomain wordlist' },
      },
      commandTemplate: 'shuffledns -d {domain} -w {wordlist} -json -silent',
    },
  },
  {
    toolId: 'katana-fuzzing',
    name: 'Katana (Fuzzing)',
    category: 'web-application',
    description: 'Next-generation crawling and spidering framework for web apps.',
    command: 'katana',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'katana -u {url} -json -silent',
    },
  },
  {
    toolId: 'uncover',
    name: 'Uncover',
    category: 'reconnaissance',
    description: 'API wrapper for Shodan, Censys, Fofa, and other search engines.',
    command: 'uncover',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        query: { required: true, type: 'string', description: 'Search query' },
        engine: { required: false, type: 'string', description: 'Search engine (shodan, censys, fofa)' },
      },
      commandTemplate: 'uncover -q {query} -e {engine} -json -silent',
    },
  },
  {
    toolId: 'tlsx',
    name: 'tlsx',
    category: 'reconnaissance',
    description: 'TLS data gathering tool. Grabs certificates, ciphers, and TLS versions.',
    command: 'tlsx',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        host: { required: true, type: 'string', description: 'Target host:port' },
      },
      commandTemplate: 'echo {host} | tlsx -json -silent',
    },
  },
  {
    toolId: 'asnmap',
    name: 'ASNMap',
    category: 'reconnaissance',
    description: 'Map ASN to CIDR ranges. Quick way to find all IPs owned by an organization.',
    command: 'asnmap',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        input: { required: true, type: 'string', description: 'ASN, domain, or org name' },
      },
      commandTemplate: 'asnmap -a {input} -json -silent',
    },
  },
  {
    toolId: 'cvemap',
    name: 'CVEMap',
    category: 'scanning',
    description: 'Navigate the CVE jungle with ease. Search and filter CVEs by vendor, product, or keyword.',
    command: 'cvemap',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        query: { required: true, type: 'string', description: 'CVE ID or search keyword' },
      },
      commandTemplate: 'cvemap -id {query} -json -silent',
    },
  },
  {
    toolId: 'gobuster-fuzzing',
    name: 'Gobuster (Fuzzing)',
    category: 'fuzzing',
    description: 'Directory/file & DNS busting tool in the fuzzing agent container.',
    command: 'gobuster',
    installMethod: 'binary',
    dockerImage: 'rtpi-fuzzing-agent',
    metadata: {
      parameterSchema: {
        mode: { required: true, type: 'string', description: 'Mode (dir, dns, vhost)' },
        url: { required: false, type: 'string', description: 'Target URL' },
        wordlist: { required: true, type: 'string', description: 'Wordlist path' },
      },
      commandTemplate: 'gobuster {mode} -u {url} -w {wordlist}',
    },
  },

  // ── rtpi-burp-agent ───────────────────────────────────────────────────
  {
    toolId: 'nikto',
    name: 'Nikto',
    category: 'web-application',
    description: 'Web server scanner that tests for dangerous files, outdated versions, and misconfigurations.',
    command: 'nikto',
    installMethod: 'binary',
    dockerImage: 'rtpi-burp-agent',
    metadata: {
      parameterSchema: {
        host: { required: true, type: 'string', description: 'Target host or URL' },
      },
      commandTemplate: 'nikto -h {host} -Format json -output /tmp/nikto-out.json',
    },
  },
  {
    toolId: 'mitmproxy',
    name: 'mitmproxy',
    category: 'web-application',
    description: 'Interactive HTTPS proxy for intercepting, inspecting, and modifying traffic.',
    command: 'mitmproxy',
    installMethod: 'pip',
    dockerImage: 'rtpi-burp-agent',
    metadata: {
      parameterSchema: {
        port: { required: false, type: 'number', description: 'Proxy listen port (default 8080)' },
      },
      commandTemplate: 'mitmdump -p {port}',
    },
  },
  {
    toolId: 'katana-burp',
    name: 'Katana',
    category: 'web-application',
    description: 'Next-generation web crawling and spidering framework.',
    command: 'katana',
    installMethod: 'binary',
    dockerImage: 'rtpi-burp-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL to crawl' },
        depth: { required: false, type: 'number', description: 'Crawl depth (default 3)' },
      },
      commandTemplate: 'katana -u {url} -d {depth} -json -silent',
    },
  },
  {
    toolId: 'httpx-burp',
    name: 'httpx',
    category: 'reconnaissance',
    description: 'HTTP probe tool for detecting live hosts, status, titles, tech fingerprints.',
    command: 'httpx',
    installMethod: 'binary',
    dockerImage: 'rtpi-burp-agent',
    metadata: {
      parameterSchema: {
        targets: { required: true, type: 'array', description: 'Target hosts or URLs' },
      },
      commandTemplate: 'echo {targets} | httpx -json -silent',
    },
  },
  {
    toolId: 'dalfox',
    name: 'DalFox',
    category: 'web-application',
    description: 'Powerful open-source XSS scanning tool and parameter analysis utility.',
    command: 'dalfox',
    installMethod: 'binary',
    dockerImage: 'rtpi-burp-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'dalfox url {url} --format json',
    },
  },
  {
    toolId: 'gospider',
    name: 'GoSpider',
    category: 'web-application',
    description: 'Fast web spider written in Go. Crawls and extracts URLs, subdomains, and JS files.',
    command: 'gospider',
    installMethod: 'binary',
    dockerImage: 'rtpi-burp-agent',
    metadata: {
      parameterSchema: {
        site: { required: true, type: 'string', description: 'Target site URL' },
      },
      commandTemplate: 'gospider -s {site} --json',
    },
  },
  {
    toolId: 'hakrawler',
    name: 'Hakrawler',
    category: 'web-application',
    description: 'Simple and fast web crawler for discovering endpoints and assets.',
    command: 'hakrawler',
    installMethod: 'binary',
    dockerImage: 'rtpi-burp-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'echo {url} | hakrawler',
    },
  },
  {
    toolId: 'wapiti',
    name: 'Wapiti',
    category: 'web-application',
    description: 'Web application vulnerability scanner supporting XSS, SQLi, SSRF, and more.',
    command: 'wapiti',
    installMethod: 'pip',
    dockerImage: 'rtpi-burp-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'wapiti -u {url} -f json -o /tmp/wapiti-out.json',
    },
  },

  // ── rtpi-framework-agent ──────────────────────────────────────────────
  {
    toolId: 'whatweb',
    name: 'WhatWeb',
    category: 'reconnaissance',
    description: 'Web technology fingerprinter. Identifies CMS, frameworks, servers, and plugins.',
    command: 'whatweb',
    installMethod: 'binary',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'whatweb {url} --log-json=/tmp/whatweb-out.json',
    },
  },
  {
    toolId: 'semgrep',
    name: 'Semgrep',
    category: 'scanning',
    description: 'Static analysis tool for finding bugs and enforcing code standards across languages.',
    command: 'semgrep',
    installMethod: 'pip',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Directory or file to scan' },
        config: { required: false, type: 'string', description: 'Semgrep rule config (e.g., auto, p/security-audit)' },
      },
      commandTemplate: 'semgrep --config {config} {target} --json',
    },
  },
  {
    toolId: 'bandit',
    name: 'Bandit',
    category: 'scanning',
    description: 'Security linter for Python code. Finds common security issues.',
    command: 'bandit',
    installMethod: 'pip',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Python file or directory' },
      },
      commandTemplate: 'bandit -r {target} -f json',
    },
  },
  {
    toolId: 'safety',
    name: 'Safety',
    category: 'scanning',
    description: 'Checks Python dependencies for known security vulnerabilities.',
    command: 'safety',
    installMethod: 'pip',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        requirements: { required: false, type: 'string', description: 'Requirements file path' },
      },
      commandTemplate: 'safety check -r {requirements} --json',
    },
  },
  {
    toolId: 'trivy',
    name: 'Trivy',
    category: 'scanning',
    description: 'Comprehensive vulnerability scanner for containers, filesystems, and git repos.',
    command: 'trivy',
    installMethod: 'binary',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Image name, directory, or repo URL' },
        scanType: { required: false, type: 'string', description: 'Scan type (image, fs, repo)' },
      },
      commandTemplate: 'trivy {scanType} {target} -f json',
    },
  },
  {
    toolId: 'grype',
    name: 'Grype',
    category: 'scanning',
    description: 'Vulnerability scanner for container images and filesystems.',
    command: 'grype',
    installMethod: 'binary',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Image or directory to scan' },
      },
      commandTemplate: 'grype {target} -o json',
    },
  },
  {
    toolId: 'osv-scanner',
    name: 'OSV-Scanner',
    category: 'scanning',
    description: 'Google OSV vulnerability scanner for open-source dependencies.',
    command: 'osv-scanner',
    installMethod: 'binary',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        directory: { required: true, type: 'string', description: 'Project directory to scan' },
      },
      commandTemplate: 'osv-scanner -r {directory} --format json',
    },
  },
  {
    toolId: 'wpscan-framework',
    name: 'WPScan (Framework)',
    category: 'web-application',
    description: 'WordPress vulnerability scanner in the framework agent container.',
    command: 'wpscan',
    installMethod: 'binary',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'WordPress site URL' },
      },
      commandTemplate: 'wpscan --url {url} --format json --no-banner',
    },
  },
  {
    toolId: 'droopescan',
    name: 'Droopescan',
    category: 'web-application',
    description: 'Plugin-based scanner for Drupal, Joomla, WordPress, and other CMS.',
    command: 'droopescan',
    installMethod: 'pip',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target CMS URL' },
        cms: { required: false, type: 'string', description: 'CMS type (drupal, joomla, wordpress)' },
      },
      commandTemplate: 'droopescan scan {cms} -u {url} -o json',
    },
  },
  {
    toolId: 'brakeman',
    name: 'Brakeman',
    category: 'scanning',
    description: 'Static analysis security scanner for Ruby on Rails applications.',
    command: 'brakeman',
    installMethod: 'binary',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        path: { required: true, type: 'string', description: 'Rails application path' },
      },
      commandTemplate: 'brakeman -p {path} -f json',
    },
  },
  {
    toolId: 'sslyze',
    name: 'SSLyze',
    category: 'scanning',
    description: 'Fast SSL/TLS scanning library and CLI tool for analyzing server configurations.',
    command: 'sslyze',
    installMethod: 'pip',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        host: { required: true, type: 'string', description: 'Target host:port' },
      },
      commandTemplate: 'sslyze {host} --json_out=/tmp/sslyze-out.json',
    },
  },
  {
    toolId: 'wafw00f',
    name: 'wafw00f',
    category: 'reconnaissance',
    description: 'Web Application Firewall fingerprinting tool. Identifies WAF solutions.',
    command: 'wafw00f',
    installMethod: 'pip',
    dockerImage: 'rtpi-framework-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'wafw00f {url} -o /tmp/wafw00f-out.json -f json',
    },
  },

  // ── rtpi-azure-ad-agent ───────────────────────────────────────────────
  {
    toolId: 'kerbrute',
    name: 'Kerbrute',
    category: 'active-directory',
    description: 'Kerberos brute-force and user enumeration tool written in Go.',
    command: 'kerbrute',
    installMethod: 'binary',
    dockerImage: 'rtpi-azure-ad-agent',
    metadata: {
      parameterSchema: {
        domain: { required: true, type: 'string', description: 'Target domain' },
        dc: { required: true, type: 'string', description: 'Domain controller IP' },
        wordlist: { required: true, type: 'string', description: 'Username wordlist' },
      },
      commandTemplate: 'kerbrute userenum --dc {dc} -d {domain} {wordlist}',
    },
  },
  {
    toolId: 'enum4linux-ng',
    name: 'enum4linux-ng',
    category: 'active-directory',
    description: 'Next-generation enum4linux. Enumerates info from Windows/Samba systems via SMB.',
    command: 'enum4linux-ng',
    installMethod: 'pip',
    dockerImage: 'rtpi-azure-ad-agent',
    installPath: '/opt/tools/enum4linux-ng',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Target IP' },
      },
      commandTemplate: 'enum4linux-ng -A {target} -oJ /tmp/e4l-out',
    },
  },
  {
    toolId: 'netexec',
    name: 'NetExec (CrackMapExec)',
    category: 'active-directory',
    description: 'Network service exploitation tool. Swiss army knife for AD/SMB/WinRM/SSH pentesting.',
    command: 'nxc',
    installMethod: 'pip',
    dockerImage: 'rtpi-azure-ad-agent',
    metadata: {
      parameterSchema: {
        protocol: { required: true, type: 'string', description: 'Protocol (smb, winrm, ssh, ldap)' },
        target: { required: true, type: 'string', description: 'Target IP or range' },
      },
      commandTemplate: 'nxc {protocol} {target}',
    },
  },

  // ── rtpi-research-agent ───────────────────────────────────────────────
  {
    toolId: 'bbot-research',
    name: 'BBOT (Research)',
    category: 'reconnaissance',
    description: 'BBOT reconnaissance tool in the research agent container.',
    command: 'bbot',
    installMethod: 'pip',
    dockerImage: 'rtpi-research-agent',
    metadata: {
      parameterSchema: {
        targets: { required: true, type: 'array', description: 'Target domains or IPs' },
        preset: { required: false, type: 'string', description: 'Scan preset' },
      },
      commandTemplate: 'bbot -t {targets} -p {preset} -y --no-deps --json',
    },
  },
  {
    toolId: 'dirsearch-research',
    name: 'Dirsearch (Research)',
    category: 'fuzzing',
    description: 'Web path scanner in the research agent container.',
    command: 'dirsearch',
    installMethod: 'pip',
    dockerImage: 'rtpi-research-agent',
    metadata: {
      parameterSchema: {
        url: { required: true, type: 'string', description: 'Target URL' },
      },
      commandTemplate: 'dirsearch -u {url} --format json -o /tmp/dirsearch-out.json',
    },
  },

  // ── rtpi-cloud-agent ──────────────────────────────────────────────────
  {
    toolId: 'scoutsuite',
    name: 'ScoutSuite',
    category: 'cloud',
    description: 'Multi-cloud security auditing tool. Assesses AWS, Azure, and GCP environments.',
    command: 'scout',
    installMethod: 'pip',
    dockerImage: 'rtpi-cloud-agent',
    metadata: {
      parameterSchema: {
        provider: { required: true, type: 'string', description: 'Cloud provider (aws, azure, gcp)' },
      },
      commandTemplate: 'scout {provider} --report-dir /tmp/scout-report',
    },
  },
  {
    toolId: 'prowler',
    name: 'Prowler',
    category: 'cloud',
    description: 'Cloud security assessment tool for AWS, Azure, GCP, and Kubernetes.',
    command: 'prowler',
    installMethod: 'pip',
    dockerImage: 'rtpi-cloud-agent',
    metadata: {
      parameterSchema: {
        provider: { required: true, type: 'string', description: 'Cloud provider (aws, azure, gcp)' },
      },
      commandTemplate: 'prowler {provider} -M json -o /tmp/prowler-out',
    },
  },
  {
    toolId: 'pacu',
    name: 'Pacu',
    category: 'cloud',
    description: 'AWS exploitation framework for testing security of Amazon Web Services.',
    command: 'pacu',
    installMethod: 'pip',
    dockerImage: 'rtpi-cloud-agent',
    installPath: '/opt/tools/pacu',
    metadata: {
      parameterSchema: {
        command: { required: true, type: 'string', description: 'Pacu command or module' },
      },
      commandTemplate: 'pacu --command {command}',
    },
  },
  {
    toolId: 'cloudfox',
    name: 'CloudFox',
    category: 'cloud',
    description: 'Automating cloud security. Finds exploitable attack paths in cloud infrastructure.',
    command: 'cloudfox',
    installMethod: 'binary',
    dockerImage: 'rtpi-cloud-agent',
    metadata: {
      parameterSchema: {
        provider: { required: true, type: 'string', description: 'Cloud provider (aws, azure, gcp)' },
        command: { required: true, type: 'string', description: 'CloudFox command' },
      },
      commandTemplate: 'cloudfox {provider} {command}',
    },
  },
  {
    toolId: 'cloudsplaining',
    name: 'Cloudsplaining',
    category: 'cloud',
    description: 'AWS IAM security assessment tool. Identifies violations of least privilege.',
    command: 'cloudsplaining',
    installMethod: 'pip',
    dockerImage: 'rtpi-cloud-agent',
    metadata: {
      parameterSchema: {
        file: { required: true, type: 'string', description: 'AWS IAM policy JSON file' },
      },
      commandTemplate: 'cloudsplaining scan --input-file {file}',
    },
  },
  {
    toolId: 'parliament',
    name: 'Parliament',
    category: 'cloud',
    description: 'AWS IAM policy linter. Analyzes and reports on IAM policy issues.',
    command: 'parliament',
    installMethod: 'pip',
    dockerImage: 'rtpi-cloud-agent',
    metadata: {
      parameterSchema: {
        file: { required: true, type: 'string', description: 'IAM policy JSON file' },
      },
      commandTemplate: 'parliament --file {file}',
    },
  },
  {
    toolId: 'steampipe',
    name: 'Steampipe',
    category: 'cloud',
    description: 'Universal SQL interface for cloud APIs. Query AWS, Azure, GCP with SQL.',
    command: 'steampipe',
    installMethod: 'binary',
    dockerImage: 'rtpi-cloud-agent',
    metadata: {
      parameterSchema: {
        query: { required: true, type: 'string', description: 'SQL query for cloud resources' },
      },
      commandTemplate: 'steampipe query "{query}" --output json',
    },
  },
  {
    toolId: 'cartography',
    name: 'Cartography',
    category: 'cloud',
    description: 'Consolidates cloud infrastructure assets and relationships into a graph database.',
    command: 'cartography',
    installMethod: 'pip',
    dockerImage: 'rtpi-cloud-agent',
    metadata: {
      parameterSchema: {
        neo4jUri: { required: true, type: 'string', description: 'Neo4j database URI' },
      },
      commandTemplate: 'cartography --neo4j-uri {neo4jUri}',
    },
  },

  // ── rtpi-maldev-agent ─────────────────────────────────────────────────
  {
    toolId: 'radare2',
    name: 'Radare2',
    category: 'reverse-engineering',
    description: 'Advanced reverse engineering framework and disassembler.',
    command: 'r2',
    installMethod: 'binary',
    dockerImage: 'rtpi-maldev-agent',
    metadata: {
      parameterSchema: {
        binary: { required: true, type: 'string', description: 'Binary file to analyze' },
      },
      commandTemplate: 'r2 -A -q {binary}',
    },
  },
  {
    toolId: 'frida-tools',
    name: 'Frida',
    category: 'reverse-engineering',
    description: 'Dynamic instrumentation toolkit for developers, reverse-engineers, and security researchers.',
    command: 'frida',
    installMethod: 'pip',
    dockerImage: 'rtpi-maldev-agent',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Target process name or PID' },
      },
      commandTemplate: 'frida {target}',
    },
  },
  {
    toolId: 'xgadget',
    name: 'xgadget',
    category: 'exploitation',
    description: 'Fast ROP/JOP gadget search tool written in Rust.',
    command: 'xgadget',
    installMethod: 'binary',
    dockerImage: 'rtpi-maldev-agent',
    metadata: {
      parameterSchema: {
        binary: { required: true, type: 'string', description: 'Binary to search for gadgets' },
      },
      commandTemplate: 'xgadget {binary}',
    },
  },

  // ── rtpi-web-injection-agent ──────────────────────────────────────────
  {
    toolId: 'catch',
    name: 'Catch',
    category: 'web-application',
    description: 'Web injection testing framework for SQLi, XSS, and CSRF analysis.',
    command: 'catch',
    installMethod: 'github',
    installPath: '/opt/tools/catch',
    githubUrl: 'https://github.com/cmndcntrlcyber/catch',
    dockerImage: 'rtpi-web-injection-agent',
    metadata: {
      parameterSchema: {
        target: { required: true, type: 'string', description: 'Target URL or config' },
      },
      commandTemplate: 'python3 /opt/tools/catch/main.py {target}',
    },
  },

  // ── rtpi-llm-sec-agent ────────────────────────────────────────────────
  {
    toolId: 'garak',
    name: 'Garak',
    category: 'scanning',
    description: 'LLM vulnerability scanner by NVIDIA. Tests for prompt injection, data leakage, and more.',
    command: 'garak',
    installMethod: 'pip',
    installPath: '/opt/tools/garak',
    dockerImage: 'rtpi-llm-sec-agent',
    metadata: {
      parameterSchema: {
        model: { required: true, type: 'string', description: 'Target LLM model name' },
        probes: { required: false, type: 'string', description: 'Probe modules to run' },
      },
      commandTemplate: 'python3 -m garak --model_type {model} --probes {probes}',
    },
  },
  {
    toolId: 'promptfoo',
    name: 'Promptfoo',
    category: 'scanning',
    description: 'LLM evaluation and red-teaming framework. Tests prompts for security and quality.',
    command: 'promptfoo',
    installMethod: 'binary',
    installPath: '/opt/tools/promptfoo',
    dockerImage: 'rtpi-llm-sec-agent',
    metadata: {
      parameterSchema: {
        config: { required: true, type: 'string', description: 'Promptfoo config YAML file' },
      },
      commandTemplate: 'npx promptfoo eval -c {config} -o /tmp/promptfoo-out.json',
    },
  },
  {
    toolId: 'deepeval',
    name: 'DeepEval',
    category: 'scanning',
    description: 'LLM evaluation framework. Tests for hallucination, toxicity, and bias.',
    command: 'deepeval',
    installMethod: 'pip',
    installPath: '/opt/tools/deepeval',
    dockerImage: 'rtpi-llm-sec-agent',
    metadata: {
      parameterSchema: {
        testFile: { required: true, type: 'string', description: 'Test file path' },
      },
      commandTemplate: 'deepeval test run {testFile}',
    },
  },
  {
    toolId: 'modelscan',
    name: 'ModelScan',
    category: 'scanning',
    description: 'Scan ML models for security vulnerabilities like code injection in pickle files.',
    command: 'modelscan',
    installMethod: 'pip',
    installPath: '/opt/tools/modelscan',
    dockerImage: 'rtpi-llm-sec-agent',
    metadata: {
      parameterSchema: {
        path: { required: true, type: 'string', description: 'Model file or directory to scan' },
      },
      commandTemplate: 'modelscan scan -p {path}',
    },
  },
];

const ALL_TOOLS = [...DOCKERFILE_TOOLS, ...SPECIALIZED_CONTAINER_TOOLS];

export const TOOL_CONTAINERS = [...new Set(ALL_TOOLS.map(t => t.dockerImage))];

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
 * Check if a container is running and reachable.
 */
async function isContainerRunning(containerName: string): Promise<boolean> {
  try {
    const result = await dockerExecutor.exec(containerName, ['echo', 'ok'], {
      timeout: 5000,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Check if a tool is installed in a container.
 */
async function checkToolInstalled(
  command: string,
  containerName: string = 'rtpi-tools'
): Promise<{ installed: boolean; version?: string }> {
  try {
    const result = await dockerExecutor.exec(containerName, ['which', command], {
      timeout: 10000,
    });

    if (result.exitCode === 0 && result.stdout.trim()) {
      try {
        const versionResult = await dockerExecutor.exec(containerName, [command, '--version'], {
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
 * Check if a directory exists in a container.
 */
async function checkDirectoryExists(
  path: string,
  containerName: string = 'rtpi-tools'
): Promise<boolean> {
  try {
    const result = await dockerExecutor.exec(containerName, ['test', '-d', path], {
      timeout: 5000,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Discover GitHub tools in /opt/tools/ within a container.
 */
async function discoverGitHubTools(containerName: string = 'rtpi-tools'): Promise<string[]> {
  try {
    const result = await dockerExecutor.exec(containerName, ['ls', '-1', '/opt/tools/'], {
      timeout: 10000,
    });

    if (result.exitCode === 0) {
      return result.stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== 'custom');
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Discover all tools across all containers (rtpi-tools + specialized agents).
 * Groups tools by container and checks availability once per container.
 */
export async function discoverTools(): Promise<DiscoveredTool[]> {
  const discoveredTools: DiscoveredTool[] = [];

  log.info('Starting multi-container tool discovery...');

  // Group ALL_TOOLS by container
  const byContainer = new Map<string, typeof ALL_TOOLS>();
  for (const tool of ALL_TOOLS) {
    const list = byContainer.get(tool.dockerImage) || [];
    list.push(tool);
    byContainer.set(tool.dockerImage, list);
  }

  for (const [containerName, containerTools] of byContainer) {
    const available = await isContainerRunning(containerName);
    if (!available) {
      log.warn(`Container ${containerName} not running — marking ${containerTools.length} tools as not installed`);
      for (const tool of containerTools) {
        discoveredTools.push({ ...tool, isInstalled: false });
      }
      continue;
    }

    log.info(`Scanning ${containerName} (${containerTools.length} tools)...`);

    for (const tool of containerTools) {
      let isInstalled = false;
      let version: string | undefined;

      if (tool.installMethod === 'github' && tool.installPath) {
        isInstalled = await checkDirectoryExists(tool.installPath, containerName);
      } else {
        const result = await checkToolInstalled(tool.command, containerName);
        isInstalled = result.installed;
        version = result.version;
      }

      discoveredTools.push({ ...tool, isInstalled, version });
      log.info(`  - ${tool.name}: ${isInstalled ? 'installed' : 'not found'}`);
    }

    // Discover additional GitHub tools in /opt/tools/ for this container
    const gitHubDirs = await discoverGitHubTools(containerName);
    const knownPaths = containerTools
      .filter(t => t.installMethod === 'github')
      .map(t => t.installPath?.split('/').pop()?.toLowerCase());

    for (const dirName of gitHubDirs) {
      if (knownPaths.includes(dirName.toLowerCase())) continue;

      discoveredTools.push({
        toolId: `${dirName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${containerName.replace('rtpi-', '').replace('-agent', '')}`,
        name: dirName,
        category: 'other',
        description: `Custom tool from /opt/tools/${dirName} in ${containerName}`,
        command: dirName.toLowerCase(),
        installMethod: 'github',
        installPath: `/opt/tools/${dirName}`,
        dockerImage: containerName,
        isInstalled: true,
      });
      log.info(`  - ${dirName} (custom in ${containerName}): installed`);
    }
  }

  log.info(`Tool discovery complete. Found ${discoveredTools.length} tools across ${byContainer.size} containers.`);
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

/**
 * Register a tool from any container into the tool_registry DB table.
 * Idempotent: creates if missing, updates if already present.
 */
export async function registerContainerTool(tool: {
  toolId: string;
  name: string;
  category: string;
  description: string;
  command: string;
  binaryPath?: string;
  containerName: string;
  containerUser?: string;
  installMethod?: string;
  metadata?: Record<string, any>;
}): Promise<{ action: 'created' | 'updated'; id: string }> {
  const { db } = await import('../db');
  const { toolRegistry } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');

  const existing = await db
    .select()
    .from(toolRegistry)
    .where(eq(toolRegistry.toolId, tool.toolId))
    .limit(1);

  if (existing.length === 0) {
    const [row] = await db.insert(toolRegistry).values({
      toolId: tool.toolId,
      name: tool.name,
      category: tool.category as any,
      description: tool.description,
      binaryPath: tool.binaryPath || `/usr/bin/${tool.command}`,
      containerName: tool.containerName,
      containerUser: tool.containerUser || 'rtpi-agent',
      dockerImage: tool.containerName,
      installMethod: (tool.installMethod || 'manual') as any,
      installStatus: 'installed',
      validationStatus: 'discovered',
      config: tool.metadata as any,
    }).returning();

    try {
      const { enqueueSkillGeneration } = await import('./skill-generator');
      enqueueSkillGeneration('registry', row.id);
    } catch {
      log.warn(`Skill generation not available for ${tool.toolId}`);
    }

    log.info(`Registered new tool: ${tool.toolId} in ${tool.containerName}`);
    return { action: 'created', id: row.id };
  }

  await db
    .update(toolRegistry)
    .set({
      description: tool.description,
      containerName: tool.containerName,
      containerUser: tool.containerUser || existing[0].containerUser,
      installStatus: 'installed',
      updatedAt: new Date(),
    })
    .where(eq(toolRegistry.id, existing[0].id));

  log.info(`Updated existing tool: ${tool.toolId}`);
  return { action: 'updated', id: existing[0].id };
}
