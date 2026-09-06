import type { DiscountKind, ProductCategory, RoastLevel } from '@/lib/db/schema';

export type ArtShape = 'bag' | 'kettle' | 'dripper' | 'grinder' | 'scale' | 'filters' | 'mug';

export interface SeedVariant {
  sku: string;
  name: string;
  weightGrams: number | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stockQuantity: number;
}

export interface SeedProduct {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ProductCategory;
  origin?: string;
  region?: string;
  producer?: string;
  altitudeM?: number;
  process?: string;
  roastLevel?: RoastLevel;
  tastingNotes: string[];
  featured?: boolean;
  collections: string[];
  variants: SeedVariant[];
  art: { shape: ArtShape; accent: string; label?: string };
}

export interface SeedCollection {
  slug: string;
  name: string;
  description: string;
  position: number;
}

export interface SeedDiscountCode {
  code: string;
  kind: DiscountKind;
  value: number;
  minSubtotalCents: number;
}

export const seedCollections: SeedCollection[] = [
  {
    slug: 'single-origin',
    name: 'Single Origin',
    description: 'One farm, one region, one story in the cup.',
    position: 1,
  },
  {
    slug: 'blends',
    name: 'Blends',
    description: 'Balanced profiles built for every day and every brewer.',
    position: 2,
  },
  {
    slug: 'decaf',
    name: 'Decaf',
    description: 'Sugarcane and Swiss Water processed. All flavor, no jitters.',
    position: 3,
  },
  {
    slug: 'equipment',
    name: 'Equipment',
    description: 'The tools we use on our own bar.',
    position: 4,
  },
];

const coffeeSizes = (base: number, stock = 120): SeedVariant[] => [
  { sku: '', name: '12 oz', weightGrams: 340, priceCents: base, stockQuantity: stock },
  {
    sku: '',
    name: '2 lb',
    weightGrams: 907,
    priceCents: Math.round(base * 2.45),
    stockQuantity: Math.round(stock / 3),
  },
  {
    sku: '',
    name: '5 lb',
    weightGrams: 2268,
    priceCents: Math.round(base * 5.4),
    stockQuantity: Math.round(stock / 8),
  },
];

function withSkus(slug: string, variants: SeedVariant[]): SeedVariant[] {
  return variants.map((v, i) => ({
    ...v,
    sku: `${slug.toUpperCase().replace(/-/g, '')}-${i + 1}`,
  }));
}

export const seedProducts: SeedProduct[] = [
  {
    slug: 'morning-frame',
    name: 'Morning Frame',
    tagline: 'Our house blend. Sweet, structured, dependable.',
    description:
      'Morning Frame is the coffee we reach for before anything else is decided. Brazilian body carries Colombian brightness into a cup that tastes like milk chocolate, toasted hazelnut and a whisper of red apple. It holds up in a French press, sings through a pour over, and takes milk without losing its shape.',
    category: 'coffee',
    origin: 'Brazil & Colombia',
    region: 'Cerrado Mineiro / Huila',
    producer: 'Cooperative lots',
    altitudeM: 1400,
    process: 'Natural & washed',
    roastLevel: 'medium',
    tastingNotes: ['milk chocolate', 'hazelnut', 'red apple'],
    featured: true,
    collections: ['blends'],
    variants: withSkus('morning-frame', coffeeSizes(1800, 200)),
    art: { shape: 'bag', accent: '#C8763A' },
  },
  {
    slug: 'dark-mode-espresso',
    name: 'Dark Mode Espresso',
    tagline: 'Deep, syrupy and built for pressure.',
    description:
      'Dark Mode is our espresso blend for people who like their shots heavy. Sumatra brings the earthy weight, Guatemala brings the cocoa, and a touch of natural Ethiopia keeps the finish from going flat. Expect dark chocolate, molasses and a long, dried-fig finish. Also excellent as a moka pot coffee.',
    category: 'coffee',
    origin: 'Sumatra, Guatemala & Ethiopia',
    region: 'Multi-region',
    producer: 'Selected lots',
    altitudeM: 1500,
    process: 'Wet-hulled, washed & natural',
    roastLevel: 'dark',
    tastingNotes: ['dark chocolate', 'molasses', 'dried fig'],
    featured: true,
    collections: ['blends'],
    variants: withSkus('dark-mode-espresso', coffeeSizes(1900, 160)),
    art: { shape: 'bag', accent: '#33201A' },
  },
  {
    slug: 'hot-reload-cold-brew',
    name: 'Hot Reload Cold Brew Blend',
    tagline: 'Coarse-ground for cold brew. Smooth, chocolatey, refreshing.',
    description:
      'A blend designed from the start for long, cold extraction. Low acidity, huge body, and a finish that tastes like cocoa nibs and vanilla. Ships whole bean or coarse ground. Steep 16 hours at a 1:8 ratio and dilute to taste.',
    category: 'coffee',
    origin: 'Brazil & Peru',
    region: 'Mogiana / Cajamarca',
    producer: 'Cooperative lots',
    altitudeM: 1200,
    process: 'Natural & washed',
    roastLevel: 'medium_dark',
    tastingNotes: ['cocoa nib', 'vanilla', 'brown sugar'],
    collections: ['blends'],
    variants: withSkus('hot-reload-cold-brew', coffeeSizes(1750, 90)),
    art: { shape: 'bag', accent: '#5F7A5A' },
  },
  {
    slug: 'night-build-decaf',
    name: 'Night Build Decaf',
    tagline: 'Sugarcane decaf that still tastes like coffee.',
    description:
      'Night Build is a Colombian decaf processed with ethyl acetate derived from sugarcane, a method that keeps far more of the origin character than most decafs. Caramel sweetness, a soft cherry note and a clean finish. Roasted a shade darker so it holds up with milk late at night.',
    category: 'coffee',
    origin: 'Colombia',
    region: 'Huila',
    producer: 'Descafecol process',
    altitudeM: 1700,
    process: 'Sugarcane EA decaf',
    roastLevel: 'medium_dark',
    tastingNotes: ['caramel', 'cherry', 'graham cracker'],
    collections: ['decaf'],
    variants: withSkus('night-build-decaf', coffeeSizes(1850, 80)),
    art: { shape: 'bag', accent: '#4A2C24' },
  },
  {
    slug: 'ethiopia-yirgacheffe',
    name: 'Ethiopia Yirgacheffe',
    tagline: 'Floral, tea-like, unmistakably Ethiopian.',
    description:
      'Grown between 1,900 and 2,100 meters in the Gedeo zone and washed at the Idido station, this Yirgacheffe is the coffee people mean when they say coffee can taste like flowers. Jasmine, bergamot and a lemon-drop acidity that softens into honey as the cup cools. Best as a pour over.',
    category: 'coffee',
    origin: 'Ethiopia',
    region: 'Yirgacheffe, Gedeo',
    producer: 'Idido washing station',
    altitudeM: 2000,
    process: 'Washed',
    roastLevel: 'light',
    tastingNotes: ['jasmine', 'bergamot', 'lemon drop'],
    featured: true,
    collections: ['single-origin'],
    variants: withSkus('ethiopia-yirgacheffe', coffeeSizes(2200, 110)),
    art: { shape: 'bag', accent: '#D9A441' },
  },
  {
    slug: 'colombia-huila',
    name: 'Colombia Huila',
    tagline: 'Juicy, sweet and impossible to dislike.',
    description:
      'From smallholder farms around Pitalito in southern Huila, this washed lot is the definition of a crowd-pleaser. Panela sweetness, red grape and a bright orange acidity that stays lively through the whole mug. Works in every brewer we have tried.',
    category: 'coffee',
    origin: 'Colombia',
    region: 'Pitalito, Huila',
    producer: 'Asociación smallholders',
    altitudeM: 1750,
    process: 'Washed',
    roastLevel: 'medium',
    tastingNotes: ['panela', 'red grape', 'orange'],
    featured: true,
    collections: ['single-origin'],
    variants: withSkus('colombia-huila', coffeeSizes(1950, 140)),
    art: { shape: 'bag', accent: '#B5473C' },
  },
  {
    slug: 'guatemala-antigua',
    name: 'Guatemala Antigua',
    tagline: 'Cocoa, spice and volcanic depth.',
    description:
      'Antigua sits in a valley ringed by three volcanoes, and the coffee tastes like it: dense, chocolatey and a little smoky at the edges. This lot from Finca El Valle brings baking spice and a toffee finish. A classic for drip brewers and anyone who takes their coffee with a splash of cream.',
    category: 'coffee',
    origin: 'Guatemala',
    region: 'Antigua, Sacatepéquez',
    producer: 'Finca El Valle',
    altitudeM: 1600,
    process: 'Washed',
    roastLevel: 'medium',
    tastingNotes: ['cocoa', 'baking spice', 'toffee'],
    collections: ['single-origin'],
    variants: withSkus('guatemala-antigua', coffeeSizes(2000, 100)),
    art: { shape: 'bag', accent: '#7A4E3A' },
  },
  {
    slug: 'kenya-nyeri',
    name: 'Kenya Nyeri AA',
    tagline: 'Blackcurrant, tomato leaf and electric acidity.',
    description:
      'Kenyan coffees are the loudest coffees in the world, and this AA from the Gatomboya factory in Nyeri is no exception. Blackcurrant, a savory tomato-leaf note that sounds strange and tastes wonderful, and a finish like brown sugar. Light roasted to keep every bit of it.',
    category: 'coffee',
    origin: 'Kenya',
    region: 'Nyeri',
    producer: 'Gatomboya factory',
    altitudeM: 1800,
    process: 'Washed, double fermented',
    roastLevel: 'light',
    tastingNotes: ['blackcurrant', 'tomato leaf', 'brown sugar'],
    collections: ['single-origin'],
    variants: withSkus('kenya-nyeri', coffeeSizes(2400, 70)),
    art: { shape: 'bag', accent: '#8A2E3B' },
  },
  {
    slug: 'brazil-cerrado',
    name: 'Brazil Cerrado',
    tagline: 'Nutty, low-acid comfort coffee.',
    description:
      'A natural-process Brazil from the high plateau of Cerrado Mineiro. Roasted peanut, milk chocolate and a soft, rounded body with almost no acidity. This is the coffee for large mugs, long mornings and anyone who has ever said they like coffee that tastes like coffee.',
    category: 'coffee',
    origin: 'Brazil',
    region: 'Cerrado Mineiro',
    producer: 'Fazenda Santa Inês',
    altitudeM: 1150,
    process: 'Natural',
    roastLevel: 'medium_dark',
    tastingNotes: ['roasted peanut', 'milk chocolate', 'cream'],
    collections: ['single-origin'],
    variants: withSkus('brazil-cerrado', coffeeSizes(1700, 180)),
    art: { shape: 'bag', accent: '#A08977' },
  },
  {
    slug: 'sumatra-mandheling',
    name: 'Sumatra Mandheling',
    tagline: 'Earthy, herbal and heavy as a blanket.',
    description:
      'Wet-hulled in the traditional Sumatran way, this Mandheling is thick, low-acid and full of cedar, dark chocolate and dried herbs. It is polarizing and we love it. Try it in a French press or as the base of a moka pot latte.',
    category: 'coffee',
    origin: 'Indonesia',
    region: 'Lintong, North Sumatra',
    producer: 'Smallholder collectors',
    altitudeM: 1400,
    process: 'Wet-hulled (Giling Basah)',
    roastLevel: 'dark',
    tastingNotes: ['cedar', 'dark chocolate', 'dried herbs'],
    collections: ['single-origin'],
    variants: withSkus('sumatra-mandheling', coffeeSizes(1900, 60)),
    art: { shape: 'bag', accent: '#2F3A2E' },
  },
  {
    slug: 'costa-rica-tarrazu',
    name: 'Costa Rica Tarrazú',
    tagline: 'Honey processed. Clean, sweet, apricot-bright.',
    description:
      'From a micro-mill in the Tarrazú highlands, this honey-processed lot keeps a layer of mucilage on the bean during drying, which shows up as apricot sweetness and a silky body. Balanced enough for espresso, expressive enough for filter.',
    category: 'coffee',
    origin: 'Costa Rica',
    region: 'Tarrazú',
    producer: 'Micro-mill La Lía',
    altitudeM: 1900,
    process: 'Yellow honey',
    roastLevel: 'light',
    tastingNotes: ['apricot', 'honey', 'almond'],
    collections: ['single-origin'],
    variants: withSkus('costa-rica-tarrazu', coffeeSizes(2100, 75)),
    art: { shape: 'bag', accent: '#E0A458' },
  },
  {
    slug: 'peru-cajamarca',
    name: 'Peru Cajamarca',
    tagline: 'Gentle, sweet and organic.',
    description:
      'Certified organic coffee from smallholder farms in the Cajamarca region of northern Peru. Soft citrus, caramel and a nougat-like finish. An easy-drinking, everyday single origin with a lot more nuance than its price suggests.',
    category: 'coffee',
    origin: 'Peru',
    region: 'Cajamarca',
    producer: 'Cooperativa Sol y Café',
    altitudeM: 1800,
    process: 'Washed',
    roastLevel: 'medium',
    tastingNotes: ['caramel', 'soft citrus', 'nougat'],
    collections: ['single-origin'],
    variants: withSkus('peru-cajamarca', coffeeSizes(1800, 130)),
    art: { shape: 'bag', accent: '#6B8E6B' },
  },
  {
    slug: 'pour-over-dripper',
    name: 'Cofresso Ceramic Dripper',
    tagline: 'A cone dripper with a single large hole and a lot of patience.',
    description:
      'Our house dripper, made from matte stoneware in the cream of our logo. A single large outlet and spiral ribs give you full control over flow rate. Fits size 02 cone filters and most mugs and servers.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [
      { sku: 'DRIPPER-1', name: 'Size 02', weightGrams: 380, priceCents: 3200, stockQuantity: 45 },
    ],
    art: { shape: 'dripper', accent: '#F6F1EB' },
  },
  {
    slug: 'gooseneck-kettle',
    name: 'Gooseneck Kettle',
    tagline: 'Precise pours, 1.0 L, stovetop or induction.',
    description:
      'A stainless gooseneck kettle with a counter-balanced handle and a built-in thermometer in the lid. The spout produces a thin, controllable stream that makes blooms and pulse pours effortless.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [
      {
        sku: 'KETTLE-1',
        name: 'Matte black',
        weightGrams: 900,
        priceCents: 6800,
        stockQuantity: 30,
      },
      {
        sku: 'KETTLE-2',
        name: 'Brushed steel',
        weightGrams: 900,
        priceCents: 6400,
        compareAtPriceCents: 6800,
        stockQuantity: 18,
      },
    ],
    art: { shape: 'kettle', accent: '#33201A' },
  },
  {
    slug: 'hand-grinder',
    name: 'Hand Grinder',
    tagline: 'Stainless conical burrs, 40 click settings.',
    description:
      'A compact hand grinder with 38 mm stainless conical burrs and a stepped adjustment dial that goes from Turkish to French press. Grinds 30 grams in about 45 seconds. Ships with a carrying case.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [
      { sku: 'GRINDER-1', name: 'Standard', weightGrams: 480, priceCents: 9900, stockQuantity: 22 },
    ],
    art: { shape: 'grinder', accent: '#A08977' },
  },
  {
    slug: 'brew-scale',
    name: 'Brew Scale',
    tagline: '0.1 g resolution with a built-in timer.',
    description:
      'A rechargeable scale with 0.1 gram resolution, a 2 kg capacity and a timer that starts when you begin pouring. Silicone mat included. The display stays readable under a dripper.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [
      { sku: 'SCALE-1', name: 'Standard', weightGrams: 300, priceCents: 4500, stockQuantity: 40 },
    ],
    art: { shape: 'scale', accent: '#4A2C24' },
  },
  {
    slug: 'paper-filters',
    name: 'Paper Filters, size 02',
    tagline: '100 oxygen-bleached cone filters.',
    description:
      'Oxygen-bleached, unbleached-taste-free cone filters that fit our dripper and any size 02 cone. Rinse once before brewing.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [
      { sku: 'FILTERS-1', name: '100 pack', weightGrams: 150, priceCents: 900, stockQuantity: 300 },
    ],
    art: { shape: 'filters', accent: '#FFFDFA' },
  },
  {
    slug: 'cofresso-mug',
    name: 'Cofresso Stoneware Mug',
    tagline: '12 oz, espresso glaze, logo debossed.',
    description:
      'A heavy stoneware mug in our espresso brown with the double-bean logo debossed on the side. Dishwasher safe. Holds exactly one Morning Frame.',
    category: 'merch',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [
      { sku: 'MUG-1', name: '12 oz', weightGrams: 400, priceCents: 2400, stockQuantity: 60 },
    ],
    art: { shape: 'mug', accent: '#4A2C24' },
  },
];

export const seedDiscountCodes: SeedDiscountCode[] = [
  { code: 'WELCOME10', kind: 'percent', value: 10, minSubtotalCents: 0 },
  { code: 'FREESHIP', kind: 'free_shipping', value: 0, minSubtotalCents: 0 },
  { code: 'COFRAME15', kind: 'percent', value: 15, minSubtotalCents: 3000 },
];
