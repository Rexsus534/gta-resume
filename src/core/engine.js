import * as THREE from 'three';

export function createEngine() {
  const canvas = document.getElementById('game');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  // r185 deprecated PCFSoftShadowMap and silently downgrades it to PCF anyway.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // The composer renders into targets, where three skips in-shader tone mapping.
  // OutputPass reads these two values and applies the grade at the very end.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.1,
    2400,
  );
  camera.position.set(0, 6, 12);

  const resizeHandlers = [];
  function onResize(fn) {
    resizeHandlers.push(fn);
  }

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    for (const fn of resizeHandlers) fn(w, h);
  });

  return { canvas, renderer, scene, camera, onResize };
}
