import { describe, expect, it } from 'vitest';
import { CHEW_SECONDS, bitePose, createCrumbBurst, stageBlend } from './bite-effects';

describe('bite effects', () => {
  it('crossfades stages with a smooth bounded blend and bypasses motion when reduced', () => {
    expect(stageBlend(0, false)).toBe(0);
    expect(stageBlend(0.08, false)).toBeCloseTo(0.5);
    expect(stageBlend(0.24, false)).toBe(1);
    expect(stageBlend(2, false)).toBe(1);
    expect(stageBlend(0, true)).toBe(1);
  });
  it('recoils visibly, then settles exactly at rest without moving the pivot', () => {
    const pose = bitePose(0.08, 1, false);
    expect(pose.scaleY).toBeLessThan(0.97);
    expect(Math.abs(pose.x)).toBeGreaterThan(0.0005);
    expect(CHEW_SECONDS).toBe(0.32);
    expect(bitePose(CHEW_SECONDS, 1, false).scaleY).toBe(1);
    expect(bitePose(0.75, 1, false)).toEqual({ x: 0, y: 0, roll: 0, scaleX: 1, scaleY: 1 });
    expect(bitePose(0.04, 1, true)).toEqual(bitePose(0.75, 1, false));
  });
  it('emits several finite crumbs in front of the food, with a richer stage-end burst', () => {
    const size = { x: 0.15, y: 0.125, z: 0.15 };
    const normal = createCrumbBurst(size, false, () => 0.5);
    const finish = createCrumbBurst(size, true, () => 0.5);
    expect(normal.length).toBe(3);
    expect(finish.length).toBeLessThanOrEqual(5);
    expect(finish.length).toBeGreaterThan(normal.length);
    for (const crumb of finish) {
      expect(crumb.position[2]).toBeGreaterThan(size.z * 0.4);
      expect(crumb.velocity[1]).toBeGreaterThan(0);
      expect([...crumb.position, ...crumb.velocity].every(Number.isFinite)).toBe(true);
    }
  });
});
