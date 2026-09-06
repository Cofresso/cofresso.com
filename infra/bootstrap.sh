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
