---
name: Roadrecon
description: Azure AD reconnaissance tool that authenticates, gathers directory
  data via internal Graph API, and provides a GUI for exploring users, roles,
  and policies.
registry: registry
tool_id: roadrecon
category: azure
tags:
  - azure
  - reconnaissance
  - azure-ad
  - enumeration
  - token-theft
  - post-exploitation
  - entra-id
  - gui
mitre_techniques:
  - T1087.004
  - T1069.003
  - T1482
  - T1526
summary: "ROADrecon performs Azure AD/Entra ID enumeration in three steps:
  authenticate, gather, explore. Use `roadrecon auth` with credentials, tokens,
  device code, or PRT cookies. Use `roadrecon gather` to collect tenant data
  (users, groups, roles, apps, service principals, conditional access policies,
  devices) via Azure AD Graph API v1.61-internal into a local SQLite database
  (roadrecon.db). Launch `roadrecon gui` to explore data via web interface on
  localhost:5000. Supports plugins: `roadrecon plugin policies` exports
  conditional access policies to HTML; `roadrecon plugin bloodhound` exports
  data for custom BloodHound. Ideal for initial access reconnaissance when you
  have valid credentials or stolen tokens (access, refresh, PRT). Authentication
  writes tokens to .roadtools_auth file. Gather phase may produce 403 errors if
  token scope is insufficient (e.g., management.core.windows.net yields partial
  collection; SharePoint tokens often provide full collection). Tool uses
  different API version than standard tools, revealing additional data. Works
  with username/password (no MFA), device code flow (MFA-compatible), or stolen
  tokens from browser sessions. Supports --mfa flag during gather if
  authenticated as privileged role. Database can be queried directly or via GUI
  for password spray target selection, privilege escalation paths, or blue team
  audit."
sources:
  - https://github.com/dirkjanm/ROADtools/wiki/Getting-started-with-ROADrecon
  - https://dirkjanm.io/introducing-roadtools-and-roadrecon-azure-ad-exploration-framework/
  - https://posts.specterops.io/an-operators-guide-to-device-joined-hosts-and-the-prt-cookie-bcd0db2812c4?source=rss----f05f8696e3cc---4
  - https://medium.com/@mgbecken/roadtools-1e9dabc2c8e9
  - https://posts.specterops.io/spa-is-for-single-page-abuse-using-single-page-application-tokens-to-enumerate-azure-8c38dc77e409?source=rss----f05f8696e3cc---4
  - https://kb.offsec.nl/tools/m365/roadrecon/
  - https://vk9-sec.com/authenticatedinformation-gathering-automated-azure-active-directory-enumeration-using-roadtools/
  - https://johnermac.github.io/notes/cartp/cartp2/
  - https://www.redpacketsecurity.com/roadtools-the-azure-ad-exploration-framework/
  - https://trustedsec.com/blog/weaponization-of-token-theft-a-red-team-perspective
  - https://websec.net/blog/an-introductory-guide-to-pentesting-azure-benefits-and-tools-part-2-661c326880f704dc4b2bbeca
  - https://github.com/dirkjanm/roadtools
generated_at: 2026-05-19T11:16:10.691Z
generated_by: anthropic
source_hash: 584fa5f7de3d72ec70f664fdee31ae2aba346dd2bc76433e565cc7e2909dc260
---

# Roadrecon

## Overview

ROADrecon is part of the ROADtools framework for Azure AD/Entra ID exploration. It authenticates to Azure AD, gathers comprehensive directory data using the internal Azure AD Graph API (v1.61-internal), stores results in a local SQLite database, and provides both a web GUI and plugin system for analysis. The tool is valuable for red teams (reconnaissance, privilege escalation path discovery) and blue teams (configuration audits, conditional access policy review). ROADrecon reveals more data than standard tools by using an internal API version not publicly documented.

## When to use

Use ROADrecon when you have valid Azure AD credentials, stolen access/refresh tokens, or PRT cookies and need to enumerate the tenant comprehensively. Ideal for: initial access reconnaissance after credential compromise; mapping users, groups, roles, and relationships before lateral movement; auditing conditional access policies; identifying privilege escalation paths; discovering MFA status and authentication methods; enumerating applications, service principals, OAuth2 permissions; preparing for password spray campaigns by identifying accounts without MFA; blue team reviews of tenant configuration and role assignments. Prefer ROADrecon over other Azure tools when you need the web GUI for interactive exploration or when standard Graph API queries return insufficient data.

## Authentication & setup

ROADrecon requires Python 3 and is installed via `pip install roadrecon`. Authentication is always the first step using `roadrecon auth` with one of these methods:

**Username/password (no MFA):** `roadrecon auth -u user@tenant.onmicrosoft.com -p Password123` - writes tokens to .roadtools_auth file.

**Device code (MFA-compatible):** `roadrecon auth --device-code` - provides a code to enter in a browser on another device.

**Stolen refresh token:** `roadrecon auth -c <client_id> --refresh-token <token>` - requires the client ID from the original authentication request.

**Stolen access token:** `roadrecon auth --access-token <token>` - useful for direct token reuse.

**PRT cookie:** `roadrecon auth --prt-cookie <cookie>` or `roadrecon auth --prt <prt_value> --prt-sessionkey <key>` - use tokens extracted from device-joined hosts.

Optional flags: `-t TENANT` (specify tenant ID), `-c CLIENT` (client ID, defaults to Azure AD PowerShell module), `--as-app` (authenticate as application), `--tokens-stdout` (print tokens to console), `-f TOKENFILE` (specify token file location).

If CAE (Continuous Access Evaluation) is enabled, authenticate from the original workstation or proxy through it via SOCKS. Tokens are stored in .roadtools_auth by default. Use `--origin <url>` when token was obtained from a specific application origin.

## Key commands / parameters

**roadrecon auth [options]** - Authenticate and obtain tokens. See Authentication section for methods.

**roadrecon gather [options]** - Collect Azure AD data into roadrecon.db SQLite database. Flags: `--mfa` (gather MFA data if authenticated as privileged role), `-d DATABASE` (specify database path or SQLAlchemy URL like postgresql+psycopg2://user@/roadtools). Expect HTTP 403 errors if token has insufficient scope; errors can be ignored but indicate partial collection.

**roadrecon gui** - Launch Flask web server on http://127.0.0.1:5000 for interactive data exploration. GUI displays: summary dashboard, users (with MFA toggle in settings), groups, directory roles, devices, applications, service principals, application roles, OAuth2 permissions, conditional access policies.

**roadrecon dump** - Alias for gather command.

**roadrecon plugin policies [options]** - Parse conditional access policies. Flags: `-d DATABASE` (database file), `-f FILE` (output file, default: caps.html), `-p` (print to console).

**roadrecon plugin bloodhound [options]** - Export to custom BloodHound format for graph analysis.

**roadrecon plugin xlsexport** - Export data to Excel file.

**roadrecon plugin road2timeline** - Generate forensic timeline from object timestamps.

All subcommands support `-h` for detailed help.

## Example workflows

**Basic reconnaissance with credentials:**
```bash
roadrecon auth -u compromised@target.com -p Password123
roadrecon gather
roadrecon gui
# Browse to http://127.0.0.1:5000
```

**Device code authentication (MFA required):**
```bash
roadrecon auth --device-code
# Follow prompt to authenticate in browser
roadrecon gather --mfa
roadrecon gui
```

**Using stolen refresh token from browser:**
```bash
# Extract client ID and refresh token from browser dev tools
roadrecon auth -c 1fec8e78-bce4-4aaf-ab1b-5451cc387264 --refresh-token 0.ARwA6Wg...
roadrecon gather
```

**Using PRT cookie from compromised device:**
```bash
roadrecon auth --prt-cookie <cookie_from_aadprt_bof>
roadrecon gather
roadrecon gui
```

**Export conditional access policies for analysis:**
```bash
roadrecon plugin policies -f tenant_policies.html -p
```

**Full enumeration with SharePoint token (often yields complete data):**
```bash
# Obtain token from Office 365/SharePoint session
roadrecon auth -c <client_id> --refresh-token <sharepoint_token>
roadrecon gather  # Typically succeeds without 403 errors
roadrecon gui
```

**Using access token for ROADrecon after TokenTactics:**
```powershell
# In TokenTactics
Invoke-RefreshToGraphToken $GraphToken.access_token
# Copy access token
```
```bash
roadrecon auth --access-token eyJ0eXA...
roadrecon gather
```

## Output format

**Token file (.roadtools_auth):** JSON file containing access_token, refresh_token, and other authentication artifacts. Used automatically by gather/gui commands.

**Database (roadrecon.db):** SQLite database with tables for users, groups, roles, devices, applications, servicePrincipals, policies, OAuth2 permissions, and relationships. Schema auto-generated from Azure AD Graph API metadata. Can be queried directly with SQL or accessed via roadlib Python library. Alternative databases supported via SQLAlchemy URLs (PostgreSQL, etc.).

**GUI (http://127.0.0.1:5000):** Web interface with paginated tables, search, filtering. Displays:
- Summary: tenant overview with counts
- Users: username, email, account type, last password change, MFA status (toggle in settings), creation date
- Groups: membership, nesting, owned objects
- Directory Roles: role assignments, members
- Devices: device trust type, OS, compliance status
- Applications: app registrations, redirect URLs, permissions
- Service Principals: enterprise apps, OAuth2 permissions, app roles
- Raw data view for each object

Clicking objects shows relationships (groups, roles, owned objects).

**Plugin outputs:**
- policies: HTML file (caps.html) with formatted conditional access policy details
- bloodhound: JSON for import into custom BloodHound
- xlsexport: Excel workbook with multiple sheets
- road2timeline: Timeline format for forensic analysis

## Common pitfalls

**Partial data collection:** Tokens scoped to management.core.windows.net or Azure Portal often produce HTTP 403 errors during gather, yielding incomplete data. SharePoint tokens typically provide fuller access. Don't abort on 403s; partial data is still valuable.

**MFA-blocked authentication:** Username/password auth fails if account requires MFA. Use `--device-code` flow instead or obtain tokens from authenticated browser sessions.

**CAE enforcement:** Continuous Access Evaluation may reject tokens obtained from different IP/device. Authenticate from the original workstation or proxy through it.

**Missing client ID:** When using stolen refresh tokens, you must provide the original client ID with `-c` flag. Extract it from browser dev tools network tab (look in request payload).

**Database conflicts:** Running multiple gather operations simultaneously can corrupt roadrecon.db. Use separate database files with `-d` flag or different directories.

**GUI port conflict:** Default port 5000 may be in use. ROADrecon doesn't support changing the port; kill conflicting process or use port forwarding.

**Token scope insufficient:** If gather returns minimal data, the token may lack required permissions. Try authenticating with different client IDs (Azure AD PowerShell, Microsoft Office, SharePoint) or escalate privileges first.

**MFA data not collected:** The `--mfa` flag during gather only works if you're authenticated as a privileged role (e.g., Global Reader, Security Administrator). Standard users won't see MFA details.

**Ignoring errors:** While 403 errors during gather can be ignored, other errors (authentication failures, database write errors) indicate problems requiring resolution. Check token validity and filesystem permissions.

## References

- https://github.com/dirkjanm/ROADtools/wiki/Getting-started-with-ROADrecon
- https://dirkjanm.io/introducing-roadtools-and-roadrecon-azure-ad-exploration-framework/
- https://posts.specterops.io/an-operators-guide-to-device-joined-hosts-and-the-prt-cookie-bcd0db2812c4
- https://posts.specterops.io/spa-is-for-single-page-abuse-using-single-page-application-tokens-to-enumerate-azure-8c38dc77e409
- https://medium.com/@mgbecken/roadtools-1e9dabc2c8e9
- https://kb.offsec.nl/tools/m365/roadrecon/
- https://vk9-sec.com/authenticatedinformation-gathering-automated-azure-active-directory-enumeration-using-roadtools/
- https://trustedsec.com/blog/weaponization-of-token-theft-a-red-team-perspective
- https://github.com/dirkjanm/roadtools
