import { describe, expect, it } from 'vitest';
import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { cloneFadeMaterial, applyMaterialFade } from './material-fade';

describe('stage material fades', () => {
  it('multiplies authored glass alpha, restores depth policy, and leaves the source PBR intact', () => {
    const source = new MeshPhysicalMaterial({ transparent: true, opacity: 0.24, depthWrite: false, roughness: 0.08, metalness: 0.12, transmission: 0.8, thickness: 0.003, ior: 1.45 });
    const fade = cloneFadeMaterial(source);
    applyMaterialFade(fade, 0.5);
    expect(fade.material.opacity).toBeCloseTo(0.12);
    expect(fade.material.depthWrite).toBe(false);
    applyMaterialFade(fade, 0);
    expect(fade.material.opacity).toBe(0);
    applyMaterialFade(fade, 1);
    expect(fade.material.opacity).toBe(0.24);
    expect(fade.material.depthWrite).toBe(false);
    expect(fade.material.transparent).toBe(true);
    expect(fade.material).toMatchObject({ roughness: 0.08, metalness: 0.12, transmission: 0.8, thickness: 0.003, ior: 1.45 });
    expect(source.opacity).toBe(0.24);
    expect(source.depthWrite).toBe(false);
  });

  it('restores opaque rendering after repeated fades without compounding alpha', () => {
    const source = new MeshStandardMaterial({ opacity: 0.8, transparent: false, depthWrite: true });
    const fade = cloneFadeMaterial(source);
    expect(fade.material).not.toBe(source);
    expect(fade.material.transparent).toBe(false);
    for (const blend of [0.5, 0.25, 0.5]) applyMaterialFade(fade, blend);
    expect(fade.material.opacity).toBe(0.4);
    expect(fade.material.transparent).toBe(true);
    expect(fade.material.depthWrite).toBe(false);
    applyMaterialFade(fade, 1);
    expect(fade.material.opacity).toBe(0.8);
    expect(fade.material.transparent).toBe(false);
    expect(fade.material.depthWrite).toBe(true);
    expect(source.transparent).toBe(false);
    expect(source.opacity).toBe(0.8);
  });
});
