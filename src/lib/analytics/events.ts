export interface AnalyticsItem {
  productId: string;
  slug: string;
  name: string;
  variantId?: string;
  variantName?: string;
  priceCents: number;
  quantity?: number;
  purchaseType?: 'one_time' | 'subscription';
}

export type AnalyticsEvent =
  | { name: 'page_view'; path: string; title?: string }
  | { name: 'view_item_list'; listId: string; items: AnalyticsItem[] }
  | { name: 'view_item'; item: AnalyticsItem }
  | { name: 'select_variant'; item: AnalyticsItem }
  | { name: 'add_to_cart'; item: AnalyticsItem; cartItemCount: number }
  | { name: 'remove_from_cart'; item: AnalyticsItem }
  | { name: 'view_cart'; valueCents: number; itemCount: number }
  | { name: 'begin_checkout'; valueCents: number; itemCount: number }
  | { name: 'add_shipping_info'; valueCents: number }
  | { name: 'add_payment_info'; valueCents: number }
  | {
      name: 'purchase';
      orderNumber: string;
      valueCents: number;
      items: AnalyticsItem[];
      discountCode?: string | null;
    }
  | { name: 'apply_promo'; code: string; success: boolean }
  | { name: 'newsletter_signup'; source: string }
  | { name: 'search'; query: string; resultCount: number };

export type AnalyticsEventName = AnalyticsEvent['name'];

export interface TrackedEvent {
  event: AnalyticsEvent;
  timestamp: string;
}
