import { cookies } from 'next/headers';

export const CART_COOKIE_NAME = 'cofresso_cart';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function readCartId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CART_COOKIE_NAME)?.value;
  return value && /^[0-9a-f-]{36}$/.test(value) ? value : null;
}

export async function writeCartId(id: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS,
  });
}

export async function clearCartCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE_NAME);
}
