/**
 * Strips the merged Meshy animation GLB down to just its animation clips.
 *
 * The source file re-ships the whole character (256k tris + a 5MB 2048x2048 PNG)
 * purely to carry two clips, so it weighs ~16MB. Animations only need the node
 * hierarchy plus the accessors their samplers read, which comes to a few hundred KB.
 *
 * Reads  assets-src/animations-source.glb
 * Writes public/models/animations.glb
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets-src', 'animations-source.glb');
const OUT = path.join(ROOT, 'public', 'models', 'animations.glb');

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

// Extensions that only ever describe materials/textures, so they go with them.
const MATERIAL_EXTENSIONS = new Set([
  'KHR_materials_specular',
  'KHR_materials_ior',
  'KHR_materials_emissive_strength',
  'KHR_materials_clearcoat',
  'KHR_materials_transmission',
  'KHR_texture_transform',
  'KHR_materials_unlit',
]);

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file');
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === JSON_CHUNK) json = JSON.parse(buffer.subarray(start, start + length).toString('utf8'));
    else if (type === BIN_CHUNK) bin = buffer.subarray(start, start + length);
    offset = start + length;
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin };
}

function pad4(n) {
  return (4 - (n % 4)) % 4;
}

function buildGlb(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = Buffer.alloc(pad4(jsonBuf.length), 0x20);
  const binPad = Buffer.alloc(pad4(bin.length), 0);

  const jsonLen = jsonBuf.length + jsonPad.length;
  const binLen = bin.length + binPad.length;
  const total = 12 + 8 + jsonLen + 8 + binLen;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonLen, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binLen, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);

  return Buffer.concat([header, jsonHeader, jsonBuf, jsonPad, binHeader, bin, binPad]);
}

function extract() {
  const src = fs.readFileSync(SRC);
  const { json, bin } = parseGlb(src);

  if (!json.animations?.length) throw new Error('source GLB contains no animations');

  // 1. Every accessor an animation sampler reads.
  const keptAccessors = [];
  const accessorRemap = new Map();
  const keepAccessor = (index) => {
    if (accessorRemap.has(index)) return accessorRemap.get(index);
    const next = keptAccessors.length;
    accessorRemap.set(index, next);
    keptAccessors.push(json.accessors[index]);
    return next;
  };

  const animations = json.animations.map((anim) => ({
    ...anim,
    samplers: anim.samplers.map((sampler) => ({
      ...sampler,
      input: keepAccessor(sampler.input),
      output: keepAccessor(sampler.output),
    })),
  }));

  // 2. Every bufferView those accessors read, copied into a fresh BIN chunk.
  const chunks = [];
  const viewRemap = new Map();
  const keptViews = [];
  let cursor = 0;

  const accessors = keptAccessors.map((accessor) => {
    const copy = { ...accessor };
    if (copy.sparse) throw new Error('sparse accessors are not supported by this stripper');
    if (copy.bufferView === undefined) return copy;

    const original = json.bufferViews[copy.bufferView];
    const key = copy.bufferView;
    if (!viewRemap.has(key)) {
      const start = original.byteOffset ?? 0;
      const slice = bin.subarray(start, start + original.byteLength);
      const padding = pad4(cursor);
      if (padding) {
        chunks.push(Buffer.alloc(padding, 0));
        cursor += padding;
      }
      const view = { buffer: 0, byteOffset: cursor, byteLength: original.byteLength };
      if (original.byteStride !== undefined) view.byteStride = original.byteStride;
      viewRemap.set(key, keptViews.length);
      keptViews.push(view);
      chunks.push(slice);
      cursor += slice.length;
    }
    copy.bufferView = viewRemap.get(key);
    return copy;
  });

  const newBin = Buffer.concat(chunks);

  // 3. Keep the node hierarchy (animations target nodes by index, three.js binds
  //    tracks by node name) but drop the geometry those nodes point at.
  const nodes = json.nodes.map((node) => {
    const { mesh, skin, ...rest } = node;
    return rest;
  });

  const out = {
    asset: json.asset,
    scene: json.scene ?? 0,
    scenes: json.scenes,
    nodes,
    accessors,
    bufferViews: keptViews,
    buffers: [{ byteLength: newBin.length }],
    animations,
  };

  const usedExtensions = (json.extensionsUsed ?? []).filter((name) => !MATERIAL_EXTENSIONS.has(name));
  if (usedExtensions.length) out.extensionsUsed = usedExtensions;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buildGlb(out, newBin));

  const before = (src.length / 1048576).toFixed(2);
  const after = (fs.statSync(OUT).size / 1024).toFixed(0);
  const names = json.animations.map((a) => a.name).join(', ');
  console.log(`[extract-anims] ${before}MB -> ${after}KB  clips: ${names}`);
}

if (!fs.existsSync(SRC)) {
  if (fs.existsSync(OUT)) {
    console.log('[extract-anims] source not present, using existing public/models/animations.glb');
  } else {
    console.error(`[extract-anims] missing source and no prebuilt output.\n  expected: ${SRC}`);
    process.exit(1);
  }
} else {
  extract();
}
