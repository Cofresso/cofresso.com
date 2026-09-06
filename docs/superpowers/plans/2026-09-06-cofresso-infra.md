# Cofresso Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision the GCP infrastructure that hosts cofresso.com (Cloud Run, Cloud SQL, load balancer, DNS, Workload Identity Federation, monitoring) as Terraform, and get the first image serving.

**Architecture:** One new GCP project under the coframe.com org. A bootstrap script creates the project, billing link and Terraform state bucket; everything else is Terraform in `infra/`. Cloud Run services are created with a placeholder image and Terraform ignores image drift so CI owns deploys.

**Tech Stack:** Terraform ≥ 1.9 with the `google` provider ~> 7.0, gcloud CLI, Docker buildx (linux/amd64 images from an Apple Silicon Mac).

**Spec:** `docs/superpowers/specs/2026-09-06-cofresso-ecommerce-design.md` (section "Infrastructure")

## Global Constraints

- Project id `cofresso-prod` (fall back to `cofresso-web` if taken; update `backend.tf` and `terraform.tfvars` together).
- Region `us-central1` for everything regional.
- Org id `536072029322` (coframe.com). Billing account `01ECC9-2A99B8-CE9BCB` (Coframe).
- Cloud SQL Postgres 16, `db-f1-micro`, public IP with **no** authorized networks, `deletion_protection = true`.
- Cloud Run production: min 1 / max 4 instances, 1 vCPU, 512 MiB, startup CPU boost. Preview: min 0 / max 2.
- Service names: `cofresso-web`, `cofresso-web-preview`, jobs `cofresso-migrate`, `cofresso-migrate-preview`.
- Service accounts: `cofresso-web-runtime`, `github-deployer`, `terraform-planner`, `terraform-applier`.
- WIF pool `github`, provider `github-oidc`, attribute condition restricted to repository `cofresso/cofresso.com`.
- Domain `cofresso.com` + `www.cofresso.com` on a Google-managed certificate; Cloud DNS zone `cofresso-com`.
- Terraform state in GCS bucket `cofresso-prod-tfstate`, prefix `cofresso/prod`.
- Never run `terraform destroy`. Never disable deletion protection.

---

## File structure

```
infra/
  README.md          how to bootstrap, plan, apply
  bootstrap.sh       idempotent: project, billing, base APIs, state bucket
  versions.tf        terraform + provider constraints, GCS backend
  providers.tf
  variables.tf
  terraform.tfvars   non-secret values
  apis.tf
  artifact-registry.tf
  iam.tf             service accounts + project roles
  cloudsql.tf
  secrets.tf
  cloudrun.tf        services + jobs
  loadbalancer.tf
  dns.tf
  wif.tf
  monitoring.tf
  outputs.tf
```

---

### Task 1: Install Terraform and bootstrap the project

**Files:**

- Create: `infra/bootstrap.sh`, `infra/README.md`

- [ ] **Step 1: Install Terraform**

```bash
brew tap hashicorp/tap && brew install hashicorp/tap/terraform
terraform -version
```

Expected: `Terraform v1.1x.x` or newer.

- [ ] **Step 2: Bootstrap script**

`infra/bootstrap.sh`:

```bash
#!/usr/bin/env bash
# One-time project bootstrap. Idempotent. Everything after this is Terraform.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-cofresso-prod}"
PROJECT_NAME="${PROJECT_NAME:-Cofresso}"
ORG_ID="${ORG_ID:-536072029322}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-01ECC9-2A99B8-CE9BCB}"
REGION="${REGION:-us-central1}"
STATE_BUCKET="${STATE_BUCKET:-${PROJECT_ID}-tfstate}"

log() { printf '\n==> %s\n' "$*"; }

if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  log "Project $PROJECT_ID exists"
else
  log "Creating project $PROJECT_ID under org $ORG_ID"
  gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME" --organization="$ORG_ID"
fi

log "Linking billing account"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT" >/dev/null

log "Enabling bootstrap APIs"
gcloud services enable \
  cloudresourcemanager.googleapis.com serviceusage.googleapis.com iam.googleapis.com \
  storage.googleapis.com compute.googleapis.com cloudbilling.googleapis.com \
  --project "$PROJECT_ID"

if gcloud storage buckets describe "gs://$STATE_BUCKET" --project "$PROJECT_ID" >/dev/null 2>&1; then
  log "State bucket gs://$STATE_BUCKET exists"
else
  log "Creating state bucket gs://$STATE_BUCKET"
  gcloud storage buckets create "gs://$STATE_BUCKET" \
    --project "$PROJECT_ID" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention
  gcloud storage buckets update "gs://$STATE_BUCKET" --versioning
fi

log "Done. Project number: $(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
echo "Next: cd infra && terraform init && terraform plan"
```

`chmod +x infra/bootstrap.sh`.

- [ ] **Step 3: Run it**

```bash
cd infra && ./bootstrap.sh
```

Expected: project created (or exists), billing linked, bucket created. If `gcloud projects create` fails with "project id already exists", rerun with `PROJECT_ID=cofresso-web ./bootstrap.sh` and use that id everywhere below.

- [ ] **Step 4: README**

`infra/README.md`:

````markdown
# Infrastructure

Terraform for cofresso.com on GCP. State lives in `gs://cofresso-prod-tfstate`.

## First time

```bash
./bootstrap.sh            # creates project, billing link, state bucket (idempotent)
terraform init
terraform plan
terraform apply
```
````

## Day to day

Changes under `infra/` get a plan comment on the PR and apply automatically on merge to `main` (see `.github/workflows/infra.yml`). Local `terraform plan` is fine; prefer letting CI apply.

## What is here

Cloud Run (`cofresso-web`, `cofresso-web-preview`, migration jobs), Cloud SQL Postgres 16, Artifact Registry, global HTTPS load balancer with Cloud CDN and a managed certificate, Cloud DNS zone, Workload Identity Federation for GitHub Actions, an uptime check and alert policy.

Container images and the deployed revision are managed by CI, not Terraform (`ignore_changes` on the image).

## Outputs you will need

`terraform output` prints the nameservers to paste into the registrar, the load balancer IP, Cloud Run URLs, the WIF provider resource name and service account emails used by GitHub Actions.

````

- [ ] **Step 5: Commit**

```bash
git add infra && git commit -m "infra: add GCP bootstrap script and infra README"
````

---

### Task 2: Terraform foundation: versions, providers, variables, APIs, Artifact Registry, IAM

**Files:**

- Create: `infra/versions.tf`, `infra/providers.tf`, `infra/variables.tf`, `infra/terraform.tfvars`, `infra/apis.tf`, `infra/artifact-registry.tf`, `infra/iam.tf`

- [ ] **Step 1: Write the files**

`infra/versions.tf`:

```hcl
terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "gcs" {
    bucket = "cofresso-prod-tfstate"
    prefix = "cofresso/prod"
  }
}
```

`infra/providers.tf`:

```hcl
provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_project" "this" {
  project_id = var.project_id
}
```

`infra/variables.tf`:

```hcl
variable "project_id" {
  type        = string
  description = "GCP project id"
}

variable "region" {
  type        = string
  description = "Region for regional resources"
  default     = "us-central1"
}

variable "domain" {
  type        = string
  description = "Apex domain served by the load balancer"
  default     = "cofresso.com"
}

variable "github_repository" {
  type        = string
  description = "owner/repo allowed to assume the deploy service accounts"
  default     = "cofresso/cofresso.com"
}

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "production_min_instances" {
  type    = number
  default = 1
}

variable "alert_email" {
  type        = string
  description = "Email for uptime alerts. Empty disables the notification channel."
  default     = ""
}
```

`infra/terraform.tfvars`:

```hcl
project_id        = "cofresso-prod"
region            = "us-central1"
domain            = "cofresso.com"
github_repository = "cofresso/cofresso.com"
```

`infra/apis.tf`:

```hcl
locals {
  services = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "dns.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each           = toset(local.services)
  service            = each.value
  disable_on_destroy = false
}
```

`infra/artifact-registry.tf`:

```hcl
resource "google_artifact_registry_repository" "web" {
  location      = var.region
  repository_id = "web"
  description   = "Cofresso web container images"
  format        = "DOCKER"

  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-recent-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 30
    }
  }

  cleanup_policies {
    id     = "delete-untagged-after-30d"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "2592000s"
    }
  }

  depends_on = [google_project_service.apis]
}
```

`infra/iam.tf`:

```hcl
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
```

- [ ] **Step 2: Init, validate, apply this slice**

```bash
cd infra
terraform init
terraform fmt -recursive
terraform validate
terraform apply -target=google_project_service.apis -auto-approve
terraform apply -auto-approve
```

Expected: APIs enabled, repository and four service accounts created. Enabling APIs can take a couple of minutes; if a later resource fails with "API not enabled", wait 60 seconds and re-run `terraform apply`.

- [ ] **Step 3: Commit**

```bash
git add infra && git commit -m "infra: add Terraform foundation with APIs, Artifact Registry and service accounts"
```

---

### Task 3: Cloud SQL and secrets

**Files:**

- Create: `infra/cloudsql.tf`, `infra/secrets.tf`

- [ ] **Step 1: Write the files**

`infra/cloudsql.tf`:

```hcl
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
```

`infra/secrets.tf`:

```hcl
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

resource "google_secret_manager_secret_iam_member" "planner_reads_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.planner.email}"
}
```

- [ ] **Step 2: Apply**

```bash
terraform fmt -recursive && terraform validate && terraform apply -auto-approve
```

Expected: instance creation takes 5–10 minutes. Afterwards `gcloud sql instances describe cofresso-pg --project cofresso-prod --format='value(connectionName)'` prints `cofresso-prod:us-central1:cofresso-pg`.

- [ ] **Step 3: Commit**

```bash
git add infra && git commit -m "infra: add Cloud SQL Postgres 16 instance, databases, user and Secret Manager password"
```

---

### Task 4: Cloud Run services and migration jobs

**Files:**

- Create: `infra/cloudrun.tf`

- [ ] **Step 1: Write the file**

`infra/cloudrun.tf`:

```hcl
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
        args    = ["dist/db.mjs", "migrate"]

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
```

- [ ] **Step 2: Apply**

```bash
terraform fmt -recursive && terraform validate && terraform apply -auto-approve
```

Expected: two services (serving the hello placeholder) and two jobs. `gcloud run services list --project cofresso-prod` shows both URLs. If the org policy `iam.allowedPolicyMemberDomains` blocks `allUsers`, note it and continue; the LB path still needs public invoker, so ask the org admin to exempt the project.

- [ ] **Step 3: Commit**

```bash
git add infra && git commit -m "infra: add Cloud Run services and migration jobs with placeholder images"
```

---

### Task 5: Load balancer, certificate and DNS

**Files:**

- Create: `infra/loadbalancer.tf`, `infra/dns.tf`

- [ ] **Step 1: Write the files**

`infra/loadbalancer.tf`:

```hcl
resource "google_compute_global_address" "lb" {
  name = "cofresso-lb-ip"
}

resource "google_compute_region_network_endpoint_group" "web" {
  name                  = "cofresso-web-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.web.name
  }
}

resource "google_compute_backend_service" "web" {
  name                  = "cofresso-web-backend"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  enable_cdn            = true

  backend {
    group = google_compute_region_network_endpoint_group.web.id
  }

  cdn_policy {
    cache_mode        = "USE_ORIGIN_HEADERS"
    serve_while_stale = 86400
  }

  custom_response_headers = ["X-Cache-Status: {cdn_cache_status}"]

  log_config {
    enable      = true
    sample_rate = 0.5
  }
}

resource "google_compute_url_map" "https" {
  name            = "cofresso-https"
  default_service = google_compute_backend_service.web.id
}

resource "google_compute_managed_ssl_certificate" "web" {
  name = "cofresso-cert"

  managed {
    domains = [var.domain, "www.${var.domain}"]
  }
}

resource "google_compute_target_https_proxy" "web" {
  name             = "cofresso-https-proxy"
  url_map          = google_compute_url_map.https.id
  ssl_certificates = [google_compute_managed_ssl_certificate.web.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "cofresso-https-rule"
  ip_address            = google_compute_global_address.lb.address
  ip_protocol           = "TCP"
  port_range            = "443"
  target                = google_compute_target_https_proxy.web.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# HTTP -> HTTPS
resource "google_compute_url_map" "http_redirect" {
  name = "cofresso-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "cofresso-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "cofresso-http-rule"
  ip_address            = google_compute_global_address.lb.address
  ip_protocol           = "TCP"
  port_range            = "80"
  target                = google_compute_target_http_proxy.redirect.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
```

`infra/dns.tf`:

```hcl
resource "google_dns_managed_zone" "root" {
  name        = "cofresso-com"
  dns_name    = "${var.domain}."
  description = "cofresso.com public zone"

  dnssec_config {
    state = "off"
  }

  depends_on = [google_project_service.apis]
}

resource "google_dns_record_set" "apex" {
  name         = google_dns_managed_zone.root.dns_name
  managed_zone = google_dns_managed_zone.root.name
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.lb.address]
}

resource "google_dns_record_set" "www" {
  name         = "www.${google_dns_managed_zone.root.dns_name}"
  managed_zone = google_dns_managed_zone.root.name
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.lb.address]
}
```

- [ ] **Step 2: Apply and record the nameservers**

```bash
terraform fmt -recursive && terraform validate && terraform apply -auto-approve
gcloud dns managed-zones describe cofresso-com --project cofresso-prod --format='value(nameServers)'
```

Expected: four `ns-cloud-*.googledomains.com.` nameservers. The certificate will show `PROVISIONING` until DNS points at the LB; that is expected.

- [ ] **Step 3: Commit**

```bash
git add infra && git commit -m "infra: add global HTTPS load balancer with CDN, managed certificate and Cloud DNS zone"
```

---

### Task 6: Workload Identity Federation, monitoring and outputs

**Files:**

- Create: `infra/wif.tf`, `infra/monitoring.tf`, `infra/outputs.tf`

- [ ] **Step 1: Write the files**

`infra/wif.tf`:

```hcl
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
  depends_on                = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor"            = "assertion.actor"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
    "attribute.ref"              = "assertion.ref"
  }

  # Only this repository can exchange tokens at all.
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

locals {
  wif_pool = google_iam_workload_identity_pool.github.name
}

# Any workflow in the repo may deploy or plan.
resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${local.wif_pool}/attribute.repository/${var.github_repository}"
}

resource "google_service_account_iam_member" "planner_wif" {
  service_account_id = google_service_account.planner.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${local.wif_pool}/attribute.repository/${var.github_repository}"
}

# Only workflows running on main may apply infrastructure.
resource "google_service_account_iam_member" "applier_wif" {
  service_account_id = google_service_account.applier.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${local.wif_pool}/attribute.ref/refs/heads/main"
}
```

`infra/monitoring.tf`:

```hcl
resource "google_monitoring_uptime_check_config" "health" {
  display_name = "cofresso.com /api/health"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_monitoring_notification_channel" "email" {
  count        = var.alert_email != "" ? 1 : 0
  display_name = "Cofresso alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_alert_policy" "uptime" {
  display_name = "cofresso.com is down"
  combiner     = "OR"

  conditions {
    display_name = "Health check failing from 2+ regions"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.health.uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "300s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.*"]
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = google_monitoring_notification_channel.email[*].id

  documentation {
    content = "The production health endpoint is failing. Check Cloud Run logs for cofresso-web and Cloud SQL status. Runbook: docs/runbooks/rollback.md"
  }
}
```

`infra/outputs.tf`:

```hcl
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
```

- [ ] **Step 2: Apply and capture outputs**

```bash
terraform fmt -recursive && terraform validate && terraform apply -auto-approve
terraform output
```

Expected: `wif_provider` looks like `projects/<number>/locations/global/workloadIdentityPools/github/providers/github-oidc`.

- [ ] **Step 3: Commit**

```bash
git add infra && git commit -m "infra: add Workload Identity Federation for GitHub, uptime monitoring and outputs"
```

---

### Task 7: First image, migrations, seed and manual deploy

No new files. This proves the platform before CI takes over.

- [ ] **Step 1: Build and push a linux/amd64 image**

```bash
cd /Users/joshpayne/cofresso.com
REGISTRY=$(cd infra && terraform output -raw artifact_registry)
SHA=$(git rev-parse --short HEAD)
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker buildx build --platform linux/amd64 --build-arg GIT_SHA=$SHA -t $REGISTRY/web:sha-$SHA -t $REGISTRY/web:latest --push .
```

- [ ] **Step 2: Run migrations and seed against production and preview**

```bash
for JOB in cofresso-migrate cofresso-migrate-preview; do
  gcloud run jobs update $JOB --image $REGISTRY/web:sha-$SHA --region us-central1 --project cofresso-prod
  gcloud run jobs execute $JOB --region us-central1 --project cofresso-prod --wait
  gcloud run jobs execute $JOB --region us-central1 --project cofresso-prod --wait --args="dist/db.mjs,seed"
done
```

Expected: four successful executions. Check logs with `gcloud logging read 'resource.type="cloud_run_job"' --limit 20 --project cofresso-prod` if any fail.

- [ ] **Step 3: Deploy both services**

```bash
gcloud run deploy cofresso-web --image $REGISTRY/web:sha-$SHA --region us-central1 --project cofresso-prod --quiet
gcloud run deploy cofresso-web-preview --image $REGISTRY/web:sha-$SHA --region us-central1 --project cofresso-prod --quiet
WEB_URL=$(cd infra && terraform output -raw web_url)
curl -s $WEB_URL/api/health
curl -s -o /dev/null -w "%{http_code}\n" $WEB_URL/products/morning-frame
LB_IP=$(cd infra && terraform output -raw load_balancer_ip)
curl -sk --resolve cofresso.com:443:$LB_IP https://cofresso.com/api/health
```

Expected: health `{"status":"ok","db":"up",...}` from the run.app URL; product page 200; the LB request returns the same JSON (with `-k` because the cert is not yet issued).

- [ ] **Step 4: Hand the nameservers to the domain owner**

Print `terraform output name_servers` and tell the owner to replace the Namecheap nameservers with those four. Certificate provisioning completes 15–60 minutes after propagation. Check with:

```bash
gcloud compute ssl-certificates describe cofresso-cert --global --project cofresso-prod --format='value(managed.status,managed.domainStatus)'
```
