import { expect, test } from '@playwright/test';
import { suppressPopup } from './helpers';

test.beforeEach(async ({ page }) => {
  // The popup is covered by interruptions.spec.ts; here it would only land mid-flow.
  await suppressPopup(page);
});

test.describe('misc', () => {
  test('404 page', async ({ page }) => {
    const res = await page.goto('/products/does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('/coffee redirects to the open-source beans', async ({ request }) => {
    const res = await request.get('/coffee', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toBe('https://github.com/coframe/coffee');
  });

  test('health, robots, sitemap and humans.txt', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok', db: 'up' });

    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('sitemap.xml');

    const sitemap = await request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('/products/morning-frame');

    const humans = await request.get('/humans.txt');
    expect(await humans.text()).toContain('github.com/coframe/coffee');
  });
});
