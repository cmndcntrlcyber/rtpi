---
name: Frida Trace
description: Dynamic instrumentation CLI for tracing function calls in native
  and Java code across Windows, Linux, macOS, iOS, and Android applications
registry: registry
tool_id: frida-trace
category: reverse-engineering
tags:
  - dynamic-analysis
  - hooking
  - reverse-engineering
  - runtime-tracing
  - instrumentation
  - mobile-security
  - api-monitoring
mitre_techniques:
  - T1106
  - T1562.001
  - T1140
summary: "frida-trace is a CLI tool that hooks function calls at runtime to
  trace execution flow. Use it to intercept native library functions (libc,
  Win32 API) or Java/Objective-C methods without modifying binaries. Requires
  frida-server running on target device for remote instrumentation
  (Android/iOS). Invoke with -U for USB-connected devices, -p <PID> to attach to
  running process, -f <path> to spawn new process, or bare process name to
  auto-attach. Use -i 'pattern' to include functions (wildcards supported:
  'recv*', 'open'), -I 'module' for specific libraries, -x/-X to exclude. Java
  methods with -j 'Class!method' syntax; uppercase -J excludes. Generates
  editable JavaScript handlers in __handlers__/ directory—modify these to
  inspect arguments, return values, or manipulate memory using Frida's
  JavaScript API. Output is real-time console log of function calls; handlers
  reload automatically on file save. Effective for bypass attempts, credential
  extraction, crypto function analysis, API behavior discovery, and malware
  dynamic analysis. Watch for performance impact and crashes when hooking
  high-frequency functions; exclude with -X/-J flags. Order matters: inclusions
  first, then exclusions. Use -- separator when spawned process has args with
  dashes."
sources:
  - https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0034/
  - https://sensepost.com/blog/2025/using-improving-frida-trace/
  - https://learnfrida.info/
  - https://learnfrida.info/basic_usage/
  - https://frida.re/docs/quickstart/
  - https://frida.re/docs/frida-trace/
  - https://github.com/frida/frida-tools/issues/188
  - https://tldrsec.com/p/tldr-sec-31
  - https://www.cyberark.com/resources/threat-research-blog/a-deep-dive-into-penetration-testing-of-macos-applications-part-2
  - https://www.vaadata.com/en/blog/frida-the-tool-dedicated-to-mobile-application-security/
  - https://www.ired.team/miscellaneous-reversing-forensics/windows-kernel-internals/instrumenting-windows-apis-with-frida
  - https://www.infosecinstitute.com/resources/malware-analysis/malware-instrumentation-with-frida/
generated_at: 2026-05-19T11:00:28.707Z
generated_by: anthropic
source_hash: 8663badd19dd7cb8bad1db83dce2c5a1e1f0395a52055b85ab74845c735574d7
---

# Frida Trace

## Overview

frida-trace is the command-line tracing utility in the Frida dynamic instrumentation toolkit. It hooks functions in running or spawned processes, logging calls with arguments and return values. Auto-generates JavaScript handler files that you can edit to customize instrumentation logic. Works across desktop (Windows, Linux, macOS) and mobile (Android, iOS) platforms. Operates by injecting into target process address space and intercepting function entry/exit points. Designed for rapid iterative exploration—handlers reload on file save without restarting trace.

## When to use

Use frida-trace when you need to understand application behavior without source code or static reverse engineering. Ideal for: discovering which APIs an obfuscated mobile app calls (SQL, JSON parsing, crypto); bypassing security checks by identifying validation functions; extracting credentials or encryption keys from function arguments; analyzing malware behavior (file operations, registry, network calls); debugging native library interactions; rapid reconnaissance before writing custom Frida scripts. Particularly effective when combined with controlled application actions (e.g., trigger login flow while tracing authentication functions). Prefer over full Frida scripting for initial exploration and quick pattern matching across many functions.

## Authentication & setup

For local processes (desktop): no additional setup required—frida-trace attaches directly. For remote devices (Android/iOS): deploy frida-server binary to target device first. Android example: push frida-server to /data/local/tmp/, execute via adb shell with appropriate privileges (root required for non-debuggable apps). Server listens on TCP localhost:27042 by default. Use -U flag to connect to USB-attached device, -R for remote, -H <host> for custom host. Authentication via --token if server configured with auth. For iOS: jailbreak required; install Frida via Cydia/Sileo or manually deploy. Ensure matching Frida versions between client (frida-trace) and server. Check connectivity with 'frida-ps -U' before tracing. For spawning processes with arguments containing dashes, use -- separator: 'frida-trace -f /path/to/binary -- --app-arg value'.

## Key commands / parameters

-U: connect to USB device (Android/iOS)
-R: connect to remote frida-server
-H <host>: specify remote host
-p <PID>: attach to running process by PID
-n <name>: attach by process name
-f <path>: spawn new process from binary path
-F: attach to frontmost application (mobile)
-i 'pattern': include functions matching pattern (wildcards supported; e.g., 'recv*', 'CreateFile*')
-I 'MODULE': include entire module (e.g., 'KERNEL32.DLL', 'libc.so')
-x 'pattern': exclude functions matching pattern
-X 'MODULE': exclude entire module
-j 'Class!method': trace Java/Objective-C methods (! separates class from method; wildcards: 'json!*' for all methods)
-J 'Class!method': exclude Java/Objective-C methods
-O <file>: read additional options from file
--decorate: add module name to output
--runtime=v8|qjs: choose JavaScript engine
Pattern syntax: 'module!function' traces specific exports; '!function' or 'function' traces across all modules; 'module!' traces all functions in module. Order matters: apply inclusions before exclusions.

## Example workflows

Trace file operations on Android app: 'frida-trace -U -i open -i read -i write com.example.app'

Discover SQL activity in obfuscated app: 'frida-trace -U -p 12345 -j "SQL!*" -j "sql!*" -J "ProblemClass!*"'

Monitor Windows credential APIs: 'frida-trace -i "Cred*" -p <explorer_PID>'

Intercept crypto on iOS: 'frida-trace -U -F -i "CCCrypt*" -i "SecKey*"'

Spawn process and trace CreateFile variants: 'frida-trace -f C:\\Windows\\System32\\notepad.exe -i "CreateFile*"'

Trace only KERNEL32 CreateFileW: 'frida-trace -i "CreateFileW" -I "KERNEL32.DLL" notepad.exe'

JSON parsing across all classes: 'frida-trace -U -p 12345 -j "json!*" -j "JSON!*"'

Edit generated handler to log buffer contents: navigate to __handlers__/<module>/<function>.js, modify onEnter/onLeave to use Memory.readUtf8String(args[1]) or hexdump(args[0]) per Frida API, save file—changes apply immediately.

## Output format

Real-time console output with one line per function call showing function name and basic argument info by default. Format: '<timestamp> <function_name>(<args>)'. Generated handlers in __handlers__/<module>/<function>.js define output structure. Default handlers print function name only; edit onEnter to log args (args[0], args[1]...) and onLeave for retval. Use log() within handlers for custom output. Memory operations: Memory.readUtf8String(ptr), Memory.readByteArray(ptr, len), hexdump(ptr) for binary data. Access return values via retval parameter in onLeave. handlers automatically reload on save—no restart needed. Output streams to stdout; redirect or tee for logging. Expect high verbosity with broad patterns—filter post-hoc or refine includes/excludes iteratively.

## Common pitfalls

Hooking high-frequency functions (e.g., memory allocators, logging) causes severe performance degradation or crashes—use -x/-X to exclude. Case sensitivity: -i 'createfile' won't match 'CreateFileW'; use wildcards or exact casing. Incorrect ordering: exclusions must follow inclusions or they're ignored. Spawning with arguments requires -- separator if args contain dashes, otherwise parsed as frida-trace flags. frida-server version mismatches cause connection failures—sync versions. Non-rooted Android/non-jailbroken iOS limits targets to debuggable apps only. Editing handlers while trace runs is safe, but syntax errors break instrumentation—test JS logic. Module name ambiguity: 'open' matches functions in all modules; specify 'libc.so!open' for precision. Forgot -U flag when targeting USB device defaults to local machine. Overly broad patterns generate massive __handlers__ directories—start narrow, expand as needed. Return value inspection requires onLeave handler—onEnter only sees arguments.

## References

• https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0034/
• https://sensepost.com/blog/2025/using-improving-frida-trace/
• https://learnfrida.info/
• https://learnfrida.info/basic_usage/
• https://frida.re/docs/quickstart/
• https://frida.re/docs/frida-trace/
• https://github.com/frida/frida-tools/issues/188
• https://www.ired.team/miscellaneous-reversing-forensics/windows-kernel-internals/instrumenting-windows-apis-with-frida
• https://www.cyberark.com/resources/threat-research-blog/a-deep-dive-into-penetration-testing-of-macos-applications-part-2
