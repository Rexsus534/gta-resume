import * as THREE from 'three';
import { COINS, PALETTE, CITY, nodePos } from '../config.js';
import { RESUME } from '../content/resume.js';
import { makeRng } from '../core/rng.js';
import { isBlocked, groundHeightAt } from '../world/collision.js';
import { makeBeam } from '../world/textures.js';

/**
 * One floating coin monument per resume section. Each is a ground ring, a tall
 * light column that reads from across the city, and a spinning coin you collect
 * by getting close on foot or in a car.
 */

const _v = new THREE.Vector3();

/**
 * Spreads the monuments out with farthest-point sampling, so a short walk never
 * gives you two of them and the set covers the whole grid.
 */
function pickSpots(city, count, rng) {
  const candidates = [];

  // Parks first: open ground, no building to stand inside of.
  for (const b of city.minimap.blocks) {
    if (b.isPark) candidates.push({ x: b.x, z: b.z, kind: 'park' });
  }

  // Intersections as backup, in case the seed produced too few parks.
  for (let i = 1; i < CITY.blocks; i++) {
    for (let j = 1; j < CITY.blocks; j++) {
      const n = nodePos(i, j);
      candidates.push({ x: n.x, z: n.z, kind: 'junction' });
    }
  }

  const usable = candidates.filter((c) => !isBlocked(c.x, c.z, COINS.ringRadius + 1));
  if (!usable.length) return [];

  // Prefer parks even when a junction happens to be farther away.
  const parks = usable.filter((c) => c.kind === 'park');
  const pool = parks.length >= count ? parks : usable;

  const picked = [pool[rng.int(0, pool.length - 1)]];
  while (picked.length < count && picked.length < pool.length) {
    let best = null;
    let bestDist = -1;
    for (const c of pool) {
      if (picked.includes(c)) continue;
      let nearest = Infinity;
      for (const p of picked) {
        nearest = Math.min(nearest, Math.hypot(c.x - p.x, c.z - p.z));
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        best = c;
      }
    }
    if (!best) break;
    picked.push(best);
  }
  return picked;
}

export function createCoins(scene, city, { seed = 1312, onCollect } = {}) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'monuments';
  scene.add(group);

  const spots = pickSpots(city, RESUME.length, rng);

  const beamTex = makeBeam();
  // Emissive well above the 1.05 bloom threshold, so the monuments glow while
  // the sunlit city around them does not. See CLAUDE.md on the bloom budget.
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0x6b4a12,
    emissive: new THREE.Color(PALETTE.coin),
    emissiveIntensity: 1.9,
    roughness: 0.3,
    metalness: 0.7,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x8a5f16,
    emissive: new THREE.Color(0xfff0c0),
    emissiveIntensity: 2.4,
    roughness: 0.25,
    metalness: 0.8,
  });
  const spentMat = new THREE.MeshStandardMaterial({
    color: 0x4a4038,
    roughness: 0.9,
    metalness: 0.2,
  });

  const discGeo = new THREE.CylinderGeometry(COINS.discRadius, COINS.discRadius, 0.3, 32).rotateX(
    Math.PI / 2,
  );
  const rimGeo = new THREE.TorusGeometry(COINS.discRadius, 0.16, 10, 32);
  const ringGeo = new THREE.TorusGeometry(COINS.ringRadius, 0.14, 8, 40).rotateX(Math.PI / 2);
  const beamGeo = new THREE.CylinderGeometry(
    COINS.beamRadius,
    COINS.beamRadius * 1.15,
    COINS.beamHeight,
    18,
    1,
    true,
  );

  const coins = spots.map((spot, index) => {
    const section = RESUME[index];
    const baseY = groundHeightAt(spot.x, spot.z);

    const root = new THREE.Group();
    root.position.set(spot.x, baseY, spot.z);
    group.add(root);

    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.position.y = 0.06;
    root.add(ring);

    const beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        map: beamTex,
        // HDR gold. Additive blending over the bright hazy horizon has almost no
        // contrast at 1.0, so the column is pushed past the 1.05 bloom threshold
        // and gets its own halo to separate it from the sky.
        color: new THREE.Color().setRGB(4.0, 3.0, 1.4, THREE.LinearSRGBColorSpace),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        // Markers should stay legible through the dusk haze — that is the whole
        // point of a beacon.
        fog: false,
        toneMapped: true,
      }),
    );
    beam.position.y = COINS.beamHeight / 2;
    beam.renderOrder = 2;
    root.add(beam);

    const pivot = new THREE.Group();
    pivot.position.y = COINS.floatHeight;
    root.add(pivot);

    const disc = new THREE.Mesh(discGeo, goldMat);
    disc.castShadow = true;
    pivot.add(disc);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    pivot.add(rim);

    return {
      id: section.id,
      title: section.title,
      section,
      index,
      position: new THREE.Vector3(spot.x, baseY, spot.z),
      collected: false,
      root,
      ring,
      beam,
      pivot,
      _phase: rng.range(0, Math.PI * 2),
    };
  });

  let elapsed = 0;
  let collectedCount = 0;

  function collect(coin) {
    coin.collected = true;
    collectedCount++;
    coin.beam.visible = false;
    coin.pivot.visible = false;
    // Leave a spent ring behind so the map reads as a tour you've walked.
    coin.ring.material = spentMat;
    onCollect?.(coin);
  }

  return {
    group,
    coins,

    get total() {
      return coins.length;
    },
    get collected() {
      return collectedCount;
    },
    get complete() {
      return collectedCount === coins.length && coins.length > 0;
    },

    /** Nearest uncollected monument to a point, or null once all are found. */
    nearestTarget(x, z) {
      let best = null;
      let bestDist = Infinity;
      for (const coin of coins) {
        if (coin.collected) continue;
        const d = Math.hypot(coin.position.x - x, coin.position.z - z);
        if (d < bestDist) {
          bestDist = d;
          best = coin;
        }
      }
      return best ? { coin: best, distance: bestDist } : null;
    },

    /** Minimap marker data. */
    markers(activeId) {
      return coins.map((c) => ({
        x: c.position.x,
        z: c.position.z,
        collected: c.collected,
        active: c.id === activeId,
      }));
    },

    /** @param {THREE.Vector3} focus whatever the player is currently controlling */
    update(dt, focus) {
      elapsed += dt;

      for (const coin of coins) {
        if (coin.collected) continue;

        coin.pivot.rotation.y += COINS.spin * dt;
        coin.pivot.position.y =
          COINS.floatHeight + Math.sin(elapsed * COINS.bobSpeed + coin._phase) * COINS.bobAmplitude;

        _v.set(coin.position.x - focus.x, 0, coin.position.z - focus.z);
        if (_v.lengthSq() <= COINS.collectRadius * COINS.collectRadius) collect(coin);
      }
    },

    /** Used by the dev harness and by a future restart. */
    reset() {
      collectedCount = 0;
      for (const coin of coins) {
        coin.collected = false;
        coin.beam.visible = true;
        coin.pivot.visible = true;
        coin.ring.material = goldMat;
      }
    },

    /** Collect by id without walking there — dev harness only. */
    forceCollect(id) {
      const coin = coins.find((c) => c.id === id && !c.collected);
      if (coin) collect(coin);
      return !!coin;
    },
  };
}
