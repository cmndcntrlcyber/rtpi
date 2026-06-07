---
name: Certbot
description: Let's Encrypt client for obtaining, managing, and testing SSL/TLS
  certificates via ACME protocol
registry: registry
tool_id: certbot
category: other
tags:
  - certificates
  - ssl
  - tls
  - acme
  - letsencrypt
  - web-server
  - reconnaissance
mitre_techniques:
  - T1595.002
  - T1590.001
summary: "Certbot is an ACME protocol client for Let's Encrypt certificate
  operations. Use for: (1) obtaining valid SSL/TLS certificates for red team
  infrastructure to appear legitimate, (2) testing certificate validation flows,
  (3) reconnaissance on certificate issuance requirements, (4) standing up HTTPS
  services for phishing/C2. Invoke via `/usr/bin/certbot` with subcommands
  `certonly` (obtain only), `run` (obtain + install), `renew`, `revoke`,
  `certificates` (list). Core authentication methods: `--standalone` (binds port
  80/443, no existing webserver), `--webroot` (uses existing webserver document
  root), `--manual` (manual challenge completion), `--dns` plugins (DNS-01
  challenge). Requires: domain name pointing to your IP, port 80 accessible
  (HTTP-01) OR port 443 (TLS-ALPN-01) OR DNS control (DNS-01). Certificates save
  to `/etc/letsencrypt/live/<domain>/`. Version 1.21.0 may lack newest features;
  DNS plugins may not be installed. Red team use cases: rapid deployment of
  trusted certs for phishing infrastructure, testing target's ACME/certificate
  policies, creating legitimate-looking HTTPS endpoints. Watch for: rate limits
  (5 certs/domain/week), domain validation leaving logs at CA, challenges
  requiring public internet access, automatic renewals via cron creating
  operational security issues."
sources:
  - https://eff-certbot.readthedocs.io/en/stable/using.html
  - https://eff-certbot.readthedocs.io/
  - https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal
  - https://certbot.eff.org/instructions?ws=apache&os=windows
  - https://certbot.eff.org/
  - https://community.letsencrypt.org/t/what-does-the-certbot-command-line-option-w-do/95917
  - https://certbot.eff.org/glossary
  - https://www.ibm.com/think/topics/red-teaming
  - https://cloudsecurityalliance.org/articles/penetration-testing-vs-red-teaming
  - https://www.coursera.org/learn/generative-ai-for-penetration-testing-red-team
  - https://certbot.eff.org/instructions?ws=other&os=pip
  - https://certbot.eff.org/faq
generated_at: 2026-05-19T11:03:52.325Z
generated_by: anthropic
source_hash: bf4deea335bc5de7dc3c2f64c799e85e96c586fd4a7f981c160fc145b270007b
---

# Certbot

## Overview

Certbot automates obtaining and managing SSL/TLS certificates from Let's Encrypt via the ACME protocol. It performs domain validation challenges (HTTP-01, DNS-01, TLS-ALPN-01), retrieves certificates, and optionally configures web servers. In red team contexts, Certbot enables rapid deployment of trusted certificates for phishing sites, C2 infrastructure, or adversary emulation scenarios requiring legitimate HTTPS endpoints. Version 1.21.0 includes core functionality but may lack recent DNS plugins or features.

## When to use

Use Certbot when you need valid, browser-trusted SSL/TLS certificates for red team infrastructure without cost. Specific scenarios: (1) phishing campaigns requiring HTTPS to avoid browser warnings, (2) C2 servers needing encrypted channels with legitimate certificates, (3) adversary emulation of legitimate services, (4) testing target organization's certificate monitoring/detection, (5) reconnaissance on domain validation mechanisms, (6) creating realistic fake login portals. Do NOT use if: operation requires anonymity (Let's Encrypt logs all certificate requests publicly in Certificate Transparency logs), target blocks outbound validation traffic, you cannot control DNS or expose ports 80/443 to internet.

## Authentication & setup

Certbot requires proof of domain control via ACME challenges. No Let's Encrypt account password needed; creates account automatically on first run. Prerequisites: (1) domain name pointing to your server's IP, (2) root/sudo access, (3) port 80 open (HTTP-01) OR port 443 (TLS-ALPN-01) OR DNS provider API access (DNS-01). For `--standalone`, ensure no service listens on port 80/443 during validation. For `--webroot`, need existing webserver with writable document root (specify with `-w /var/www/html`). For `--manual`, prepare to manually create challenge files or DNS TXT records. For DNS plugins, install additional packages (e.g., `python3-certbot-dns-cloudflare`) and provide API credentials. All validation attempts are logged publicly in CT logs—operational security consideration.

## Key commands / parameters

`certbot certonly` - obtain certificate without installing. Required flags: `--standalone` (automated, binds ports) OR `--webroot -w /path/to/webroot` (uses existing server) OR `--manual` (manual challenge) OR `--nginx`/`--apache` (auto-config). Add `-d example.com -d www.example.com` for domains. `certbot certificates` - list all obtained certificates and expiry dates. `certbot renew` - renew certificates near expiry (within 30 days). `certbot revoke --cert-path /etc/letsencrypt/live/example.com/cert.pem` - revoke certificate. `certbot delete --cert-name example.com` - remove certificate from system. Useful flags: `--dry-run` (test without issuing), `--agree-tos` (auto-accept terms), `--email you@example.com` (for expiry notices), `--non-interactive` (no prompts), `--force-renewal` (renew before expiry), `--staging` (use Let's Encrypt staging environment, avoids rate limits). Certificates stored in `/etc/letsencrypt/live/<domain>/` with `cert.pem`, `chain.pem`, `fullchain.pem`, `privkey.pem`.

## Example workflows

**Standalone for new phishing site**: `certbot certonly --standalone -d phish.evil.com --agree-tos --email ops@evil.com --non-interactive` (ensure port 80 free, domain points to your IP). **Webroot for existing Apache**: `certbot certonly --webroot -w /var/www/html -d target-login.com --agree-tos --non-interactive`. **Manual DNS for no HTTP exposure**: `certbot certonly --manual --preferred-challenges dns -d internal.evil.com` (add TXT record when prompted). **List all certs**: `certbot certificates`. **Test renewal**: `certbot renew --dry-run`. **Revoke after operation**: `certbot revoke --cert-path /etc/letsencrypt/live/phish.evil.com/cert.pem`. **Staging test to avoid rate limits**: `certbot certonly --standalone -d test.evil.com --staging`. After obtaining, configure web/C2 server to use `/etc/letsencrypt/live/<domain>/fullchain.pem` and `privkey.pem`.

## Output format

Interactive mode prompts for email, domain, agreement to ToS. Output shows challenge type, validation status, certificate paths. Success message: `Successfully received certificate. Certificate is saved at: /etc/letsencrypt/live/<domain>/fullchain.pem Key is saved at: /etc/letsencrypt/live/<domain>/privkey.pem`. Errors include: `Failed authorization procedure` (challenge failed), `Connection refused` (port blocked), `DNS problem: NXDOMAIN` (domain doesn't resolve), `too many certificates already issued` (rate limit hit). `certbot certificates` outputs table with cert name, domains, expiry date, path. Logs written to `/var/log/letsencrypt/letsencrypt.log`. Certificates are PEM-encoded text files. Non-interactive mode exits with code 0 on success, non-zero on failure.

## Common pitfalls

**Rate limits**: Let's Encrypt allows 50 certificates per registered domain per week, 5 duplicate certificates per week. Use `--staging` for testing. **Public CT logs**: All certificates appear in public Certificate Transparency logs within seconds—operational security risk if domain names reveal intent. **Port access**: HTTP-01 requires port 80 accessible from internet; standalone mode fails if anything binds to 80/443. Firewalls, NAT, ISP blocks common. **Domain validation**: DNS must resolve correctly before running; propagation delays cause failures. **Permission errors**: Certbot must run as root to write `/etc/letsencrypt/` and bind privileged ports. **Expiry**: Certificates expire after 90 days; forget to renew and infrastructure breaks. Set cron carefully or disable to avoid unexpected renewals during ops. **Plugin availability**: Version 1.21.0 may not include all DNS plugins; check with `certbot plugins`. **Revocation**: Revoking certificates after operation leaves audit trail at Let's Encrypt; may be forensically relevant.

## References

• https://eff-certbot.readthedocs.io/en/stable/using.html
• https://eff-certbot.readthedocs.io/
• https://certbot.eff.org/instructions
• https://certbot.eff.org/faq
• https://certbot.eff.org/glossary
• https://community.letsencrypt.org/t/what-does-the-certbot-command-line-option-w-do/95917
