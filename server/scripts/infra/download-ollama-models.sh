#!/bin/bash

# ==============================================================================
# Ollama Model Download Script
# ==============================================================================
# Purpose: Download and verify Ollama models for RTPI AI integration
# Enhancement: #08 - Ollama AI Integration (Phase 1, Tasks #OL-06, #OL-07)
# Created: 2025-12-27
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
OLLAMA_CONTAINER="${OLLAMA_CONTAINER:-rtpi-ollama}"
OLLAMA_CPU_CONTAINER="${OLLAMA_CPU_CONTAINER:-rtpi-ollama-cpu}"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

# Models to download
MODELS=(
    "llama3:8b"         # General purpose AI (4.7GB)
    "qwen2.5-coder:7b"  # Code-focused AI (4.1GB)
)

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

print_progress() {
    echo -e "${CYAN}[PROGRESS]${NC} $1"
}

# Function to check if Docker container is running
check_container() {
    local container_name=$1
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        return 0
    else
        return 1
    fi
}

# Function to detect which Ollama container is running
detect_ollama_container() {
    if check_container "$OLLAMA_CONTAINER"; then
        echo "$OLLAMA_CONTAINER"
        return 0
    elif check_container "$OLLAMA_CPU_CONTAINER"; then
        echo "$OLLAMA_CPU_CONTAINER"
        return 0
    else
        return 1
    fi
}

# Function to pull a model
pull_model() {
    local model=$1
    local container=$2

    print_progress "Downloading model: $model"
    print_info "This may take several minutes depending on your internet connection..."

    if docker exec "$container" ollama pull "$model"; then
        print_success "Successfully downloaded: $model"
        return 0
    else
        print_error "Failed to download: $model"
        return 1
    fi
}

# Function to verify a model
verify_model() {
    local model=$1
    local container=$2

    print_info "Verifying model: $model"

    if docker exec "$container" ollama list | grep -q "$model"; then
        local size=$(docker exec "$container" ollama list | grep "$model" | awk '{print $2}')
        print_success "Model verified: $model (Size: $size)"
        return 0
    else
        print_error "Model verification failed: $model"
        return 1
    fi
}

# Function to test a model with a simple prompt
test_model() {
    local model=$1
    local container=$2

    print_info "Testing model: $model"

    local test_prompt="Say 'Hello, RTPI!' in one sentence."

    if docker exec "$container" ollama run "$model" "$test_prompt" > /tmp/ollama-test-output.txt 2>&1; then
        local response=$(cat /tmp/ollama-test-output.txt | head -3)
        print_success "Model test passed: $model"
        print_info "Response preview: ${response:0:100}..."
        rm -f /tmp/ollama-test-output.txt
        return 0
    else
        print_error "Model test failed: $model"
        return 1
    fi
}

# Function to get model info
get_model_info() {
    local model=$1
    local container=$2

    print_info "Getting model information: $model"

    docker exec "$container" ollama show "$model" 2>/dev/null || true
}

# ==============================================================================
# Main Script
# ==============================================================================

echo ""
echo "=========================================================================="
echo "RTPI Ollama Model Download Script"
echo "=========================================================================="
echo ""

# Step 1: Detect running Ollama container
print_info "Detecting Ollama container..."

CONTAINER=$(detect_ollama_container)

if [ $? -ne 0 ]; then
    print_error "No Ollama container is running!"
    echo ""
    echo "Please start Ollama first:"
    echo "  For GPU:  docker compose --profile gpu up -d ollama"
    echo "  For CPU:  docker compose --profile cpu up -d ollama-cpu"
    echo ""
    exit 1
fi

print_success "Found running container: $CONTAINER"
echo ""

# Step 2: Check Ollama service is responsive
print_info "Checking Ollama service health..."

if ! docker exec "$CONTAINER" curl -s -f http://localhost:11434/api/tags > /dev/null; then
    print_error "Ollama service is not responding!"
    print_info "Waiting 10 seconds for service to start..."
    sleep 10

    if ! docker exec "$CONTAINER" curl -s -f http://localhost:11434/api/tags > /dev/null; then
        print_error "Ollama service still not responding. Please check container logs:"
        echo "  docker logs $CONTAINER"
        exit 1
    fi
fi

print_success "Ollama service is healthy"
echo ""

# Step 3: Check available disk space
print_info "Checking available disk space..."

AVAILABLE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')

if [ "$AVAILABLE_SPACE" -lt 15 ]; then
    print_warning "Low disk space detected: ${AVAILABLE_SPACE}GB available"
    print_info "Recommended: At least 15GB free space for both models"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Download cancelled"
        exit 0
    fi
else
    print_success "Sufficient disk space: ${AVAILABLE_SPACE}GB available"
fi

echo ""

# Step 4: Download models
print_info "Starting model downloads..."
echo ""

SUCCESSFUL_DOWNLOADS=0
FAILED_DOWNLOADS=0

for model in "${MODELS[@]}"; do
    echo "----------------------------------------------------------------------"
    print_info "Processing: $model"
    echo "----------------------------------------------------------------------"

    # Check if model already exists
    if docker exec "$CONTAINER" ollama list | grep -q "$model"; then
        print_warning "Model already exists: $model"
        read -p "Re-download? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping: $model"
            ((SUCCESSFUL_DOWNLOADS++))
            continue
        fi
    fi

    # Download model
    if pull_model "$model" "$CONTAINER"; then
        # Verify download
        if verify_model "$model" "$CONTAINER"; then
            # Test model
            if test_model "$model" "$CONTAINER"; then
                ((SUCCESSFUL_DOWNLOADS++))
            else
                print_warning "Model downloaded but test failed: $model"
                ((SUCCESSFUL_DOWNLOADS++))
            fi
        else
            ((FAILED_DOWNLOADS++))
        fi
    else
        ((FAILED_DOWNLOADS++))
    fi

    echo ""
done

# Step 5: Summary
echo "=========================================================================="
echo "DOWNLOAD SUMMARY"
echo "=========================================================================="
echo ""
echo "Total Models:        ${#MODELS[@]}"
echo "Successful:          $SUCCESSFUL_DOWNLOADS"
echo "Failed:              $FAILED_DOWNLOADS"
echo ""

if [ $SUCCESSFUL_DOWNLOADS -gt 0 ]; then
    echo "Available Models:"
    docker exec "$CONTAINER" ollama list
    echo ""
fi

# Step 6: Next Steps
if [ $SUCCESSFUL_DOWNLOADS -eq ${#MODELS[@]} ]; then
    print_success "All models downloaded successfully!"
    echo ""
    echo "Next Steps:"
    echo "  1. Apply database migration:"
    echo "     npm run db:push"
    echo ""
    echo "  2. Start using Ollama AI in RTPI:"
    echo "     - Models are ready for vulnerability enrichment"
    echo "     - Access Ollama WebUI (if enabled): http://localhost:3002"
    echo "     - API endpoint: http://localhost:11434"
    echo ""
    echo "  3. Test with curl:"
    echo "     curl http://localhost:11434/api/generate -d '{\"model\": \"llama3:8b\", \"prompt\": \"Hello!\"}'"
    echo ""
elif [ $SUCCESSFUL_DOWNLOADS -gt 0 ]; then
    print_warning "Some models downloaded successfully, but others failed"
    echo ""
    echo "You can retry failed downloads by running this script again"
    echo ""
else
    print_error "All model downloads failed!"
    echo ""
    echo "Please check:"
    echo "  1. Internet connection"
    echo "  2. Docker container logs: docker logs $CONTAINER"
    echo "  3. Ollama service status: docker exec $CONTAINER ollama --version"
    echo ""
    exit 1
fi

echo "=========================================================================="
echo ""
