import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { brewGuides } from '@/content/brew-guides';
import { seedCollections, seedProducts } from '@/lib/db/seed/data';
import { EMPTY_MANIFEST, type ImagesManifest } from './manifest';
import {
  existingEntry,
  objectPathFor,
  planJobs,
  putEntry,
  runImageJobs,
  type ImageDeps,
} from './generate';

const PNG = Buffer.from('fake-png-bytes');
const WEBP = Buffer.from('fake-webp-bytes');
const WEBP_SHA = createHash('sha256').update(WEBP).digest('hex');

function deps(overrides: Partial<ImageDeps> = {}): ImageDeps {
  return {
    generate: vi.fn(async () => PNG),
    process: vi.fn(async () => ({ data: WEBP, width: 1024, height: 1024 })),
    upload: vi.fn(async () => {}),
    log: vi.fn(),
    now: () => new Date('2026-09-06T12:00:00.000Z'),
    sleep: async () => {},
    ...overrides,
  };
}

describe('planJobs', () => {
  it('plans four jobs per product plus collections, home and guides', () => {
    const jobs = planJobs();
    expect(jobs).toHaveLength(
      seedProducts.length * 4 + seedCollections.length + 2 + brewGuides.length,
    );
    expect(jobs).toHaveLength(82);
    expect(new Set(jobs.map((j) => j.key)).size).toBe(jobs.length);
    expect(jobs.every((j) => j.prompt.length > 100 && j.alt.length > 10)).toBe(true);
  });

  it('uses 3:2 for lifestyle and every banner, square otherwise', () => {
    const jobs = planJobs();
    const landscape = jobs.filter((j) => j.size === '1536x1024');
    expect(landscape).toHaveLength(
      seedProducts.length + seedCollections.length + 2 + brewGuides.length,
    );
    expect(jobs.filter((j) => j.size === '1024x1024')).toHaveLength(seedProducts.length * 3);
  });

  it('filters with --only', () => {
    expect(planJobs('morning-frame').map((j) => j.key)).toEqual([
      'product:morning-frame:front',
      'product:morning-frame:detail',
      'product:morning-frame:lifestyle',
      'product:morning-frame:packaging',
    ]);
    expect(planJobs('collections')).toHaveLength(seedCollections.length);
    expect(planJobs('home').map((j) => j.key)).toEqual(['home:hero', 'home:story']);
    expect(planJobs('guides')).toHaveLength(brewGuides.length);
    expect(planJobs('nope')).toEqual([]);
  });
});

describe('objectPathFor', () => {
  it('content-addresses every scope', () => {
    const byKey = new Map(planJobs().map((j) => [j.key, j]));
    expect(objectPathFor(byKey.get('product:morning-frame:front')!, 'deadbeef')).toBe(
      'products/morning-frame/morning-frame-front-deadbeef.webp',
    );
    expect(objectPathFor(byKey.get('collection:blends')!, 'deadbeef')).toBe(
      'collections/blends-deadbeef.webp',
    );
    expect(objectPathFor(byKey.get('home:hero')!, 'deadbeef')).toBe('home/hero-deadbeef.webp');
    expect(objectPathFor(byKey.get('guide:pour-over')!, 'deadbeef')).toBe(
      'guides/pour-over-deadbeef.webp',
    );
  });
});

describe('putEntry and existingEntry', () => {
  it('round-trips an entry for every scope without mutating the input', () => {
    const jobs = planJobs().filter((j) =>
      ['product:morning-frame:front', 'collection:blends', 'home:hero', 'guide:pour-over'].includes(
        j.key,
      ),
    );
    let manifest: ImagesManifest = EMPTY_MANIFEST;
    for (const job of jobs) {
      expect(existingEntry(manifest, job)).toBeUndefined();
      manifest = putEntry(manifest, job, {
        url: `https://cofresso.com/assets/${objectPathFor(job, 'deadbeef')}`,
        alt: job.alt,
        width: 1024,
        height: 1024,
        sha: WEBP_SHA,
      });
      expect(existingEntry(manifest, job)?.sha).toBe(WEBP_SHA);
    }
    expect(EMPTY_MANIFEST.products).toEqual({});
    expect(manifest.products['morning-frame']).toHaveLength(1);
  });
});

describe('runImageJobs', () => {
  const options = { model: 'gpt-image-2', only: 'home', concurrency: 2 };

  it('does not touch the network on a dry run', async () => {
    const d = deps();
    const result = await runImageJobs(EMPTY_MANIFEST, d, { ...options, dryRun: true });
    expect(d.generate).not.toHaveBeenCalled();
    expect(d.upload).not.toHaveBeenCalled();
    expect(result.manifest).toEqual(EMPTY_MANIFEST);
    expect(result.planned).toBe(2);
    expect(result.generated).toBe(0);
  });

  it('generates, converts, uploads and records every job', async () => {
    const d = deps();
    const result = await runImageJobs(EMPTY_MANIFEST, d, options);

    expect(d.generate).toHaveBeenCalledTimes(2);
    expect(d.generate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-image-2', size: '1536x1024' }),
    );
    expect(d.process).toHaveBeenCalledWith(PNG);
    expect(d.upload).toHaveBeenCalledWith({
      objectPath: `home/hero-${WEBP_SHA.slice(0, 8)}.webp`,
      body: WEBP,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    expect(result.generated).toBe(2);
    expect(result.failures).toEqual([]);
    expect(result.manifest.model).toBe('gpt-image-2');
    expect(result.manifest.generatedAt).toBe('2026-09-06T12:00:00.000Z');
    expect(result.manifest.home.hero).toEqual({
      url: `https://cofresso.com/assets/home/hero-${WEBP_SHA.slice(0, 8)}.webp`,
      alt: 'Freshly roasted Cofresso coffee bags and a pour-over setup on a cream linen backdrop',
      width: 1024,
      height: 1024,
      sha: WEBP_SHA,
    });
  });

  it('skips jobs already in the manifest unless forced', async () => {
    const first = await runImageJobs(EMPTY_MANIFEST, deps(), options);

    const second = deps();
    const skipped = await runImageJobs(first.manifest, second, options);
    expect(second.generate).not.toHaveBeenCalled();
    expect(skipped.skipped).toBe(2);
    expect(skipped.manifest.home.hero).toEqual(first.manifest.home.hero);

    const forced = deps();
    const redone = await runImageJobs(first.manifest, forced, { ...options, force: true });
    expect(forced.generate).toHaveBeenCalledTimes(2);
    expect(redone.generated).toBe(2);
  });

  it('retries 429s and reports permanent failures without losing good entries', async () => {
    let heroCalls = 0;
    const d = deps({
      generate: vi.fn(async ({ prompt }: { prompt: string }) => {
        if (prompt.includes('roastery')) {
          throw Object.assign(new Error('bad request'), { status: 400 });
        }
        heroCalls += 1;
        if (heroCalls < 3) throw Object.assign(new Error('slow down'), { status: 429 });
        return PNG;
      }),
    });

    const result = await runImageJobs(EMPTY_MANIFEST, d, options);
    expect(heroCalls).toBe(3);
    expect(result.generated).toBe(1);
    expect(result.manifest.home.hero).toBeDefined();
    expect(result.manifest.home.story).toBeUndefined();
    expect(result.failures).toEqual([{ key: 'home:story', error: 'bad request' }]);
  });

  it('keeps the original entry when a forced regeneration fails', async () => {
    const first = await runImageJobs(EMPTY_MANIFEST, deps(), options);
    const originalHero = first.manifest.home.hero;

    const failing = deps({
      generate: vi.fn(async () => {
        throw Object.assign(new Error('bad request'), { status: 400 });
      }),
    });
    const result = await runImageJobs(first.manifest, failing, { ...options, force: true });

    expect(result.manifest.home.hero).toEqual(originalHero);
    expect(result.failures).toEqual(
      expect.arrayContaining([{ key: 'home:hero', error: 'bad request' }]),
    );
  });
});
