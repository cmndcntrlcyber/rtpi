###############################################################################
# RTPI Cloudflare R2 — releases bucket for nexus-console binaries
#
# Upload is handled by build.sh Phase 3i via `wrangler r2 object put`.
# This module only creates the bucket.
#
# Auth: set CLOUDFLARE_API_TOKEN env var to the value of CF_ACCOUNT_TOKEN
# (must have Account > R2 Edit permission).
###############################################################################

provider "cloudflare" {}

resource "cloudflare_r2_bucket" "releases" {
  account_id = var.cloudflare_account_id
  name       = var.bucket_name
  location   = var.location
}
