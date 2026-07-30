# v3.4.5 Azure / Entra AD — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: Azure / Entra ID Enumeration

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `active-directory/aadinternals`, `active-directory/aadinternals-endpoints`, `active-directory/entra-mfa-check`, `active-directory/entraops`

```
1. Scope check -> verify Azure tenant ID / Entra domain is in engagement scope
2. AADInternals: Invoke-AADIntReconAsOutsider -> enumerate tenant info (domains, auth methods, MX, federation)
3. AADInternals: Get-AADIntTenantID -> resolve tenant ID from domain
4. AADInternals-Endpoints: enumerate available API endpoints for the tenant
5. EntraMFACheck: assess MFA enforcement gaps across Entra ID users
6. EntraOps: audit privileged role assignments and conditional access policies
7. Results -> /results/$ENGAGEMENT/active-directory/entra-enum/
```

### Key Outputs
- Tenant configuration (federation type, authentication methods, domains)
- MFA coverage gaps (users without MFA, legacy auth bypass)
- Privileged role assignments (Global Admin, Privileged Role Administrator)
- Conditional access policy weaknesses

---

## Workflow 2: AD Lateral Movement & Privilege Escalation

**Skills used:** `active-directory/linwinpwn`, `active-directory/donpwner`, `active-directory/rpc2efs`, `active-directory/networkhound`

```
1. Scope check -> verify target domain and IP ranges are in engagement scope
2. NetworkHound: enumerate live hosts and network topology in the AD environment
3. linWinPwn --mode enum -> AD enumeration (users, groups, GPOs, ACLs)
4. linWinPwn --mode kerberos -> Kerberoasting, AS-REP roasting (delegates to existing skills where available)
5. DonPwner: check for misconfigured AD permissions enabling privesc
6. rpc2efs: attempt EFS coerced authentication for lateral movement
7. linWinPwn --mode relay -> NTLM relay attacks (delegates to active-directory/ntlm-relay skill)
8. Results -> /results/$ENGAGEMENT/active-directory/lateral-movement/
```

### Key Outputs
- Network topology map and live host inventory
- AD enumeration data (users, groups, GPO links, ACL misconfigurations)
- Kerberos ticket hashes (for offline cracking)
- Privilege escalation paths via misconfigured permissions
- Coerced authentication captures (EFS, PetitPotam)

---

## Workflow 3: LSASS Credential Extraction & Post-Exploitation

**Skills used:** `active-directory/dumpert`, `active-directory/chrome-abe-decrypt`, `active-directory/dsinternals`, `active-directory/byosi`

```
1. Scope check -> verify target host is in scope; confirm local admin / SYSTEM access
2. Dumpert: dump LSASS memory using direct system calls (evasive)
3. Parse LSASS dump offline with pypykatz or mimikatz -> extract NTLM hashes, Kerberos tickets
4. Chrome-ABE-Decrypt: extract Chrome saved credentials from App-Bound Encryption
5. DSInternals: offline ntds.dit analysis -> extract password hashes, audit password quality
6. DSInternals: Get-ADDBAccount -> extract specific account details from AD database
7. BYOSI: deploy custom interpreter for additional payload execution if needed
8. Results -> /results/$ENGAGEMENT/active-directory/credential-extraction/
```

### Key Outputs
- LSASS memory dump (minidump format)
- Extracted NTLM hashes, Kerberos TGTs/TGSs
- Chrome saved credentials (decrypted)
- AD database password hashes (from ntds.dit)
- Password audit report (weak/reused passwords)

---

## Workflow 4: M365 Security Assessment

**Skills used:** `active-directory/scubagear`, `active-directory/sharehound`, `active-directory/entraops`

```
1. Scope check -> verify M365 tenant is in engagement scope; confirm admin credentials available
2. ScubaGear: Invoke-SCuBA -> run CISA SCuBA baseline assessment against M365 tenant
   - AAD (Entra ID) baseline
   - Exchange Online baseline
   - SharePoint/OneDrive baseline
   - Teams baseline
   - Power Platform baseline
   - Defender baseline
3. ShareHound: enumerate SharePoint sites and OneDrive for sensitive data exposure
4. EntraOps: cross-reference privileged access with M365 admin roles
5. Results -> /results/$ENGAGEMENT/active-directory/m365-assessment/
```

### Key Outputs
- CISA SCuBA compliance report (HTML + JSON) with pass/fail per control
- SharePoint/OneDrive sensitive data inventory
- M365 admin role mapping and privilege analysis
- Remediation recommendations per failed SCuBA control
