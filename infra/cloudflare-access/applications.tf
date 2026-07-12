###############################################################################
# Access applications and policies.
#
# Pattern:
#   1. One cloudflare_zero_trust_access_application per public hostname.
#   2. allowed_idps narrows which IdPs the app accepts (cross-tenant isolation).
#   3. One cloudflare_zero_trust_access_policy per entry in app.policies, plus
#      a default "allow same-domain email" policy auto-generated for each
#      tenant the app permits.
###############################################################################

resource "cloudflare_zero_trust_access_application" "app" {
  for_each   = local.app_by_id
  account_id = var.cloudflare_account_id

  name             = each.value.name
  domain           = each.value.domain
  type             = "self_hosted"
  session_duration = each.value.session_duration

  allowed_idps = [
    for tid in each.value.allowed_tenant_ids :
    cloudflare_zero_trust_access_identity_provider.tenant[tid].id
  ]

  auto_redirect_to_identity = (
    each.value.auto_redirect && length(each.value.allowed_tenant_ids) == 1
  )

  http_only_cookie_attribute = true
  same_site_cookie_attribute = each.value.same_site_cookie
  app_launcher_visible       = false
}

###############################################################################
# Default policy: for each (app, tenant) pair, allow that tenant's Workspace
# email domain. This is the floor — finer policies layer on top.
###############################################################################
resource "cloudflare_zero_trust_access_policy" "default_tenant_allow" {
  for_each       = local.app_tenant_map
  account_id     = var.cloudflare_account_id
  application_id = cloudflare_zero_trust_access_application.app[each.value.app_id].id

  name       = "default-allow-${each.value.tenant_id}"
  precedence = 100
  decision   = "allow"

  include {
    email_domain = [local.tenant_by_id[each.value.tenant_id].workspace_domain]
  }
}

###############################################################################
# Operator-defined policies (groups, allowlists, deny rules).
###############################################################################
locals {
  policy_pairs = flatten([
    for app in var.applications : [
      for idx, p in app.policies : {
        key        = "${app.id}--${idx}"
        app_id     = app.id
        policy     = p
      }
    ]
  ])
  policy_map = { for p in local.policy_pairs : p.key => p }
}

resource "cloudflare_zero_trust_access_policy" "custom" {
  for_each       = local.policy_map
  account_id     = var.cloudflare_account_id
  application_id = cloudflare_zero_trust_access_application.app[each.value.app_id].id

  name       = each.value.policy.name
  decision   = each.value.policy.decision
  precedence = coalesce(each.value.policy.precedence, 50)

  dynamic "include" {
    for_each = length(each.value.policy.include_emails) > 0 ? [1] : []
    content { email = each.value.policy.include_emails }
  }

  dynamic "include" {
    for_each = length(each.value.policy.include_groups) > 0 ? [1] : []
    content {
      # Workspace groups exposed via SCIM appear as `gsuite { name = [...] }`.
      gsuite {
        name                  = each.value.policy.include_groups
        identity_provider_id  = cloudflare_zero_trust_access_identity_provider.tenant[
          local.app_by_id[each.value.app_id].allowed_tenant_ids[0]
        ].id
      }
    }
  }

  dynamic "require" {
    for_each = length(each.value.policy.require_groups) > 0 ? [1] : []
    content {
      gsuite {
        name                 = each.value.policy.require_groups
        identity_provider_id = cloudflare_zero_trust_access_identity_provider.tenant[
          local.app_by_id[each.value.app_id].allowed_tenant_ids[0]
        ].id
      }
    }
  }
}
