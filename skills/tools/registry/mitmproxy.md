---
name: Mitmproxy
description: Interactive HTTPS/HTTP proxy for intercepting, inspecting,
  modifying, and replaying web traffic; supports regular, transparent, and
  reverse proxy modes.
registry: registry
tool_id: mitmproxy
category: proxy
tags:
  - proxy
  - mitm
  - https
  - interception
  - traffic-analysis
  - web-debugging
  - ssl-inspection
mitre_techniques:
  - T1557
  - T1557.001
  - T1040
summary: "mitmproxy is an interactive HTTPS proxy that intercepts and logs
  HTTP/HTTPS traffic. Use it to capture and analyze application traffic, inspect
  API calls, modify requests/responses on-the-fly, and replay captured flows.
  Invoked as `mitmproxy` (TUI), `mitmweb` (web UI), or `mitmdump`
  (non-interactive). Default listen port is 8080. Requires installing CA
  certificate on target device/browser (visit mitm.it after proxy
  configuration). Supports multiple modes: regular (explicit proxy),
  transparent, reverse, SOCKS5, upstream, local (eBPF), and TUN. Use `--mode` to
  specify mode, `--listen-port` or `-p` to change port, `-w` to write flows to
  file, `-r` to read/replay flows, `-s` to load Python scripts, `--set` to
  configure options. Flows appear in real-time; use `?` for help, `q` to quit,
  `E` for event log, `:` for command prompt. Filter flows with `~d` (domain),
  `~u` (URL), `~m` (method), `~s` (status code), `~b` (body content). Export
  flows via command `:export.file <format> @focus <path>`. TUN and local modes
  require root/CAP_NET_ADMIN. Client must trust mitmproxy CA cert for HTTPS
  interception. Output is interactive by default; mitmdump provides
  non-interactive stream. Save flows with `-w file.mitm` for later analysis with
  `-r`. Use `--set anticomp=true` to request uncompressed data, `--set
  anticache=true` to strip caching headers. Scripts extend functionality via
  Python addon API."
sources:
  - https://earthly.dev/blog/mitmproxy/
  - https://docs.mitmproxy.org/stable/concepts/options/
  - https://docs.mitmproxy.org/stable/concepts/modes/
  - https://docs.mitmproxy.org/stable/overview/getting-started/
  - https://medium.com/ciandt-techblog/an-introduction-to-mitmproxy-f3654e6bd53b
  - https://www.stut-it.net/blog/2017/mitmproxy-cheatsheet.html
  - https://quickref.me/mitmproxy.html
  - https://docs.mitmproxy.org/stable/addons/options/
  - https://docs.mitmproxy.org/stable/concepts/commands/
  - https://www.mitmproxy.org/
  - https://www.synacktiv.com/en/publications/mitmproxy-for-fun-and-profit-interception-and-analysis-of-application-traffic
  - https://www.ibm.com/think/topics/red-teaming
generated_at: 2026-05-19T11:02:17.639Z
generated_by: anthropic
source_hash: e94fce53220e6261ba5e41e89676b31b0c704fc301b41c18f742b91323bb3758
---

# Mitmproxy

## Overview

mitmproxy is a Man-in-the-Middle proxy tool for intercepting, inspecting, modifying, and replaying HTTP/HTTPS traffic. It provides three interfaces: `mitmproxy` (interactive TUI), `mitmweb` (browser-based GUI on, `mitmdump` (non-interactive CLI output). Default mode is regular HTTP proxy listening on port 8080. Supports HTTP/1, HTTP/2, HTTP/3, WebSockets, and generic SSL/TLS protocols. Core capabilities include real-time traffic inspection, request/response modification, flow replay, traffic filtering, and scriptable automation via Python addons. Version 11.0.2 is installed at /usr/local/bin/mitmproxy.

## When to use

Use mitmproxy when you need to: (1) Debug application HTTP/HTTPS traffic to understand API interactions and responses. (2) Intercept mobile app or desktop application network calls when source code is unavailable. (3) Modify requests/responses on-the-fly to test error handling or edge cases. (4) Capture and replay traffic for testing or analysis. (5) Mock or redirect API endpoints by altering hostnames or responses. (6) Analyze encrypted HTTPS traffic from third-party applications. (7) Test how applications handle modified or malicious responses. (8) Document API behavior by exporting flows to curl/HTTPie/raw formats. (9) Build reproducible test cases from captured production traffic. (10) Investigate protocol-level behavior without reverse engineering binaries.

## Authentication & setup

**Certificate Installation (Required for HTTPS):** After starting mitmproxy and configuring device/browser to use the proxy, visit http://mitm.it from the proxied device. Download and install the appropriate certificate for your platform (Windows/macOS/Linux/iOS/Android). The certificate enables mitmproxy to decrypt HTTPS traffic. Without this, only HTTP traffic is visible and HTTPS connections will fail. **Proxy Configuration:** Configure client application or OS network settings to use HTTP proxy at <mitmproxy-host>:8080 (or custom port). For system-wide: set HTTP_PROXY and HTTPS_PROXY environment variables. For applications: use app-specific proxy settings. For mobile: configure Wi-Fi network proxy settings. **Transparent Mode:** Requires routing table manipulation and firewall rules to redirect traffic to mitmproxy without client configuration. Use `--mode transparent` with iptables/pf rules. **TUN Mode:** Requires root privileges or CAP_NET_ADMIN. Use `sudo mitmdump --mode tun`. Creates virtual network interface for transparent interception. **Local Mode (eBPF):** Requires Linux 6.8+, root/sudo for privileged subprocess. Use `--mode local` to capture local process traffic without routing changes. **Docker:** Default entrypoint drops privileges; use appropriate capabilities and `--mode` for TUN/local modes.

## Key commands / parameters

**Startup:** `mitmproxy` (TUI), `mitmweb` (web UI), `mitmdump` (CLI output). **Port:** `-p <port>` or `--listen-port <port>` (default 8080). **Modes:** `--mode regular` (default explicit proxy), `--mode transparent`, `--mode reverse:http://backend:port`, `--mode socks5`, `--mode upstream:http://proxy:port`, `--mode local` (eBPF), `--mode tun` (virtual interface). Append `@host:port` to override listen address per mode. **Flow I/O:** `-w <file>` (write flows to file as they arrive), `-r <file>` (read flows from file), `-a <file>` (append flows), `-C <file>` (replay client requests), `-S <file>` (replay server responses). **Filtering:** `-f '<filter>'` (apply filter expression on startup). **Scripts:** `-s <script.py>` (load Python addon). **Options:** `--set key=value` (configure options, e.g., `--set anticomp=true`, `--set anticache=true`, `--set connect_addr=<IP>`, `--set ignore_hosts=pattern`). **No Server:** `-n` (offline analysis mode, no proxy server). **Interactive Keys (mitmproxy TUI):** `?` (context help), `q` (quit/back), `:` (command prompt), `E` (event log), `O` (options editor), `z` (clear flows), `r` (replay flow), `Tab` (next), `Enter` (select/inspect). **Filter Syntax:** `~d <domain>`, `~u <regex>` (URL), `~m <method>`, `~s <status>`, `~b <regex>` (body content), `~websocket` (WebSocket flows). **Commands:** `:export.file <format> @focus <path>` (formats: curl, httpie, raw, raw_request, raw_response), `:replay.client [flow]`, `:replay.server [flow]`. **Help:** `--help` (general help), `--commands` (list all commands).

## Example workflows

**1. Basic HTTPS inspection:** Start `mitmproxy`, configure browser proxy to Configure client to use proxy. Visit http://mitm.it and install certificate. Browse target site; flows appear in mitmproxy. Press Enter on a flow to inspect headers/body. Press `q` to return. **2. Capture mobile app traffic:** Start `mitmweb` for easier inspection. Get local IP (`ifconfig`/`ipconfig`). On mobile device: configure Wi-Fi proxy to <local-IP>:8080. Visit http://mitm.it from mobile browser, install certificate. Launch target app; API calls appear in mitmweb. **3. Save and replay flows:** `mitmproxy -w capture.mitm`. Perform actions to capture traffic. Stop with Ctrl+C. Replay offline: `mitmproxy -r capture.mitm -n` (no server mode). Navigate flows with arrow keys. **4. Filter specific domain:** `mitmproxy -f '~d example.com'` or within TUI press `f` and enter `~d example.com`. Only flows matching domain are shown. **5. Export request as curl:** In mitmproxy, navigate to desired flow. Press `:` to enter command mode. Type `export.file curl @focus /tmp/request.curl`. Check /tmp/request.curl for executable curl command. **6. Modify responses with script:** Create `addheader.py` with addon that modifies `response` event. Run `mitmproxy -s addheader.py`. Requests through proxy will have responses modified per script logic. **7. Reverse proxy mode:** `mitmproxy --mode reverse: -p 8001`. Proxy listens on 8001, forwards to example.com:80. Client connects to localhost:8001, sees example.com content, mitmproxy intercepts. **8. Docker daemon traffic:** Configure Docker daemon.json with proxy settings pointing to mitmproxy. Restart Docker. Pull image; registry requests appear in mitmproxy. **9. Transparent proxy (Linux):** `sudo iptables -t nat -A OUTPUT -p tcp --dport 80 -j REDIRECT --to-port 8080; sudo iptables -t nat -A OUTPUT -p tcp --dport 443 -j REDIRECT --to-port 8080; sudo mitmproxy --mode transparent`. System HTTP/HTTPS traffic is transparently intercepted. **10. Search flow bodies:** In mitmproxy TUI, press `f` for filter, enter `~b "api_key"` to show only flows with 'api_key' in request/response body.

## Output format

**mitmproxy (TUI):** Interactive terminal interface. Flows listed vertically with method, status, domain, path. Color-coded by status (green=2xx, blue=3xx, yellow=4xx, red=5xx). Press Enter on flow to see request/response tabs with headers and body. Body auto-decoded based on Content-Type (JSON prettified, images shown as hex, etc.). **mitmweb (Web UI):** Browser interface at Flows in table format with columns for time, method, host, path, status, size, duration. Click flow to see detail pane with Request/Response tabs, headers, and formatted body. Supports searching and filtering via UI controls. **mitmdump (CLI):** Non-interactive output. Each flow prints to stdout in format: timestamp, client IP, method, domain, path, status, size. Example: ` 127.0.0.1:54321: GET example.com/api/v1/users 200 OK 1.2kB`. Use `-q` for quieter output, `-v` for verbose. **Flow Files (.mitm):** Binary format containing serialized flows. Not human-readable. Use `-r` to read into any mitmproxy tool. Can be converted to other formats via `:export.file` command. **Export Formats:** `curl` (executable curl command), `httpie` (httpie command), `raw` (full HTTP message), `raw_request` (request only), `raw_response` (response only). **Event Log:** Press `E` in mitmproxy TUI to see internal events, errors, addon messages. Useful for debugging script issues or understanding proxy behavior.

## Common pitfalls

**Certificate trust issues:** HTTPS traffic fails or appears as CONNECT tunnels if client doesn't trust mitmproxy CA certificate. Must install cert from mitm.it on each device/browser. Some apps use certificate pinning and will reject mitmproxy cert regardless—these cannot be intercepted without binary patching. **Wrong proxy configuration:** Client must use HTTP proxy protocol, not SOCKS unless `--mode socks5`. HTTPS_PROXY env var must point to HTTP proxy, not an HTTPS URL. **Port conflicts:** Default port 8080 may be in use. Check with `lsof -i :8080` or `netstat`. Use `-p` to specify alternate port. **Transparent mode routing:** Requires correct iptables/pf rules and IP forwarding enabled. Traffic must be routed to mitmproxy port. Incorrect rules result in no traffic or connection failures. **Permissions for TUN/local modes:** TUN and local modes require root or CAP_NET_ADMIN. Running without privilege shows error. Use `sudo` or grant capabilities to Python interpreter. **Docker privilege dropping:** Docker entrypoint drops privileges by default. TUN mode in container needs capability configuration or privileged mode. **Filter syntax errors:** Incorrect filter expressions cause no flows to display. Test filters incrementally. Use `~d` for domain, not full URL. Regex must be valid. **Flow not appearing:** Check client proxy config, certificate trust, and that application respects proxy settings. Some apps ignore system proxy. Use transparent/TUN mode as alternative. **Script errors silently fail:** Python addon errors may not be obvious. Press `E` for event log to see exceptions. Test scripts with simple print statements first. **Replay doesn't match original:** Server state may have changed. Replay sends identical requests but server response may differ. Some requests include timestamps/nonces that invalidate replay. **Performance with large bodies:** Inspecting flows with multi-GB bodies (video streams, large downloads) can freeze UI. Use filters to exclude large flows or increase resource limits. **HTTP/2 disabled by default in older versions:** Version 11.0.2 should have HTTP/2 enabled, but if seeing issues, check `--set http2=true`. **WebSocket inspection incomplete:** WebSocket frames are captured but full message reconstruction depends on application framing. May need custom script for full analysis.

## References

• https://earthly.dev/blog/mitmproxy/
• https://docs.mitmproxy.org/stable/concepts/options/
• https://docs.mitmproxy.org/stable/concepts/modes/
• https://docs.mitmproxy.org/stable/overview/getting-started/
• https://medium.com/ciandt-techblog/an-introduction-to-mitmproxy-f3654e6bd53b
• https://www.stut-it.net/blog/2017/mitmproxy-cheatsheet.html
• https://quickref.me/mitmproxy.html
• https://docs.mitmproxy.org/stable/addons/options/
• https://docs.mitmproxy.org/stable/concepts/commands/
• https://www.mitmproxy.org/
• https://www.synacktiv.com/en/publications/mitmproxy-for-fun-and-profit-interception-and-analysis-of-application-traffic
