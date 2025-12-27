#!/bin/bash

###############################################################################
# Kasm Workspace Optimized Image Builder
#
# Builds optimized Docker images for Kasm workspaces and compares sizes
# with the original images.
#
# Usage:
#   ./scripts/build-optimized-images.sh [options]
#
# Options:
#   --all              Build all workspace types
#   --type <type>      Build specific workspace type (kali, vscode, firefox)
#   --push             Push images to registry after building
#   --registry <url>   Registry URL (default: localhost:5000)
#   --analyze          Run size analysis after build
#   --no-cache         Build without cache
###############################################################################

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker/kasm-workspaces"
REGISTRY="${REGISTRY:-localhost:5000}"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Workspace types and their base images
declare -A WORKSPACE_TYPES=(
    ["kali"]="kasmweb/kali-rolling-desktop:1.17.0"
    ["vscode"]="kasmweb/vscode:1.17.0"
    ["firefox"]="kasmweb/firefox:1.17.0"
)

# Default options
BUILD_ALL=false
WORKSPACE_TYPE=""
PUSH_IMAGES=false
ANALYZE=false
NO_CACHE=""

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker ps &> /dev/null; then
        log_error "Docker daemon is not running or permission denied"
        exit 1
    fi
}

get_image_size() {
    local image=$1
    docker images --format "{{.Size}}" "$image" 2>/dev/null || echo "N/A"
}

get_image_size_bytes() {
    local image=$1
    docker inspect "$image" --format='{{.Size}}' 2>/dev/null || echo "0"
}

calculate_reduction() {
    local original_bytes=$1
    local optimized_bytes=$2

    if [ "$original_bytes" -eq 0 ]; then
        echo "N/A"
        return
    fi

    local reduction=$(( original_bytes - optimized_bytes ))
    local percentage=$(( (reduction * 100) / original_bytes ))

    echo "$percentage%"
}

###############################################################################
# Build Functions
###############################################################################

build_image() {
    local type=$1
    local base_image=${WORKSPACE_TYPES[$type]}
    local dockerfile="$DOCKER_DIR/Dockerfile.${type}-optimized"
    local optimized_tag="rtpi/kasm-${type}:optimized"

    log_info "Building optimized $type workspace..."

    if [ ! -f "$dockerfile" ]; then
        log_error "Dockerfile not found: $dockerfile"
        return 1
    fi

    # Pull base image first
    log_info "Pulling base image: $base_image"
    docker pull "$base_image" || {
        log_warning "Failed to pull base image, using cached version"
    }

    # Build optimized image
    log_info "Building: $optimized_tag"
    docker build \
        $NO_CACHE \
        --build-arg BUILD_DATE="$BUILD_DATE" \
        --build-arg VCS_REF="$VCS_REF" \
        -f "$dockerfile" \
        -t "$optimized_tag" \
        "$DOCKER_DIR" || {
        log_error "Failed to build $type workspace"
        return 1
    }

    log_success "Built: $optimized_tag"

    # Get sizes
    local base_size_bytes=$(get_image_size_bytes "$base_image")
    local opt_size_bytes=$(get_image_size_bytes "$optimized_tag")
    local base_size=$(get_image_size "$base_image")
    local opt_size=$(get_image_size "$optimized_tag")
    local reduction=$(calculate_reduction "$base_size_bytes" "$opt_size_bytes")

    log_info "Size comparison:"
    echo "  Original: $base_size"
    echo "  Optimized: $opt_size"
    echo "  Reduction: $reduction"

    # Tag for registry if pushing
    if [ "$PUSH_IMAGES" = true ]; then
        local registry_tag="$REGISTRY/kasm-${type}:optimized"
        docker tag "$optimized_tag" "$registry_tag"
        log_info "Tagged for registry: $registry_tag"
    fi
}

push_image() {
    local type=$1
    local registry_tag="$REGISTRY/kasm-${type}:optimized"

    log_info "Pushing $type workspace to registry..."

    docker push "$registry_tag" || {
        log_error "Failed to push $registry_tag"
        return 1
    }

    log_success "Pushed: $registry_tag"
}

analyze_images() {
    log_info "Analyzing all workspace images..."

    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║         Kasm Workspace Image Size Analysis                   ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    printf "%-15s %-15s %-15s %-15s\n" "Type" "Original" "Optimized" "Reduction"
    echo "───────────────────────────────────────────────────────────────"

    local total_original=0
    local total_optimized=0

    for type in "${!WORKSPACE_TYPES[@]}"; do
        local base_image=${WORKSPACE_TYPES[$type]}
        local optimized_tag="rtpi/kasm-${type}:optimized"

        # Check if optimized image exists
        if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "$optimized_tag"; then
            continue
        fi

        local base_size_bytes=$(get_image_size_bytes "$base_image")
        local opt_size_bytes=$(get_image_size_bytes "$optimized_tag")
        local base_size=$(get_image_size "$base_image")
        local opt_size=$(get_image_size "$optimized_tag")
        local reduction=$(calculate_reduction "$base_size_bytes" "$opt_size_bytes")

        printf "%-15s %-15s %-15s %-15s\n" "$type" "$base_size" "$opt_size" "$reduction"

        total_original=$((total_original + base_size_bytes))
        total_optimized=$((total_optimized + opt_size_bytes))
    done

    echo "───────────────────────────────────────────────────────────────"

    local total_reduction=$(calculate_reduction "$total_original" "$total_optimized")
    log_success "Total size reduction: $total_reduction"
    echo ""
}

###############################################################################
# Main Script
###############################################################################

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            BUILD_ALL=true
            shift
            ;;
        --type)
            WORKSPACE_TYPE="$2"
            shift 2
            ;;
        --push)
            PUSH_IMAGES=true
            shift
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --analyze)
            ANALYZE=true
            shift
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --help)
            grep "^#" "$0" | grep -v "#!/bin/bash" | sed 's/^# //'
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate environment
check_docker

log_info "Kasm Workspace Optimized Image Builder"
log_info "Build Date: $BUILD_DATE"
log_info "VCS Ref: $VCS_REF"
echo ""

# Build images
if [ "$BUILD_ALL" = true ]; then
    for type in "${!WORKSPACE_TYPES[@]}"; do
        build_image "$type" || log_warning "Failed to build $type, continuing..."

        if [ "$PUSH_IMAGES" = true ]; then
            push_image "$type" || log_warning "Failed to push $type, continuing..."
        fi
    done
elif [ -n "$WORKSPACE_TYPE" ]; then
    if [ -z "${WORKSPACE_TYPES[$WORKSPACE_TYPE]}" ]; then
        log_error "Unknown workspace type: $WORKSPACE_TYPE"
        log_info "Available types: ${!WORKSPACE_TYPES[*]}"
        exit 1
    fi

    build_image "$WORKSPACE_TYPE" || exit 1

    if [ "$PUSH_IMAGES" = true ]; then
        push_image "$WORKSPACE_TYPE" || exit 1
    fi
else
    log_error "Must specify --all or --type <type>"
    echo "Use --help for usage information"
    exit 1
fi

# Analyze if requested
if [ "$ANALYZE" = true ]; then
    analyze_images
fi

log_success "Build process completed!"
