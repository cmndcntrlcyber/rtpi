variable "cloudflare_account_id" {
  description = "Cloudflare account ID hosting the Zero Trust org. Find at https://dash.cloudflare.com/<account_id>."
  type        = string
}

variable "tenants" {
  description = <<-EOT
    Google Workspace tenants to expose as Access identity providers.
    Each entry produces one cloudflare_zero_trust_access_identity_provider of type "google-apps".

    The (client_id, client_secret) pair is produced by v2.9.4's setup-google-oauth.sh.
    A single Google client may be reused across multiple tenants if the consent screen
    permits — the screenshots in v2.9.5 show one App ID 665194864071-... powering three IdPs.
  EOT

  type = list(object({
    id               = string # short slug, e.g. "attck"
    name             = string # display name in Cloudflare, e.g. "attck-workspace"
    workspace_domain = string # Google Workspace domain, e.g. "attck.nexus"
    client_id        = string # Google OAuth Web client App ID
    client_secret    = string # Google OAuth Web client secret (sensitive)
    enable_scim      = optional(bool, false)
  }))

  validation {
    condition     = length(var.tenants) > 0
    error_message = "At least one tenant must be defined."
  }
}

variable "applications" {
  description = <<-EOT
    RTPI surfaces protected by Access. One entry per public hostname.

    `allowed_tenant_ids` is the subset of var.tenants that may sign in to this app.
    For a single-tenant app, list one. For an admin/console app shared across all
    three workspaces, list all three.
  EOT

  type = list(object({
    id                 = string       # slug, e.g. "rtpi-ui-attck"
    name               = string       # display name, e.g. "RTPI UI (attck.nexus)"
    domain             = string       # public hostname, e.g. "rtpi.attck.nexus"
    allowed_tenant_ids = list(string) # subset of var.tenants[*].id
    session_duration   = optional(string, "24h")
    auto_redirect      = optional(bool, true)

    # Authorization policy. Each entry becomes one cloudflare_zero_trust_access_policy.
    same_site_cookie = optional(string, "lax")

    policies = optional(list(object({
      name           = string
      decision       = string                 # "allow" | "deny" | "non_identity" | "bypass"
      precedence     = optional(number)
      include_emails = optional(list(string), [])
      include_groups = optional(list(string), []) # Workspace group names; requires SCIM ON
      require_groups = optional(list(string), [])
    })), [])
  }))

  validation {
    condition = alltrue([
      for a in var.applications : length(a.allowed_tenant_ids) > 0
    ])
    error_message = "Every application must allow at least one tenant."
  }
}

# Treat all tenant secrets as sensitive. Terraform will redact from plan output.
# (The variable above already carries `client_secret`; this is a no-op locals
# wrapper that exists to give users a place to override sensitivity if needed.)
locals {
  _sensitivity_marker = nonsensitive("see variables.tf")
}
