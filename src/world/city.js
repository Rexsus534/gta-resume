import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, BLOCK_HALF, PALETTE, blockCenter, nodePos } from '../config.js';
import { makeRng } from '../core/rng.js';
import { addSolid, addPad } from './collision.js';
import {
  TILE,
  FACADE_VARIANTS,
  makeFacade,
  makeRoof,
  makeRoad,
  makeIntersection,
  makePavement,
  makeGrass,
} from './textures.js';

const SEG_LEN = CITY.blockPitch - CITY.roadHalfWidth * 2; // 66m of asphalt between junctions
const ROAD_W = CITY.roadHalfWidth * 2;
const LOT_INSET = 4.5; // sidewalk depth between kerb and building line

/** Multiply a geometry's UVs so a shared, non-repeating material still tiles. */
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return geo;
}

function wall(w, h) {
  return scaleUV(new THREE.PlaneGeometry(w, h), w / TILE.facadeW, h / TILE.facadeH);
}

function roofSlab(w, d) {
  return scaleUV(new THREE.PlaneGeometry(w, d), w / TILE.roof, d / TILE.roof);
}

function roofBox(w, h, d) {
  return scaleUV(new THREE.BoxGeometry(w, h, d), w / TILE.roof, h / TILE.roof);
}

export function createCity(scene, seed = 20260725) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // ---------------------------------------------------------------- ground

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2422, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size + 600, CITY.size + 600), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  // ---------------------------------------------------------------- roads

  const roadTex = makeRoad();
  roadTex.repeat.set(1, SEG_LEN / TILE.road);
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92, metalness: 0 });

  const segGeo = new THREE.PlaneGeometry(ROAD_W, SEG_LEN).rotateX(-Math.PI / 2);
  const segCount = (CITY.blocks + 1) * CITY.blocks * 2;
  const segments = new THREE.InstancedMesh(segGeo, roadMat, segCount);
  segments.receiveShadow = true;
  segments.name = 'road-segments';

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let s = 0;

  for (let i = 0; i <= CITY.blocks; i++) {
    for (let j = 0; j < CITY.blocks; j++) {
      // North–south carriageway at x = X_i
      const ns = nodePos(i, j);
      pos.set(ns.x, 0.01, ns.z + CITY.blockPitch / 2);
      q.identity();
      segments.setMatrixAt(s++, m.compose(pos, q, one));

      // East–west carriageway at z = Z_i (same index pair, mirrored)
      const ew = nodePos(j, i);
      pos.set(ew.x + CITY.blockPitch / 2, 0.01, ew.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      segments.setMatrixAt(s++, m.compose(pos, q, one));
    }
  }
  segments.instanceMatrix.needsUpdate = true;
  group.add(segments);

  const interTex = makeIntersection();
  interTex.repeat.set(ROAD_W / TILE.pavement, ROAD_W / TILE.pavement);
  const interGeo = new THREE.PlaneGeometry(ROAD_W, ROAD_W).rotateX(-Math.PI / 2);
  const junctions = new THREE.InstancedMesh(
    interGeo,
    new THREE.MeshStandardMaterial({ map: interTex, roughness: 0.92 }),
    (CITY.blocks + 1) ** 2,
  );
  junctions.receiveShadow = true;
  let ji = 0;
  for (let i = 0; i <= CITY.blocks; i++) {
    for (let j = 0; j <= CITY.blocks; j++) {
      const n = nodePos(i, j);
      pos.set(n.x, 0.011, n.z);
      junctions.setMatrixAt(ji++, m.compose(pos, q.identity(), one));
    }
  }
  junctions.instanceMatrix.needsUpdate = true;
  group.add(junctions);

  // ------------------------------------------------- block pads (kerbs)

  const blockCount = CITY.blocks * CITY.blocks;

  const kerbs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(BLOCK_HALF * 2, CITY.curbHeight, BLOCK_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0x6f665c, roughness: 0.95 }),
    blockCount,
  );
  kerbs.castShadow = true;
  kerbs.receiveShadow = true;

  const paveTex = makePavement();
  paveTex.repeat.set((BLOCK_HALF * 2) / TILE.pavement, (BLOCK_HALF * 2) / TILE.pavement);
  const pavements = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(BLOCK_HALF * 2, BLOCK_HALF * 2).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.95 }),
    blockCount,
  );
  pavements.receiveShadow = true;

  // ---------------------------------------------------------------- blocks

  const wallBuckets = FACADE_VARIANTS.map(() => []);
  const roofBucket = [];
  const grassBucket = [];
  const trunkPlacements = [];
  const foliagePlacements = [];

  const blocks = [];
  const buildings = [];

  let bi = 0;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const c = blockCenter(bx, bz);
      const isPark = rng.chance(CITY.parkChance);

      pos.set(c.x, CITY.curbHeight / 2, c.z);
      kerbs.setMatrixAt(bi, m.compose(pos, q.identity(), one));
      pos.set(c.x, CITY.curbHeight + 0.002, c.z);
      pavements.setMatrixAt(bi, m.compose(pos, q.identity(), one));
      bi++;

      addPad(c.x, c.z, BLOCK_HALF, BLOCK_HALF, CITY.curbHeight);
      blocks.push({ x: c.x, z: c.z, half: BLOCK_HALF, isPark });

      if (isPark) {
        buildPark(c, rng, grassBucket, trunkPlacements, foliagePlacements);
      } else {
        buildLot(c, rng, wallBuckets, roofBucket, buildings);
      }
    }
  }

  kerbs.instanceMatrix.needsUpdate = true;
  pavements.instanceMatrix.needsUpdate = true;
  group.add(kerbs, pavements);

  // ------------------------------------------------------------- buildings

  wallBuckets.forEach((bucket, index) => {
    if (!bucket.length) return;
    const { map, emissiveMap } = makeFacade(index);
    const mat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      // Windows sit above the bloom threshold while sunlit walls stay below it,
      // which is what keeps the glow on the glass instead of the whole facade.
      emissive: new THREE.Color(PALETTE.windowGlow),
      emissiveIntensity: 1.9,
      roughness: 0.82,
      metalness: 0.04,
    });
    const mesh = new THREE.Mesh(mergeGeometries(bucket, false), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `facade-${index}`;
    group.add(mesh);
    bucket.forEach((g) => g.dispose());
  });

  if (roofBucket.length) {
    const roofs = new THREE.Mesh(
      mergeGeometries(roofBucket, false),
      new THREE.MeshStandardMaterial({ map: makeRoof(), roughness: 0.95 }),
    );
    roofs.castShadow = true;
    roofs.receiveShadow = true;
    roofs.name = 'roofs';
    group.add(roofs);
    roofBucket.forEach((g) => g.dispose());
  }

  // ----------------------------------------------------------------- parks

  if (grassBucket.length) {
    const grassTex = makeGrass();
    grassTex.repeat.set(1, 1); // baked into the UVs per patch
    const grass = new THREE.Mesh(
      mergeGeometries(grassBucket, false),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
    );
    grass.receiveShadow = true;
    grass.name = 'parks';
    group.add(grass);
    grassBucket.forEach((g) => g.dispose());
  }

  if (trunkPlacements.length) {
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.16, 0.24, 1, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }),
      trunkPlacements.length,
    );
    const foliage = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x53682f, roughness: 1, flatShading: true }),
      foliagePlacements.length,
    );
    trunks.castShadow = true;
    foliage.castShadow = true;
    foliage.receiveShadow = true;

    trunkPlacements.forEach((t, i) => {
      pos.set(t.x, t.y, t.z);
      trunks.setMatrixAt(i, m.compose(pos, q.identity(), new THREE.Vector3(1, t.h, 1)));
    });
    foliagePlacements.forEach((f, i) => {
      pos.set(f.x, f.y, f.z);
      q.setFromEuler(new THREE.Euler(f.rx, f.ry, 0));
      foliage.setMatrixAt(i, m.compose(pos, q, new THREE.Vector3(f.r, f.r * 1.15, f.r)));
    });
    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    group.add(trunks, foliage);
  }

  // ----------------------------------------------------------- street lamps

  const lampPlacements = [];
  for (let i = 0; i <= CITY.blocks; i++) {
    for (let j = 0; j < CITY.blocks; j++) {
      const side = (i + j) % 2 === 0 ? 1 : -1;
      const ns = nodePos(i, j);
      lampPlacements.push({
        x: ns.x + side * (CITY.roadHalfWidth + 1.6),
        z: ns.z + CITY.blockPitch / 2,
        rot: side > 0 ? Math.PI : 0,
      });
      const ew = nodePos(j, i);
      lampPlacements.push({
        x: ew.x + CITY.blockPitch / 2,
        z: ew.z + side * (CITY.roadHalfWidth + 1.6),
        rot: side > 0 ? -Math.PI / 2 : Math.PI / 2,
      });
    }
  }

  const postGeo = mergeGeometries(
    [
      new THREE.CylinderGeometry(0.09, 0.13, 6, 6).translate(0, 3, 0),
      new THREE.BoxGeometry(1.9, 0.14, 0.14).translate(0.95, 5.95, 0),
    ],
    false,
  );
  const lampPosts = new THREE.InstancedMesh(
    postGeo,
    new THREE.MeshStandardMaterial({ color: 0x2c2a2c, roughness: 0.6, metalness: 0.5 }),
    lampPlacements.length,
  );
  lampPosts.castShadow = true;

  const lampHeads = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.72, 0.2, 0.34),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      emissive: new THREE.Color(PALETTE.lampGlow),
      emissiveIntensity: 3.2,
    }),
    lampPlacements.length,
  );

  lampPlacements.forEach((l, i) => {
    const y = 0; // lamps stand on the kerb strip, which is only 16cm proud
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.rot);
    pos.set(l.x, y + CITY.curbHeight, l.z);
    lampPosts.setMatrixAt(i, m.compose(pos, q, one));

    const armX = Math.cos(l.rot) * 1.72;
    const armZ = -Math.sin(l.rot) * 1.72;
    pos.set(l.x + armX, y + CITY.curbHeight + 5.82, l.z + armZ);
    lampHeads.setMatrixAt(i, m.compose(pos, q, one));
  });
  lampPosts.instanceMatrix.needsUpdate = true;
  lampHeads.instanceMatrix.needsUpdate = true;
  group.add(lampPosts, lampHeads);

  // ------------------------------------------------------------- road graph

  const nodes = [];
  for (let i = 0; i <= CITY.blocks; i++) {
    nodes[i] = [];
    for (let j = 0; j <= CITY.blocks; j++) {
      const n = nodePos(i, j);
      nodes[i][j] = { i, j, x: n.x, z: n.z, neighbours: [] };
    }
  }
  for (let i = 0; i <= CITY.blocks; i++) {
    for (let j = 0; j <= CITY.blocks; j++) {
      const n = nodes[i][j];
      if (i > 0) n.neighbours.push(nodes[i - 1][j]);
      if (i < CITY.blocks) n.neighbours.push(nodes[i + 1][j]);
      if (j > 0) n.neighbours.push(nodes[i][j - 1]);
      if (j < CITY.blocks) n.neighbours.push(nodes[i][j + 1]);
    }
  }

  // ------------------------------------------------------------ parking bays

  const parking = [];
  const bayRng = makeRng(seed ^ 0x5eed);
  for (let k = 0; k < 10; k++) {
    const alongZ = bayRng.chance(0.5);
    const i = bayRng.int(0, CITY.blocks);
    const j = bayRng.int(0, CITY.blocks - 1);
    const side = bayRng.chance(0.5) ? 1 : -1;
    const offset = CITY.roadHalfWidth - 1.7;
    const t = bayRng.range(0.25, 0.75);

    if (alongZ) {
      const a = nodePos(i, j);
      parking.push({
        x: a.x + side * offset,
        z: a.z + CITY.blockPitch * t,
        heading: side > 0 ? 0 : Math.PI,
      });
    } else {
      const a = nodePos(j, i);
      parking.push({
        x: a.x + CITY.blockPitch * t,
        z: a.z + side * offset,
        heading: side > 0 ? -Math.PI / 2 : Math.PI / 2,
      });
    }
  }

  // Guarantee one car right where the player starts, so F is discoverable.
  const start = nodePos(4, 4);
  parking.unshift({ x: start.x + CITY.roadHalfWidth - 1.7, z: start.z - 14.4, heading: 0 });

  buildings.sort((a, b) => b.h - a.h);
  const landmarks = buildings.slice(0, 6).map((b) => ({ x: b.x, z: b.z, h: b.h }));

  return {
    group,
    graph: { nodes, size: CITY.blocks },
    minimap: { blocks, buildings, landmarks },
    // Close enough to the guaranteed parked car that the "press F" prompt shows
    // on the first frame.
    playerSpawn: new THREE.Vector3(start.x + 1.5, 0, start.z - 14.4),
    parking,
  };
}

// ----------------------------------------------------------------- helpers

function buildLot(center, rng, wallBuckets, roofBucket, buildings) {
  const lotHalf = BLOCK_HALF - LOT_INSET;

  // Now and then a whole block becomes one tower, which gives the skyline
  // something to punctuate the low-rise grid with.
  if (rng.chance(0.12)) {
    const w = lotHalf * rng.range(1.35, 1.75);
    const d = lotHalf * rng.range(1.35, 1.75);
    pushBuilding(center.x, center.z, w, d, rng.range(46, 78), rng, wallBuckets, roofBucket, buildings);
    return;
  }

  const cell = lotHalf; // half of the lot, so a 2x2 arrangement
  for (let ox = -1; ox <= 1; ox += 2) {
    for (let oz = -1; oz <= 1; oz += 2) {
      if (rng.chance(0.12)) continue; // leave the odd gap for a yard
      const cx = center.x + (ox * cell) / 2;
      const cz = center.z + (oz * cell) / 2;
      const w = cell * rng.range(0.72, 0.94);
      const d = cell * rng.range(0.72, 0.94);
      const h = rng.range(9, 34) * (rng.chance(0.18) ? 1.5 : 1);
      pushBuilding(cx, cz, w, d, h, rng, wallBuckets, roofBucket, buildings);
    }
  }
}

function pushBuilding(cx, cz, w, d, h, rng, wallBuckets, roofBucket, buildings) {
  const variant = rng.int(0, wallBuckets.length - 1);
  const bucket = wallBuckets[variant];
  const base = CITY.curbHeight;
  const hw = w / 2;
  const hd = d / 2;
  const top = base + h;

  bucket.push(wall(w, h).translate(cx, base + h / 2, cz + hd));
  bucket.push(wall(w, h).rotateY(Math.PI).translate(cx, base + h / 2, cz - hd));
  bucket.push(wall(d, h).rotateY(Math.PI / 2).translate(cx + hw, base + h / 2, cz));
  bucket.push(wall(d, h).rotateY(-Math.PI / 2).translate(cx - hw, base + h / 2, cz));

  roofBucket.push(roofSlab(w, d).translate(cx, top, cz));

  // A low parapet so roofs read as roofs from street level.
  const pt = 0.3;
  const ph = rng.range(0.5, 1.0);
  roofBucket.push(roofBox(w, ph, pt).translate(cx, top + ph / 2, cz + hd - pt / 2));
  roofBucket.push(roofBox(w, ph, pt).translate(cx, top + ph / 2, cz - hd + pt / 2));
  roofBucket.push(roofBox(pt, ph, d - pt * 2).translate(cx + hw - pt / 2, top + ph / 2, cz));
  roofBucket.push(roofBox(pt, ph, d - pt * 2).translate(cx - hw + pt / 2, top + ph / 2, cz));

  // Plant room / AC block, offset so the silhouette isn't symmetrical.
  if (w > 10 && rng.chance(0.7)) {
    const bw = rng.range(2.5, Math.min(6, w * 0.35));
    const bd = rng.range(2.5, Math.min(6, d * 0.35));
    const bh = rng.range(1.6, 3.4);
    roofBucket.push(
      roofBox(bw, bh, bd).translate(
        cx + rng.range(-hw * 0.4, hw * 0.4),
        top + bh / 2,
        cz + rng.range(-hd * 0.4, hd * 0.4),
      ),
    );
  }

  addSolid(cx, cz, hw, hd, top);
  buildings.push({ x: cx, z: cz, hw, hd, h });
}

function buildPark(center, rng, grassBucket, trunks, foliage) {
  const half = BLOCK_HALF - 3;
  const g = new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2);
  scaleUV(g, (half * 2) / TILE.grass, (half * 2) / TILE.grass);
  grassBucket.push(g.translate(center.x, CITY.curbHeight + 0.004, center.z));

  const count = rng.int(6, 11);
  for (let i = 0; i < count; i++) {
    const x = center.x + rng.range(-half + 3, half - 3);
    const z = center.z + rng.range(-half + 3, half - 3);
    const trunkH = rng.range(2.2, 3.6);
    trunks.push({ x, y: CITY.curbHeight + trunkH / 2, z, h: trunkH });

    const r = rng.range(1.5, 2.6);
    foliage.push({
      x,
      y: CITY.curbHeight + trunkH + r * 0.55,
      z,
      r,
      rx: rng.range(0, 0.5),
      ry: rng.range(0, Math.PI * 2),
    });
  }
}
