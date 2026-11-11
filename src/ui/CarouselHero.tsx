import { useState } from 'react';
import CircularCarousel, { type CarouselItem } from './CircularCarousel';
import './carousel-hero.css';

interface CarouselHeroProps<Item extends CarouselItem> {
  items: readonly Item[];
  onOpenCurrent?: (item: Item) => void;
}

export default function CarouselHero<Item extends CarouselItem>({ items, onOpenCurrent }: CarouselHeroProps<Item>) {
  const [playing, setPlaying] = useState(true);
  if (!items.length) return null;
  return (
    <div className="food-carousel-hero">
      <CircularCarousel
        items={items}
        onOpenCurrent={onOpenCurrent}
        preset="cylinder"
        intro="rise"
        cardWidth={246}
        aspectRatio={1.12}
        gap={25}
        curve={0.85}
        tilt={-13}
        perspective={1150}
        autoplay={playing ? 'drift' : 'off'}
        speed={14}
        momentum={0.42}
        depthFade={0.48}
        fadeColor="#f5bd47"
        innerShade={0.36}
        cornerRadius={13}
        parallax={0.16}
        stretch={0.2}
        captions
      />
      <button
        type="button"
        className="food-carousel-hero__play"
        aria-label={playing ? '暂停自动旋转' : '继续自动旋转'}
        title={playing ? '暂停自动旋转' : '继续自动旋转'}
        onClick={() => setPlaying(value => !value)}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M3.5 2.5h3v11h-3zm6 0h3v11h-3z" /> : <path d="m4 2 9 6-9 6z" />}
        </svg>
      </button>
    </div>
  );
}
