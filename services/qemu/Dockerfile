FROM ubuntu:24.04

# QEMU user-mode emulation for cross-architecture RE
# Supports ARM, MIPS, RISC-V binary analysis

RUN apt-get update && apt-get install -y --no-install-recommends \
    qemu-user-static \
    qemu-system-arm \
    qemu-system-mips \
    binwalk \
    squashfs-tools \
    mtd-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

ENTRYPOINT ["tail", "-f", "/dev/null"]
