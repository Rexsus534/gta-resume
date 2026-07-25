import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

/**
 * Everything the city is painted with is drawn to a canvas at load time — no
 * image downloads, and the window-lighting pattern stays deterministic.
 */

/** How much world space one texture tile covers, in metres. */
export const TILE = {
  facadeW: 12,
  facadeH: 12.8, // four 3.2m floors
  roof: 8,
  road: 10, // one dash period along the road
  pavement: 5,
  grass: 12,
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function speckle(ctx, w, h, rng, count, alpha) {
  for (let i = 0; i < count; i++) {
    const g = rng.int(0, 255);
    ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    ctx.fillRect(rng() * w, rng() * h, rng.range(1, 3), rng.range(1, 3));
  }
}

function toTexture(c, repeatX = 1, repeatY = 1, srgb = true) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const FACADE_VARIANTS = [
  { base: '#6b6259', trim: '#4d453e', glass: '#2b3138', cols: 4, rows: 4, lit: 0.5 },
  { base: '#7c6a5c', trim: '#584a40', glass: '#232a33', cols: 5, rows: 4, lit: 0.42 },
  { base: '#565a63', trim: '#3d4149', glass: '#1e242b', cols: 3, rows: 4, lit: 0.58 },
  { base: '#8a7466', trim: '#63513f', glass: '#2a2f36', cols: 6, rows: 4, lit: 0.36 },
];

/**
 * Returns { map, emissiveMap } for one facade style. The emissive canvas is
 * black except for lit windows, which is what keeps bloom off the walls.
 */
export function makeFacade(variantIndex) {
  const v = FACADE_VARIANTS[variantIndex];
  const rng = makeRng(1337 + variantIndex * 977);
  const W = 256;
  const H = 256;

  const [albedo, a] = canvas(W, H);
  const [emissive, e] = canvas(W, H);

  a.fillStyle = v.base;
  a.fillRect(0, 0, W, H);
  speckle(a, W, H, rng, 2600, 0.05);

  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);

  const cellW = W / v.cols;
  const cellH = H / v.rows;
  const winW = cellW * 0.56;
  const winH = cellH * 0.5;

  for (let row = 0; row < v.rows; row++) {
    // Floor slab band between storeys.
    a.fillStyle = v.trim;
    a.fillRect(0, row * cellH + cellH - 5, W, 5);

    for (let col = 0; col < v.cols; col++) {
      const x = col * cellW + (cellW - winW) / 2;
      const y = row * cellH + (cellH - winH) / 2 - 2;

      a.fillStyle = v.glass;
      a.fillRect(x, y, winW, winH);
      // Reveal / frame shadow around the opening.
      a.fillStyle = 'rgba(0,0,0,0.28)';
      a.fillRect(x - 1.5, y - 1.5, winW + 3, 2.5);

      if (rng.chance(v.lit)) {
        const warmth = rng.range(0.72, 1);
        const r = Math.round(255 * warmth);
        const g = Math.round(rng.range(190, 226) * warmth);
        const b = Math.round(rng.range(120, 165) * warmth);

        e.fillStyle = `rgb(${r},${g},${b})`;
        e.fillRect(x, y, winW, winH);

        // Glow needs to read on the albedo too or the window looks like a decal.
        a.fillStyle = `rgba(${r},${g},${b},0.55)`;
        a.fillRect(x, y, winW, winH);
      }
    }
  }

  return {
    map: toTexture(albedo),
    emissiveMap: toTexture(emissive),
  };
}

export function makeRoof() {
  const rng = makeRng(4242);
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#4a463f';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, rng, 2400, 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
  }
  return toTexture(c);
}

/** One dash period of two-lane asphalt, 14m across by TILE.road long. */
export function makeRoad() {
  const rng = makeRng(90210);
  const [c, ctx] = canvas(256, 256);

  ctx.fillStyle = '#2e2b2c';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 5000, 0.07);

  // Edge lines, inset from the kerb.
  ctx.fillStyle = 'rgba(226,214,190,0.5)';
  ctx.fillRect(16, 0, 4, 256);
  ctx.fillRect(236, 0, 4, 256);

  // Dashed centre line: 3m dash in a 10m period.
  ctx.fillStyle = 'rgba(240,228,196,0.82)';
  ctx.fillRect(124, 0, 8, Math.round(256 * 0.3));

  return toTexture(c);
}

export function makeIntersection() {
  const rng = makeRng(5150);
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#2e2b2c';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, rng, 2200, 0.07);
  return toTexture(c);
}

export function makePavement() {
  const rng = makeRng(7777);
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#8d857a';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, rng, 2600, 0.09);
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  return toTexture(c);
}

/**
 * Vertical gradient for the monument light columns: solid at the base, fading
 * out towards the top. Additive blending multiplies by alpha, so the alpha
 * ramp is what shapes the beam.
 */
export function makeBeam() {
  const [c, ctx] = canvas(4, 128);
  // Balanced against two failure modes: too bright and additive blending plus
  // bloom fuses it into a white column that swallows the coin; too dim and it
  // stops reading as a beacon from across the city. Held up through most of the
  // column so the top stays visible over rooftops.
  const grad = ctx.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, 'rgba(255,214,130,0.62)');
  grad.addColorStop(0.5, 'rgba(255,198,90,0.50)');
  grad.addColorStop(0.85, 'rgba(255,186,70,0.26)');
  grad.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeGrass() {
  const rng = makeRng(31415);
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#4c5b33';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4000; i++) {
    const g = rng.range(0.7, 1.25);
    ctx.fillStyle = `rgba(${Math.round(76 * g)},${Math.round(91 * g)},${Math.round(51 * g)},0.7)`;
    ctx.fillRect(rng() * 128, rng() * 128, 2, 2);
  }
  return toTexture(c);
}
