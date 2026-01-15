# Agent Builder Docker Image
# Rust toolchain with cross-compilation support for Windows and Linux
# Used by RTPI to compile rust-nexus agents on-demand

FROM rust:1.75-slim-bookworm

# Metadata
LABEL maintainer="RTPI Team"
LABEL description="Rust cross-compilation environment for nexus-agent builds"
LABEL version="1.0.0"

# Install cross-compilation dependencies
# Note: upx is NOT included - not available on ARM64 Debian bookworm
# The build script handles missing upx gracefully (skips compression)
RUN apt-get update && apt-get install -y \
    # Windows cross-compilation (MinGW)
    gcc-mingw-w64-x86-64 \
    # Linux static compilation (musl)
    musl-tools \
    musl-dev \
    # Build essentials
    pkg-config \
    libssl-dev \
    # Utilities
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install cross-compilation targets
RUN rustup target add x86_64-pc-windows-gnu \
    && rustup target add x86_64-unknown-linux-musl \
    && rustup target add aarch64-unknown-linux-musl

# Configure cargo for cross-compilation
RUN mkdir -p /root/.cargo && \
    echo '[target.x86_64-pc-windows-gnu]' >> /root/.cargo/config.toml && \
    echo 'linker = "x86_64-w64-mingw32-gcc"' >> /root/.cargo/config.toml && \
    echo '' >> /root/.cargo/config.toml && \
    echo '[target.x86_64-unknown-linux-musl]' >> /root/.cargo/config.toml && \
    echo 'linker = "musl-gcc"' >> /root/.cargo/config.toml

# Set working directory
WORKDIR /build

# Copy build script
COPY build-agent.sh /usr/local/bin/build-agent.sh
RUN chmod +x /usr/local/bin/build-agent.sh

# Environment variables
ENV CARGO_TARGET_DIR=/build/target
ENV RUST_BACKTRACE=1

# Entrypoint - expects:
# - /build/rust-nexus mounted as volume (source code)
# - /output mounted as volume (build artifacts)
ENTRYPOINT ["/usr/local/bin/build-agent.sh"]

# Default arguments (can be overridden)
CMD ["linux", "x64", "", "/output"]
