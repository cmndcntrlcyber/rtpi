#!/bin/bash
# RTPI OffSec Agent Build Automation Script
# Interactive build assistant for OffSec agent containers
# Version: 1.0.0
# Date: 2026-02-27

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Build tracking
START_TIME=$(date +%s)
AGENTS_BUILT=0
AGENTS_FAILED=0

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

print_progress() {
    echo -e "${BLUE}▶${NC} $1"
}

# Banner
clear
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        RTPI OffSec Agent Build Automation                     ║
║        Version 1.0.0                                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Pre-flight checks
print_header "Pre-Flight Checks"

# Check Docker
if ! docker ps &> /dev/null && ! sudo docker ps &> /dev/null; then
    print_fail "Docker is not running or not accessible"
    echo ""
    print_info "Start Docker: sudo systemctl start docker"
    print_info "Add to docker group: sudo usermod -aG docker \$USER"
    exit 1
fi
print_success "Docker is accessible"

# Check disk space
DOCKER_ROOT=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $4}' || echo "/var/lib/docker")
AVAILABLE_GB=$(df -BG "$DOCKER_ROOT" 2>/dev/null | tail -1 | awk '{print $4}' | sed 's/G//' || echo "0")

if [ "$AVAILABLE_GB" -lt 50 ]; then
    print_warning "Disk space: ${AVAILABLE_GB}GB (50GB+ recommended for all agents)"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Aborted. Free up disk space and try again."
        exit 0
    fi
else
    print_success "Disk space: ${AVAILABLE_GB}GB available"
fi

# Check if base image exists
BASE_EXISTS=false
if docker images | grep -q "rtpi/offsec-base"; then
    BASE_SIZE=$(docker images rtpi/offsec-base:latest --format "{{.Size}}" 2>/dev/null || echo "unknown")
    print_success "Base image exists ($BASE_SIZE)"
    BASE_EXISTS=true
else
    print_warning "Base image not found (will be built)"
fi

echo ""
print_header "Deployment Options"
echo ""
echo "  1) Build base image only (30-45 min)"
echo "  2) Build base + Priority agents (framework, research, fuzzing) [~2 hours]"
echo "  3) Build base + All agents (framework, research, fuzzing, maldev, azure-ad, burp, empire) [~4 hours]"
echo "  4) Build specific agents (custom selection)"
echo "  5) Exit"
echo ""
read -p "Select option [1-5]: " OPTION

case $OPTION in
    1)
        BUILD_BASE=true
        BUILD_AGENTS=()
        ;;
    2)
        BUILD_BASE=true
        BUILD_AGENTS=("offsec-framework" "offsec-research" "offsec-fuzzing")
        ;;
    3)
        BUILD_BASE=true
        BUILD_AGENTS=("offsec-framework" "offsec-research" "offsec-fuzzing" "offsec-maldev" "offsec-azure-ad" "offsec-burp" "offsec-empire")
        ;;
    4)
        BUILD_BASE=true
        BUILD_AGENTS=()
        echo ""
        print_info "Select agents to build (space-separated numbers):"
        echo "  1) offsec-framework (Tech detection)"
        echo "  2) offsec-research (General R&D, JupyterLab)"
        echo "  3) offsec-fuzzing (Web fuzzing)"
        echo "  4) offsec-maldev (Binary analysis)"
        echo "  5) offsec-azure-ad (Azure/AD testing)"
        echo "  6) offsec-burp (Web app security)"
        echo "  7) offsec-empire (C2 research)"
        echo ""
        read -p "Enter selections (e.g., 1 2 3): " -a SELECTIONS
        
        for sel in "${SELECTIONS[@]}"; do
            case $sel in
                1) BUILD_AGENTS+=("offsec-framework") ;;
                2) BUILD_AGENTS+=("offsec-research") ;;
                3) BUILD_AGENTS+=("offsec-fuzzing") ;;
                4) BUILD_AGENTS+=("offsec-maldev") ;;
                5) BUILD_AGENTS+=("offsec-azure-ad") ;;
                6) BUILD_AGENTS+=("offsec-burp") ;;
                7) BUILD_AGENTS+=("offsec-empire") ;;
                *) print_warning "Invalid selection: $sel" ;;
            esac
        done
        ;;
    5)
        print_info "Exiting..."
        exit 0
        ;;
    *)
        print_fail "Invalid option"
        exit 1
        ;;
esac

# Confirm build plan
echo ""
print_header "Build Plan"
if [ "$BUILD_BASE" = true ] && [ "$BASE_EXISTS" = false ]; then
    echo "  • Base image (rtpi/offsec-base:latest) - ~30-45 minutes"
elif [ "$BUILD_BASE" = true ] && [ "$BASE_EXISTS" = true ]; then
    print_info "Base image already exists (skipping)"
    BUILD_BASE=false
fi

if [ ${#BUILD_AGENTS[@]} -gt 0 ]; then
    for agent in "${BUILD_AGENTS[@]}"; do
        echo "  • $agent - ~20-60 minutes"
    done
fi

ESTIMATED_MIN=$((30 + ${#BUILD_AGENTS[@]} * 20))
ESTIMATED_MAX=$((45 + ${#BUILD_AGENTS[@]} * 60))

echo ""
print_info "Estimated time: $ESTIMATED_MIN-$ESTIMATED_MAX minutes"
echo ""
read -p "Proceed with build? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Build cancelled"
    exit 0
fi

# Build base image
if [ "$BUILD_BASE" = true ]; then
    echo ""
    print_header "Building Base Image"
    print_progress "Building rtpi/offsec-base:latest (this will take 30-45 minutes)..."
    echo ""
    
    BUILD_START=$(date +%s)
    
    if sudo docker compose --profile build-only build offsec-base; then
        BUILD_END=$(date +%s)
        BUILD_TIME=$((BUILD_END - BUILD_START))
        BUILD_MIN=$((BUILD_TIME / 60))
        
        IMAGE_SIZE=$(docker images rtpi/offsec-base:latest --format "{{.Size}}")
        print_success "Base image built in ${BUILD_MIN} minutes ($IMAGE_SIZE)"
        echo ""
    else
        print_fail "Base image build failed"
        print_info "Check logs above for errors"
        exit 1
    fi
fi

# Build agent containers
if [ ${#BUILD_AGENTS[@]} -gt 0 ]; then
    echo ""
    print_header "Building Agent Containers"
    echo ""
    
    for agent in "${BUILD_AGENTS[@]}"; do
        AGENT_NAME=$(echo $agent | sed 's/offsec-//')
        print_progress "Building $agent..."
        
        BUILD_START=$(date +%s)
        
        if sudo docker compose build "$agent" 2>&1 | tee "/tmp/build-$agent.log"; then
            BUILD_END=$(date +%s)
            BUILD_TIME=$((BUILD_END - BUILD_START))
            BUILD_MIN=$((BUILD_TIME / 60))
            
            IMAGE_TAG="rtpi/${AGENT_NAME}-tools:latest"
            IMAGE_SIZE=$(docker images "$IMAGE_TAG" --format "{{.Size}}" 2>/dev/null || echo "unknown")
            
            print_success "$agent built in ${BUILD_MIN} minutes ($IMAGE_SIZE)"
            ((AGENTS_BUILT++))
        else
            print_fail "$agent build failed"
            print_info "Logs saved to /tmp/build-$agent.log"
            ((AGENTS_FAILED++))
        fi
        echo ""
    done
fi

# Build summary
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
TOTAL_MIN=$((TOTAL_TIME / 60))

echo ""
print_header "Build Summary"
echo ""
echo -e "  Total time:      ${CYAN}${TOTAL_MIN} minutes${NC}"
echo -e "  Agents built:    ${GREEN}${AGENTS_BUILT}${NC}"
echo -e "  Agents failed:   ${RED}${AGENTS_FAILED}${NC}"

# Show disk usage
USED_GB=$(docker system df 2>/dev/null | grep Images | awk '{print $3}' || echo "unknown")
echo -e "  Disk usage:      ${YELLOW}${USED_GB}${NC}"
echo ""

# Next steps
if [ $AGENTS_BUILT -gt 0 ]; then
    print_header "Next Steps"
    echo ""
    print_info "Start the built agents:"
    echo ""
    
    if [ ${#BUILD_AGENTS[@]} -eq 7 ]; then
        echo -e "  ${BLUE}sudo docker compose --profile offsec-agents up -d${NC}"
    else
        echo -e "  ${BLUE}sudo docker compose up -d${NC}"
        for agent in "${BUILD_AGENTS[@]}"; do
            echo -e "    $agent \\"
        done | sed '$ s/ \\$//'
    fi
    
    echo ""
    print_info "Verify agents are running:"
    echo -e "  ${BLUE}sudo docker compose ps | grep offsec${NC}"
    echo ""
    print_info "Check agent logs:"
    echo -e "  ${BLUE}sudo docker logs rtpi-<agent-name>${NC}"
    echo ""
fi

if [ $AGENTS_FAILED -gt 0 ]; then
    print_warning "Some builds failed - review logs in /tmp/build-*.log"
fi

print_success "Build process complete!"
echo ""
