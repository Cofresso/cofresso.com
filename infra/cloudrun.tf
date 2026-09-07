locals {
  # Cloud Run needs an image to create the service. CI replaces it on first deploy and
  # Terraform ignores the image afterwards.
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"
  sql_connection    = google_sql_database_instance.main.connection_name

  common_env = {
    NODE_ENV             = "production"
    DB_SOCKET_DIR        = "/cloudsql/${local.sql_connection}"
    DB_USER              = google_sql_user.app.name
    GOOGLE_CLOUD_PROJECT = var.project_id
  }
}

# ---------- Production ----------

resource "google_cloud_run_v2_service" "web" {
  name                = "cofresso-web"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.production_min_instances
      max_instance_count = 4
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [local.sql_connection]
      }
    }

    containers {
      image = local.placeholder_image

      ports {
        container_port = 8080
      }

      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      dynamic "env" {
        for_each = merge(local.common_env, {
          DB_NAME  = google_sql_database.production.name
          SITE_URL = "https://${var.domain}"
        })
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        tcp_socket {
          port = 8080
        }
        initial_delay_seconds = 0
        period_seconds        = 3
        failure_threshold     = 20
        timeout_seconds       = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].labels,
      template[0].annotations,
      # Traffic is owned by CI, not Terraform: `deploy-production` moves it to the latest
      # revision and the rollback workflow pins it to a named one. Without this an apply
      # during a rollback would silently shift traffic back to the broken revision.
      traffic,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.runtime_reads_db_password,
    google_project_iam_member.runtime_roles,
  ]
}

# ---------- Preview (PR deploys as tagged, zero-traffic revisions) ----------

resource "google_cloud_run_v2_service" "preview" {
  name                = "cofresso-web-preview"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [local.sql_connection]
      }
    }

    containers {
      image = local.placeholder_image

      ports {
        container_port = 8080
      }

      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      dynamic "env" {
        for_each = merge(local.common_env, {
          DB_NAME = google_sql_database.preview.name
          # Preview revisions have per-PR URLs; canonical links still point at production.
          SITE_URL = "https://${var.domain}"
        })
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        tcp_socket {
          port = 8080
        }
        period_seconds    = 3
        failure_threshold = 20
        timeout_seconds   = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].labels,
      template[0].annotations,
      traffic,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.runtime_reads_db_password,
    google_project_iam_member.runtime_roles,
  ]
}

# ---------- Migration jobs ----------

locals {
  jobs = {
    "cofresso-migrate"         = google_sql_database.production.name
    "cofresso-migrate-preview" = google_sql_database.preview.name
  }
}

resource "google_cloud_run_v2_job" "migrate" {
  for_each            = local.jobs
  name                = each.key
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.runtime.email
      max_retries     = 0
      timeout         = "600s"

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [local.sql_connection]
        }
      }

      containers {
        image   = local.placeholder_image
        command = ["node"]
        # `deploy` migrates and then runs the idempotent seed in one execution, so CI never
        # needs `gcloud run jobs execute --args=...` (broken in gcloud 548.x, which sends an
        # unknown `priorityTier` field and fails client-side).
        args = ["dist/db.mjs", "deploy"]

        resources {
          limits = { cpu = "1", memory = "512Mi" }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        dynamic "env" {
          for_each = merge(local.common_env, { DB_NAME = each.value })
          content {
            name  = env.key
            value = env.value
          }
        }

        env {
          name = "DB_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_password.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      template[0].labels,
      template[0].annotations,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.runtime_reads_db_password,
  ]
}

# Public, unauthenticated access to both services (the LB fronts production).
resource "google_cloud_run_v2_service_iam_member" "web_public" {
  name     = google_cloud_run_v2_service.web.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "preview_public" {
  name     = google_cloud_run_v2_service.preview.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
