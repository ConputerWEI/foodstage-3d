import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace, BufferAttribute, BufferGeometry, Group, PMREMGenerator, Points, Raycaster, Vector2, Mesh, type Material, type PerspectiveCamera } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { SequenceState, SequenceEvent } from '../core/sequence';
import type { ModelAsset } from './assets';
import { stepMotion, type Motion } from './motion';
import type { FoodStage } from '../data/foods';
import { modelPlacement, modelPivot } from './presentation';
import { compactCrumbs } from './crumbs';
import { bitePose, createCrumbBurst, stageBlend, STAGE_BLEND_SECONDS } from './bite-effects';

export type HitTest = (x: number, y: number) => boolean;
interface Props {
  asset: ModelAsset; base: ModelAsset; state: SequenceState; motion: Motion; stage: FoodStage;
  reduced: boolean; dispatch: (event: SequenceEvent) => void;
  setHit: (hit: HitTest | null, owner?: HitTest) => void;
  onContextLost: () => void;
}
function Food({ asset, base, state, motion, stage, reduced, dispatch, setHit }: Props) {
  const rotation = useRef<Group>(null), shakeGroup = useRef<Group>(null), crumbPoints = useRef<Points>(null);
  const seenCrumbPulse = useRef(0);
  const entrance = useRef(0);
  const incoming = useRef<Group>(null), outgoing = useRef<Group>(null);
  const { camera, size, gl } = useThree();
  const ownedMaterials = useRef(new Set<Material>());
  const layer = useMemo(() => {
    const scene = asset.scene.clone(true);
    const materials: Material[] = [];
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const clone = (material: Material) => {
        const copy = material.clone();
        copy.transparent = true;
        materials.push(copy); ownedMaterials.current.add(copy);
        return copy;
      };
      object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
    });
    const placement = modelPlacement(base.size, asset.size, asset.center, state.stage);
    const scale = placement.scale * stage.calibration.scale;
    const pivotY = modelPivot(base.size, asset.size, scale)[1] + stage.calibration.position[1];
    return { scene, materials, placement, scale, pivotY, calibration: stage.calibration };
  }, [asset, base, stage, state.stage]);
  const visibleLayer = useRef(layer);
  const previousLayer = useRef<typeof layer | null>(null);
  const blendAge = useRef(STAGE_BLEND_SECONDS);
  if (visibleLayer.current !== layer) {
    previousLayer.current = visibleLayer.current;
    visibleLayer.current = layer;
    blendAge.current = 0;
  }
  useEffect(() => () => { for (const material of ownedMaterials.current) material.dispose(); ownedMaterials.current.clear(); }, []);
  const timeline = useRef({ key: '', elapsed: 0, done: false });
  const crumbData = useMemo(() => {
    const positions = new Float32Array(96 * 3);
    const geometry = new BufferGeometry();
    const attribute = new BufferAttribute(positions, 3);
    geometry.setAttribute('position', attribute);
    return { positions, attribute, velocities: new Float32Array(96 * 3), ages: new Float32Array(96).fill(2), geometry };
  }, []);
  const hitRef = useRef<HitTest | null>(null);
  useEffect(() => () => crumbData.geometry.dispose(), [crumbData]);
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const radius = base.size.length() / 2;
    const verticalHalfFov = cam.fov * Math.PI / 360;
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * size.width / size.height);
    const distance = radius * 1.16 / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));
    cam.position.set(0, distance * 0.2, distance);
    cam.near = Math.max(radius / 100, 0.0001);
    cam.far = distance + radius * 10;
    cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  }, [camera, size, base]);
  useEffect(() => {
    const ray = new Raycaster(), point = new Vector2();
    const hitTest: HitTest = (x, y) => {
      const rect = gl.domElement.getBoundingClientRect();
      point.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(point, camera);
      return !!incoming.current && ray.intersectObject(incoming.current, true).length > 0;
    };
    hitRef.current = hitTest;
    setHit(hitTest);
    return () => {
      if (hitRef.current === hitTest) hitRef.current = null;
    };
  }, [camera, gl, setHit]);
  useFrame((_, dt) => {
    const finishingBurst = motion.shake > 0.8;
    const frameDt = Math.min(dt, 1 / 30);
    stepMotion(motion, frameDt);
    if (!rotation.current || !shakeGroup.current) return;
    blendAge.current += dt;
    const blend = stageBlend(blendAge.current, reduced);
    for (const material of layer.materials) { material.opacity = blend; material.depthWrite = blend === 1; }
    if (incoming.current) incoming.current.scale.setScalar(0.97 + 0.03 * blend);
    const previous = previousLayer.current;
    if (previous) {
      for (const material of previous.materials) { material.opacity = 1 - blend; material.depthWrite = false; }
      if (outgoing.current) { outgoing.current.visible = blend < 1; outgoing.current.scale.setScalar(1 - 0.035 * blend); }
    }
    gl.domElement.dataset.stageBlend = String(blend);
    entrance.current = motion.dragging ? 2 : Math.min(2, entrance.current + dt);
    const reveal = reduced ? 0 : 0.38 * Math.pow(1 - entrance.current / 2, 3);
    rotation.current.rotation.set(motion.x, motion.y + reveal, 0);
    gl.domElement.dataset.rotationX = String(motion.x);
    gl.domElement.dataset.rotationY = String(motion.y);
    const pose = bitePose(motion.age, motion.crumbPulse > 0 ? 0.8 : 0, reduced);
    shakeGroup.current.position.set(pose.x, pose.y, 0);
    shakeGroup.current.rotation.z = pose.roll;
    shakeGroup.current.scale.set(pose.scaleX, pose.scaleY, 1);
    gl.domElement.dataset.bitePulse = String(motion.crumbPulse);
    gl.domElement.dataset.recoil = String(Math.abs(pose.x) + Math.abs(pose.scaleY - 1));
    if (motion.crumbPulse !== seenCrumbPulse.current) {
      const count = motion.crumbPulse - seenCrumbPulse.current;
      seenCrumbPulse.current = motion.crumbPulse;
      const alive = compactCrumbs(crumbData.positions, crumbData.velocities, crumbData.ages, 0.65);
      const burst = reduced ? [] : Array.from({ length: Math.min(count, 3) }, () => createCrumbBurst(asset.size, finishingBurst)).flat();
      const emitted = burst.slice(0, crumbData.ages.length - alive);
      emitted.forEach((crumb, n) => {
        crumbData.positions.set(crumb.position, (alive + n) * 3);
        crumbData.velocities.set(crumb.velocity, (alive + n) * 3);
        crumbData.ages[alive + n] = 0;
      });
      crumbData.attribute.needsUpdate = true;
    }
    for (let i = 0; i < crumbData.ages.length; i++) {
      const age = crumbData.ages[i]!;
      if (age >= 0.65) break;
      const offset = i * 3;
      crumbData.ages[i] = age + frameDt;
      crumbData.positions[offset] = crumbData.positions[offset]! + crumbData.velocities[offset]! * frameDt;
      crumbData.positions[offset + 1] = crumbData.positions[offset + 1]! + crumbData.velocities[offset + 1]! * frameDt;
      crumbData.positions[offset + 2] = crumbData.positions[offset + 2]! + crumbData.velocities[offset + 2]! * frameDt;
      crumbData.velocities[offset + 1] = crumbData.velocities[offset + 1]! - asset.size.y * 3 * frameDt;
    }
    const aliveCount = compactCrumbs(crumbData.positions, crumbData.velocities, crumbData.ages, 0.65);
    gl.domElement.dataset.crumbs = String(aliveCount);
    crumbData.attribute.needsUpdate = true;
    crumbData.geometry.setDrawRange(0, aliveCount);
    const key = `${state.run}/${state.transition}/${state.phase}`;
    if (timeline.current.key !== key) timeline.current = { key, elapsed: 0, done: false };
    const time = timeline.current;
    if (state.phase !== 'final') return;
    time.elapsed += dt;
    const duration = reduced ? 0.02 : 0.06;
    if (time.elapsed >= duration && !time.done) {
      time.done = true;
      dispatch({ type: 'FINAL_DONE', run: state.run, transition: state.transition });
    }
  });
  const previous = previousLayer.current;
  return <group position={[layer.calibration.position[0], layer.pivotY, layer.calibration.position[2]]}><group ref={rotation}><group ref={shakeGroup}>
    {previous && <group ref={outgoing} position-y={previous.pivotY - layer.pivotY}>
      <group scale={previous.scale} rotation-y={previous.calibration.yaw}>
        <primitive object={previous.scene} position={previous.placement.centeredPosition} dispose={null} />
      </group>
    </group>}
    <group ref={incoming}><group scale={layer.scale} rotation-y={layer.calibration.yaw}>
      <primitive object={layer.scene} position={layer.placement.centeredPosition} dispose={null} />
      <points ref={crumbPoints} geometry={crumbData.geometry}>
        <pointsMaterial color="#B78553" size={4} sizeAttenuation={false} transparent opacity={0.9} depthWrite={false} />
      </points>
    </group></group>
  </group></group></group>;
}
function StudioReflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const room = new RoomEnvironment();
    const environment = new PMREMGenerator(gl).fromScene(room, 0.06);
    room.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.3;
    return () => {
      if (scene.environment === environment.texture) scene.environment = null;
      environment.dispose();
    };
  }, [gl, scene]);
  return null;
}
function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    canvas.addEventListener('webglcontextlost', handleLost, { once: true });
    return () => canvas.removeEventListener('webglcontextlost', handleLost);
  }, [gl, onLost]);
  return null;
}
export function Scene(props: Props) {
  return <Canvas camera={{ position: [0, 0.12, 0.6], fov: 34, near: 0.001, far: 10 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: SRGBColorSpace }} fallback={<span>无法启动三维画面，请使用支持 WebGL 的浏览器。</span>}>
    <ContextLossWatcher onLost={props.onContextLost} />
    <StudioReflections />
    <ambientLight intensity={0.08} />
    <hemisphereLight args={['#fff6e8', '#665344', 0.3]} />
    <spotLight color="#fff0da" position={[-1.2, 1.8, 1.4]} intensity={18} distance={0} angle={0.5} penumbra={1} decay={2} />
    <directionalLight color="#edf4ff" position={[2, 0.5, 1]} intensity={0.55} />
    <directionalLight color="#fff5e7" position={[0.5, 1.4, -2]} intensity={1.8} />
    <Food {...props} />
  </Canvas>;
}
