#!/bin/bash

# Manifest reader shared by cert_manager.sh and cloudflare_dns_manager.sh.
# Source this file, then call iterate_manifest.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/services_manifest.sh"
#   while IFS='|' read -r suffix gate upstream ws tls; do
#       # ... per row ...
#   done < <(iterate_manifest "$MANIFEST_PATH" "$ACTIVE_PROFILES")
#
# Filters:
#   - Lines starting with '#' and blank lines are skipped.
#   - Rows whose `profile_gate` is non-empty are skipped unless at least one
#     of the comma-separated gate profiles appears in <active_profiles>.
#
# Output: one pipe-delimited row per surviving manifest row (suffix, gate,
# upstream, websocket, tls_upstream).
# Pipe is intentional: tab/space IFS would collapse the empty `suffix` field
# on the bare-slug row.

_trim() { echo "$1" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g'; }

iterate_manifest() {
    local manifest=$1
    local active_profiles=${2:-}

    [ -f "$manifest" ] || { echo "manifest not found: $manifest" >&2; return 1; }

    while IFS= read -r line || [ -n "$line" ]; do
        # skip comments and blanks
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue

        local f1 f2 f3 f4 f5
        IFS='|' read -r f1 f2 f3 f4 f5 <<< "$line"
        local suffix gate upstream ws tls
        suffix=$(_trim "$f1")
        gate=$(_trim "$f2")
        upstream=$(_trim "$f3")
        ws=$(_trim "$f4")
        tls=$(_trim "$f5")

        # require at least an upstream to consider this a real row
        [ -z "$upstream" ] && continue

        if [ -n "$gate" ]; then
            local matched=false active required
            for active in $active_profiles; do
                for required in ${gate//,/ }; do
                    if [ "$active" = "$required" ]; then
                        matched=true
                        break 2
                    fi
                done
            done
            [ "$matched" = "true" ] || continue
        fi

        printf '%s|%s|%s|%s|%s\n' "$suffix" "$gate" "$upstream" "$ws" "$tls"
    done < "$manifest"
}
