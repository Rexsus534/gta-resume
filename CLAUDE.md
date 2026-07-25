# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # vite dev server on :5173 (runs extract-anims first)
npm run build    # production build to dist/ (runs extract-anims first)
npm run preview  # serve the production build
```

There is no test suite, linter, or type checker. Verification is done by driving the running game
through the dev harness described below.

`scripts/extract-anims.mjs` runs automatically via `predev`/`prebuild`. It reads
`assets-src/animations-source.glb` (gitignored) and writes `public/models/animations.glb`. If the
source is missing but the output exists it logs and skips, so a fresh clone works without the
16 MB source; if both are missing it exits non-zero and the dev server won't start.

## Verifying changes

`requestAnimationFrame` is suspended when the browser pane isn't compositing, so the game cannot be
verified by simply loading the page and screenshotting. `src/main.js` splits the loop into `step(dt)`
(the whole simulation, pure in `dt`) and `frame()` (rAF + timer). Under `import.meta.env.DEV` it
exposes `window.__game`:

```js
window.__game.step(1/60)        // advance one frame
window.__game.run(120)          // advance 120 frames deterministically
window.__game.shot(1280, 0.85)  // render + return a JPEG data URL
window.__game.toggleVehicle()   // enter/exit the nearest car
// plus: engine, player, city, traffic, state, cameraRig, allVehicles, input
```

`vite.config.js` adds a dev-only `/__shot?name=X` POST endpoint that writes a posted data URL to
`.dev-shots/X.jpg`, so frames can be read off disk:

```js
fetch('/__shot?name=check', { method: 'POST', body: window.__game.shot(1280, 0.85) })
```

To simulate held keys, wrap `input.isDown` — do not synthesise DOM events, since pointer lock
isn't active:

```js
const orig = g.input.isDown;
g.input.isDown = (c) => c === 'KeyW' || orig(c);
g.run(120);
g.input.isDown = orig;
```

Both the harness and the endpoint are stripped from production builds.

### What the harness cannot tell you

The same suspension that stops rAF also throttles `setTimeout` and freezes CSS transitions and
animations, because the compositor never ticks. Anything time-based in the DOM will therefore look
broken when it is fine:

- Poll for a state change rather than sleeping a fixed time — `setTimeout` in a background tab is
  clamped and fires late.
- A transition that has not advanced is not proof of a broken rule. To tell the two apart, inject
  `* { transition: none !important; animation: none !important }` and re-measure: if the element
  lands at its final position, the CSS matches and only the animation was failing to tick.
- Never build UI state on a double `requestAnimationFrame`. Use `void el.offsetWidth` to flush
  layout before adding an animating class, or the element stays parked at its start position.

Canvas grabs only capture WebGL. The HUD, banner and panel are DOM, so verify those by reading
`textContent`, class lists and `getBoundingClientRect()`.

## Architecture

Plain JavaScript, no framework. `src/main.js` constructs every module once, wires them, and owns the
loop. Modules do not import each other's state except through `src/config.js` and `src/state.js`.

### Cross-file invariants

These are the things that break silently if changed in one place only.

**Yaw convention: `0` points down world `+Z`.** Forward is `(sin yaw, cos yaw)`; right is
`(dz, -dx)` of the forward vector. This is shared by `player.js`, `vehicle.js`, `traffic.js` lane
offsets, `follow-camera.js` (camera yaw is `heading + PI` to sit behind a subject) and
`minimap.js` (the heading arrow rotates by `PI - yaw` because canvas `+y` is world `+z`). Changing
it anywhere requires changing it everywhere.

**Bloom is threshold-based, not selective.** The light rig in `config.js`/`lighting.js` is budgeted
so a sunlit diffuse surface peaks near 0.97 linear, under the 1.05 `UnrealBloomPass` threshold in
`render/postfx.js`, while window emissive sits at 1.9 and lamps at 3.2. Raising light intensities
without raising the threshold makes the entire city bloom. This coupling is the single most
fragile thing in the project.

**Sun elevation has a floor.** At 17 degrees (`world/lighting.js`) the streets still catch direct
light. Below roughly 14, 30 m buildings cast 190 m shadows and the whole street grid goes black.

**`config.js` is the only source of city dimensions.** `CITY`, `BLOCK_HALF`, `nodePos()` and
`blockCenter()` are consumed independently by `world/city.js` (geometry), `entities/traffic.js`
(the intersection graph) and `ui/minimap.js` (which redraws the road grid from `CITY` rather than
from the passed data). Changing `blockPitch` or `roadHalfWidth` propagates to all three.

**`world/collision.js` is global module state**, not an instance. `world/city.js` populates it at
build time via `addSolid()` (buildings, blocking) and `addPad()` (block slabs, only affecting
`groundHeightAt`). Call `reset()` before rebuilding a city. `follow-camera.js` uses its
`rayDistance()` to shorten the boom through walls.

### Character loading (`src/entities/player.js`)

The two GLBs are the same Meshy rig with three properties worth knowing:

- `character.glb`'s only clip, `Armature|clip0|baselayer`, is a 0.033s frozen pose used as idle;
  **both** `Walking` and `Running` come from `animations.glb`. A procedural bob compensates for the
  static idle.
- The rigs share 24 identically-named joints, so clips bind across files by node name with no
  retargeting.
- The export ships `emissiveFactor: [1,1,1]` with an emissive texture and an out-of-spec
  `specularColorFactor: [2,2,2]`. The material pass zeroes emissive — without it the character is
  self-lit, ignores the sun, and blows through the bloom threshold.

Scaling **must** use `new THREE.Box3().setFromObject(model, true)`. The `precise` flag runs vertices
through the real skinning path; a plain `Box3` measures geometry bounds times `matrixWorld` and
misses the bind matrices, which for this rig is wrong by two orders of magnitude. The model measures
1.70 m and is scaled to `PLAYER.height` on a wrapper `Group`, with feet seated via
`model.position.y = -box.min.y`.

### City rendering (`src/world/city.js`)

Draw calls are kept low deliberately: building walls are merged with `mergeGeometries` into one mesh
per facade variant (UVs pre-scaled per surface so a single non-repeating material still tiles), roofs
merge into one more, and roads/kerbs/lamps/trees are `InstancedMesh`. All textures are drawn to
canvas at load time in `world/textures.js` with a seeded RNG — there are no image downloads. New city
props should follow one of these two paths rather than adding standalone meshes.

Roads are built as separate segment and junction tiles so lane dashes stop at intersections instead
of crossing them.

### Vehicles

`entities/vehicle.js` is shared by the player and the AI; the difference is only who supplies
`{throttle, steer, handbrake}`. `entities/traffic.js` owns the intersection graph and hands a car
over with `takeControl()`/`releaseControl()` — release re-anchors the car to the nearest junction so
the AI doesn't resume a leg from wherever the player abandoned it. Parked cars (from
`city.parking`) are not in the traffic list, so `releaseControl` sets their driver to `null` and they
simply stay put; they are passed to `traffic.update(dt, parked)` as obstacles.

### Coin monuments

`src/content/resume.js` is the single source of truth for the mission: one entry produces one
monument, one minimap marker and one panel. `entities/coins.js` derives count and placement from
it, so nothing needs changing elsewhere when sections are added or removed. Placement is
farthest-point sampling over the city's park blocks (validated with `isBlocked`), falling back to
intersections only if a seed produces too few parks.

The light columns are additive-blended with an **HDR colour above 1.0** — over the bright hazy
horizon a 1.0 additive beam has almost no contrast, so the column is deliberately pushed past the
bloom threshold to earn its own halo. They also set `fog: false`, since a beacon that fades into
the haze defeats the point. The coin disc is wider than the beam radius on purpose, or it
disappears inside the column.

`ui/mission.js` owns the banner, panel and objective card and knows nothing about the world;
`main.js` feeds it the current target. While a panel is open, `main.js` swaps the real input for
`frozenInput` so the player stops taking control input, and `mission.js` releases pointer lock so
the panel can be read and scrolled.

All panel content goes through `textContent`, never `innerHTML` — real resume text will contain
`&` and apostrophes.
