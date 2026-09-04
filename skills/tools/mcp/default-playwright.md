---
name: Microsoft Playwright
description: Microsoft Playwright MCP server for browser automation, web
  scraping, screenshot capture, and interactive testing via Model Context
  Protocol
registry: mcp
tool_id: default:playwright
category: mcp-server
tags:
  - browser-automation
  - mcp-server
  - web-scraping
  - testing
  - reconnaissance
  - screenshot
  - network-monitoring
mitre_techniques:
  - T1595.002
  - T1592
summary: "Playwright MCP server exposes browser automation capabilities through
  Model Context Protocol. Invoke with `npx -y @playwright/mcp@latest`. Supports
  Chromium, Firefox, WebKit. Primary use cases: automated reconnaissance of web
  targets, session capture, screenshot evidence collection, JavaScript execution
  in live browser contexts, cookie/storage extraction, network traffic
  observation. Operates headless by default; use PLAYWRIGHT_MCP environment
  variables for configuration. Returns structured element references (e.g., e5,
  e10) for deterministic interaction without visual ambiguity. Can record
  videos, capture traces, mock network requests, manage storage. Configure
  allowed hosts via PLAYWRIGHT_MCP_ALLOWED_HOSTS (defaults to bound host; set
  '*' to disable checks). Set PLAYWRIGHT_MCP_SAVE_VIDEO for auto-recording,
  PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS to bypass cert validation,
  PLAYWRIGHT_MCP_PROXY_SERVER for traffic routing. No built-in authentication to
  target sites—handle via cookie injection, state-load, or scripting. Output is
  MCP tool responses with element snapshots, screenshots as base64 or files,
  state/cookie JSON. Pitfalls: host restrictions block multi-domain recon by
  default; file access restricted to workspace roots unless
  PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS set; CSP may block actions
  unless bypassed; sessions persist unless explicitly closed. Not a
  vulnerability scanner—pair with SQLMap, Burp for exploit workflows."
sources:
  - https://www.checklyhq.com/docs/learn/playwright/what-is-playwright
  - https://en.wikipedia.org/wiki/Playwright_(software)
  - https://nareshit.com/blogs/playwright-automation-tutorial-beginners-2026
  - https://github.com/microsoft/playwright
  - https://testgrid.io/blog/playwright-testing
  - https://playwright.dev/docs/test-cli
  - https://playwright.dev/docs/test-use-options
  - https://github.com/microsoft/playwright-cli
  - https://playwright.dev/agent-cli/configuration
  - https://playwright.dev/agent-cli/introduction
  - https://www.varonis.com/blog/red-teaming
  - https://www.reddit.com/r/Pentesting/comments/1u6fotc/playwright_for_penetration_testing
generated_at: 2026-09-04T02:30:17.817Z
generated_by: anthropic
source_hash: 31443b217674de7bf666aca246f2f3a31e02eb99977235fcde65a8ac32d166fb
---

# Microsoft Playwright

## Overview

Playwright MCP is a Model Context Protocol server that wraps Microsoft's Playwright browser automation library. Launched by Microsoft in 2020, Playwright supports cross-browser automation (Chromium, Firefox, WebKit) with a single API. The MCP variant exposes Playwright's capabilities—navigation, DOM interaction, network interception, storage management, screenshot/video capture—through MCP tools accessible to AI agents. It uses deterministic element references (e.g., `e5`, `e10`) derived from accessibility tree snapshots, avoiding fragile CSS selectors. The server runs via `npx -y @playwright/mcp@latest` and is configured through environment variables prefixed `PLAYWRIGHT_MCP_`. Default mode is headless; browser sessions are isolated unless persistence is enabled. In RTPI context, this tool enables automated web reconnaissance, evidence collection, session replay, and scripted interaction with target web applications without manual browser use.

## When to use

Use Playwright MCP for: (1) Automated reconnaissance of web targets—crawling site structure, enumerating endpoints, capturing screenshots of login/admin panels. (2) Session hijacking validation—load stolen cookies/localStorage via `state-load` or `cookie-set`, verify access to authenticated areas. (3) JavaScript execution in live browser contexts—`eval` arbitrary code to extract client-side data, trigger AJAX flows, inspect runtime state. (4) Evidence collection—screenshot suspicious pages, record video of exploit proof-of-concept, capture network traffic showing data exfiltration. (5) Bypass client-side protections—execute in full browser to handle anti-bot JS, CAPTCHA rendering (manual solve via `--headed`), WebSocket connections. (6) Storage enumeration—dump cookies, localStorage, sessionStorage from target domains. Do NOT use for: vulnerability scanning (no built-in SQLi/XSS detection), heavy bruteforce (rate-limited by browser overhead), static content analysis (use curl/wget), or replacing dedicated exploit tools (SQLMap, Metasploit). Playwright is observable; target WAFs may detect headless browser fingerprints.

## Authentication & setup

No installation required—MCP server auto-installs via `npx -y @playwright/mcp@latest`. Node.js must be present on RTPI host. Configuration is environment-driven; create `.playwright/cli.config.json` in workspace or export vars before launch. Key variables: `PLAYWRIGHT_MCP_ALLOWED_HOSTS='*'` to disable host restrictions (default blocks cross-origin); `PLAYWRIGHT_MCP_ALLOWED_ORIGINS='https://target.com'` to whitelist request origins (does NOT block redirects—informational only); `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1` to access files outside workspace and enable file:// URLs; `PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS=1` to bypass certificate validation on self-signed/expired certs; `PLAYWRIGHT_MCP_PROXY_SERVER='http://proxy:8080'` and `PLAYWRIGHT_MCP_PROXY_BYPASS='localhost,internal.net'` to route traffic; `PLAYWRIGHT_MCP_USER_AGENT='CustomBot/1.0'` to set User-Agent; `PLAYWRIGHT_MCP_SECRETS_FILE='.env'` to load secrets from dotenv file. Authentication to target sites: use `cookie-set`, `state-load`, or `open --persistent --profile=/path` to reuse browser profile. For session replay: export cookies from victim browser, inject via `cookie-set` or `state-load`. For headful debugging: set `PLAYWRIGHT_MCP_HEADLESS=false` or use `--headed` flag. Persistence: `PLAYWRIGHT_MCP_SAVE_SESSION=1` saves cookies/storage between runs; `PLAYWRIGHT_MCP_OUTPUT_DIR=/output` changes artifact location.

## Key commands / parameters

MCP tool invocations (agent calls these; syntax shown is conceptual—actual MCP tool names from research): `open <url>` or `goto <url>` to navigate; `click <ref>`, `fill <ref> <text>`, `type <text>`, `select <ref> <val>`, `check <ref>`, `uncheck <ref>` for interaction (refs like `e5` from element snapshot). `snapshot` returns accessibility tree with element refs; `screenshot [ref]` captures full page or specific element; `pdf` renders page as PDF. `eval <func> [ref]` executes JS in page context (e.g., `eval 'document.cookie'`). `state-save [file]`, `state-load <file>` for session persistence. Cookie mgmt: `cookie-list`, `cookie-get <name>`, `cookie-set <name> <val>`, `cookie-delete <name>`, `cookie-clear`. Storage: `localstorage-list`, `localstorage-get <key>`, `localstorage-set <k> <v>`, `sessionstorage-*` equivalents. Network: `network route <pattern> [opts]` to mock/intercept; `network route-list`, `network unroute`. Tracing: `tracing-start`, `tracing-stop` (generates detailed execution trace). Video: `video-start [file]`, `video-chapter <title>`, `video-stop`. Sessions: `-s=<name> <cmd>` to run in named session, `list` sessions, `close-all`, `kill-all`, `delete-data`. DevTools: `console [min-level]` to stream console logs, `run-code <code>` to execute CDP commands. Config: `config-print` dumps active config. Environment toggles: `PLAYWRIGHT_MCP_SAVE_VIDEO='800x600'` auto-records at resolution, `PLAYWRIGHT_MCP_TIMEOUT_ACTION=5000` sets action timeout (ms), `PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION=30000` for page loads, `PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS=1`, `PLAYWRIGHT_MCP_NO_SANDBOX=1` (unsafe—only in containers).

## Example workflows

**Session hijacking:** (1) Obtain session cookies from phishing/XSS. (2) `cookie-set PHPSESSID <value>`, `cookie-set auth_token <value>`. (3) `goto https://target.com/admin`. (4) `screenshot` to confirm access. (5) `state-save stolen_session.json` for reuse. **Recon & mapping:** (1) `open https://target.com`. (2) `snapshot` to list links. (3) Parse output, iterate `goto` over discovered endpoints. (4) `screenshot` each, save to evidence dir. (5) `network route-list` to capture API endpoints. **Data exfiltration PoC:** (1) `goto https://target.com/dashboard`. (2) `eval 'fetch("/api/users").then(r => r.json())'` to trigger API call. (3) `console info` to log response. (4) `video-start`, perform actions, `video-stop` for recording. **Bypass CSP:** (1) Set `PLAYWRIGHT_MCP_BYPASS_CSP=1` env var. (2) `goto https://target.com`. (3) `eval` to inject script blocked by CSP. **Storage dump:** (1) `goto https://target.com`. (2) `localstorage-list`, `sessionstorage-list`, `cookie-list` to enumerate. (3) `localstorage-get authToken`, `cookie-get session_id`. (4) Exfiltrate values. **Headful manual solve:** (1) Export `PLAYWRIGHT_MCP_HEADLESS=false`. (2) `open https://target.com/login`. (3) Manually solve CAPTCHA in visible browser. (4) `fill e10 admin`, `fill e12 password`, `click e15`. (5) `state-save post_captcha.json`. **Proxy all traffic:** (1) Export `PLAYWRIGHT_MCP_PROXY_SERVER='http://127.0.0.1:8080'` (Burp). (2) `open https://target.com`. (3) Interact; traffic flows through Burp for inspection/replay.

## Output format

MCP responses are JSON-structured tool results. `snapshot` returns accessibility tree with heading/link/textbox/button elements and refs (e.g., `{"type": "textbox", "label": "Username", "ref": "e5"}`). `screenshot` returns base64-encoded PNG or file path if output dir configured. `cookie-list`, `localstorage-list` return JSON arrays of key-value objects. `state-save` writes JSON file with cookies, localStorage, sessionStorage. `eval` returns JS return value as JSON. `console` streams log entries with level, timestamp, message. `network route-list` shows active intercepts. `tracing-stop` generates `.zip` trace file viewable in Playwright Trace Viewer (contains DOM snapshots, network logs, screenshots at each step). `video-stop` outputs `.webm` file. Errors return MCP error responses with message (e.g., host blocked, timeout, element not found). No built-in reporting—agent must parse tool outputs and correlate. For RTPI integration, redirect output to structured logs; parse screenshots/videos into evidence artifacts.

## Common pitfalls

(1) **Host restrictions by default:** `PLAYWRIGHT_MCP_ALLOWED_HOSTS` defaults to bound host; multi-domain recon fails. Solution: export `PLAYWRIGHT_MCP_ALLOWED_HOSTS='*'`. (2) **File access limited:** Cannot read/write files outside workspace roots or navigate to file:// URLs unless `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1` set. (3) **CSP blocks:** Production CSP may prevent script injection. Set `PLAYWRIGHT_MCP_BYPASS_CSP=1` (non-standard, verify support) or use `eval` carefully. (4) **Headless fingerprinting:** Targets detect `navigator.webdriver=true`, missing plugins, canvas fingerprints. Mitigate: use `--channel=chrome` for real Chrome, set custom user-agent, inject evasion scripts via `PLAYWRIGHT_MCP_INIT_SCRIPT`. (5) **Session leakage:** Sessions persist in memory unless `close-all` or `kill-all` invoked; cookies/storage remain if `delete-data` not called. Always clean up in RTPI automation. (6) **Timeout failures:** Default navigation timeout may be too short for slow targets. Set `PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION=60000`. (7) **Element ref staleness:** Refs from `snapshot` invalidate after navigation. Re-snapshot after each `goto`. (8) **Proxy cert errors:** HTTPS interception by Burp fails without `PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS=1`. (9) **No exploit primitives:** Playwright does not detect SQLi, XSS, CSRF—only automates interaction. Must combine with SQLMap, manual analysis, or custom scripts. (10) **Observable behavior:** Browser automation is noisier than curl (JS execution, resource loads, user-agent). WAFs may block. Use sparingly on blue-team-monitored targets.

## References

- https://www.checklyhq.com/docs/learn/playwright/what-is-playwright
- https://en.wikipedia.org/wiki/Playwright_(software)
- https://nareshit.com/blogs/playwright-automation-tutorial-beginners-2026
- https://github.com/microsoft/playwright
- https://testgrid.io/blog/playwright-testing
- https://playwright.dev/docs/test-cli
- https://playwright.dev/docs/test-use-options
- https://github.com/microsoft/playwright-cli
- https://playwright.dev/agent-cli/configuration
- https://playwright.dev/agent-cli/introduction
- https://www.reddit.com/r/Pentesting/comments/1u6fotc/playwright_for_penetration_testing
