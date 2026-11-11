import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box3, Group, MathUtils, Vector3 } from 'three';
import { FoodInkEffect } from '../scene/FoodInkEffect';
import { loadPreview, type PreviewAsset } from '../scene/menu-preview-asset';
import type { LoopSceneBridge } from './CarouselHero';
import { SceneBoundary } from './SceneBoundary';

type ModelItem = { modelId: string };
type Bridge = RefObject<LoopSceneBridge>;

function prepareDish(id: string, asset: PreviewAsset) {
  const pose = new Group();
  const yaw = id === 'mango-cheesecake' ? Math.PI / 3 : id === 'crispy-chicken' ? Math.atan2(0.6, 0.8) : 0;
  const pitch = id === 'pepperoni-pizza' ? 33 : id === 'rosemary-fries' ? 24 : 15;
  pose.rotation.set(MathUtils.degToRad(pitch), yaw, 0);
  pose.add(asset.scene.clone(true));

  // Measure this serving angle once so a flat pizza and a tall burger each
  // fill their allotted space without cutting off part of the mesh.
  const bounds = new Box3().setFromObject(pose, true);
  const { x, y } = bounds.getSize(new Vector3());
  const scale = 1 / Math.max(x, y);
  pose.scale.setScalar(scale);
  pose.position.copy(bounds.getCenter(new Vector3())).multiplyScalar(-scale);
  return pose;
}

function DishInstances({ item, index, asset, bridge }: { item: ModelItem; index: number; asset: PreviewAsset; bridge: Bridge }) {
  const pool = useRef<Group>(null);
  const template = useMemo(() => prepareDish(item.modelId, asset), [item.modelId, asset]);
  useFrame(({ size }) => {
    const group = pool.current;
    if (!group) return;
    const { slots, centerY, diameter } = bridge.current;
    let used = 0;
    for (const slot of slots) {
      if (slot.index !== index) continue;
      let instance = group.children[used];
      if (!instance) {
        // A short menu can show the same dish twice at a loop boundary.
        // Clones share the loaded geometry, materials and textures.
        instance = new Group();
        instance.add(template.clone(true));
        group.add(instance);
      }
      instance.visible = true;
      instance.position.set(slot.x - size.width / 2, size.height / 2 - centerY, 0);
      instance.scale.setScalar(Math.min(diameter, slot.width));
      used++;
    }
    for (let i = used; i < group.children.length; i++) group.children[i]!.visible = false;
  });
  return <group ref={pool} dispose={null} />;
}

function ModelStrip({ items, assets, bridge }: { items: readonly ModelItem[]; assets: Record<string, PreviewAsset>; bridge: Bridge }) {
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const channel = bridge.current;
    channel.redraw = invalidate;
    invalidate();
    return () => { delete channel.redraw; };
  }, [bridge, invalidate]);
  return <>
    <ambientLight intensity={0.78} />
    <hemisphereLight args={['#fff4e6', '#775641', 0.7]} />
    <directionalLight color="#fff0da" position={[-300, 500, 650]} intensity={2.8} />
    <directionalLight color="#fff5e7" position={[350, 200, -350]} intensity={1.3} />
    {items.map((item, index) => {
      const asset = assets[item.modelId];
      return asset && <DishInstances key={item.modelId} item={item} index={index} asset={asset} bridge={bridge} />;
    })}
    <FoodInkEffect preview />
  </>;
}

export function CarouselModels({ items, bridge }: { items: readonly ModelItem[]; bridge: Bridge }) {
  const [assets, setAssets] = useState<Record<string, PreviewAsset>>({});
  const [failed, setFailed] = useState<readonly string[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const markUnavailable = useCallback(() => setUnavailable(true), []);
  useEffect(() => {
    let mounted = true;
    setFailed([]);
    items.forEach(({ modelId }) => {
      void loadPreview(modelId).then(asset => {
        if (mounted) setAssets(previous => ({ ...previous, [modelId]: asset }));
      }, () => { if (mounted) setFailed(previous => [...previous, modelId]); });
    });
    return () => { mounted = false; };
  }, [items]);
  const pending = items.every(item => !assets[item.modelId]);
  const message = unavailable ? '此设备无法显示 3D 模型' : failed.length ? '部分模型未能加载' : pending ? '正在加载 3D 菜品…' : '';
  return <div className="food-carousel-models" data-loaded-models={items.filter(item => assets[item.modelId]).map(item => item.modelId).join(' ')}>
    <SceneBoundary fallback={null} onError={markUnavailable}>
      <Canvas frameloop="demand" orthographic camera={{ position: [0, 0, 1000], zoom: 1, near: 0.1, far: 3000 }} dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        fallback={<span className="food-carousel-status">此设备无法显示 3D 模型</span>}>
        <ModelStrip items={items} assets={assets} bridge={bridge} />
      </Canvas>
    </SceneBoundary>
    {message && <span className="food-carousel-status" role="status">{message}</span>}
  </div>;
}
