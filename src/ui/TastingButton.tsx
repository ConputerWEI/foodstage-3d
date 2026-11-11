import { useRef } from 'react';

const colors = ['#cb3726', '#f3aa23', '#fff4cf', '#663425'];

/** React Bits' line burst, drawn in viewport space so opening the viewer doesn't clip it. */
function showClickSpark(x: number, y: number) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const half = 65;
  const size = half * 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.ceil(size * dpr);
  canvas.className = 'tasting-click-spark';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '100', width: size + 'px', height: size + 'px',
    left: x - half + 'px', top: y - half + 'px',
  });
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = (i + (Math.random() - 0.5) * 0.16) * Math.PI / 4;
    return { dx: Math.cos(angle), dy: Math.sin(angle), reach: 41 + Math.random() * 6 };
  });

  document.body.appendChild(canvas);
  const start = performance.now();
  const draw = (now: number) => {
    const p = Math.min(1, (now - start) / 500);
    if (p >= 1) { canvas.remove(); return; }
    ctx.clearRect(0, 0, size, size);
    const eased = 1 - (1 - p) ** 3;
    const length = 15 * (1 - p) ** 1.6;
    ctx.globalAlpha = Math.min(1, (1 - p) / 0.45);
    rays.forEach(({ dx, dy, reach }, i) => {
      const distance = 3 + reach * eased;
      ctx.beginPath();
      ctx.moveTo(half + dx * distance, half + dy * distance);
      ctx.lineTo(half + dx * (distance + length), half + dy * (distance + length));
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#5c3025';
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = colors[i % colors.length]!;
      ctx.stroke();
    });
    requestAnimationFrame(draw);
  };
  draw(start);
}

export function TastingButton({ reducedMotion, onTaste }: { reducedMotion: boolean; onTaste: () => void }) {
  const sparkedOnPress = useRef(false);
  return <button type="button" className="ordering-taste-button"
    onPointerDown={event => {
      sparkedOnPress.current = !reducedMotion && event.isPrimary && event.pointerType === 'mouse' && event.button === 0;
      if (sparkedOnPress.current) showClickSpark(event.clientX, event.clientY);
    }}
    onPointerCancel={() => { sparkedOnPress.current = false; }}
    onClick={event => {
      if (!reducedMotion && (event.detail === 0 || !sparkedOnPress.current)) {
        const rect = event.currentTarget.getBoundingClientRect();
        showClickSpark(event.detail === 0 ? rect.left + rect.width / 2 : event.clientX,
          event.detail === 0 ? rect.top + rect.height / 2 : event.clientY);
      }
      sparkedOnPress.current = false;
      onTaste();
    }}><strong>虚拟试吃</strong></button>;
}
