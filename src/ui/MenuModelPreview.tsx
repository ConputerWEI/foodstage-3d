import { Component, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Box3, PerspectiveCamera, Vector3, type Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { foodById } from '../data/foods';
import { applyFoodMaterials } from '../scene/food-materials';

interface PreviewAsset { scene: Group; center: Vector3; scale: number }
const models = new Map<string, Promise<PreviewAsset>>();

function loadPreview(foodId: string): Promise<PreviewAsset> {
  const existing = models.get(foodId);
  if (existing) return existing;
  const request = (async () => {
    const stage = foodById(foodId).stages[0];
    if (!stage) throw new Error('Missing food model');
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    // Menu thumbnails always use the small variant, including on desktop.
    const gltf = await loader.loadAsync(stage.url.replace('/models-desktop/', '/models-mobile/'));
    applyFoodMaterials(gltf.scene);
    const bounds = new Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(extent) || extent <= 0) throw new Error('Empty food model');
    return { scene: gltf.scene, center: bounds.getCenter(new Vector3()), scale: 2 / extent };
  })();
  models.set(foodId, request);
  // Permit another activation to retry a failed request.
  void request.catch(() => { if (models.get(foodId) === request) models.delete(foodId); });
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

function PreviewModel({ asset, rotation, foodId, onReady }: { asset: PreviewAsset; rotation: number; foodId: string; onReady: () => void }) {
  const scene = useMemo(() => asset.scene.clone(true), [asset]);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(1, size.height);
    const halfFov = camera.fov * Math.PI / 360;
    // Fit a sphere around the normalized bounds, so rotation cannot crop the food.
    const distance = 1.9 / Math.sin(Math.min(halfFov, Math.atan(Math.tan(halfFov) * aspect)));
    camera.position.set(0, distance * 0.24, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
    onReady();
  }, [camera, size.width, size.height, invalidate, onReady]);
  useEffect(() => { invalidate(); }, [rotation, invalidate]);
  return <group rotation={[0, rotation, 0]} scale={foodId === 'crispy-chicken' ? 1.25 : 1} dispose={null}>
    <group scale={asset.scale}><primitive object={scene} position={[-asset.center.x, -asset.center.y, -asset.center.z]} dispose={null} /></group>
  </group>;
}

export default function MenuModelPreview({ foodId, name, onClose, showClose = true }: { foodId: string; name: string; onClose: () => void; showClose?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; rotation: number } | null>(null);
  const [asset, setAsset] = useState<PreviewAsset | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  // Lay the drumstick's long axis flat across the view (bone→meat axis in the
  // X-Z ground plane at 0.8:0.6), so the thumbnail shows its full side profile.
  const [rotation, setRotation] = useState(() => foodId === 'mango-cheesecake' ? Math.PI / 3 : foodId === 'crispy-chicken' ? Math.atan2(0.6, 0.8) : 0);
  const active = inView && pageVisible;
  const markReady = useMemo(() => () => setReady(true), []);
  const markFailed = useMemo(() => () => { setFailed(true); setReady(false); }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPreview(foodId).then(value => { if (!cancelled) setAsset(value); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [foodId]);
  useEffect(() => {
    const element = container.current;
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      setInView(entries[0]?.isIntersecting ?? false);
    });
    if (element) observer?.observe(element);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { if (!active) { setReady(false); drag.current = null; } }, [active]);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button') || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rotation };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > 3 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
      setRotation(start.rotation + dx * 0.018);
    }
  };
  const stopDrag = () => { drag.current = null; };
  return <div ref={container} className={`ordering-model-preview${ready && active && !failed ? ' is-ready' : ''}`} data-testid="menu-model-preview" data-ready={ready && active && !failed} data-rotation={rotation.toFixed(4)} aria-label={`${name}3D预览`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} onClick={event => event.stopPropagation()}>
    {active && asset && !failed && <PreviewBoundary onError={markFailed}>
      <Canvas frameloop="demand" dpr={[1, 1]} camera={{ fov: 38, near: 0.1, far: 100 }} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }} fallback={<span className="ordering-preview-status" role="status">加载失败</span>}>
        <ContextLossListener onError={markFailed} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 5, 4]} intensity={2.8} />
        <directionalLight position={[-3, 1, -2]} intensity={1} />
        <PreviewModel asset={asset} rotation={rotation} foodId={foodId} onReady={markReady} />
      </Canvas>
    </PreviewBoundary>}
    {(!ready || failed) && <span className="ordering-preview-status" role="status">{failed ? '加载失败' : active ? '加载中…' : '预览已暂停'}</span>}
    {showClose && <button className="ordering-preview-close" aria-label="关闭3D预览" onClick={event => { event.stopPropagation(); onClose(); }}>×</button>}
  </div>;
}
