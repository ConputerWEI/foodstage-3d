export interface Motion { x: number; y: number; vx: number; vy: number; shake: number; age: number; dragging: boolean; crumbPulse: number; idle: number; hoverPitch: number; hoverYaw: number }
export function createMotion(): Motion { return { x: 0, y: 0, vx: 0, vy: 0, shake: 0, age: 0, dragging: false, crumbPulse: 0, idle: 0, hoverPitch: 0, hoverYaw: 0 }; }
export function impulse(motion: Motion, strength = 0.08): void {
  motion.shake = Math.min(1, motion.shake + strength);
  motion.crumbPulse += 1;
  motion.age = 0;
  motion.idle = 0;
}
/** Exact exponential integration makes displacement independent of refresh rate. */
export function stepMotion(motion: Motion, dt: number): void {
  const elapsed = Math.max(0, dt);
  const decay = Math.exp(-6 * elapsed);
  if (!motion.dragging) {
    motion.x += motion.vx * (1 - decay) / 6;
    motion.y += motion.vy * (1 - decay) / 6;
    motion.vx *= decay; motion.vy *= decay;
  }
  motion.idle = motion.dragging ? 0 : motion.idle + elapsed;
  motion.age += elapsed;
  motion.shake = motion.age >= 0.25 ? 0 : motion.shake * Math.exp(-10 * elapsed);
}
