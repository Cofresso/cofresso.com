import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';

describe('logger', () => {
  it('writes one JSON line with severity and message', () => {
    const write = vi.fn();
    const log = createLogger({ write, base: { service: 'cofresso' } });
    log.info('hello', { orderNumber: 'CF-10001' });
    expect(write).toHaveBeenCalledTimes(1);
    const line = JSON.parse(write.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      severity: 'INFO',
      message: 'hello',
      service: 'cofresso',
      orderNumber: 'CF-10001',
    });
    expect(typeof line.time).toBe('string');
  });

  it('serialises errors', () => {
    const write = vi.fn();
    const log = createLogger({ write });
    log.error('boom', { err: new Error('bad') });
    const line = JSON.parse(write.mock.calls[0][0] as string);
    expect(line.severity).toBe('ERROR');
    expect(line.err.message).toBe('bad');
    expect(typeof line.err.stack).toBe('string');
  });
});
