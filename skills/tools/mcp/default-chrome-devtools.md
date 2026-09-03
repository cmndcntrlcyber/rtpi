---
name: Chrome DevTools
description: MCP server exposing Chrome DevTools Protocol for browser
  automation, debugging, and web application inspection during red team
  engagements.
registry: mcp
tool_id: default:chrome-devtools
category: mcp-server
tags:
  - browser
  - devtools
  - javascript
  - dom
  - mcp-server
  - web-debugging
  - automation
mitre_techniques:
  - T1185
  - T1539
  - T1213.002
summary: This MCP server wraps Chrome DevTools Protocol (CDP) capabilities for
  programmatic browser control. Invoke via `npx -y chrome-devtools-mcp@latest`
  to expose DevTools functions through MCP. Use this when you need to inspect
  web application internals, modify DOM/CSS/JavaScript in real-time, intercept
  network traffic, access storage/cookies, or automate browser-based
  reconnaissance without manual clicking. The server provides programmatic
  access to the same capabilities available in Chrome's built-in DevTools (F12
  console). Expect responses containing DOM trees, network request data,
  JavaScript execution results, and storage contents. Critical for testing
  authentication flows, session hijacking scenarios, and identifying client-side
  vulnerabilities. During red team ops, this enables headless browser automation
  for credential harvesting, cookie extraction, and JavaScript-based
  enumeration. The tool runs as a Node.js MCP server—ensure Chrome/Chromium is
  installed and accessible. Agent should request DOM inspection, script
  execution, network monitoring, or storage access through MCP tool calls. Watch
  for anti-automation detection on target sites. Combine with other MCP tools
  for multi-stage attacks involving browser state.
sources:
  - https://www.headspin.io/blog/chrome-devtools-a-complete-guide
  - https://www.microverse.org/blog/a-helpful-guide-to-learn-and-maximize-chrome-devtools
  - https://www.debugbear.com/blog/use-chrome-devtools
  - https://medium.com/swlh/the-basics-of-chrome-devtools-4d69a102a699
  - https://x-team.com/magazine/7-powerful-chrome-devtools-features-every-web-developer-should-know-about
  - https://github.com/GoogleChrome/devtools-docs/blob/master/docs/commandline-api.md
  - https://developer.chrome.com/docs/devtools/console/reference
  - https://developer.chrome.com/docs/devtools/console/utilities
  - https://developer.chrome.com/docs/devtools/open
  - https://peter.sh/experiments/chromium-command-line-switches
  - https://bishopfox.com/blog/9-red-team-tools
  - https://www.praetorian.com/security-101/red-team-vs-penetration-testing
generated_at: 2026-09-03T12:39:04.938Z
generated_by: anthropic
source_hash: adce2514b3aa6da536b6221b9bc85a4eaecf5a0422a3b22808e9ca3844183e32
---

# Chrome DevTools

## Overview

chrome-devtools-mcp is an MCP server that exposes Chrome DevTools Protocol capabilities through the Model Context Protocol interface. It provides programmatic access to browser debugging and inspection features normally accessed via Chrome's built-in developer tools (F12). The server enables DOM/CSS manipulation, JavaScript execution, network traffic inspection, cookie/storage access, and performance profiling. In RTPI, this tool bridges the gap between traditional CLI-based red team tools and browser-based attack surfaces. Unlike manual DevTools usage, this MCP server allows AI agents to automate browser inspection and manipulation tasks. The underlying Chrome DevTools Protocol is the same interface used by browser automation frameworks and remote debugging tools.

## When to use

Use chrome-devtools-mcp when the engagement requires browser-based reconnaissance, client-side vulnerability identification, or session/credential extraction. Specific scenarios: (1) Inspecting JavaScript code and DOM structure to identify hidden endpoints, API keys, or authentication logic. (2) Extracting cookies, localStorage, sessionStorage, or IndexedDB contents for session hijacking or offline analysis. (3) Monitoring network requests to map API endpoints, identify unencrypted data transmission, or capture authentication tokens. (4) Modifying DOM elements or CSS to bypass client-side security controls or test UI redressing attacks. (5) Executing arbitrary JavaScript in the context of a target page to enumerate objects, call functions, or extract data. (6) Emulating browser extensions that exfiltrate data (similar to CursedChrome attacks mentioned in red team tool lists). (7) Testing multi-factor authentication flows by inspecting browser state between authentication steps. Do NOT use for general web requests (use curl/httpx instead) or when headless detection would compromise the engagement. This tool is for deep inspection, not simple HTTP interactions.

## Authentication & setup

Installation: The MCP server is invoked via `npx -y chrome-devtools-mcp@latest`, which auto-downloads the latest version. Requires Node.js runtime in RTPI environment. Chrome or Chromium browser must be installed and accessible on the system—the server will launch or attach to Chrome instances. No API keys or cloud authentication required; this is a local tool. Setup steps: (1) Verify Node.js is available (`node --version`). (2) Ensure Chrome/Chromium binary is in PATH or set CHROME_PATH environment variable. (3) The MCP server will handle browser instance management—it can launch new Chrome instances with remote debugging enabled (typically on port 9222) or attach to existing instances. (4) For red team stealth, consider using existing user profiles to inherit cookies/sessions: Chrome can be launched with `--user-data-dir` flag pointing to victim profile. (5) If testing requires specific browser configurations (disable CORS, ignore certificate errors), these are set via Chrome launch flags, not MCP parameters. The agent should not need to manage Chrome lifecycle directly—the MCP server abstracts this. Firewall note: If Chrome remote debugging port (9222) is blocked, the server cannot function.

## Key commands / parameters

The MCP server exposes DevTools capabilities as MCP tools/resources. Based on Chrome DevTools Protocol domains, expect these tool categories:

**DOM Inspection**: Query selectors (equivalent to $() and $$() console utilities), retrieve element properties, modify attributes, inject HTML. Console Utilities API functions like $(selector), $$(selector), $x(xpath), $0-$4 (last selected elements) are accessible.

**JavaScript Execution**: Execute arbitrary JS in page context (Runtime.evaluate), access console output, set breakpoints, debug functions. The debug(function) and undebug(function) utilities for setting breakpoints programmatically.

**Network Monitoring**: Enable network tracking, filter by URL, inspect request/response headers and bodies, block requests. Filter syntax: `url:example.com` or `-url:ads.com`.

**Storage Access**: Read/write cookies, localStorage, sessionStorage, IndexedDB. Extract all storage for session hijacking.

**Console API**: Run console commands (console.log, console.dir, console.table), inspect objects with dir(object), pretty-print XML with dirxml(object).

**Performance**: Capture coverage analysis to identify unused CSS/JS, profile runtime performance.

Parameters: MCP tool calls will use JSON parameters specifying selectors, script code, URLs to monitor, or storage keys. The server translates these to CDP commands. No direct command-line flags for the agent—configuration happens through MCP protocol messages.

## Example workflows

**Workflow 1 - Session Hijacking**: (1) Connect to chrome-devtools-mcp server. (2) Navigate to target application (or attach to existing tab). (3) Use storage inspection tool to extract all cookies: `{"action": "getCookies", "url": "https://target.com"}`. (4) Extract localStorage/sessionStorage contents. (5) Export cookie JSON for use with curl or import into attacker browser profile. (6) Identify JWT tokens or session IDs in storage or network traffic.

**Workflow 2 - API Endpoint Enumeration**: (1) Enable network monitoring: `{"action": "enableNetwork"}`. (2) Navigate to target SPA (single-page application). (3) Interact with UI elements (or script interactions). (4) Filter network log for API calls: `{"filter": "url:api"}`. (5) Extract all unique endpoints, methods, and parameters from captured requests. (6) Identify unauthenticated or weakly protected endpoints.

**Workflow 3 - Client-Side Bypass**: (1) Inspect DOM to locate client-side validation logic: `{"action": "querySelector", "selector": "form#login"}`. (2) Execute JS to disable validation: `{"action": "evaluate", "script": "document.querySelector('form').removeAttribute('onsubmit')"}`. (3) Modify hidden input fields or disabled buttons. (4) Bypass role-based UI restrictions by directly calling JavaScript functions exposed in global scope.

**Workflow 4 - Credential Harvesting**: (1) Inject JavaScript to hook form submission: `{"action": "evaluate", "script": "document.forms[0].addEventListener('submit', e => console.log(new FormData(e.target)))"}`. (2) Monitor console output for captured credentials. (3) Alternatively, use monitorEvents(element, 'submit') to log form data.

All workflows assume the agent issues MCP tool calls with appropriate JSON payloads—exact schema depends on server implementation.

## Output format

Responses from chrome-devtools-mcp are JSON-formatted MCP messages containing Chrome DevTools Protocol data. Structure varies by operation:

**DOM queries**: Returns element objects with properties (tagName, attributes, innerHTML, computedStyles). Similar to Elements panel view.

**JavaScript execution**: Returns result value (primitive or object), plus any console output, exceptions, or errors. Format matches Console panel output: `{"type": "string", "value": "result"}`.

**Network requests**: Array of request/response objects with URL, method, status, headers (as key-value pairs), body (base64 or text), timing data. Filter results based on request.

**Storage data**: Cookies as array of objects with name, value, domain, path, expiry, httpOnly, secure flags. localStorage/sessionStorage as key-value JSON. IndexedDB as structured object trees.

**Console logs**: Array of log entries with level (log/warn/error), message, timestamp, stack trace if error.

**Coverage reports**: Per-file breakdown showing total bytes, used bytes, unused ranges. Helps identify dead code.

Agent should parse JSON responses to extract actionable data (credentials, tokens, endpoints). Large outputs (full DOM trees) may require pagination or filtering. Binary data (images, fonts) typically returned as base64. Error responses include CDP error codes and messages—common errors: selector not found, script execution timeout, navigation failure.

## Common pitfalls

**Anti-automation detection**: Many sites detect headless Chrome via navigator.webdriver flag, missing plugins, or behavioral signatures. The MCP server may expose you unless Chrome is launched with evasion flags (--disable-blink-features=AutomationControlled). Request the server configure stealth mode if available. **Remote debugging port exposure**: Chrome's debugging port (9222) has full browser control—ensure it's not exposed to networks outside RTPI. Firewall appropriately. **Session contamination**: Using the same Chrome instance across multiple targets leaks cookies/storage. Request fresh profiles or incognito contexts per target. **CORS and CSP blocking**: Injected scripts may fail due to Content Security Policy. DevTools has privileges that bypass some restrictions, but not all. Test script injection thoroughly. **Performance overhead**: Enabling all DevTools domains (Network, Performance, Coverage) simultaneously consumes significant resources. Enable only needed domains. **Navigation timing**: Scripts executing before page load may fail. Wait for DOMContentLoaded or load events before DOM manipulation. Use CDP's Page.loadEventFired to synchronize. **Output size limits**: Full DOM or network logs can be massive. Apply filters aggressively (URL patterns, element selectors) to avoid overwhelming MCP transport. **Credential logging**: Be cautious logging sensitive data to console—it may persist in Chrome's DevTools history or crash dumps. Clear data post-engagement. **Version mismatches**: CDP protocol evolves with Chrome versions. Ensure chrome-devtools-mcp server supports your Chrome version. Check compatibility if tools fail unexpectedly.

## References

• https://www.headspin.io/blog/chrome-devtools-a-complete-guide
• https://www.microverse.org/blog/a-helpful-guide-to-learn-and-maximize-chrome-devtools
• https://www.debugbear.com/blog/use-chrome-devtools
• https://medium.com/swlh/the-basics-of-chrome-devtools-4d69a102a699
• https://x-team.com/magazine/7-powerful-chrome-devtools-features-every-web-developer-should-know-about
• https://github.com/GoogleChrome/devtools-docs/blob/master/docs/commandline-api.md
• https://developer.chrome.com/docs/devtools/console/reference
• https://developer.chrome.com/docs/devtools/console/utilities
• https://developer.chrome.com/docs/devtools/open
• https://peter.sh/experiments/chromium-command-line-switches
• https://bishopfox.com/blog/9-red-team-tools
• https://www.praetorian.com/security-101/red-team-vs-penetration-testing
