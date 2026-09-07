import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Storage, type StorageOptions } from '@google-cloud/storage';
import { OAuth2Client } from 'google-auth-library';
import OpenAI from 'openai';
import sharp from 'sharp';
import { contentImages } from '../src/lib/images/content';
import { runImageJobs, type ImageDeps, type RunOptions } from '../src/lib/images/generate';
import { serializeManifest } from '../src/lib/images/manifest';
import type { ImageSize } from '../src/lib/images/prompts';

// The key lives outside the repository. `.superpowers/` is git-ignored; the
// absolute path is the primary checkout, so this also works from a worktree.
config({
  path: [
    '.superpowers/sdd/images/.env',
    '/Users/joshpayne/cofresso.com/.superpowers/sdd/images/.env',
    '.env.local',
    '.env',
  ],
});

const MODEL_PREFERENCE = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1'];
const LONGEST_EDGE = 1600;
const WEBP_QUALITY = 80;
const MANIFEST_PATH = path.resolve(process.cwd(), 'content/images.manifest.json');

interface Flags extends Omit<RunOptions, 'model'> {
  model?: string;
  bucket: string;
}

function parseFlags(argv: readonly string[]): Flags {
  const flags: Flags = { bucket: process.env.ASSETS_BUCKET ?? 'cofresso-prod-assets' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      i += 1;
      return next;
    };
    switch (arg) {
      case '--only':
        flags.only = value();
        break;
      case '--model':
        flags.model = value();
        break;
      case '--bucket':
        flags.bucket = value();
        break;
      case '--concurrency':
        flags.concurrency = Number(value());
        break;
      case '--force':
        flags.force = true;
        break;
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--help':
        console.log(
          'Usage: pnpm images:generate [--only <slug|collections|home|guides>] [--force] [--dry-run] [--concurrency 6] [--model gpt-image-2] [--bucket cofresso-prod-assets]',
        );
        process.exit(0);
      default:
        throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return flags;
}

async function resolveModel(client: OpenAI, requested?: string): Promise<string> {
  if (requested) return requested;
  const available = new Set((await client.models.list()).data.map((m) => m.id));
  const found = MODEL_PREFERENCE.find((id) => available.has(id));
  if (!found) {
    throw new Error(
      `No image model available to this key. Looked for: ${MODEL_PREFERENCE.join(', ')}`,
    );
  }
  return found;
}

/**
 * Locally the developer exports GOOGLE_OAUTH_ACCESS_TOKEN (same convention as
 * infra/README.md). Without it, fall back to Application Default Credentials.
 */
function createStorage(): Storage {
  const projectId = process.env.GCP_PROJECT_ID ?? 'cofresso-prod';
  const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (!token) return new Storage({ projectId });
  const authClient = new OAuth2Client();
  authClient.setCredentials({ access_token: token });
  const options: StorageOptions = { projectId, authClient };
  return new Storage(options);
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.dryRun) {
    const deps: ImageDeps = {
      generate: async () => {
        throw new Error('unreachable in a dry run');
      },
      process: async () => {
        throw new Error('unreachable in a dry run');
      },
      upload: async () => {
        throw new Error('unreachable in a dry run');
      },
      log: (message) => console.log(message),
      now: () => new Date(),
    };
    const result = await runImageJobs(contentImages(), deps, {
      ...flags,
      model: flags.model ?? MODEL_PREFERENCE[0],
      dryRun: true,
    });
    console.log(
      `Dry run: ${result.planned} to generate, ${result.skipped} already in the manifest.`,
    );
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Put it in .superpowers/sdd/images/.env or export it.',
    );
  }

  const openai = new OpenAI({ apiKey, timeout: 180_000, maxRetries: 0 });
  const model = await resolveModel(openai, flags.model);
  const bucket = createStorage().bucket(flags.bucket);

  console.log(
    `Model: ${model}. Bucket: gs://${flags.bucket}. Concurrency: ${flags.concurrency ?? 6}.`,
  );

  const deps: ImageDeps = {
    async generate({ prompt, size, model: modelId }) {
      const response = await openai.images.generate({
        model: modelId,
        prompt,
        size: size as ImageSize,
        quality: 'high',
        n: 1,
      });
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error('Images API returned no b64_json payload');
      return Buffer.from(b64, 'base64');
    },
    async process(input) {
      // `fit: 'inside'` with equal bounds caps the LONGEST edge and preserves
      // the aspect ratio; withoutEnlargement keeps 1024px squares at 1024px.
      const { data, info } = await sharp(input)
        .resize({
          width: LONGEST_EDGE,
          height: LONGEST_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    },
    async upload({ objectPath, body, contentType, cacheControl }) {
      await bucket.file(objectPath).save(body, {
        contentType,
        resumable: false,
        metadata: { cacheControl },
      });
    },
    log: (message) => console.log(message),
    now: () => new Date(),
  };

  const result = await runImageJobs(contentImages(), deps, { ...flags, model });

  mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, serializeManifest(result.manifest), 'utf8');

  console.log(
    `Generated ${result.generated}, skipped ${result.skipped}, failed ${result.failures.length}. Manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`,
  );
  if (result.failures.length) {
    for (const failure of result.failures) console.error(`  ${failure.key}: ${failure.error}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  // Never print the error object wholesale: an OpenAI SDK error can echo
  // request headers, and those carry the Authorization bearer token.
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
