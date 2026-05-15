#!/usr/bin/env bash
# RTPI Automated Storage Cleanup — backwards-compat shim.
#
# As of the 2026-05 consolidation, all cleanup logic lives in
# scripts/cleanup-storage.sh, which supports an --auto mode that matches the
# old non-interactive + log-to-file behavior of this script. Any existing
# cron entry pointing at this filename keeps working without changes.
#
# To migrate: replace cron / systemd-timer references with
#     scripts/cleanup-storage.sh --auto
# and delete this shim. Until then, this file forwards through.

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
exec "${SCRIPT_DIR}/cleanup-storage.sh" --auto "$@"
