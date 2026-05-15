###############################################################################
# Outputs consumed by RTPI server runtime.
#
# After `terraform apply`, copy `access_app_auds` (comma-joined) into the
# CLOUDFLARE_ACCESS_AUD_TAGS env var on the RTPI deployment. The Phase 4
# JWT verifier in server/auth/strategies/cloudflare-access.ts validates the
# `aud` claim against this list.
###############################################################################

output "idp_ids" {
  description = "Map of tenant slug -> Cloudflare IdP id."
  value       = { for k, v in cloudflare_zero_trust_access_identity_provider.tenant : k => v.id }
}

output "access_app_auds" {
  description = <<-EOT
    Map of application slug -> AUD tag.
    Use the joined values as CLOUDFLARE_ACCESS_AUD_TAGS in RTPI's .env.
    Example:
      export CLOUDFLARE_ACCESS_AUD_TAGS="$(terraform output -json access_app_auds | jq -r '. | join(",")')"
  EOT
  value       = { for k, v in cloudflare_zero_trust_access_application.app : k => v.aud }
}

output "access_app_domains" {
  description = "Map of application slug -> public hostname (sanity check)."
  value       = { for k, v in cloudflare_zero_trust_access_application.app : k => v.domain }
}
