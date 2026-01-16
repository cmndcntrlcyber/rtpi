import { db } from "../server/db";
import { securityTools } from "../shared/schema";

// Tool categories based on Dockerfile.tools
const toolsData = [
  // ===== RECONNAISSANCE TOOLS =====
  {
    name: "Nmap",
    category: "reconnaissance",
    description: "Network exploration tool and security/port scanner. Discovers hosts and services on a network.",
    command: "nmap",
    dockerImage: "rtpi-tools",
    version: "7.94",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        target: { required: true, type: "string", description: "Target IP, domain, or CIDR range" },
        ports: { required: false, type: "string", description: "Port specification (e.g., -p 80,443 or -p-)" },
        scanType: { required: false, type: "string", description: "Scan type (-sS, -sT, -sV, etc.)" },
        timing: { required: false, type: "string", description: "Timing template (-T0 to -T5)" },
        output: { required: false, type: "string", description: "Output file path" },
      },
      commandTemplate: "nmap {scanType} {ports} {timing} {output} {target}",
      examples: [
        "nmap -sV -p- 192.168.1.1",
        "nmap -sS -T4 -A 10.0.0.0/24",
        "nmap -sV --script vuln target.com",
      ],
      outputParser: "nmap",
    },
  },
  {
    name: "Nbtscan",
    category: "reconnaissance",
    description: "NetBIOS scanner for Windows networks. Scans for NetBIOS name information.",
    command: "nbtscan",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        target: { required: true, type: "string", description: "Target IP range" },
      },
      commandTemplate: "nbtscan {target}",
      examples: ["nbtscan 192.168.1.0/24"],
      outputParser: "text",
    },
  },
  {
    name: "BBOT",
    category: "reconnaissance",
    description: "OSINT automation tool for attack surface reconnaissance. Discovers subdomains, IPs, URLs, and more through recursive scanning.",
    command: "bbot",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        targets: { required: true, type: "array", description: "Target domains or IPs" },
        preset: { required: false, type: "string", description: "Scan preset (subdomain-enum, cloud-enum, web-thorough, etc.)" },
        modules: { required: false, type: "string", description: "Comma-separated list of modules" },
        flags: { required: false, type: "string", description: "Comma-separated list of flags" },
        args: { required: false, type: "string", description: "Additional arguments (e.g., --allow-deadly)" },
      },
      commandTemplate: "bbot -t {targets} -p {preset} -m {modules} -f {flags} {args} -y --no-deps --json",
      examples: [
        "bbot -t example.com -p subdomain-enum -y --no-deps --json",
        "bbot -t 10.0.0.0/24 -p cloud-enum -y --no-deps",
        "bbot -t example.com -m httpx,nuclei -y --no-deps --json",
      ],
      outputParser: "json",
    },
  },

  // ===== VULNERABILITY SCANNING TOOLS =====
  {
    name: "Nuclei",
    category: "vulnerability_scanning",
    description: "Fast and customizable vulnerability scanner. Uses YAML templates to detect security vulnerabilities, misconfigurations, and more.",
    command: "nuclei",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        targets: { required: true, type: "array", description: "Target URLs or hosts" },
        severity: { required: false, type: "string", description: "Severity filter (critical,high,medium,low,info)" },
        rateLimit: { required: false, type: "number", description: "Rate limit (requests per second)" },
        templates: { required: false, type: "string", description: "Template paths or tags" },
        tags: { required: false, type: "string", description: "Template tags to include" },
        excludeTags: { required: false, type: "string", description: "Template tags to exclude" },
      },
      commandTemplate: "nuclei -u {targets} -severity {severity} -rate-limit {rateLimit} -t {templates} -tags {tags} -exclude-tags {excludeTags} -json -silent",
      examples: [
        "nuclei -u https://example.com -severity critical,high,medium -json -silent",
        "nuclei -u https://example.com -tags cve -json -silent",
        "nuclei -l targets.txt -severity critical,high -rate-limit 100 -json",
      ],
      outputParser: "json",
    },
  },

  // ===== EXPLOITATION TOOLS =====
  {
    name: "Metasploit Framework",
    category: "exploitation",
    description: "The world's most used penetration testing framework. Includes exploit modules, payloads, and auxiliary modules.",
    command: "msfconsole",
    dockerImage: "rtpi-tools",
    version: "6.x",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        resource: { required: false, type: "string", description: "Resource script to execute" },
        commands: { required: false, type: "array", description: "Commands to execute" },
      },
      commandTemplate: "msfconsole {resource} -x '{commands}'",
      examples: [
        "msfconsole -x 'use exploit/multi/handler; set PAYLOAD windows/meterpreter/reverse_tcp; set LHOST 10.0.0.1; set LPORT 4444; run'",
      ],
      outputParser: "text",
      requiresInteractive: true,
    },
  },
  {
    name: "SearchSploit",
    category: "exploitation",
    description: "Command-line search tool for Exploit-DB. Search and examine exploits from the Exploit Database.",
    command: "searchsploit",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        query: { required: true, type: "string", description: "Search query" },
        exact: { required: false, type: "boolean", description: "Exact match" },
        json: { required: false, type: "boolean", description: "Output as JSON" },
      },
      commandTemplate: "searchsploit {exact} {json} {query}",
      examples: [
        "searchsploit apache 2.4",
        "searchsploit --json windows privilege",
        "searchsploit -x /path/to/exploit.rb",
      ],
      outputParser: "text",
    },
  },

  // ===== PASSWORD ATTACK TOOLS =====
  {
    name: "Hashcat",
    category: "password_cracking",
    description: "World's fastest password cracker. Supports numerous hash types and attack modes.",
    command: "hashcat",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        hashFile: { required: true, type: "string", description: "File containing hashes" },
        hashType: { required: true, type: "number", description: "Hash type (-m parameter)" },
        attackMode: { required: true, type: "number", description: "Attack mode (0=dictionary, 3=mask, etc.)" },
        wordlist: { required: false, type: "string", description: "Wordlist file path" },
        mask: { required: false, type: "string", description: "Mask for brute force" },
      },
      commandTemplate: "hashcat -m {hashType} -a {attackMode} {hashFile} {wordlist} {mask}",
      examples: [
        "hashcat -m 1000 -a 0 hashes.txt wordlist.txt",
        "hashcat -m 0 -a 3 hashes.txt ?a?a?a?a?a?a",
      ],
      outputParser: "hashcat",
    },
  },
  {
    name: "Hydra",
    category: "password_cracking",
    description: "Fast network logon cracker supporting numerous protocols. Performs brute force attacks against login forms.",
    command: "hydra",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        target: { required: true, type: "string", description: "Target host" },
        service: { required: true, type: "string", description: "Service to attack (ssh, ftp, http-post-form, etc.)" },
        userList: { required: false, type: "string", description: "Username list file" },
        passwordList: { required: false, type: "string", description: "Password list file" },
        user: { required: false, type: "string", description: "Single username" },
        password: { required: false, type: "string", description: "Single password" },
      },
      commandTemplate: "hydra -L {userList} -P {passwordList} -l {user} -p {password} {target} {service}",
      examples: [
        "hydra -L users.txt -P pass.txt 192.168.1.1 ssh",
        "hydra -l admin -P passwords.txt ftp://192.168.1.1",
      ],
      outputParser: "text",
    },
  },

  // ===== ACTIVE DIRECTORY TOOLS =====
  {
    name: "BloodHound",
    category: "active_directory",
    description: "Active Directory relationship mapper. Reveals hidden relationships and attack paths in AD environments.",
    command: "bloodhound-python",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        domain: { required: true, type: "string", description: "Domain to enumerate" },
        username: { required: true, type: "string", description: "Username for authentication" },
        password: { required: false, type: "string", description: "Password" },
        dc: { required: false, type: "string", description: "Domain controller IP" },
        collectionMethod: { required: false, type: "string", description: "Collection methods (Default, All, etc.)" },
      },
      commandTemplate: "bloodhound-python -d {domain} -u {username} -p {password} -dc {dc} -c {collectionMethod}",
      examples: [
        "bloodhound-python -d contoso.local -u user -p pass -dc 10.0.0.1 -c All",
      ],
      outputParser: "json",
    },
  },
  {
    name: "Impacket",
    category: "active_directory",
    description: "Collection of Python classes for working with network protocols. Essential for Windows/AD penetration testing.",
    command: "impacket",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      tools: {
        psexec: "impacket-psexec",
        smbexec: "impacket-smbexec",
        wmiexec: "impacket-wmiexec",
        secretsdump: "impacket-secretsdump",
        GetNPUsers: "impacket-GetNPUsers",
        GetUserSPNs: "impacket-GetUserSPNs",
      },
      examples: [
        "impacket-secretsdump domain/user:pass@192.168.1.1",
        "impacket-psexec domain/user:pass@192.168.1.1",
      ],
      outputParser: "text",
    },
  },

  // ===== POST-EXPLOITATION TOOLS =====
  {
    name: "PowerSploit",
    category: "post_exploitation",
    description: "PowerShell post-exploitation framework. Collection of Microsoft PowerShell modules for penetration testing.",
    command: "pwsh",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      installPath: "/opt/tools/PowerSploit",
      parameterSchema: {
        module: { required: true, type: "string", description: "PowerSploit module to load" },
        command: { required: true, type: "string", description: "PowerShell command to execute" },
      },
      commandTemplate: "pwsh -Command 'Import-Module /opt/tools/PowerSploit/{module}; {command}'",
      examples: [
        "pwsh -Command 'Import-Module /opt/tools/PowerSploit/Recon/Recon.psm1; Invoke-Portscan'",
      ],
      outputParser: "text",
    },
  },
  {
    name: "WinPwn",
    category: "post_exploitation",
    description: "Windows post-exploitation toolkit. Automation for internal penetration testing.",
    command: "pwsh",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      installPath: "/opt/tools/WinPwn",
      examples: [
        "pwsh -Command 'Import-Module /opt/tools/WinPwn/WinPwn.ps1'",
      ],
      outputParser: "text",
    },
  },

  // ===== NETWORK ANALYSIS TOOLS =====
  {
    name: "Wireshark (tshark)",
    category: "network_analysis",
    description: "Network protocol analyzer. Capture and analyze network traffic.",
    command: "tshark",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        interface: { required: false, type: "string", description: "Network interface" },
        filter: { required: false, type: "string", description: "Capture filter" },
        readFile: { required: false, type: "string", description: "Read from pcap file" },
        writeFile: { required: false, type: "string", description: "Write to pcap file" },
      },
      commandTemplate: "tshark -i {interface} -f '{filter}' -r {readFile} -w {writeFile}",
      examples: [
        "tshark -i eth0 -f 'port 80'",
        "tshark -r capture.pcap -Y 'http.request'",
      ],
      outputParser: "text",
    },
  },
  {
    name: "Proxychains",
    category: "network_analysis",
    description: "Force any TCP connection through proxy chains. Useful for anonymity and pivoting.",
    command: "proxychains4",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        command: { required: true, type: "string", description: "Command to run through proxy" },
      },
      commandTemplate: "proxychains4 {command}",
      examples: [
        "proxychains4 nmap -sT 192.168.1.1",
        "proxychains4 curl http://target.com",
      ],
      outputParser: "text",
    },
  },

  // ===== WEB APPLICATION TOOLS =====
  {
    name: "Gobuster",
    category: "web_application",
    description: "Directory/file & DNS busting tool written in Go. Fast brute forcing for web directories and DNS subdomains.",
    command: "gobuster",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        mode: { required: true, type: "string", description: "Mode (dir, dns, vhost)" },
        url: { required: false, type: "string", description: "Target URL (for dir mode)" },
        domain: { required: false, type: "string", description: "Target domain (for dns mode)" },
        wordlist: { required: true, type: "string", description: "Wordlist path" },
        extensions: { required: false, type: "string", description: "File extensions (e.g., -x php,html)" },
      },
      commandTemplate: "gobuster {mode} -u {url} -d {domain} -w {wordlist} {extensions}",
      examples: [
        "gobuster dir -u http://target.com -w /usr/share/wordlists/dirb/common.txt",
        "gobuster dns -d target.com -w /usr/share/wordlists/subdomains.txt",
      ],
      outputParser: "text",
    },
  },

  // ===== DEVELOPMENT/SCRIPTING TOOLS =====
  {
    name: "Python3",
    category: "development",
    description: "Python programming language. For custom script development and tool execution.",
    command: "python3",
    dockerImage: "rtpi-tools",
    version: "3.10",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        script: { required: false, type: "string", description: "Python script path" },
        code: { required: false, type: "string", description: "Python code to execute" },
      },
      commandTemplate: "python3 {script} -c '{code}'",
      examples: [
        "python3 /opt/tools/custom/scanner.py",
        "python3 -c 'import socket; print(socket.gethostbyname(\"target.com\"))'",
      ],
      outputParser: "text",
    },
  },
  {
    name: "PowerShell",
    category: "development",
    description: "PowerShell Core. Cross-platform automation and scripting language.",
    command: "pwsh",
    dockerImage: "rtpi-tools",
    version: "7.x",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        script: { required: false, type: "string", description: "PowerShell script path" },
        command: { required: false, type: "string", description: "PowerShell command to execute" },
      },
      commandTemplate: "pwsh -File {script} -Command '{command}'",
      examples: [
        "pwsh -Command 'Get-Process'",
        "pwsh -File /opt/tools/custom/scan.ps1",
      ],
      outputParser: "text",
    },
  },
  {
    name: "Node.js",
    category: "development",
    description: "Node.js JavaScript runtime. For executing JavaScript-based security tools and scripts.",
    command: "node",
    dockerImage: "rtpi-tools",
    version: "LTS",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        script: { required: false, type: "string", description: "JavaScript file path" },
        code: { required: false, type: "string", description: "JavaScript code to execute" },
      },
      commandTemplate: "node {script} -e '{code}'",
      examples: [
        "node /opt/tools/custom/scanner.js",
        "node -e 'console.log(\"Hello from Node\")'",
      ],
      outputParser: "text",
    },
  },

  // ===== SSL/TLS TOOLS =====
  {
    name: "Certbot",
    category: "ssl_tls",
    description: "Let's Encrypt certificate management tool. Useful for SSL/TLS testing and certificate operations.",
    command: "certbot",
    dockerImage: "rtpi-tools",
    status: "available" as const,
    metadata: {
      parameterSchema: {
        command: { required: true, type: "string", description: "Certbot command (certificates, renew, etc.)" },
        domain: { required: false, type: "string", description: "Domain name" },
      },
      commandTemplate: "certbot {command} {domain}",
      examples: [
        "certbot certificates",
      ],
      outputParser: "text",
    },
  },
];

async function seedTools() {
  try {
    console.log("🌱 Seeding security tools...");
    
    // Clear existing tools
    await db.delete(securityTools);
    console.log("✓ Cleared existing tools");

    // Insert new tools
    let inserted = 0;
    for (const tool of toolsData) {
      await db.insert(securityTools).values(tool);
      inserted++;
      console.log(`✓ Added: ${tool.name} (${tool.category})`);
    }

    console.log(`\n✅ Successfully seeded ${inserted} security tools!`);
    console.log("\nTools by category:");
    
    const categories = Array.from(new Set(toolsData.map(t => t.category)));
    for (const category of categories) {
      const count = toolsData.filter(t => t.category === category).length;
      console.log(`  - ${category}: ${count} tools`);
    }
  } catch (error) {
    console.error("❌ Error seeding tools:", error);
    process.exit(1);
  }
}

// Run the seeder
seedTools()
  .then(() => {
    console.log("\n🎉 Tool seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
