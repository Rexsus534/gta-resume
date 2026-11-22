import * as THREE from 'three';
import { CITY, TRAFFIC } from '../config.js';
import { makeRng } from '../core/rng.js';
import { Vehicle, CAR_COLOURS, angleDelta } from './vehicle.js';

/**
 * AI drivers follow the intersection graph, keeping to the right-hand lane and
 * choosing a random legal turn at each junction.
 */

/** Right-hand normal of a heading vector, in the +X-is-right convention. */
function laneOffsetFor(from, to, out) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  return out.set((dz / len) * CITY.laneOffset, 0, (-dx / len) * CITY.laneOffset);
}

const _lane = new THREE.Vector3();

export function createTraffic(scene, graph, seed = 8675309) {
  const rng = makeRng(seed);
  const cars = [];

  function laneTarget(driver, out) {
    laneOffsetFor(driver.from, driver.to, _lane);
    return out.set(driver.to.x + _lane.x, 0, driver.to.z + _lane.z);
  }

  function pickNext(from, to) {
    const options = to.neighbours.filter((n) => n !== from);
    return options.length ? rng.pick(options) : from;
  }

  const size = graph.size;
  for (let k = 0; k < TRAFFIC.count; k++) {
    const i = rng.int(0, size);
    const j = rng.int(0, size - 1);
    const alongZ = rng.chance(0.5);

    const from = alongZ ? graph.nodes[i][j] : graph.nodes[j][i];
    const to = alongZ ? graph.nodes[i][j + 1] : graph.nodes[j + 1][i];

    laneOffsetFor(from, to, _lane);
    const t = rng.range(0.15, 0.85);
    const x = from.x + (to.x - from.x) * t + _lane.x;
    const z = from.z + (to.z - from.z) * t + _lane.z;
    const heading = Math.atan2(to.x - from.x, to.z - from.z);

    const police = k < 2;
    const vehicle = new Vehicle(scene, { x, z, heading, colour: police ? 0xe7e7e1 : rng.pick(CAR_COLOURS), police });
    vehicle.speed = TRAFFIC.cruise * rng.range(0.6, 1);
    vehicle.driver = 'ai';

    cars.push({ vehicle, from, to });
  }

  const _target = new THREE.Vector3();

  function drivePolice(driver, dt, target) {
    const v = driver.vehicle;
    const dx = target.x - v.position.x;
    const dz = target.z - v.position.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    const err = angleDelta(v.heading, desired);
    const steer = THREE.MathUtils.clamp(err * 1.8, -1, 1);
    const throttle = dist > 9 ? 1 : dist < 5 ? -0.35 : 0.25;
    v.update(dt, { throttle, steer, handbrake: false });
  }

  function driveOne(driver, dt, others) {
    const v = driver.vehicle;
    laneTarget(driver, _target);

    const dx = _target.x - v.position.x;
    const dz = _target.z - v.position.z;
    const dist = Math.hypot(dx, dz);

    // Arrived at the junction: commit to the next leg.
    if (dist < 5) {
      const next = pickNext(driver.from, driver.to);
      driver.from = driver.to;
      driver.to = next;
      laneTarget(driver, _target);
    }

    const desiredHeading = Math.atan2(_target.x - v.position.x, _target.z - v.position.z);
    const err = angleDelta(v.heading, desiredHeading);
    const steer = THREE.MathUtils.clamp(err * 1.9, -1, 1);

    // Slow for the corner, and for anything sitting in the lane ahead.
    let targetSpeed = Math.abs(err) > 0.35 ? TRAFFIC.turnCruise : TRAFFIC.cruise;

    for (const other of others) {
      if (other === v) continue;
      const ox = other.position.x - v.position.x;
      const oz = other.position.z - v.position.z;
      const gap = Math.hypot(ox, oz);
      if (gap > TRAFFIC.followDistance || gap < 1e-3) continue;
      // Only care about cars genuinely in front and roughly in line.
      const ahead = (ox * v.forwardX + oz * v.forwardZ) / gap;
      if (ahead < 0.82) continue;
      targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed * 0.85 - (TRAFFIC.followDistance - gap)));
    }

    const throttle = v.speed < targetSpeed - 0.4 ? 1 : v.speed > targetSpeed + 0.4 ? -1 : 0;
    v.update(dt, { throttle, steer, handbrake: false });
  }

  return {
    cars,
    vehicles: cars.map((c) => c.vehicle),

    /** @param {Array} obstacles parked cars, so the AI doesn't drive through them */
    update(dt, obstacles = [], target = null, wanted = false) {
      const all = [...cars.map((c) => c.vehicle), ...obstacles];
      for (const driver of cars) {
        if (driver.vehicle.driver !== 'ai') continue;
        if (wanted && driver.vehicle.isPolice && target) drivePolice(driver, dt, target);
        else driveOne(driver, dt, all);
      }
    },

    /** Stop steering a car the player has just climbed into. */
    takeControl(vehicle) {
      vehicle.driver = 'player';
    },

    /**
     * Hand a car back to the AI, re-anchoring it to the nearest junction so it
     * doesn't try to resume a leg from wherever the player abandoned it.
     */
    releaseControl(vehicle) {
      if (vehicle.stolen) { vehicle.driver = null; return; }
      const driver = cars.find((c) => c.vehicle === vehicle);
      if (!driver) {
        // A parked car — it simply stays where the player left it.
        vehicle.driver = null;
        return;
      }

      const gi = THREE.MathUtils.clamp(
        Math.round((vehicle.position.x - CITY.origin) / CITY.blockPitch),
        0,
        graph.size,
      );
      const gj = THREE.MathUtils.clamp(
        Math.round((vehicle.position.z - CITY.origin) / CITY.blockPitch),
        0,
        graph.size,
      );

      const nearest = graph.nodes[gi][gj];
      // Head off in whichever direction the car is already pointing.
      let best = nearest.neighbours[0];
      let bestDot = -Infinity;
      for (const n of nearest.neighbours) {
        const dx = n.x - vehicle.position.x;
        const dz = n.z - vehicle.position.z;
        const len = Math.hypot(dx, dz) || 1;
        const dot = (dx / len) * vehicle.forwardX + (dz / len) * vehicle.forwardZ;
        if (dot > bestDot) {
          bestDot = dot;
          best = n;
        }
      }

      driver.from = nearest;
      driver.to = best;
      vehicle.driver = 'ai';
    },
  };
}
