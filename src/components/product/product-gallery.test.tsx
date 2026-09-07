import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ImageKind } from '@/lib/db/schema';
import { ProductGallery, type GalleryImage } from './product-gallery';

// next/image needs Next's build-time image config and a configured remote
// host; in jsdom we only care about the carousel behaviour, so render a plain
// img and drop the Next-only props that React would warn about.
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    quality: _quality,
    unoptimized: _unoptimized,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    loader: _loader,
    ...rest
  }: Record<string, unknown> & { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...rest} />
  ),
}));

function image(kind: ImageKind): GalleryImage {
  return {
    url: `https://cofresso.com/assets/products/morning-frame/morning-frame-${kind}-deadbeef.webp`,
    alt: `Morning Frame ${kind}`,
    width: kind === 'lifestyle' ? 1536 : 1024,
    height: 1024,
    kind,
  };
}

const images: GalleryImage[] = [
  image('front'),
  image('detail'),
  image('lifestyle'),
  image('packaging'),
];

const fallback = { src: '/products/morning-frame.svg', alt: 'Morning Frame' };

function setup(list: GalleryImage[] = images) {
  return {
    user: userEvent.setup(),
    ...render(<ProductGallery images={list} fallback={fallback} />),
  };
}

const main = () => screen.getByTestId('gallery-main');

describe('ProductGallery', () => {
  it('shows the first image, a thumbnail per image and carousel semantics', () => {
    setup();
    expect(screen.getByTestId('gallery')).toHaveAttribute('aria-roledescription', 'carousel');
    expect(main()).toHaveAttribute('src', images[0].url);
    expect(main()).toHaveAttribute('alt', 'Morning Frame front');
    expect(screen.getAllByTestId(/^gallery-thumb-/)).toHaveLength(4);
    expect(screen.getByTestId('gallery-thumb-0')).toHaveAttribute('aria-current', 'true');
  });

  it('changes the main image when a thumbnail is clicked', async () => {
    const { user } = setup();
    await user.click(screen.getByTestId('gallery-thumb-1'));
    expect(main()).toHaveAttribute('src', images[1].url);
    expect(main()).toHaveAttribute('alt', 'Morning Frame detail');
    expect(screen.getByTestId('gallery-thumb-1')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('gallery-thumb-0')).not.toHaveAttribute('aria-current');
  });

  it('advances and rewinds with the arrow buttons', async () => {
    const { user } = setup();
    await user.click(screen.getByTestId('gallery-next'));
    expect(main()).toHaveAttribute('src', images[1].url);
    await user.click(screen.getByTestId('gallery-prev'));
    expect(main()).toHaveAttribute('src', images[0].url);
  });

  it('wraps with the arrow keys', async () => {
    const { user } = setup();
    const container = screen.getByTestId('gallery');
    container.focus();
    await user.keyboard('{ArrowLeft}');
    expect(main()).toHaveAttribute('src', images[3].url);
    await user.keyboard('{ArrowRight}');
    expect(main()).toHaveAttribute('src', images[0].url);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(main()).toHaveAttribute('src', images[2].url);
  });

  it('falls back to the SVG art and hides the controls when there are no images', () => {
    setup([]);
    expect(main()).toHaveAttribute('src', fallback.src);
    expect(main()).toHaveAttribute('alt', fallback.alt);
    expect(screen.queryByTestId('gallery-next')).toBeNull();
    expect(screen.queryByTestId('gallery-thumb-0')).toBeNull();
  });

  it('hides the arrows for a single image but still renders it', () => {
    setup([image('front')]);
    expect(main()).toHaveAttribute('src', images[0].url);
    expect(screen.queryByTestId('gallery-next')).toBeNull();
    expect(screen.getByTestId('gallery-thumb-0')).toBeInTheDocument();
  });

  it('announces the position counter politely so screen readers hear it change', () => {
    setup();
    expect(screen.getByText('1 / 4')).toHaveAttribute('aria-live', 'polite');
  });
});
