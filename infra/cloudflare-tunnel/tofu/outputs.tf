output "tunnel_id" {
  description = "Cloudflare Tunnel UUID."
  value       = cloudflare_tunnel.this.id
}

output "tunnel_token" {
  description = "Connector token for 'cloudflared tunnel run --token'. Write to CF_TUNNEL_TOKEN in .env."
  value       = cloudflare_tunnel.this.tunnel_token
  sensitive   = true
}

output "tunnel_cname" {
  description = "CNAME target for DNS records pointing to this tunnel."
  value       = cloudflare_tunnel.this.cname
}
