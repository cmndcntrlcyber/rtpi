# v3.4.1 Cloud Security — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: AWS Security Audit

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `cloud/aws-cli`, `cloud/scoutsuite-audit`, `cloud/prowler-audit`, `cloud/cloudfox-enum`

```
1. Scope check → verify AWS account ID is in engagement scope
2. aws sts get-caller-identity → confirm credentials are valid
3. scoutsuite aws → full CIS benchmark audit → /results/$ENGAGEMENT/cloud/scoutsuite/
4. prowler aws → compliance scan (CIS, PCI-DSS, HIPAA) → /results/$ENGAGEMENT/cloud/prowler/
5. cloudfox aws all-checks → attack surface enumeration → /results/$ENGAGEMENT/cloud/cloudfox/
6. Consolidate findings → engagement-report skill
```

## Workflow 2: AWS IAM Privilege Escalation Analysis

**Skills used:** `cloud/enumerate-iam`, `cloud/cloudsplaining`, `cloud/parliament-lint`, `cloud/pmapper-paths`

```
1. enumerate-iam → brute-force IAM permissions for target role/user
2. cloudsplaining → analyze IAM policies for privilege escalation paths
3. parliament → lint IAM policies for misconfigurations
4. pmapper → graph IAM privilege escalation paths
5. Results → /results/$ENGAGEMENT/cloud/iam/
```

## Workflow 3: Multi-Cloud Asset Discovery

**Skills used:** `cloud/steampipe-query`, `cloud/cartography-graph`

```
1. steampipe query "select * from aws_ec2_instance" → enumerate compute
2. steampipe query "select * from gcp_compute_instance" → enumerate GCP
3. steampipe query "select * from azure_compute_virtual_machine" → enumerate Azure
4. cartography --neo4j-uri → build infrastructure graph
5. Results → /results/$ENGAGEMENT/cloud/inventory/
```

## Workflow 4: Secret Scanning

**Skills used:** `cloud/trufflehog-secrets`, `cloud/s3scanner`

```
1. trufflehog filesystem /target/repo → scan codebase for secrets
2. trufflehog s3 --bucket target-bucket → scan S3 for leaked credentials
3. s3scanner --bucket-file targets.txt → enumerate bucket permissions
4. Results → /results/$ENGAGEMENT/cloud/secrets/
```

## Workflow 5: Azure / Entra ID Reconnaissance

**Skills used:** `cloud/azure-cli`, `cloud/roadrecon`, `cloud/azure-powershell`

```
1. az login → authenticate to Azure
2. roadrecon gather → enumerate Azure AD/Entra ID
3. roadrecon dump → export AD data
4. roadrecon gui → analyze (or parse JSON output)
5. Az module: Get-AzADUser, Get-AzADGroup, Get-AzRoleAssignment
6. Results → /results/$ENGAGEMENT/cloud/azure/
```
