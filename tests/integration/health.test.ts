import { describe, expect, it } from 'vitest';
import './helpers';
import { GET } from '../../src/app/api/health/route';

describe('GET /api/health', () => {
  it('reports the database as up', async () => {
    const res = await GET(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok', db: 'up' });
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
