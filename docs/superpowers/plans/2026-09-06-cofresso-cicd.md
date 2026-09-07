# Cofresso CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Actions pipelines that check every PR, deploy PR previews to Cloud Run, deploy `main` to production, plan/apply Terraform, scan code, and the repository hygiene around them.

**Architecture:** One `ci.yml` with parallel check jobs feeding `deploy-preview` (PRs) and `deploy-production` (main). Auth to GCP is Workload Identity Federation only; repository variables hold non-secret ids. Separate workflows handle preview cleanup, rollback, infra and CodeQL.

**Tech Stack:** GitHub Actions, google-github-actions/auth@v2, docker/build-push-action@v6, hashicorp/setup-terraform@v3, treosh/lighthouse-ci-action@v12, marocchino/sticky-pull-request-comment@v2, amannn/action-semantic-pull-request@v5, github/codeql-action@v3, Dependabot.

**Spec:** `docs/superpowers/specs/2026-09-06-cofresso-ecommerce-design.md` (section "CI/CD")

## Global Constraints

- No repository secrets are required. Non-secret configuration lives in repository variables: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOYER_SA`, `GCP_PLANNER_SA`, `GCP_APPLIER_SA`, `GCP_ARTIFACT_REPO`, `PRODUCTION_URL`.
- Required status checks on `main`: `lint`, `typecheck`, `unit`, `integration`, `build`, `e2e`. Job ids must stay exactly these names.
- Preview deploys only for PRs from this repository (not forks) and never receive traffic on the default URL.
- Production deploys only from `main` via the `production` environment; Terraform applies only from `main` via the `infrastructure` environment.
- Conventional Commits PR titles. Squash merges only.
- Image tags: previews `pr-<number>-<short sha>`, production `sha-<short sha>` and `latest`.

---

## File structure

```
.github/
  actions/setup/action.yml           composite: pnpm + node + install
  workflows/ci.yml                   checks + deploy-preview + deploy-production
  workflows/preview-cleanup.yml      remove pr-<n> tag when a PR closes
  workflows/rollback.yml             manual traffic shift
  workflows/infra.yml                terraform fmt/validate/plan/apply
  workflows/codeql.yml
  workflows/pr-title.yml
  dependabot.yml
  CODEOWNERS
  pull_request_template.md
  ISSUE_TEMPLATE/bug_report.yml
  ISSUE_TEMPLATE/feature_request.yml
  ISSUE_TEMPLATE/config.yml
lighthouserc.json
docs/github-setup.md
docs/runbooks/deploy.md
docs/runbooks/rollback.md
docs/runbooks/database.md
```

---

### Task 1: Repository hygiene and variables

**Files:**

- Create: `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/*`, `.github/dependabot.yml`, `.github/workflows/pr-title.yml`

- [ ] **Step 1: Set repository variables from Terraform outputs**

```bash
cd infra
gh variable set GCP_PROJECT_ID --repo cofresso/cofresso.com --body "cofresso-prod"
gh variable set GCP_REGION --repo cofresso/cofresso.com --body "us-central1"
gh variable set GCP_WIF_PROVIDER --repo cofresso/cofresso.com --body "$(terraform output -raw wif_provider)"
gh variable set GCP_DEPLOYER_SA --repo cofresso/cofresso.com --body "$(terraform output -raw deployer_service_account)"
gh variable set GCP_PLANNER_SA --repo cofresso/cofresso.com --body "$(terraform output -raw planner_service_account)"
gh variable set GCP_APPLIER_SA --repo cofresso/cofresso.com --body "$(terraform output -raw applier_service_account)"
gh variable set GCP_ARTIFACT_REPO --repo cofresso/cofresso.com --body "$(terraform output -raw artifact_registry)"
gh variable set PRODUCTION_URL --repo cofresso/cofresso.com --body "$(terraform output -raw web_url)"
gh variable list --repo cofresso/cofresso.com
```

`PRODUCTION_URL` starts as the run.app URL and is switched to `https://cofresso.com` once DNS is live.

- [ ] **Step 2: Hygiene files**

`.github/CODEOWNERS`:

```
# Default owners for everything
*                 @joshpxyne
/infra/           @joshpxyne
/.github/         @joshpxyne
/drizzle/         @joshpxyne
```

`.github/pull_request_template.md`:

```markdown
## What

<!-- One or two sentences. Link the issue if there is one. -->

## Why

## How to verify

- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally
- [ ] Preview URL checked (posted by CI)
- [ ] Schema change includes a migration in `drizzle/` (or n/a)
- [ ] Infra change includes the Terraform plan review (or n/a)
```

`.github/ISSUE_TEMPLATE/bug_report.yml`:

```yaml
name: Bug report
description: Something on cofresso.com is broken
labels: [bug]
body:
  - type: input
    id: url
    attributes:
      label: URL
      placeholder: https://cofresso.com/products/morning-frame
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected vs actual
    validations:
      required: true
  - type: input
    id: order
    attributes:
      label: Order number (if relevant)
      placeholder: CF-10001
```

`.github/ISSUE_TEMPLATE/feature_request.yml`:

```yaml
name: Feature request
description: Propose a change to the storefront
labels: [enhancement]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposal
    validations:
      required: true
  - type: textarea
    id: success
    attributes:
      label: How we will know it worked
```

`.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
```

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    groups:
      next:
        patterns:
          ['next', 'react', 'react-dom', '@types/react', '@types/react-dom', 'eslint-config-next']
      drizzle:
        patterns: ['drizzle-*']
      testing:
        patterns: ['vitest', '@vitest/*', '@playwright/test', '@testing-library/*', 'jsdom']
      lint:
        patterns: ['eslint*', 'prettier*', '@typescript-eslint/*', 'typescript']
      minor-and-patch:
        update-types: [minor, patch]
    commit-message:
      prefix: 'chore(deps)'
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: 'ci'
  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: 'build'
  - package-ecosystem: terraform
    directory: /infra
    schedule:
      interval: weekly
    commit-message:
      prefix: 'infra'
```

`.github/workflows/pr-title.yml`:

```yaml
name: PR title

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

permissions:
  pull-requests: read

jobs:
  lint:
    name: Conventional Commits title
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            chore
            docs
            test
            refactor
            perf
            build
            ci
            infra
            revert
          requireScope: false
          subjectPattern: ^(?![A-Z]).+$
          subjectPatternError: Start the subject with a lowercase letter.
```

- [ ] **Step 3: Commit**

```bash
git add .github && git commit -m "ci: add CODEOWNERS, PR and issue templates, Dependabot and PR title lint"
```

---

### Task 2: CI checks workflow

**Files:**

- Create: `.github/actions/setup/action.yml`, `.github/workflows/ci.yml` (checks only; deploy jobs added in Tasks 3 and 4)

- [ ] **Step 1: Composite setup action**

`.github/actions/setup/action.yml`:

```yaml
name: Setup Node and pnpm
description: Installs pnpm (from packageManager), Node 22 with pnpm cache, and dependencies.
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version-file: .nvmrc
        cache: pnpm
    - shell: bash
      run: pnpm install --frozen-lockfile
```

- [ ] **Step 2: `ci.yml` with the six check jobs**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read

env:
  TEST_DATABASE_URL: postgres://cofresso:cofresso@localhost:5432/cofresso_test
  DATABASE_URL: postgres://cofresso:cofresso@localhost:5432/cofresso_test

jobs:
  lint:
    name: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm lint

  typecheck:
    name: typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm typecheck

  unit:
    name: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm test:unit --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage
          retention-days: 7

  integration:
    name: integration
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: cofresso
          POSTGRES_PASSWORD: cofresso
          POSTGRES_DB: cofresso_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U cofresso"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm test:integration

  build:
    name: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - uses: actions/cache@v4
        with:
          path: .next/cache
          key: next-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('src/**') }}
          restore-keys: next-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
      - run: pnpm build

  e2e:
    name: e2e
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: cofresso
          POSTGRES_PASSWORD: cofresso
          POSTGRES_DB: cofresso_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U cofresso"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - name: Playwright version
        id: pw
        run: echo "version=$(pnpm ls @playwright/test --json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d)[0].devDependencies["@playwright/test"].version))')" >> "$GITHUB_OUTPUT"
      - uses: actions/cache@v4
        id: pw-cache
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ steps.pw.outputs.version }}
      - run: pnpm exec playwright install --with-deps chromium
        if: steps.pw-cache.outputs.cache-hit != 'true'
      - run: pnpm exec playwright install-deps chromium
        if: steps.pw-cache.outputs.cache-hit == 'true'
      - run: pnpm build
      - run: pnpm test:e2e
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7
```

- [ ] **Step 3: Validate locally with actionlint (optional) and commit**

```bash
brew install actionlint 2>/dev/null || true
actionlint .github/workflows/*.yml || true
git add .github && git commit -m "ci: add lint, typecheck, unit, integration, build and e2e checks"
```

---

### Task 3: Preview deploys, preview cleanup, Lighthouse

**Files:**

- Modify: `.github/workflows/ci.yml` (add `deploy-preview`)
- Create: `.github/workflows/preview-cleanup.yml`, `lighthouserc.json`

- [ ] **Step 1: Lighthouse config**

`lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 1,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.8 }],
        "categories:accessibility": ["warn", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "categories:seo": ["warn", { "minScore": 0.9 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
  }
}
```

- [ ] **Step 2: Append `deploy-preview` to `ci.yml`**

Add under `jobs:`:

```yaml
deploy-preview:
  name: deploy-preview
  if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
  needs: [lint, typecheck, unit, integration, build, e2e]
  runs-on: ubuntu-latest
  timeout-minutes: 25
  permissions:
    contents: read
    id-token: write
    pull-requests: write
  environment:
    name: preview
    url: ${{ steps.url.outputs.preview_url }}
  env:
    PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
    REGION: ${{ vars.GCP_REGION }}
    REPO: ${{ vars.GCP_ARTIFACT_REPO }}
    TAG: pr-${{ github.event.pull_request.number }}
  steps:
    - uses: actions/checkout@v4

    - id: meta
      run: |
        SHORT=$(git rev-parse --short "${{ github.event.pull_request.head.sha }}")
        echo "short_sha=$SHORT" >> "$GITHUB_OUTPUT"
        echo "image=$REPO/web:${TAG}-${SHORT}" >> "$GITHUB_OUTPUT"

    - id: auth
      uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
        service_account: ${{ vars.GCP_DEPLOYER_SA }}
        token_format: access_token

    - uses: google-github-actions/setup-gcloud@v2

    - uses: docker/login-action@v3
      with:
        registry: ${{ vars.GCP_REGION }}-docker.pkg.dev
        username: oauth2accesstoken
        password: ${{ steps.auth.outputs.access_token }}

    - uses: docker/setup-buildx-action@v3

    - uses: docker/build-push-action@v6
      with:
        context: .
        push: true
        platforms: linux/amd64
        tags: ${{ steps.meta.outputs.image }}
        build-args: GIT_SHA=${{ steps.meta.outputs.short_sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        provenance: false

    - name: Migrate and seed preview database
      run: |
        gcloud run jobs update cofresso-migrate-preview --image "${{ steps.meta.outputs.image }}" --region "$REGION" --project "$PROJECT_ID" --quiet
        gcloud run jobs execute cofresso-migrate-preview --region "$REGION" --project "$PROJECT_ID" --wait
        gcloud run jobs execute cofresso-migrate-preview --region "$REGION" --project "$PROJECT_ID" --wait --args="dist/db.mjs,seed"

    - name: Deploy tagged revision (no traffic)
      run: |
        gcloud run deploy cofresso-web-preview \
          --image "${{ steps.meta.outputs.image }}" \
          --region "$REGION" --project "$PROJECT_ID" \
          --no-traffic --tag "$TAG" --quiet

    - id: url
      run: |
        URL=$(gcloud run services describe cofresso-web-preview --region "$REGION" --project "$PROJECT_ID" --format json \
          | jq -r --arg tag "$TAG" '.status.traffic[] | select(.tag == $tag) | .url')
        echo "preview_url=$URL" >> "$GITHUB_OUTPUT"
        echo "Preview: $URL"

    - name: Smoke test
      run: |
        for i in $(seq 1 12); do
          if curl -fsS "${{ steps.url.outputs.preview_url }}/api/health" | tee /tmp/health.json | grep -q '"db":"up"'; then exit 0; fi
          sleep 5
        done
        echo "Health check failed"; cat /tmp/health.json || true; exit 1

    - uses: marocchino/sticky-pull-request-comment@v2
      with:
        header: preview
        message: |
          ### 🚀 Preview deployed

          | | |
          | --- | --- |
          | URL | ${{ steps.url.outputs.preview_url }} |
          | Image | `${{ steps.meta.outputs.image }}` |
          | Commit | `${{ steps.meta.outputs.short_sha }}` |

          Zero-traffic revision on `cofresso-web-preview`, tagged `${{ env.TAG }}`. Uses the shared preview database. Lighthouse results are attached as a workflow artifact.

    - name: Lighthouse
      uses: treosh/lighthouse-ci-action@v12
      continue-on-error: true
      with:
        urls: |
          ${{ steps.url.outputs.preview_url }}/
          ${{ steps.url.outputs.preview_url }}/products/morning-frame
          ${{ steps.url.outputs.preview_url }}/cart
        configPath: ./lighthouserc.json
        uploadArtifacts: true
        temporaryPublicStorage: false
```

- [ ] **Step 3: Cleanup workflow**

`.github/workflows/preview-cleanup.yml`:

```yaml
name: Preview cleanup

on:
  pull_request:
    types: [closed]

permissions:
  contents: read
  id-token: write

jobs:
  cleanup:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOYER_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - name: Remove preview tag
        run: |
          gcloud run services update-traffic cofresso-web-preview \
            --region "${{ vars.GCP_REGION }}" --project "${{ vars.GCP_PROJECT_ID }}" \
            --remove-tags "pr-${{ github.event.pull_request.number }}" --quiet || echo "Tag already gone"
```

- [ ] **Step 4: Commit**

```bash
git add .github lighthouserc.json && git commit -m "ci: deploy PR previews to Cloud Run with sticky comment, smoke test and Lighthouse"
```

---

### Task 4: Production deploy and rollback

**Files:**

- Modify: `.github/workflows/ci.yml` (add `deploy-production`)
- Create: `.github/workflows/rollback.yml`, `docs/runbooks/deploy.md`, `docs/runbooks/rollback.md`, `docs/runbooks/database.md`

- [ ] **Step 1: Append `deploy-production` to `ci.yml`**

```yaml
deploy-production:
  name: deploy-production
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  needs: [lint, typecheck, unit, integration, build, e2e]
  runs-on: ubuntu-latest
  timeout-minutes: 25
  permissions:
    contents: read
    id-token: write
    deployments: write
  environment:
    name: production
    url: ${{ vars.PRODUCTION_URL }}
  concurrency:
    group: deploy-production
    cancel-in-progress: false
  env:
    PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
    REGION: ${{ vars.GCP_REGION }}
    REPO: ${{ vars.GCP_ARTIFACT_REPO }}
  steps:
    - uses: actions/checkout@v4

    - id: meta
      run: |
        SHORT=$(git rev-parse --short HEAD)
        echo "short_sha=$SHORT" >> "$GITHUB_OUTPUT"
        echo "image=$REPO/web:sha-$SHORT" >> "$GITHUB_OUTPUT"

    - id: auth
      uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
        service_account: ${{ vars.GCP_DEPLOYER_SA }}
        token_format: access_token

    - uses: google-github-actions/setup-gcloud@v2

    - uses: docker/login-action@v3
      with:
        registry: ${{ vars.GCP_REGION }}-docker.pkg.dev
        username: oauth2accesstoken
        password: ${{ steps.auth.outputs.access_token }}

    - uses: docker/setup-buildx-action@v3

    - uses: docker/build-push-action@v6
      with:
        context: .
        push: true
        platforms: linux/amd64
        tags: |
          ${{ steps.meta.outputs.image }}
          ${{ env.REPO }}/web:latest
        build-args: GIT_SHA=${{ steps.meta.outputs.short_sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        provenance: false

    - name: Migrate and seed production database
      run: |
        gcloud run jobs update cofresso-migrate --image "${{ steps.meta.outputs.image }}" --region "$REGION" --project "$PROJECT_ID" --quiet
        gcloud run jobs execute cofresso-migrate --region "$REGION" --project "$PROJECT_ID" --wait
        gcloud run jobs execute cofresso-migrate --region "$REGION" --project "$PROJECT_ID" --wait --args="dist/db.mjs,seed"

    - name: Deploy
      run: |
        gcloud run deploy cofresso-web --image "${{ steps.meta.outputs.image }}" --region "$REGION" --project "$PROJECT_ID" --quiet

    - name: Smoke test (Cloud Run URL)
      run: |
        URL=$(gcloud run services describe cofresso-web --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')
        for i in $(seq 1 12); do
          if curl -fsS "$URL/api/health" | tee /tmp/health.json | grep -q "\"commit\":\"${{ steps.meta.outputs.short_sha }}\""; then
            echo "Serving ${{ steps.meta.outputs.short_sha }} at $URL"; exit 0
          fi
          sleep 5
        done
        echo "New revision not healthy"; cat /tmp/health.json || true; exit 1

    - name: Smoke test (public URL)
      run: curl -fsS "${{ vars.PRODUCTION_URL }}/api/health"

    - name: Summary
      run: |
        {
          echo "### ✅ Production deployed"
          echo
          echo "- Image: \`${{ steps.meta.outputs.image }}\`"
          echo "- URL: ${{ vars.PRODUCTION_URL }}"
        } >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 2: Rollback workflow**

`.github/workflows/rollback.yml`:

```yaml
name: Rollback production

on:
  workflow_dispatch:
    inputs:
      revision:
        description: Revision name to route 100% traffic to (leave empty for the previous revision)
        required: false
        type: string

permissions:
  contents: read
  id-token: write

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: ${{ vars.PRODUCTION_URL }}
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOYER_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - name: Pick target revision
        id: pick
        env:
          REGION: ${{ vars.GCP_REGION }}
          PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
        run: |
          if [ -n "${{ inputs.revision }}" ]; then
            TARGET="${{ inputs.revision }}"
          else
            # Newest revision that is not currently serving.
            SERVING=$(gcloud run services describe cofresso-web --region "$REGION" --project "$PROJECT_ID" --format json | jq -r '.status.traffic[] | select(.percent > 0) | .revisionName' | head -n1)
            TARGET=$(gcloud run revisions list --service cofresso-web --region "$REGION" --project "$PROJECT_ID" --format 'value(metadata.name)' --sort-by '~metadata.creationTimestamp' | grep -v "^$SERVING$" | head -n1)
          fi
          [ -n "$TARGET" ] || { echo "No rollback target found"; exit 1; }
          echo "target=$TARGET" >> "$GITHUB_OUTPUT"
          echo "Rolling back to $TARGET"
      - name: Shift traffic
        run: |
          gcloud run services update-traffic cofresso-web \
            --region "${{ vars.GCP_REGION }}" --project "${{ vars.GCP_PROJECT_ID }}" \
            --to-revisions "${{ steps.pick.outputs.target }}=100" --quiet
      - name: Verify
        run: curl -fsS "${{ vars.PRODUCTION_URL }}/api/health"
```

Note: after a rollback the service no longer routes to `LATEST`; the next `gcloud run deploy` in CI still moves traffic to the new revision because `deploy` defaults to 100% on the new revision unless `--no-traffic` is set.

- [ ] **Step 3: Runbooks**

`docs/runbooks/deploy.md`:

````markdown
# Deploying

## Normal path

Merge a PR into `main`. The `deploy-production` job builds the image, runs `cofresso-migrate` (migrate, then seed), deploys `cofresso-web`, and smoke tests `/api/health` for the new commit sha.

## Preview

Every PR from this repo deploys a zero-traffic revision to `cofresso-web-preview` tagged `pr-<n>`. The URL is in the sticky PR comment. Previews share the `cofresso_preview` database; migrations from open PRs accumulate there. Reset it with the database runbook if it drifts.

## Manual deploy (break glass)

```bash
REPO=us-central1-docker.pkg.dev/cofresso-prod/web
SHA=$(git rev-parse --short HEAD)
docker buildx build --platform linux/amd64 --build-arg GIT_SHA=$SHA -t $REPO/web:sha-$SHA --push .
gcloud run jobs update cofresso-migrate --image $REPO/web:sha-$SHA --region us-central1 && gcloud run jobs execute cofresso-migrate --region us-central1 --wait
gcloud run deploy cofresso-web --image $REPO/web:sha-$SHA --region us-central1
```
````

````

`docs/runbooks/rollback.md`:
```markdown
# Rolling back

1. Actions → **Rollback production** → Run workflow. Leave the revision blank to go to the previous revision, or paste a specific one from `gcloud run revisions list --service cofresso-web --region us-central1`.
2. The workflow shifts 100% traffic and checks `/api/health`.
3. Fix forward on `main`. The next merge deploys normally and takes traffic again.

Migrations are additive by convention. If a migration must be reverted, write a new migration; never edit an applied one.
````

`docs/runbooks/database.md`:

````markdown
# Database

Cloud SQL Postgres 16, instance `cofresso-pg`, databases `cofresso` (production) and `cofresso_preview`.

## Connect locally

```bash
gcloud sql connect cofresso-pg --user=cofresso --database=cofresso --project cofresso-prod
# password: gcloud secrets versions access latest --secret db-password --project cofresso-prod
```
````

## Migrations

Generated by `pnpm db:generate` from `src/lib/db/schema`, applied by the `cofresso-migrate*` Cloud Run jobs before each deploy. Run one manually:

```bash
gcloud run jobs execute cofresso-migrate --region us-central1 --project cofresso-prod --wait
```

## Reset the preview database

```bash
gcloud run jobs execute cofresso-migrate-preview --region us-central1 --project cofresso-prod --wait \
  --args="dist/db.mjs,reset" --update-env-vars ALLOW_DB_RESET=true
```

Never run `reset` against `cofresso-migrate`.

## Backups

Daily automated backups, 7 retained. Restore through the Cloud SQL console or `gcloud sql backups restore`.

````

- [ ] **Step 4: Commit**

```bash
git add .github docs && git commit -m "ci: add production deploy, rollback workflow and runbooks"
````

---

### Task 5: Terraform workflow

**Files:**

- Create: `.github/workflows/infra.yml`

- [ ] **Step 1: Workflow**

```yaml
name: Infrastructure

on:
  pull_request:
    paths: ['infra/**', '.github/workflows/infra.yml']
  push:
    branches: [main]
    paths: ['infra/**', '.github/workflows/infra.yml']
  workflow_dispatch:

permissions:
  contents: read

defaults:
  run:
    working-directory: infra

env:
  TF_IN_AUTOMATION: 'true'
  TF_INPUT: 'false'

jobs:
  validate:
    name: terraform validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform fmt -check -recursive -diff
      - run: terraform init -backend=false
      - run: terraform validate

  plan:
    name: terraform plan
    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
    needs: validate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_PLANNER_SA }}
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_wrapper: false
      - run: terraform init
      - id: plan
        run: |
          set +e
          terraform plan -no-color -lock=false -out=tfplan > plan.txt 2>&1
          echo "exit=$?" >> "$GITHUB_OUTPUT"
          set -e
          head -c 60000 plan.txt > plan-trimmed.txt
      - uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: terraform
          path: infra/plan-trimmed.txt
      - run: exit ${{ steps.plan.outputs.exit }}

  apply:
    name: terraform apply
    if: github.event_name != 'pull_request'
    needs: validate
    runs-on: ubuntu-latest
    environment: infrastructure
    concurrency:
      group: terraform-apply
      cancel-in-progress: false
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_APPLIER_SA }}
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_wrapper: false
      - run: terraform init
      - run: terraform apply -auto-approve -no-color
```

The plan comment wraps raw text; to render it as a code block, prepend and append triple backticks:

````yaml
- id: plan
  run: |
    set +e
    terraform plan -no-color -lock=false -out=tfplan > plan.txt 2>&1
    echo "exit=$?" >> "$GITHUB_OUTPUT"
    set -e
    { echo '### Terraform plan'; echo; echo '```hcl'; head -c 60000 plan.txt; echo; echo '```'; } > plan-trimmed.txt
````

Use this version of the `plan` step.

- [ ] **Step 2: Commit**

```bash
git add .github && git commit -m "ci: add Terraform validate, plan-on-PR and apply-on-main workflow"
```

---

### Task 6: CodeQL

**Files:**

- Create: `.github/workflows/codeql.yml`

- [ ] **Step 1: Workflow**

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '30 6 * * 1'

permissions:
  contents: read
  security-events: write
  actions: read

jobs:
  analyze:
    name: analyze
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
          queries: security-and-quality
      - uses: github/codeql-action/analyze@v3
        with:
          category: /language:javascript-typescript
```

- [ ] **Step 2: Commit and push everything so far**

```bash
git add .github && git commit -m "ci: add CodeQL analysis"
git push origin main
```

Watch the `CI` run on main: all six checks green, `deploy-production` green, and the site serving the new commit sha at the Cloud Run URL.

---

### Task 7: Repository settings, environments and branch protection

**Files:**

- Create: `docs/github-setup.md`

- [ ] **Step 1: Apply settings**

```bash
REPO=cofresso/cofresso.com

# Merge strategy: squash only, PR title as commit subject, delete branches on merge.
gh api -X PATCH repos/$REPO \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -F allow_auto_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY

# Environments. production and infrastructure only deploy from main; preview from anywhere.
gh api -X PUT repos/$REPO/environments/production \
  --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}
JSON
gh api -X PUT repos/$REPO/environments/infrastructure \
  --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}
JSON
gh api -X PUT repos/$REPO/environments/preview --input - <<'JSON'
{"deployment_branch_policy":null}
JSON

# Dependabot alerts and security fixes.
gh api -X PUT repos/$REPO/vulnerability-alerts
gh api -X PUT repos/$REPO/automated-security-fixes

# Branch ruleset for main.
gh api -X POST repos/$REPO/rulesets --input - <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "lint", "integration_id": 15368 },
          { "context": "typecheck", "integration_id": 15368 },
          { "context": "unit", "integration_id": 15368 },
          { "context": "integration", "integration_id": 15368 },
          { "context": "build", "integration_id": 15368 },
          { "context": "e2e", "integration_id": 15368 },
          { "context": "Conventional Commits title", "integration_id": 15368 } ] } }
  ]
}
JSON
gh api repos/$REPO/rulesets --jq '.[] | {id, name, enforcement}'
```

`integration_id` 15368 is GitHub Actions. If the ruleset call rejects `allowed_merge_methods`, remove that key and retry.

- [ ] **Step 2: Document it**

`docs/github-setup.md`:

```markdown
# GitHub configuration

Everything CI needs that is not in a workflow file. Apply with an account that has admin on `cofresso/cofresso.com`.

## Repository variables (non-secret)

| Variable            | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| `GCP_PROJECT_ID`    | `cofresso-prod`                                          |
| `GCP_REGION`        | `us-central1`                                            |
| `GCP_WIF_PROVIDER`  | `terraform output -raw wif_provider`                     |
| `GCP_DEPLOYER_SA`   | `terraform output -raw deployer_service_account`         |
| `GCP_PLANNER_SA`    | `terraform output -raw planner_service_account`          |
| `GCP_APPLIER_SA`    | `terraform output -raw applier_service_account`          |
| `GCP_ARTIFACT_REPO` | `terraform output -raw artifact_registry`                |
| `PRODUCTION_URL`    | `https://cofresso.com` (Cloud Run URL until DNS is live) |

There are **no repository secrets**. Authentication is Workload Identity Federation.

## Environments

- `production`: protected branches only (main). Add required reviewers here to gate deploys.
- `infrastructure`: protected branches only (main). Used by `terraform apply`.
- `preview`: any branch.

## Branch ruleset `main`

Pull request required, squash merges only, linear history, no deletion or force push, review threads resolved, required checks: `lint`, `typecheck`, `unit`, `integration`, `build`, `e2e`, `Conventional Commits title` (strict, up to date with main). Repository admins can bypass for emergencies.

## Merge settings

Squash only; PR title becomes the commit subject; branches auto-delete on merge; auto-merge enabled.

## Security

Dependabot alerts and security updates on. CodeQL runs via `.github/workflows/codeql.yml` (do not also enable "default setup", the two conflict).

## Re-applying

The commands used are in `docs/superpowers/plans/2026-09-06-cofresso-cicd.md`, Task 7.
```

- [ ] **Step 3: Commit via a PR (the ruleset now requires it) and validate the whole pipeline**

```bash
git checkout -b ci/github-setup-docs
git add docs && git commit -m "docs: add GitHub configuration reference"
git push -u origin ci/github-setup-docs
gh pr create --title "docs: add GitHub configuration reference" --body "Documents repository variables, environments and the main ruleset applied in the CI/CD plan." --base main
gh pr checks --watch
```

Expected: `PR title` passes; six checks pass; `deploy-preview` posts a comment with a working URL; `Infrastructure` does not run (no infra changes). Open the preview URL, add something to the cart. Then:

```bash
gh pr merge --squash --auto
gh run watch $(gh run list --branch main --workflow CI --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: production deploy green, health returns the merged sha. Confirm the preview tag was removed:

```bash
gcloud run services describe cofresso-web-preview --region us-central1 --project cofresso-prod --format json | jq '.status.traffic[].tag'
```
