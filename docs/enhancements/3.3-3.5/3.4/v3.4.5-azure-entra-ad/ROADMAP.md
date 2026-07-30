# v3.4.5 — Azure / Entra AD Skills

**Priority:** P3
**Status:** Dockerfile Updated, Skills Pending
**Skill Category:** `skills/offense/active-directory/` (expand existing)
**Tools:** 14
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Expand the nexus-harness `active-directory/` skill category (currently 15 skills covering BloodHound, Certipy, Kerberoasting, etc.) with 14 additional skills targeting Azure AD / Entra ID, cloud-joined AD environments, credential extraction, and Windows-specific post-exploitation. All skills operate standalone inside nexus-kali -- independent of RTPI.

---

## Tool Inventory

| # | Tool | Purpose | Install Method | Skill Name |
|---|------|---------|----------------|------------|
| 1 | AADInternals | Azure AD/Entra ID internal operations (tenant recon, token manipulation, backdoors) | git clone Gerenios/AADInternals + pwsh Import-Module | `active-directory/aadinternals` |
| 2 | AADInternals-Endpoints | AADInternals API endpoint reference and enumeration | git clone Gerenios/AADInternals-Endpoints | `active-directory/aadinternals-endpoints` |
| 3 | EntraMFACheck | Entra ID MFA status checking and gap identification | git clone dafthack/EntraMFACheck + pwsh | `active-directory/entra-mfa-check` |
| 4 | EntraOps | Entra ID privileged operations security assessment | git clone Cloud-Architekt/EntraOps + pwsh | `active-directory/entraops` |
| 5 | linWinPwn | Linux-based AD attack toolkit (enum, relay, Kerberos, credential dumping) | git clone lefayjey/linWinPwn + pip deps | `active-directory/linwinpwn` |
| 6 | ScubaGear | M365 security configuration assessment (CISA SCuBA baselines) | git clone cisagov/ScubaGear + pwsh Install-Module | `active-directory/scubagear` |
| 7 | Chrome-ABE-Decrypt | Chrome App-Bound Encryption credential extraction | git clone xaitax/Chrome-App-Bound-Encryption-Decryption | `active-directory/chrome-abe-decrypt` |
| 8 | ShareHound | SharePoint and OneDrive enumeration and data exfiltration | git clone protectai/ShareHound + pip | `active-directory/sharehound` |
| 9 | NetworkHound | Network enumeration and host discovery for AD environments | git clone Wafffle77/NetworkHound | `active-directory/networkhound` |
| 10 | Dumpert | Evasive LSASS memory dumper using direct system calls | git clone outflanknl/Dumpert (precompiled binary or compile) | `active-directory/dumpert` |
| 11 | DonPwner | AD privilege escalation via misconfigured permissions | git clone MisterPwner/DonPwner + pip | `active-directory/donpwner` |
| 12 | rpc2efs | Lateral movement via RPC-to-EFS coerced authentication | git clone Wh04m1001/rpc2efs (compile or prebuilt) | `active-directory/rpc2efs` |
| 13 | DSInternals | AD database inspection, password auditing, replication | git clone MichaelGrafnetter/DSInternals + pwsh Import-Module | `active-directory/dsinternals` |
| 14 | BYOSI | Bring Your Own Script Interpreter for payload execution | git clone mrd0x/BYOSI | `active-directory/byosi` |

---

## Skill Structure

Each skill follows the nexus-harness offense skill pattern:

```
skills/offense/active-directory/<skill-name>/
  SKILL.md          # YAML frontmatter + workflow sections
```

Standard sections per SKILL.md:
1. Scope Check (`$TARGET` domain/tenant must be in scope)
2. Quick Workflow (common one-liner usage)
3. Technique Sections (detailed usage patterns)
4. Output Handling (results -> `/results/$ENGAGEMENT/active-directory/`)
5. Pitfalls (credential exposure, AzureAD conditional access, detection risk)
6. Verification (confirm tool ran, output is valid)

---

## Acceptance Criteria

- [ ] 14 SKILL.md files created under `skills/offense/active-directory/`
- [ ] Each skill works standalone via `nexus` CLI inside nexus-kali
- [x] All 14 tools installed in nexus-kali image (`docker/Dockerfile` updated 2026-07-30 — powershell, Az/AADInternals/DSInternals/Microsoft.Graph modules, linWinPwn, EntraOps, ScubaGear via git clone + pwsh layers)
- [ ] Results output to `/results/$ENGAGEMENT/active-directory/<tool>/`
- [ ] Scope enforcement: all skills check target domain/tenant against engagement scope before execution
- [ ] Skills reference MITRE ATT&CK techniques where applicable (Credential Access TA0006, Lateral Movement TA0008, Discovery TA0007, Persistence TA0003)
- [ ] PowerShell-based tools (AADInternals, EntraMFACheck, EntraOps, ScubaGear, DSInternals) verified working under pwsh on Linux
- [ ] linWinPwn integration tested against existing AD skills (bloodhound-enum, kerberoasting, etc.) to avoid duplication

---

## Nexus-Kali Image Requirements

### git clone (all into /opt/)
```
Gerenios/AADInternals
Gerenios/AADInternals-Endpoints
dafthack/EntraMFACheck
Cloud-Architekt/EntraOps
lefayjey/linWinPwn
cisagov/ScubaGear
xaitax/Chrome-App-Bound-Encryption-Decryption
protectai/ShareHound
Wafffle77/NetworkHound
outflanknl/Dumpert
MisterPwner/DonPwner
Wh04m1001/rpc2efs
MichaelGrafnetter/DSInternals
mrd0x/BYOSI
```

### pip (single layer)
```
sharehound linwinpwn-deps donpwner
```

### PowerShell modules (pwsh Install-Module)
```
AADInternals (Import-Module from cloned repo)
DSInternals
ScubaGear (OPA dependency: binary download)
```

### apt
```
powershell (or binary download from Microsoft)
```

### Runtime Prerequisites (not baked into image)
- Azure AD / Entra ID credentials (tenant ID, client ID, or user creds)
- M365 admin credentials (for ScubaGear)
- Domain-joined context or valid domain credentials (for linWinPwn, DSInternals)
- LSASS access (for Dumpert -- requires local admin or SYSTEM on target)

---

## Dependencies

- Existing skills to reference for structure: `active-directory/bloodhound-enum`, `active-directory/certipy-abuse`, `active-directory/kerberoasting`, `active-directory/pass-the-hash`, `active-directory/ntlm-relay`
- linWinPwn wraps many tools that already have dedicated skills -- skill should delegate to existing skills where possible, use linWinPwn for orchestration
- PowerShell (pwsh) must be installed in nexus-kali for 5 of the 14 tools
- v3.4.1 cloud/roadrecon and cloud/azure-powershell overlap -- cross-reference to avoid redundancy

---

## Risks

| Risk | Mitigation |
|------|------------|
| PowerShell module compatibility on Linux | Test all pwsh modules in CI; document known limitations vs. Windows |
| AADInternals detection by Microsoft Defender | Skills include OPSEC notes; warn about conditional access policies and sign-in logs |
| Dumpert AV/EDR detection | Skills note that Dumpert signatures are widely known; provide guidance on when to use vs. alternatives |
| linWinPwn overlap with existing skills | Skill explicitly delegates to existing nexus-harness skills; linWinPwn used as orchestrator only |
| ScubaGear OPA dependency version drift | Pin OPA binary version in nexus-kali build |
| Azure API throttling | Skills include rate-limit awareness and backoff guidance |
