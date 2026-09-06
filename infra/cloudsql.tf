resource "random_password" "db" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "main" {
  name                = "cofresso-pg"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = true

  settings {
    tier              = var.db_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10
    disk_autoresize   = true

    backup_configuration {
      enabled    = true
      start_time = "07:00"
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
      # No authorized networks: access only via the Cloud SQL connector / Auth Proxy.
    }

    maintenance_window {
      day  = 7
      hour = 8
    }

    database_flags {
      name  = "max_connections"
      value = "60"
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_sql_database" "production" {
  name     = "cofresso"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_database" "preview" {
  name     = "cofresso_preview"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "cofresso"
  instance = google_sql_database_instance.main.name
  password = random_password.db.result
}
