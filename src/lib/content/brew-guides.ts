import { brewGuides, type BrewGuide } from '@/content/brew-guides';

export { brewGuides };
export type { BrewGuide };

export function getBrewGuide(slug: string): BrewGuide | undefined {
  return brewGuides.find((g) => g.slug === slug);
}
