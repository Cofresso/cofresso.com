import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import type {
  CoframeApiResponse,
  CoframeClientOptions,
  CoframeConversionItem,
  CoframeIdentifyItem,
  CoframeSendResult,
} from './types';

export const COFRAME_USER_TOKEN_COOKIE = 'coframe.user.token';

/**
 * Hash an email address with SHA-256 after trimming and lowercasing.
 */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/**
 * Read the Coframe anonymous visitor token from request cookies.
 * Returns undefined if no cookie is present or if called outside request context.
 */
export async function readCoframeUserToken(): Promise<string | undefined> {
  try {
    const store = await cookies();
    const token = store.get(COFRAME_USER_TOKEN_COOKIE)?.value;
    return token && token.trim().length > 0 ? token.trim() : undefined;
  } catch {
    return undefined;
  }
}

export class CoframeClient {
  private readonly apiKey?: string;
  private readonly projectId?: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: CoframeClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.projectId = options.projectId;
    this.baseUrl = (options.baseUrl ?? 'https://ingest.app.coframe.com').replace(/\/$/, '');
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 100;
  }

  /**
   * Link one or more anonymous visitor tokens to customer identifiers.
   * POST /ingest/v2/identify/{project_id}
   */
  async identify(items: CoframeIdentifyItem[]): Promise<CoframeSendResult> {
    if (!items.length) {
      return { ok: false, error: 'Cannot call identify with empty items' };
    }
    return this.sendRequest('/ingest/v2/identify', { data: items });
  }

  /**
   * Send conversion events to Coframe.
   * POST /ingest/v2/conversions/{project_id}
   */
  async conversions(events: CoframeConversionItem[]): Promise<CoframeSendResult> {
    if (!events.length) {
      return { ok: false, error: 'Cannot call conversions with empty events' };
    }
    return this.sendRequest('/ingest/v2/conversions', { data: events });
  }

  private async sendRequest(endpoint: string, body: unknown): Promise<CoframeSendResult> {
    if (!this.apiKey) {
      logger.debug('Coframe API token is not configured; skipping request', { endpoint });
      return { ok: false, skipped: true, error: 'Coframe API token not configured' };
    }

    if (!this.projectId) {
      logger.warn('Coframe project ID is not configured; skipping request', { endpoint });
      return { ok: false, error: 'Coframe project ID not configured' };
    }

    const token = this.apiKey.trim();
    const bearer = token.startsWith('cfpv1_') ? `Bearer ${token}` : `Bearer cfpv1_${token}`;
    const url = `${this.baseUrl}${endpoint}/${this.projectId}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            Authorization: bearer,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.ok) {
          let responseData: CoframeApiResponse | undefined;
          try {
            responseData = (await response.json()) as CoframeApiResponse;
          } catch {
            responseData = undefined;
          }
          const traceId =
            responseData?.meta?.['trace-id'] ?? response.headers?.get('x-trace-id') ?? undefined;

          logger.info('Coframe request succeeded', {
            endpoint,
            status: response.status,
            traceId,
          });

          return { ok: true, traceId, data: responseData };
        }

        // 4xx errors indicate client/payload problem — do not retry
        if (response.status >= 400 && response.status < 500) {
          const text = await response.text().catch(() => '');
          logger.warn('Coframe client error (4xx)', {
            endpoint,
            status: response.status,
            error: text,
          });
          return {
            ok: false,
            status: response.status,
            error: text || `HTTP ${response.status}`,
          };
        }

        // 5xx errors: retry if attempts remaining
        if (attempt < this.maxRetries) {
          logger.warn('Coframe server error (5xx), retrying...', {
            endpoint,
            status: response.status,
            attempt: attempt + 1,
          });
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * (attempt + 1)));
          continue;
        }

        return {
          ok: false,
          status: response.status,
          error: `HTTP ${response.status} after ${this.maxRetries + 1} attempts`,
        };
      } catch (err) {
        if (attempt < this.maxRetries) {
          logger.warn('Coframe request failed, retrying...', {
            endpoint,
            error: err instanceof Error ? err.message : String(err),
            attempt: attempt + 1,
          });
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * (attempt + 1)));
          continue;
        }

        const message = err instanceof Error ? err.message : String(err);
        logger.error('Coframe request failed after retries', {
          endpoint,
          error: message,
          attempts: this.maxRetries + 1,
        });
        return { ok: false, error: message };
      }
    }

    return { ok: false, error: 'Unknown Coframe client failure' };
  }
}

let cachedClient: CoframeClient | undefined;

/**
 * Return a configured CoframeClient using server environment variables.
 */
export function getCoframeClient(): CoframeClient {
  if (cachedClient) return cachedClient;
  let apiKey = process.env.COFRAME_API_TOKEN;
  let projectId = process.env.COFRAME_PROJECT_ID ?? '6a9e31bb82444fc48fd16faf';
  let baseUrl = process.env.COFRAME_INGEST_URL ?? 'https://ingest.app.coframe.com';

  try {
    const env = getServerEnv();
    apiKey = env.COFRAME_API_TOKEN ?? apiKey;
    projectId = env.COFRAME_PROJECT_ID ?? projectId;
    baseUrl = env.COFRAME_INGEST_URL ?? baseUrl;
  } catch {
    // Falls back to process.env if getServerEnv throws (e.g. during test setup)
  }

  cachedClient = new CoframeClient({
    apiKey,
    projectId,
    baseUrl,
  });
  return cachedClient;
}

/** Test helper to reset client cache */
export function resetCoframeClientCache(): void {
  cachedClient = undefined;
}
