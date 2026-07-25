import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER } from '../config.js';
import { resolveCircle, groundHeightAt } from '../world/collision.js';

const BASE = import.meta.env.BASE_URL;

/** Fallback if the bounding-box measurement comes back nonsensical. */
const FALLBACK_MODEL_HEIGHT = 0.017;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _next = new THREE.Vector3();

export async function createPlayer(scene, manager, spawn, onStatus = () => {}) {
  const loader = new GLTFLoader(manager);

  onStatus('Loading character');
  const [charGltf, animGltf] = await Promise.all([
    loader.loadAsync(`${BASE}models/character.glb`),
    loader.loadAsync(`${BASE}models/animations.glb`),
  ]);

  const model = charGltf.scene;

  // ------------------------------------------------------------- materials
  // The Meshy export ships emissiveFactor [1,1,1] with an emissive texture, so
  // out of the box the character is fully self-lit: it ignores the sun and goes
  // straight through the bloom threshold. Zeroing emissive is what makes it a
  // lit object again.
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // Skinned bounds aren't recomputed per frame, so cheap culling can pop.
    o.frustumCulled = false;

    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      if (mat.emissive) mat.emissive.setScalar(0);
      mat.emissiveIntensity = 0;
      mat.emissiveMap = null;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.roughness = 0.86;
      mat.metalness = 0;
      // specularColorFactor was [2,2,2], which is out of spec and blows out
      // the highlights.
      if (mat.specularColor) mat.specularColor.setScalar(1);
      mat.specularIntensity = 0.3;
      mat.side = THREE.FrontSide;
      mat.needsUpdate = true;
    }
  });

  // ----------------------------------------------------------------- scale
  const root = new THREE.Group();
  root.name = 'player';
  root.add(model);
  scene.add(root);
  root.updateMatrixWorld(true);

  onStatus('Fitting character');
  // `precise` runs the vertices through the actual skinning path. A plain
  // Box3 would measure geometry bounds times matrixWorld and miss the bind
  // matrices entirely, which for this rig is off by two orders of magnitude.
  const box = new THREE.Box3().setFromObject(model, true);
  let measured = box.max.y - box.min.y;
  if (!Number.isFinite(measured) || measured < 1e-4 || measured > 1000) {
    console.warn('[player] implausible model height', measured, '— using fallback');
    measured = FALLBACK_MODEL_HEIGHT;
    box.min.y = 0;
  }

  const scale = PLAYER.height / measured;
  model.position.y = -box.min.y; // seat the feet on the group's origin
  root.scale.setScalar(scale);
  console.info(
    `[player] model measured ${measured.toFixed(4)}m -> scaled x${scale.toFixed(2)} to ${PLAYER.height}m`,
  );

  // ------------------------------------------------------------ animations
  const byName = (list, name) => list.find((c) => c.name === name);

  // Both locomotion cycles live in the animations GLB — the character file only
  // carries a two-frame standing pose. The rigs are identical (same 24 joints,
  // same names), so the clips bind by node name with no retargeting.
  const walkClip = byName(animGltf.animations, 'Walking');
  const runClip = byName(animGltf.animations, 'Running');
  const idleClip = charGltf.animations[0];

  if (!walkClip || !runClip) {
    console.error(
      '[player] expected Walking and Running clips, got:',
      animGltf.animations.map((c) => c.name),
    );
  }

  const mixer = new THREE.AnimationMixer(model);
  const make = (clip) => {
    if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.enabled = true;
    action.setEffectiveWeight(0);
    action.play();
    return action;
  };

  const actions = {
    idle: make(idleClip),
    walk: make(walkClip),
    run: make(runClip),
  };
  if (actions.idle) actions.idle.setEffectiveWeight(1);

  const weights = { idle: 1, walk: 0, run: 0 };

  // ------------------------------------------------------------------ state
  const position = new THREE.Vector3().copy(spawn);
  const velocity = new THREE.Vector3();
  let yaw = Math.PI;
  let groundY = groundHeightAt(position.x, position.z);
  let bobPhase = 0;
  let visible = true;

  root.position.copy(position);

  function setWeights(target, dt) {
    const k = Math.min(1, dt * 12);
    for (const name of ['idle', 'walk', 'run']) {
      weights[name] += (target[name] - weights[name]) * k;
      if (actions[name]) actions[name].setEffectiveWeight(weights[name]);
    }
  }

  return {
    root,
    model,
    position,
    get yaw() {
      return yaw;
    },
    get speed() {
      return Math.hypot(velocity.x, velocity.z);
    },
    setVisible(v) {
      visible = v;
      root.visible = v;
    },
    get visible() {
      return visible;
    },
    /** Current animation blend, for tuning and debugging. */
    get blend() {
      return { ...weights };
    },
    clips: {
      idle: idleClip?.name ?? null,
      walk: walkClip?.name ?? null,
      run: runClip?.name ?? null,
    },

    /** Drop the player back into the world at a spot (used when leaving a car). */
    placeAt(x, z, heading) {
      position.set(x, 0, z);
      velocity.set(0, 0, 0);
      yaw = heading;
      groundY = groundHeightAt(x, z);
      root.position.set(x, groundY, z);
      root.rotation.y = yaw;
    },

    update(dt, input, cameraRig) {
      if (!visible) {
        mixer.update(dt);
        return;
      }

      cameraRig.getForward(_forward);
      cameraRig.getRight(_right);

      _move.set(0, 0, 0);
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) _move.add(_forward);
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) _move.sub(_forward);
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) _move.add(_right);
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) _move.sub(_right);

      const sprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const topSpeed = sprinting ? PLAYER.runSpeed : PLAYER.walkSpeed;

      if (_move.lengthSq() > 0) {
        _move.normalize().multiplyScalar(topSpeed);
        velocity.x += (_move.x - velocity.x) * Math.min(1, dt * PLAYER.accel);
        velocity.z += (_move.z - velocity.z) * Math.min(1, dt * PLAYER.accel);
      } else {
        const decay = Math.max(0, 1 - dt * PLAYER.damping);
        velocity.x *= decay;
        velocity.z *= decay;
        if (velocity.lengthSq() < 1e-4) velocity.set(0, 0, 0);
      }

      _next.set(position.x + velocity.x * dt, 0, position.z + velocity.z * dt);
      if (resolveCircle(_next, PLAYER.radius)) {
        // Bleed off speed into the wall rather than sticking to it.
        velocity.multiplyScalar(0.55);
      }
      position.x = _next.x;
      position.z = _next.z;

      // Kerbs are 16cm, so easing towards the target height reads as a step up
      // rather than a teleport.
      const targetGround = groundHeightAt(position.x, position.z);
      groundY += (targetGround - groundY) * Math.min(1, dt * 14);

      const speed = Math.hypot(velocity.x, velocity.z);

      if (speed > 0.05) {
        const desired = Math.atan2(velocity.x, velocity.z);
        let delta = (desired - yaw) % (Math.PI * 2);
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        yaw += delta * Math.min(1, dt * PLAYER.turnRate);
      }

      // The idle clip is a frozen two-frame pose, so a little procedural sway
      // keeps standing still from looking like a crash.
      bobPhase += dt * (1.3 + speed * 0.2);
      const bob = weights.idle * Math.sin(bobPhase * Math.PI * 2) * 0.012;

      root.position.set(position.x, groundY + bob, position.z);
      root.rotation.y = yaw;

      // ---- animation blend
      const walkTop = PLAYER.walkSpeed;
      const runTop = PLAYER.runSpeed;
      const target = { idle: 0, walk: 0, run: 0 };

      if (speed < 0.15) {
        target.idle = 1;
      } else if (speed <= walkTop) {
        const t = (speed - 0.15) / (walkTop - 0.15);
        target.idle = 1 - t;
        target.walk = t;
      } else {
        const t = Math.min(1, (speed - walkTop) / (runTop - walkTop));
        target.walk = 1 - t;
        target.run = t;
      }
      setWeights(target, dt);

      if (actions.walk) {
        actions.walk.timeScale = THREE.MathUtils.clamp(speed / PLAYER.nominalWalk, 0.65, 1.75);
      }
      if (actions.run) {
        actions.run.timeScale = THREE.MathUtils.clamp(speed / PLAYER.nominalRun, 0.7, 1.5);
      }

      mixer.update(dt);
    },
  };
}
