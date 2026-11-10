import type { FoodStage } from '../data/foods';

interface Vec3 { x: number; y: number; z: number }

/** Source stages vary in both axes; never magnify a later remnant. */
const remainingSize = [
  { width: 1, height: 1 },
  { width: 0.95, height: 0.97 },
  { width: 0.88, height: 0.90 },
  { width: 0.62, height: 0.62 },
] as const;

export function modelPlacement(base: Vec3, current: Vec3, center: Vec3, stage = 0, presentation?: FoodStage['presentation'], baseCenter?: Vec3) {
  if (presentation === 'physical-size-stable') {
    if (!baseCenter) throw new Error('Stable presentation requires the stage-zero center');
    const origin = [-baseCenter.x, -baseCenter.y, -baseCenter.z] as const;
    return { scale: 1, centeredPosition: origin, position: origin };
  }
  if (presentation === 'physical-size') {
    return {
      scale: 1,
      centeredPosition: [-center.x, -center.y, -center.z] as const,
      position: [-center.x, -base.y / 2 - center.y + current.y / 2, -center.z] as const,
    };
  }
  if (presentation === 'fixed-width' && base.x > 0 && current.x > 0) {
    const scale = base.x / current.x;
    return {
      scale,
      centeredPosition: [-center.x, -center.y, -center.z] as const,
      position: [-center.x, -base.y / (2 * scale) - center.y + current.y / 2, -center.z] as const,
    };
  }
  const target = remainingSize[stage] ?? remainingSize[3];
  const scale = stage > 0 && base.x > 0 && base.y > 0 && current.x > 0 && current.y > 0
    ? Math.min(1, base.x * target.width / current.x, base.y * target.height / current.y)
    : 1;
  return {
    scale,
    centeredPosition: [-center.x, -center.y, -center.z] as const,
    position: [-center.x, -base.y / (2 * scale) - center.y + current.y / 2, -center.z] as const,
  };
}

export function modelPivot(base: Vec3, current: Vec3, scale: number, presentation?: FoodStage['presentation']): readonly [number, number, number] {
  if (presentation === 'physical-size-stable') return [0, 0, 0];
  return [0, -base.y / 2 + scale * current.y / 2, 0];
}
