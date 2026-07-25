import * as THREE from 'three';
import { rayDistance } from '../world/collision.js';

const MIN_PITCH = -0.28;
const MAX_PITCH = 1.1;
const TWO_PI = Math.PI * 2;

/** Signed shortest angular difference from a to b. */
function angleDelta(a, b) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

/**
 * Third-person orbit boom. Mouse controls yaw/pitch, wheel controls distance,
 * and the boom shortens when a building would come between camera and subject.
 */
export class FollowCamera {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;

    this.yaw = Math.PI;
    this.pitch = 0.24;
    this.distance = 6.4;
    this.targetDistance = 6.4;
    this.sensitivity = 0.0022;

    this.focus = new THREE.Vector3();
    this.initialised = false;

    this._desired = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  /**
   * @param {object} opts
   *   height        - metres above the subject's feet that the camera aims at
   *   distance      - preferred boom length
   *   autoYaw       - heading (radians) the camera drifts behind, or null
   *   autoYawRate   - how briskly it drifts there
   *   followLag     - focus smoothing; higher is snappier
   */
  update(dt, targetPos, opts = {}) {
    const {
      height = 1.45,
      distance = 6.4,
      autoYaw = null,
      autoYawRate = 2.6,
      followLag = 12,
    } = opts;

    const mouse = this.input.drainMouse(dt);
    this.yaw -= mouse.dx * this.sensitivity;
    this.pitch -= mouse.dy * this.sensitivity;
    this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch));

    const wheel = this.input.drainWheel();
    if (wheel !== 0) this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + wheel * 0.006, 2.8, 16);

    // In a car the camera swings back behind the bonnet once the player stops
    // steering it, so "forward" on screen stays forward.
    if (autoYaw !== null && this.input.mouseIdle > 0.6) {
      const blend = 1 - Math.exp(-autoYawRate * dt);
      this.yaw += angleDelta(this.yaw, autoYaw) * blend;
    }

    const baseDistance = THREE.MathUtils.lerp(this.targetDistance, distance, 0);
    this.distance += (baseDistance - this.distance) * Math.min(1, dt * 8);

    if (!this.initialised) {
      this.focus.copy(targetPos);
      this.focus.y += height;
      this.initialised = true;
    }

    this._look.copy(targetPos);
    this._look.y += height;
    this.focus.lerp(this._look, Math.min(1, dt * followLag));

    const cosPitch = Math.cos(this.pitch);
    this._dir.set(
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosPitch,
    );

    // Keep the camera out of walls: cast from the subject outwards along the boom.
    const wall = rayDistance(this.focus, this._dir, this.distance + 0.4);
    const boom = Math.max(1.1, Math.min(this.distance, wall - 0.35));

    this._desired.copy(this.focus).addScaledVector(this._dir, boom);
    if (this._desired.y < 0.6) this._desired.y = 0.6;

    this.camera.position.copy(this._desired);
    this.camera.lookAt(this.focus);
  }

  /** Camera-relative forward on the ground plane (for WASD). */
  getForward(out) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  getRight(out) {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  /** Snap in behind a heading immediately (used when getting into a car). */
  snapBehind(heading) {
    this.yaw = heading + Math.PI;
  }
}
