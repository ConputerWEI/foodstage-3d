import { useCallback, useRef, type PointerEvent } from 'react';
import { beginGesture, moveGesture, endGesture, isTap, type Gesture } from '../core/gesture';
import type { Motion } from '../scene/motion';
import type { HitTest } from '../scene/Scene';

export function useFoodInput(motion: Motion, hit: React.RefObject<HitTest | null>, playable: boolean, bite: () => void, sensitivity: number, zoomBy: (factor: number) => void) {
  const active = useRef<{ id: number; gesture: Gesture; x: number; y: number; time: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef(0);
  function distance() {
    const [a, b] = pointers.current.values();
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  const attachWheel = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * 0.008));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [zoomBy]);
  function clear() { active.current = null; motion.dragging = false; }
  return {
    ref: attachWheel,
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.target instanceof Element && event.target.closest('button, a, input, [data-no-drag]')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      motion.idle = 0;
      // Capture even a miss so an outside release always clears tracked pointers.
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pointers.current.size > 1) {
        clear(); motion.vx = 0; motion.vy = 0;
        pinchDistance.current = distance();
        return;
      }
      if (!playable || !event.isPrimary || !hit.current?.(event.clientX, event.clientY)) return;
      event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
      motion.vx = 0; motion.vy = 0; motion.dragging = true;
      active.current = { id: event.pointerId, gesture: beginGesture(event.clientX, event.clientY, event.timeStamp), x: event.clientX, y: event.clientY, time: event.timeStamp };
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (pointers.current.has(event.pointerId)) {
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 2) {
          const gap = distance();
          if (gap > 2 && pinchDistance.current > 2) zoomBy(gap / pinchDistance.current);
          pinchDistance.current = gap;
          return;
        }
      }
      if (event.pointerType !== 'touch' && !event.buttons) {
        const box = event.currentTarget.getBoundingClientRect();
        motion.hoverYaw = ((event.clientX - box.left) / box.width - 0.5) * 0.28;
        motion.hoverPitch = ((event.clientY - box.top) / box.height - 0.5) * 0.16;
      }
      const pointer = active.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      pointer.gesture = moveGesture(pointer.gesture, event.clientX, event.clientY);
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      const dt = Math.max(0.008, (event.timeStamp - pointer.time) / 1000);
      motion.x += dy * 0.009 * sensitivity; motion.y += dx * 0.009 * sensitivity;
      motion.vx = dy * 0.009 * sensitivity / dt; motion.vy = dx * 0.009 * sensitivity / dt;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.time = event.timeStamp;
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      pointers.current.delete(event.pointerId); pinchDistance.current = distance();
      const pointer = active.current; clear();
      if (!pointer || pointer.id !== event.pointerId) return;
      if (event.timeStamp - pointer.time > 80) { motion.vx = 0; motion.vy = 0; }
      if (playable && isTap(endGesture(pointer.gesture, event.clientX, event.clientY, event.timeStamp))) bite();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerLeave() { motion.hoverYaw = 0; motion.hoverPitch = 0; },
    onPointerCancel(event: PointerEvent<HTMLDivElement>) { pointers.current.delete(event.pointerId); pinchDistance.current = distance(); clear(); },
    onLostPointerCapture(event: PointerEvent<HTMLDivElement>) { pointers.current.delete(event.pointerId); pinchDistance.current = distance(); if (active.current?.id === event.pointerId) clear(); },
    onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.target !== event.currentTarget || (event.key !== ' ' && event.key !== 'Enter')) return;
      event.preventDefault(); if (playable && !event.repeat) bite();
    },
  };
}
