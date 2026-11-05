import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProductImage, ProductVariant } from '../types';

const VIDEO_EXT = /\.(mp4|webm|m4v|mov)(\?.*)?$/i;

function isVideo(image: ProductImage) {
  return image.type === 'video' || VIDEO_EXT.test(image.url);
}

interface Slide {
  id: string;
  url: string;
  alt: string;
  label: string | null;
  video: boolean;
}

interface ProductGalleryProps {
  images: ProductImage[];
  variants: ProductVariant[];
  activeColor?: string;
  title: string;
}

export function ProductGallery({ images, variants, activeColor, title }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const [fullscreen, setFullscreen] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Colour-specific shots lead, then the shots that hold true for every colour.
  const slides = useMemo<Slide[]>(() => {
    const toSlide = (image: ProductImage): Slide => ({
      id: image.id,
      url: image.url,
      alt: image.altText || title,
      label: image.altText && image.altText !== title ? image.altText : null,
      video: isVideo(image),
    });

    const ofColour = new Set(
      variants.filter((variant) => !activeColor || variant.color === activeColor).map((variant) => variant.id)
    );
    const colourSpecific = images.filter((image) => image.variantId && ofColour.has(image.variantId));
    const shared = images.filter((image) => !image.variantId);

    const picked = colourSpecific.length
      ? [...colourSpecific, ...shared]
      : shared.length
        ? shared
        : images.filter((image) => image.variantId && ofColour.has(image.variantId));

    return picked
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toSlide);
  }, [images, variants, activeColor, title]);

  // A new colour means a new set of pictures, so never keep the old position.
  useEffect(() => {
    setIndex(0);
    setZooming(false);
  }, [activeColor, slides.length]);

  const count = slides.length;
  const current = slides[Math.min(index, Math.max(count - 1, 0))];

  const go = useCallback((delta: number) => {
    if (count < 2) return;
    setZooming(false);
    setIndex((prev) => (prev + delta + count) % count);
  }, [count]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('overflow-hidden');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('overflow-hidden');
    };
  }, [fullscreen, go]);

  if (!current) {
    return (
      <div className="aspect-[4/5] bg-cream-deep border border-line flex items-center justify-center">
        <span className="text-muted text-sm">No picture yet</span>
      </div>
    );
  }

  const swipeStart = (event: React.TouchEvent) => {
    touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const swipeEnd = (event: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = event.changedTouches[0].clientX - touch.current.x;
    const dy = event.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  const stage = (large: boolean) => (
    <>
      {current.video ? (
        <video
          key={current.url}
          src={current.url}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full object-contain bg-[#14110e]"
        />
      ) : (
        <img
          src={current.url}
          alt={current.alt}
          draggable={false}
          onMouseMove={(event) => {
            if (!zooming) return;
            const box = event.currentTarget.getBoundingClientRect();
            setOrigin(
              `${((event.clientX - box.left) / box.width) * 100}% ${((event.clientY - box.top) / box.height) * 100}%`
            );
          }}
          onClick={() => setZooming((on) => !on)}
          style={{ transformOrigin: origin, transform: zooming ? 'scale(2.2)' : 'scale(1)' }}
          className={`w-full h-full object-cover transition-transform duration-300 ease-out ${
            zooming ? 'cursor-zoom-out' : 'cursor-zoom-in'
          }`}
        />
      )}

      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        {current.label && (
          <span className="bg-[#14110e]/75 text-[#f6f2ea] text-[10px] uppercase tracking-[0.16em] px-2.5 py-1">
            {current.label}
          </span>
        )}
        {current.video && (
          <span className="bg-[#14110e]/75 text-[#f6f2ea] text-[10px] uppercase tracking-[0.16em] px-2.5 py-1">
            Video
          </span>
        )}
      </div>

      {count > 1 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className="bg-[#14110e]/75 text-[#f6f2ea] text-[11px] px-2 py-1 tabular-nums">
            {index + 1} / {count}
          </span>
          {!current.video && !large && (
            <>
              <button
                onClick={() => setZooming((on) => !on)}
                aria-label={zooming ? 'Reset zoom' : 'Zoom in'}
                className="bg-[#f6f2ea]/90 text-ink text-[11px] px-2.5 py-1 hover:bg-white"
              >
                {zooming ? 'Reset' : 'Zoom'}
              </button>
              <button
                onClick={() => setFullscreen(true)}
                aria-label="View fullscreen"
                className="bg-[#f6f2ea]/90 text-ink text-[11px] px-2.5 py-1 hover:bg-white"
              >
                Fullscreen
              </button>
            </>
          )}
        </div>
      )}

      {count > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous picture"
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-9 h-12 grid place-items-center bg-[#f6f2ea]/85 text-ink hover:bg-white ${large ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus-visible:opacity-100'}`}
          >
            ‹
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next picture"
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-12 grid place-items-center bg-[#f6f2ea]/85 text-ink hover:bg-white ${large ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus-visible:opacity-100'}`}
          >
            ›
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-3 lg:gap-4">
      {/* vertical film strip on desktop, horizontal scroller on mobile */}
      {count > 1 && (
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto lg:w-[76px] lg:max-h-[620px] pb-1 lg:pb-0 shrink-0">
          {slides.map((slide, position) => (
            <button
              key={slide.id + position}
              onClick={() => {
                setIndex(position);
                setZooming(false);
              }}
              aria-label={slide.label ? `Show ${slide.label}` : `Show picture ${position + 1}`}
              aria-current={position === index}
              className={`relative w-[64px] h-[80px] lg:w-full lg:h-[92px] shrink-0 overflow-hidden border-2 transition-colors ${
                position === index ? 'border-brass' : 'border-line hover:border-brass-dark/60'
              }`}
            >
              {slide.video ? (
                <span className="absolute inset-0 grid place-items-center bg-[#14110e] text-[#f6f2ea] text-lg">▶</span>
              ) : (
                <img src={slide.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      <div
        onTouchStart={swipeStart}
        onTouchEnd={swipeEnd}
        className="relative overflow-hidden bg-cream-deep border border-line aspect-[4/5]"
      >
        {stage(false)}
      </div>

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} picture viewer`}
          className="fixed inset-0 z-[120] bg-[#14110e]/95 backdrop-blur-sm flex flex-col"
          onTouchStart={swipeStart}
          onTouchEnd={swipeEnd}
        >
          <div className="flex items-center justify-between px-5 py-4 text-[#f6f2ea]">
            <span className="text-sm tracking-wide">
              {current.label || title}
              {count > 1 && <span className="ml-3 text-[#f6f2ea]/60 tabular-nums">{index + 1} / {count}</span>}
            </span>
            <button onClick={() => setFullscreen(false)} aria-label="Close viewer" className="text-2xl leading-none px-2">
              ×
            </button>
          </div>

          <div className="relative flex-1 mx-auto w-full max-w-5xl px-4 pb-4" onClick={() => setFullscreen(false)}>
            <div
              onClick={(event) => event.stopPropagation()}
              className={`w-full h-full ${current.video ? 'grid place-items-center' : 'overflow-hidden'}`}
            >
              {stage(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
