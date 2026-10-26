#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# RTPI-Nexus Build — IP Detection Library
# ═══════════════════════════════════════════════════════════════════════════════
#
# Shared library for automatic LAN IP detection. Sourced by build phases,
# tunnel_config_manager.sh, configure-ufw.sh, and any script that needs
# the host's primary network address.
#
# Functions:
#   detect_primary_ip   — returns the host's primary LAN IPv4 address
#   detect_subnet       — derives the /24 CIDR from a given IP
#   validate_ip         — checks if a string is a valid, non-reserved IPv4
#   print_ip_report     — logs detected IP, interface, subnet, and gateway
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib-detect-ip.sh"
#   ip=$(detect_primary_ip) || { echo "detection failed"; exit 1; }

[ -n "${_LIB_DETECT_IP_LOADED:-}" ] && return 0
_LIB_DETECT_IP_LOADED=1

# ── validate_ip ──────────────────────────────────────────────────────────────
# Returns 0 if the argument is a valid, routable IPv4 address.
# Rejects loopback (127.x), link-local (169.254.x), and multicast (224-239.x).
validate_ip() {
  local ip="${1:-}"

  if ! [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    return 1
  fi

  local IFS='.'
  read -ra octets <<< "$ip"
  for octet in "${octets[@]}"; do
    if (( octet > 255 )); then
      return 1
    fi
  done

  case "${octets[0]}" in
    127)         return 1 ;;  # loopback
    169)         [[ "${octets[1]}" == "254" ]] && return 1 ;;  # link-local
    22[4-9]|23*) return 1 ;;  # multicast / reserved
    0)           return 1 ;;  # invalid
  esac

  return 0
}

# ── detect_primary_ip ────────────────────────────────────────────────────────
# Three-method cascade to find the host's primary LAN IP:
#   1. Default route interface → its IPv4 address
#   2. Global-scope IPs, filtering virtual/tunnel interfaces
#   3. hostname -I fallback
detect_primary_ip() {
  local ip=""

  # Method 1: IP on the default route's interface (most reliable)
  ip=$(ip -4 route show default 2>/dev/null \
      | grep -oP 'dev \K\S+' | head -1 \
      | xargs -I{} ip -4 addr show dev {} 2>/dev/null \
      | grep -oP 'inet \K[0-9.]+' | head -1) || true

  if [ -n "$ip" ] && validate_ip "$ip"; then
    echo "$ip"
    return 0
  fi

  # Method 2: first global-scope IP, excluding virtual interfaces
  ip=$(ip -4 addr show scope global 2>/dev/null \
      | grep -v 'docker\|br-\|veth\|virbr\|tun\|wg\|tailscale' \
      | grep -oP 'inet \K[0-9.]+' | head -1) || true

  if [ -n "$ip" ] && validate_ip "$ip"; then
    echo "$ip"
    return 0
  fi

  # Method 3: hostname -I fallback
  ip=$(hostname -I 2>/dev/null | awk '{print $1}') || true

  if [ -n "$ip" ] && validate_ip "$ip"; then
    echo "$ip"
    return 0
  fi

  return 1
}

# ── detect_subnet ────────────────────────────────────────────────────────────
# Derives the /24 CIDR from an IP address.
# Usage: detect_subnet "192.168.8.248"  →  "192.168.8.0/24"
detect_subnet() {
  local ip="${1:-}"
  if ! validate_ip "$ip"; then
    return 1
  fi
  echo "${ip%.*}.0/24"
}

# ── print_ip_report ──────────────────────────────────────────────────────────
# Logs detected network information for build audit trails.
# Uses lib.sh logging functions if available, falls back to echo.
print_ip_report() {
  local ip="${1:-}"
  local subnet iface gateway

  subnet=$(detect_subnet "$ip" 2>/dev/null) || subnet="unknown"
  iface=$(ip -4 route show default 2>/dev/null | grep -oP 'dev \K\S+' | head -1) || iface="unknown"
  gateway=$(ip -4 route show default 2>/dev/null | grep -oP 'via \K[0-9.]+' | head -1) || gateway="unknown"

  if type -t debug &>/dev/null; then
    debug "Detected IP: ${ip}" "network"
    debug "Interface:   ${iface}" "network"
    debug "Subnet:      ${subnet}" "network"
    debug "Gateway:     ${gateway}" "network"
  else
    echo "[detect-ip] IP=${ip} iface=${iface} subnet=${subnet} gw=${gateway}"
  fi
}
