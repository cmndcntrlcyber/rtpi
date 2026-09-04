output "project_name" {
  description = "Pages project name."
  value       = cloudflare_pages_project.this.name
}

output "subdomain" {
  description = "Default .pages.dev subdomain for the project."
  value       = cloudflare_pages_project.this.subdomain
}
