import { roastLabel } from '@/lib/catalog/labels';
import type { Product } from '@/lib/db/schema';

export function ProductDetails({ product }: { product: Product }) {
  const rows: Array<[string, string | null | undefined]> = [
    ['Origin', product.origin],
    ['Region', product.region],
    ['Producer', product.producer],
    ['Altitude', product.altitudeM ? `${product.altitudeM.toLocaleString()} m` : null],
    ['Process', product.process],
    ['Roast', roastLabel(product.roastLevel)],
  ];
  const visible = rows.filter(([, v]) => v);
  if (visible.length === 0) return null;
  return (
    <dl
      className="bg-foam grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl p-6 text-sm sm:grid-cols-3"
      data-testid="product-details"
    >
      {visible.map(([k, v]) => (
        <div key={k}>
          <dt className="text-latte text-xs tracking-wide uppercase">{k}</dt>
          <dd className="mt-0.5 font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
