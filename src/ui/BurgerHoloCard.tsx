import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Rotate3D } from 'lucide-react';
import type { MenuItem } from '../data/menu';
import { MenuFoodVisual } from './MenuFoodVisual';
import './burger-holo.css';

const restingLight = { x: 0.43, y: 0.38, strength: 0.2 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** The card and the live model share one light position, measured on the untransformed stage. */
export function BurgerHoloCard({ item, reducedMotion }: { item: MenuItem; reducedMotion: boolean }) {
  const [light, setLight] = useState(restingLight);
  const position = useRef(restingLight);
  const target = useRef(restingLight);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function aim(next: typeof restingLight) {
    target.current = next;
    if (frame.current) return;
    let last = performance.now();
    function step(now: number) {
      const to = target.current;
      const from = position.current;
      const weight = 1 - Math.exp(-Math.max(1, now - last) / 65);
      last = now;
      const settled = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), Math.abs(to.strength - from.strength)) < 0.006;
      position.current = settled ? to : {
        x: from.x + (to.x - from.x) * weight,
        y: from.y + (to.y - from.y) * weight,
        strength: from.strength + (to.strength - from.strength) * weight,
      };
      setLight(position.current);
      frame.current = settled ? 0 : requestAnimationFrame(step);
    }
    frame.current = requestAnimationFrame(step);
  }

  function track(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion || !event.isPrimary || (event.pointerType === 'touch' && !event.buttons)) return;
    const box = event.currentTarget.getBoundingClientRect();
    aim({ x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height), strength: 1 });
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (reducedMotion || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const { x, y } = target.current;
    aim({
      x: clamp(x + (event.key === 'ArrowRight' ? 0.18 : event.key === 'ArrowLeft' ? -0.18 : 0)),
      y: clamp(y + (event.key === 'ArrowDown' ? 0.18 : event.key === 'ArrowUp' ? -0.18 : 0)),
      strength: 1,
    });
  }

  const pose = reducedMotion ? restingLight : light;
  const x = pose.x - 0.5;
  const y = pose.y - 0.5;
  const style = {
    '--light-x': `${pose.x * 100}%`,
    '--light-y': `${pose.y * 100}%`,
    '--foil-angle': `${115 + x * 58 - y * 28}deg`,
    transform: reducedMotion ? undefined : `perspective(920px) rotateX(${-y * 18}deg) rotateY(${x * 22}deg) scale(${1 + 0.018 * pose.strength})`,
  };

  return <figure className="burger-holo">
    <div className="burger-holo-stage" role="group" aria-label="经典汉堡全息展示卡" aria-describedby="burger-holo-hint"
      tabIndex={reducedMotion ? undefined : 0} onKeyDown={handleKey} onBlur={() => aim(restingLight)}
      onPointerEnter={track} onPointerMove={track} onPointerDown={track}
      onPointerUp={event => { if (event.pointerType !== 'mouse') aim(restingLight); }}
      onPointerLeave={() => aim(restingLight)} onPointerCancel={() => aim(restingLight)}>
      <div className="burger-holo-card" style={style}>
        <div className="burger-holo-print">
          <MenuFoodVisual item={item} variant="detail" holo={pose} />
        </div>
      </div>
    </div>
    <figcaption id="burger-holo-hint"><Rotate3D size={15} aria-hidden="true" />
      {reducedMotion ? '拖动旋转汉堡' : <>移动看流光 · 拖动旋转<span className="burger-holo-key-hint"> · 方向键可调光</span></>}
    </figcaption>
  </figure>;
}
