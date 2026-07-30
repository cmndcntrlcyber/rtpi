# v3.4.1 — Cloud Security Skills

**Priority:** P1
**Status:** Complete
**Skill Category:** `skills/offense/cloud/`
**Tools:** 16
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Expand the nexus-harness `cloud/` skill category from 1 skill (pacu-aws) to 16+ skills covering multi-cloud security assessment, IAM analysis, secret scanning, and infrastructure graphing. All skills operate standalone inside nexus-kali — independent of RTPI.

---

## Tool Inventory

| # | Tool | Purpose | Install Method | Skill Name |
|---|------|---------|----------------|------------|
| 1 | AWS CLI v2 | AWS API access, prerequisite for most AWS tools | binary download | `cloud/aws-cli` |
| 2 | gcloud CLI | GCP API access, prerequisite for GCP tools | apt (Google repo) | `cloud/gcloud-cli` |
| 3 | Azure CLI | Azure API access, prerequisite for Azure tools | install script | `cloud/azure-cli` |
| 4 | ScoutSuite | Multi-cloud security auditing (AWS/GCP/Azure) | pip | `cloud/scoutsuite-audit` |
| 5 | Prowler | AWS/GCP/Azure CIS benchmark compliance | pip | `cloud/prowler-audit` |
| 6 | CloudFox | AWS attack surface enumeration | binary download | `cloud/cloudfox-enum` |
| 7 | Steampipe | SQL-based cloud querying + plugins (aws/gcp/azure) | install script | `cloud/steampipe-query` |
| 8 | enumerate-iam | AWS IAM permission brute-forcing | git clone + pip | `cloud/enumerate-iam` |
| 9 | cloudsplaining | AWS IAM privilege escalation analysis | pip | `cloud/cloudsplaining` |
| 10 | parliament | AWS IAM policy linting | pip | `cloud/parliament-lint` |
| 11 | pmapper | AWS IAM privilege escalation path mapping | pip | `cloud/pmapper-paths` |
| 12 | cartography | Cloud infrastructure graphing (Neo4j-backed) | pip | `cloud/cartography-graph` |
| 13 | s3scanner | S3 bucket discovery and permissions auditing | pip | `cloud/s3scanner` |
| 14 | trufflehog | Secret scanning across repos, filesystems, S3 | pip | `cloud/trufflehog-secrets` |
| 15 | roadrecon | Azure AD/Entra ID reconnaissance | pip | `cloud/roadrecon` |
| 16 | Az/AzureAD/MSOnline PowerShell modules | Azure AD enumeration via PowerShell | pwsh Install-Module | `cloud/azure-powershell` |

---

## Skill Structure

Each skill follows the nexus-harness offense skill pattern:

```
skills/offense/cloud/<skill-name>/
  SKILL.md          # YAML frontmatter + workflow sections
```

Standard sections per SKILL.md:
1. Scope Check (`$TARGET` must be in scope)
2. Quick Workflow (common one-liner usage)
3. Technique Sections (detailed usage patterns)
4. Output Handling (results → `/results/$ENGAGEMENT/cloud/`)
5. Pitfalls (common mistakes, rate limiting, credential exposure)
6. Verification (confirm tool ran, output is valid)

---

## Acceptance Criteria

- [x] 16 SKILL.md files created under `skills/offense/cloud/` (17 total with existing pacu-aws)
- [x] Each skill works standalone via `nexus` CLI inside nexus-kali (frontmatter validated: name, description, allowed-tools present on all 16 skills)
- [x] All 16 tools installed in nexus-kali image (`docker/Dockerfile` updated 2026-07-30)
- [x] Results output to `/results/$ENGAGEMENT/cloud/<tool>/`
- [x] Scope enforcement: all skills check target against engagement scope before execution
- [x] Skills reference MITRE ATT&CK techniques where applicable (Discovery TA0007, Credential Access TA0006)
- [x] `hunt/hunt-cloud-misconfig` updated to reference all 17 `cloud/` tool skills (2026-07-30)

---

## Nexus-Kali Image Requirements

### pip (single layer)
```
scoutsuite prowler cloudsplaining parliament cartography pmapper s3scanner trufflehog roadrecon
```

### Binary downloads
```
AWS CLI v2 (awscli.amazonaws.com)
CloudFox (BishopFox/cloudfox GitHub release)
Steampipe (steampipe.io install script) + aws/gcp/azure plugins
```

### apt
```
(gcloud CLI via packages.cloud.google.com apt repo)
```

### Other
```
Azure CLI (aka.ms/InstallAzureCLIDeb install script)
PowerShell (binary download) + Az, AzureAD, MSOnline modules (pwsh Install-Module)
```

### Runtime Prerequisites (not baked into image)
- AWS credentials (`~/.aws/credentials` or env vars `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- GCP auth (`gcloud auth login` or service account JSON)
- Azure auth (`az login` or service principal)
- Steampipe connection configs (`~/.steampipe/config/`)
- Neo4j instance (for cartography, optional)

---

## Dependencies

- Existing skill: `cloud/pacu-aws` — reference for skill structure and scope enforcement pattern
- nexus-kali Dockerfile must include all tools above
- Scope guard must validate cloud account IDs / subscription IDs in addition to IP/domain targets

---

## Risks

| Risk | Mitigation |
|------|------------|
| Cloud API rate limiting during scans | Skills include rate-limiting guidance and --throttle flags |
| Credential exposure in results | Skills warn against logging credentials; output sanitization guidance |
| Multi-cloud scope confusion | Skills require explicit cloud provider and account/project/subscription targeting |
| Steampipe plugin version drift | Pin plugin versions in nexus-kali build; document update procedure |
