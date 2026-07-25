import * as THREE from 'three';

/**
 * Axis-aligned collision for a city that is itself axis-aligned, so boxes are
 * enough and cheaper than any mesh test. A uniform spatial hash keeps the
 * per-frame work to the handful of boxes actually near the mover.
 */

const CELL = 24;
const boxes = [];
const pads = [];
const grid = new Map();
const padGrid = new Map();

const key = (cx, cz) => `${cx},${cz}`;

function insert(map, box, index) {
  const x0 = Math.floor(box.minX / CELL);
  const x1 = Math.floor(box.maxX / CELL);
  const z0 = Math.floor(box.minZ / CELL);
  const z1 = Math.floor(box.maxZ / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      const k = key(cx, cz);
      let bucket = map.get(k);
      if (!bucket) map.set(k, (bucket = []));
      bucket.push(index);
    }
  }
}

function query(map, source, minX, minZ, maxX, maxZ, out) {
  out.length = 0;
  const seen = new Set();
  const x0 = Math.floor(minX / CELL);
  const x1 = Math.floor(maxX / CELL);
  const z0 = Math.floor(minZ / CELL);
  const z1 = Math.floor(maxZ / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      const bucket = map.get(key(cx, cz));
      if (!bucket) continue;
      for (const i of bucket) {
        if (seen.has(i)) continue;
        seen.add(i);
        out.push(source[i]);
      }
    }
  }
  return out;
}

/** Register a solid obstacle (buildings, park walls). */
export function addSolid(centerX, centerZ, halfW, halfD, height) {
  const box = {
    minX: centerX - halfW,
    maxX: centerX + halfW,
    minZ: centerZ - halfD,
    maxZ: centerZ + halfD,
    height,
  };
  insert(grid, box, boxes.length);
  boxes.push(box);
  return box;
}

/** Register a walkable raised surface (block slabs / curbs). */
export function addPad(centerX, centerZ, halfW, halfD, height) {
  const pad = {
    minX: centerX - halfW,
    maxX: centerX + halfW,
    minZ: centerZ - halfD,
    maxZ: centerZ + halfD,
    height,
  };
  insert(padGrid, pad, pads.length);
  pads.push(pad);
}

export function reset() {
  boxes.length = 0;
  pads.length = 0;
  grid.clear();
  padGrid.clear();
}

const scratch = [];

/**
 * Pushes a circle out of any box it overlaps, along the shallowest axis.
 * Mutates `out` and returns true if anything was hit.
 */
export function resolveCircle(out, radius) {
  let hit = false;
  const near = query(
    grid,
    boxes,
    out.x - radius - 1,
    out.z - radius - 1,
    out.x + radius + 1,
    out.z + radius + 1,
    scratch,
  );

  for (const b of near) {
    const closestX = Math.max(b.minX, Math.min(out.x, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(out.z, b.maxZ));
    const dx = out.x - closestX;
    const dz = out.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq > radius * radius) continue;

    if (distSq > 1e-8) {
      // Outside the box: push straight out along the contact normal.
      const dist = Math.sqrt(distSq);
      const push = radius - dist;
      out.x += (dx / dist) * push;
      out.z += (dz / dist) * push;
    } else {
      // Centre ended up inside: escape via the nearest face.
      const toLeft = out.x - b.minX;
      const toRight = b.maxX - out.x;
      const toBack = out.z - b.minZ;
      const toFront = b.maxZ - out.z;
      const min = Math.min(toLeft, toRight, toBack, toFront);
      if (min === toLeft) out.x = b.minX - radius;
      else if (min === toRight) out.x = b.maxX + radius;
      else if (min === toBack) out.z = b.minZ - radius;
      else out.z = b.maxZ + radius;
    }
    hit = true;
  }
  return hit;
}

/** Height of the walkable surface under a point (0 = road level). */
export function groundHeightAt(x, z) {
  const near = query(padGrid, pads, x, z, x, z, scratch);
  let h = 0;
  for (const p of near) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.height > h) {
      h = p.height;
    }
  }
  return h;
}

/** True if a circle at (x, z) would overlap a solid. */
export function isBlocked(x, z, radius) {
  const near = query(grid, boxes, x - radius, z - radius, x + radius, z + radius, scratch);
  for (const b of near) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz <= radius * radius) return true;
  }
  return false;
}

const rayMin = new THREE.Vector3();
const rayMax = new THREE.Vector3();

/**
 * Distance along `dir` to the first building hit, or `maxDist`.
 * Used to pull the camera boom in rather than letting it clip through walls.
 */
export function rayDistance(origin, dir, maxDist) {
  rayMin.set(
    Math.min(origin.x, origin.x + dir.x * maxDist),
    0,
    Math.min(origin.z, origin.z + dir.z * maxDist),
  );
  rayMax.set(
    Math.max(origin.x, origin.x + dir.x * maxDist),
    0,
    Math.max(origin.z, origin.z + dir.z * maxDist),
  );

  const near = query(grid, boxes, rayMin.x, rayMin.z, rayMax.x, rayMax.z, scratch);
  let best = maxDist;

  for (const b of near) {
    // Slab test against the box, treating it as spanning y = 0..height.
    let tmin = 0;
    let tmax = maxDist;
    let ok = true;

    const axes = [
      [origin.x, dir.x, b.minX, b.maxX],
      [origin.y, dir.y, 0, b.height],
      [origin.z, dir.z, b.minZ, b.maxZ],
    ];

    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-6) {
        if (o < lo || o > hi) {
          ok = false;
          break;
        }
        continue;
      }
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) {
        ok = false;
        break;
      }
    }

    if (ok && tmin < best) best = tmin;
  }

  return best;
}
