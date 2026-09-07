import type { ImageKind, ProductCategory } from '@/lib/db/schema/values';
import type { HomeImageName } from './paths';

/**
 * The narrowest shape needed to describe a product, so both seed data
 * (`SeedProduct`) and database rows (`Product`) satisfy it.
 */
export interface AltProduct {
  name: string;
  origin?: string | null;
  tastingNotes: readonly string[];
  category: ProductCategory;
}

/** Trailing punctuation is dropped: screen readers pause on the element boundary anyway. */
function trim(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
}

function firstNotes(notes: readonly string[]): string | null {
  const picked = notes.slice(0, 2);
  if (picked.length === 0) return null;
  return picked.join(' and ');
}

export function productAltText(product: AltProduct, kind: ImageKind): string {
  const { name, category } = product;
  if (category === 'coffee') {
    const origin = product.origin ? ` from ${product.origin}` : '';
    const notes = firstNotes(product.tastingNotes);
    switch (kind) {
      case 'front':
        return trim(`A bag of Cofresso ${name} coffee${origin} on a cream linen backdrop`);
      case 'detail':
        return trim(
          `Close-up of roasted ${name} coffee beans${notes ? `, which taste of ${notes}` : ''}`,
        );
      case 'lifestyle':
        return trim(
          `A pour-over brewing scene with a bag of Cofresso ${name} on a sunlit kitchen counter`,
        );
      case 'packaging':
        return trim(`Hands holding a bag of Cofresso ${name} with the label facing the camera`);
    }
  }
  switch (kind) {
    case 'front':
      return trim(`A Cofresso ${name} on a cream linen backdrop`);
    case 'detail':
      return trim(`Close-up detail of a Cofresso ${name}`);
    case 'lifestyle':
      return trim(`A Cofresso ${name} in use on a sunlit kitchen counter`);
    case 'packaging':
      return trim(`Hands holding a Cofresso ${name}`);
  }
}

export function collectionAltText(collection: { name: string; description: string }): string {
  const summary = collection.description.split('.')[0]?.trim() ?? '';
  const lowered = summary ? summary.charAt(0).toLowerCase() + summary.slice(1) : '';
  return trim(`Cofresso ${collection.name} collection${lowered ? `: ${lowered}` : ''}`);
}

export function homeAltText(name: HomeImageName): string {
  return name === 'hero'
    ? 'Freshly roasted Cofresso coffee bags and a pour-over setup on a cream linen backdrop'
    : 'A Cofresso roaster weighing green coffee beside a sample roaster';
}

export function guideAltText(guide: { title: string; method: string }): string {
  return trim(`Brewing coffee with the ${guide.title} method`);
}
