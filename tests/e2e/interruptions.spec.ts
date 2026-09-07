import { expect, test, type Page } from '@playwright/test';
import { interruptionsConfig } from '../../src/lib/interruptions/config';
import { addToCart } from './helpers';

const { popup, chat, toasts, announcement } = interruptionsConfig;

/**
 * Gate on hydration before interacting: an unhydrated button swallows the click silently, and
 * Playwright's actionability checks cannot tell the difference. `AnalyticsProvider` buffers a
 * `page_view` from an effect on mount, which makes it a reliable signal.
 */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const buffered = (window as unknown as { cofresso?: { events: unknown[] } }).cofresso;
    return (buffered?.events.length ?? 0) > 0;
  });
}

/** Local noon, well clear of midnight so the countdown assertions have room either side. */
const CLOCK_START = new Date('2026-09-06T12:00:00-07:00');

/**
 * Load a page with time stopped at `CLOCK_START`, so every timed interruption below fires
 * exactly when the test says and never a moment sooner.
 *
 * `page.clock.install()` on its own leaves the clock auto-advancing in real time — the pause
 * is what makes these tests deterministic rather than merely fast. Pausing before the
 * navigation also means page load itself consumes no clock time, so the offsets are measured
 * from a known zero.
 */
async function freezeClock(page: Page) {
  await page.clock.install({ time: CLOCK_START });
  await page.clock.pauseAt(CLOCK_START);
}

async function openWithFrozenClock(page: Page, path: string) {
  await freezeClock(page);
  await page.goto(path);
  await waitForHydration(page);
}

/**
 * Close the popup and let its close transition finish. `Modal` keeps the panel mounted for
 * 200ms so the fade-out can play, which under a frozen clock would otherwise never elapse —
 * the panel is genuinely still on screen, just transparent and click-through.
 */
async function dismissPopup(page: Page) {
  await page.getByTestId('popup-dismiss').click();
  await page.clock.fastForward(500);
  await expect(page.getByTestId('popup')).toBeHidden();
}

test.describe('email capture popup', () => {
  test('opens after the configured delay and can be dismissed', async ({ page }) => {
    await openWithFrozenClock(page, '/');
    await expect(page.getByTestId('popup')).toBeHidden();

    await page.clock.fastForward(popup.delayMs);
    await expect(page.getByTestId('popup')).toBeVisible();
    await expect(page.getByTestId('popup-form')).toBeVisible();

    await dismissPopup(page);
  });

  test('opens on exit intent', async ({ page }) => {
    await openWithFrozenClock(page, '/');
    await expect(page.getByTestId('popup')).toBeHidden();

    // The pointer leaving through the top of the window. Playwright cannot move the mouse
    // outside the viewport, so the event is dispatched on <html> where the listener lives.
    await page.dispatchEvent('html', 'mouseleave', { clientY: 0 });
    await expect(page.getByTestId('popup')).toBeVisible();
  });

  test('signing up reveals the discount code', async ({ page }) => {
    await openWithFrozenClock(page, '/');
    await page.clock.fastForward(popup.delayMs);

    const dialog = page.getByTestId('popup');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').fill(`popup-${Date.now()}@example.com`);
    await dialog.getByRole('button', { name: 'Send me the code' }).click();

    await expect(page.getByTestId('popup-success')).toBeVisible();
    await expect(page.getByTestId('popup-code')).toHaveText(popup.code);
    await expect(page.getByTestId('popup-form')).toHaveCount(0);
  });

  test('stays dismissed across a reload', async ({ page }) => {
    await openWithFrozenClock(page, '/');
    await page.clock.fastForward(popup.delayMs);
    await expect(page.getByTestId('popup')).toBeVisible();
    await dismissPopup(page);

    await page.reload();
    await waitForHydration(page);
    await page.clock.fastForward(popup.delayMs * 3);
    await expect(page.getByTestId('popup')).toBeHidden();
  });

  test('never appears on checkout or order lookup', async ({ page }) => {
    await freezeClock(page);
    await addToCart(page, 'brew-scale');

    // Navigating away rather than closing the drawer: the drawer's close transition is on a
    // timer, and this test owns the clock.
    await page.goto('/checkout');
    await waitForHydration(page);
    await page.clock.fastForward(popup.delayMs * 3);
    await expect(page.getByTestId('popup')).toBeHidden();
    await expect(page.getByTestId('step-contact')).toBeVisible();

    await page.goto('/orders');
    await waitForHydration(page);
    await page.clock.fastForward(popup.delayMs * 3);
    await expect(page.getByTestId('popup')).toBeHidden();

    // ...but it is still due on a route that is not excluded.
    await page.goto('/shop');
    await waitForHydration(page);
    await page.clock.fastForward(popup.delayMs);
    await expect(page.getByTestId('popup')).toBeVisible();
  });
});

test.describe('cookie consent', () => {
  const sdkTag = (page: Page) => page.locator('script#coframe-sdk');

  test('accepting persists across a reload and releases the SDK slot', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await expect(page.getByTestId('cookie-banner')).toBeVisible();
    await expect(sdkTag(page)).toHaveCount(0);

    await page.getByTestId('consent-accept').click();
    await expect(page.getByTestId('cookie-banner')).toBeHidden();

    await page.reload();
    await expect(page.getByTestId('cookie-banner')).toBeHidden();
    await expect(sdkTag(page)).toHaveCount(1);
    await expect(sdkTag(page)).toHaveAttribute('data-site-key', 'test-key');
    await page.waitForFunction(
      () => (window as unknown as { __coframeSdkStub?: boolean }).__coframeSdkStub === true,
    );
  });

  test('rejecting non-essential cookies keeps the SDK slot closed', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await page.getByTestId('consent-reject').click();
    await expect(page.getByTestId('cookie-banner')).toBeHidden();

    await page.reload();
    await expect(page.getByTestId('cookie-banner')).toBeHidden();
    await expect(sdkTag(page)).toHaveCount(0);
  });

  test('saving the toggles under Manage counts as a decision', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await page.getByTestId('consent-manage').click();
    await page.getByLabel('Analytics').uncheck();
    await page.getByTestId('consent-save').click();
    await expect(page.getByTestId('cookie-banner')).toBeHidden();

    await page.reload();
    await expect(page.getByTestId('cookie-banner')).toBeHidden();
    await expect(sdkTag(page)).toHaveCount(0);
  });
});

test.describe('chat bubble', () => {
  test('opens and answers a quick reply from the script', async ({ page }) => {
    await openWithFrozenClock(page, '/');

    await page.getByTestId('chat-bubble').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    await expect(page.getByTestId('chat-message')).toHaveCount(1);

    await page.getByTestId('chat-reply-1').click();
    // The question is echoed straight away; the answer waits for the typing indicator.
    await expect(page.getByTestId('chat-message')).toHaveCount(2);
    await expect(page.getByTestId('chat-typing')).toBeVisible();

    await page.clock.fastForward(chat.typingMs);
    await expect(page.getByTestId('chat-typing')).toBeHidden();
    await expect(page.getByTestId('chat-message')).toHaveCount(3);
    await expect(page.getByTestId('chat-message').last()).toContainText('Dark Mode Espresso');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chat-panel')).toBeHidden();
    // Focus has to come back to the bubble, which is display:none while the panel is open.
    await expect(page.getByTestId('chat-bubble')).toBeFocused();
  });

  test('shows an unread badge until it is opened', async ({ page }) => {
    await openWithFrozenClock(page, '/');
    await expect(page.getByTestId('chat-unread')).toBeHidden();

    await page.clock.fastForward(chat.unreadAfterMs);
    await expect(page.getByTestId('chat-unread')).toBeVisible();

    // The popup is due by now too — clear it the way a visitor would. (The cookie banner can
    // stay: the bubble lifts clear of it.)
    await dismissPopup(page);
    await page.getByTestId('chat-bubble').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    await page.getByRole('button', { name: 'Close chat' }).click();

    await expect(page.getByTestId('chat-unread')).toBeHidden();
    await page.clock.fastForward(chat.unreadAfterMs * 2);
    await expect(page.getByTestId('chat-unread')).toBeHidden();
  });
});

test.describe('social proof toasts', () => {
  test('appear on the configured schedule and dismiss both ways', async ({ page }) => {
    // Order lookup: the popup is excluded here, so it can never pause the toast sequence
    // halfway through this test.
    await openWithFrozenClock(page, '/orders');
    const toast = page.getByTestId('toast');
    await expect(toast).toBeHidden();

    await page.clock.fastForward(toasts.firstAfterMs);
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Someone in \w+ just bought \S/);

    await page.clock.fastForward(toasts.visibleMs);
    await expect(toast).toBeHidden();

    await page.clock.fastForward(toasts.intervalMs);
    await expect(toast).toBeVisible();
    await page.getByTestId('toast-dismiss').click();
    await expect(toast).toBeHidden();
  });
});

test.describe('announcement rotator', () => {
  // Pinned so "how long until local midnight" has one right answer.
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('rotates to a ticking countdown to local midnight', async ({ page }) => {
    // Order lookup, so the popup cannot cover the header partway through.
    await openWithFrozenClock(page, '/orders');

    const bar = page.getByTestId('announcement-bar');
    await expect(bar).toContainText('Free shipping on orders over $45');
    await expect(page.getByTestId('announcement-countdown')).toHaveCount(0);

    await page.clock.fastForward(announcement.rotateMs);
    const countdown = page.getByTestId('announcement-countdown');
    await expect(bar).toContainText("Today's roast drop ends in");
    await expect(countdown).toHaveText('11:59:54');

    await page.clock.fastForward(2_000);
    await expect(countdown).toHaveText('11:59:52');
  });
});

test.describe('deferred sections', () => {
  test('the product page renders reviews and related products only once scrolled to', async ({
    page,
  }) => {
    await page.goto('/products/morning-frame');
    await expect(page.getByTestId('deferred-pending')).toHaveCount(2);
    await expect(page.getByTestId('reviews')).toHaveCount(0);
    await expect(page.getByTestId('product-grid')).toHaveCount(0);

    await page.getByRole('heading', { name: 'What people are brewing' }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId('reviews')).toBeVisible();

    await page.getByRole('heading', { name: 'Pairs well with' }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId('product-grid')).toBeVisible();
    await expect(page.getByTestId('deferred-pending')).toHaveCount(0);
  });

  test('the home page renders the reviews strip only once scrolled to', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('deferred-pending')).toHaveCount(1);
    await expect(page.getByTestId('reviews-strip')).toHaveCount(0);

    await page.getByRole('heading', { name: 'From the inbox' }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId('reviews-strip')).toBeVisible();
    await expect(page.getByTestId('deferred-pending')).toHaveCount(0);
  });
});
