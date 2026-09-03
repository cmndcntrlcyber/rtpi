---
name: Microsoft Playwright
description: Browser automation MCP server for web recon, session hijacking, DOM
  extraction, screenshot capture, and automated interaction with SPAs.
registry: mcp
tool_id: default:playwright
category: mcp-server
tags:
  - browser-automation
  - web-recon
  - screenshot
  - dom-scraping
  - mcp-server
  - headless-browser
  - spa-testing
mitre_techniques:
  - T1185
  - T1539
  - T1213
summary: "Playwright MCP exposes browser automation via Model Context Protocol.
  Invoke with `npx -y @playwright/mcp@latest`. Use for: automated recon of SPAs
  that require JavaScript execution, cookie/storage extraction, screenshot/PDF
  capture, form-filling for auth bypass testing, DOM inspection of dynamic
  content. Operates in headless mode by default (set
  PLAYWRIGHT_MCP_HEADLESS=false for visible). Supports Chromium, Firefox,
  WebKit. Key commands: `goto <url>`, `click <ref>`, `fill <ref> <text>`,
  `screenshot [ref]`, `snapshot` (returns DOM), `cookie-list`,
  `localstorage-list`, `state-save [file]` (serialize session), `state-load
  <file>` (replay session), `tracing-start`/`tracing-stop` (capture execution
  trace). References use CSS/XPath/text selectors. Configure via env vars:
  PLAYWRIGHT_MCP_TIMEOUT_ACTION (default 5000ms),
  PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION (60000ms), PLAYWRIGHT_MCP_USER_AGENT,
  PLAYWRIGHT_MCP_USER_DATA_DIR (persistent profile), PLAYWRIGHT_MCP_OUTPUT_DIR.
  Sessions persist until `close` or `kill-all`. Auto-waits for elements to be
  actionable. Use `console [min-level]` to capture JS errors. Route/intercept
  network with `route <pattern>`. Expect JSON-serializable responses for
  DOM/cookies/storage; screenshots/PDFs saved to output dir. OPSEC: leaves
  browser artifacts in temp dirs unless USER_DATA_DIR set; headless
  fingerprinting detectable; CDP/remote endpoints expose control plane if
  misconfigured. No built-in vuln scanning—purely interaction/extraction."
sources:
  - https://www.checklyhq.com/docs/learn/playwright/what-is-playwright
  - https://en.wikipedia.org/wiki/Playwright_(software)
  - https://github.com/microsoft/playwright
  - https://nareshit.com/blogs/playwright-automation-tutorial-beginners-2026
  - https://www.pcloudy.com/blogs/playwright-test-automation-guide
  - https://playwright.dev/docs/test-cli
  - https://playwright.dev/agent-cli/configuration
  - https://github.com/microsoft/playwright-cli
  - https://playwright.dev/agent-cli/introduction
  - https://testdino.com/blog/playwright-cli
  - https://www.threatngsecurity.com/glossary/playwright-mcp
  - https://zerothreat.ai/playwright-security-testing
generated_at: 2026-09-03T12:38:54.627Z
generated_by: anthropic
source_hash: 31443b217674de7bf666aca246f2f3a31e02eb99977235fcde65a8ac32d166fb
---

# Microsoft Playwright

## Overview

Playwright MCP is a Model Context Protocol server wrapping Microsoft's Playwright browser automation framework. It allows AI agents to drive Chromium/Firefox/WebKit browsers programmatically for web reconnaissance, session manipulation, dynamic content scraping, and UI interaction testing. Originally designed for end-to-end testing, it is repurposed here for red-team operations: bypassing JavaScript-heavy anti-scraping, capturing authenticated sessions, fingerprinting web apps, and automating phishing site analysis. The MCP interface accepts text commands (e.g., `goto`, `click`, `fill`) and returns structured data (DOM snapshots, cookies, network logs). Runs headless by default; supports video recording, trace capture, and persistent browser profiles.

## When to use

Use Playwright MCP when target recon requires full browser rendering: single-page applications (React/Vue/Angular), sites with JavaScript-gated content, CAPTCHA bypass via manual intervention recording, or dynamic form workflows. Ideal for: extracting session tokens/cookies from authenticated contexts; capturing screenshots of phishing sites without manual browsing; automating credential stuffing flows; monitoring typosquatted domains; replaying saved browser states across sessions; inspecting WebSocket/fetch traffic in SPAs; generating DOM snapshots for offline analysis. Do NOT use for static HTML scraping (curl/wget suffice), mass scanning (too slow), or exploit delivery (not a weaponization tool). Playwright excels at mimicking legitimate user behavior to evade bot detection.

## Authentication & setup

No authentication required for local invocation. Install via `npx -y @playwright/mcp@latest` (fetches on-demand; no prior install needed). Playwright auto-downloads browser binaries to `~/.cache/ms-playwright` on first run. For persistent config, create `.playwright/cli.config.json` with browser/timeout settings. Key environment variables: `PLAYWRIGHT_MCP_USER_DATA_DIR` (path to reusable profile—critical for session persistence across runs), `PLAYWRIGHT_MCP_HEADLESS=false` (visible browser for manual CAPTCHA solving), `PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS=true` (accept self-signed certs), `PLAYWRIGHT_MCP_USER_AGENT` (custom UA string), `PLAYWRIGHT_MCP_OUTPUT_DIR` (default `./test-output` for screenshots/traces). To use existing Chrome profile: set `browser.launchOptions.channel=chrome` and `userDataDir=/path/to/profile`. For remote browsers, set `PLAYWRIGHT_MCP_CDP_ENDPOINT` (Chromium only). Proxy support via `launchOptions.proxy`. Skills install: `playwright-cli install --skills` (adds agent reference docs to `.claude/skills/`).

## Key commands / parameters

Core commands:
• `open [url]` / `goto <url>`: navigate to URL (auto-waits for load event)
• `close`: terminate session
• `click <ref>`, `dblclick <ref>`: interact with element (ref = CSS selector, XPath, text, or `data-testid` attribute)
• `fill <ref> <text>`: clear and type into input
• `type <text>`: send keystrokes to focused element
• `press <key>`: single key (e.g., `Enter`, `Escape`)
• `select <ref> <value>`: choose dropdown option
• `check <ref>` / `uncheck <ref>`: toggle checkbox
• `snapshot`: return full DOM as JSON
• `screenshot [ref]`: capture viewport or element; saved to output dir
• `pdf`: save page as PDF
Storage/session:
• `state-save [file]`: serialize cookies, localStorage, sessionStorage to JSON
• `state-load <file>`: restore session from saved state
• `cookie-list`, `cookie-get <name>`, `cookie-set <name> <val>`, `cookie-delete <name>`
• `localstorage-list`, `localstorage-get <key>`, `localstorage-set <k> <v>`
• `sessionstorage-*`: same for sessionStorage
Network:
• `route <pattern> [opts]`: mock/intercept requests (e.g., block analytics)
• `network`: dump captured requests
DevTools:
• `console [min-level]`: fetch JS console logs (levels: log, warn, error)
• `tracing-start` / `tracing-stop`: record execution trace (Playwright Trace Viewer format)
• `video-start [file]` / `video-stop`: record .webm of session
Multi-tab:
• `tab-new [url]`, `tab-list`, `tab-select <idx>`, `tab-close [idx]`
Timeouts: defaults 5s (action), 60s (navigation); override via env or `--timeout` flag.

## Example workflows

**Session hijacking recon:**
1. `goto https://target.com/login`
2. `fill input[name=username] admin` / `fill input[name=password] P@ssw0rd!`
3. `click button[type=submit]`
4. `state-save session.json` → extract cookies/localStorage for token reuse
5. `cookie-list` → copy auth tokens for curl/Burp

**Phishing site screenshot capture:**
1. `open https://suspicious-domain.com`
2. `screenshot` → saves PNG to output dir
3. `snapshot` → get HTML for local analysis
4. `close-all` → cleanup without leaving profile

**SPA recon with trace:**
1. `tracing-start`
2. `goto https://app.target.com`
3. `click nav >> text=Admin Panel` → auto-waits for element
4. `snapshot` → extract rendered DOM
5. `network` → inspect XHR endpoints
6. `tracing-stop` → generates .zip trace; open in Playwright Trace Viewer for step-by-step replay

**CAPTCHA-assisted credential stuffing:**
1. `open --headed https://victim.com/login` (visible browser)
2. `fill #username user1` / `fill #password pass1`
3. Manual: solve CAPTCHA in visible browser
4. `click #submit`
5. `state-save user1.json` → repeat for remaining credentials

**Persistent profile for multi-run recon:**
1. Set `PLAYWRIGHT_MCP_USER_DATA_DIR=/tmp/recon-profile`
2. `goto https://target.com` → login manually if needed
3. `close`
4. Next run reuses cookies/localStorage automatically

## Output format

Commands return JSON-serializable responses. `snapshot` returns `{html: string, url: string}`. `cookie-list` returns array of `{name, value, domain, path, expires, httpOnly, secure, sameSite}`. `localstorage-list` / `sessionstorage-list` return key-value objects. `network` returns array of `{url, method, status, resourceType, headers}`. Screenshots/PDFs/traces save to disk; command returns `{path: string}`. Console logs: `{level, text, timestamp}`. Errors return `{error: string, stack: string}`. State files (`state-save`) are JSON with `{cookies: [], origins: [{origin, localStorage, sessionStorage}]}`. No stdout scraping needed—structured data only. Video files are `.webm` (VP9 codec). Trace files are `.zip` archives; unzip and open `trace.json` in Playwright Trace Viewer for GUI replay.

## Common pitfalls

**Timeout failures:** Default 5s action timeout too short for slow apps—set `PLAYWRIGHT_MCP_TIMEOUT_ACTION=30000`. Navigation timeout (60s) can fail on heavy SPAs; bump `PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION=120000`. **Headless detection:** Many sites fingerprint headless Chrome (missing plugins, WebGL differences). Use `--headed` or real Chrome profile via `userDataDir` for evasion. **Selector brittleness:** CSS/XPath break when DOM changes. Prefer `data-testid` attributes or text selectors (`text=Login`). Use `playwright-cli codegen` to auto-generate stable selectors. **Session isolation:** By default, each `open` creates ephemeral context. For multi-command workflows, reuse session with `-s=<name>` flag or set `USER_DATA_DIR`. **OPSEC artifacts:** Browser cache/history persist in temp dirs unless `isolated=true`. Old session data in `~/.cache/ms-playwright` can leak. Use `delete-data` after ops. **Rate limiting:** Sequential page loads are slow (2-5s per navigation). Playwright is not a mass scanner—parallelize with multiple MCP instances if needed. **Network route conflicts:** `route <pattern>` intercepts ALL matching requests; can break app functionality. Use narrow patterns. **Video bloat:** Sessions generate large .webm files. Disable unless debugging. **No exploit primitives:** Playwright does not inject XSS, fuzz inputs, or detect vulns—it only automates interaction. Pair with manual testing or dedicated scanners.

## References

• https://playwright.dev/agent-cli/introduction
• https://playwright.dev/agent-cli/configuration
• https://github.com/microsoft/playwright
• https://github.com/microsoft/playwright-cli
• https://www.checklyhq.com/docs/learn/playwright/what-is-playwright
• https://playwright.dev/docs/test-cli
• https://en.wikipedia.org/wiki/Playwright_(software)
• https://testdino.com/blog/playwright-cli
• https://www.threatngsecurity.com/glossary/playwright-mcp
• https://zerothreat.ai/playwright-security-testing
