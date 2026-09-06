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
