---
name: Certbot
description: Let's Encrypt certificate management tool for obtaining,
  installing, and renewing SSL/TLS certificates via ACME protocol.
registry: security
tool_id: certbot
category: ssl_tls
tags:
  - ssl
  - tls
  - certificates
  - acme
  - letsencrypt
  - webserver
  - https
summary: "Certbot automates SSL/TLS certificate issuance from Let's Encrypt via
  ACME protocol. In red team operations, use it to provision legitimate HTTPS
  certificates for phishing infrastructure, C2 domains, or social engineering
  campaigns requiring trust indicators. Certificates default to 90-day validity.
  Primary modes: 'certbot certonly' obtains certificates without installation;
  'certbot run' or 'certbot' both obtains and installs. Authenticators prove
  domain control: --webroot requires existing HTTP server on port 80 and writes
  challenge files to document root; --standalone runs temporary server on port
  80 (requires stopping existing services); --manual allows custom validation;
  DNS plugins validate via DNS TXT records (no port 80 required). Certificates
  save to /etc/letsencrypt/live/<domain>/. Key files: fullchain.pem (certificate
  + intermediates), privkey.pem (private key). Use --nginx or --apache for
  automatic config modification. Use --standalone when you control the server
  but want minimal footprint. Use DNS validation when port 80 is blocked or
  stealth is required. Always test with --dry-run to avoid rate limits (5
  certificates per domain per week). Certbot creates renewal configs
  automatically; renewal occurs via cron. For operations security: registering
  email is optional but helps with expiration notices; use disposable
  infrastructure-aligned emails. Legitimate certificates from Let's Encrypt
  cannot be distinguished from benign use and enhance credibility of phishing/C2
  infrastructure."
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
  - https://oneuptime.com/blog/post/2026-03-20-ssl-tls-cert-lets-encrypt/view
generated_at: 2026-05-19T11:32:52.956Z
generated_by: anthropic
source_hash: a594424bbd1779a8dc2eabd3ce10498cc58fe2676d27ff63f9c9268e9b2c482c
---

# Certbot

## Overview

Certbot is the official Let's Encrypt client for obtaining, installing, and renewing SSL/TLS certificates via the ACME protocol. It supports multiple authenticators (webroot, standalone, DNS, manual) to prove domain ownership and can automatically configure Apache and Nginx web servers. Certificates are stored in /etc/letsencrypt/live/ with automatic renewal configurations. In red team contexts, Certbot provisions legitimate HTTPS for adversary infrastructure, enhancing credibility of phishing sites, C2 domains, and data exfiltration endpoints.

## When to use

Use Certbot when you need legitimate SSL/TLS certificates for red team infrastructure domains. Appropriate scenarios: setting up phishing sites requiring browser trust indicators; establishing HTTPS C2 channels that blend with legitimate traffic; creating data exfiltration endpoints that avoid SSL warnings; any operation where valid certificates increase target confidence or evade detection. Choose authentication method based on infrastructure access: webroot if you have a running web server; standalone if you can temporarily bind port 80; DNS plugins if port 80 is unavailable or you want to avoid HTTP validation exposure; manual for maximum control. Do not use if operation requires anonymity that conflicts with domain registration, or if Let's Encrypt rate limits (5 certs/domain/week) interfere with rapid infrastructure rotation.

## Authentication & setup

Certbot requires root/sudo access and outbound HTTPS to Let's Encrypt ACME servers (acme-v02.api.letsencrypt.org). No API keys needed; authentication occurs via domain control challenges. Webroot mode: requires HTTP server serving on port 80 with writable document root; Certbot places challenge files in .well-known/acme-challenge/. Standalone mode: requires port 80 available (stop existing web server temporarily); Certbot runs its own validation server. DNS mode: requires DNS provider API credentials and appropriate plugin (python3-certbot-dns-*); Certbot creates TXT records at _acme-challenge.<domain>. Manual mode: Certbot provides instructions; you manually satisfy challenges. Email registration is optional but recommended for expiration notices; use operational email tied to infrastructure. Test with --dry-run or --staging to avoid production rate limits during setup. Renewal is automatic via cron job installed with Certbot; verify /etc/cron.d/certbot exists.

## Key commands / parameters

certbot certonly: obtain certificate without installation; requires -d <domain> and authenticator plugin. certbot run or certbot: obtain and install certificate; auto-configures supported web servers. --webroot: use webroot authentication; requires -w <path> specifying document root (e.g., -w /var/www/html). --standalone: use standalone authentication; binds port 80, requires no conflicting services. --manual: manual authentication; receive instructions to satisfy challenges yourself. --nginx: use Nginx plugin for installation and authentication. --apache: use Apache plugin for installation and authentication. --dns-<provider>: use DNS plugin (e.g., --dns-cloudflare); requires provider credentials file. -d <domain>: specify domain name; can be repeated for multiple domains/SANs on single certificate. --email <email>: register with provided email. --agree-tos: agree to Let's Encrypt terms automatically (non-interactive). --non-interactive: suppress prompts; use with --agree-tos and --email for scripted deployments. --dry-run: test certificate request without saving; essential for avoiding rate limits. --staging: use Let's Encrypt staging environment; certificates not trusted but no rate limits. --cert-name <name>: specify certificate name for management (default: primary domain). --expand: add domains to existing certificate. --force-renewal: force renewal even if not near expiration. certbot certificates: list all certificates managed by Certbot. certbot renew: manually trigger renewal for all certificates (normally via cron). certbot revoke --cert-path <path>: revoke certificate. --key-type rsa|ecdsa: specify key algorithm (default RSA 2048).

## Example workflows

Obtain certificate for phishing domain with existing Nginx server: certbot certonly --webroot -w /var/www/html -d phish.example.com -d www.phish.example.com --email opsec@example.com --agree-tos --non-interactive. Obtain certificate with standalone mode (no existing web server): systemctl stop nginx && certbot certonly --standalone -d c2.example.com --agree-tos --email infra@example.com && systemctl start nginx. Obtain wildcard certificate via DNS (requires DNS plugin): certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.cloudflare.ini -d '*.example.com' -d example.com --agree-tos --email ops@example.com. Auto-configure Nginx with certificate: certbot --nginx -d social.example.com --agree-tos --email admin@example.com --redirect. Test configuration without obtaining real certificate: certbot certonly --webroot -w /var/www/html -d test.example.com --dry-run. List all certificates: certbot certificates. Force renewal before expiration: certbot renew --force-renewal --cert-name phish.example.com. Multi-domain certificate for campaign infrastructure: certbot certonly --standalone -d login.target.com -d secure.target.com -d account.target.com --agree-tos --email campaign@infra.net. Use staging for testing: certbot certonly --standalone -d test.local --staging to validate process without production rate limits.

## Output format

Certbot outputs status messages to stdout/stderr with progress indicators during ACME challenge completion. Successful certificate issuance reports certificate path (e.g., /etc/letsencrypt/live/<domain>/fullchain.pem) and expiration date. Certificate files saved to /etc/letsencrypt/live/<domain>/: fullchain.pem (certificate + intermediate chain for server configuration), privkey.pem (private key, guard carefully), cert.pem (certificate only, rarely needed), chain.pem (intermediate certificates only). Renewal configuration stored in /etc/letsencrypt/renewal/<domain>.conf. certbot certificates outputs table format: Certificate Name | Domains | Expiry Date | Certificate Path | Private Key Path. Errors indicate ACME challenge failures (check DNS resolution, port 80 accessibility, webroot permissions) or rate limit hits (use --staging or wait). Exit codes: 0=success, 1=general error, 2=invalid usage. Logs written to /var/log/letsencrypt/letsencrypt.log for troubleshooting.

## Common pitfalls

Rate limits: Let's Encrypt enforces 5 certificates per registered domain per week, 50 certificates per account per week, and 300 pending authorizations per account. Always test with --dry-run or --staging before production requests. Port 80 required for webroot/standalone: if port 80 is blocked by firewall or already in use, authentication fails; use DNS validation or manual mode instead. Webroot path errors: -w must point to exact document root where .well-known/acme-challenge/ can be created and served by web server; misconfiguration causes validation failures. DNS propagation delays: DNS plugins may fail if records don't propagate quickly; add delays or use providers with fast propagation. Certificate renewal failures: automatic renewal via cron fails silently if web server config changes break validation; monitor /var/log/letsencrypt/letsencrypt.log. Firewall rules: outbound HTTPS to acme-v02.api.letsencrypt.org required; blocked egress prevents ACME communication. Non-interactive mode requires all flags: --non-interactive without --email and --agree-tos causes errors. Mismatched domains: certificate domain must match DNS resolution; requesting cert for domain not pointing to server IP fails HTTP-01 challenge. Revoked infrastructure: if red team domain is reported/revoked, certificate revocation lists (CRL) may flag infrastructure; plan for domain/certificate rotation. Operational security: Let's Encrypt logs are public via Certificate Transparency; assume all issued certificates are discoverable by defenders monitoring CT logs. Do not reuse domains across operations.

## References

https://eff-certbot.readthedocs.io/en/stable/using.html
https://eff-certbot.readthedocs.io/
https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal
https://certbot.eff.org/instructions?ws=other&os=pip
https://community.letsencrypt.org/t/what-does-the-certbot-command-line-option-w-do/95917
https://certbot.eff.org/glossary
https://oneuptime.com/blog/post/2026-03-20-ssl-tls-cert-lets-encrypt/view
