import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace, BufferAttribute, BufferGeometry, Group, PMREMGenerator, Points, Raycaster, Vector2, Mesh, type Material, type PerspectiveCamera } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { SequenceState, SequenceEvent } from '../core/sequence';
import type { ModelAsset } from './assets';
import { stepMotion, type Motion } from './motion';
import type { FoodInteraction, FoodStage } from '../data/foods';
import { cloneFadeMaterial, applyMaterialFade } from './material-fade';
import { modelPlacement, modelPivot } from './presentation';
import { compactCrumbs } from './crumbs';
import { bitePose, createCrumbBurst, stageBlend, STAGE_BLEND_SECONDS } from './bite-effects';
import { FoodInkEffect } from './FoodInkEffect';

export type HitTest = (x: number, y: number) => boolean;
interface Props {
  interaction?: FoodInteraction;
  zoom: number; spinning: boolean;
  asset: ModelAsset; base: ModelAsset; state: SequenceState; motion: Motion; stage: FoodStage;
  reduced: boolean; dispatch: (event: SequenceEvent) => void;
  setHit: (hit: HitTest | null, owner?: HitTest) => void;
  onContextLost: () => void;
}
function Food({ asset, base, state, motion, stage, reduced, dispatch, setHit, zoom, spinning, interaction = 'solid' }: Props) {
  const rotation = useRef<Group>(null), shakeGroup = useRef<Group>(null), crumbPoints = useRef<Points>(null);
  const seenCrumbPulse = useRef(0);
  const entrance = useRef(0);
  const view = useRef({ clock: 0, pitch: 0, yaw: 0, spinSpeed: 0 });
  const floating = useRef<Group>(null);
  const incoming = useRef<Group>(null), outgoing = useRef<Group>(null);
  const { camera, size, gl } = useThree();
  const ownedMaterials = useRef(new Set<Material>());
  const layer = useMemo(() => {
    const scene = asset.scene.clone(true);
    const materials: ReturnType<typeof cloneFadeMaterial>[] = [];
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const clone = (material: Material) => {
        const fade = cloneFadeMaterial(material);
        materials.push(fade); ownedMaterials.current.add(fade.material);
        return fade.material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
    });
    const placement = modelPlacement(base.size, asset.size, asset.center, state.stage, stage.presentation, base.center);
    const scale = placement.scale * stage.calibration.scale;
    const pivotY = modelPivot(base.size, asset.size, scale, stage.presentation)[1] + stage.calibration.position[1];
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
    for (const material of layer.materials) applyMaterialFade(material, blend);
    if (incoming.current) incoming.current.scale.setScalar(interaction === 'drink' || stage.presentation === 'physical-size-stable' ? 1 : 0.97 + 0.03 * blend);
    const previous = previousLayer.current;
    if (previous) {
      for (const material of previous.materials) applyMaterialFade(material, 1 - blend);
      if (outgoing.current) { outgoing.current.visible = blend < 1; outgoing.current.scale.setScalar(interaction === 'drink' || stage.presentation === 'physical-size-stable' ? 1 : 1 - 0.035 * blend); }
    }
    gl.domElement.dataset.stageBlend = String(blend);
    // Keep the tasting raycast on exactly the same hierarchy as the viewer transforms.
    const dtView = Math.min(dt, 0.1);
    const smooth = 1 - Math.exp(-dtView * 8);
    const viewer = view.current;
    viewer.clock += dtView;
    entrance.current = reduced || motion.dragging ? 1 : Math.min(1, entrance.current + dtView / 0.85);
    const entering = (1 - entrance.current) ** 3;
    const autoSpin = spinning && !reduced && !motion.dragging && motion.idle > 2;
    viewer.spinSpeed += ((autoSpin ? 0.35 : 0) - viewer.spinSpeed) * smooth;
    if (!motion.dragging && !reduced && spinning) motion.y += viewer.spinSpeed * dtView;
    viewer.pitch += (motion.hoverPitch - viewer.pitch) * smooth;
    viewer.yaw += (motion.hoverYaw - viewer.yaw) * smooth;
    rotation.current.rotation.set(motion.x + (reduced ? 0 : viewer.pitch), motion.y + (reduced ? 0 : viewer.yaw) - 0.32 * entering, 0, 'YXZ');
    if (floating.current) {
      const bob = reduced || !spinning ? 0 : Math.sin(viewer.clock * 1.4) * 0.015;
      floating.current.position.y = layer.pivotY + base.size.length() * (bob - 0.14 * entering);
    }
    const cam = camera as PerspectiveCamera;
    if (Math.abs(cam.zoom - zoom) > 0.0001) {
      cam.zoom = reduced || Math.abs(cam.zoom - zoom) < 0.002 ? zoom : cam.zoom + (zoom - cam.zoom) * smooth;
      cam.updateProjectionMatrix();
    }
    gl.domElement.dataset.rotationX = String(rotation.current.rotation.x);
    gl.domElement.dataset.rotationY = String(rotation.current.rotation.y);
    gl.domElement.dataset.zoom = String(cam.zoom);
    const pose = bitePose(motion.age, motion.crumbPulse > 0 ? 0.8 : 0, reduced, interaction);
    shakeGroup.current.position.set(pose.x, pose.y, 0);
    shakeGroup.current.rotation.z = pose.roll;
    shakeGroup.current.scale.set(pose.scaleX, pose.scaleY, 1);
    gl.domElement.dataset.bitePulse = String(motion.crumbPulse);
    gl.domElement.dataset.recoil = String(Math.abs(pose.x) + Math.abs(pose.scaleY - 1));
    if (motion.crumbPulse !== seenCrumbPulse.current) {
      const count = motion.crumbPulse - seenCrumbPulse.current;
      seenCrumbPulse.current = motion.crumbPulse;
      const alive = compactCrumbs(crumbData.positions, crumbData.velocities, crumbData.ages, 0.65);
      const burst = reduced ? [] : Array.from({ length: Math.min(count, 3) }, () => createCrumbBurst(asset.size, finishingBurst, Math.random, interaction)).flat();
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
  const shadowWidth = Math.max(asset.size.x, asset.size.z) * layer.scale * 1.45;
  return <>
    <mesh position-y={-base.size.y / 2 - base.size.length() * 0.055} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[shadowWidth, shadowWidth]} />
      <shaderMaterial transparent depthWrite={false}
        vertexShader={`varying vec2 shadowUv;
          void main() { shadowUv = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`varying vec2 shadowUv;
          void main() {
            float falloff = exp(-dot(shadowUv, shadowUv) * 20.0);
            float opacity = smoothstep(0.012, 1.0, falloff) * 0.26;
            gl_FragColor = vec4(0.13, 0.055, 0.024, opacity);
          }`} />
    </mesh>
    <group ref={floating} position={[layer.calibration.position[0], layer.pivotY, layer.calibration.position[2]]}><group ref={rotation}><group ref={shakeGroup}>
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
  </group></group></group></>;
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
    <directionalLight color="#fff0da" position={[-2.5, 3, 1.1]} intensity={2.6} />
    <directionalLight color="#edf4ff" position={[2, 0.5, 1]} intensity={0.3} />
    <directionalLight color="#fff5e7" position={[0.5, 1.4, -2]} intensity={1.5} />
    <Food {...props} />
    <FoodInkEffect />
  </Canvas>;
}
