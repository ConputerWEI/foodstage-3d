import { DataTexture, Mesh, MeshStandardMaterial, Source, SRGBColorSpace, type Material, type Object3D, type Texture } from 'three';

// Grade in linear light, then encode back to sRGB for the normal Three texture pipeline.
const linear = Array.from({ length: 256 }, (_, i) => {
  const value = i / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});
const encoded = Array.from({ length: 4097 }, (_, i) => {
  const value = (i / 4096) ** 1.13;
  return Math.round(255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055));
});

/** Toasted-color grade in linear light; preserve neutral whites and alpha. */
export function gradeFoodPixels(pixels: Uint8ClampedArray | Uint8Array): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = linear[pixels[i]!]!;
    const g = linear[pixels[i + 1]!]!;
    const b = linear[pixels[i + 2]!]!;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    for (let c = 0; c < 3; c++) {
      const value = linear[pixels[i + c]!]!;
      const saturated = Math.min(1, Math.max(0, luminance + 1.13 * (value - luminance)));
      pixels[i + c] = encoded[Math.round(saturated * 4096)]!;
    }
  }
}

function copyPixels(texture: Texture): { data: Uint8ClampedArray | Uint8Array; width: number; height: number } | undefined {
  const image = texture.image;
  if (!image?.width || !image?.height) return;
  if (image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray) {
    if (image.data.length !== image.width * image.height * 4) return;
    return { data: image.data.slice(), width: image.width, height: image.height };
  }
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function adjustedTexture(texture: Texture, grade: (pixels: Uint8ClampedArray | Uint8Array) => void): Texture {
  const pixels = copyPixels(texture);
  if (!pixels) return texture;
  grade(pixels.data);
  const copy = texture.clone();
  // Texture.clone shares Source. Replace it before assigning pixels to avoid changing the GLTF cache.
  if (texture instanceof DataTexture) {
    copy.source = new Source(pixels);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const context = canvas.getContext('2d');
    if (!context) return texture;
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    copy.source = new Source(canvas);
  }
  copy.needsUpdate = true;
  return copy;
}

/** Apply once when a food GLTF loads, consistently across desktop/mobile and every bite stage. */
export function applyFoodMaterials(scene: Object3D): void {
  if (scene.userData.foodMaterialsBaked === true) return;
  const materials = new Map<Material, Material>();
  const colors = new Map<Texture, Texture>();
  const roughness = new Map<Texture, Texture>();
  const adjust = (source: Material): Material => {
    const existing = materials.get(source);
    if (existing) return existing;
    if (!(source instanceof MeshStandardMaterial)) return source;
    const copy = source.clone();
    materials.set(source, copy);
    if (source.map?.colorSpace === SRGBColorSpace) {
      if (!colors.has(source.map)) colors.set(source.map, adjustedTexture(source.map, gradeFoodPixels));
      copy.map = colors.get(source.map)!;
    }
    // Retain the atlas variation while lifting its near-mirror roughness into a broad highlight range.
    if (source.roughnessMap) {
      if (!roughness.has(source.roughnessMap)) {
        roughness.set(source.roughnessMap, adjustedTexture(source.roughnessMap, pixels => {
          for (let i = 1; i < pixels.length; i += 4) pixels[i] = Math.round(0.25 * 255 + 0.75 * pixels[i]!);
        }));
      }
      copy.roughnessMap = roughness.get(source.roughnessMap)!;
      if (source.metalnessMap === source.roughnessMap) copy.metalnessMap = copy.roughnessMap;
    } else {
      copy.roughness = Math.max(0.32, copy.roughness);
    }
    copy.metalness = 0;
    return copy;
  };
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material) ? object.material.map(adjust) : adjust(object.material);
  });
}
