#!/usr/bin/env bash
# RTPI VPN Manager — healthcheck
#
# Healthy iff:
#   1. The entrypoint daemon (PID 1 under tini) is alive, AND
#   2. /dev/net/tun is present (proves NET_ADMIN + tun device wiring), AND
#   3. Every openvpn pidfile in /var/run/vpn corresponds to a live process
#      (a stale pidfile means a tunnel died unexpectedly), AND
#   4. Every wireguard active-marker has a matching `ip link` entry.

set -euo pipefail

RUN_DIR=/var/run/vpn

# (1) tini/entrypoint must be PID 1
if ! kill -0 1 2>/dev/null; then
    echo "pid 1 missing" >&2
    exit 1
fi

# (2) tun device must be wired through from the host
if [[ ! -c /dev/net/tun ]]; then
    echo "/dev/net/tun missing" >&2
    exit 1
fi

# (3) openvpn pidfiles must point at live processes
if compgen -G "$RUN_DIR/openvpn-*.pid" >/dev/null; then
    for pidfile in "$RUN_DIR"/openvpn-*.pid; do
        pid=$(cat "$pidfile" 2>/dev/null || true)
        if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
            echo "stale openvpn pidfile: $pidfile" >&2
            exit 1
        fi
    done
fi

# (4) wireguard markers must correspond to live interfaces
if compgen -G "$RUN_DIR/wireguard-*.active" >/dev/null; then
    for marker in "$RUN_DIR"/wireguard-*.active; do
        name=$(basename "$marker" .active)
        name="${name#wireguard-}"
        if ! ip link show "$name" >/dev/null 2>&1; then
            echo "wireguard interface missing: $name" >&2
            exit 1
        fi
    done
fi

exit 0
