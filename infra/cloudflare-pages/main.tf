###############################################################################
# RTPI Cloudflare Pages — project creation + optional custom domain
#
# Deployment is handled by build.sh Phase 4d via `wrangler pages deploy`.
# This module only creates the project and optional custom domain binding.
#
# Auth: set CLOUDFLARE_API_TOKEN env var to the value of CF_ACCOUNT_TOKEN
# (must have Account > Pages Edit permission).
###############################################################################

provider "cloudflare" {}

resource "cloudflare_pages_project" "this" {
  account_id      = var.cloudflare_account_id
  name            = var.project_name
  production_branch = var.production_branch
}

resource "cloudflare_pages_domain" "this" {
  count      = var.custom_domain != null ? 1 : 0
  account_id = var.cloudflare_account_id
  project_name = cloudflare_pages_project.this.name
  domain       = var.custom_domain
}
