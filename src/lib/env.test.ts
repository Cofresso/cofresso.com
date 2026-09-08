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

  it('parses Coframe Conversion API configuration', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:5432/db');
    vi.stubEnv('COFRAME_API_TOKEN', 'cfpv1_testtoken');
    vi.stubEnv('COFRAME_PROJECT_ID', 'proj_custom');
    vi.stubEnv('COFRAME_INGEST_URL', 'https://custom.ingest.coframe.com');
    const { getServerEnv } = await import('./env');
    const env = getServerEnv();
    expect(env.COFRAME_API_TOKEN).toBe('cfpv1_testtoken');
    expect(env.COFRAME_PROJECT_ID).toBe('proj_custom');
    expect(env.COFRAME_INGEST_URL).toBe('https://custom.ingest.coframe.com');
  });

  it('defaults Coframe project ID and ingest URL', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:5432/db');
    vi.stubEnv('COFRAME_API_TOKEN', '');
    vi.stubEnv('COFRAME_PROJECT_ID', '');
    vi.stubEnv('COFRAME_INGEST_URL', '');
    const { getServerEnv } = await import('./env');
    const env = getServerEnv();
    expect(env.COFRAME_API_TOKEN).toBeUndefined();
    expect(env.COFRAME_PROJECT_ID).toBe('6a9e31bb82444fc48fd16faf');
    expect(env.COFRAME_INGEST_URL).toBe('https://ingest.app.coframe.com');
  });
});
