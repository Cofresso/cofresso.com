# Runtime identity for Cloud Run services and jobs.
resource "google_service_account" "runtime" {
  account_id   = "cofresso-web-runtime"
  display_name = "Cofresso web runtime"
}

resource "google_project_iam_member" "runtime_roles" {
  for_each = toset(["roles/cloudsql.client", "roles/logging.logWriter", "roles/monitoring.metricWriter", "roles/cloudtrace.agent"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.runtime.email}"
}

# GitHub Actions: builds images, runs migration jobs, deploys revisions.
resource "google_service_account" "deployer" {
  account_id   = "github-deployer"
  display_name = "GitHub Actions deployer"
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset(["roles/run.admin", "roles/artifactregistry.writer", "roles/run.viewer"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "deployer_acts_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# GitHub Actions: terraform plan on pull requests (read only).
resource "google_service_account" "planner" {
  account_id   = "terraform-planner"
  display_name = "Terraform planner (PRs)"
}

resource "google_project_iam_member" "planner_roles" {
  for_each = toset(["roles/viewer", "roles/iam.securityReviewer"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.planner.email}"
}

resource "google_storage_bucket_iam_member" "planner_state" {
  bucket = "${var.project_id}-tfstate"
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.planner.email}"
}

# GitHub Actions: terraform apply on main.
resource "google_service_account" "applier" {
  account_id   = "terraform-applier"
  display_name = "Terraform applier (main)"
}

resource "google_project_iam_member" "applier_owner" {
  project = var.project_id
  role    = "roles/owner"
  member  = "serviceAccount:${google_service_account.applier.email}"
}

resource "google_storage_bucket_iam_member" "applier_state" {
  bucket = "${var.project_id}-tfstate"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.applier.email}"
}
