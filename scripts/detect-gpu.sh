#!/bin/bash

# ==============================================================================
# GPU Detection Script for Ollama AI Integration
# ==============================================================================
# Purpose: Detect NVIDIA GPU and CUDA availability for Ollama deployment
# Enhancement: #08 - Ollama AI Integration (Phase 1, Task #OL-02)
# Created: 2025-12-27
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ==============================================================================
# Main GPU Detection Logic
# ==============================================================================

print_info "Starting GPU detection..."
echo ""

GPU_AVAILABLE=false
CUDA_AVAILABLE=false
NVIDIA_DOCKER_AVAILABLE=false
RECOMMENDED_PROFILE="cpu"

# ------------------------------------------------------------------------------
# 1. Check for NVIDIA GPU
# ------------------------------------------------------------------------------

print_info "Checking for NVIDIA GPU..."

if command_exists lspci; then
    if lspci | grep -i nvidia > /dev/null 2>&1; then
        GPU_AVAILABLE=true
        GPU_INFO=$(lspci | grep -i nvidia | head -1)
        print_success "NVIDIA GPU detected: $GPU_INFO"
    else
        print_warning "No NVIDIA GPU detected via lspci"
    fi
elif command_exists nvidia-smi; then
    if nvidia-smi > /dev/null 2>&1; then
        GPU_AVAILABLE=true
        GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
        print_success "NVIDIA GPU detected: $GPU_INFO"
    else
        print_warning "nvidia-smi command failed"
    fi
else
    print_warning "Neither lspci nor nvidia-smi available for GPU detection"
fi

echo ""

# ------------------------------------------------------------------------------
# 2. Check for CUDA Installation
# ------------------------------------------------------------------------------

print_info "Checking for CUDA installation..."

if command_exists nvcc; then
    CUDA_VERSION=$(nvcc --version | grep "release" | sed 's/.*release //' | sed 's/,.*//')
    CUDA_AVAILABLE=true
    print_success "CUDA detected: Version $CUDA_VERSION"
elif command_exists nvidia-smi; then
    if nvidia-smi > /dev/null 2>&1; then
        CUDA_VERSION=$(nvidia-smi | grep "CUDA Version" | sed 's/.*CUDA Version: //' | awk '{print $1}')
        CUDA_AVAILABLE=true
        print_success "CUDA runtime detected: Version $CUDA_VERSION"
    fi
else
    print_warning "CUDA not detected (nvcc command not found)"
fi

echo ""

# ------------------------------------------------------------------------------
# 3. Check for nvidia-docker / nvidia-container-runtime
# ------------------------------------------------------------------------------

print_info "Checking for NVIDIA Docker runtime..."

if command_exists docker; then
    # Check if nvidia runtime is available
    if docker info 2>/dev/null | grep -i "nvidia" > /dev/null 2>&1; then
        NVIDIA_DOCKER_AVAILABLE=true
        print_success "NVIDIA Docker runtime detected"
    else
        # Try alternative detection method
        if [ -f /etc/docker/daemon.json ]; then
            if grep -q "nvidia" /etc/docker/daemon.json 2>/dev/null; then
                NVIDIA_DOCKER_AVAILABLE=true
                print_success "NVIDIA Docker runtime configured in daemon.json"
            fi
        fi
    fi

    # Additional check for nvidia-container-runtime
    if command_exists nvidia-container-runtime; then
        NVIDIA_DOCKER_AVAILABLE=true
        print_success "nvidia-container-runtime command found"
    fi

    if [ "$NVIDIA_DOCKER_AVAILABLE" = false ]; then
        print_warning "NVIDIA Docker runtime not detected"
        print_info "You may need to install nvidia-docker2 or nvidia-container-toolkit"
    fi
else
    print_error "Docker is not installed or not accessible"
fi

echo ""

# ------------------------------------------------------------------------------
# 4. GPU Memory Check (if GPU available)
# ------------------------------------------------------------------------------

if [ "$GPU_AVAILABLE" = true ] && command_exists nvidia-smi; then
    print_info "Checking GPU memory..."

    GPU_MEMORY=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
    GPU_MEMORY_GB=$((GPU_MEMORY / 1024))

    print_info "Total GPU memory: ${GPU_MEMORY_GB}GB"

    if [ "$GPU_MEMORY_GB" -ge 8 ]; then
        print_success "Sufficient GPU memory for llama3:8b (requires ~5GB)"
    elif [ "$GPU_MEMORY_GB" -ge 4 ]; then
        print_warning "Limited GPU memory. Consider using quantized models (q4_0)"
    else
        print_warning "Insufficient GPU memory for most models. CPU fallback recommended."
    fi

    echo ""
fi

# ------------------------------------------------------------------------------
# 5. Determine Recommended Profile
# ------------------------------------------------------------------------------

print_info "Determining recommended deployment profile..."
echo ""

if [ "$GPU_AVAILABLE" = true ] && [ "$CUDA_AVAILABLE" = true ] && [ "$NVIDIA_DOCKER_AVAILABLE" = true ]; then
    RECOMMENDED_PROFILE="gpu"
    print_success "✓ GPU Profile Recommended"
    print_info "  All requirements met for GPU-accelerated Ollama deployment"
    print_info "  Expected inference time: <2s per request"
elif [ "$GPU_AVAILABLE" = true ] && [ "$CUDA_AVAILABLE" = true ]; then
    RECOMMENDED_PROFILE="cpu"
    print_warning "⚠ CPU Profile Recommended (NVIDIA Docker runtime missing)"
    print_info "  GPU detected but Docker GPU support not configured"
    print_info "  Install nvidia-docker2 or nvidia-container-toolkit to enable GPU"
    print_info "  Expected inference time: <10s per request (CPU mode)"
else
    RECOMMENDED_PROFILE="cpu"
    print_warning "⚠ CPU Profile Recommended (No GPU/CUDA detected)"
    print_info "  Ollama will use llama.cpp CPU fallback"
    print_info "  Expected inference time: <10s per request"
fi

echo ""

# ------------------------------------------------------------------------------
# 6. Summary and Recommendations
# ------------------------------------------------------------------------------

echo "=========================================================================="
echo "GPU DETECTION SUMMARY"
echo "=========================================================================="
echo ""
echo "GPU Available:            $([ "$GPU_AVAILABLE" = true ] && echo "✓ Yes" || echo "✗ No")"
echo "CUDA Available:           $([ "$CUDA_AVAILABLE" = true ] && echo "✓ Yes" || echo "✗ No")"
echo "NVIDIA Docker Available:  $([ "$NVIDIA_DOCKER_AVAILABLE" = true ] && echo "✓ Yes" || echo "✗ No")"
echo ""
echo "Recommended Profile:      $RECOMMENDED_PROFILE"
echo ""

if [ "$RECOMMENDED_PROFILE" = "gpu" ]; then
    echo "Next Steps:"
    echo "  1. Start Ollama with GPU profile:"
    echo "     docker compose --profile gpu up -d ollama"
    echo ""
    echo "  2. Download models:"
    echo "     ./scripts/download-ollama-models.sh"
    echo ""
elif [ "$RECOMMENDED_PROFILE" = "cpu" ]; then
    echo "Next Steps:"
    echo "  1. Start Ollama with CPU profile:"
    echo "     docker compose --profile cpu up -d ollama-cpu"
    echo ""
    echo "  2. Download models:"
    echo "     ./scripts/download-ollama-models.sh"
    echo ""

    if [ "$GPU_AVAILABLE" = true ] && [ "$NVIDIA_DOCKER_AVAILABLE" = false ]; then
        echo "To enable GPU support:"
        echo "  1. Install nvidia-container-toolkit:"
        echo "     sudo apt-get install -y nvidia-container-toolkit"
        echo "  2. Restart Docker:"
        echo "     sudo systemctl restart docker"
        echo "  3. Re-run this script"
        echo ""
    fi
fi

echo "=========================================================================="
echo ""

# ------------------------------------------------------------------------------
# 7. Export Results (for scripting)
# ------------------------------------------------------------------------------

# Create a JSON output file for programmatic access
OUTPUT_FILE="/tmp/rtpi-gpu-detection.json"
cat > "$OUTPUT_FILE" << EOF
{
  "gpu_available": $GPU_AVAILABLE,
  "cuda_available": $CUDA_AVAILABLE,
  "nvidia_docker_available": $NVIDIA_DOCKER_AVAILABLE,
  "recommended_profile": "$RECOMMENDED_PROFILE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

print_info "Detection results saved to: $OUTPUT_FILE"
echo ""

# Exit with appropriate code
if [ "$RECOMMENDED_PROFILE" = "gpu" ]; then
    exit 0  # GPU available
else
    exit 1  # CPU fallback
fi
