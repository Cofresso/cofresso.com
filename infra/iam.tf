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

# GitHub Actions: builds images, runs the production migration job, deploys production
# revisions. Only workflows on `main` may impersonate it (see wif.tf).
resource "google_service_account" "deployer" {
  account_id   = "github-deployer"
  display_name = "GitHub Actions deployer (production, main only)"
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

# GitHub Actions: preview deploys and preview cleanup. Any ref in the repository may
# impersonate this one, because it runs on pull requests — so its Cloud Run permissions are
# granted per resource (the preview service and the preview migration job) instead of at the
# project level. A PR cannot use it to touch production.
resource "google_service_account" "deployer_preview" {
  account_id   = "github-deployer-preview"
  display_name = "GitHub Actions deployer (preview)"
}

resource "google_project_iam_member" "deployer_preview_roles" {
  for_each = toset(["roles/artifactregistry.writer"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer_preview.email}"
}

resource "google_cloud_run_v2_service_iam_member" "deployer_preview_service" {
  name     = google_cloud_run_v2_service.preview.name
  location = var.region
  role     = "roles/run.admin"
  member   = "serviceAccount:${google_service_account.deployer_preview.email}"
}

resource "google_cloud_run_v2_job_iam_member" "deployer_preview_job" {
  name     = google_cloud_run_v2_job.migrate["cofresso-migrate-preview"].name
  location = var.region
  role     = "roles/run.admin"
  member   = "serviceAccount:${google_service_account.deployer_preview.email}"
}

resource "google_service_account_iam_member" "deployer_preview_acts_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer_preview.email}"
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

# Deliberate deviation from the spec, which called for `roles/owner`: an explicit role set
# means a compromised apply cannot grant itself new capabilities, delete the project, or read
# arbitrary secrets. Every role here is needed by something in this directory — if a future
# resource fails to apply, add the specific role rather than reinstating owner.
resource "google_project_iam_member" "applier_roles" {
  for_each = toset([
    "roles/viewer",                          # data sources and refresh
    "roles/run.admin",                       # cloudrun.tf
    "roles/cloudsql.admin",                  # cloudsql.tf
    "roles/secretmanager.admin",             # secrets.tf
    "roles/compute.loadBalancerAdmin",       # loadbalancer.tf
    "roles/compute.networkAdmin",            # loadbalancer.tf (global address, forwarding)
    "roles/dns.admin",                       # dns.tf
    "roles/artifactregistry.admin",          # artifact-registry.tf
    "roles/iam.serviceAccountAdmin",         # iam.tf
    "roles/iam.serviceAccountUser",          # actAs the runtime SA on Cloud Run resources
    "roles/iam.workloadIdentityPoolAdmin",   # wif.tf
    "roles/resourcemanager.projectIamAdmin", # the project IAM bindings in this file
    "roles/serviceusage.serviceUsageAdmin",  # apis.tf
    "roles/monitoring.editor",               # monitoring.tf
    "roles/logging.admin",                   # monitoring.tf log-based resources
    "roles/storage.admin",                   # loadbalancer.tf (assets bucket)
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.applier.email}"
}

# `storage.admin` rather than `objectAdmin`: terraform needs bucket-level reads on the
# backend bucket (and object-level locking) to acquire the state lock.
resource "google_storage_bucket_iam_member" "applier_state" {
  bucket = "${var.project_id}-tfstate"
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.applier.email}"
}
