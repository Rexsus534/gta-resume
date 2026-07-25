import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Dusk grade, applied to linear HDR before OutputPass tone-maps to sRGB.
 * Warm highlights, cool shadows, a touch of contrast and a soft vignette.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.08 },
    saturation: { value: 1.14 },
    lift: { value: 0.006 },
    vignette: { value: 0.5 },
    highlightTint: { value: new THREE.Color(1.06, 0.98, 0.88) },
    shadowTint: { value: new THREE.Color(0.86, 0.9, 1.08) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform float lift;
    uniform float vignette;
    uniform vec3 highlightTint;
    uniform vec3 shadowTint;
    varying vec2 vUv;

    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = texel.rgb;

      float l = dot(col, LUMA);
      float hi = smoothstep(0.22, 1.10, l);
      float lo = 1.0 - smoothstep(0.0, 0.32, l);

      col *= mix(vec3(1.0), highlightTint, hi * 0.6);
      col *= mix(vec3(1.0), shadowTint, lo * 0.5);

      col = (col - 0.18) * contrast + 0.18 + lift;

      float grey = dot(col, LUMA);
      col = mix(vec3(grey), col, saturation);

      vec2 d = vUv - 0.5;
      col *= clamp(1.0 - dot(d, d) * vignette, 0.0, 1.0);

      gl_FragColor = vec4(max(col, vec3(0.0)), texel.a);
    }
  `,
};

export function createPostFX({ renderer, scene, camera, onResize }) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(scene, camera));

  // Threshold sits above what a sunlit diffuse surface can reach (~0.97 linear
  // with this light rig) but below the emissive windows at 1.9, so the glow
  // lands on glass and lamps rather than on every bright wall.
  const bloom = new UnrealBloomPass(size.clone(), 0.42, 0.7, 1.05);
  composer.addPass(bloom);

  composer.addPass(new ShaderPass(GradeShader));
  composer.addPass(new OutputPass());

  onResize((w, h) => {
    composer.setSize(w, h);
    bloom.setSize(w, h);
  });

  return {
    composer,
    bloom,
    render() {
      composer.render();
    },
  };
}
