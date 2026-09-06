output "project_number" {
  value = data.google_project.this.number
}

output "name_servers" {
  description = "Set these at the registrar for cofresso.com"
  value       = google_dns_managed_zone.root.name_servers
}

output "load_balancer_ip" {
  value = google_compute_global_address.lb.address
}

output "web_url" {
  value = google_cloud_run_v2_service.web.uri
}

output "preview_url" {
  value = google_cloud_run_v2_service.preview.uri
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.web.repository_id}"
}

output "sql_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "wif_provider" {
  description = "Full resource name for google-github-actions/auth"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  value = google_service_account.deployer.email
}

output "planner_service_account" {
  value = google_service_account.planner.email
}

output "applier_service_account" {
  value = google_service_account.applier.email
}
