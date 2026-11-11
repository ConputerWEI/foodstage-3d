import type { CSSProperties, ReactElement } from 'react';

export interface CarouselItem {
  readonly src: string;
  readonly alt?: string;
  readonly title?: string;
  readonly subtitle?: string;
}

interface CircularCarouselProps<Item extends CarouselItem> {
  items: readonly Item[];
  preset?: 'cylinder' | 'orbit' | 'wheel' | 'panorama';
  intro?: 'assemble' | 'rise' | 'spin' | 'none';
  cardWidth?: number;
  aspectRatio?: number;
  gap?: number;
  curve?: number;
  tilt?: number;
  perspective?: number;
  autoplay?: 'drift' | 'step' | 'off';
  speed?: number;
  interval?: number;
  direction?: 'left' | 'right';
  draggable?: boolean;
  momentum?: number;
  snap?: boolean;
  pauseOnHover?: boolean;
  focusOnClick?: boolean;
  parallax?: number;
  stretch?: number;
  depthFade?: number;
  fadeColor?: string;
  innerShade?: number;
  cornerRadius?: number;
  captions?: boolean;
  onChange?: (index: number) => void;
  onOpenCurrent?: (item: Item) => void;
  className?: string;
  style?: CSSProperties;
}

export default function CircularCarousel<Item extends CarouselItem>(props: CircularCarouselProps<Item>): ReactElement;
