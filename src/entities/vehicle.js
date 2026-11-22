import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAR } from '../config.js';
import { resolveCircle } from '../world/collision.js';

/**
 * Arcade car. Yaw 0 points down +Z, matching the player's convention, so a
 * heading can be passed between the two without conversion.
 */

export const CAR_COLOURS = [
  0xb23a2c, 0x2f4f7a, 0xd8b23c, 0x2e6b4f,
  0x8a8f96, 0x30323a, 0xa85a20, 0x6f3f8a,
];

const WHEEL_POSITIONS = [
  [-0.86, 0.34, 1.35],
  [0.86, 0.34, 1.35],
  [-0.86, 0.34, -1.32],
  [0.86, 0.34, -1.32],
];

let sharedGeo = null;

function buildSharedGeometry() {
  if (sharedGeo) return sharedGeo;

  // Body + cabin merge into one mesh so a car is a handful of draw calls.
  const body = new THREE.BoxGeometry(1.86, 0.62, 4.2).translate(0, 0.62, 0);
  const cabin = new THREE.BoxGeometry(1.62, 0.58, 2.05).translate(0, 1.2, -0.16);
  const skirt = new THREE.BoxGeometry(1.94, 0.22, 3.9).translate(0, 0.36, 0);
  const chassis = mergeGeometries([body, cabin, skirt], false);
  body.dispose();
  cabin.dispose();
  skirt.dispose();

  const headL = new THREE.BoxGeometry(0.42, 0.16, 0.1).translate(-0.55, 0.7, 2.11);
  const headR = new THREE.BoxGeometry(0.42, 0.16, 0.1).translate(0.55, 0.7, 2.11);
  const heads = mergeGeometries([headL, headR], false);
  headL.dispose();
  headR.dispose();

  const tailL = new THREE.BoxGeometry(0.38, 0.14, 0.09).translate(-0.6, 0.74, -2.11);
  const tailR = new THREE.BoxGeometry(0.38, 0.14, 0.09).translate(0.6, 0.74, -2.11);
  const tails = mergeGeometries([tailL, tailR], false);
  tailL.dispose();
  tailR.dispose();

  const glassF = new THREE.BoxGeometry(1.5, 0.5, 0.08).translate(0, 1.2, 0.87);
  const glassB = new THREE.BoxGeometry(1.5, 0.46, 0.08).translate(0, 1.2, -1.2);
  const glass = mergeGeometries([glassF, glassB], false);
  glassF.dispose();
  glassB.dispose();

  const wheel = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 12).rotateZ(Math.PI / 2);

  sharedGeo = { chassis, heads, tails, glass, wheel };
  return sharedGeo;
}

const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x1b2733,
  roughness: 0.14,
  metalness: 0.6,
});
const headMat = new THREE.MeshStandardMaterial({
  color: 0x222222,
  emissive: new THREE.Color(0xfff0d0),
  emissiveIntensity: 2.6,
});
const tailMat = new THREE.MeshStandardMaterial({
  color: 0x220808,
  emissive: new THREE.Color(0xff2b1a),
  emissiveIntensity: 1.4,
});
const brakeMat = new THREE.MeshStandardMaterial({
  color: 0x330a0a,
  emissive: new THREE.Color(0xff3520),
  emissiveIntensity: 4.2,
});

function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const _probe = new THREE.Vector3();

function makeDriverFigure() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x263d53, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98261, roughness: 0.95 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 3, 7), jacket);
  torso.position.y = 0.92;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 7), skin);
  head.position.y = 1.34;
  group.add(torso, head);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

export class Vehicle {
  constructor(scene, { x, z, heading = 0, colour = CAR_COLOURS[0], police = false }) {
    const geo = buildSharedGeometry();

    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    this.root.rotation.y = heading;

    this.chassisPivot = new THREE.Group();
    this.root.add(this.chassisPivot);

    this.isPolice = police;
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: police ? 0xe8e8e2 : colour,
      roughness: 0.36,
      metalness: 0.28,
    });

    const chassis = new THREE.Mesh(geo.chassis, this.bodyMat);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.chassisPivot.add(chassis);

    this.chassisPivot.add(new THREE.Mesh(geo.glass, glassMat));

    this.driverFigure = makeDriverFigure();
    this.driverFigure.position.set(-0.42, 0.05, 0.22);
    this.driverFigure.visible = false;
    this.root.add(this.driverFigure);

    if (police) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0x222831, metalness: 0.55, roughness: 0.3 }));
      bar.position.set(0, 1.57, -0.12);
      this.root.add(bar);
      this.redBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.27), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 3 }));
      this.blueBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.27), new THREE.MeshStandardMaterial({ color: 0x164cff, emissive: 0x164cff, emissiveIntensity: 3 }));
      this.redBeacon.position.set(-0.25, 1.64, -0.12);
      this.blueBeacon.position.set(0.25, 1.64, -0.12);
      this.root.add(this.redBeacon, this.blueBeacon);
      this._policeClock = 0;
    }
    this.headlights = new THREE.Mesh(geo.heads, headMat);
    this.taillights = new THREE.Mesh(geo.tails, tailMat);
    this.chassisPivot.add(this.headlights, this.taillights);

    this.wheels = WHEEL_POSITIONS.map(([wx, wy, wz]) => {
      const w = new THREE.Mesh(geo.wheel, wheelMat);
      w.position.set(wx, wy, wz);
      this.root.add(w);
      return w;
    });

    scene.add(this.root);

    this.position = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this._driver = null; // 'player' | 'ai' | null
    this.ejectedNpc = null;
    this._roll = 0;
    this._pitch = 0;
    this._wheelSpin = 0;
  }

  get driver() { return this._driver; }
  set driver(value) {
    this._driver = value;
    if (this.driverFigure) this.driverFigure.visible = value === 'ai';
  }

  ejectDriver(scene) {
    if (this.driver !== 'ai' || this.ejectedNpc) return false;
    const npc = makeDriverFigure();
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);
    npc.position.set(this.position.x - rightX * 2.05, 0, this.position.z - rightZ * 2.05);
    npc.rotation.y = this.heading;
    scene.add(npc);
    this.ejectedNpc = { group: npc, elapsed: 0, rightX, rightZ };
    this.driver = null;
    return true;
  }

  updateEjection(dt) {
    if (!this.ejectedNpc) return;
    const e = this.ejectedNpc;
    e.elapsed += dt;
    const t = Math.min(1, e.elapsed / 0.72);
    e.group.position.x -= e.rightX * dt * 0.9;
    e.group.position.z -= e.rightZ * dt * 0.9;
    e.group.rotation.z = Math.sin(t * Math.PI) * 0.9;
    e.group.position.y = Math.sin(t * Math.PI) * 0.12;
    if (t >= 1) {
      e.group.parent?.remove(e.group);
      this.ejectedNpc = null;
    }
  }

  get forwardX() {
    return Math.sin(this.heading);
  }

  get forwardZ() {
    return Math.cos(this.heading);
  }

  /** @param {{throttle:number, steer:number, handbrake:boolean}} controls */
  update(dt, controls) {
    this.updateEjection(dt);
    if (this.isPolice) {
      this._policeClock += dt;
      const phase = Math.sin(this._policeClock * 10) > 0;
      this.redBeacon.visible = phase;
      this.blueBeacon.visible = !phase;
    }
    const throttle = controls?.throttle ?? 0;
    const steerInput = controls?.steer ?? 0;
    const handbrake = controls?.handbrake ?? false;

    if (throttle > 0) {
      this.speed += CAR.accel * throttle * dt;
    } else if (throttle < 0) {
      // Same key brakes when rolling forward and reverses once stopped.
      if (this.speed > 0.6) this.speed -= CAR.brake * -throttle * dt;
      else this.speed += CAR.reverseAccel * throttle * dt;
    }

    if (handbrake) this.speed *= Math.max(0, 1 - dt * 4.5);

    // Rolling resistance and drag, always opposing motion.
    if (Math.abs(this.speed) > 0.01) {
      const sign = Math.sign(this.speed);
      const resist = CAR.rollingResistance + CAR.drag * Math.abs(this.speed);
      const applied = resist * dt * (throttle === 0 ? 1 : 0.35);
      this.speed -= sign * Math.min(applied, Math.abs(this.speed));
    } else {
      this.speed = 0;
    }

    this.speed = THREE.MathUtils.clamp(this.speed, -CAR.maxReverse, CAR.maxSpeed);

    // Steering authority builds with speed, then tapers so the car doesn't
    // spin on the spot or twitch at motorway pace.
    const abs = Math.abs(this.speed);
    const authority = Math.min(1, abs / 4.5) * (1 - Math.min(0.55, abs / CAR.maxSpeed) * 0.6);
    this.steer += (steerInput - this.steer) * Math.min(1, dt * 9);
    this.heading += this.steer * CAR.steerRate * authority * dt * Math.sign(this.speed || 1);

    const dx = this.forwardX * this.speed * dt;
    const dz = this.forwardZ * this.speed * dt;

    _probe.set(this.position.x + dx, 0, this.position.z + dz);
    if (resolveCircle(_probe, CAR.radius)) {
      this.speed *= 0.25;
    }
    this.position.x = _probe.x;
    this.position.z = _probe.z;

    this.root.position.set(this.position.x, 0, this.position.z);
    this.root.rotation.y = this.heading;

    // Weight transfer: lean into the corner, dip under braking.
    const targetRoll = -this.steer * Math.min(1, abs / 12) * 0.09;
    const targetPitch = THREE.MathUtils.clamp(-throttle * 0.035, -0.05, 0.05);
    this._roll += (targetRoll - this._roll) * Math.min(1, dt * 6);
    this._pitch += (targetPitch - this._pitch) * Math.min(1, dt * 5);
    this.chassisPivot.rotation.z = this._roll;
    this.chassisPivot.rotation.x = this._pitch;

    this._wheelSpin += (this.speed / 0.35) * dt;
    const steerAngle = this.steer * 0.42;
    this.wheels.forEach((w, i) => {
      w.rotation.x = this._wheelSpin;
      w.rotation.y = i < 2 ? steerAngle : 0;
    });

    const braking = throttle < 0 || handbrake;
    this.taillights.material = braking ? brakeMat : tailMat;
  }

  /** Where the player should stand after getting out. */
  getExitPoint(out) {
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);
    return out.set(this.position.x - rightX * 2.1, 0, this.position.z - rightZ * 2.1);
  }

  distanceTo(x, z) {
    return Math.hypot(this.position.x - x, this.position.z - z);
  }

  setHeadlights(on) {
    this.headlights.visible = on;
  }
}

export { angleDelta };
