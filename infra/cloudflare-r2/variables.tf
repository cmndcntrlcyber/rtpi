variable "cloudflare_account_id" {
  description = "Cloudflare account ID. Find at https://dash.cloudflare.com/<account_id>."
  type        = string
}

variable "bucket_name" {
  description = "R2 bucket name. Conventionally 'rtpi-releases-{slug}' matching CF_R2_RELEASES_BUCKET in .env."
  type        = string
}

variable "location" {
  description = "R2 bucket location hint (e.g. 'WNAM', 'ENAM', 'WEUR', 'EEUR', 'APAC')."
  type        = string
  default     = "WNAM"
}
