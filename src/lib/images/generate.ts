import { createHash } from 'node:crypto';
import { brewGuides } from '@/content/brew-guides';
import type { ImageKind } from '@/lib/db/schema/values';
import { seedCollections, seedProducts } from '@/lib/db/seed/data';
import { IMAGE_KINDS } from '@/lib/db/schema/values';
import { collectionAltText, guideAltText, homeAltText, productAltText } from './alt';
import { mapWithConcurrency } from './concurrency';
import {
  parseManifest,
  sortProductImages,
  type ImagesManifest,
  type ManifestImage,
} from './manifest';
import {
  assetUrl,
  collectionObjectPath,
  guideObjectPath,
  homeObjectPath,
  IMAGE_CACHE_CONTROL,
  IMAGE_CONTENT_TYPE,
  productObjectPath,
  sha8,
  type HomeImageName,
} from './paths';
import {
  collectionPrompt,
  guidePrompt,
  HERO_SIZE,
  homePrompt,
  KIND_SIZES,
  productPrompt,
  type ImageSize,
} from './prompts';
import { withRetry } from './retry';

export const DEFAULT_CONCURRENCY = 6;
export const RETRY_ATTEMPTS = 3;

interface JobBase {
  /** Stable identity, used for logging, `--only` filtering and failure reporting. */
  key: string;
  prompt: string;
  size: ImageSize;
  alt: string;
}

export type ImageJob =
  | (JobBase & { scope: 'product'; slug: string; kind: ImageKind })
  | (JobBase & { scope: 'collection'; slug: string })
  | (JobBase & { scope: 'guide'; slug: string })
  | (JobBase & { scope: 'home'; name: HomeImageName });

const HOME_NAMES: HomeImageName[] = ['hero', 'story'];

/**
 * The full work list, in a stable order. `only` accepts a product slug or one
 * of the literals `collections`, `home`, `guides`; anything else plans nothing.
 */
export function planJobs(only?: string): ImageJob[] {
  const jobs: ImageJob[] = [];
  const wantProducts = !only || seedProducts.some((p) => p.slug === only);
  const wantScope = (scope: string) => !only || only === scope;

  if (wantProducts) {
    for (const product of seedProducts) {
      if (only && product.slug !== only) continue;
      for (const kind of IMAGE_KINDS) {
        jobs.push({
          key: `product:${product.slug}:${kind}`,
          scope: 'product',
          slug: product.slug,
          kind,
          prompt: productPrompt(product, kind),
          size: KIND_SIZES[kind],
          alt: productAltText(product, kind),
        });
      }
    }
  }

  if (wantScope('collections')) {
    for (const collection of seedCollections) {
      jobs.push({
        key: `collection:${collection.slug}`,
        scope: 'collection',
        slug: collection.slug,
        prompt: collectionPrompt(collection),
        size: HERO_SIZE,
        alt: collectionAltText(collection),
      });
    }
  }

  if (wantScope('home')) {
    for (const name of HOME_NAMES) {
      jobs.push({
        key: `home:${name}`,
        scope: 'home',
        name,
        prompt: homePrompt(name),
        size: HERO_SIZE,
        alt: homeAltText(name),
      });
    }
  }

  if (wantScope('guides')) {
    for (const guide of brewGuides) {
      jobs.push({
        key: `guide:${guide.slug}`,
        scope: 'guide',
        slug: guide.slug,
        prompt: guidePrompt(guide),
        size: HERO_SIZE,
        alt: guideAltText(guide),
      });
    }
  }

  return jobs;
}

export function objectPathFor(job: ImageJob, hash: string): string {
  switch (job.scope) {
    case 'product':
      return productObjectPath(job.slug, job.kind, hash);
    case 'collection':
      return collectionObjectPath(job.slug, hash);
    case 'home':
      return homeObjectPath(job.name, hash);
    case 'guide':
      return guideObjectPath(job.slug, hash);
  }
}

export function existingEntry(manifest: ImagesManifest, job: ImageJob): ManifestImage | undefined {
  switch (job.scope) {
    case 'product':
      return manifest.products[job.slug]?.find((i) => i.kind === job.kind);
    case 'collection':
      return manifest.collections[job.slug];
    case 'home':
      return manifest.home[job.name];
    case 'guide':
      return manifest.guides[job.slug];
  }
}

/** Immutable merge: returns a new manifest, leaving `manifest` untouched. */
export function putEntry(
  manifest: ImagesManifest,
  job: ImageJob,
  entry: ManifestImage,
): ImagesManifest {
  switch (job.scope) {
    case 'product': {
      const rest = (manifest.products[job.slug] ?? []).filter((i) => i.kind !== job.kind);
      return {
        ...manifest,
        products: {
          ...manifest.products,
          [job.slug]: sortProductImages([...rest, { ...entry, kind: job.kind }]),
        },
      };
    }
    case 'collection':
      return { ...manifest, collections: { ...manifest.collections, [job.slug]: entry } };
    case 'home':
      return { ...manifest, home: { ...manifest.home, [job.name]: entry } };
    case 'guide':
      return { ...manifest, guides: { ...manifest.guides, [job.slug]: entry } };
  }
}

export interface RefreshAltResult {
  manifest: ImagesManifest;
  changed: number;
}

/**
 * Recomputes `alt` for every entry already in the manifest from the same
 * seed/content data `planJobs` uses, without touching urls, dimensions or
 * shas. Never adds or removes an entry: a job with no existing entry is
 * skipped, so this is purely a text refresh, not a plan for what to
 * generate. No network calls, so it needs neither an API key nor a token.
 */
export function refreshAlt(previous: ImagesManifest): RefreshAltResult {
  let manifest = previous;
  let changed = 0;
  for (const job of planJobs()) {
    const existing = existingEntry(manifest, job);
    if (!existing || existing.alt === job.alt) continue;
    manifest = putEntry(manifest, job, { ...existing, alt: job.alt });
    changed += 1;
  }
  return { manifest, changed };
}

export interface ImageDeps {
  /** Returns the raw bytes the model produced (PNG for gpt-image models). */
  generate(input: { prompt: string; size: ImageSize; model: string }): Promise<Buffer>;
  /** Resize + WebP encode. */
  process(input: Buffer): Promise<{ data: Buffer; width: number; height: number }>;
  upload(input: {
    objectPath: string;
    body: Buffer;
    contentType: string;
    cacheControl: string;
  }): Promise<void>;
  log(message: string): void;
  now(): Date;
  sleep?(ms: number): Promise<void>;
}

export interface RunOptions {
  model: string;
  only?: string;
  force?: boolean;
  dryRun?: boolean;
  concurrency?: number;
}

export interface RunResult {
  manifest: ImagesManifest;
  planned: number;
  generated: number;
  skipped: number;
  failures: Array<{ key: string; error: string }>;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runImageJobs(
  previous: ImagesManifest,
  deps: ImageDeps,
  options: RunOptions,
): Promise<RunResult> {
  const jobs = planJobs(options.only);
  const pending = options.force ? jobs : jobs.filter((job) => !existingEntry(previous, job));
  const skipped = jobs.length - pending.length;

  if (options.dryRun) {
    for (const job of pending) {
      deps.log(`[dry-run] ${job.key} ${job.size} prompt=${job.prompt.length} chars`);
    }
    return {
      manifest: previous,
      planned: pending.length,
      generated: 0,
      skipped,
      failures: [],
    };
  }

  type Outcome =
    { ok: true; job: ImageJob; entry: ManifestImage } | { ok: false; job: ImageJob; error: string };

  const outcomes = await mapWithConcurrency(
    pending,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (job, index): Promise<Outcome> => {
      const label = `${index + 1}/${pending.length} ${job.key}`;
      try {
        const raw = await withRetry(
          () => deps.generate({ prompt: job.prompt, size: job.size, model: options.model }),
          {
            attempts: RETRY_ATTEMPTS,
            sleep: deps.sleep,
            onRetry: (attempt, err) =>
              deps.log(`retry ${attempt} for ${job.key}: ${messageOf(err)}`),
          },
        );
        const processed = await deps.process(raw);
        const sha = createHash('sha256').update(processed.data).digest('hex');
        const objectPath = objectPathFor(job, sha8(sha));
        await withRetry(
          () =>
            deps.upload({
              objectPath,
              body: processed.data,
              contentType: IMAGE_CONTENT_TYPE,
              cacheControl: IMAGE_CACHE_CONTROL,
            }),
          { attempts: RETRY_ATTEMPTS, sleep: deps.sleep },
        );
        deps.log(`ok ${label} -> ${objectPath} (${processed.width}x${processed.height})`);
        return {
          ok: true,
          job,
          entry: {
            url: assetUrl(objectPath),
            alt: job.alt,
            width: processed.width,
            height: processed.height,
            sha,
          },
        };
      } catch (err) {
        deps.log(`FAIL ${label}: ${messageOf(err)}`);
        return { ok: false, job, error: messageOf(err) };
      }
    },
  );

  let manifest = previous;
  const failures: Array<{ key: string; error: string }> = [];
  let generated = 0;
  for (const outcome of outcomes) {
    if (outcome.ok) {
      manifest = putEntry(manifest, outcome.job, outcome.entry);
      generated += 1;
    } else {
      failures.push({ key: outcome.job.key, error: outcome.error });
    }
  }

  if (generated > 0) {
    manifest = parseManifest({
      ...manifest,
      generatedAt: deps.now().toISOString(),
      model: options.model,
    });
  }

  return { manifest, planned: pending.length, generated, skipped, failures };
}
