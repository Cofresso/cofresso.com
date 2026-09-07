// Stand-in for the Coframe SDK, loaded only by the Playwright suite: playwright.config.ts
// points COFRAME_SCRIPT_URL here so the consent-gating spec can prove the tag really loads
// without any test reaching the real CDN. Nothing in the app references this file.
window.__coframeSdkStub = true;
