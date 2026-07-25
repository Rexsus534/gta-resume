# Golden Hour — City Drive

A GTA-style third-person open-city game built with Three.js and Vite, starring your own
Meshy-generated character.

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and click to lock the pointer.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move (relative to the camera) / drive |
| `Shift` | Sprint |
| Mouse | Look around (pointer lock) |
| Scroll | Zoom the camera boom |
| `F` | Get in / out of the nearest car |
| `Space` | Handbrake (while driving) |
| `Esc` | Release the cursor |

## Assets

Two GLBs from the same Meshy rig live in `public/models/`:

- `character.glb` — the mesh and skeleton. Its only animation, `Armature|clip0|baselayer`, is a
  0.033s standing pose used as idle.
- `animations.glb` — carries the `Walking` and `Running` cycles. Both rigs share the same 24
  joints with the same names, so the clips bind to the character by node name with no retargeting.

The source animation file is 16 MB because it re-ships the whole 256k-triangle mesh and its 5 MB
texture just to carry two clips. `scripts/extract-anims.mjs` strips it to the animation channels
and node hierarchy only — **16 MB → 59 KB** — and runs automatically via `predev` / `prebuild`
from `assets-src/animations-source.glb`.

Two quirks of the Meshy export are corrected at load time in `src/entities/player.js`:

- The material ships `emissiveFactor: [1,1,1]` with an emissive texture, which makes the character
  fully self-lit — it would ignore the sun and blow straight through the bloom threshold. Emissive
  is zeroed so it becomes a normally lit object.
- `KHR_materials_specular.specularColorFactor` is `[2,2,2]`, out of spec, and is clamped.

The model measures 1.70 m; it is measured with `Box3.setFromObject(model, true)` (the `precise`
pass runs vertices through the actual skinning path, which a plain `Box3` does not) and scaled to
1.85 m with its feet seated on the ground.

## Layout

```
scripts/extract-anims.mjs   GLB animation stripper
src/
  config.js                 city grid, player/car/traffic tunables, palette
  state.js                  game mode, active vehicle, mission hooks (unused for now)
  core/       engine, loading screen, input, follow camera, seeded RNG
  world/      lighting, procedural city, collision, canvas textures
  entities/   player, vehicle, AI traffic
  render/     bloom + filmic grade composer
  ui/         speedometer HUD, minimap
```

## Notes on the look

Bloom is threshold-based rather than selective: the light rig is budgeted so a sunlit diffuse
surface peaks around 0.97 linear, below the 1.05 bloom threshold, while emissive windows sit at
1.9 and lamps at 3.2. That keeps the glow on glass and lights instead of on every bright wall.
If you raise the light intensities in `src/config.js`, raise the threshold in
`src/render/postfx.js` to match or the whole city will start blooming.

The sun sits at 17° elevation. Much lower and 30 m buildings cast 190 m shadows that put the
entire street grid in darkness.

## The coin mission

Six floating coin monuments are scattered across the city, one per resume section. Each is a
ground ring, a 34 m light column visible from across town, and a coin spinning 6.5 m up. Get within
4.5 m — on foot or in a car — and it is collected: a **Mission Passed** banner drops in, then a
panel slides in from the right with that section's content.

The objective card (top left) always points at the nearest uncollected monument, with a rotating
arrow, a compass bearing and a live distance. The minimap shows every monument as a gold dot,
pinning off-screen ones to the rim so they still point the way; collected ones become a dim tick,
and the monument leaves a spent ring behind in the world.

While a panel is open the pointer lock is released so you can read and scroll, and player input is
frozen so you don't drive into a building mid-sentence. Close it with `Esc`, `Enter`, `Space`, `E`,
the × button, or by clicking the backdrop.

### Swapping in your real resume

Everything lives in [`src/content/resume.js`](src/content/resume.js). One entry produces one
monument, one minimap marker and one panel — add or remove entries and placement, the objective
counter and the minimap all follow automatically.

All fields are rendered with `textContent`, so `&`, `<` and apostrophes are safe to paste in
verbatim. Each entry supports:

| Field | Purpose |
| --- | --- |
| `id` | short slug, used as the debug key |
| `title` | panel heading, and the name on the Mission Passed banner |
| `tag` | small label above the heading |
| `subtitle` | one line under the heading |
| `meta` | optional `{label, value}` rows, rendered as a definition list |
| `body` | `{text}` for a paragraph, or `{heading, items[]}` for a titled bullet list |

Monument placement uses farthest-point sampling over the city's park blocks, so the set stays
spread out however many entries you have. With the default seed there are 13 parks, comfortably
more than the six needed.
