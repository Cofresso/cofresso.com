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
    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = true
    }
  }

  custom_response_headers = ["X-Cache-Status: {cdn_cache_status}"]

  log_config {
    enable      = true
    sample_rate = 0.5
  }
}

resource "google_compute_url_map" "https" {
  name = "cofresso-https"

  # Requests that do not match a host rule (health probes by IP, for example)
  # still reach Cloud Run.
  default_service = google_compute_backend_service.web.id

  host_rule {
    hosts        = [var.domain, "www.${var.domain}"]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.web.id

    path_rule {
      paths   = ["/assets/*"]
      service = google_compute_backend_bucket.assets.id
    }
  }
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

# ---------------------------------------------------------------------------
# Static assets (generated product photography), served at /assets/* by the
# same load balancer that fronts Cloud Run. Objects are content-addressed
# (<name>-<sha8>.webp) and uploaded with an immutable Cache-Control, so the
# CDN may hold them for a year.
# ---------------------------------------------------------------------------

resource "google_storage_bucket" "assets" {
  name          = "${var.project_id}-assets"
  location      = upper(var.region)
  storage_class = "STANDARD"

  # A backend bucket needs objects readable by allUsers, so object ACLs stay
  # off and access is granted once, at the bucket level, in the IAM member
  # below. "inherited" keeps the (absent) org-level public access prevention.
  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  # Content addressing makes overwrites impossible in practice; versioning
  # would only pay for bytes nobody can reach.
  versioning {
    enabled = false
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  labels = {
    app  = "cofresso"
    role = "assets"
  }
}

resource "google_storage_bucket_iam_member" "assets_public" {
  bucket = google_storage_bucket.assets.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_compute_backend_bucket" "assets" {
  name        = "cofresso-assets-backend"
  description = "Generated product imagery, served at https://${var.domain}/assets/*"
  bucket_name = google_storage_bucket.assets.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 86400
    max_ttl           = 31536000
    client_ttl        = 86400
    negative_caching  = true
    serve_while_stale = 86400
  }
}
