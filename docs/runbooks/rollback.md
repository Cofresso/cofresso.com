# Rolling back

1. Actions → **Rollback production** → Run workflow. Leave the revision blank to go to the previous revision, or paste a specific one from `gcloud run revisions list --service cofresso-web --region us-central1`.
2. The workflow shifts 100% traffic and checks `/api/health`.
3. Fix forward on `main`. The next merge deploys normally and takes traffic again.

Migrations are additive by convention. If a migration must be reverted, write a new migration; never edit an applied one.
