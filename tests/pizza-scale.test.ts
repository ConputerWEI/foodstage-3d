import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { foodById } from '../src/data/foods';

function meshWidth(path: string): number {
  const buffer = readFileSync(path);
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  const bounds = gltf.meshes.flatMap((mesh: { primitives: { attributes: { POSITION: number } }[] }) =>
    mesh.primitives.map(primitive => gltf.accessors[primitive.attributes.POSITION]));
  return Math.max(...bounds.map((bound: { max: number[] }) => bound.max[0]))
    - Math.min(...bounds.map((bound: { min: number[] }) => bound.min[0]));
}

describe('pizza installed physical scale', () => {
  for (const variant of ['models-mobile', 'models-desktop']) {
    it(`keeps the three-slice diameter within 2% of the five-slice diameter for ${variant}`, () => {
      const pizza = foodById('pepperoni-pizza');
      const widths = [1, 2].map(stage => meshWidth(`public/${variant}/pepperoni-pizza-${stage}.glb`)
        * pizza.stages[stage]!.calibration.scale);
      expect(widths[1]! / widths[0]!).toBeGreaterThanOrEqual(0.98);
      expect(widths[1]! / widths[0]!).toBeLessThanOrEqual(1.02);
    });
  }
});
