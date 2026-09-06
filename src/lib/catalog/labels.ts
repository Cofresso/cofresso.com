import type { Grind, ProductCategory, PurchaseType, RoastLevel } from '@/lib/db/schema';

const grinds: Record<Grind, string> = {
  whole_bean: 'Whole bean',
  drip: 'Drip',
  espresso: 'Espresso',
  french_press: 'French press',
  pour_over: 'Pour over',
};

const roasts: Record<RoastLevel, string> = {
  light: 'Light',
  medium: 'Medium',
  medium_dark: 'Medium-dark',
  dark: 'Dark',
};

const categories: Record<ProductCategory, string> = {
  coffee: 'Coffee',
  equipment: 'Equipment',
  merch: 'Merch',
};

export const GRIND_OPTIONS = (Object.keys(grinds) as Grind[]).map((value) => ({
  value,
  label: grinds[value],
}));
export const ROAST_OPTIONS = (Object.keys(roasts) as RoastLevel[]).map((value) => ({
  value,
  label: roasts[value],
}));

export function grindLabel(grind: Grind | null | undefined): string {
  return grind ? grinds[grind] : '';
}

export function roastLabel(level: RoastLevel | null | undefined): string {
  return level ? roasts[level] : '';
}

export function categoryLabel(category: ProductCategory): string {
  return categories[category];
}

export function intervalLabel(weeks: number): string {
  return `Every ${weeks} weeks`;
}

export function purchaseTypeLabel(type: PurchaseType, weeks: number | null): string {
  return type === 'subscription' && weeks ? `Subscription · ${intervalLabel(weeks)}` : 'One-time';
}
