# RTPI Cloudflare Access — Terraform module

Implements [v2.9.5 — Cloudflare Access automation](../../docs/enhancements/2.9/v2.9.5-cloudflare-access-automation.md). Consumes the Google OAuth Web client(s) produced by [v2.9.4](../../docs/enhancements/2.9/v2.9.4-google-oauth-automation.md).

> **Sketch status.** The files in this directory are the v2.9.5 reference implementation called out in the enhancement doc. Resource types target `cloudflare/cloudflare` provider `>= 4.40, < 5`. Run `terraform validate` against your specific provider version before relying on them — Cloudflare renames `cloudflare_zero_trust_access_*` resources between major versions.

## Layout

| File | Purpose |
|---|---|
| [main.tf](./main.tf) | Provider, locals, backend stub |
| [variables.tf](./variables.tf) | `cloudflare_account_id`, `tenants`, `applications` |
| [idp.tf](./idp.tf) | One `cloudflare_zero_trust_access_identity_provider` per tenant |
| [applications.tf](./applications.tf) | Apps + default tenant-allow policy + custom policies |
| [outputs.tf](./outputs.tf) | `access_app_auds` (feeds `CLOUDFLARE_ACCESS_AUD_TAGS` env) |
| [terraform.tfvars.example](./terraform.tfvars.example) | Real shape: 3 tenants, 4 apps |

## First-time apply

```bash
# 1. v2.9.4 bootstrap (once per Workspace tenant) — produces client_id, client_secret
../../scripts/setup-google-oauth.sh --domain https://attck.cloudflareaccess.com   # see v2.9.4

# 2. Configure
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars

# 3. Provide secrets via env (preferred) instead of in tfvars
export CLOUDFLARE_API_TOKEN="<token with Access:Apps and Policies:Edit>"
export TF_VAR_attck_client_secret="GOCSPX-..."
export TF_VAR_c3s_client_secret="GOCSPX-..."
export TF_VAR_d3fend_client_secret="GOCSPX-..."

# 4. Apply
terraform init
terraform plan
terraform apply

# 5. Wire AUD tags into the RTPI deployment
export CLOUDFLARE_ACCESS_AUD_TAGS="$(terraform output -json access_app_auds | jq -r 'to_entries | map(.value) | join(",")')"
echo "CLOUDFLARE_ACCESS_AUD_TAGS=$CLOUDFLARE_ACCESS_AUD_TAGS" >> ../../.env

# 6. Flip the flag and redeploy RTPI
echo "FF_CLOUDFLARE_ACCESS=true" >> ../../.env
```

## Common operations

**Add a new app:** append one entry to `applications` in `terraform.tfvars`, `terraform apply`, append the new AUD tag to `CLOUDFLARE_ACCESS_AUD_TAGS`, redeploy RTPI. No code change.

**Add a new tenant:** run v2.9.4 once for the new Workspace domain, append to `tenants`, `terraform apply`. Existing apps that should accept the new tenant get the new id added to their `allowed_tenant_ids`.

**Rotate a client secret:** mint a new secret in Google Cloud Console, `export TF_VAR_<tenant>_client_secret=<new>`, `terraform apply`. Cloudflare picks it up; users see no interruption.

**Break-glass (Cloudflare edge down):** on the RTPI deployment, `FF_CLOUDFLARE_ACCESS=false` and `FF_DEPRECATE_DIRECT_OAUTH=false`, redeploy. Direct Google OAuth comes back. No Terraform change needed.

## Caveats

- **Provider version drift.** Cloudflare's Terraform provider has renamed `cloudflare_access_*` → `cloudflare_zero_trust_access_*` and may keep evolving. The pin `>= 4.40, < 5` is intentional. Upgrading to v5 is a separate task.
- **`gsuite` policy block + SCIM.** Group-based `include`/`require` only works after enabling **SCIM** on the Workspace IdP — the toggle in the screenshot is OFF by default. Without SCIM, group claims are absent and group-based policies silently match nothing. Set `enable_scim = true` on the tenant before relying on group policies.
- **State contains secrets.** `client_secret` ends up in `terraform.tfstate`. Use a remote backend with at-rest encryption (S3+KMS or Terraform Cloud) and never commit local state.
- **`auto_redirect` only fires for single-IdP apps.** The module's `auto_redirect_to_identity` is forced to `false` whenever `length(allowed_tenant_ids) > 1` so multi-tenant apps still show the IdP picker.
- **Free-tier seat cap (50 users).** Beyond 50 active users, Cloudflare requires a paid plan. The module does not enforce this; monitor in the Zero Trust dashboard.
- **Apps must be on Cloudflare-proxied DNS** (orange cloud) or behind a `cloudflared` tunnel. Direct-to-origin traffic bypasses Access.
