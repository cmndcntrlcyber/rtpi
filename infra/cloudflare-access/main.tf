###############################################################################
# RTPI Cloudflare Access — multi-tenant SSO + authorization
#
# Sketch produced for v2.9.5 (docs/enhancements/2.9/v2.9.5-cloudflare-access-automation.md).
# Apply from this directory with its own state (S3+KMS or Terraform Cloud
# recommended; do NOT commit terraform.tfstate).
###############################################################################

terraform {
  required_version = ">= 1.6"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.40, < 5"
    }
  }

  # Pick ONE backend before applying. Examples below — uncomment and edit.
  #
  # backend "s3" {
  #   bucket         = "rtpi-tfstate"
  #   key            = "cloudflare-access/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   kms_key_id     = "alias/rtpi-tfstate"
  #   dynamodb_table = "rtpi-tfstate-locks"
  # }
  #
  # backend "remote" {
  #   organization = "rtpi"
  #   workspaces { name = "cloudflare-access-prod" }
  # }
}

provider "cloudflare" {
  # CLOUDFLARE_API_TOKEN env var (token must have:
  #   Account → Access: Apps and Policies → Edit
  #   Account → Access: Service Tokens     → Edit  (future)
  # )
}

locals {
  # Build a flat list of (application, tenant) pairs so we can use a single
  # for_each over policies without nested resource blocks.
  app_by_id   = { for a in var.applications : a.id => a }
  tenant_by_id = { for t in var.tenants : t.id => t }

  app_tenant_pairs = flatten([
    for app in var.applications : [
      for tid in app.allowed_tenant_ids : {
        key       = "${app.id}--${tid}"
        app_id    = app.id
        tenant_id = tid
      }
    ]
  ])
  app_tenant_map = { for p in local.app_tenant_pairs : p.key => p }
}
