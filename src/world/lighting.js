import * as THREE from 'three';
import { PALETTE } from '../config.js';

// Low enough for long raking shadows, high enough that the streets between
// 30m buildings still catch direct light — below ~14 degrees the whole city
// floor sits in shadow.
const SUN_ELEVATION = THREE.MathUtils.degToRad(17);
const SUN_AZIMUTH = THREE.MathUtils.degToRad(118);
/** Distance the shadow camera is pushed back, so it clears the tallest tower. */
const SUN_DISTANCE = 400;

const skyVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFrag = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  varying vec3 vWorld;

  void main() {
    vec3 dir = normalize(vWorld);

    // Gradient packed towards the horizon so the sky reads as dusk, not noon.
    float h = clamp(dir.y, -1.0, 1.0);
    float t = pow(clamp(h, 0.0, 1.0), 0.42);
    vec3 col = mix(horizonColor, topColor, t);

    // Warm the ground half of the dome so distant fog blends into it.
    col = mix(col, horizonColor * 0.72, smoothstep(0.0, -0.22, h));

    float sun = max(dot(dir, normalize(sunDirection)), 0.0);
    col += sunColor * pow(sun, 220.0) * 3.4;         // disc
    col += sunColor * pow(sun, 7.0) * 0.42;          // bloom-friendly halo
    col += sunColor * pow(sun, 2.0) * 0.10;          // wide scatter

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createLighting(scene) {
  const sunDirection = new THREE.Vector3(
    Math.cos(SUN_ELEVATION) * Math.sin(SUN_AZIMUTH),
    Math.sin(SUN_ELEVATION),
    Math.cos(SUN_ELEVATION) * Math.cos(SUN_AZIMUTH),
  ).normalize();

  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0062);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1600, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(PALETTE.skyTop) },
        horizonColor: { value: new THREE.Color(PALETTE.skyHorizon) },
        sunColor: { value: new THREE.Color(PALETTE.sun) },
        sunDirection: { value: sunDirection.clone() },
      },
      vertexShader: skyVert,
      fragmentShader: skyFrag,
    }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;

  // A frustum that rides along with the player keeps 2048px usable across a
  // 640m city; one wide enough to cover the whole grid would be mush. The
  // vertical extent has to clear a 78m tower raked by a low sun.
  const extent = 100;
  const cam = sun.shadow.camera;
  cam.left = -extent;
  cam.right = extent;
  cam.top = extent;
  cam.bottom = -extent;
  cam.near = 1;
  cam.far = SUN_DISTANCE + 300;
  cam.updateProjectionMatrix();

  scene.add(sun);
  scene.add(sun.target);

  // Shadowed streets are the norm at this sun angle, so the fill does most of
  // the work of keeping the city readable.
  const hemi = new THREE.HemisphereLight(PALETTE.skyFill, PALETTE.groundBounce, 1.6);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x7a6a86, 0.85);
  scene.add(ambient);

  const offset = sunDirection.clone().multiplyScalar(SUN_DISTANCE);

  return {
    sunDirection,
    /** Keep the shadow volume centred on whatever the player is controlling. */
    update(focus) {
      sun.target.position.set(focus.x, 0, focus.z);
      sun.position.set(focus.x + offset.x, offset.y, focus.z + offset.z);
      sun.target.updateMatrixWorld();
    },
  };
}
