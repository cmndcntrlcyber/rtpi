---
name: Searchsploit
description: Offline CLI search tool for Exploit-DB's exploit and shellcode
  archive; quickly find public exploits by software, version, or CVE.
registry: registry
tool_id: searchsploit
category: exploitation
tags:
  - exploit-search
  - exploit-db
  - vulnerability-research
  - cve-lookup
  - offline-search
  - red-team
  - exploitation
mitre_techniques:
  - T1595.002
  - T1588.005
summary: 'searchsploit is the command-line interface to Exploit-DB, maintained
  by Offensive Security. It searches a local copy of the exploit database
  offline, essential for air-gapped or segregated networks. Invoke with one or
  more search terms (software names, versions, CVE IDs). Default search is
  case-insensitive AND logic across terms, checking both exploit title and file
  path. Use `-t` to search titles only (reduces false positives from path
  matches). Use `-e` for exact title match (implies `-t`). Use `--cve
  CVE-YYYY-NNNNN` to search by CVE ID. Use `--exclude="term1|term2"` to filter
  out unwanted results (e.g., DoS or PoC entries). Results display exploit title
  and local file path. Use `-m <EDB-ID>` to mirror (copy) an exploit to your
  current directory. Use `-x <EDB-ID>` to examine exploit code with $PAGER. Use
  `-p <EDB-ID>` to show full path (copies to clipboard if possible). Use `-w` to
  display Exploit-DB URLs instead of local paths. Use `-j` for JSON output.
  Update database with `-u` before engagements. Output includes EDB-ID,
  description, and path. Always verify exploit applicability and test in lab
  before operational use. Critical: searchsploit searches exploits and shellcode
  only, not GHDB or papers (unless manually configured). Version-specific
  searches are fuzzy by default; use `-s` for strict matching. Exploits may
  reference binary files in a separate repository not included in standard
  install.'
sources:
  - https://hackviser.com/tactics/tools/searchsploit
  - https://github.com/rad10/SearchSploit.py/blob/master/README.md
  - https://www.kali.org/tools/exploitdb/
  - https://www.exploit-db.com/searchsploit
  - https://medium.com/@redfanatic7/discover-exploits-easily-and-quickly-with-searchsploit-4f77da58fe42
  - https://github.com/SploitHQ/searchsploit
  - https://www.exploit-db.com/documentation/Offsec-SearchSploit.pdf
  - https://www.adamcouch.co.uk/searchsploit-command-line-shortcut-options-m-and-x/
  - https://www.penligent.ai/hackinglabs/the-definitive-guide-to-exploit-db-attack-patterns-cves-and-defense-strategies/
  - https://www.redfoxsec.com/blog/red-team-attack-methodology-a-complete-guide-to-adversarial-penetration-testing
  - https://www.rapid7.com/blog/post/2016/06/23/penetration-testing-vs-red-teaming-the-age-old-debate-of-pirates-vs-ninja-continues/
  - https://www.sprocketsecurity.com/blog/red-teaming-best-practices
generated_at: 2026-05-19T11:14:46.398Z
generated_by: anthropic
source_hash: e2990fd610367d97ff47c6de305a2faf0538a3ccc1315196f0aa2015075a529a
---

# Searchsploit

## Overview

searchsploit is the offline command-line search utility for Exploit-DB, a public archive of exploits, shellcodes, and proof-of-concept code maintained by Offensive Security. It enables penetration testers and red teams to query a local copy of the exploit database without Internet connectivity, critical for air-gapped or restricted network assessments. The tool indexes exploit titles, file paths, CVE identifiers, and metadata, returning matching entries with local file paths or Exploit-DB URLs.

## When to use

Use searchsploit during reconnaissance and exploitation phases when you have identified software names, versions, or CVE numbers from target systems. Invoke it after enumeration (nmap service detection, banner grabbing, web app fingerprinting) to discover publicly available exploits. Essential for offline assessments, rapid exploit discovery during engagements, and validating whether known vulnerabilities have public exploit code. Use to cross-reference vulnerability scanner findings with weaponized exploits. Integrate into automated recon workflows to check service versions against exploit databases. Do NOT use as primary vulnerability assessment tool; it only reveals publicly disclosed exploits, not zero-days or undisclosed vulnerabilities.

## Authentication & setup

No authentication required. searchsploit ships with Kali Linux and is pre-configured. For manual installation, clone the Exploit-DB repository from GitLab and ensure searchsploit binary is in PATH (/usr/local/bin/searchsploit in RTPI). Update the local database before each engagement with `searchsploit -u` (requires Internet; updates via apt on Kali or git pull on manual installs). Verify installation with `searchsploit -h`. No credentials, API keys, or configuration files needed. The tool reads from /usr/share/exploitdb/ by default (Kali) or the cloned repository location. Note: binary exploits are in a separate repository; clone exploit-database-bin-sploits if you need those files for air-gapped use.

## Key commands / parameters

`searchsploit <term1> <term2> ...` — Basic search with AND logic, case-insensitive, searches title and path.
`searchsploit -t <terms>` — Search title only (excludes path from match; reduces false positives).
`searchsploit -e "exact phrase"` — Exact match on title (implies -t; order matters, e.g., "WordPress 4.1" won't match "WordPress Core 4.1").
`searchsploit -c <terms>` — Case-sensitive search.
`searchsploit -s <terms>` — Strict search; input values must exist exactly (disables fuzzy version matching).
`searchsploit --cve CVE-2021-44228` — Search by CVE identifier.
`searchsploit --exclude="term1|term2"` — Remove results containing specified terms (chain with pipe; useful for filtering DoS, PoC, or specific platforms).
`searchsploit -m 12345` — Mirror (copy) exploit EDB-ID 12345 to current working directory.
`searchsploit -x 12345` — Examine exploit 12345 with $PAGER (less/more).
`searchsploit -p 12345` — Show full path to exploit 12345 (copies to clipboard if xclip/pbcopy available).
`searchsploit -w <terms>` — Display Exploit-DB URLs instead of local paths.
`searchsploit -j <terms>` — JSON output format.
`searchsploit --nmap <file.xml>` — Parse Nmap XML and search for exploits matching detected service versions (use with -v for verbose).
`searchsploit -o <terms>` — Allow exploit titles to overflow columns (better readability for long titles).
`searchsploit --id` — Display EDB-ID instead of local path in results.
`searchsploit -u` — Update local exploit database (run before engagements).

## Example workflows

**1. Enumerate and search:** After `nmap -sV` reveals Apache 2.4.49, run `searchsploit apache 2.4.49` to find CVE-2021-41773 path traversal exploit. Use `searchsploit -m 50383` to copy exploit to working directory.

**2. CVE-based search:** Client reports CVE-2021-44228 (Log4Shell) in scope. Run `searchsploit --cve CVE-2021-44228` to retrieve all related exploits. Use `searchsploit -w --cve CVE-2021-44228` to get Exploit-DB URLs for report citations.

**3. Filter noise:** Searching `searchsploit windows kernel` returns many DoS entries. Refine with `searchsploit windows kernel --exclude="DoS|Denial of Service"` to focus on privilege escalation and RCE.

**4. Exact version match:** Service banner shows "ProFTPD 1.3.5". Run `searchsploit -e "ProFTPD 1.3.5"` for exact match, then `searchsploit -t proftpd 1.3` for broader search if no results.

**5. Automated Nmap integration:** Save Nmap scan `nmap -sV -oX scan.xml 10.0.0.0/24`, then run `searchsploit --nmap scan.xml` to automatically search for exploits matching all detected service versions.

**6. Examine before use:** Find exploit with `searchsploit afd windows local`, note EDB-ID 40564, examine code with `searchsploit -x 40564` to verify applicability and required conditions before testing.

## Output format

Default output is plain text table format with columns: exploit title (including version/platform info), pipe separator, and local file path relative to exploitdb directory. Paths typically format as `/<platform>/<type>/<EDB-ID>.<ext>` (e.g., `/linux/local/12345.c` or `/windows/remote/67890.py`). When using `-w`, output shows full Exploit-DB URLs (`https://www.exploit-db.com/exploits/<EDB-ID>`). With `-j`, output is JSON array of objects containing fields: Title, Path, EDB-ID (when --id used). With `-p`, outputs single line with full absolute path to exploit file. No output means no matches found (check spelling, update database with -u, or broaden search terms). Results include CVE references in title when available. Use `-o` if titles are truncated.

## Common pitfalls

**Stale database:** Not updating with `searchsploit -u` before engagements leads to missed recent exploits (update requires Internet; do this during planning phase).

**Over-reliance on fuzzy matching:** Default search is broad; "kernel 3.2" matches 3.2.x but also paths containing those terms. Use `-t` to search titles only and `-s` for strict version matching.

**Ignoring exploit prerequisites:** Exploits often require specific conditions (auth, local access, configurations). Always examine code with `-x` before assuming applicability.

**Version mismatch assumptions:** searchsploit finding an exploit for "Apache 2.4.x" does not guarantee it works on target's exact patch level. Verify CVE details and test safely.

**Missing binary exploits:** Standard repository excludes large binary files. If exploit references missing binaries, check exploit-database-bin-sploits repository.

**No GHDB or papers:** searchsploit only searches exploits/shellcodes by default, not Google Hacking Database or research papers (requires manual configuration).

**False positives from path matching:** Searching version numbers matches file paths; use `-t` to limit search to titles only.

**Assuming exploit quality:** Exploit-DB entries range from full working exploits to partial PoCs. Read the code; many require modification, compilation, or specific target configurations.

**Clipboard copy failure:** `-p` clipboard feature requires xclip (Linux) or pbcopy (Mac); may silently fail if not installed.

**JSON parsing:** `-j` output is not always valid JSON if special characters in titles; pipe through `jq` for validation.

## References

• https://www.exploit-db.com/searchsploit
• https://www.exploit-db.com/documentation/Offsec-SearchSploit.pdf
• https://hackviser.com/tactics/tools/searchsploit
• https://www.kali.org/tools/exploitdb/
• https://github.com/rad10/SearchSploit.py/blob/master/README.md
• https://www.adamcouch.co.uk/searchsploit-command-line-shortcut-options-m-and-x/
• https://medium.com/@redfanatic7/discover-exploits-easily-and-quickly-with-searchsploit-4f77da58fe42
