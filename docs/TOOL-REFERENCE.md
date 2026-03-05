# RTPI Tool Reference

Comprehensive reference for all security tools in the RTPI Tool Registry. Each entry documents the tool's help command, required parameters, target type, and usage patterns. This document is used by:
- **tool-tester.ts** — validates tool installation via help command
- **AI command generation** — builds correct commands for each tool + target
- **Tool Registry UI** — displays required fields on tool cards

---

## Reference Table

| Tool | Binary | Help Flag | Exit Code | Verify String | Required Params | Target Type | Container |
|------|--------|-----------|-----------|---------------|-----------------|-------------|-----------|
| Nmap | `nmap` | `-h` | 0 | `Nmap` | `{target}` | ip/cidr/hostname | rtpi-tools |
| NBTscan | `nbtscan` | `-h` | 0 | `NBTscan` | `{target}` | ip/cidr | rtpi-tools |
| BBOT | `bbot` | `-h` | 0 | `usage: bbot` | `-t TARGET` | domain | rtpi-tools |
| Nuclei | `nuclei` | `-h` | 0 | `Nuclei` | `-u URL` or `-l list` | url | rtpi-tools |
| Metasploit | `msfconsole` | `-h` | 0 | `Usage: msfconsole` | (interactive) | n/a | rtpi-tools |
| SearchSploit | `searchsploit` | `-h` | 2 | `Usage: searchsploit` | `term` | keyword | rtpi-tools |
| Hashcat | `hashcat` | `--help` | 0 | `hashcat` | `-m type -a mode hash wordlist` | hash file | rtpi-tools |
| Hydra | `hydra` | `-h` | 0 | `Hydra` | `target service` | ip + service | rtpi-tools |
| BloodHound.py | `bloodhound-python` | `-h` | 0 | `usage: bloodhound` | `-d domain -u user -p pass` | domain | rtpi-tools |
| Impacket | `impacket-secretsdump` | `-h` | 0 | `Impacket v` | `target` | ip/domain | rtpi-tools |
| TShark | `tshark` | `-h` | 0 | `TShark (Wireshark)` | `-i interface` (optional) | interface | rtpi-tools |
| Proxychains | `proxychains4` | `--help` | 1 | `Usage:` | `program [args]` | command | rtpi-tools |
| Gobuster | `gobuster` | `--help` | 0 | `Usage:` | `dir -u URL -w wordlist` | url | rtpi-tools |
| Python3 | `python3` | `--help` | 0 | `usage: python` | `script.py` | file | rtpi-tools |
| PowerShell | `pwsh` | `--help` | 0 | `PowerShell` | `-File script.ps1` | file | rtpi-tools |
| Node.js | `node` | `--help` | 0 | `Usage: node` | `script.js` | file | rtpi-tools |
| Certbot | `certbot` | `--help` | 0 | `certbot` | `certonly -d domain` | domain | rtpi-tools |
| Nikto | `nikto` | `-H` | 0 | `Nikto` | `-h host` | url/ip | rtpi-tools |
| WPScan | `wpscan` | `--help` | 0 | `WordPress Security Scanner` | `--url URL` | url | rtpi-tools |
| Ffuf | `ffuf` | `-h` | 0 | `Fuzz Faster` | `-u URL -w wordlist` | url | rtpi-tools |
| Feroxbuster | `feroxbuster` | `--help` | 0 | `feroxbuster` | `-u URL` | url | rtpi-tools |
| Amass | `amass` | `-h` | 0 | `amass` | `enum -d domain` | domain | rtpi-tools |
| Subfinder | `subfinder` | `-h` | 0 | `subfinder` | `-d domain` | domain | rtpi-tools |
| Httpx | `httpx` | `-h` | 0 | `httpx` | `-u URL` or stdin | url | rtpi-tools |
| Katana | `katana` | `-h` | 0 | `katana` | `-u URL` | url | rtpi-tools |
| Dirsearch | `dirsearch` | `--help` | 0 | `dirsearch` | `-u URL` | url | rtpi-tools |
| Dnsx | `dnsx` | `-h` | 0 | `dnsx` | `-l list` or `-d domain` | domain | rtpi-tools |
| X8 | `x8` | `--help` | 0 | `x8` | `-u URL -w wordlist` | url | rtpi-tools |
| Enum4linux | `enum4linux` | `-h` | 0 | `enum4linux` | `target` | ip | rtpi-tools |
| NetExec (NXC) | `nxc` | `--help` | 0 | `nxc` | `protocol target` | ip | rtpi-tools |
| Testssl.sh | `testssl.sh` | `--help` | 0 | `testssl` | `URI` | url/ip:port | rtpi-tools |
| Evil-WinRM | `evil-winrm` | `-h` | 0 | `Evil-WinRM` | `-i IP -u USER` | ip | rtpi-tools |
| Masscan | `masscan` | `--help` | 0 | `usage: masscan` | `target -p ports` | ip/cidr | rtpi-tools |

---

## Detailed Tool Entries

### Nmap
- **Category**: reconnaissance
- **Help**: `nmap -h`
- **Required**: Target IP, CIDR, or hostname (positional argument)
- **Usage**: `nmap -sV -sC -p- 192.168.1.1`
- **Common Flags**: `-sV` (version detection), `-sC` (scripts), `-p` (ports), `-A` (aggressive), `-oA` (output all formats)

### Ffuf
- **Category**: web / fuzzing
- **Help**: `ffuf -h`
- **Required**: `-u URL` (with FUZZ keyword), `-w wordlist`
- **Usage**: `ffuf -u http://target.com/FUZZ -w /usr/share/wordlists/dirb/common.txt`
- **Common Flags**: `-mc` (match codes), `-fs` (filter size), `-fc` (filter codes), `-H` (headers), `-X` (method)

### Nuclei
- **Category**: vulnerability
- **Help**: `nuclei -h`
- **Required**: `-u URL` or `-l list_file`
- **Usage**: `nuclei -u https://target.com -t cves/`
- **Common Flags**: `-t` (templates), `-severity` (filter), `-o` (output), `-j` (JSON), `-silent`

### Gobuster
- **Category**: web
- **Help**: `gobuster --help`
- **Required**: Mode (`dir`/`dns`/`vhost`), `-u URL`, `-w wordlist`
- **Usage**: `gobuster dir -u http://target.com -w /usr/share/wordlists/dirb/common.txt`
- **Common Flags**: `-t` (threads), `-x` (extensions), `-s` (status codes), `-o` (output)

### Nikto
- **Category**: web
- **Help**: `nikto -H`
- **Required**: `-h host` (URL or IP)
- **Usage**: `nikto -h http://target.com -p 8080`
- **Common Flags**: `-p` (port), `-ssl`, `-o` (output), `-Format` (output format)

### Hydra
- **Category**: password-cracking
- **Help**: `hydra -h`
- **Required**: Target server, service protocol
- **Usage**: `hydra -l admin -P /usr/share/wordlists/rockyou.txt 192.168.1.1 ssh`
- **Common Flags**: `-l`/`-L` (login/list), `-p`/`-P` (password/list), `-t` (tasks), `-f` (stop on first)

### Hashcat
- **Category**: password-cracking
- **Help**: `hashcat --help`
- **Required**: `-m hash_type`, `-a attack_mode`, hash file, wordlist
- **Usage**: `hashcat -m 0 -a 0 hashes.txt /usr/share/wordlists/rockyou.txt`
- **Common Flags**: `-o` (output), `--show` (show cracked), `-r` (rules), `-w` (workload)

### WPScan
- **Category**: cms
- **Help**: `wpscan --help`
- **Required**: `--url URL`
- **Usage**: `wpscan --url http://target.com --enumerate vp,u`
- **Common Flags**: `--enumerate` (vp/u/ap), `--api-token`, `--plugins-detection`, `--force`

### Subfinder
- **Category**: reconnaissance
- **Help**: `subfinder -h`
- **Required**: `-d domain`
- **Usage**: `subfinder -d target.com -o subdomains.txt`
- **Common Flags**: `-o` (output), `-silent`, `-all` (all sources), `-nW` (no wildcard)

### Amass
- **Category**: reconnaissance
- **Help**: `amass -h`
- **Required**: Subcommand (`enum`/`intel`), `-d domain`
- **Usage**: `amass enum -d target.com -passive`
- **Common Flags**: `-passive`, `-brute`, `-o` (output), `-config` (config file)

### Httpx
- **Category**: web-recon
- **Help**: `httpx -h`
- **Required**: `-u URL` or `-l list` or stdin
- **Usage**: `echo target.com | httpx -title -status-code -tech-detect`
- **Common Flags**: `-sc` (status code), `-title`, `-td` (tech detect), `-mc` (match code)

### Katana
- **Category**: web-recon
- **Help**: `katana -h`
- **Required**: `-u URL`
- **Usage**: `katana -u https://target.com -d 3 -jc`
- **Common Flags**: `-d` (depth), `-jc` (JS crawl), `-f` (fields), `-silent`

### Feroxbuster
- **Category**: web
- **Help**: `feroxbuster --help`
- **Required**: `-u URL`
- **Usage**: `feroxbuster -u http://target.com -w /usr/share/wordlists/dirb/common.txt`
- **Common Flags**: `-w` (wordlist), `-x` (extensions), `-t` (threads), `--burp` (proxy)

### Dirsearch
- **Category**: web
- **Help**: `dirsearch --help`
- **Required**: `-u URL`
- **Usage**: `dirsearch -u http://target.com -e php,html,txt`
- **Common Flags**: `-e` (extensions), `-x` (exclude codes), `-t` (threads), `-r` (recursive)

### X8
- **Category**: web
- **Help**: `x8 --help`
- **Required**: `-u URL`, `-w wordlist`
- **Usage**: `x8 -u http://target.com/api -w params.txt`
- **Common Flags**: `--as-body`, `--follow-redirects`, `--encode`

### Enum4linux
- **Category**: enumeration
- **Help**: `enum4linux -h`
- **Required**: Target IP (positional)
- **Usage**: `enum4linux -a 192.168.1.1`
- **Common Flags**: `-a` (all simple enum), `-U` (users), `-o` (OS info), `-v` (verbose)

### NetExec (NXC)
- **Category**: post-exploitation
- **Help**: `nxc --help`
- **Required**: Protocol (`smb`/`ldap`/`ssh`/etc.), target
- **Usage**: `nxc smb 192.168.1.0/24 -u admin -p password`
- **Common Flags**: `-u`/`-p` (creds), `--users`, `--shares`, `-x` (command exec)

### Testssl.sh
- **Category**: network / security-scanning
- **Help**: `testssl.sh --help`
- **Required**: URI (positional, last argument)
- **Usage**: `testssl.sh --wide https://target.com`
- **Common Flags**: `--wide`, `-t` (STARTTLS), `-oA` (output all), `--parallel`

### Evil-WinRM
- **Category**: post-exploitation
- **Help**: `evil-winrm -h`
- **Required**: `-i IP`, `-u USER`
- **Usage**: `evil-winrm -i 192.168.1.1 -u admin -p password`
- **Common Flags**: `-p` (password), `-H` (hash), `-s` (scripts), `-e` (executables)

### BloodHound.py
- **Category**: active-directory
- **Help**: `bloodhound-python -h`
- **Required**: `-d domain`, `-u user`, `-p password`
- **Usage**: `bloodhound-python -d corp.local -u user -p pass -c All`
- **Common Flags**: `-c` (collection method), `-ns` (nameserver), `-dc` (domain controller)

### Impacket-Secretsdump
- **Category**: post-exploitation
- **Help**: `impacket-secretsdump -h`
- **Required**: Target (positional: `domain/user:pass@target`)
- **Usage**: `impacket-secretsdump domain/admin:password@192.168.1.1`
- **Common Flags**: `-just-dc` (DC only), `-outputfile` (output), `-history` (password history)

### Masscan
- **Category**: discovery
- **Help**: `masscan --help`
- **Required**: Target IP/CIDR, `-p ports`
- **Usage**: `masscan 192.168.1.0/24 -p1-65535 --rate 1000`
- **Common Flags**: `--rate` (packets/sec), `-oJ` (JSON output), `--banners`

### BBOT
- **Category**: reconnaissance
- **Help**: `bbot -h`
- **Required**: `-t TARGET`
- **Usage**: `bbot -t target.com -f subdomain-enum`
- **Common Flags**: `-f` (flags/presets), `-o` (output), `-m` (modules)

### SearchSploit
- **Category**: exploitation
- **Help**: `searchsploit -h` (exit code: 2)
- **Required**: Search term (positional)
- **Usage**: `searchsploit apache 2.4`
- **Common Flags**: `-w` (URL), `-j` (JSON), `-m` (copy exploit), `--nmap` (parse nmap XML)

### Dnsx
- **Category**: reconnaissance
- **Help**: `dnsx -h`
- **Required**: `-l list` or `-d domain` (with `-w wordlist`)
- **Usage**: `dnsx -d target.com -w dns_wordlist.txt -a -resp`
- **Common Flags**: `-a`/`-aaaa`/`-cname` (record types), `-resp` (show response), `-silent`

### TShark
- **Category**: network
- **Help**: `tshark -h`
- **Required**: (optional: `-i interface`)
- **Usage**: `tshark -i eth0 -f "tcp port 80" -w capture.pcap`
- **Common Flags**: `-i` (interface), `-f` (capture filter), `-Y` (display filter), `-w` (write)

### Proxychains
- **Category**: proxy
- **Help**: `proxychains4 --help` (exit code: 1)
- **Required**: Program to proxy (positional)
- **Usage**: `proxychains4 nmap -sT -Pn 192.168.1.1`
- **Common Flags**: `-q` (quiet), `-f` (config file)
