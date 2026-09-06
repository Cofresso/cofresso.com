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
