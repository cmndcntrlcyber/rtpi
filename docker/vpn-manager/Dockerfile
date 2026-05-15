# RTPI VPN Manager — v2.9.2 Phase 1
#
# Long-running container that owns the host's VPN tunnel interfaces (tun0/wg*)
# on behalf of RTPI. Operator uploads .ovpn / .conf files via the backend
# (Phase 2+); the backend writes them into the mounted config volumes and
# triggers connect/disconnect via `docker exec` against this container.
#
# Requires NET_ADMIN cap, /dev/net/tun, and net.ipv4.ip_forward=1 — all set
# in the docker-compose service definition under --profile vpn.

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Single apt layer: openvpn + wireguard userspace + routing + diag utilities.
# wireguard kernel module must be present on the host; this package only
# installs the wg / wg-quick userspace binaries.
RUN apt-get update && apt-get install -y --no-install-recommends \
        openvpn \
        wireguard-tools \
        iptables \
        iproute2 \
        resolvconf \
        ca-certificates \
        curl \
        netcat-openbsd \
        iputils-ping \
        traceroute \
        dnsutils \
        inotify-tools \
        procps \
        jq \
        tini \
    && rm -rf /var/lib/apt/lists/*

# Config volumes are mounted in from compose; pre-create directories so the
# entrypoint never has to mkdir on a read-only path.
RUN mkdir -p /etc/openvpn/configs \
             /etc/wireguard/configs \
             /var/log/vpn \
             /var/run/vpn

COPY vpn-entrypoint.sh /usr/local/bin/vpn-entrypoint.sh
COPY vpn-health-check.sh /usr/local/bin/vpn-health-check.sh
RUN chmod +x /usr/local/bin/vpn-entrypoint.sh /usr/local/bin/vpn-health-check.sh

WORKDIR /var/log/vpn

# tini reaps zombies left behind by short-lived openvpn / wg-quick invocations
# while keeping signal handling clean for `docker stop`.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/vpn-entrypoint.sh"]
CMD ["daemon"]
