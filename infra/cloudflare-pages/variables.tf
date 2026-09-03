variable "cloudflare_account_id" {
  description = "Cloudflare account ID. Find at https://dash.cloudflare.com/<account_id>."
  type        = string
}

variable "project_name" {
  description = "Pages project name. Conventionally 'rtpi-{slug}' matching CF_PAGES_PROJECT in .env."
  type        = string
}

variable "production_branch" {
  description = "Git branch that triggers production deployments."
  type        = string
  default     = "production"
}

variable "custom_domain" {
  description = "Custom domain for the Pages project (e.g. 'c3s-admin.onoiroi.us'). Leave null to skip."
  type        = string
  default     = null
}
