export const CHEW_SECONDS = 0.32;
export const STAGE_BLEND_SECONDS = 0.16;
export function stageBlend(age: number, reduced: boolean): number {
  if (reduced) return 1;
  const t = Math.max(0, Math.min(1, age / STAGE_BLEND_SECONDS));
  return t * t * (3 - 2 * t);
}
interface Size { x: number; y: number; z: number }
const rest = { x: 0, y: 0, roll: 0, scaleX: 1, scaleY: 1 };

/** Short damped recoil; zero offset at the end preserves the rotation pivot. */
export function bitePose(age: number, strength: number, reduced: boolean) {
  if (reduced || age >= CHEW_SECONDS || strength <= 0) return rest;
  // Two rounded jaw movements, followed by a gentle settle.
  const pulse = Math.sin(Math.PI * Math.min(age / 0.16, 2)) ** 2;
  const envelope = Math.max(0, 1 - age / CHEW_SECONDS) * strength;
  const squash = pulse * envelope;
  return {
    x: Math.sin(age * 17) * envelope * 0.0015,
    y: -squash * 0.0012,
    roll: Math.sin(age * 17) * envelope * 0.009,
    scaleX: 1 + squash * 0.035,
    scaleY: 1 - squash * 0.065,
  };
}

export function createCrumbBurst(size: Size, finishing: boolean, random: () => number = Math.random) {
  return Array.from({ length: finishing ? 5 : 3 }, () => ({
    position: [(random() - 0.5) * size.x * 0.65, (random() - 0.3) * size.y * 0.35, size.z * (0.48 + random() * 0.1)] as const,
    velocity: [(random() - 0.5) * size.x * 1.5, size.y * (0.4 + random() * 0.65), size.z * (0.12 + random() * 0.3)] as const,
  }));
}
