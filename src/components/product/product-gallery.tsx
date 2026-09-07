'use client';

import Image from 'next/image';
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { IconArrowRight } from '@/components/ui/icons';
import type { ImageKind } from '@/lib/db/schema';
import { clampIndex, nextIndex, prevIndex, swipeDirection } from '@/lib/images/gallery';

export interface GalleryImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  kind: ImageKind;
}

export interface ProductGalleryProps {
  images: readonly GalleryImage[];
  /** Legacy SVG art, used when a product has no generated photography. */
  fallback: { src: string; alt: string };
  className?: string;
}

const KIND_LABELS: Record<ImageKind, string> = {
  front: 'Front',
  detail: 'Detail',
  lifestyle: 'In use',
  packaging: 'Packaging',
};

const ARROW_CLASS =
  'bg-foam/90 text-espresso hover:bg-foam absolute top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full shadow-md transition-opacity';

export function ProductGallery({ images, fallback, className }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);

  const go = useCallback(
    (delta: 1 | -1) => {
      setIndex((current) =>
        delta === 1 ? nextIndex(current, images.length) : prevIndex(current, images.length),
      );
    },
    [images.length],
  );

  if (images.length === 0) {
    return (
      <div
        className={`bg-foam relative overflow-hidden rounded-3xl ${className ?? ''}`}
        data-testid="gallery"
        aria-roledescription="carousel"
      >
        <Image
          src={fallback.src}
          alt={fallback.alt}
          width={600}
          height={750}
          unoptimized
          priority
          className="h-auto w-full"
          data-testid="gallery-main"
        />
      </div>
    );
  }

  const active = clampIndex(index, images.length);
  const current = images[active];
  const showArrows = images.length > 1;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStartX.current = event.clientX;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStartX.current;
    pointerStartX.current = null;
    if (start === null) return;
    const direction = swipeDirection(start, event.clientX);
    if (direction !== 0) go(direction);
  }

  return (
    <div
      className={`flex flex-col gap-3 ${className ?? ''}`}
      data-testid="gallery"
      role="group"
      aria-roledescription="carousel"
      aria-label="Product images"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="bg-foam relative aspect-square overflow-hidden rounded-3xl">
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority={active === 0}
          className="object-cover"
          data-testid="gallery-main"
        />
        {showArrows ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              data-testid="gallery-prev"
              className={`${ARROW_CLASS} left-3`}
            >
              <IconArrowRight width={16} height={16} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              data-testid="gallery-next"
              className={`${ARROW_CLASS} right-3`}
            >
              <IconArrowRight width={16} height={16} />
            </button>
          </>
        ) : null}
        <p className="bg-espresso/70 text-foam absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs">
          {active + 1} / {images.length}
        </p>
      </div>

      <ul className="grid grid-cols-4 gap-3">
        {images.map((image, i) => (
          <li key={image.url}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${KIND_LABELS[image.kind]} image`}
              aria-current={i === active ? 'true' : undefined}
              data-testid={`gallery-thumb-${i}`}
              className={`bg-foam relative block aspect-square w-full overflow-hidden rounded-xl border-2 transition-colors ${
                i === active ? 'border-copper' : 'hover:border-latte/60 border-transparent'
              }`}
            >
              <Image src={image.url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
