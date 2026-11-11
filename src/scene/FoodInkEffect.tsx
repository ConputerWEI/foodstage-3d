import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Camera, Color, HalfFloatType, Mesh, NoBlending, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget } from 'three';

export interface HoloLight { x: number; y: number; strength: number }

// Work from the rendered silhouette, not the scan's triangle edges. This keeps
// the line width stable in CSS pixels and follows rotation, bites and fades
// without adding geometry to the food's raycast/hit-test tree.
function createInkPass(holographic: boolean) {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const material = new ShaderMaterial({
    depthTest: false, depthWrite: false, blending: NoBlending,
    defines: holographic ? { FOOD_FOIL: 1 } : {},
    uniforms: {
      food: { value: target.texture },
      texel: { value: new Vector2(1, 1) },
      stroke: { value: 1.5 },
      shadowOffset: { value: new Vector2(2, -3) },
      shadowBlur: { value: 1.5 },
      ...(holographic ? { foilLight: { value: new Vector3() } } : {}),
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
      #ifdef FOOD_FOIL
      uniform vec3 foilLight;
      vec3 foilColor(vec3 printColor) {
        // Make each stamped rosette circular on both wide and tall previews.
        vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
        vec2 aspect = max(texel.x, texel.y) / texel;
        vec2 tile = (uv - 0.5) * aspect * 5.2;
        tile.x += mod(floor(tile.y), 2.0) * 0.5;
        vec2 local = fract(tile) - 0.5;
        float radius = length(local);
        float angle = atan(local.y, local.x + 0.00001);
        float outer = step(0.29, radius);
        float spoke = angle * mix(18.0, 26.0, outer) / 6.2831853;
        float ring = mix(0.20, 0.39, outer) + mod(floor(spoke), 2.0) * 0.035;
        float dash = (1.0 - smoothstep(0.017, 0.043, abs(radius - ring)))
          * (1.0 - smoothstep(0.27, 0.48, abs(fract(spoke) - 0.5)));

        vec2 offset = (uv - foilLight.xy) * aspect;
        float sweep = dot(offset, vec2(0.90, 0.44));
        float band = exp(-16.0 * sweep * sweep - 0.9 * dot(offset, offset));
        float phase = angle * 0.12 + sweep * 1.5 + dot(foilLight.xy, vec2(0.72, 0.28));
        vec3 spectrum = 0.64 + 0.36 * cos(6.2831853 * (phase + vec3(0.02, 0.69, 0.35)));
        float luma = dot(printColor, vec3(0.2126, 0.7152, 0.0722));
        float reflectance = foilLight.z * smoothstep(0.06, 0.45, luma);
        vec3 etched = mix(printColor, spectrum, reflectance * dash * (0.08 + 0.68 * band));
        float gloss = reflectance * (0.09 * band + 0.09 * exp(-12.0 * dot(offset, offset)));
        return etched + (1.0 - etched) * spectrum * gloss;
      }
      #endif
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
        #ifdef FOOD_FOIL
        // Tint only the food; its alpha, ink and cast shadow are composed below.
        if (source.a > 0.0) gl_FragColor.rgb = foilColor(gl_FragColor.rgb);
        #endif
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

export function FoodInkEffect({ preview = false, holo }: { preview?: boolean; holo?: HoloLight }) {
  const pass = useRef<ReturnType<typeof createInkPass> | null>(null);
  const invalidate = useThree(state => state.invalidate);
  const holographic = Boolean(holo);
  useEffect(() => {
    const next = createInkPass(holographic);
    pass.current = next;
    invalidate();
    return () => { pass.current = null; next.dispose(); };
  }, [invalidate, holographic]);
  useEffect(() => { invalidate(); }, [preview, holo?.x, holo?.y, holo?.strength, invalidate]);

  useFrame(({ gl, scene, camera, size }) => {
    const current = pass.current;
    if (!current) { gl.render(scene, camera); return; }
    gl.getDrawingBufferSize(current.size);
    const { x: width, y: height } = current.size;
    if (current.target.width !== width || current.target.height !== height) current.target.setSize(width, height);
    const pixelRatio = width / Math.max(1, size.width);
    const uniforms = current.material.uniforms;
    if (holo && uniforms.foilLight) uniforms.foilLight.value.set(holo.x, holo.y, holo.strength);
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
