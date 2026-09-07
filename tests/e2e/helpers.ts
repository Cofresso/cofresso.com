import { expect, type Page } from '@playwright/test';
import {
  POPUP_STORAGE_KEY,
  serializeSuppression,
  suppressionFor,
} from '../../src/lib/interruptions/suppression';

/**
 * Seed the email-capture popup's suppression record before the first navigation, so it never
 * fires partway through a spec.
 *
 * `dismissInterruptions` can only clear what is already on screen; it cannot pre-empt a popup
 * whose 8s timer has not run out yet, and a spec that spends longer than that on a route the
 * popup is allowed on will have a modal land on top of it. Seeding storage is what a returning
 * visitor who already said no looks like, so the storefront specs still run against a fully
 * live storefront — banner, chat, toasts and rotator all included — and the interruptions spec
 * is left to test the popup itself.
 */
export async function suppressPopup(page: Page) {
  const record = serializeSuppression(suppressionFor('dismissed', new Date()));
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage unavailable — the spec will have to dismiss the popup instead */
      }
    },
    [POPUP_STORAGE_KEY, record] as const,
  );
}

/**
 * Wait until the page is interactive. An unhydrated button swallows a click silently and
 * Playwright's actionability checks cannot tell the difference. `AnalyticsProvider` buffers a
 * `page_view` from an effect on mount, which makes it a reliable signal.
 */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const buffered = (window as unknown as { cofresso?: { events: unknown[] } }).cofresso;
    return (buffered?.events.length ?? 0) > 0;
  });
}

/**
 * Clear the interruptions a real visitor has to get past before they can use the page: accept
 * the cookie banner, close the email-capture popup if it has already fired. Idempotent and a
 * no-op when nothing is showing (including when `UX_INTERRUPTIONS=off`), so specs can call it
 * after any navigation.
 */
export async function dismissInterruptions(page: Page) {
  // The banner is server-rendered, so it is on screen and clickable-looking before React has
  // attached any handlers. Without this the accept click can land on nothing.
  await waitForHydration(page);
  // Popup first: it is a modal, so its overlay sits over the cookie banner and would
  // swallow a click aimed at it.
  const popup = page.getByTestId('popup');
  if (await popup.isVisible()) {
    await page.getByTestId('popup-dismiss').click();
    await expect(popup).toBeHidden();
  }
  const banner = page.getByTestId('cookie-banner');
  if (await banner.isVisible()) {
    await page.getByTestId('consent-accept').click();
    await expect(banner).toBeHidden();
  }
}

export async function addToCart(
  page: Page,
  slug: string,
  options: { size?: string; subscription?: boolean } = {},
) {
  await page.goto(`/products/${slug}`);
  await dismissInterruptions(page);
  if (options.size) await page.getByRole('radio', { name: new RegExp(options.size) }).click();
  if (options.subscription) await page.getByRole('radio', { name: /subscribe/i }).click();
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  await expect(page.getByTestId('cart-drawer').getByTestId('cart-line').first()).toBeVisible();
}

export async function closeDrawer(page: Page) {
  await page.getByTestId('cart-drawer').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('cart-drawer')).toBeHidden();
}

export const TEST_CARD_OK = '4242 4242 4242 4242';
export const TEST_CARD_DECLINED = '4000 0000 0000 0002';
