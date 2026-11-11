import { Component, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Box3, Mesh, PerspectiveCamera, PMREMGenerator, Vector3, type Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { foodById } from '../data/foods';
import { applyFoodMaterials } from '../scene/food-materials';
import { FoodInkEffect } from '../scene/FoodInkEffect';

interface PreviewAsset { scene: Group; center: Vector3; scale: number; radius: number }
type PreviewVariant = 'thumbnail' | 'hero' | 'detail';
const models = new Map<string, Promise<PreviewAsset>>();

function loadPreview(foodId: string, previewModelUrl?: string): Promise<PreviewAsset> {
  const cacheKey = previewModelUrl ?? foodId;
  const existing = models.get(cacheKey);
  if (existing) return existing;
  const request = (async () => {
    // Stage-based foods always use their small variant here, including on desktop.
    const url = previewModelUrl ?? foodById(foodId).stages[0]?.url.replace('/models-desktop/', '/models-mobile/');
    if (!url) throw new Error('Missing food model');
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    applyFoodMaterials(gltf.scene);
    const bounds = new Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(extent) || extent <= 0) throw new Error('Empty food model');
    const center = bounds.getCenter(new Vector3());
    // Fit the actual mesh rather than the empty corners of its bounding box.
    // Computed once per cached asset; a sphere remains safe at every yaw angle.
    const point = new Vector3();
    let radiusSquared = 0;
    gltf.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      if (!positions) return;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        radiusSquared = Math.max(radiusSquared, point.distanceToSquared(center));
      }
    });
    const radius = radiusSquared > 0 ? Math.sqrt(radiusSquared) * 2 / extent : size.length() / extent;
    return { scene: gltf.scene, center, scale: 2 / extent, radius };
  })();
  models.set(cacheKey, request);
  // Permit another activation to retry a failed request.
  void request.catch(() => { if (models.get(cacheKey) === request) models.delete(cacheKey); });
  return request;
}

class PreviewBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function ContextLossListener({ onError }: { onError: () => void }) {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', onError);
    // Remove before R3F deliberately loses the context during Canvas disposal.
    return () => canvas.removeEventListener('webglcontextlost', onError);
  }, [gl, onError]);
  return null;
}

/** Local studio reflections give aluminium lids a highlight without a network HDR. */
function PackagingStudio() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const environment = generator.fromScene(room, 0.04);
    room.dispose();
    generator.dispose();
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.8;
    invalidate();
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      environment.dispose();
    };
  }, [gl, scene, invalidate]);
  return <>
    <ambientLight intensity={0.45} />
    <directionalLight position={[-3, 5, 4]} intensity={2.4} color="#fff8ed" />
    <directionalLight position={[3, 2, -3]} intensity={1.4} color="#ffffff" />
  </>;
}

function PreviewModel({ asset, rotation, foodId, variant, standalone, onReady }: { asset: PreviewAsset; rotation: number; foodId: string; variant: PreviewVariant; standalone: boolean; onReady: () => void }) {
  const scene = useMemo(() => asset.scene.clone(true), [asset]);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(1, size.height);
    const halfFov = camera.fov * Math.PI / 360;
    // Fit a sphere around the normalized bounds, so rotation cannot crop the food.
    const radius = standalone ? asset.radius * 1.18 : variant === 'thumbnail' ? 1.9 : asset.radius * 1.06;
    const distance = radius / Math.sin(Math.min(halfFov, Math.atan(Math.tan(halfFov) * aspect)));
    camera.position.set(0, distance * (standalone ? 0.12 : 0.24), distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
    onReady();
  }, [camera, size.width, size.height, invalidate, onReady, asset.radius, variant, standalone]);
  useEffect(() => { invalidate(); }, [rotation, invalidate]);
  return <group rotation={[0, rotation, 0]} scale={foodId === 'crispy-chicken' && variant === 'thumbnail' ? 1.25 : 1} dispose={null}>
    <group scale={asset.scale}><primitive object={scene} position={[-asset.center.x, -asset.center.y, -asset.center.z]} dispose={null} /></group>
  </group>;
}

export interface HoloLight { x: number; y: number; strength: number }

interface MenuModelPreviewProps {
  foodId: string;
  name: string;
  onClose: () => void;
  showClose?: boolean;
  variant?: PreviewVariant;
  onActivate?: () => void;
  previewModelUrl?: string;
  holo?: HoloLight;
}

export default function MenuModelPreview({ foodId, name, onClose, showClose = true, variant = 'thumbnail', onActivate, previewModelUrl, holo }: MenuModelPreviewProps) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; rotation: number } | null>(null);
  const moved = useRef(false);
  const [asset, setAsset] = useState<PreviewAsset | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const standalone = Boolean(previewModelUrl);
  const [inView, setInView] = useState(!standalone);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  // Lay the drumstick's long axis flat across the view (bone→meat axis in the
  // X-Z ground plane at 0.8:0.6), so the thumbnail shows its full side profile.
  const [rotation, setRotation] = useState(() => foodId === 'mango-cheesecake' ? Math.PI / 3 : foodId === 'crispy-chicken' ? Math.atan2(0.6, 0.8) : 0);
  const active = inView && pageVisible;
  const shouldLoad = !standalone || active;
  const markReady = useMemo(() => () => setReady(true), []);
  const markFailed = useMemo(() => () => { setFailed(true); setReady(false); }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    void loadPreview(foodId, previewModelUrl).then(value => {
      if (cancelled) return;
      setFailed(false);
      setAsset(value);
    }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [foodId, previewModelUrl, shouldLoad]);
  useEffect(() => {
    const element = container.current;
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      setInView(entries[0]?.isIntersecting ?? false);
    });
    if (element && observer) observer.observe(element);
    if (!observer) setInView(true);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { if (!active) { setReady(false); drag.current = null; } }, [active]);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('button');
    if ((button && event.currentTarget.contains(button)) || event.button !== 0) return;
    moved.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rotation };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    if (Math.hypot(dx, event.clientY - start.y) > 5) moved.current = true;
    if (Math.abs(dx) > 3 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
      setRotation(start.rotation + dx * 0.018);
    }
  };
  const stopDrag = () => { drag.current = null; };
  return <div ref={container} className={`ordering-model-preview ordering-model-preview--${variant}${ready && active && !failed ? ' is-ready' : ''}`} data-testid="menu-model-preview" data-ready={ready && active && !failed} data-rotation={rotation.toFixed(4)} aria-label={`${name}3D预览`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={() => { moved.current = true; stopDrag(); }} onLostPointerCapture={stopDrag} onClick={event => { event.stopPropagation(); if (!moved.current) onActivate?.(); }}>
    {active && asset && !failed && <PreviewBoundary onError={markFailed}>
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 38, near: 0.1, far: 100 }} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }} fallback={<span className="ordering-preview-status" role="status">加载失败</span>}>
        <ContextLossListener onError={markFailed} />
        {standalone ? <PackagingStudio /> : <>
          <ambientLight intensity={0.65} />
          <hemisphereLight args={['#fff6e8', '#665344', 0.55]} />
          <directionalLight
            color={holo ? '#fff8ee' : '#fff0da'}
            position={holo ? [(holo.x - 0.5) * 10, 2 + (1 - holo.y) * 4, 4] : [-3, 5, 4]}
            intensity={holo ? 2.6 + holo.strength * 0.8 : 3}
          />
          <directionalLight color="#fff5e7" position={[3, 2, -3]} intensity={1.6} />
        </>}
        <PreviewModel asset={asset} rotation={rotation} foodId={foodId} variant={variant} standalone={standalone} onReady={markReady} />
        <FoodInkEffect preview={variant === 'thumbnail'} />
      </Canvas>
    </PreviewBoundary>}
    {(!ready || failed) && <span className="ordering-preview-status" role="status">{failed ? '加载失败' : active ? '加载中…' : '预览已暂停'}</span>}
    {showClose && <button className="ordering-preview-close" aria-label="关闭3D预览" onClick={event => { event.stopPropagation(); onClose(); }}>×</button>}
  </div>;
}
