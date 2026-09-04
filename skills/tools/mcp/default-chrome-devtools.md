---
name: Chrome DevTools
description: MCP server exposing Chrome DevTools Protocol for programmatic
  browser inspection, DOM manipulation, network interception, and JavaScript
  execution.
registry: mcp
tool_id: default:chrome-devtools
category: mcp-server
tags:
  - browser
  - devtools
  - chrome
  - javascript
  - dom
  - network-analysis
  - reconnaissance
  - automation
mitre_techniques:
  - T1217
  - T1185
  - T1539
  - T1005
summary: "chrome-devtools-mcp exposes Chrome DevTools Protocol (CDP) over MCP
  for programmatic browser control. Use it to inspect live web application
  state, manipulate DOM/CSS, intercept network traffic, extract
  cookies/localStorage, execute arbitrary JavaScript in page context, and
  automate reconnaissance workflows. Invoke via npx -y
  chrome-devtools-mcp@latest. The server requires a running Chrome instance with
  remote debugging enabled (--remote-debugging-port=9222). CDP operates over
  WebSocket/HTTP; expect JSON responses containing DOM trees, network HAR data,
  console logs, and execution results. Key for post-exploitation cookie theft,
  client-side code analysis, and repeatable assessment automation. Watch for
  same-origin restrictions when accessing cross-domain frames; CDP has full
  access to all browser contexts including extensions. Cookies and tokens are
  cleartext-accessible via Runtime.evaluate or Network.getAllCookies. Output is
  structured JSON suitable for further parsing. Common errors: Chrome not
  launched with debugging port, port conflicts (9222 in use), WebSocket
  connection timeouts. Always verify target Chrome instance is reachable before
  invoking MCP tools."
sources:
  - https://www.headspin.io/blog/chrome-devtools-a-complete-guide
  - https://www.youtube.com/watch?v=fxplz32rgEQ
  - https://www.microverse.org/blog/a-helpful-guide-to-learn-and-maximize-chrome-devtools
  - https://www.debugbear.com/blog/use-chrome-devtools
  - https://medium.com/swlh/the-basics-of-chrome-devtools-4d69a102a699
  - https://github.com/GoogleChrome/devtools-docs/blob/master/docs/commandline-api.md
  - https://developer.chrome.com/docs/devtools/console/reference
  - https://developer.chrome.com/docs/devtools/console/utilities
  - https://developer.chrome.com/docs/devtools/open
  - https://developer.chrome.com/docs/devtools/settings
  - https://systemweakness.com/from-debugging-to-hacking-using-chrome-devtools-like-a-bug-hunter-838949adf76b
  - https://courses.redteamleaders.com/courses/e79d5f5c-181d-4a90-bedd-58d3320eabf3
generated_at: 2026-09-04T02:30:04.084Z
generated_by: anthropic
source_hash: adce2514b3aa6da536b6221b9bc85a4eaecf5a0422a3b22808e9ca3844183e32
---

# Chrome DevTools

## Overview

chrome-devtools-mcp is an MCP server that wraps the Chrome DevTools Protocol (CDP), providing programmatic access to Chrome's debugging and inspection capabilities. CDP is the same API powering the visual DevTools UI. Through this server, agents can inspect DOM structures, monitor network traffic, execute JavaScript in page context, extract cookies/localStorage, manipulate CSS, set breakpoints, and capture performance traces. This is equivalent to having full DevTools access in an automated, scriptable format. The protocol communicates over WebSocket (typically ws://localhost:9222) once Chrome is launched with --remote-debugging-port=9222. The MCP server translates agent requests into CDP commands and returns structured results.

## When to use

Use chrome-devtools-mcp when you need to interact with live browser state during web application assessments. Primary scenarios: (1) Extract session tokens, cookies, and localStorage from authenticated sessions for credential harvesting (T1539). (2) Analyze client-side JavaScript behavior, including obfuscated code, XSS sinks, and API endpoints not visible in static analysis. (3) Intercept and inspect network requests/responses to identify hidden parameters, API keys in headers, or GraphQL introspection endpoints. (4) Modify DOM and CSS on-the-fly to test client-side validation bypasses or UI redressing attacks. (5) Automate reconnaissance workflows requiring JavaScript rendering (SPA crawling, dynamic content enumeration). (6) Post-exploitation on compromised workstations where Chrome is running with debugging enabled—CDP becomes a C2-like channel for data exfiltration. Do NOT use for static HTML analysis (use curl/wget) or when browser automation frameworks like Puppeteer are overkill; this is for targeted, programmatic DevTools access.

## Authentication & setup

No built-in authentication mechanism. Security depends entirely on network-level access control to the debugging port. Setup: (1) Launch Chrome with remote debugging: chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug (use a temporary profile to avoid interference). (2) Verify Chrome is listening: curl http://localhost:9222/json/version should return JSON with WebSocket debugger URL. (3) Invoke MCP server: npx -y chrome-devtools-mcp@latest. The server will attempt to connect to ws://localhost:9222 by default. (4) If Chrome runs on a different host/port, set CDP_ENDPOINT environment variable: CDP_ENDPOINT=ws://192.168.1.100:9222 npx -y chrome-devtools-mcp@latest. OPSEC: The debugging port exposes full browser control to any network client; in red team scenarios, only enable on localhost or over encrypted tunnels (SSH forward remote port 9222 to local). If target workstation already has Chrome running with --remote-debugging-port (some malware/developer configs), you can attach directly without relaunch.

## Key commands / parameters

The MCP server exposes CDP domains as callable tools. Exact tool names depend on server implementation, but expect these patterns based on standard CDP domains: (1) Runtime.evaluate({expression: 'document.cookie'}) - execute JavaScript and return result; use for cookie theft, localStorage access (localStorage.getItem('token')), or triggering application logic. (2) Network.getAllCookies() - retrieve all cookies for current browser session; returns array of {name, value, domain, path, httpOnly, secure}. (3) DOM.getDocument() - fetch entire DOM tree as JSON; parse for hidden fields, CSRF tokens, or API keys in data attributes. (4) Network.enable() + Network.setRequestInterception({patterns: [{urlPattern: '*'}]}) - intercept all requests; modify headers, block requests, or log traffic. (5) Page.captureScreenshot() - take screenshot of current page state; useful for proof-of-exploit or content extraction. (6) Debugger.setBreakpoint() - set breakpoints in JavaScript for dynamic analysis. (7) DOMStorage.getDOMStorageItems({storageId: {isLocalStorage: true}}) - extract localStorage key-value pairs. (8) Console API calls ($0-$4 for recently inspected elements, $('selector') for jQuery-like selection). Parameters are JSON objects matching CDP spec. Most commands require a target (tab/page ID); use Target.getTargets() to list available contexts.

## Example workflows

Workflow 1 - Session hijacking: (1) Attach to running Chrome with active web session. (2) Call Runtime.evaluate({expression: 'document.cookie', returnByValue: true}) to extract cookies. (3) Call DOMStorage.getDOMStorageItems() to get localStorage tokens (common in SPAs). (4) Exfiltrate via MCP response; use cookies/tokens in separate requests to impersonate user. Workflow 2 - Hidden endpoint discovery: (1) Enable Network.enable(). (2) Navigate to target SPA via Page.navigate({url: 'https://target.com/app'}). (3) Interact with page via Runtime.evaluate() to trigger API calls (click buttons: document.querySelector('#submit').click()). (4) Call Network.getResponseBody() on captured request IDs to see full API responses, including undocumented parameters. Workflow 3 - XSS sink identification: (1) Load target page. (2) Use DOM.getDocument() to retrieve full DOM. (3) Parse JSON for innerHTML sinks: search nodes where attributes contain user-controlled input. (4) Use Runtime.evaluate() to inject test payloads (document.querySelector('#sink').innerHTML='<img src=x onerror=alert(1)>') and observe Console for errors. Workflow 4 - Post-exploitation data theft: (1) On compromised workstation, identify Chrome process with --remote-debugging-port. (2) Connect MCP server to that port. (3) Iterate through Target.getTargets() to find banking/email tabs. (4) Extract credentials via Runtime.evaluate() on password managers' autofill data or form fields (document.querySelector('input[type=password]').value).

## Output format

All CDP responses are JSON. Structure varies by command but follows pattern: {id: <request_id>, result: {...}} on success or {id: <request_id>, error: {code: <int>, message: <string>}} on failure. Runtime.evaluate returns {result: {type: 'string'|'object'|'undefined', value: <actual_value>}}. Network.getAllCookies returns {cookies: [{name, value, domain, path, expires, size, httpOnly, secure, session, sameSite}]}. DOM.getDocument returns {root: {nodeId, nodeType, nodeName, children: [...]}}—a recursive tree. Network captured bodies are base64-encoded if binary (images), plaintext otherwise. Console messages appear as {method: 'Console.messageAdded', params: {message: {level, text, url, lineNumber}}}. Parse JSON responses in agent code; for credential extraction, filter cookies array for session-related names (PHPSESSID, token, auth). For DOM analysis, recursively walk children nodes. CDP protocol spec defines exact schemas: https://chromedevtools.github.io/devtools-protocol/. The MCP server should pass through raw CDP JSON with minimal transformation.

## Common pitfalls

(1) Chrome not launched with --remote-debugging-port: MCP server fails to connect; always verify chrome://version shows command-line flag. (2) Port 9222 already in use: Another Chrome/process bound to port; kill existing debugger or choose alternate port (--remote-debugging-port=9223). (3) WebSocket connection timeout: Firewall or Chrome crash; check Chrome process is alive (ps aux | grep chrome). (4) Cross-origin frame access: CDP can access cross-origin iframes if same browsing context, but document.cookie in evaluate may return empty for HttpOnly cookies—use Network.getAllCookies instead. (5) Executing code in wrong context: Multi-tab scenarios require specifying Target ID; list targets first via Target.getTargets(), then attach to correct one with Target.attachToTarget(). (6) JavaScript evaluation returns {type: 'undefined'}: Expression had no return value or error; check Console domain for exception messages. (7) Rate limiting: Rapid CDP calls can cause Chrome to throttle or crash; add delays in automation loops. (8) Missing --user-data-dir: Chrome reuses default profile with existing extensions/state; use isolated profile for clean testing. (9) OPSEC failure: Debugging port exposed on 0.0.0.0 instead of 127.0.0.1; anyone on network can control browser. Always bind to localhost unless tunneling. (10) Binary response parsing: Network bodies for images/PDFs are base64; decode before processing.

## References

- https://developer.chrome.com/docs/devtools/console/reference
- https://developer.chrome.com/docs/devtools/console/utilities
- https://github.com/GoogleChrome/devtools-docs/blob/master/docs/commandline-api.md
- https://www.debugbear.com/blog/use-chrome-devtools
- https://systemweakness.com/from-debugging-to-hacking-using-chrome-devtools-like-a-bug-hunter-838949adf76b
- https://courses.redteamleaders.com/courses/e79d5f5c-181d-4a90-bedd-58d3320eabf3
- https://developer.chrome.com/docs/devtools/open
- https://chromedevtools.github.io/devtools-protocol/
