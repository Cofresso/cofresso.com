import { interruptionsConfig } from './config';

export interface SocialProofToast {
  id: string;
  city: string;
  product: string;
  message: string;
}

export const TOAST_CITIES = [
  'Austin',
  'Portland',
  'Brooklyn',
  'Denver',
  'Seattle',
  'Chicago',
  'Oakland',
  'Nashville',
] as const;

/**
 * Names from the seeded catalog, hardcoded on purpose: the toasts are decoration and must
 * never cost a database read on the way to first paint.
 */
export const TOAST_PRODUCTS = [
  'Morning Frame',
  'Dark Mode Espresso',
  'Hot Reload Cold Brew Blend',
  'Night Build Decaf',
  'Ethiopia Yirgacheffe',
  'Colombia Huila',
  'Guatemala Antigua',
  'Kenya Nyeri AA',
  'Brazil Cerrado',
  'Sumatra Mandheling',
  'Costa Rica Tarrazú',
  'Peru Cajamarca',
  'Cofresso Ceramic Dripper',
  'Gooseneck Kettle',
  'Hand Grinder',
  'Brew Scale',
  'Cofresso Stoneware Mug',
] as const;

// Coprime with TOAST_PRODUCTS.length (17) so the walk visits a different product each step.
const PRODUCT_STRIDE = 5;

/**
 * Build the social-proof sequence for a session. Deterministic — no `Math.random()`, so the
 * server, the client and the e2e suite all agree on what the third toast says. Capped at
 * `toasts.maxPerSession`.
 */
export function buildToastSequence(count: number): SocialProofToast[] {
  const total = Math.min(Math.max(0, Math.floor(count)), interruptionsConfig.toasts.maxPerSession);
  return Array.from({ length: total }, (_, i) => {
    const city = TOAST_CITIES[i % TOAST_CITIES.length];
    const product = TOAST_PRODUCTS[(i * PRODUCT_STRIDE) % TOAST_PRODUCTS.length];
    return {
      id: `social-proof-${i}`,
      city,
      product,
      message: `Someone in ${city} just bought ${product}`,
    };
  });
}
