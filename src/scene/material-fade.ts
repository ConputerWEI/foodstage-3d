import type { Material } from 'three';

/** A layer owns its clone; fades must never replace authored glass alpha/depth policy. */
export function cloneFadeMaterial(source: Material) {
  return { material: source.clone(), opacity: source.opacity, transparent: source.transparent, depthWrite: source.depthWrite };
}

export function applyMaterialFade(layer: ReturnType<typeof cloneFadeMaterial>, blend: number): void {
  const fading = blend < 1;
  const transparent = layer.transparent || fading;
  if (layer.material.transparent !== transparent) {
    layer.material.transparent = transparent;
    layer.material.needsUpdate = true;
  }
  layer.material.opacity = layer.opacity * blend;
  layer.material.depthWrite = fading ? false : layer.depthWrite;
}
