import { SceneBoundary } from './SceneBoundary';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Color, DoubleSide, Group, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Shape, type ShapeGeometry, Vector2, Vector3 } from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { loadPreview, type PreviewAsset } from '../scene/menu-preview-asset';
import type { CarouselSceneBridge } from './CircularCarousel';

type ModelItem = { modelId: string; title?: string };
type Bridge = RefObject<CarouselSceneBridge>;
const plateColors = ['#ffe6a9', '#d5e3bc', '#ffcfad', '#f7d28f', '#e6d8ba'].map(color => new Color(color));
const backShade = new Color('#886d45');

// One rounded backing per dish. Both the backing and the mesh occupy the ring's
// 3D space, so the visible dish can be picked even when two cards overlap.
const panel = new Shape();
panel.moveTo(-0.45, -0.5);
panel.lineTo(0.45, -0.5);
panel.quadraticCurveTo(0.5, -0.5, 0.5, -0.45);
panel.lineTo(0.5, 0.45);
panel.quadraticCurveTo(0.5, 0.5, 0.45, 0.5);
panel.lineTo(-0.45, 0.5);
panel.quadraticCurveTo(-0.5, 0.5, -0.5, 0.45);
panel.lineTo(-0.5, -0.45);
panel.quadraticCurveTo(-0.5, -0.5, -0.45, -0.5);

function Dish({ id, asset }: { id: string; asset: PreviewAsset }) {
  const scene = useMemo(() => asset.scene.clone(true), [asset]);
  const yaw = id === 'mango-cheesecake' ? Math.PI / 3 : id === 'crispy-chicken' ? Math.atan2(0.6, 0.8) : 0;
  return <group position={[0, 0.035, 0]} rotation={[0, yaw, 0]} scale={asset.scale * 0.432 / asset.radius} dispose={null}>
    <primitive object={scene} position={[-asset.center.x, -asset.center.y, -asset.center.z]} dispose={null} />
  </group>;
}

function Ring({ items, assets, bridge }: { items: readonly ModelItem[]; assets: Record<string, PreviewAsset>; bridge: Bridge }) {
  const rig = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const panelOffset = useMemo(() => new Vector3(), []);
  const center = useMemo(() => new Vector3(), []);
  const { camera, gl, size, invalidate } = useThree();
  const ink = useMemo(() => new OutlineEffect(gl, {
    defaultThickness: 0.0046, defaultColor: [0.009, 0.006, 0.004],
  }), [gl]);
  useFrame(({ scene }) => ink.render(scene, camera), 1);
  useEffect(() => {
    const channel = bridge.current;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    channel.redraw = invalidate;
    channel.pick = (x, y) => {
      if (!ring.current) return;
      const bounds = gl.domElement.getBoundingClientRect();
      pointer.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(ring.current.children, true)[0];
      let node = hit?.object;
      while (node && !Number.isInteger(node.userData.index)) node = node.parent ?? undefined;
      return node?.userData.index;
    };
    invalidate();
    return () => { delete channel.redraw; delete channel.pick; };
  }, [bridge, camera, gl, invalidate]);

  useFrame(() => {
    const pose = bridge.current.pose;
    if (!pose || !rig.current || !ring.current || !(camera instanceof PerspectiveCamera)) return;
    const fit = Math.min(pose.fit, size.width / (pose.radius * 2 + pose.cardWidth * 0.66));
    const focalLength = pose.perspective * fit;
    camera.fov = MathUtils.radToDeg(2 * Math.atan(size.height / (2 * focalLength)));
    camera.position.z = pose.perspective;
    camera.setViewOffset(size.width, size.height, 0, -pose.shift, size.width, size.height);
    rig.current.position.z = -pose.radius;
    rig.current.rotation.set(MathUtils.degToRad(-pose.pitch), MathUtils.degToRad(pose.yaw), 0);
    for (const [index, slot] of ring.current.children.entries()) {
      const placement = pose.slots[index];
      if (!placement) continue;
      const angle = MathUtils.degToRad(pose.angle + index * 360 / items.length);
      slot.position.set(Math.sin(angle) * placement.radius, -placement.lift, Math.cos(angle) * placement.radius);
      slot.rotation.y = Math.sin(angle) * 0.57;
      slot.scale.setScalar(pose.cardWidth);
      // Place the backing behind the entire mesh along the viewing ray. Its
      // visual center stays behind the food even at the outer edges of the ring.
      slot.getWorldPosition(center);
      panelOffset.subVectors(center, camera.position).normalize().multiplyScalar(pose.cardWidth * 0.46).add(center);
      const backing = slot.children[0] as Mesh<ShapeGeometry, MeshBasicMaterial>;
      backing.position.copy(slot.worldToLocal(panelOffset));
      backing.material.color.copy(plateColors[index % plateColors.length]!).lerp(backShade, 0.30 * (1 - Math.cos(angle)));
    }
  });
  return <>
    <ambientLight intensity={0.78} />
    <hemisphereLight args={['#fff4e6', '#775641', 0.7]} />
    <directionalLight color="#fff0da" position={[-300, 500, 650]} intensity={2.8} />
    <directionalLight color="#fff5e7" position={[350, 200, -350]} intensity={1.3} />
    <group ref={rig}><group ref={ring}>
      {items.map((item, index) => <group key={item.modelId} userData={{ index }}>
        <mesh scale={[1.03, 0.92, 1]}>
          <shapeGeometry args={[panel, 6]} />
          <meshBasicMaterial color={plateColors[index % plateColors.length]} side={DoubleSide} toneMapped={false} userData={{ outlineParameters: { visible: false } }} />
        </mesh>
        {assets[item.modelId] && <Dish id={item.modelId} asset={assets[item.modelId]!} />}
      </group>)}
    </group></group>
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
      <Canvas frameloop="demand" camera={{ fov: 35, near: 1, far: 4200 }} dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        fallback={<span className="food-carousel-status">此设备无法显示 3D 模型</span>}>
        <Ring items={items} assets={assets} bridge={bridge} />
      </Canvas>
    </SceneBoundary>
    {message && <span className="food-carousel-status" role="status">{message}</span>}
  </div>;
}
