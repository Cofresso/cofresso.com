import { describe, expect, it } from 'vitest';
import { IMAGE_KINDS } from '@/lib/db/schema/values';
import {
  collectionPrompt,
  guidePrompt,
  HERO_SIZE,
  homePrompt,
  KIND_SIZES,
  productPrompt,
  STYLE_GUIDE,
  type PromptProduct,
} from './prompts';

const coffee: PromptProduct = {
  name: 'Ethiopia Yirgacheffe',
  origin: 'Ethiopia',
  region: 'Yirgacheffe',
  tastingNotes: ['jasmine', 'bergamot', 'lemon drop'],
  category: 'coffee',
  roastLevel: 'light',
  art: { shape: 'bag', accent: '#D9A441' },
};

const gear: PromptProduct = {
  name: 'Gooseneck Kettle',
  tastingNotes: [],
  category: 'equipment',
  art: { shape: 'kettle', accent: '#33201A' },
};

describe('KIND_SIZES', () => {
  it('uses 3:2 for lifestyle and square for the rest', () => {
    expect(KIND_SIZES).toEqual({
      front: '1024x1024',
      detail: '1024x1024',
      lifestyle: '1536x1024',
      packaging: '1024x1024',
    });
    expect(HERO_SIZE).toBe('1536x1024');
  });
});

describe('productPrompt', () => {
  it('always carries the style guide and forbids stray text', () => {
    for (const kind of IMAGE_KINDS) {
      const prompt = productPrompt(coffee, kind);
      expect(prompt.startsWith(STYLE_GUIDE)).toBe(true);
      expect(prompt).toContain('no other text, letters or numbers');
      expect(prompt).toContain('"Cofresso"');
      expect(prompt.length).toBeLessThanOrEqual(4000);
    }
  });

  it('includes the label colour, origin, roast and tasting notes for coffee', () => {
    const prompt = productPrompt(coffee, 'front');
    expect(prompt).toContain('#D9A441');
    expect(prompt).toContain('Ethiopia');
    expect(prompt).toContain('light roast');
    expect(prompt).toContain('jasmine, bergamot, lemon drop');
  });

  it('describes equipment by its art shape instead of a bag', () => {
    const prompt = productPrompt(gear, 'front');
    expect(prompt).toContain('gooseneck pour-over kettle');
    expect(prompt).not.toMatch(/\broast\b/);
    expect(prompt).not.toMatch(/\broasted\b/);
    expect(prompt).not.toContain('tastes of');
  });

  it('varies the composition per kind', () => {
    const prompts = IMAGE_KINDS.map((k) => productPrompt(coffee, k));
    expect(new Set(prompts).size).toBe(IMAGE_KINDS.length);
    expect(productPrompt(coffee, 'lifestyle')).toContain('landscape');
    expect(productPrompt(coffee, 'packaging')).toContain('hands');
  });

  it('is deterministic', () => {
    expect(productPrompt(coffee, 'detail')).toBe(productPrompt({ ...coffee }, 'detail'));
  });
});

describe('collectionPrompt, homePrompt and guidePrompt', () => {
  it('uses a per-slug scene and falls back for unknown slugs', () => {
    const known = collectionPrompt({ slug: 'decaf', name: 'Decaf', description: 'No jitters.' });
    expect(known.startsWith(STYLE_GUIDE)).toBe(true);
    expect(known).toContain('decaf');
    const unknown = collectionPrompt({
      slug: 'limited',
      name: 'Limited',
      description: 'Rare lots.',
    });
    expect(unknown).toContain('Limited');
    expect(unknown).toContain('Rare lots.');
  });

  it('distinguishes the home hero from the story image', () => {
    expect(homePrompt('hero')).not.toBe(homePrompt('story'));
    expect(homePrompt('hero')).toContain('landscape');
    expect(homePrompt('story')).toContain('roastery');
  });

  it('describes each brewing method', () => {
    const prompt = guidePrompt({ slug: 'cold-brew', title: 'Cold Brew', method: 'Cold immersion' });
    expect(prompt).toContain('cold brew');
    expect(guidePrompt({ slug: 'unknown', title: 'Siphon', method: 'Vacuum' })).toContain('Siphon');
  });
});
