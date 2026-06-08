---
name: Az
description: Azure CLI (az) v2.85.0 – Multi-platform command-line tool for
  managing Azure subscriptions, resources, identities, and services.
registry: registry
tool_id: az
category: azure
tags:
  - azure
  - cloud
  - enumeration
  - rbac
  - reconnaissance
  - identity
  - credential-access
mitre_techniques:
  - T1087.004
  - T1069.003
  - T1580
  - T1526
  - T1538
  - T1078.004
summary: "Azure CLI (`az`) is the primary command-line interface for Azure
  management. Use it during red team operations to enumerate Azure AD (Entra ID)
  users, groups, roles, subscriptions, resources, storage accounts, key vaults,
  SQL databases, and VMs. Invoke with `az <service> <subcommand>` after
  authenticating via `az login` (interactive), `--service-principal`,
  `--identity` (managed identity on Azure VMs), or `--federated-token`.
  Authentication tokens are cached locally in `~/.azure/`. Common enumeration
  commands: `az account list`, `az ad user list`, `az ad group member list`, `az
  role assignment list`, `az resource list`, `az vm list`, `az storage account
  list`, `az keyvault list`, `az sql server list`. Use `--output json` (default)
  or `--output table` for readability; filter with `--query` (JMESPath syntax).
  Check `--subscription` to target specific subscriptions. Exit codes:
  0=success, 1=generic error, 2=parser error, 3=resource not found. Watch for
  MFA prompts during `az login` that may interrupt automation. Tokens expire;
  re-authenticate as needed. Use `--verbose` or `--debug` for troubleshooting.
  Be aware of Azure logging: command execution generates Azure Activity Logs
  visible to defenders. Submit penetration testing notification via Azure portal
  if simulating adversary TTPs to avoid triggering Microsoft security
  monitoring."
sources:
  - https://learn.microsoft.com/en-us/cli/azure/reference-index?view=azure-cli-latest
  - https://learn.microsoft.com/en-us/cli/azure/get-started-with-azure-cli?view=azure-cli-latest
  - https://www.flexera.com/blog/finops/azure-pricing-the-complete-guide/
  - https://github.com/Azure/azure-cli
  - https://learn.microsoft.com/en-us/azure/
  - https://learn.microsoft.com/en-us/cli/azure/reference-docs-index?view=azure-cli-latest
  - https://learn.microsoft.com/en-us/answers/questions/1282902/finding-cli-documentation
  - https://gist.github.com/devops-school/235277687a179a8dd2c0140543e48970
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences/
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
  - https://www.ibm.com/think/topics/red-teaming
  - https://www.redveil.ai/additional-resources/hardening/azure-penetration-testing-guide
generated_at: 2026-05-19T11:07:41.696Z
generated_by: anthropic
source_hash: 0a4693972156ed210850e72c5ce6613e650e9c1a4340c7da1f39541d8a0c7321
---

# Az

## Overview

Azure CLI is Microsoft's cross-platform, Python-based command-line tool for managing all Azure services. Version 2.85.0 provides comprehensive access to Azure Resource Manager (ARM), Azure AD (Entra ID), storage, compute, networking, security, and RBAC. Commands follow the pattern `az <service> <subcommand> <parameters>`. Core modules (account, ad, vm, storage, keyvault, sql, role, resource, etc.) are built-in; extensions add specialized functionality. All commands support `--help`, `--output`, `--query`, `--subscription`, `--verbose`, `--debug`, and `--only-show-errors`. Exit codes: 0 (success), 1 (generic error), 2 (parser error), 3 (missing resource). The tool caches credentials in `~/.azure/` and supports multiple authentication methods including interactive login, service principals, managed identities, and federated tokens.

## When to use

Use Azure CLI when you have valid Azure credentials and need to enumerate cloud assets, identify misconfigurations, or pivot within Azure environments. Ideal for: discovering subscriptions and tenants accessible to compromised credentials; listing users, groups, and roles in Azure AD/Entra ID; enumerating VMs, storage accounts, databases, and key vaults; checking RBAC permissions and role assignments; identifying publicly accessible storage blobs or misconfigured network security groups; extracting secrets from Key Vault; checking for transparent data encryption on SQL databases; verifying MFA status (via PowerShell integration); testing for privilege escalation paths through role assignments. Use during initial access enumeration, lateral movement, and privilege escalation phases. Prefer `az` over Azure Portal when you need scriptable, repeatable operations or when operating from compromised Linux VMs with managed identities. Submit penetration testing notification if conducting full red team simulation to avoid triggering Microsoft's SOC.

## Authentication & setup

Authenticate using one of four methods: (1) Interactive: `az login` opens browser for OAuth flow; supports MFA but may interrupt automation. Tokens cached in `~/.azure/accessTokens.json`. (2) Service Principal: `az login --service-principal --username <app-id> --password <secret> --tenant <tenant-id>` or with certificate `--certificate <path> [--use-cert-sn-issuer]`. (3) Managed Identity: `az login --identity` on Azure VMs/containers with system- or user-assigned identities; specify `--username <client-id>` or `--object-id` for user-assigned. (4) Federated Token: `az login --federated-token <token> --service-principal --username <app-id> --tenant <tenant-id>` for workload identity federation. Verify authentication: `az account show`. List accessible subscriptions: `az account list`. Set active subscription: `az account set --subscription <name-or-id>`. Check token expiration with `az account get-access-token`. Credentials persist in `~/.azure/` – clear with `az logout` or manual file deletion. If MFA blocks automation, request service principal credentials from client or use managed identity on compromised Azure resource.

## Key commands / parameters

Core enumeration commands: `az account list` (subscriptions), `az account show` (current context), `az ad user list` (users), `az ad group list` (groups), `az ad group member list --group <name>` (group members), `az role assignment list` (RBAC), `az role assignment list --assignee <upn-or-object-id>` (user permissions), `az resource list` (all resources), `az vm list`, `az vm list --show-details` (includes IPs), `az storage account list`, `az storage account keys list --account-name <name> --resource-group <rg>` (storage keys), `az keyvault list`, `az keyvault secret list --vault-name <name>`, `az keyvault secret show --vault-name <name> --name <secret>`, `az sql server list`, `az sql db list --server <name> --resource-group <rg>`, `az sql db tde show` (check encryption), `az network nsg list`, `az network nsg rule list --nsg-name <name> --resource-group <rg>`. Common flags: `--output json|table|tsv|yaml` (format), `--query '<jmespath>'` (filter), `--subscription <id>` (target subscription), `--resource-group <name>` (scope), `--only-show-errors` (suppress warnings), `--verbose`, `--debug`. Use `az rest --method GET --url <arm-url>` for direct ARM API calls. Use `az find <command>` for AI-assisted help.

## Example workflows

Initial enumeration: `az login`, `az account list --output table`, `az ad user list --query '[].userPrincipalName'`, `az ad group list --query '[].displayName'`, `az role assignment list --all --query '[].{Principal:principalName,Role:roleDefinitionName,Scope:scope}' --output table`. Resource discovery: `az resource list --output table`, `az vm list --query '[].{Name:name,RG:resourceGroup,Location:location}' --output table`, `az storage account list --query '[].name'`. Privilege check: `az role assignment list --assignee user@domain.com`, `az ad group member list --group 'Global Administrators'`. Key Vault extraction: `az keyvault list --query '[].name' --output tsv | xargs -I {} az keyvault secret list --vault-name {} --query '[].name' --output tsv`. Storage enumeration: `az storage account list --query '[].name' --output tsv | xargs -I {} az storage account keys list --account-name {} --resource-group <rg>`. SQL check: `az sql server list --output table`, `az sql db tde show --server <srv> --database <db> --resource-group <rg>`. Use `--query` extensively to filter JSON: `az vm list --query "[?powerState=='VM running'].name"`. Chain with `jq` for advanced parsing: `az vm list | jq -r '.[] | select(.storageProfile.osDisk.osType=="Linux") | .name'`.

## Output format

Default output is JSON; switch with `--output table` (human-readable), `tsv` (tab-separated), `yaml`, `jsonc` (colored JSON). JSON output is structured with camelCase keys. Use `--query` with JMESPath to filter: `--query '[].name'` extracts name array, `--query '[?location==\"eastus\"]'` filters by location, `--query '[].{Name:name,RG:resourceGroup}'` reshapes output. Combine with shell tools: `az vm list --query '[].name' --output tsv` produces plain list suitable for `xargs`. Error messages go to stderr; use `--only-show-errors` to suppress warnings. Verbose mode (`--verbose`) logs HTTP requests; `--debug` adds Python stack traces. Exit code 0 = success, 1 = error, 2 = invalid syntax, 3 = resource not found (useful for scripting existence checks). Some commands (e.g., `az ad`) require Microsoft Graph permissions; insufficient permissions yield HTTP 403 errors in debug output.

## Common pitfalls

Token expiration: Azure tokens expire after 1 hour by default; long-running operations require re-authentication. Subscription context: Commands target the default subscription unless `--subscription` specified; always verify with `az account show`. Permission errors: Many `az ad` commands require Directory Reader or higher; standard user accounts often lack enumeration rights. MFA interruption: `az login` may trigger MFA prompts, blocking automation; use service principals or managed identities instead. Logging and detection: Azure Activity Logs record all ARM operations with timestamp, caller identity, IP, and action; assume defenders see your commands. Rate limiting: Excessive API calls trigger throttling (HTTP 429); space out bulk enumeration. Case sensitivity: Resource names and parameters are case-sensitive. Missing extensions: Some commands require `az extension add --name <ext>`; check error messages. Output parsing: JSON structure varies by command; test `--query` filters before scripting. Storage keys require both account name and resource group. Key Vault access requires explicit access policies or RBAC; `az keyvault secret list` fails without permissions. Cross-tenant enumeration requires separate logins per tenant. Managed identity authentication only works on Azure resources with identity enabled.

## References

• https://learn.microsoft.com/en-us/cli/azure/reference-index?view=azure-cli-latest
• https://learn.microsoft.com/en-us/cli/azure/get-started-with-azure-cli?view=azure-cli-latest
• https://github.com/Azure/azure-cli
• https://learn.microsoft.com/en-us/cli/azure/reference-docs-index?view=azure-cli-latest
• https://gist.github.com/devops-school/235277687a179a8dd2c0140543e48970
• https://www.redveil.ai/additional-resources/hardening/azure-penetration-testing-guide
