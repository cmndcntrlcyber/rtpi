---
name: Chrome DevTools
description: MCP server providing Chrome DevTools Protocol access for DOM
  inspection, JavaScript execution, network analysis, and session control
registry: mcp
tool_id: default:chrome-devtools
category: mcp-server
tags:
  - chrome
  - devtools
  - browser-automation
  - javascript-execution
  - dom-inspection
  - session-hijacking
  - cookie-extraction
mitre_techniques:
  - T1185
  - T1539
  - T1056.004
  - T1113
summary: "chrome-devtools-mcp exposes Chrome DevTools Protocol (CDP) for
  programmatic browser control. Invoke via MCP using `npx -y
  chrome-devtools-mcp@latest`. Primary offensive uses: extract session cookies,
  inject JavaScript into active sessions, monitor network traffic, observe DOM
  state, and remotely control browsing sessions. Requires Chrome remote
  debugging enabled (--remote-debugging-port flag) or ability to restart Chrome
  with debugging. Key capabilities: execute JavaScript in Console context using
  Console domain commands, inspect DOM elements via Elements panel APIs, monitor
  network requests/responses, capture screenshots, modify local storage/cookies,
  and establish persistent control over browser sessions. Use for
  post-exploitation credential harvesting, session hijacking, real-time
  reconnaissance of authenticated web sessions, or data exfiltration from
  browser state. Can connect to existing Chrome instance via WebSocket endpoint
  (--wsEndpoint) or launch new isolated instance. Supports headless mode for
  stealth. Warning: killing and restarting Chrome with remote debugging is noisy
  and may alert users; prefer connecting to existing debug sessions when
  possible. Experimental vision mode enables coordinate-based interaction
  (click_at). Console Utilities API provides shortcuts: $0-$4 for recently
  inspected elements, $(selector) for DOM queries, copy() to export data. Filter
  console output by URL using url: prefix. Chrome process persistence and
  unusual parent processes are key detection indicators."
sources:
  - https://www.microverse.org/blog/a-helpful-guide-to-learn-and-maximize-chrome-devtools
  - https://www.freecodecamp.org/news/chrome-devtools/
  - https://x-team.com/magazine/7-powerful-chrome-devtools-features-every-web-developer-should-know-about
  - https://www.debugbear.com/blog/use-chrome-devtools
  - https://medium.com/swlh/the-basics-of-chrome-devtools-4d69a102a699
  - https://www.youtube.com/watch?v=m6V1VL6FNe8
  - https://developer.chrome.com/docs/devtools/console/reference
  - https://developer.chrome.com/docs/devtools/console/utilities
  - https://developer.chrome.com/docs/devtools/open
  - https://github.com/ChromeDevTools/chrome-devtools-mcp
  - https://posts.specterops.io/stalking-inside-of-your-chromium-browser-757848b67949?source=rss----f05f8696e3cc---4
  - https://embracethered.com/blog/posts/2020/chrome-spy-remote-control/
generated_at: 2026-05-19T10:54:24.691Z
generated_by: anthropic
source_hash: adce2514b3aa6da536b6221b9bc85a4eaecf5a0422a3b22808e9ca3844183e32
---

# Chrome DevTools

## Overview

chrome-devtools-mcp is an MCP server that provides programmatic access to Chrome DevTools Protocol (CDP). CDP allows instrumentation, inspection, debugging, and profiling of Chromium-based browsers through domains like DOM, Debugger, Network, Console, and Storage. The server acts as a bridge between MCP clients and Chrome instances, enabling both observation and control of browser state. It can either launch new Chrome instances with debugging enabled or connect to existing browsers running with remote debugging ports exposed. The tool surfaces the full CDP API surface including JavaScript execution, DOM manipulation, network traffic inspection, cookie/storage access, and screenshot capture.

## When to use

Use chrome-devtools-mcp during post-exploitation phases when Chrome/Chromium browsers are present on compromised systems. Primary scenarios: (1) Extract valid session cookies from active browser sessions for credential access and lateral movement, (2) Monitor authenticated browsing sessions in real-time to identify high-value targets or data exfiltration opportunities, (3) Inject JavaScript into web contexts to bypass client-side security controls or harvest credentials from forms, (4) Capture screenshots or HTML snapshots of authenticated sessions for reconnaissance, (5) Analyze network traffic to identify API endpoints, authentication tokens, or sensitive data in transit, (6) Remotely control victim browsers to navigate to attacker-controlled sites or execute actions in authenticated contexts, (7) Persist access by monitoring for specific login events (e.g., Azure, banking sites) and harvesting fresh cookies. Particularly valuable when targeting SaaS applications, cloud consoles, or any web-based management interfaces where session tokens provide immediate access.

## Authentication & setup

No authentication to the MCP server itself. Chrome debugging access requires either: (1) Launching Chrome with remote debugging enabled via --remote-debugging-port=<port> flag, or (2) Connecting to existing Chrome instance already running with debugging enabled. For post-exploitation: Kill existing Chrome process (noisy, may alert user), restart with debugging enabled, or search for Chrome instances already launched with debugging flags. Connection options: --wsEndpoint to connect to existing WebSocket debug endpoint (format: ws://localhost:9222/devtools/browser/<id>), --executablePath to specify Chrome binary location, --userDataDir to target specific profile, --isolated to create temporary profile that auto-cleans. Headless mode via --headless for stealth (no UI). Set --viewport for screenshot dimensions (max 3840x2160 in headless). Use --proxyServer for routing traffic through attacker infrastructure. Debug logging via --logFile with DEBUG env var set to chrome-devtools-mcp:*. Server starts Chrome automatically if no --wsEndpoint provided. Check for existing debug ports: enumerate listening ports 9222, 9223, etc., or look for Chrome processes with --remote-debugging-port in command line.

## Key commands / parameters

Launch server: `npx -y chrome-devtools-mcp@latest [options]`. Key parameters: --wsEndpoint <url> (connect to existing Chrome debug session), --headless (run without UI), --executablePath <path> (custom Chrome binary), --userDataDir <path> (target specific profile), --isolated (ephemeral profile), --viewport <WxH> (set dimensions, e.g., 1280x720), --proxyServer <url> (route through proxy), --channel <stable|beta|dev|canary> (Chrome channel), --logFile <path> (debug logs), --experimentalVision (enable coordinate-based click_at(x,y)), --experimentalMemory (memory tools), --wsHeaders '{"Authorization":"Bearer token"}' (custom WebSocket headers). Console Utilities API (execute in Console): $0-$4 (last 5 inspected elements, $0 most recent), $(selector) (querySelector alias), $$(selector) (querySelectorAll, returns array), $x(xpath) (XPath query), copy(object) (copy to clipboard), keys(object)/values(object) (object introspection), monitor(function) (log function calls), monitorEvents(element, [events]) (log DOM events), getEventListeners(element) (show listeners). Console filtering: url:<domain> (filter by source), -url:<domain> (exclude source). Network domain: capture requests/responses, block URLs via request blocking. Storage domain: access cookies, localStorage, sessionStorage. Page domain: navigate, capture screenshots, get HTML. Runtime domain: evaluate JavaScript, access execution contexts.

## Example workflows

Cookie extraction workflow: (1) Identify Chrome process and profile path, (2) Kill Chrome process: `taskkill /F /IM chrome.exe` or `pkill chrome`, (3) Launch with debugging: `chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\Users\victim\AppData\Local\Google\Chrome\User Data"`, (4) Connect MCP server: `npx -y chrome-devtools-mcp@latest --wsEndpoint=ws://localhost:9222`, (5) Use Storage domain to enumerate cookies for target domains, (6) Export cookies to Netscape format for import into attacker browser. Session monitoring workflow: (1) Connect to existing debug session, (2) Use monitorEvents() to watch for navigation or form submission, (3) Filter console for url:login or url:azure, (4) Capture cookies when auth events detected. JavaScript injection workflow: (1) Navigate to target page via Page.navigate, (2) Wait for load event, (3) Execute Runtime.evaluate with JavaScript payload (e.g., credential harvesting form overlay, keylogger, or data exfiltration), (4) Use Console API to retrieve results. Remote control workflow: (1) Establish persistent connection to browser, (2) Use Page.navigate for site navigation, (3) Use Input domain for mouse/keyboard simulation, (4) Use DOM domain to query and interact with elements, (5) Capture screenshots at intervals for HUMINT. Credential harvesting: (1) Monitor for banking or corporate login pages via URL filters, (2) Inject JavaScript to capture form inputs before submission, (3) Exfiltrate via Console.log or Network request to attacker server.

## Output format

MCP server communicates via JSON-RPC 2.0 over stdio. Chrome DevTools Protocol uses JSON message format with domains, methods, and events. Console API calls return JavaScript objects serialized as JSON. DOM queries return element references or arrays of elements. Network domain outputs request/response objects with headers, body, timing data. Storage domain returns cookies as objects with name, value, domain, path, expires, httpOnly, secure, sameSite fields. Screenshots return base64-encoded PNG data. JavaScript evaluation via Runtime.evaluate returns result object with value, type, description. Console.log output appears in Console panel, retrieve programmatically via Runtime.consoleAPICalled events. Error responses include error codes and descriptive messages. Use copy() utility function to export objects to system clipboard for extraction. Network Coverage analysis returns percentage of used/unused CSS/JS with line-by-line breakdown. Monitor events via Runtime.addBinding or Log domain for persistent observation.

## Common pitfalls

Killing and restarting Chrome is highly visible to users (closes all tabs, breaks active sessions) - prefer connecting to existing debug sessions when possible. Chrome may not restart with same profile if user-data-dir is locked - check for lock files. Remote debugging port may already be in use or blocked by firewall - enumerate available ports. Headless mode has viewport size limits (3840x2160) which may affect rendering. Some sites detect headless mode via navigator.webdriver or missing features - use full Chrome with --remote-debugging-port instead. Session cookies may have short expiration - harvest and use quickly or monitor for refresh. HttpOnly cookies accessible via DevTools but not via JavaScript injection - use Storage domain directly. CORS and CSP may block injected JavaScript - use Runtime.evaluate in page context, not isolated world. Chrome profiles may require user interaction (password unlock, profile selection) - --isolated mode avoids this but loses existing sessions. Detection risk: unusual Chrome parent process, --remote-debugging-port in command line, unexpected WebSocket connections to localhost:9222, Chrome processes with no visible windows in non-headless mode. Console Utilities API ($, $$, etc.) only available in Console context, not in Runtime.evaluate scripts. Some domains require specific Chrome permissions or flags to function.

## References

- https://github.com/ChromeDevTools/chrome-devtools-mcp
- https://developer.chrome.com/docs/devtools/console/utilities
- https://developer.chrome.com/docs/devtools/console/reference
- https://developer.chrome.com/docs/devtools/open
- https://posts.specterops.io/stalking-inside-of-your-chromium-browser-757848b67949
- https://embracethered.com/blog/posts/2020/chrome-spy-remote-control/
- https://www.debugbear.com/blog/use-chrome-devtools
- https://www.freecodecamp.org/news/chrome-devtools/
- https://www.microverse.org/blog/a-helpful-guide-to-learn-and-maximize-chrome-devtools
- https://x-team.com/magazine/7-powerful-chrome-devtools-features-every-web-developer-should-know-about
