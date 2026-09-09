resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db.result
}

resource "google_secret_manager_secret_iam_member" "runtime_reads_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# The planner deliberately has NO access to this secret: `terraform plan` runs on pull
# requests, and the plan does not need to read the password back.

# The Coframe Conversion API token for cofresso-web (src/lib/coframe reads COFRAME_API_TOKEN).
# Coframe issues it: a person mints it from the crobot task page in Jarvis, where it is shown
# once, and adds it here with `gcloud secrets versions add coframe-api-token --data-file=-`.
# Terraform therefore manages neither the value nor the secret's lifecycle, only read access
# for the runtime and the reference from the production service. Rotation is a new version.
data "google_secret_manager_secret" "coframe_api_token" {
  secret_id = "coframe-api-token"
}

resource "google_secret_manager_secret_iam_member" "runtime_reads_coframe_api_token" {
  secret_id = data.google_secret_manager_secret.coframe_api_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
