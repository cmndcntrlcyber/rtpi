---
name: Qemu Aarch64
description: Linux user-space emulator for running aarch64 (ARM 64-bit) binaries
  on non-ARM hosts
registry: registry
tool_id: qemu-aarch64
category: reverse-engineering
tags:
  - emulation
  - aarch64
  - arm64
  - binary-analysis
  - reverse-engineering
  - qemu
  - user-mode
mitre_techniques:
  - T1027
  - T1140
  - T1059
summary: "qemu-aarch64 is a user-mode CPU emulator that runs single ARM 64-bit
  binaries on x86_64 or other host architectures without full system emulation.
  Use it to execute and analyze aarch64 malware samples, embedded firmware
  binaries, or mobile app native libraries when you lack ARM hardware. Invoke as
  '/usr/bin/qemu-aarch64 <binary> [args]'. The tool translates aarch64
  instructions to host CPU and syscalls to host kernel in real-time. Requires
  aarch64 shared libraries (typically in /usr/aarch64-linux-gnu/) unless the
  binary is statically linked. Set QEMU_LD_PREFIX to specify alternate library
  search paths. For reverse engineering: combine with strace (-strace flag),
  ltrace, or gdb (qemu-aarch64 -g <port>). Works well for quick triage of ARM
  malware or validating cross-compiled payloads. Not suitable for kernel
  modules, bootloaders, or code requiring hardware peripherals—use
  qemu-system-aarch64 for full VM emulation instead. Expect slower execution
  than native (10-50x depending on workload). Common failures: missing
  dependencies, incompatible kernel versions, or binaries that detect emulation
  via timing or CPU feature checks."
sources:
  - https://openqa-bites.github.io/posts/2022/2022-04-13-qemu-aarch64/
  - https://ww2.coastal.edu/mmurphy2/oer/qemu/aarch64/
  - https://manpages.debian.org/testing/qemu-system-arm/qemu-system-aarch64.1.en.html
  - https://www.qemu.org/docs/master/system/introduction.html
  - https://www.kernel.org/pub/linux/kernel/people/will/docs/qemu/qemu-arm64-howto.html
  - http://celery1124.github.io/an-experience-on-booting-aarch64-kernel-on-qemu/
  - https://gitlab.com/qemu-project/qemu/-/blob/master/configure
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
  - https://github.com/docker/for-mac/issues/5812
  - https://www.redhat.com/en/blog/hardening-qemu-through-continuous-security-testing
  - https://apple.stackexchange.com/questions/420445/what-is-this-qemu-system-aarch64-process-and-why-is-it-using-almost-3-gb-of-ram
  - https://news.ycombinator.com/item?id=27046272
generated_at: 2026-05-19T11:15:20.846Z
generated_by: anthropic
source_hash: 50a202ea405f23b02615d566f4cdfb8516cba7a102127ccf5ec40e68887f205f
---

# Qemu Aarch64

## Overview

qemu-aarch64 v6.2.0 is QEMU's user-mode emulator for the ARM 64-bit (aarch64) instruction set. Unlike qemu-system-aarch64 which emulates entire virtual machines, qemu-aarch64 runs individual Linux binaries compiled for aarch64 directly on your host OS. It dynamically translates ARM instructions to your host CPU and forwards system calls to the host kernel with architecture translation. This is ideal for reverse engineering, malware analysis, and testing cross-compiled binaries without dedicated ARM hardware or full VM overhead.

## When to use

Use qemu-aarch64 when you need to execute or dynamically analyze ARM 64-bit ELF binaries during red team operations: analyzing Android NDK libraries from APKs, reversing IoT device firmware userland binaries, validating ARM-compiled exploits or implants before deployment to ARM targets, deobfuscating packed ARM malware, or fuzzing aarch64 attack tools. Prefer this over full system emulation (qemu-system-aarch64) for faster startup and simpler workflows when you only need to run userland code. Not appropriate for kernel drivers, bootloaders, bare-metal firmware, or analysis requiring precise hardware interaction or anti-emulation bypass.

## Authentication & setup

No authentication required. Ensure the binary is executable (chmod +x). For dynamically linked binaries, install aarch64 cross-compilation libraries: 'apt-get install libc6-arm64-cross' on Debian/Ubuntu, which places libraries in /usr/aarch64-linux-gnu/. Set QEMU_LD_PREFIX environment variable to specify library root: 'export QEMU_LD_PREFIX=/usr/aarch64-linux-gnu'. For complex dependency trees, use 'qemu-aarch64 -L /path/to/sysroot'. To debug missing libraries, run with 'QEMU_STRACE=1' or '-strace' flag to trace syscalls. Statically linked binaries require no setup. Verify installation: 'qemu-aarch64 --version'.

## Key commands / parameters

Basic execution: 'qemu-aarch64 ./binary [args]'. Key flags: '-L path' sets library search path prefix (overrides QEMU_LD_PREFIX); '-g port' starts GDB server on specified port for remote debugging; '-strace' logs all syscalls to stderr (useful for behavioral analysis); '-d item1,item2' enables debug logging (e.g., '-d in_asm' for disassembly, '-d cpu' for CPU state); '-cpu cortex-a53' or '-cpu max' selects CPU model (default is generic). Environment pass-through: 'QEMU_STRACE=1 qemu-aarch64 ./binary'. For filesystem isolation, run inside a chroot or container. No built-in networking controls—process inherits host network stack. Exit codes are preserved from emulated binary.

## Example workflows

Analyze unknown ARM binary: 'file binary && qemu-aarch64 -strace ./binary 2>&1 | tee syscall.log'. Debug with GDB: terminal 1: 'qemu-aarch64 -g 1234 ./malware', terminal 2: 'gdb-multiarch -ex "target remote :1234" -ex "set architecture aarch64"'. Extract strings and run: 'strings -e l ./lib.so && qemu-aarch64 -L /mnt/firmware_root /mnt/firmware_root/bin/daemon'. Test cross-compiled implant: 'aarch64-linux-gnu-gcc exploit.c -o exploit -static && qemu-aarch64 ./exploit target_ip'. Trace library calls: 'qemu-aarch64 ./binary 2>&1 | grep -E "(open|connect|exec)"'. Automated sandbox: wrap in Docker with 'docker run --rm -v $(pwd):/work arm64v8/ubuntu qemu-aarch64 /work/sample'.

## Output format

qemu-aarch64 produces no output unless the emulated binary writes to stdout/stderr, which is passed through unmodified. With '-strace', syscall traces appear on stderr in the format: 'pid SYSCALL_NAME(arg1, arg2, ...) = return_value'. Debug flags ('-d') write verbose logs to stderr or files specified by '-D logfile'. Exit code matches the emulated process. Error messages (e.g., missing libraries) appear on stderr prefixed with 'qemu-aarch64:'. GDB server mode ('-g') outputs connection info then silently awaits debugger attachment. Crashes in the emulated binary report signal information. No structured output—parse stderr for analysis.

## Common pitfalls

Missing libraries cause immediate 'error while loading shared libraries' failures—verify QEMU_LD_PREFIX and install arm64 cross-libs. Binaries detecting emulation via timing attacks, CPU feature probing, or /proc inspection may refuse to run or alter behavior; consider patching checks. Multithreaded code may exhibit race conditions or deadlocks not present on real hardware due to translation artifacts. Kernel version mismatches can cause syscall failures if binary expects newer kernel than host provides. Performance is 10-50x slower than native—be patient with complex binaries. Hardcoded paths in binaries may fail; use '-L' to map to host filesystem. qemu-aarch64 does NOT emulate kernel modules, device drivers, or privileged instructions—use qemu-system-aarch64 for those. Some anti-analysis malware detects QEMU via CPU ID or timing side-channels.

## References

• https://openqa-bites.github.io/posts/2022/2022-04-13-qemu-aarch64/
• https://www.kernel.org/pub/linux/kernel/people/will/docs/qemu/qemu-arm64-howto.html
• https://manpages.debian.org/testing/qemu-system-arm/qemu-system-aarch64.1.en.html
• https://www.qemu.org/docs/master/system/introduction.html
• http://celery1124.github.io/an-experience-on-booting-aarch64-kernel-on-qemu/
• https://www.redhat.com/en/blog/hardening-qemu-through-continuous-security-testing
