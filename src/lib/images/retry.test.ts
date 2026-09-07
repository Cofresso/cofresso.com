import { describe, expect, it, vi } from 'vitest';
import { isRetryableError, withRetry } from './retry';

const noSleep = async (_ms: number) => {};

describe('isRetryableError', () => {
  it('retries rate limits, timeouts and server errors', () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 408 })).toBe(true);
    expect(isRetryableError({ status: 409 })).toBe(true);
    expect(isRetryableError({ status: 500 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ response: { status: 502 } })).toBe(true);
    expect(isRetryableError({ statusCode: 504 })).toBe(true);
    expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('does not retry client errors or unknown shapes', () => {
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 401 })).toBe(false);
    expect(isRetryableError(new Error('bad prompt'))).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns the first successful value without sleeping', async () => {
    const sleep = vi.fn(noSleep);
    const fn = vi.fn(async () => 'ok');
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries retryable failures with exponential backoff', async () => {
    const sleep = vi.fn(noSleep);
    const onRetry = vi.fn();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('rate limited'), { status: 429 });
      return calls;
    });
    await expect(withRetry(fn, { sleep, baseDelayMs: 100, onRetry })).resolves.toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('gives up after the attempt budget and rethrows the last error', async () => {
    const sleep = vi.fn(noSleep);
    const fn = vi.fn(async () => {
      throw Object.assign(new Error('still down'), { status: 500 });
    });
    await expect(withRetry(fn, { sleep, attempts: 3 })).rejects.toThrow('still down');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('fails immediately on a non-retryable error', async () => {
    const sleep = vi.fn(noSleep);
    const fn = vi.fn(async () => {
      throw Object.assign(new Error('invalid prompt'), { status: 400 });
    });
    await expect(withRetry(fn, { sleep })).rejects.toThrow('invalid prompt');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
