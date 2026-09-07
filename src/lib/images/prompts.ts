import { type ImageKind, type ProductCategory, type RoastLevel } from '@/lib/db/schema/values';
import type { HomeImageName } from './paths';

/** Sizes the Images API accepts for gpt-image models. */
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536';

export const KIND_SIZES: Record<ImageKind, ImageSize> = {
  front: '1024x1024',
  detail: '1024x1024',
  lifestyle: '1536x1024',
  packaging: '1024x1024',
};

/** Collection, home and guide images are all 3:2 banners. */
export const HERO_SIZE: ImageSize = '1536x1024';

export const STYLE_GUIDE = [
  'Editorial studio product photography for a specialty coffee roaster called Cofresso.',
  'Cream and linen backdrops, soft directional daylight from the left, gentle falloff, no harsh shadows.',
  'Brand palette: espresso brown #4A2C24, latte #A08977, cream #F6F1EB, copper #C8763A.',
  'Shot on a 50mm lens at f/4, natural depth of field, fine film grain, no vignette.',
  'Clean, uncluttered composition with generous negative space.',
  'Photorealistic: no illustration, no 3D render, no watermark, no logos.',
  'The only lettering allowed in the frame is the word "Cofresso" printed small on a coffee bag label;',
  'no other text, letters or numbers anywhere in the image.',
].join(' ');

export interface PromptProduct {
  name: string;
  origin?: string | null;
  region?: string | null;
  tastingNotes: readonly string[];
  category: ProductCategory;
  roastLevel?: RoastLevel | null;
  art: { shape: string; accent: string };
}

const SHAPE_SUBJECTS: Record<string, string> = {
  bag: 'stand-up coffee bag',
  kettle: 'gooseneck pour-over kettle',
  dripper: 'ceramic cone pour-over dripper',
  grinder: 'hand coffee grinder with a steel burr',
  scale: 'compact digital brew scale',
  filters: 'stack of paper cone coffee filters',
  mug: 'stoneware coffee mug',
};

const COMPOSITIONS: Record<ImageKind, string> = {
  front:
    'Composition: centred, straight-on product shot on a cream linen backdrop, the whole product in frame with a soft shadow beneath it. Square crop.',
  detail:
    'Composition: extreme close-up filling the frame, shallow depth of field, texture and material clearly visible. Square crop.',
  lifestyle:
    'Composition: a wide lifestyle scene on a sunlit kitchen counter with a pour-over in progress, rising steam, a linen cloth and a ceramic cup. The product is visible but off-centre. Three-by-two landscape crop.',
  packaging:
    'Composition: a pair of hands holding the product at chest height against a soft cream wall, the label facing the camera. Square crop.',
};

function productSubject(product: PromptProduct, kind: ImageKind): string {
  const shape = SHAPE_SUBJECTS[product.art.shape] ?? 'piece of coffee brewing equipment';
  if (product.category !== 'coffee') {
    return `Subject: a ${shape} finished in the colour ${product.art.accent} — the Cofresso ${product.name}.`;
  }
  const origin = product.origin ? ` of ${product.origin} coffee` : ' of coffee';
  const roast = product.roastLevel ? ` It is a ${product.roastLevel.replace('_', ' ')} roast.` : '';
  const notes = product.tastingNotes.length
    ? ` The coffee tastes of ${product.tastingNotes.join(', ')}.`
    : '';
  const beans =
    kind === 'detail' ? ' Show loose roasted whole beans spilling from the open bag.' : '';
  return `Subject: a matte ${shape}${origin} named ${product.name}, with a flat label panel in the colour ${product.art.accent} carrying the word "Cofresso".${roast}${notes}${beans}`;
}

export function productPrompt(product: PromptProduct, kind: ImageKind): string {
  return [STYLE_GUIDE, productSubject(product, kind), COMPOSITIONS[kind]].join('\n\n');
}

const COLLECTION_SCENES: Record<string, string> = {
  'single-origin':
    'Subject: a three-by-two landscape flat lay of four matte coffee bags of different label colours arranged on a cream linen cloth with a scattering of whole beans and a hand-written-looking blank tag, evoking one farm, one region, one story.',
  blends:
    'Subject: a three-by-two landscape scene of two matte coffee bags beside a French press and a ceramic cup of black coffee on a warm cream counter, evoking balanced everyday blends.',
  decaf:
    'Subject: a three-by-two landscape scene of a single matte decaf coffee bag on a cream linen cloth in low evening daylight, with a ceramic cup and a sprig of green sugarcane leaf, evoking calm decaf coffee at night.',
  equipment:
    'Subject: a three-by-two landscape flat lay of brewing equipment — a gooseneck kettle, a ceramic dripper, a hand grinder, a brew scale and paper filters — arranged on a cream linen surface.',
};

export function collectionPrompt(collection: {
  slug: string;
  name: string;
  description: string;
}): string {
  const scene =
    COLLECTION_SCENES[collection.slug] ??
    `Subject: a three-by-two landscape scene representing the Cofresso ${collection.name} collection. ${collection.description}`;
  return [
    STYLE_GUIDE,
    scene,
    'Composition: wide banner framing with the subject in the left two thirds and clear negative space on the right for overlaid type. Three-by-two landscape crop.',
  ].join('\n\n');
}

const HOME_SCENES: Record<HomeImageName, string> = {
  hero: 'Subject: a three-by-two landscape hero scene — two matte Cofresso coffee bags standing beside a ceramic pour-over dripper mid-brew, steam catching the light, whole beans scattered on a cream linen surface.',
  story:
    'Subject: a three-by-two landscape scene inside a small roastery: a roaster in an apron weighing green coffee on a brass scale beside a drum sample roaster, warm daylight through a window, hands visible but no faces.',
};

export function homePrompt(name: HomeImageName): string {
  return [
    STYLE_GUIDE,
    HOME_SCENES[name],
    'Composition: wide banner framing with generous negative space for overlaid type. Three-by-two landscape crop.',
  ].join('\n\n');
}

const GUIDE_SCENES: Record<string, string> = {
  'pour-over':
    'Subject: a pour over in progress — a gooseneck kettle pouring a steady spiral into a ceramic cone dripper on a glass carafe, steam rising, a brew scale showing a blank display.',
  'french-press':
    'Subject: a French press on a cream linen cloth with the plunger raised, a thick coffee crust on the surface, a spoon resting beside it.',
  espresso:
    'Subject: an espresso extraction — a dark, syrupy stream falling from a portafilter into a small ceramic cup, crema forming, machine body softly out of focus.',
  'cold-brew':
    'Subject: a cold brew steep — a large glass jar of coarse coffee and cold water on a cream counter, condensation on the glass, a filter cone and a glass of iced coffee beside it.',
};

export function guidePrompt(guide: { slug: string; title: string; method: string }): string {
  const scene =
    GUIDE_SCENES[guide.slug] ??
    `Subject: a brewing scene for the ${guide.title} method (${guide.method}) on a cream counter.`;
  return [
    STYLE_GUIDE,
    scene,
    'Composition: wide banner framing, hands allowed but no faces, generous negative space. Three-by-two landscape crop.',
  ].join('\n\n');
}
