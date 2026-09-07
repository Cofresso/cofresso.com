# Rolling back

1. Actions → **Rollback production** → Run workflow. Leave the revision blank to go to the previous revision, or paste a specific one from `gcloud run revisions list --service cofresso-web --region us-central1`.
2. The workflow shifts 100% traffic and checks `/api/health`.
3. Fix forward on `main`. A rollback pins traffic to the revision you picked, so a new
   revision does **not** get traffic just by being deployed — the `deploy-production` job
   moves it explicitly with `gcloud run services update-traffic cofresso-web --to-latest`
   right after `gcloud run deploy`. Terraform no longer touches traffic either: `traffic`
   is in the service's `lifecycle.ignore_changes`, so an `infra.yml` apply while you are
   rolled back will not shift traffic back to the latest revision.

Migrations are additive by convention. If a migration must be reverted, write a new migration; never edit an applied one.
