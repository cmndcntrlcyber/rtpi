# rtpi-watcher — self-healing function of RTPI

`rtpi-watcher.service` is a small systemd-supervised daemon that keeps the
RTPI stack alive without operator intervention. It complements two
already-existing surfaces:

| Layer                         | When it runs       | What it does                                          |
| ----------------------------- | ------------------ | ----------------------------------------------------- |
| `scripts/pre-deployment-check.sh` | Before `docker compose up -d` | Validates env / docker config / required files. |
| `scripts/deploy-verify.sh`    | Immediately after a deploy | One-shot gate; fails the deploy if anything won't reach stable+healthy. |
| **`rtpi-watcher.service`** (this) | **Forever**, in production | Detects degraded state during normal operation and heals it before an operator notices. |

If `deploy-verify.sh` is the runway lights, `rtpi-watcher` is the air-
traffic controller after takeoff.

---

## The incident this was built around

Around 19:38 UTC on a normal Wednesday, the API process started logging this
every 5 minutes for hours:

```
[OllamaManager] Error checking inactive models: DrizzleQueryError: Failed query: …
  cause: Error: write CONNECTION_ENDED localhost:5434
    code: 'CONNECTION_ENDED', errno: 'CONNECTION_ENDED',
    address: 'localhost', port: 5434
```

Postgres was up. The API was up. But the auto-unload cron in
`server/services/ollama-manager.ts` had a stale socket cached inside
postgres-js's prepared-statement pool, and every tick wrote to the closed
socket instead of opening a new one. The user-facing symptom was zero — the
API kept serving traffic — but the cron silently stopped doing its job, and
the journal filled with noise that made the *next* real incident impossible
to spot.

That's the class of bug that warrants two layers of healing:

1. **An in-process layer** that detects the transient drop and retries on a
   fresh connection within seconds. The code never visibly fails.
2. **A process-level watchdog** that catches the cases where layer 1 isn't
   enough — for example, the API itself becoming unresponsive, the Postgres
   container exiting on OOM, or a kasm-share container falling into a
   restart loop after a config push. That's `rtpi-watcher`.

This document covers both layers.

---

## Layer 1 — the in-process repair (already applied)

Three changes in this repository fix the immediate `CONNECTION_ENDED` loop:

### 1. `server/db.ts` — disable the prepared-statement cache, bound the pool

```ts
export const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 60,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
  prepare: false,                       // <-- key change
  connection: { application_name: "rtpi-server" },
});
```

`prepare: false` disables the postgres-js prepared-statement cache. The
cache holds onto a server-side `PREPARE` keyed to a specific backend; when
that backend's socket dies, drizzle's `PostgresJsPreparedQuery.queryWithCache`
codepath still attempts to write the cached statement on the dead socket
and we get the observed error. With `prepare: false`, every query opens
fresh or reuses a healthy pool entry. The performance delta on rtpi's
traffic profile (mostly OLTP-shaped, low repeat) is negligible. `max: 10`
caps the pool so a runaway cron can't exhaust the server's
`max_connections`.

### 2. `server/services/ollama-manager.ts` — transient detection that actually fires

`isTransientDbError(err)` walks `err`, `err.cause`, `err.cause.cause`, …
and looks at both `code`, `errno`, and the message text. The previous
check only inspected the first level and missed Drizzle's wrap, which is
why the warning never fired and the operator only saw the noisy
`Error checking inactive models:` line.

### 3. `server/services/ollama-manager.ts` — single retry on a fresh connection

`checkAndUnloadInactiveModels` now wraps its body in `runOnce()` and, on
transient failure, sleeps 500 ms (long enough for postgres-js to drop the
stale socket from its pool) and retries once. Real network outages still
log; transient drops self-heal in well under a second.

Together these mean: **the operator should never see this error again,
even if Postgres flaps for a few seconds.**

---

## Layer 2 — `rtpi-watcher.service`

A bash daemon that polls three signals and restarts whatever's wrong:

### What it checks

1. **Every container in the rtpi compose project**
   (filter: `com.docker.compose.project=rtpi`). For each one:
   - `state=restarting` → restart.
   - `state=exited|dead` with non-zero exit code → restart. (Containers
     that exited cleanly — `exit 0` init containers — are left alone.)
   - `state=running` with `Health.Status=unhealthy` → restart.
   - `state=running` with `Restarting=true` → restart.
2. **Postgres** via `docker exec rtpi-postgres pg_isready -U $USER -d $DB`.
   A failure restarts the container.
3. **The API health endpoint** (`/api/v1/health` by default). A failed
   curl, or a body that reports `"status":"degraded|down|unhealthy"`, or
   `"database":false`, triggers a restart of the configured API
   container. (If the API runs on the host outside docker, leave
   `RTPI_WATCHER_API_CONTAINER` empty and add an `ExecStartPost=` to
   restart its systemd unit — see "Hybrid deploys" below.)

### Safeguards against amplification

A watchdog that restarts a real bug into a restart loop is worse than the
original bug. Three caps:

- **Per-target rate limit**: max 3 restarts of the same container inside
  a 600-second sliding window. Once that's hit, the container is
  quarantined until the window slides off (configurable —
  `RTPI_WATCHER_MAX_RESTARTS`, `RTPI_WATCHER_WINDOW`).
- **Global cooldown**: minimum 15 seconds between any two heal actions
  across all targets, so one bad tick doesn't kick off a cascade.
- **Quarantine logs to journal**: when a container hits its cap, the
  watcher emits a `[warn]` line so operators can see *why* it stopped
  healing — silence is never the answer.

### Configuration

Production overrides live in `/etc/default/rtpi-watcher`. The shipped
example at `systemd/rtpi-watcher.env.example` documents every knob.

| Variable                          | Default                              | Notes                                                    |
| --------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `RTPI_WATCHER_INTERVAL`           | `60`                                 | Poll seconds.                                            |
| `RTPI_WATCHER_API_HEALTH_URL`     | `http://localhost:3000/api/v1/health` | Empty disables API check.                                |
| `RTPI_WATCHER_API_CONTAINER`      | (unset)                              | Container to restart on API failure. Empty = no auto-restart of API. |
| `RTPI_WATCHER_API_TIMEOUT`        | `10`                                 | curl `--max-time`.                                       |
| `RTPI_WATCHER_PROJECT`            | `rtpi`                               | Docker compose project label.                            |
| `RTPI_WATCHER_IGNORE`             | (empty)                              | Comma-separated container names to skip.                 |
| `RTPI_WATCHER_MAX_RESTARTS`       | `3`                                  | Restart cap per target per window.                       |
| `RTPI_WATCHER_WINDOW`             | `600`                                | Sliding window in seconds.                               |
| `RTPI_WATCHER_COOLDOWN`           | `15`                                 | Minimum seconds between any two heal actions.            |
| `RTPI_WATCHER_PG_CONTAINER`       | `rtpi-postgres`                      | Postgres container to probe.                             |
| `RTPI_WATCHER_PG_USER`            | `rtpi`                               | Role used by `pg_isready`.                               |
| `RTPI_WATCHER_PG_DB`              | `rtpi_main`                          | DB used by `pg_isready`.                                 |
| `RTPI_WATCHER_DRY_RUN`            | `0`                                  | `1` = log healing actions but don't execute them.        |
| `RTPI_WATCHER_DEBUG`              | `0`                                  | `1` = chatty `[debug]` per tick.                         |

### Install

```bash
# 1. Stage the unit file and (optionally) the env file.
sudo install -m 0644 systemd/rtpi-watcher.service /etc/systemd/system/
sudo install -m 0644 systemd/rtpi-watcher.env.example /etc/default/rtpi-watcher
sudo $EDITOR /etc/default/rtpi-watcher    # tune to your deployment

# 2. Validate before enabling.
sudo systemd-analyze verify /etc/systemd/system/rtpi-watcher.service

# 3. First-hour dry run — log what it WOULD do but don't restart anything.
sudo sed -i 's/^RTPI_WATCHER_DRY_RUN=0/RTPI_WATCHER_DRY_RUN=1/' /etc/default/rtpi-watcher
sudo systemctl daemon-reload
sudo systemctl enable --now rtpi-watcher.service
journalctl -u rtpi-watcher.service -f
# Watch for an hour; confirm the heal actions it logs would be the right call.

# 4. Drop dry-run and go live.
sudo sed -i 's/^RTPI_WATCHER_DRY_RUN=1/RTPI_WATCHER_DRY_RUN=0/' /etc/default/rtpi-watcher
sudo systemctl restart rtpi-watcher.service
```

### Observability

Everything goes to journald. Useful queries:

```bash
# Live tail
journalctl -u rtpi-watcher.service -f

# Last hour, only heal actions and warnings
journalctl -u rtpi-watcher.service --since '1 hour ago' | grep -E '\[(warn|error)\]'

# Count restarts per container over the last 24h
journalctl -u rtpi-watcher.service --since '24 hours ago' \
  | grep -oP 'Healing: docker restart \K\S+' | sort | uniq -c | sort -rn

# Spot quarantined containers (rate-limited)
journalctl -u rtpi-watcher.service --since 'today' | grep -i Quarantining
```

A container that's restarted three times in 10 minutes and got
quarantined is a signal — investigate that container manually. The
watcher's job is to keep one-off flakes from waking you up; recurring
restarts are a real bug to fix.

### Hybrid deploys (API on the host, infra in docker)

If the API runs on the host under its own systemd unit (e.g.
`rtpi-api.service`) and only the infra (postgres, redis, ollama, etc.)
runs in docker, configure the watcher this way:

1. Leave `RTPI_WATCHER_API_CONTAINER` empty in `/etc/default/rtpi-watcher`.
2. Add an `ExecStartPost=` companion to `rtpi-watcher.service` that
   reacts to the watcher's exit, OR — simpler — add this `ExecStartPre=`
   hook inside `rtpi-watcher.service`:

   ```ini
   ExecStartPre=/bin/bash -c 'systemctl is-active --quiet rtpi-api || systemctl restart rtpi-api'
   ```

   That keeps the watcher and the API healing aligned without duplicating
   the polling logic. For a richer multi-unit setup, write a tiny
   companion script (e.g. `scripts/rtpi-watcher-api-heal.sh`) that runs
   `curl -fsS /api/v1/health || systemctl restart rtpi-api` and invoke
   it from a separate `OnCalendar=*:*/1` timer.

### Uninstall

```bash
sudo systemctl disable --now rtpi-watcher.service
sudo rm /etc/systemd/system/rtpi-watcher.service
sudo rm /etc/default/rtpi-watcher
sudo systemctl daemon-reload
```

---

## Mental model

The two layers serve different goals:

- **Layer 1 (in-process retry)** keeps user-facing requests succeeding.
  It's micro-scale: hundreds of milliseconds, no operator visibility,
  recovers before anyone notices.
- **Layer 2 (rtpi-watcher)** keeps the *stack* alive across process and
  container boundaries. It's macro-scale: tens of seconds, journal
  visibility, recovers things that an in-process retry can't reach.

When you add a new long-running async job in the backend (a cron, a
queue worker, a periodic sync), follow the same template the Ollama auto-
unload now uses:

```ts
import { isTransientDbError } from "./services/ollama-manager";

async function myTickWithRetry(): Promise<void> {
  try { await doWork(); }
  catch (e) {
    if (isTransientDbError(e)) {
      await new Promise((r) => setTimeout(r, 500));
      try { await doWork(); }
      catch (e2) {
        if (isTransientDbError(e2)) {
          console.warn("[my-cron] transient DB drop; next tick will recover");
          return;
        }
        throw e2;
      }
      return;
    }
    throw e;
  }
}
```

That keeps Layer 1 cheap and consistent. The watcher remains in place to
catch whatever Layer 1 can't.
