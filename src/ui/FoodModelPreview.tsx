import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ACESFilmicToneMapping, Box3, Group, PMREMGenerator, SRGBColorSpace, Vector3, type PerspectiveCamera } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { applyFoodMaterials } from '../scene/food-materials';

function Controls() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * .18;
    controls.maxPolarAngle = Math.PI * .72;
    controls.rotateSpeed = .65;
    let frame = 0;
    const update = () => { controls.update(); frame = requestAnimationFrame(update); };
    update();
    return () => { cancelAnimationFrame(frame); controls.dispose(); };
  }, [camera, gl]);
  return null;
}

function BurgerModel({ onReady }: { onReady: () => void }) {
  const { camera, size, gl, scene } = useThree();
  const [model, setModel] = useState<Group | null>(null);
  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();
    loader.loadAsync(window.innerWidth >= 768 ? '/models-desktop/burger-0.glb' : '/models-mobile/burger-0.glb').then(gltf => {
      if (!active) return;
      applyFoodMaterials(gltf.scene);
      const box = new Box3().setFromObject(gltf.scene);
      gltf.scene.position.sub(box.getCenter(new Vector3()));
      setModel(gltf.scene);
      const radius = box.getSize(new Vector3()).length() / 2;
      const cam = camera as PerspectiveCamera;
      const vertical = cam.fov * Math.PI / 360;
      const horizontal = Math.atan(Math.tan(vertical) * size.width / size.height);
      const distance = radius * 1.1 / Math.sin(Math.min(vertical, horizontal));
      cam.position.set(0, distance * .2, distance);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
      onReady();
    }).catch(() => { if (active) onReady(); });
    return () => { active = false; };
  }, [camera, size.width, size.height, onReady]);
  useEffect(() => {
    const room = new RoomEnvironment();
    const environment = new PMREMGenerator(gl).fromScene(room, .04);
    room.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = .35;
    return () => { scene.environment = null; environment.dispose(); };
  }, [gl, scene]);
  return model ? <primitive object={model} /> : null;
}

export function FoodModelPreview({ onReady }: { onReady: () => void }) {
  return <div className="food-model-preview" role="img" aria-label="经典汉堡3D模型，可拖动旋转">
    <Canvas camera={{ position: [0, .2, 1], fov: 34 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: SRGBColorSpace }}>
      <hemisphereLight args={['#fff6e8', '#665344', 1.2]} />
      <directionalLight color="#fff0da" position={[-2.5, 3, 2]} intensity={3.5} />
      <directionalLight color="#edf4ff" position={[2, 1, 1]} intensity={1.2} />
      <BurgerModel onReady={onReady} />
      <Controls />
    </Canvas>
  </div>;
}
