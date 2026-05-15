###############################################################################
# Identity providers — one per Workspace tenant.
#
# This is the Terraform equivalent of the screenshot panel in v2.9.5:
#   Name              -> tenant.name
#   App ID            -> tenant.client_id
#   Client secret     -> tenant.client_secret  (sensitive)
#   Workspace domain  -> tenant.workspace_domain
#   PKCE              -> false (Google Workspace IdP rejects PKCE on confidential clients)
#   SCIM              -> tenant.enable_scim    (Beta — required for group claims)
###############################################################################

resource "cloudflare_zero_trust_access_identity_provider" "tenant" {
  for_each   = local.tenant_by_id
  account_id = var.cloudflare_account_id
  name       = each.value.name
  type       = "google-apps"

  config {
    client_id     = each.value.client_id
    client_secret = each.value.client_secret
    apps_domain   = each.value.workspace_domain
    pkce_enabled  = false
  }

  scim_config {
    enabled                  = each.value.enable_scim
    user_deprovision         = each.value.enable_scim
    seat_deprovision         = each.value.enable_scim
    group_member_deprovision = each.value.enable_scim
  }
}
