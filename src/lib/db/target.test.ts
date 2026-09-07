import { describe, expect, it } from 'vitest';
import { resolveDbTarget } from './target';

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

describe('resolveDbTarget', () => {
  it('returns DATABASE_URL as-is when set, even if other DB_* vars are present', () => {
    const env = envWith({
      DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
      DB_USER: 'ignored-user',
      DB_PASSWORD: 'ignored-pass',
      DB_NAME: 'ignored-db',
      DB_SOCKET_DIR: '/cloudsql/ignored',
    });

    expect(resolveDbTarget(env)).toBe('postgres://user:pass@example.com:5432/db');
  });

  it('returns a socket options object when DB_SOCKET_DIR and credentials are set', () => {
    const env = envWith({
      DB_USER: 'app',
      DB_PASSWORD: 'secret',
      DB_NAME: 'cofresso',
      DB_SOCKET_DIR: '/cloudsql/proj:region:instance',
    });

    expect(resolveDbTarget(env)).toEqual({
      path: '/cloudsql/proj:region:instance',
      user: 'app',
      password: 'secret',
      database: 'cofresso',
    });
  });

  it('returns a TCP options object with the default port when DB_HOST is set and DB_PORT is not', () => {
    const env = envWith({
      DB_HOST: 'localhost',
      DB_USER: 'app',
      DB_PASSWORD: 'secret',
      DB_NAME: 'cofresso',
    });

    expect(resolveDbTarget(env)).toEqual({
      host: 'localhost',
      port: 5432,
      user: 'app',
      password: 'secret',
      database: 'cofresso',
    });
  });

  it('returns a TCP options object with an explicit port when DB_PORT is set', () => {
    const env = envWith({
      DB_HOST: 'localhost',
      DB_PORT: '5433',
      DB_USER: 'app',
      DB_PASSWORD: 'secret',
      DB_NAME: 'cofresso',
    });

    expect(resolveDbTarget(env)).toEqual({
      host: 'localhost',
      port: 5433,
      user: 'app',
      password: 'secret',
      database: 'cofresso',
    });
  });

  it('throws when no database configuration is present', () => {
    expect(() => resolveDbTarget(envWith({}))).toThrow(
      'No database configuration found (DATABASE_URL or DB_* variables).',
    );
  });

  it('treats empty strings as unset and falls through to the next option', () => {
    const env = envWith({
      DATABASE_URL: '',
      DB_SOCKET_DIR: '',
      DB_HOST: 'localhost',
      DB_PORT: '',
      DB_USER: 'app',
      DB_PASSWORD: 'secret',
      DB_NAME: 'cofresso',
    });

    expect(resolveDbTarget(env)).toEqual({
      host: 'localhost',
      port: 5432,
      user: 'app',
      password: 'secret',
      database: 'cofresso',
    });
  });

  it('treats an empty DATABASE_URL and empty socket credentials as fully unset (throws)', () => {
    const env = envWith({
      DATABASE_URL: '',
      DB_USER: '',
      DB_PASSWORD: '',
      DB_NAME: '',
      DB_SOCKET_DIR: '',
      DB_HOST: '',
    });

    expect(() => resolveDbTarget(env)).toThrow(
      'No database configuration found (DATABASE_URL or DB_* variables).',
    );
  });
});
