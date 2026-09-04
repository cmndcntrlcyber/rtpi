output "bucket_name" {
  description = "R2 bucket name."
  value       = cloudflare_r2_bucket.releases.name
}
