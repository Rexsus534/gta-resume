// Shared tunables. City geometry lives here because city, traffic and minimap
// all need to agree on the same grid.

const blocks = 8;
const blockPitch = 80;

export const CITY = {
  blocks,
  blockPitch,
  /** Half-width of the asphalt, so roads are 14m across. */
  roadHalfWidth: 7,
  /** Curb height the player steps up onto. */
  curbHeight: 0.16,
  /** How far right of the centreline a car drives. */
  laneOffset: 3.4,
  parkChance: 0.14,

  size: blocks * blockPitch,
  origin: -(blocks * blockPitch) / 2,
};

/** World position of intersection (i, j), i and j in 0..blocks. */
export function nodePos(i, j) {
  return {
    x: CITY.origin + i * CITY.blockPitch,
    z: CITY.origin + j * CITY.blockPitch,
  };
}

/** Centre of block (bi, bj), bi and bj in 0..blocks-1. */
export function blockCenter(bi, bj) {
  return {
    x: CITY.origin + (bi + 0.5) * CITY.blockPitch,
    z: CITY.origin + (bj + 0.5) * CITY.blockPitch,
  };
}

/** Half-extent of a block's raised pad (the sidewalk + lot slab). */
export const BLOCK_HALF = CITY.blockPitch / 2 - CITY.roadHalfWidth;

export const PLAYER = {
  height: 1.85,
  radius: 0.42,
  walkSpeed: 1.9,
  runSpeed: 5.6,
  accel: 22,
  damping: 14,
  turnRate: 11,
  // Speeds the walk/run clips were authored at, used to keep feet from sliding.
  nominalWalk: 1.55,
  nominalRun: 4.6,
};

export const CAR = {
  accel: 12,
  reverseAccel: 8,
  brake: 26,
  drag: 0.42,
  rollingResistance: 2.2,
  maxSpeed: 33,
  maxReverse: 9,
  steerRate: 2.5,
  radius: 1.5,
  enterRange: 4.2,
};

export const TRAFFIC = {
  count: 20,
  cruise: 11,
  turnCruise: 5.5,
  followDistance: 11,
};

export const COINS = {
  /** Height the coin floats at — clear of the beam's bright base. */
  floatHeight: 6.5,
  /** Tall enough to clear the typical 9-34m building and read from across town. */
  beamHeight: 34,
  beamRadius: 1.45,
  ringRadius: 2.5,
  /** Wider than beamRadius on purpose, so the coin reads against the column. */
  discRadius: 2.05,
  /** Horizontal distance that counts as reaching it, on foot or in a car. */
  collectRadius: 4.5,
  spin: 1.05,
  bobAmplitude: 0.34,
  bobSpeed: 1.25,
};

/** Golden-hour palette, shared by lighting, fog, sky and the colour grade. */
export const PALETTE = {
  sun: 0xffb066,
  skyTop: 0x2d3f6b,
  skyHorizon: 0xff9a55,
  fog: 0xc9773f,
  // The fill gets its own, less saturated tone. Reusing the horizon orange for
  // it washes the whole city into a single hue and kills the greens.
  skyFill: 0xffc39c,
  groundBounce: 0x5a4a48,
  windowGlow: 0xffcf8a,
  lampGlow: 0xffd9a0,
  coin: 0xffc94a,
};
