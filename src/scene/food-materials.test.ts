import { describe, expect, it } from 'vitest';
import { DataTexture, Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial, BoxGeometry, SRGBColorSpace } from 'three';
import { applyFoodMaterials, gradeFoodPixels } from './food-materials';

describe('food appearance', () => {
  it('leaves finalized drink glass PBR and texture pixels untouched on repeated loads', () => {
    const color = new DataTexture(new Uint8Array([214, 175, 112, 93]), 1, 1);
    color.colorSpace = SRGBColorSpace;
    const glass = new MeshPhysicalMaterial({ map: color, transparent: true, opacity: 0.24, depthWrite: false, transmission: 0.8, thickness: 0.003, ior: 1.45, roughness: 0.08, metalness: 0.12 });
    const scene = new Group();
    scene.userData.foodMaterialsBaked = true;
    const mesh = new Mesh(new BoxGeometry(), glass);
    scene.add(mesh);
    applyFoodMaterials(scene);
    applyFoodMaterials(scene);
    expect(mesh.material).toBe(glass);
    expect(mesh.material).toMatchObject({ transparent: true, opacity: 0.24, depthWrite: false, transmission: 0.8, thickness: 0.003, ior: 1.45, roughness: 0.08, metalness: 0.12 });
    expect(mesh.material.map).toBe(color);
    expect(Array.from(color.image.data)).toEqual([214, 175, 112, 93]);
  });
  it('preserves material identity and pixels for models with baked appearance', () => {
    const material = new MeshStandardMaterial({ metalness: 0, roughness: 0.32 });
    const scene = new Group();
    scene.userData.foodMaterialsBaked = true;
    const mesh = new Mesh(new BoxGeometry(), material);
    scene.add(mesh);
    applyFoodMaterials(scene);
    expect(mesh.material).toBe(material);
    expect(mesh.material.roughness).toBe(0.32);
  });
  it('deepens toasted colors while retaining neutral whites and alpha', () => {
    const pixels = new Uint8ClampedArray([214, 175, 112, 93, 255, 255, 255, 255, 100, 100, 100, 200]);
    gradeFoodPixels(pixels);
    expect(pixels[0]! - pixels[2]!).toBeGreaterThan(102);
    expect(pixels[1]).toBeLessThan(175);
    expect(Array.from(pixels.slice(4, 8))).toEqual([255, 255, 255, 255]);
    expect(pixels[8]).toBe(pixels[9]);
    expect(pixels[9]).toBe(pixels[10]);
    expect(pixels[3]).toBe(93);
    expect(pixels[11]).toBe(200);
  });

  it('adds midtone depth without clipping highlights or tinting neutral pixels', () => {
    const pixels = new Uint8ClampedArray([180, 130, 80, 210, 235, 235, 235, 255, 255, 255, 255, 255]);
    gradeFoodPixels(pixels);
    expect(pixels[0]! - pixels[2]!).toBeGreaterThan(115);
    expect(pixels[1]).toBeLessThan(128);
    expect(pixels[4]).toBeGreaterThan(225);
    expect(pixels[4]).toBe(pixels[5]);
    expect(pixels[5]).toBe(pixels[6]);
    expect(Array.from(pixels.slice(8))).toEqual([255, 255, 255, 255]);
    expect(pixels[3]).toBe(210);
  });

  it('isolates shared source materials and maps while softening imported mirror gloss', () => {
    const color = new DataTexture(new Uint8Array([214, 175, 112, 255]), 1, 1);
    color.colorSpace = SRGBColorSpace;
    color.flipY = false;
    const packed = new DataTexture(new Uint8Array([0, 12, 254, 255]), 1, 1);
    const source = new MeshStandardMaterial({ map: color, roughnessMap: packed, metalnessMap: packed, metalness: 1 });
    const scene = new Group();
    const a = new Mesh(new BoxGeometry(), source);
    const b = new Mesh(new BoxGeometry(), source);
    scene.add(a, b);
    applyFoodMaterials(scene);
    expect(a.material).not.toBe(source);
    expect(a.material).toBe(b.material);
    expect(source.metalness).toBe(1);
    expect(a.material.metalness).toBe(0);
    expect(a.material.map).not.toBe(color);
    expect(a.material.map?.colorSpace).toBe(SRGBColorSpace);
    expect(a.material.map?.flipY).toBe(false);
    expect(Array.from(color.image.data)).toEqual([214, 175, 112, 255]);
    expect(Array.from(packed.image.data)).toEqual([0, 12, 254, 255]);
    expect(a.material.roughnessMap?.image.data[1]).toBeGreaterThan(64);
    expect(a.material.roughnessMap?.image.data[1]).toBeLessThan(82);
    expect(a.material.roughness * a.material.roughnessMap!.image.data[1] / 255).toBeGreaterThan(0.25);
    expect(a.material.roughness * a.material.roughnessMap!.image.data[1] / 255).toBeLessThan(0.33);
    expect(a.material.roughnessMap).toBe(a.material.metalnessMap);
  });
});
