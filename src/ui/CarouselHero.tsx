import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import { CarouselModels } from './CarouselModels';
import './carousel-hero.css';

type FoodSlide = { modelId: string; title: string; subtitle: string };
export interface LoopSceneBridge {
  slots: { index: number; x: number; width: number }[];
  centerY: number;
  diameter: number;
  redraw?: () => void;
}
const wrap = (value: number, period: number) => ((value % period) + period) % period;
const speed = 44; // CSS pixels per second, independent of refresh rate.

/** The straight, wrapping track from React Bits LogoLoop, shared by the hit targets and one GL canvas. */
export default function CarouselHero<Item extends FoodSlide>({ items, reducedMotion = false, onOpenCurrent }: {
  items: readonly Item[]; reducedMotion?: boolean; onOpenCurrent: (item: Item) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const bridge = useRef<LoopSceneBridge>({ slots: [], centerY: 0, diameter: 0 });
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // The offset is measured in items so a resize preserves the current dish.
  const offset = useRef(0);
  const step = useRef(1);
  const pointer = useRef<{ id: number; x: number; y: number; origin: number; dragged: boolean } | null>(null);
  const suppressClick = useRef(false);
  const hovered = useRef(false);
  const keyboardFocus = useRef(false);
  const redraw = useRef<() => void>(() => {});
  const [paused, setPaused] = useState(false);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el || !items.length) return;
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let visible = true;
    function paint() {
      const pitch = step.current;
      const cycle = items.length * pitch;
      const scene = bridge.current;
      scene.slots = [];
      for (let i = 0; i < items.length; i++) {
        const x = wrap(width / 2 + (i - offset.current) * pitch + pitch / 2, cycle) - pitch / 2;
        const left = x - pitch / 2;
        const button = buttons.current[i];
        if (button) button.style.transform = 'translate3d(' + left + 'px, 0, 0)';
        if (left < width && left + pitch > 0) scene.slots.push({ index: i, x, width: pitch });
      }
      scene.redraw?.();
    }
    function advancing() {
      return visible && !document.hidden && !paused && !reducedMotion && !hovered.current && !keyboardFocus.current && !pointer.current;
    }
    function tick(now: number) {
      frame = 0;
      if (!advancing()) { last = 0; return; }
      if (last) offset.current = wrap(offset.current + speed * Math.min(now - last, 100) / (1000 * step.current), items.length);
      last = now;
      paint();
      frame = requestAnimationFrame(tick);
    }
    function refresh() {
      paint();
      if (advancing()) {
        if (!frame) { last = 0; frame = requestAnimationFrame(tick); }
      } else {
        cancelAnimationFrame(frame);
        frame = last = 0;
      }
    }
    function resize() {
      width = el!.clientWidth;
      height = el!.clientHeight;
      // Even with a short menu, each model wraps only once it is entirely offscreen.
      step.current = Math.max(width / Math.max(1, items.length - 1), Math.min(204, Math.max(150, width / 3.05)));
      const diameter = Math.min(step.current * 0.91, height * 0.68);
      bridge.current.diameter = diameter;
      bridge.current.centerY = (height - 46) / 2;
      el!.style.setProperty('--food-step', step.current + 'px');
      el!.style.setProperty('--food-caption-y', (bridge.current.centerY + diameter / 2 + 3) + 'px');
      refresh();
    }
    redraw.current = refresh;
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const intersection = new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); refresh(); });
    intersection.observe(el);
    document.addEventListener('visibilitychange', refresh);
    resize();
    return () => {
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', refresh);
      cancelAnimationFrame(frame);
      redraw.current = () => {};
    };
  }, [items, paused, reducedMotion]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: offset.current, dragged: false };
    // Keep taps on their original button. Capture the window only after a horizontal drag starts.
    redraw.current();
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    if (!start.dragged) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - start.y)) return;
      start.dragged = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      suppressClick.current = true;
    }
    offset.current = wrap(start.origin - dx / step.current, items.length);
    redraw.current();
  }
  function release(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    redraw.current();
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const current = wrap(Math.round(offset.current), items.length);
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.target !== event.currentTarget) return;
      onOpenCurrent(items[current]!);
    } else {
      let next = current;
      if (event.key === 'ArrowLeft') next--;
      else if (event.key === 'ArrowRight') next++;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      else return;
      keyboardFocus.current = true;
      offset.current = wrap(next, items.length);
      buttons.current[offset.current]?.focus({ preventScroll: true });
      redraw.current();
    }
    event.preventDefault();
  }

  return <div className="food-carousel-hero" role="region" aria-label="招牌菜滚动展示">
    <div ref={viewport} className="food-loop-window" role="group" aria-label="左右方向键切换菜品，回车查看详情" tabIndex={0}
      onKeyDown={navigate}
      onFocus={event => { if (event.target.matches(':focus-visible')) { keyboardFocus.current = true; redraw.current(); } }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { keyboardFocus.current = false; redraw.current(); } }}
      onPointerEnter={event => { if (event.pointerType === 'mouse') { hovered.current = true; redraw.current(); } }}
      onPointerLeave={event => {
        if (event.pointerType === 'mouse') hovered.current = false;
        if (!pointer.current?.dragged) pointer.current = null;
        redraw.current();
      }}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={release} onPointerCancel={release}
      onLostPointerCapture={event => { if (event.target === event.currentTarget) release(event); }} onClickCapture={event => {
        if (suppressClick.current && event.detail > 0) { event.stopPropagation(); suppressClick.current = false; }
      }}>
      <CarouselModels items={items} bridge={bridge} />
      {items.map((item, i) => <button key={item.modelId} type="button" className="food-loop-item" data-index={i}
        ref={element => { buttons.current[i] = element; }} aria-label={'打开' + item.title + '详情'}
        onFocus={event => {
          if (event.currentTarget.matches(':focus-visible')) { offset.current = i; redraw.current(); }
        }}
        onClick={() => onOpenCurrent(item)}>
        <span className="food-loop-caption"><strong>{item.title}</strong><span>{item.subtitle}</span></span>
      </button>)}
    </div>
    {!reducedMotion && <button type="button" className="food-loop-play" aria-label={paused ? '继续滚动' : '暂停滚动'}
      onClick={() => setPaused(value => !value)}>
      {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
    </button>}
  </div>;
}
