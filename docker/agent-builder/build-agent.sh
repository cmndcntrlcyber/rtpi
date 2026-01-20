#!/bin/bash
# Agent Builder Script
# Compiles rust-nexus agent for specified platform and architecture
#
# Usage: build-agent.sh PLATFORM ARCH FEATURES OUTPUT_DIR
#   PLATFORM: windows | linux | macos (default: linux)
#   ARCH: x64 | x86 | arm64 (default: x64)
#   FEATURES: comma-separated Cargo features (default: none)
#   OUTPUT_DIR: output directory for binary (default: /output)

set -e

# Parse arguments
PLATFORM="${1:-linux}"
ARCH="${2:-x64}"
FEATURES="${3:-}"
OUTPUT_DIR="${4:-/output}"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Navigate to rust-nexus source
cd /build/rust-nexus

echo "=========================================="
echo "Agent Builder - Starting Build"
echo "=========================================="
echo "Platform:    $PLATFORM"
echo "Arch:        $ARCH"
echo "Features:    ${FEATURES:-none}"
echo "Output:      $OUTPUT_DIR"
echo "=========================================="

# Determine Rust target triple based on platform and architecture
case "$PLATFORM" in
    windows)
        case "$ARCH" in
            x64|x86_64)
                TARGET="x86_64-pc-windows-gnu"
                BINARY_NAME="nexus-agent.exe"
                STRIP_CMD="x86_64-w64-mingw32-strip"
                ;;
            x86|i686)
                TARGET="i686-pc-windows-gnu"
                BINARY_NAME="nexus-agent.exe"
                STRIP_CMD="i686-w64-mingw32-strip"
                echo "Note: 32-bit Windows requires cross-compilation setup"
                ;;
            *)
                echo "Error: Unsupported architecture '$ARCH' for Windows"
                exit 1
                ;;
        esac
        ;;
    linux)
        case "$ARCH" in
            x64|x86_64)
                TARGET="x86_64-unknown-linux-musl"
                BINARY_NAME="nexus-agent"
                STRIP_CMD="strip"
                ;;
            arm64|aarch64)
                TARGET="aarch64-unknown-linux-musl"
                BINARY_NAME="nexus-agent"
                STRIP_CMD="aarch64-linux-gnu-strip"
                ;;
            x86|i686)
                TARGET="i686-unknown-linux-musl"
                BINARY_NAME="nexus-agent"
                STRIP_CMD="strip"
                ;;
            *)
                echo "Error: Unsupported architecture '$ARCH' for Linux"
                exit 1
                ;;
        esac
        ;;
    macos)
        case "$ARCH" in
            x64|x86_64)
                TARGET="x86_64-apple-darwin"
                BINARY_NAME="nexus-agent"
                STRIP_CMD="strip"
                ;;
            arm64|aarch64)
                TARGET="aarch64-apple-darwin"
                BINARY_NAME="nexus-agent"
                STRIP_CMD="strip"
                echo "Note: Building for Apple Silicon (M1/M2)"
                ;;
            *)
                echo "Error: Unsupported architecture '$ARCH' for macOS"
                exit 1
                ;;
        esac
        ;;
    *)
        echo "Error: Unsupported platform '$PLATFORM'. Use 'windows', 'linux', or 'macos'"
        exit 1
        ;;
esac

echo "Target triple: $TARGET"
echo "Binary name:   $BINARY_NAME"
echo ""

# Set up cross-compilation environment for Windows
if [ "$PLATFORM" = "windows" ]; then
    echo "Setting up Windows cross-compilation environment..."
    # Use vendored OpenSSL for Windows cross-compilation
    export OPENSSL_STATIC=1
    export OPENSSL_RUST_USE_NASM=0
    # Tell openssl-sys to use vendored OpenSSL
    export X86_64_PC_WINDOWS_GNU_OPENSSL_NO_VENDOR=0
fi

# Build command construction
BUILD_CMD="cargo build --release --target $TARGET -p nexus-agent"

# Add features if specified
if [ -n "$FEATURES" ]; then
    BUILD_CMD="$BUILD_CMD --features $FEATURES"
    echo "Building with features: $FEATURES"
fi

echo ""
echo "Executing: $BUILD_CMD"
echo ""

# Execute build
$BUILD_CMD

# Locate built binary - respect CARGO_TARGET_DIR if set
TARGET_DIR="${CARGO_TARGET_DIR:-target}"
BUILT_BINARY="$TARGET_DIR/$TARGET/release/$BINARY_NAME"

if [ ! -f "$BUILT_BINARY" ]; then
    echo "Error: Built binary not found at $BUILT_BINARY"
    exit 1
fi

echo ""
echo "Build completed successfully!"
echo "Binary location: $BUILT_BINARY"

# Copy binary to output directory
cp "$BUILT_BINARY" "$OUTPUT_DIR/$BINARY_NAME"
echo "Copied to: $OUTPUT_DIR/$BINARY_NAME"

# Get original size
ORIGINAL_SIZE=$(stat -c%s "$OUTPUT_DIR/$BINARY_NAME" 2>/dev/null || stat -f%z "$OUTPUT_DIR/$BINARY_NAME" 2>/dev/null)
echo "Original size: $ORIGINAL_SIZE bytes"

# Strip debug symbols (reduce binary size)
echo "Stripping debug symbols..."
if command -v "$STRIP_CMD" &> /dev/null; then
    $STRIP_CMD "$OUTPUT_DIR/$BINARY_NAME" 2>/dev/null || echo "Strip failed (non-critical)"
else
    echo "Warning: $STRIP_CMD not found, skipping strip"
fi

# UPX compression (optional - significant size reduction)
if command -v upx &> /dev/null; then
    echo "Compressing with UPX..."
    upx --best --lzma "$OUTPUT_DIR/$BINARY_NAME" 2>/dev/null || echo "UPX compression skipped"
fi

# Get final size
FINAL_SIZE=$(stat -c%s "$OUTPUT_DIR/$BINARY_NAME" 2>/dev/null || stat -f%z "$OUTPUT_DIR/$BINARY_NAME" 2>/dev/null)
echo "Final size: $FINAL_SIZE bytes"

# Calculate SHA256 hash
HASH=$(sha256sum "$OUTPUT_DIR/$BINARY_NAME" | cut -d' ' -f1)
echo "SHA256: $HASH"

# Write build info
cat > "$OUTPUT_DIR/BUILD_INFO.json" << EOF
{
    "platform": "$PLATFORM",
    "architecture": "$ARCH",
    "target": "$TARGET",
    "features": "$FEATURES",
    "binary": "$BINARY_NAME",
    "originalSize": $ORIGINAL_SIZE,
    "finalSize": $FINAL_SIZE,
    "sha256": "$HASH",
    "buildTime": "$(date -Iseconds)",
    "rustVersion": "$(rustc --version)",
    "cargoVersion": "$(cargo --version)"
}
EOF

echo ""
echo "=========================================="
echo "Build Complete"
echo "=========================================="
echo "Binary:    $OUTPUT_DIR/$BINARY_NAME"
echo "Info:      $OUTPUT_DIR/BUILD_INFO.json"
echo "Size:      $FINAL_SIZE bytes"
echo "SHA256:    $HASH"
echo "=========================================="
