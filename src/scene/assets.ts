import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Box3, Vector3, type Group } from 'three';
import { AssetStore } from '../core/assets';
import { manifest } from '../data/manifest';
import type { FoodStage } from '../data/foods';
import { applyFoodMaterials } from './food-materials';
export interface ModelAsset { scene: Group; center: Vector3; size: Vector3 }

/** Pick an asset variant once when the play screen mounts, keeping the cache stable. */
export function modelUrlForViewport(url: string, viewportWidth: number): string {
  return viewportWidth >= 768 && /^\/models-mobile\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]+\.glb$/.test(url)
    ? url.replace('/models-mobile/', '/models-desktop/')
    : url;
}

export function createModelStore(stages: readonly FoodStage[] = manifest) {
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new AssetStore<ModelAsset>(stages.length, async index => {
    const gltf = await loader.loadAsync(modelUrlForViewport(stages[index]!.url, viewportWidth));
    applyFoodMaterials(gltf.scene);
    const bounds = new Box3().setFromObject(gltf.scene);
    return { scene: gltf.scene, center: bounds.getCenter(new Vector3()), size: bounds.getSize(new Vector3()) };
  });
}
