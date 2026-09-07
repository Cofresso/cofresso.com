import Link from 'next/link';
import { ProductThumbnail } from '@/components/product/product-thumbnail';
import { Badge } from '@/components/ui/badge';
import { grindLabel, purchaseTypeLabel } from '@/lib/catalog/labels';
import type { OrderView } from '@/lib/checkout/queries';
import { formatPrice } from '@/lib/pricing';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' });

export function OrderDetails({ order }: { order: OrderView }) {
  const t = order.totals;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]" data-testid="order-details">
      <div className="flex flex-col gap-6">
        <div className="bg-foam rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-latte text-xs tracking-wide uppercase">Order number</p>
              <p className="font-display text-3xl" data-testid="order-number">
                {order.orderNumber}
              </p>
            </div>
            <Badge tone={order.status === 'paid' ? 'leaf' : 'neutral'} className="capitalize">
              {order.status}
            </Badge>
          </div>
          <p className="text-latte mt-2 text-sm">
            Placed {dateFormat.format(order.createdAt)} · Confirmation sent to {order.email}
          </p>
        </div>

        <ul className="divide-latte/20 bg-foam divide-y rounded-2xl px-6">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <ProductThumbnail
                image={{ src: item.imagePath, alt: item.productName }}
                className="w-16"
                sizes="64px"
                decorative
              />
              <div className="flex-1 text-sm">
                <Link
                  href={`/products/${item.productSlug}`}
                  className="hover:text-copper font-medium"
                >
                  {item.productName}
                </Link>
                <p className="text-latte text-xs">
                  {[
                    item.variantName,
                    grindLabel(item.grind),
                    purchaseTypeLabel(item.purchaseType, item.subscriptionIntervalWeeks),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="text-latte text-xs">
                  Qty {item.quantity} × {formatPrice(item.unitPriceCents)}
                </p>
              </div>
              <p className="text-sm tabular-nums">{formatPrice(item.lineTotalCents)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-foam rounded-2xl p-6">
          <h2 className="text-lg">Ship to</h2>
          <address className="mt-2 text-sm leading-relaxed not-italic">
            {order.shipping.name}
            <br />
            {order.shipping.address1}
            <br />
            {order.shipping.address2 ? (
              <>
                {order.shipping.address2}
                <br />
              </>
            ) : null}
            {order.shipping.city}, {order.shipping.state} {order.shipping.postalCode}
            <br />
            {order.shipping.country}
          </address>
        </div>
        <div className="bg-foam rounded-2xl p-6">
          <h2 className="text-lg">Payment</h2>
          <p className="mt-2 text-sm">
            {order.cardLast4 ? `Card ending in ${order.cardLast4}` : 'Simulated payment'}
          </p>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(t.subtotalCents)}</dd>
            </div>
            {t.discountCents > 0 ? (
              <div className="text-leaf flex justify-between">
                <dt>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</dt>
                <dd className="tabular-nums">−{formatPrice(t.discountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd className="tabular-nums">
                {t.shippingCents === 0 ? 'Free' : formatPrice(t.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd className="tabular-nums">{formatPrice(t.taxCents)}</dd>
            </div>
            <div className="border-latte/30 flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums" data-testid="order-total">
                {formatPrice(t.totalCents)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
