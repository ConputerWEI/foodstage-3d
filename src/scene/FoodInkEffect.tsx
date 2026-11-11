import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Camera, Color, HalfFloatType, Mesh, NoBlending, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderTarget } from 'three';

// Work from the rendered silhouette, not the scan's triangle edges. This keeps
// the line width stable in CSS pixels and follows rotation, bites and fades
// without adding geometry to the food's raycast/hit-test tree.
function createInkPass() {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const material = new ShaderMaterial({
    depthTest: false, depthWrite: false, blending: NoBlending,
    uniforms: {
      food: { value: target.texture },
      texel: { value: new Vector2(1, 1) },
      stroke: { value: 1.5 },
      shadowOffset: { value: new Vector2(2, -3) },
      shadowBlur: { value: 1.5 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D food;
      uniform vec2 texel;
      uniform float stroke;
      uniform vec2 shadowOffset;
      uniform float shadowBlur;
      varying vec2 vUv;
      float coverage(vec2 uv) {
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
        return texture2D(food, uv).a;
      }
      void main() {
        vec4 source = texture2D(food, vUv);
        float expanded = source.a;
        for (int i = 0; i < 12; i++) {
          float angle = float(i) * 6.2831853 / 12.0;
          expanded = max(expanded, coverage(vUv + vec2(cos(angle), sin(angle)) * texel * stroke));
        }
        // Only the coverage difference is inked: glass stays translucent and
        // the line fades naturally with the incoming/outgoing bite layers.
        float ink = max(0.0, expanded - source.a);
        vec2 shadowUv = vUv - shadowOffset * texel;
        vec2 blur = texel * shadowBlur;
        float shadow = (coverage(shadowUv) * 2.0
          + coverage(shadowUv + vec2(blur.x, 0.0))
          + coverage(shadowUv - vec2(blur.x, 0.0))
          + coverage(shadowUv + vec2(0.0, blur.y))
          + coverage(shadowUv - vec2(0.0, blur.y))) / 6.0 * 0.18;

        // Offscreen transparent rendering contains premultiplied linear RGB.
        // Grade the unassociated color once, then composite ink in display RGB.
        gl_FragColor = vec4(source.rgb / max(source.a, 0.0001), source.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 inkColor = vec3(0.055, 0.043, 0.035);
        vec3 shadowColor = vec3(0.16, 0.095, 0.05);
        // The difference already excludes source coverage; multiplying it by
        // (1 - source.a) again would leave a bright antialiasing seam.
        float inkAlpha = ink;
        float shadowAlpha = shadow * (1.0 - expanded);
        gl_FragColor = vec4(gl_FragColor.rgb * source.a + inkColor * inkAlpha
          + shadowColor * shadowAlpha, source.a + inkAlpha + shadowAlpha);
      }
    `,
  });
  const geometry = new PlaneGeometry(2, 2);
  const screen = new Scene();
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  screen.add(quad);
  return { target, material, screen, camera: new Camera(), size: new Vector2(), clearColor: new Color(),
    dispose() { target.dispose(); material.dispose(); geometry.dispose(); } };
}

export function FoodInkEffect({ preview = false }: { preview?: boolean }) {
  const pass = useRef<ReturnType<typeof createInkPass> | null>(null);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const next = createInkPass();
    pass.current = next;
    invalidate();
    return () => { pass.current = null; next.dispose(); };
  }, [invalidate]);
  useEffect(() => { invalidate(); }, [preview, invalidate]);

  useFrame(({ gl, scene, camera, size }) => {
    const current = pass.current;
    if (!current) { gl.render(scene, camera); return; }
    gl.getDrawingBufferSize(current.size);
    const { x: width, y: height } = current.size;
    if (current.target.width !== width || current.target.height !== height) current.target.setSize(width, height);
    const pixelRatio = width / Math.max(1, size.width);
    const uniforms = current.material.uniforms;
    uniforms.texel!.value.set(1 / width, 1 / height);
    uniforms.stroke!.value = (preview ? 1.5 : 2.5) * pixelRatio;
    uniforms.shadowOffset!.value.set(preview ? 2 : 4, preview ? -3 : -6).multiplyScalar(pixelRatio);
    uniforms.shadowBlur!.value = (preview ? 1.5 : 3) * pixelRatio;

    const previousTarget = gl.getRenderTarget();
    const previousAlpha = gl.getClearAlpha();
    const previousAutoClear = gl.autoClear;
    gl.getClearColor(current.clearColor);
    try {
      gl.autoClear = true;
      gl.setClearColor(0x000000, 0);
      gl.setRenderTarget(current.target);
      gl.render(scene, camera);
      gl.setRenderTarget(previousTarget);
      gl.render(current.screen, current.camera);
    } finally {
      gl.setRenderTarget(previousTarget);
      gl.setClearColor(current.clearColor, previousAlpha);
      gl.autoClear = previousAutoClear;
    }
  }, 1);
  return null;
}
