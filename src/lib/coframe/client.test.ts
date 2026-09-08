import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoframeClient, hashEmail, resetCoframeClientCache } from './client';
import { trackNewsletterConversion, trackPurchaseConversion } from './conversions';

describe('hashEmail', () => {
  it('normalizes by trimming, lowercasing, and hashing with SHA-256', () => {
    const raw = '  Test.User@Example.COM ';
    const expected = createHash('sha256').update('test.user@example.com').digest('hex');
    expect(hashEmail(raw)).toBe(expected);
  });
});

describe('CoframeClient', () => {
  beforeEach(() => {
    resetCoframeClientCache();
    vi.restoreAllMocks();
  });

  it('skips requests when API key is not configured', async () => {
    const fetchMock = vi.fn();
    const client = new CoframeClient({
      apiKey: undefined,
      projectId: 'proj_123',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const res = await client.conversions([
      { event_name: 'purchase', event_time: Math.floor(Date.now() / 1000) },
    ]);

    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends conversion payloads with correct headers, URL, and shape', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const fakeFetch: typeof fetch = async (url, init) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          meta: {
            'powered-by': 'coframe',
            'trace-id': 'trace-abc-123',
            timestamp: 1700000000,
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const client = new CoframeClient({
      apiKey: 'secret_key_value',
      projectId: 'proj_999',
      baseUrl: 'https://ingest.app.coframe.com',
      fetchFn: fakeFetch,
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    const emailHash = hashEmail('customer@example.com');

    const result = await client.conversions([
      {
        event_name: 'purchase',
        event_time: nowSeconds,
        event_id: 'order_CF-10001',
        action_source: 'server',
        value: 49.99,
        user_token: '0f3c1d2e-4a5b-6c7d-8e9f-001122334455',
        external_id: emailHash,
        external_id_type: 'email_sha256',
        url: 'http://localhost:3000/checkout/success/CF-10001',
        custom_data: { currency: 'USD', order_id: 'CF-10001' },
        user_data: { email_sha256: emailHash },
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.traceId).toBe('trace-abc-123');
    }

    expect(capturedUrl).toBe('https://ingest.app.coframe.com/ingest/v2/conversions/proj_999');
    expect(capturedInit?.method).toBe('POST');

    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer cfpv1_secret_key_value');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(capturedInit?.body as string);
    expect(body.data).toHaveLength(1);
    const item = body.data[0];
    expect(item.event_name).toBe('purchase');
    expect(item.event_time).toBe(nowSeconds);
    expect(Number.isInteger(item.event_time)).toBe(true);
    expect(item.event_id).toBe('order_CF-10001');
    expect(item.action_source).toBe('server');
    expect(item.value).toBe(49.99);
    expect(item.user_token).toBe('0f3c1d2e-4a5b-6c7d-8e9f-001122334455');
    expect(item.external_id).toBe(emailHash);
    expect(item.external_id_type).toBe('email_sha256');
    expect(item.custom_data).toEqual({ currency: 'USD', order_id: 'CF-10001' });
    expect(item.user_data).toEqual({ email_sha256: emailHash });
  });

  it('keeps existing cfpv1_ prefix in API token if already present', async () => {
    let capturedAuth = '';
    const fakeFetch: typeof fetch = async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      capturedAuth = headers['Authorization'];
      return new Response(JSON.stringify({ meta: { 'trace-id': 't1' } }), { status: 201 });
    };

    const client = new CoframeClient({
      apiKey: 'cfpv1_already_prefixed',
      projectId: 'proj_1',
      fetchFn: fakeFetch,
    });

    await client.identify([
      {
        user_token: 'u-1',
        external_id: 'cust-1',
        external_id_type: 'email_sha256',
      },
    ]);

    expect(capturedAuth).toBe('Bearer cfpv1_already_prefixed');
  });

  it('sends identify payloads with correct URL and shape', async () => {
    let capturedUrl = '';
    let capturedBody: unknown;

    const fakeFetch: typeof fetch = async (url, init) => {
      capturedUrl = url.toString();
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ meta: { 'trace-id': 'trace-id-99' } }), {
        status: 201,
      });
    };

    const client = new CoframeClient({
      apiKey: 'test-token',
      projectId: 'proj_ident',
      fetchFn: fakeFetch,
    });

    const res = await client.identify([
      {
        user_token: 'visitor-uuid-1',
        external_id: 'hash-abc',
        external_id_type: 'email_sha256',
      },
    ]);

    expect(res.ok).toBe(true);
    expect(capturedUrl).toBe('https://ingest.app.coframe.com/ingest/v2/identify/proj_ident');
    expect(capturedBody).toEqual({
      data: [
        {
          user_token: 'visitor-uuid-1',
          external_id: 'hash-abc',
          external_id_type: 'email_sha256',
        },
      ],
    });
  });

  it('retries on 5xx errors and succeeds if a later attempt succeeds', async () => {
    let attempts = 0;
    const fakeFetch: typeof fetch = async () => {
      attempts++;
      if (attempts === 1) {
        return new Response('Internal Server Error', { status: 503 });
      }
      return new Response(JSON.stringify({ meta: { 'trace-id': 'recovered' } }), { status: 201 });
    };

    const client = new CoframeClient({
      apiKey: 'test-key',
      projectId: 'proj_retry',
      maxRetries: 2,
      retryDelayMs: 10,
      fetchFn: fakeFetch,
    });

    const res = await client.conversions([
      { event_name: 'purchase', event_time: Math.floor(Date.now() / 1000) },
    ]);

    expect(res.ok).toBe(true);
    expect(attempts).toBe(2);
    if (res.ok) {
      expect(res.traceId).toBe('recovered');
    }
  });

  it('does not retry on 4xx client errors', async () => {
    let attempts = 0;
    const fakeFetch: typeof fetch = async () => {
      attempts++;
      return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 });
    };

    const client = new CoframeClient({
      apiKey: 'bad-key',
      projectId: 'proj_client_err',
      maxRetries: 2,
      fetchFn: fakeFetch,
    });

    const res = await client.conversions([
      { event_name: 'purchase', event_time: Math.floor(Date.now() / 1000) },
    ]);

    expect(res.ok).toBe(false);
    expect(attempts).toBe(1);
    if (!res.ok && !res.skipped) {
      expect(res.status).toBe(401);
    }
  });

  it('returns failure when retries are exhausted on repeated 5xx', async () => {
    let attempts = 0;
    const fakeFetch: typeof fetch = async () => {
      attempts++;
      return new Response('Gateway Timeout', { status: 504 });
    };

    const client = new CoframeClient({
      apiKey: 'test-key',
      projectId: 'proj_timeout',
      maxRetries: 2,
      retryDelayMs: 5,
      fetchFn: fakeFetch,
    });

    const res = await client.conversions([
      { event_name: 'purchase', event_time: Math.floor(Date.now() / 1000) },
    ]);

    expect(res.ok).toBe(false);
    expect(attempts).toBe(3); // 1 initial + 2 retries
  });
});

describe('trackPurchaseConversion and trackNewsletterConversion', () => {
  it('calls identify and conversions with formatted purchase payload', async () => {
    const identifyCalls: unknown[] = [];
    const conversionCalls: unknown[] = [];

    const fakeFetch: typeof fetch = async (url, init) => {
      const urlStr = url.toString();
      const body = JSON.parse(init?.body as string);
      if (urlStr.includes('/identify/')) {
        identifyCalls.push(body);
      } else if (urlStr.includes('/conversions/')) {
        conversionCalls.push(body);
      }
      return new Response(JSON.stringify({ meta: { 'trace-id': 'trace-success' } }), {
        status: 201,
      });
    };

    const client = new CoframeClient({
      apiKey: 'key',
      projectId: 'proj_track',
      fetchFn: fakeFetch,
    });

    const email = 'Buyer@Coffee.com';
    const emailHash = hashEmail(email);

    await trackPurchaseConversion({
      orderNumber: 'CF-10042',
      orderId: 'uuid-order-10042',
      totalCents: 4488,
      email,
      lookupToken: 'tok123',
      userToken: 'coframe-token-uuid',
      client,
      siteUrl: 'https://cofresso.com',
    });

    expect(identifyCalls).toHaveLength(1);
    expect(identifyCalls[0]).toEqual({
      data: [
        {
          user_token: 'coframe-token-uuid',
          external_id: emailHash,
          external_id_type: 'email_sha256',
        },
      ],
    });

    expect(conversionCalls).toHaveLength(1);
    const convBody = (conversionCalls[0] as { data: Record<string, unknown>[] }).data[0];
    expect(convBody.event_name).toBe('purchase');
    expect(convBody.value).toBe(44.88);
    expect(convBody.event_id).toBe('order_CF-10042');
    expect(convBody.user_token).toBe('coframe-token-uuid');
    expect(convBody.external_id).toBe(emailHash);
    expect(convBody.external_id_type).toBe('email_sha256');
    expect(convBody.url).toBe('https://cofresso.com/checkout/success/CF-10042?t=tok123');
    expect(convBody.custom_data).toEqual({
      currency: 'USD',
      order_id: 'CF-10042',
      total_cents: 4488,
    });
    expect(convBody.user_data).toEqual({
      email_sha256: emailHash,
    });
  });

  it('reports newsletter conversion with source and hashed email', async () => {
    const identifyCalls: unknown[] = [];
    const conversionCalls: unknown[] = [];

    const fakeFetch: typeof fetch = async (url, init) => {
      const urlStr = url.toString();
      const body = JSON.parse(init?.body as string);
      if (urlStr.includes('/identify/')) {
        identifyCalls.push(body);
      } else if (urlStr.includes('/conversions/')) {
        conversionCalls.push(body);
      }
      return new Response(JSON.stringify({ meta: { 'trace-id': 'trace-nl' } }), { status: 201 });
    };

    const client = new CoframeClient({
      apiKey: 'key',
      projectId: 'proj_track',
      fetchFn: fakeFetch,
    });

    const email = 'subscriber@coffee.com';
    const emailHash = hashEmail(email);

    await trackNewsletterConversion({
      email,
      source: 'popup',
      userToken: 'visitor-tok-456',
      client,
    });

    expect(identifyCalls).toHaveLength(1);
    expect(conversionCalls).toHaveLength(1);

    const convBody = (conversionCalls[0] as { data: Record<string, unknown>[] }).data[0];
    expect(convBody.event_name).toBe('newsletter_signup');
    expect(convBody.event_id).toBe(`newsletter_${emailHash}`);
    expect(convBody.custom_data).toEqual({ source: 'popup' });
    expect(convBody.user_data).toEqual({ email_sha256: emailHash });
  });

  it('never throws even if client call fails or rejects', async () => {
    const rejectingFetch: typeof fetch = async () => {
      throw new Error('Connection refused');
    };

    const client = new CoframeClient({
      apiKey: 'key',
      projectId: 'proj_track',
      fetchFn: rejectingFetch,
      maxRetries: 0,
    });

    await expect(
      trackPurchaseConversion({
        orderNumber: 'CF-99999',
        orderId: 'id',
        totalCents: 1000,
        email: 'fail@test.com',
        lookupToken: 'tok',
        client,
      }),
    ).resolves.not.toThrow();

    await expect(
      trackNewsletterConversion({
        email: 'fail@test.com',
        source: 'footer',
        client,
      }),
    ).resolves.not.toThrow();
  });
});
