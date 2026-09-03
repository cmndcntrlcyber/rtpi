###############################################################################
# RTPI Cloudflare Tunnel — auto-provisioning + optional API-managed ingress
#
# Two modes controlled by var.config_src:
#   "local"      — cloudflared reads ingress from config.yml on disk (build.sh path)
#   "cloudflare" — ingress rules managed here via cloudflare_tunnel_config (IaC path)
#
# Auth: set CLOUDFLARE_API_TOKEN env var to the value of CF_ACCOUNT_TOKEN
# (must have Account > Cloudflare Tunnel Edit permission).
###############################################################################

provider "cloudflare" {}

resource "random_id" "tunnel_secret" {
  byte_length = 32
}

resource "cloudflare_tunnel" "this" {
  account_id = var.cloudflare_account_id
  name       = var.tunnel_name
  secret     = random_id.tunnel_secret.b64_std
  config_src = var.config_src
}

resource "cloudflare_tunnel_config" "this" {
  count      = var.config_src == "cloudflare" ? 1 : 0
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_tunnel.this.id

  config {
    dynamic "ingress_rule" {
      for_each = var.ingress_rules
      content {
        hostname = ingress_rule.value.hostname
        service  = ingress_rule.value.service
        origin_request {
          no_tls_verify   = ingress_rule.value.no_tls_verify
          connect_timeout = ingress_rule.value.connect_timeout
        }
      }
    }

    ingress_rule {
      service = "http_status:404"
    }
  }
}
