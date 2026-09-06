import { seedProducts } from './data';

export interface SeedReview {
  key: string;
  productSlug: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  daysAgo: number;
}

const authors = [
  'Priya R.',
  'Marcus L.',
  'Elena V.',
  'Tom H.',
  'Ayo B.',
  'Sofia M.',
  'Daniel K.',
  'Hana S.',
  'Luca P.',
  'Grace W.',
  'Omar F.',
  'Nina T.',
  'Jules A.',
  'Ravi N.',
  'Maya O.',
  'Ben C.',
];

const coffeeTemplates: Array<{
  rating: number;
  title: string;
  body: (notes: string[], name: string) => string;
}> = [
  {
    rating: 5,
    title: 'Exactly as described',
    body: (n, name) =>
      `The ${n[0]} note is right there from the first sip. ${name} has become my default morning coffee.`,
  },
  {
    rating: 5,
    title: 'Best pour over in months',
    body: (n) =>
      `Brewed on a V60 at 1:16 and got a gorgeous cup: ${n[0]}, ${n[1]}, and a clean finish.`,
  },
  {
    rating: 4,
    title: 'Great, a little pricey',
    body: (n) =>
      `Really enjoyable, especially the ${n[2] ?? n[0]} in the finish. Wish the 2 lb bag were a touch cheaper.`,
  },
  {
    rating: 4,
    title: 'Solid everyday cup',
    body: (_n, name) =>
      `${name} is consistent bag to bag, which is more than I can say for most roasters.`,
  },
  {
    rating: 5,
    title: 'Subscription was the right call',
    body: () =>
      'Signed up for every four weeks and the roast date is always within a week of delivery. Fresh every time.',
  },
  {
    rating: 3,
    title: 'Not for me, but well roasted',
    body: (n) =>
      `The ${n[0]} was more pronounced than I like. Roast quality is clearly high though.`,
  },
];

const gearTemplates: Array<{ rating: number; title: string; body: (name: string) => string }> = [
  {
    rating: 5,
    title: 'Well made',
    body: (name) =>
      `The ${name} feels far more premium than the price. Packaging was thoughtful too.`,
  },
  {
    rating: 4,
    title: 'Does the job',
    body: (name) =>
      `${name} works exactly as advertised. Took a star because shipping took a few days longer than expected.`,
  },
  {
    rating: 5,
    title: 'Upgraded my whole setup',
    body: () =>
      'Paired it with the Morning Frame subscription and my kitchen counter looks like a cafe now.',
  },
];

export function buildSeedReviews(): SeedReview[] {
  const out: SeedReview[] = [];
  seedProducts.forEach((product, pIndex) => {
    const count = product.category === 'coffee' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const author = authors[(pIndex * 3 + i) % authors.length];
      if (product.category === 'coffee') {
        const t = coffeeTemplates[(pIndex + i) % coffeeTemplates.length];
        out.push({
          key: `${product.slug}:${i}`,
          productSlug: product.slug,
          authorName: author,
          rating: t.rating,
          title: t.title,
          body: t.body(product.tastingNotes, product.name),
          verified: i !== 2,
          daysAgo: 4 + pIndex * 5 + i * 9,
        });
      } else {
        const t = gearTemplates[(pIndex + i) % gearTemplates.length];
        out.push({
          key: `${product.slug}:${i}`,
          productSlug: product.slug,
          authorName: author,
          rating: t.rating,
          title: t.title,
          body: t.body(product.name),
          verified: true,
          daysAgo: 6 + pIndex * 4 + i * 11,
        });
      }
    }
  });
  return out;
}
