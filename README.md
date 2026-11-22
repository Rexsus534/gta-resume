# Vice City — Open World Stories

A third-person 3D open-world city game built with Three.js and Vite.

## Run locally

```bash
npm install
npm run dev
```

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move / drive |
| Shift | Sprint |
| Mouse | Look around |
| Scroll | Zoom |
| F | Enter / exit a nearby vehicle |
| Space | Handbrake |
| Esc | Release pointer lock |

## Current game systems

- Procedural 8×8 city with textured roads, intersections, sidewalks, parks, street lamps, high-rise buildings and glowing windows.
- Third-person player using the included GLB character and walking/running animations.
- Twenty AI traffic vehicles following the road network.
- Parked cars, vehicle entry/exit and animated driver-side doors.
- Occupied traffic cars with visible 3D drivers; taking an occupied car triggers a short stylized NPC exit animation.
- Forty-eight 3D pedestrians walking around city blocks.
- Two patrol cars with flashing red/blue lightbars and a police pursuit mode.
- Synthesized siren audio after taking an occupied vehicle.
- Speedometer, minimap, wanted stars and in-game notifications.

The player spawns on a clear avenue next to a starter vehicle. City geometry and traffic use the original optimized Three.js systems in this repository; pedestrian characters and vehicle occupants are lightweight 3D meshes.

## Tech

- Three.js
- Vite
- JavaScript
- GLTFLoader
