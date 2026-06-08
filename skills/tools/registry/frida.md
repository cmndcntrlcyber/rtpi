---
name: Frida
description: Dynamic instrumentation toolkit for injecting JavaScript into
  native processes to hook, trace, and modify behavior at runtime.
registry: registry
tool_id: frida
category: reverse-engineering
tags:
  - dynamic-instrumentation
  - hooking
  - reverse-engineering
  - runtime-analysis
  - mobile-security
  - code-injection
  - api-tracing
mitre_techniques:
  - T1055
  - T1106
  - T1574
summary: "Frida injects JavaScript into running processes (Windows, Linux,
  macOS, Android, iOS) to hook functions, modify arguments/returns, trace
  execution, and bypass security controls without modifying binaries. Use for:
  bypassing SSL pinning, API tracing, function hooking, defeating anti-debug,
  analyzing obfuscated code. Requires frida-server on remote/mobile targets
  (must match client version exactly). Attach modes: `-p PID` (running process),
  `-n NAME` (spawn by name), `-f PACKAGE` (spawn fresh), `-U` (USB device), `-H
  HOST:PORT` (remote). frida-trace auto-generates hook stubs: `frida-trace -U -i
  'recv*' -i 'send*' com.app`. Scripts reload on save. Use `Java.perform()` for
  Android/Java hooking, `Interceptor.attach()` for native. Common failure:
  version mismatch between client and server causes immediate disconnect. Check
  versions with `frida --version` and `frida-ps -U`. Supports CModule for inline
  C, Stalker for code tracing. For mobiles: deploy frida-server to
  /data/local/tmp (Android) or jailbroken iOS, forward ports if needed. Output
  is real-time REPL or logged with `-o`. Include/exclude filters are procedural
  (order matters): `-i 'str*' -i 'mem*' -X msvcrt.dll` applies sequentially. Use
  `--pause` to instrument before app execution. For Java:
  `Java.use('class.name')` wraps classes, call methods on instances, hook with
  `.implementation = function(){}`. Hexdump memory with
  `Memory.readByteArray()`, modify with `Memory.writeByteArray()`. Stalker
  traces every instruction (high overhead). Codeshare (`-c scriptname`) loads
  community scripts. Always test locally before deploying on operation;
  instrumentation can crash unstable apps."
sources:
  - https://www.vaadata.com/en/blog/frida-the-tool-dedicated-to-mobile-application-security/
  - https://learnfrida.info/
  - https://frida.re/docs/home/
  - https://github.com/cyberheartmi9/Frida-Guide/blob/main/Frida%20Guide/Frida%20Guide.md
  - https://frida.re/docs/quickstart/
  - https://learnfrida.info/basic_usage/
  - https://frida.re/docs/frida-trace/
  - https://r2wiki.readthedocs.io/en/latest/plugins/frida-commands/
  - https://support.corellium.com/features/frida/
  - https://frida.re/docs/frida-cli/
  - https://tldrsec.com/p/tldr-sec-31
  - https://evalian.co.uk/penetration-testing-vs-red-team-testing/
generated_at: 2026-05-19T10:59:14.530Z
generated_by: anthropic
source_hash: 1ceb7389149b4fbff9b4b96adb1d1022c25ec0ee8515e37041239fb1ffbdb83f
---

# Frida

## Overview

Frida is a dynamic binary instrumentation toolkit that injects JavaScript (or TypeScript) into running native processes to intercept, trace, and modify behavior in real time. It supports Windows, macOS, Linux, Android, iOS, FreeBSD, and QNX across x86, x64, ARM, and ARM64. Core technique: method hooking via Interceptor API to alter function arguments, return values, and execution flow without touching the original binary. Architecture: frida-core (injector) → frida-agent (JavaScript runtime in target) → your script. Includes frida CLI (REPL), frida-trace (auto-generate hooks), frida-ps (list processes), language bindings (Python, Node.js, .NET, Swift). Primary use cases: mobile app security testing, malware analysis, protocol reverse engineering, bypassing security controls (SSL pinning, root detection, integrity checks), API discovery, debugging without source code.

## When to use

Use Frida when you need runtime visibility or control without recompiling: bypassing certificate pinning to inspect HTTPS traffic; defeating anti-tampering/anti-debug during mobile pentests; tracing API calls to understand proprietary protocols; modifying app logic (e.g., force premium features, skip license checks) for vulnerability research; exploring closed-source binaries where static analysis is insufficient; hooking cryptographic functions to extract keys; following child processes spawned by a target; instrumenting native libraries in Android/iOS apps (NDK, system libs). NOT for: static binary patching (use radare2, Ghidra); fully automated scans (Frida requires scripting); cases where app crashes under instrumentation cannot be tolerated. Ideal for red team mobile assessments, reversing obfuscated code, exploit development needing precise control over execution.

## Authentication & setup

Local processes: no auth needed, Frida injects directly. Remote/mobile: requires frida-server binary running on target with matching version (check `frida --version` client-side, `frida-server --version` target-side). Android setup: push frida-server to `/data/local/tmp`, `chmod 755`, run as root (`su`, then `./frida-server &`). Connect via `frida -U` (USB, requires adb) or `frida -H <IP>:27042` if port-forwarded. iOS: jailbroken device required; install frida from Cydia/Sileo or manually place frida-server, run as root. For SSH tunneling: `ssh -L 27042:127.0.0.1:27042 root@device`, then `frida -H 127.0.0.1:27042`. Version sync critical: mismatched versions cause 'unable to communicate with remote frida-server' errors. Use `frida-ps -U` to verify connectivity (lists processes). For Corellium VMs: built-in frida-server on port 27042, forward via UI, connect with `-H <VM_IP>:27042`. Android adb forward: `adb forward tcp:27042 tcp:27042` if frida-server runs on non-default port. Capabilities: root/jailbreak typically required for full system hooking; user-space apps may work without root if debuggable.

## Key commands / parameters

**frida CLI**: `frida [target] [options]` where target is `-p PID` (attach to PID), `-n NAME` (attach by process name), `-f PATH/PACKAGE` (spawn new instance), `-U` (USB device), `-R` (remote default), `-H HOST:PORT` (specific remote), `-D DEVICE_ID` (specific device). Key flags: `-l SCRIPT.js` (load script, auto-reload on save), `--no-pause` (don't pause on spawn), `--pause` (pause at startup for instrumentation), `-o LOGFILE` (log output), `--runtime=v8|qjs` (choose JS engine), `-e CODE` (evaluate inline JS), `-c CODESHARE` (load from frida codeshare), `--stdio=inherit|pipe` (control target's stdio). **frida-trace**: `frida-trace [target] [filters]` auto-generates hook handlers. Filters: `-i PATTERN` (include functions matching glob), `-x PATTERN` (exclude), `-I MODULE` (include module), `-X MODULE` (exclude), `-T` (include imports), `-s` (debug symbols), `-a 'MODULE!OFFSET'` (trace specific address). Module-qualified: `-i 'msvcrt.dll!*cpy*'`. Order matters: `-i 'str*' -i 'mem*' -X msvcrt.dll` processes left-to-right. **frida-ps**: `frida-ps -U` (list USB device processes), `frida-ps -Uai` (list installed apps), `frida-ps -R` (remote). **Common script APIs**: `Interceptor.attach(addr, {onEnter: function(args){}, onLeave: function(retval){}})`, `Java.perform(fn)` (Android), `Java.use('class.name')` (wrap Java class), `ObjC.classes` (list iOS classes), `Module.findExportByName('lib', 'func')`, `Memory.readUtf8String(ptr)`, `Memory.writeByteArray(ptr, bytes)`, `Process.enumerateModules()`, `Stalker.follow()` (code tracing).

## Example workflows

**Bypass SSL pinning (Android)**: `frida -U -l ssl-unpin.js -f com.target.app` where script hooks `TrustManager` methods. **Trace all recv/send**: `frida-trace -U -i 'recv*' -i 'send*' -f com.app` generates handlers in `__handlers__/`, edit to log buffers. **Hook Java method**: `frida -U -f com.app --no-pause` then in REPL: `Java.perform(function(){ var Activity = Java.use('com.app.MainActivity'); Activity.checkLicense.implementation = function(){ return true; }; });` **Call native function**: `var open = new NativeFunction(Module.findExportByName(null, 'open'), 'int', ['pointer', 'int']); var fd = open(Memory.allocUtf8String('/etc/passwd'), 0);` **Dump arguments**: In frida-trace handler: `onEnter: function(log, args, state){ log('arg0: ' + args[0]); log(hexdump(args[1], {length: 64})); }` **Follow child processes**: `frida -f /bin/sh --runtime=v8 -e "Process.setExceptionHandler(function(e){console.log(e);});"` then hook `fork`/`execve`. **Extract crypto keys**: Hook `CCCrypt` (iOS) or `EVP_*` (OpenSSL), log key parameter in onEnter. **Modify return value**: `Interceptor.attach(addr, { onLeave: function(retval){ retval.replace(0); } });` **List loaded modules**: In REPL: `Process.enumerateModules().forEach(function(m){ console.log(m.name + ' @ ' + m.base); });` **Remote Android**: `adb forward tcp:27042 tcp:27042; frida -H 127.0.0.1:27042 -f com.app`

## Output format

Interactive REPL: JavaScript object representations printed to console, arrays/objects formatted as JSON-like. frida-trace: Per-function hook output prefixed with timestamp and thread ID, e.g., `1234 ms recvfrom()`. Use `log()` in handlers to write strings; `console.log()` for structured data. Hexdumps: `hexdump(ptr, {offset: 0, length: 256, header: true, ansi: true})` outputs columnar hex + ASCII. Scripts loaded with `-l`: stdout/stderr from script appears in REPL. Logging to file: `-o output.txt` captures all console output. Structured data: return JSON from scripts and parse in controller (Python/Node). frida-trace handlers: Modify `__handlers__/<module>/<function>.js`, files auto-reload. Use `send()` in script and `recv()` in controller for bidirectional messaging. Stalker output: `Stalker.follow()` produces instruction-level traces; use `Stalker.parse()` or log selectively (massive output). Java objects: `.toString()` methods invoked automatically; use `JSON.stringify()` cautiously (may trigger app logic). Errors: exceptions printed with stack traces; uncaught exceptions crash the script but not the target (usually).

## Common pitfalls

**Version mismatch**: Most common failure; client and server must match exactly. Update both or downgrade client. Check with `frida --version` and `frida-ps -U`. **Permission denied**: Android requires root for system apps or non-debuggable apps. iOS requires jailbreak. Use `su` before running frida-server. **App crashes on hook**: Verify function signature matches; wrong arg count or types cause segfaults. Use `try/catch` in onEnter/onLeave. Test hooks incrementally. **Anti-Frida detection**: Apps scan for frida-server, frida-agent libraries, or known artifacts. Rename frida-server binary, patch detection checks, or use obfuscation modules. **Hooking too early**: Modules may not be loaded yet. Use `Module.ensureInitialized()` or wait for dlopen events. For spawned apps (`-f`), hooks in `Java.perform()` apply after VM loads. **Stalker performance**: Tracing every instruction is extremely slow and generates gigabytes of logs. Use selectively or filter events. **Incorrect pointer dereferencing**: Native pointers require explicit reads: `args[0].readUtf8String()`, not `args[0]`. Check pointer validity with `args[0].isNull()`. **Script not reloading**: Ensure `-l` flag used and file saved. Syntax errors prevent reload; check REPL for parse errors. **Process dies on attach**: Some apps detect ptrace/debugging; use `--pause` to instrument before app logic runs, or patch anti-debug. **Java.perform() timing**: Must wrap all Java API calls; calling outside `Java.perform()` causes 'Java API not available'. **Order of filters in frida-trace**: `-i` and `-x` are procedural; `-i 'foo*' -X module` differs from `-X module -i 'foo*'`. Apply broad includes first, then exclude. **Forgotten cleanup**: `Interceptor.detachAll()` to remove hooks; lingering hooks can cause instability.

## References

• https://frida.re/docs/home/
• https://frida.re/docs/quickstart/
• https://frida.re/docs/frida-cli/
• https://frida.re/docs/frida-trace/
• https://learnfrida.info/
• https://learnfrida.info/basic_usage/
• https://www.vaadata.com/en/blog/frida-the-tool-dedicated-to-mobile-application-security/
• https://github.com/cyberheartmi9/Frida-Guide/blob/main/Frida%20Guide/Frida%20Guide.md
• https://r2wiki.readthedocs.io/en/latest/plugins/frida-commands/
• https://support.corellium.com/features/frida/
