#!/bin/bash
###############################################################################
# Docker Registry Image Staging
#
# Tags and pushes locally-built images to the local Docker registry so Kasm
# workspace agents and other nodes can pull them.
#
# Usage:
#   ./server/scripts/infra/stage-images.sh              # Stage default images
#   ./server/scripts/infra/stage-images.sh --all         # Stage all known images
#   ./server/scripts/infra/stage-images.sh --image NAME  # Stage a specific image
#   ./server/scripts/infra/stage-images.sh --list        # Show registry catalog
#   ./server/scripts/infra/stage-images.sh --prune       # Garbage-collect blobs
###############################################################################

set -euo pipefail

REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

step()  { echo -e "${CYAN}[$(date -u +%H:%M:%S)] → $1${NC}"; }
ok()    { echo -e "${GREEN}[$(date -u +%H:%M:%S)] ✓ $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date -u +%H:%M:%S)] ! $1${NC}"; }
fail()  { echo -e "${RED}[$(date -u +%H:%M:%S)] ✗ $1${NC}"; }

DEFAULT_IMAGES=(
  "nexus-offense:latest"
  "rtpi:latest"
  "cmndcntrl/nexus-console-kasm:latest"
)

STAGE_ALL=false
SINGLE_IMAGE=""
LIST_ONLY=false
PRUNE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)      STAGE_ALL=true; shift ;;
    --image)    SINGLE_IMAGE="$2"; shift 2 ;;
    --list)     LIST_ONLY=true; shift ;;
    --prune)    PRUNE=true; shift ;;
    --registry) REGISTRY="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--all] [--image NAME] [--list] [--prune] [--registry URL]"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

ensure_insecure_registry() {
  local daemon_json="/etc/docker/daemon.json"
  if grep -q '"insecure-registries"' "$daemon_json" 2>/dev/null && \
     grep -q "${REGISTRY}" "$daemon_json" 2>/dev/null; then
    return 0
  fi
  step "Configuring Docker daemon for insecure registry ${REGISTRY}..."
  local tmp; tmp=$(mktemp)
  if [ -f "$daemon_json" ]; then
    python3 -I -c "
import json, sys
with open('$daemon_json') as f: cfg = json.load(f)
regs = set(cfg.get('insecure-registries', []))
regs.add('${REGISTRY}')
cfg['insecure-registries'] = sorted(regs)
json.dump(cfg, sys.stdout, indent=4)
" > "$tmp"
  else
    echo '{"insecure-registries":["'"${REGISTRY}"'"]}' \
      | python3 -I -c "import json,sys; json.dump(json.load(sys.stdin),sys.stdout,indent=4)" > "$tmp"
  fi
  sudo cp "$tmp" "$daemon_json"
  rm -f "$tmp"
  step "Restarting Docker daemon..."
  sudo systemctl restart docker
  sleep 3
  ok "Docker daemon restarted with insecure-registries"
}

ensure_registry() {
  ensure_insecure_registry
  if curl -sf "http://${REGISTRY}/v2/" >/dev/null 2>&1; then
    return 0
  fi
  step "Starting registry container..."
  if [ -f "${PROJECT_ROOT}/${COMPOSE_FILE}" ]; then
    docker compose -f "${PROJECT_ROOT}/${COMPOSE_FILE}" --profile registry up -d registry 2>/dev/null
  else
    docker run -d --name rtpi-registry -p 127.0.0.1:5000:5000 \
      -v registry-data:/var/lib/registry \
      -e REGISTRY_STORAGE_DELETE_ENABLED=true \
      --restart unless-stopped registry:2.8 2>/dev/null || true
  fi
  local attempts=0
  while ! curl -sf "http://${REGISTRY}/v2/" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 15 ]; then
      fail "Registry at ${REGISTRY} not reachable after 15 attempts"
      exit 1
    fi
    sleep 2
  done
  ok "Registry running at ${REGISTRY}"
}

stage_image() {
  local image="$1"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    warn "Image ${image} not found locally — skipping"
    return 0
  fi
  local base_name="${image##*/}"
  local registry_tag="${REGISTRY}/${base_name}"
  step "Staging ${image} → ${registry_tag}"
  docker tag "$image" "$registry_tag"
  if docker push "$registry_tag" 2>&1; then
    ok "Pushed ${registry_tag}"
  else
    fail "Failed to push ${registry_tag}"
    if ! grep -q 'insecure-registries' /etc/docker/daemon.json 2>/dev/null; then
      warn "Hint: add \"insecure-registries\": [\"${REGISTRY}\"] to /etc/docker/daemon.json and restart Docker"
    fi
    return 1
  fi
}

show_catalog() {
  step "Registry catalog (${REGISTRY}):"
  local catalog
  catalog=$(curl -sf "http://${REGISTRY}/v2/_catalog" 2>/dev/null)
  if [ -z "$catalog" ]; then
    warn "Could not reach registry at ${REGISTRY}"
    return 1
  fi
  local repos
  repos=$(echo "$catalog" | python3 -I -c "import json,sys; [print(r) for r in json.load(sys.stdin).get('repositories',[])]" 2>/dev/null)
  if [ -z "$repos" ]; then
    echo "  (empty)"
    return 0
  fi
  while IFS= read -r repo; do
    local tags
    tags=$(curl -sf "http://${REGISTRY}/v2/${repo}/tags/list" 2>/dev/null \
      | python3 -I -c "import json,sys; print(','.join(json.load(sys.stdin).get('tags',[])))" 2>/dev/null)
    echo "  ${repo}:${tags}"
  done <<< "$repos"
}

run_gc() {
  step "Running registry garbage collection..."
  if docker exec rtpi-registry /bin/registry garbage-collect /etc/docker/registry/config.yml 2>&1; then
    ok "Garbage collection complete"
  else
    fail "Garbage collection failed"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

if $LIST_ONLY; then
  ensure_registry
  show_catalog
  exit 0
fi

if $PRUNE; then
  run_gc
  exit 0
fi

ensure_registry

STAGED=0
FAILED=0

if [ -n "$SINGLE_IMAGE" ]; then
  stage_image "$SINGLE_IMAGE" && STAGED=$((STAGED + 1)) || FAILED=$((FAILED + 1))
else
  for image in "${DEFAULT_IMAGES[@]}"; do
    stage_image "$image" && STAGED=$((STAGED + 1)) || FAILED=$((FAILED + 1))
  done
  if $STAGE_ALL; then
    while IFS= read -r image; do
      [ -z "$image" ] && continue
      stage_image "$image" && STAGED=$((STAGED + 1)) || FAILED=$((FAILED + 1))
    done < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^rtpi/kasm-.*:optimized$')
  fi
fi

echo ""
show_catalog
echo ""
if [ "$FAILED" -gt 0 ]; then
  warn "Staged ${STAGED} images, ${FAILED} failed"
  exit 1
else
  ok "Staged ${STAGED} images to ${REGISTRY}"
fi
