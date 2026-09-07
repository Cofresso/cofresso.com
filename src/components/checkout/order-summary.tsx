import { CartSummary } from '@/components/cart/cart-summary';
import { ProductThumbnail } from '@/components/product/product-thumbnail';
import type { CartView } from '@/lib/cart/types';
import { grindLabel, purchaseTypeLabel } from '@/lib/catalog/labels';
import { formatPrice } from '@/lib/pricing';

export function OrderSummary({ cart }: { cart: CartView }) {
  return (
    <aside
      className="bg-foam rounded-2xl p-6 shadow-sm lg:sticky lg:top-28"
      data-testid="order-summary"
    >
      <h2 className="text-xl">Order summary</h2>
      <ul className="divide-latte/20 mt-4 divide-y">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex items-center gap-3 py-3">
            <span className="relative shrink-0">
              <ProductThumbnail
                image={line.product.image}
                className="w-14"
                sizes="56px"
                decorative
              />
              <span className="bg-espresso text-foam absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
                {line.quantity}
              </span>
            </span>
            <span className="flex-1 text-sm">
              <span className="block font-medium">{line.product.name}</span>
              <span className="text-latte block text-xs">
                {[
                  line.variant.name,
                  grindLabel(line.grind),
                  purchaseTypeLabel(line.purchaseType, line.subscriptionIntervalWeeks),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className="text-sm tabular-nums">{formatPrice(line.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
      <div className="border-latte/20 mt-4 border-t pt-4">
        <CartSummary totals={cart.totals} discountCode={cart.discountCode} />
      </div>
    </aside>
  );
}
