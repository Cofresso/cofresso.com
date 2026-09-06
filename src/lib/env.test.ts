import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getServerEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('accepts DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:5432/db');
    const { getServerEnv } = await import('./env');
    expect(getServerEnv().DATABASE_URL).toBe('postgres://u:p@localhost:5432/db');
  });

  it('accepts socket parts without DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DB_SOCKET_DIR', '/cloudsql/p:r:i');
    vi.stubEnv('DB_USER', 'app');
    vi.stubEnv('DB_PASSWORD', 'secret');
    vi.stubEnv('DB_NAME', 'cofresso');
    const { getServerEnv } = await import('./env');
    expect(getServerEnv().DB_SOCKET_DIR).toBe('/cloudsql/p:r:i');
  });

  it('throws a readable error when no database config is present', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DB_SOCKET_DIR', '');
    vi.stubEnv('DB_HOST', '');
    const { getServerEnv } = await import('./env');
    expect(() => getServerEnv()).toThrow(/database/i);
  });
});
