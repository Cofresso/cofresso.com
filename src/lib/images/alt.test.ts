import { describe, expect, it } from 'vitest';
import { IMAGE_KINDS } from '@/lib/db/schema/values';
import {
  brandedName,
  collectionAltText,
  guideAltText,
  homeAltText,
  productAltText,
  type AltProduct,
} from './alt';

const coffee: AltProduct = {
  name: 'Ethiopia Yirgacheffe',
  origin: 'Ethiopia',
  tastingNotes: ['jasmine', 'bergamot', 'lemon drop'],
  category: 'coffee',
};

const gear: AltProduct = {
  name: 'Gooseneck Kettle',
  origin: null,
  tastingNotes: [],
  category: 'equipment',
};

describe('productAltText', () => {
  it('describes each kind of coffee shot', () => {
    expect(productAltText(coffee, 'front')).toBe(
      'A bag of Cofresso Ethiopia Yirgacheffe coffee from Ethiopia on a cream linen backdrop',
    );
    expect(productAltText(coffee, 'detail')).toBe(
      'Close-up of roasted Ethiopia Yirgacheffe coffee beans, which taste of jasmine and bergamot',
    );
    expect(productAltText(coffee, 'lifestyle')).toBe(
      'A pour-over brewing scene with a bag of Cofresso Ethiopia Yirgacheffe on a sunlit kitchen counter',
    );
    expect(productAltText(coffee, 'packaging')).toBe(
      'Hands holding a bag of Cofresso Ethiopia Yirgacheffe with the label facing the camera',
    );
  });

  it('describes equipment without coffee language', () => {
    expect(productAltText(gear, 'front')).toBe(
      'A Cofresso Gooseneck Kettle on a cream linen backdrop',
    );
    expect(productAltText(gear, 'detail')).toBe('Close-up detail of a Cofresso Gooseneck Kettle');
    expect(productAltText(gear, 'lifestyle')).toBe(
      'A Cofresso Gooseneck Kettle in use on a sunlit kitchen counter',
    );
    expect(productAltText(gear, 'packaging')).toBe('Hands holding a Cofresso Gooseneck Kettle');
  });

  it('omits the origin and tasting notes when absent', () => {
    const plain: AltProduct = { name: 'House Blend', tastingNotes: [], category: 'coffee' };
    expect(productAltText(plain, 'front')).toBe(
      'A bag of Cofresso House Blend coffee on a cream linen backdrop',
    );
    expect(productAltText(plain, 'detail')).toBe('Close-up of roasted House Blend coffee beans');
  });

  it('does not double the brand when the name already starts with Cofresso', () => {
    const dripper: AltProduct = {
      name: 'Cofresso Ceramic Dripper',
      tastingNotes: [],
      category: 'equipment',
    };
    for (const kind of IMAGE_KINDS) {
      const alt = productAltText(dripper, kind);
      expect(alt).toContain('Cofresso Ceramic Dripper');
      expect(alt).not.toContain('Cofresso Cofresso');
    }
  });

  it('produces screen-reader friendly strings for every kind', () => {
    for (const product of [coffee, gear]) {
      for (const kind of IMAGE_KINDS) {
        const alt = productAltText(product, kind);
        expect(alt.length).toBeGreaterThan(10);
        expect(alt.length).toBeLessThanOrEqual(160);
        expect(alt.endsWith('.')).toBe(false);
        expect(alt.startsWith(alt.trim())).toBe(true);
      }
    }
  });
});

describe('other alt text', () => {
  it('describes collections, home images and guides', () => {
    expect(collectionAltText({ name: 'Blends', description: 'Balanced profiles.' })).toBe(
      'Cofresso Blends collection: balanced profiles',
    );
    expect(homeAltText('hero')).toBe(
      'Freshly roasted Cofresso coffee bags and a pour-over setup on a cream linen backdrop',
    );
    expect(homeAltText('story')).toBe(
      'A Cofresso roaster weighing green coffee beside a sample roaster',
    );
    expect(guideAltText({ title: 'French Press', method: 'Immersion' })).toBe(
      'Brewing coffee with the immersion method: French Press',
    );
  });
});

describe('brandedName', () => {
  it('prefixes a plain name with Cofresso', () => {
    expect(brandedName('Gooseneck Kettle')).toBe('Cofresso Gooseneck Kettle');
  });

  it('leaves a name that already starts with Cofresso unchanged', () => {
    expect(brandedName('Cofresso Ceramic Dripper')).toBe('Cofresso Ceramic Dripper');
  });
});

describe('guideAltText', () => {
  it('uses the method field, not a duplicated title parenthetical', () => {
    const alt = guideAltText({
      title: 'Pour Over (V60 / Cofresso Dripper)',
      method: 'Pour over',
    });
    expect(alt).toContain('pour over method');
    expect(alt).toContain('Pour Over (V60 / Cofresso Dripper)');
    expect(alt).not.toContain('the Pour Over (V60 / Cofresso Dripper) method');
  });
});
