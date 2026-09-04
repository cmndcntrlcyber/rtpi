variable "cloudflare_account_id" {
  description = "Cloudflare account ID. Find at https://dash.cloudflare.com/<account_id>."
  type        = string
}

variable "tunnel_name" {
  description = "Tunnel name. Conventionally 'rtpi-{slug}' matching CF_TUNNEL_NAME in .env."
  type        = string
}

variable "slug" {
  description = "RTPI deployment slug (e.g. 'c3s'). Used to derive hostnames."
  type        = string
}

variable "domain" {
  description = "Root domain (e.g. 'onoiroi.us'). Used to derive hostnames."
  type        = string
}

variable "config_src" {
  description = "Where cloudflared reads its config: 'local' (config.yml on disk) or 'cloudflare' (API-managed)."
  type        = string
  default     = "cloudflare"

  validation {
    condition     = contains(["local", "cloudflare"], var.config_src)
    error_message = "config_src must be 'local' or 'cloudflare'."
  }
}

variable "ingress_rules" {
  description = "Ingress rules for the tunnel. Only used when config_src = 'cloudflare'."
  type = list(object({
    hostname        = string
    service         = string
    no_tls_verify   = optional(bool, false)
    connect_timeout = optional(string, "10s")
  }))
  default = []
}
