import { cache } from 'react';
import { readCartId } from './cookie';
import { getCartView } from './queries';
import type { CartView } from './types';

/**
 * The cart for the current request, read at most once per request.
 *
 * The header (item count) and the cart drawer both render on every page, so without this
 * they would each issue their own cart query. `cache` from React dedupes the call for the
 * lifetime of a single server request, so the layout costs one cart read regardless of how
 * many components ask for it.
 */
export const getCurrentCart = cache(async (): Promise<CartView | null> => {
  const id = await readCartId();
  return id ? getCartView(id) : null;
});
