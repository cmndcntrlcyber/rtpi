---
name: Wpscan
description: Black-box WordPress security scanner for enumeration, vulnerability
  detection, and brute-force testing.
registry: registry
tool_id: wpscan
category: cms
tags:
  - wordpress
  - cms
  - vulnerability-scanner
  - enumeration
  - web-security
  - black-box
  - wpscan
mitre_techniques:
  - T1595.002
  - T1590.002
  - T1110.001
summary: "WPScan is a CLI black-box scanner targeting WordPress sites. Invoke
  via `/usr/local/bin/wpscan --url <TARGET>` for basic scanning. Use
  `--enumerate` flag with options (vp=vulnerable plugins, vt=vulnerable themes,
  u=users, ap=all plugins, at=all themes, tt=timthumbs, cb=config backups,
  dbe=database exports, m=media) to discover attack surface. Default enumeration
  is vp,vt,tt,cb,dbe,u,m. Provide `--api-token` for vulnerability data (free
  tier: 25 requests/day from wpscan.com). Plugin/theme detection modes: passive
  (stealthy), aggressive (comprehensive), mixed (default). Use
  `--plugins-detection aggressive` for thorough enumeration. Common actions:
  user enumeration (`-e u`), password brute-force (`--passwords <wordlist>`),
  vulnerable component discovery (`-e vp,vt`). Outputs to stdout with version
  info, installed components, vulnerabilities (if API token provided), and
  security misconfigurations. Use `--throttle <ms>` to avoid detection/overload.
  Proxy support via `--proxy`. Useful for WordPress pentesting, security
  assessment, and pre-exploitation reconnaissance. Does not require
  authentication or source code access. Expect noisy scanning; plan for rate
  limiting or WAF blocks. Always obtain authorization before scanning."
sources:
  - https://hackviser.com/tactics/tools/wpcan
  - https://www.kali.org/tools/wpscan/
  - https://wpscan.com/wordpress-cli-scanner/
  - https://github.com/wpscanteam/wpscan/wiki/WPScan-User-Documentation
  - https://www.freecodecamp.org/news/how-to-use-wpscan-to-keep-your-wordpress-site-secure/
  - https://oneuptime.com/blog/post/2026-03-02-use-wpscan-wordpress-security-scanning-ubuntu/view
  - https://blog.sucuri.net/2023/12/wpscan-intro-how-to-scan-for-wordpress-vulnerabilities.html
  - https://melapress.com/how-to-use-wpscan/?srsltid=AfmBOop3y0y-HOzEvFDyRZVlg02YXGmor6IjoGeupV8_d02Uhm5bApmx
  - https://melapress.com/how-to-use-wpscan/?srsltid=AfmBOooLJpquKYTShPnfZfVlm5aa8yxiGO-nwjOtwVICvM5sRKP2_6zU
  - https://www.techtarget.com/searchsecurity/tip/Red-teams-and-AI-Ways-to-use-LLMs-for-penetration-testing
  - https://pentest-tools.com/cms-vulnerability-scanning/wordpress-scanner-online-wpscan
  - https://www.bugcrowd.com/glossary/wpscan-security-scanner/
generated_at: 2026-05-19T11:13:37.979Z
generated_by: anthropic
source_hash: f91e39d552455a123193143018784d30e256cf2bed72e7a3173945f7f1fea9d0
---

# Wpscan

## Overview

WPScan is a Ruby-based black-box WordPress security scanner written for security professionals and pentesters. It identifies WordPress core/plugin/theme versions, detects known vulnerabilities via the WPScan vulnerability database (wpvulndb.com), enumerates users, discovers misconfigurations (exposed config backups, database dumps), and performs password brute-forcing. Originally released in 2011, it is GPLv3 licensed and widely deployed in offensive security workflows. WPScan operates remotely without requiring authentication or source code access, simulating an external attacker's reconnaissance and exploitation path.

## When to use

Use WPScan when the target is confirmed or suspected to be WordPress. Ideal for: initial reconnaissance to fingerprint WordPress version and installed components; identifying vulnerable plugins/themes before exploit development; enumerating valid usernames for credential attacks; discovering exposed sensitive files (wp-config.php backups, database exports); testing weak passwords on discovered accounts; auditing WordPress hardening posture. Deploy during web application assessments, CMS-specific testing phases, or when targeting known WordPress installations. WPScan is purpose-built for WordPress and will not be effective against other CMS platforms.

## Authentication & setup

No authentication required for basic scanning. For enhanced vulnerability reporting, obtain a free API token from wpscan.com (register account, retrieve token from dashboard). Free tier provides 25 API requests/day. Supply token via `--api-token <TOKEN>` flag or store in config file to enable real-time vulnerability data retrieval. Without an API token, WPScan will still enumerate components but will not display associated CVEs or vulnerability details. Tool is pre-installed at `/usr/local/bin/wpscan` in RTPI. Verify version with `wpscan --version`. Update vulnerability database with `wpscan --update` (requires write permissions). No target-side credentials needed for black-box scanning; brute-force attacks require a wordlist file.

## Key commands / parameters

`wpscan --url <URL>` - Basic scan (mandatory URL parameter, supports http/https). `--enumerate <OPTIONS>` - Enumeration mode: vp (vulnerable plugins), ap (all plugins), p (popular plugins), vt (vulnerable themes), at (all themes), t (popular themes), tt (timthumbs), cb (config backups), dbe (database exports), u (users), m (media). Combine with commas: `-e vp,vt,u`. Default if no option: vp,vt,tt,cb,dbe,u,m. `--plugins-detection <MODE>` - Detection mode: passive (stealthy, fewer requests), aggressive (comprehensive, many requests), mixed (default, balanced). `--api-token <TOKEN>` - Enable vulnerability data from WPScan API. `--passwords <FILE>` - Brute-force passwords for enumerated users using wordlist. `--proxy <protocol://IP:port>` - Route traffic through proxy. `--user-agent <STRING>` - Custom User-Agent to evade detection. `--random-user-agent` - Randomize User-Agent per request. `--throttle <ms>` - Delay between requests in milliseconds (avoid rate limiting). `--cookie-string <COOKIE>` - Supply authentication cookies. `--disable-tls-checks` - Ignore SSL/TLS certificate errors. `--force` - Skip WordPress detection check. `--http-auth <user:pass>` - HTTP Basic Auth credentials. `--connect-timeout <SECONDS>` - Connection timeout (default 30). `-v, --verbose` - Increase output verbosity. `--help` - Display help. `--version` - Display version.

## Example workflows

**Basic reconnaissance:** `wpscan --url https://target.com` (identifies WordPress version, theme, basic config). **Comprehensive enumeration with vulnerabilities:** `wpscan --url https://target.com --api-token <TOKEN> -e ap,at,u --plugins-detection aggressive` (all plugins/themes, users, with vulnerability data). **Stealth user enumeration:** `wpscan --url https://target.com -e u --plugins-detection passive --random-user-agent --throttle 1000`. **Password brute-force:** First enumerate users `wpscan --url https://target.com -e u`, then `wpscan --url https://target.com --passwords /path/to/rockyou.txt` (targets all enumerated users). **Check specific vulnerabilities:** `wpscan --url https://target.com --api-token <TOKEN> -e vp,vt` (only vulnerable plugins/themes). **Proxy + custom headers:** `wpscan --url https://target.com --proxy http://127.0.0.1:8080 --cookie-string 'session=abc123'` (route through Burp for traffic inspection). **Staging site with auth:** `wpscan --url https://staging.target.com --http-auth admin:password123 -e ap`. **Full audit script:** Combine enumeration, save output: `wpscan --url https://target.com --api-token <TOKEN> -e vp,vt,u,tt,cb,dbe --plugins-detection mixed -v > wpscan_results.txt`.

## Output format

WPScan writes to stdout with structured sections. Typical output includes: banner with version info, target URL confirmation, WordPress version detection (with confidence level), installed theme(s) with version and location, enumerated plugins/themes (name, version, location, last updated, vulnerabilities if API token provided), discovered users (ID, username, display name), interesting findings (config backups, database exports, directory listings, exposed files), vulnerability summary with CVE IDs and references, scan statistics (requests made, duration). Vulnerabilities listed with title, fixed version, references to wpvulndb.com and external advisories. No native JSON output in standard version; parse text output or redirect to file. Successful credential finds during brute-force shown as 'Valid Combinations Found: [username:password]'. Errors/warnings for unreachable targets, WAF blocks, or rate limiting displayed inline.

## Common pitfalls

**No API token = no vulnerability data.** Without `--api-token`, you get component enumeration but miss CVE mappings. **Aggressive scans trigger WAFs.** High request volume from `--plugins-detection aggressive` or brute-force attempts often blocked by firewalls/rate limiters; use `--throttle` and `--random-user-agent`. **False negatives on hardened sites.** Custom wp-content paths, plugin/theme hiding, or header manipulation may prevent detection; use `--wp-content-dir` if known, or `--force` to bypass checks. **Legal/ethical issues.** Scanning without authorization is illegal; always obtain written permission. **Wordlist size vs. time.** Large wordlists (rockyou.txt = 14M passwords) take hours/days; test on cloned/staging environments or during low-traffic windows. **Outdated vulnerability database.** Run `wpscan --update` periodically to refresh local vuln data. **SSL/TLS errors on self-signed certs.** Use `--disable-tls-checks` for internal/testing environments, but understand MITM risks. **Rate limiting breaks enumeration.** If scan stalls or returns partial results, increase `--throttle` or space out scans. **User enumeration blocked.** Some WordPress configs disable author archives or REST API user endpoints; WPScan may fail to enumerate users if all vectors are blocked.

## References

https://hackviser.com/tactics/tools/wpcan
https://www.kali.org/tools/wpscan/
https://wpscan.com/wordpress-cli-scanner/
https://github.com/wpscanteam/wpscan/wiki/WPScan-User-Documentation
https://www.freecodecamp.org/news/how-to-use-wpscan-to-keep-your-wordpress-site-secure/
https://oneuptime.com/blog/post/2026-03-02-use-wpscan-wordpress-security-scanning-ubuntu/view
https://blog.sucuri.net/2023/12/wpscan-intro-how-to-scan-for-wordpress-vulnerabilities.html
https://melapress.com/how-to-use-wpscan/
https://pentest-tools.com/cms-vulnerability-scanning/wordpress-scanner-online-wpscan
https://www.bugcrowd.com/glossary/wpscan-security-scanner/
