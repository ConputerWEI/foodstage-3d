import { describe, expect, it } from 'vitest';
import { Euler, PerspectiveCamera, Vector3 } from 'three';
import { modelPlacement, modelPivot } from './presentation';
import { foodById } from '../data/foods';

const sizes = [
  { x: 0.15043, y: 0.125, z: 0.15007 },
  { x: 0.15842, y: 0.125, z: 0.15101 },
  { x: 0.19269, y: 0.125, z: 0.17730 },
  { x: 0.13432, y: 0.130, z: 0.08214 },
];
const zero = { x: 0, y: 0, z: 0 };

describe('modelPlacement', () => {
  it('keeps surviving source points fixed across changing bounds under arbitrary rotations', () => {
    const base = { x: 0.16, y: 0.06, z: 0.12 };
    const baseCenter = { x: 0.04, y: 0.05, z: -0.03 };
    const stages = [
      { size: base, center: baseCenter },
      { size: { x: 0.11, y: 0.05, z: 0.09 }, center: { x: 0.06, y: 0.045, z: -0.02 } },
      { size: { x: 0.07, y: 0.04, z: 0.05 }, center: { x: 0.08, y: 0.04, z: -0.01 } },
    ];
    const points = [new Vector3(0.08, 0.02, -0.02), new Vector3(0.09, 0.04, 0), new Vector3(0.07, 0.06, -0.01)];
    for (const [stage, current] of stages.entries()) {
      const placement = modelPlacement(base, current.size, current.center, stage, 'physical-size-stable', baseCenter);
      const pivot = modelPivot(base, current.size, placement.scale, 'physical-size-stable');
      expect(placement.scale).toBe(1);
      expect(pivot).toEqual([0, 0, 0]);
      // All stages retain a source floor at y=0.02; no current-bounds recentering.
      expect(new Vector3(0, 0.02, 0).add(new Vector3(...placement.centeredPosition)).y + pivot[1]).toBeCloseTo(-0.03, 10);
      for (const point of points) {
        for (const [pitch, yaw] of [[0, 0], [0, 1.4], [0.7, -1.1], [-0.8, Math.PI]]) {
          const rotation = new Euler(pitch, yaw, 0);
          const actual = point.clone().add(new Vector3(...placement.centeredPosition)).multiplyScalar(placement.scale).applyEuler(rotation).add(new Vector3(...pivot));
          const expected = point.clone().sub(new Vector3(0.04, 0.05, -0.03)).applyEuler(rotation);
          expect(actual.distanceTo(expected)).toBeLessThan(1e-12);
          const camera = new PerspectiveCamera(34, 390 / 844, 0.001, 10);
          camera.position.set(0, 0.08, 0.5);
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld();
          expect(actual.clone().project(camera).distanceTo(expected.clone().project(camera))).toBeLessThan(1e-12);
        }
      }
    }
  });
  it('rejects stable placement without a reference center rather than silently recentering remnants', () => {
    expect(() => modelPlacement(sizes[0]!, sizes[1]!, zero, 1, 'physical-size-stable')).toThrow('stage-zero center');
  });

  it('preserves pizza physical size even when the final overlapping slice increases height', () => {
    const base = { x: 0.3, y: 0.049, z: 0.3 };
    const stacked = { x: 0.28, y: 0.08, z: 0.25 };
    const retained = { x: 0.28, y: 0.045, z: 0.22 };
    const final = { x: 0.28, y: 0.10, z: 0.25 };
    const pizza = foodById('pepperoni-pizza');
    for (let stage = 0; stage < 4; stage++) {
      expect(pizza.stages[stage]!.presentation).toBe('physical-size');
      const current = stage === 0 ? base : stage === 1 ? stacked : stage === 2 ? retained : final;
      const placement = modelPlacement(base, current, zero, stage, 'physical-size');
      expect(placement.scale).toBe(1);
      const scale = placement.scale * pizza.stages[stage]!.calibration.scale;
      const pivot = modelPivot(base, current, scale);
      expect(pivot[1] - current.y * scale / 2).toBeCloseTo(-base.y / 2, 8);
    }
  });
  it('keeps pure fries progressively smaller on a common floor without magnifying remnants', () => {
    const fries = foodById('rosemary-fries');
    const variants = [
      { x: 0.100, y: 0.053301543, z: 0.099867828 },
      { x: 0.070, y: 0.039910093, z: 0.070140362 },
      { x: 0.075, y: 0.035080262, z: 0.074943461 },
      { x: 0.075, y: 0.037705187, z: 0.076043151 },
    ];
    const base = variants[0]!;
    const widths: number[] = [];
    variants.forEach((size, index) => {
      expect(fries.stages[index]!.presentation).toBeUndefined();
      const placement = modelPlacement(base, size, zero, index, fries.stages[index]!.presentation);
      const scale = placement.scale * fries.stages[index]!.calibration.scale;
      expect(scale).toBeLessThanOrEqual(1);
      widths.push(size.x * scale);
      const pivot = modelPivot(base, size, scale);
      expect(pivot[1] - size.y * scale / 2).toBeCloseTo(-base.y / 2, 8);
      if (index > 0) expect(widths[index]!).toBeLessThan(widths[index - 1]!);
    });
    expect(widths[0]).toBeCloseTo(0.1, 6);
    expect(widths[1]).toBeCloseTo(0.07, 6);
    expect(widths[2]).toBeCloseTo(0.06, 6);
    expect(widths[3]).toBeCloseTo(0.0403, 4);
  });
  it('uses a common floor without magnifying any later stage', () => {
    const base = { x: 0.14, y: 0.12, z: 0.1 };
    const small = { x: 0.07, y: 0.08, z: 0.06 };
    const placement = modelPlacement(base, small, { x: 0.02, y: 0.03, z: -0.01 });
    expect(placement.scale).toBe(1);
    expect(placement.position[0]).toBe(-0.02);
    expect(placement.position[1]).toBeCloseTo(-0.05, 10);
    expect(placement.position[2]).toBe(0.01);
  });

  it('keeps stages two and three substantial, then makes the final remnant clearly smaller', () => {
    const projected = sizes.map((size, stage) => modelPlacement(sizes[0]!, size, zero, stage));
    const widths = sizes.map((size, stage) => size.x * projected[stage]!.scale);
    const heights = sizes.map((size, stage) => size.y * projected[stage]!.scale);
    expect(widths[1]!).toBeGreaterThan(widths[0]! * 0.94);
    expect(widths[2]!).toBeGreaterThan(widths[0]! * 0.87);
    expect(heights[1]!).toBeGreaterThan(heights[0]! * 0.89);
    expect(heights[2]!).toBeGreaterThan(heights[0]! * 0.68);
    expect(widths[2]!).toBeLessThan(widths[1]!);
    expect(heights[2]!).toBeLessThan(heights[1]!);
    expect(widths[3]!).toBeGreaterThan(widths[2]! * 0.56);
    expect(heights[3]!).toBeGreaterThan(heights[2]! * 0.72);
    expect(widths[3]!).toBeLessThan(widths[2]! * 0.75);
    expect(heights[3]!).toBeLessThan(heights[2]! * 0.92);
  });

  it('keeps the visual model center on the rotation pivot while stages rest on the same floor', () => {
    const base = sizes[0]!;
    for (let stage = 0; stage < sizes.length; stage++) {
      const asset = sizes[stage]!;
      const placement = modelPlacement(base, asset, { x: 0, y: asset.y * 0.1, z: 0 }, stage);
      const pivot = modelPivot(base, asset, placement.scale);
      const center = {
        x: placement.scale * (placement.position[0] + 0),
        y: placement.scale * (placement.position[1] + asset.y * 0.1),
        z: placement.scale * placement.position[2],
      };
      expect(center.x).toBeCloseTo(pivot[0], 10);
      expect(center.y).toBeCloseTo(pivot[1], 10);
      expect(center.z).toBeCloseTo(pivot[2], 10);
      const sourceCenter = new Vector3(0.03, asset.y * 0.1, -0.02);
      const renderedPlacement = modelPlacement(base, asset, sourceCenter, stage);
      const centeredLocal = sourceCenter.clone().add(new Vector3(...renderedPlacement.centeredPosition)).multiplyScalar(placement.scale);
      for (const angles of [[0.9, 1.2, 0], [-1.1, -0.7, 0], [0, Math.PI, 0]]) {
        const transformed = centeredLocal.clone().applyEuler(new Euler(angles[0], angles[1], angles[2])).add(new Vector3(...pivot));
        expect(transformed.toArray()).toEqual([...pivot]);
      }
      expect(pivot[1] - placement.scale * asset.y / 2).toBeCloseTo(-base.y / 2, 10);
    }
  });
});
