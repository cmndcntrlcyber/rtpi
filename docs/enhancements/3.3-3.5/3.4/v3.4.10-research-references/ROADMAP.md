# v3.4.10 — Research References & Fuzzing Runner

**Priority:** P3
**Status:** Planning
**Skill Category:** `skills/offense/exploit-dev/` (expand existing)
**Tools:** 3
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Expand the nexus-harness `exploit-dev/` skill category with exploit research databases, payload reference libraries, and a coverage-guided fuzzing runner. This enhancement adds three new skills:

- **searchsploit-lookup** — search and retrieve exploits from the Exploit-DB offline mirror, enabling fast CVE and software-based exploit research without leaving the CLI.
- **payload-reference** — query the PayloadsAllTheThings repository for technique-specific payloads, bypasses, and cheat sheets across web, network, and privilege escalation contexts.
- **aflplusplus-fuzz** — run coverage-guided fuzzing campaigns with AFL++, upgrading the existing `fuzzing-guide` skill from a conceptual guide to an actual instrumentation-and-execution runner.

All skills operate standalone inside nexus-kali — independent of RTPI.

---

## Tool Inventory

| # | Tool | Purpose | Install Method | Skill Name |
|---|------|---------|----------------|------------|
| 1 | ExploitDB / searchsploit | Offline exploit database search and reference | `git clone https://gitlab.com/exploit-database/exploitdb.git` | `exploit-dev/searchsploit-lookup` |
| 2 | PayloadsAllTheThings | Payload reference library covering web, network, and privesc techniques | `git clone https://github.com/swisskyrepo/PayloadsAllTheThings.git` | `exploit-dev/payload-reference` |
| 3 | AFL++ | Coverage-guided fuzzing suite for binary targets | `apt install aflplusplus` or binary download from `aflplusplus/AFLplusplus` | `exploit-dev/aflplusplus-fuzz` |

---

## Skill Structure

Each skill follows the nexus-harness offense skill pattern:

```
skills/offense/exploit-dev/<skill-name>/
  SKILL.md          # YAML frontmatter + workflow sections
```

Standard sections per SKILL.md:
1. Scope Check (`$TARGET` must be in scope)
2. Quick Workflow (common one-liner usage)
3. Technique Sections (detailed usage patterns)
4. Output Handling (results -> `/results/$ENGAGEMENT/exploit-dev/`)
5. Pitfalls (common mistakes, stale databases, resource limits)
6. Verification (confirm tool ran, output is valid)

### Skill-Specific Notes

- **searchsploit-lookup**: Outputs exploit metadata (EDB-ID, title, path, platform) and can copy exploit source to the engagement results directory. Cross-references with CVE identifiers.
- **payload-reference**: Read-only reference skill. Outputs relevant payload snippets, technique descriptions, and file paths within the PayloadsAllTheThings tree. Does not execute payloads directly — feeds into `payload-delivery`, `custom-exploit`, or `msfvenom-payloads`.
- **aflplusplus-fuzz**: Runner skill with campaign lifecycle management. Handles target instrumentation (`afl-cc`/`afl-c++`), corpus preparation, fuzzing execution (`afl-fuzz`), and crash triage (`afl-tmin`, `afl-cmin`). Outputs crash cases and coverage statistics to results directory.

---

## Acceptance Criteria

- [ ] `searchsploit-lookup` skill can search by CVE, software name, platform, and keyword; returns structured results.
- [ ] `searchsploit-lookup` can copy exploit source files to `/results/$ENGAGEMENT/exploit-dev/exploits/`.
- [ ] `payload-reference` skill can query PayloadsAllTheThings by technique category (e.g., SQLi, XXE, SSRF, privesc) and return relevant payloads.
- [ ] `payload-reference` output integrates cleanly with `payload-delivery` and `custom-exploit` skill inputs.
- [ ] `aflplusplus-fuzz` skill can instrument a C/C++ target binary with AFL++ compilers.
- [ ] `aflplusplus-fuzz` skill can launch, monitor, and stop a fuzzing campaign.
- [ ] `aflplusplus-fuzz` skill triages crashes and reports unique findings to `/results/$ENGAGEMENT/exploit-dev/fuzzing/`.
- [ ] `aflplusplus-fuzz` supersedes `fuzzing-guide` for hands-on fuzzing (guide remains as conceptual reference).
- [ ] All three skills pass scope check before execution.
- [ ] All three skills produce valid, structured output in their results directories.
- [ ] ExploitDB database can be updated via `searchsploit -u` within the skill.
- [ ] PayloadsAllTheThings repository can be updated via `git pull` within the skill.

---

## Nexus-Kali Image Requirements

| Tool | Size Impact | Image Layer Notes |
|------|-------------|-------------------|
| ExploitDB (searchsploit) | ~700 MB | Large git clone. The repository includes exploit source files, papers, and shellcodes. Clone to `/opt/exploitdb/` and symlink `searchsploit` to `/usr/local/bin/`. Consider shallow clone (`--depth 1`) for initial build with full clone available on demand. |
| PayloadsAllTheThings | ~150 MB | Reference repository. Clone to `/opt/PayloadsAllTheThings/`. Shallow clone acceptable since history is not needed. |
| AFL++ | ~50 MB | Install via `apt install aflplusplus` (includes `afl-fuzz`, `afl-cc`, `afl-c++`, `afl-tmin`, `afl-cmin`, `afl-showmap`). Alternatively, build from source for latest features. Requires `build-essential`, `llvm`, `clang` as build dependencies (likely already present in nexus-kali). |

**Total additional image size:** ~900 MB (dominated by ExploitDB clone)

---

## Dependencies

### Internal Skill Dependencies

| Dependency | Relationship |
|------------|-------------|
| `exploit-dev/fuzzing-guide` | Superseded/complemented by `aflplusplus-fuzz`. The guide remains as a conceptual reference; AFL++ provides the actual runner. |
| `exploit-dev/custom-exploit` | Receives exploit source from `searchsploit-lookup` for adaptation and deployment. |
| `exploit-dev/payload-delivery` | Receives payload selections from `payload-reference` for delivery. |
| `exploit-dev/msfvenom-payloads` | Alternative payload generation path; `payload-reference` may suggest msfvenom commands. |
| `exploit-dev/buffer-overflow` | AFL++ crash triage may feed into buffer overflow analysis workflows. |
| `exploit-dev/shellcode-gen` | Exploits found via searchsploit may require custom shellcode. |

### External Dependencies

- `git` — required for cloning and updating ExploitDB and PayloadsAllTheThings.
- `clang` / `llvm` — required for AFL++ instrumentation.
- `build-essential` — required for compiling instrumented targets.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ExploitDB clone size (~700 MB) inflates nexus-kali image | High | Medium | Use shallow clone for base image; provide `searchsploit -u` for full update on demand. Consider separating into an optional image layer. |
| AFL++ fuzzing campaigns consume significant CPU/memory/disk | High | Medium | Enforce resource limits in skill (CPU time caps, output directory size limits, max campaign duration). Document recommended resource allocation. |
| ExploitDB and PayloadsAllTheThings become stale if not updated | Medium | Medium | Include update commands in skill workflows. Add a freshness check that warns if the local clone is older than 30 days. |
| AFL++ crashes could destabilize the container | Low | High | Run fuzzing targets in a sandboxed subprocess with `ulimit` restrictions. Use AFL++ persistent mode where possible to reduce fork overhead. |
| PayloadsAllTheThings payloads used without understanding context | Medium | Medium | Skill output includes technique descriptions and caveats, not just raw payloads. Scope check enforced before any payload use. |
| searchsploit results may include outdated or non-functional exploits | Medium | Low | Skill output includes exploit age, platform, and verification status. Cross-reference with CVE data when available. |
