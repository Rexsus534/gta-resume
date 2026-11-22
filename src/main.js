import './style.css';
import * as THREE from 'three';
import { createEngine } from './core/engine.js';
import { createLoader } from './core/loading.js';
import { createInput } from './core/input.js';
import { FollowCamera } from './core/follow-camera.js';
import { makeRng } from './core/rng.js';
import { createLighting } from './world/lighting.js';
import { createCity } from './world/city.js';
import { isBlocked } from './world/collision.js';
import { createPlayer } from './entities/player.js';
import { Vehicle, CAR_COLOURS } from './entities/vehicle.js';
import { createTraffic } from './entities/traffic.js';
import { createPedestrians } from './entities/pedestrians.js';
import { createPoliceSiren } from './core/police-siren.js';
import { createPostFX } from './render/postfx.js';
import { createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { state, Mode } from './state.js';
import { CAR, PLAYER } from './config.js';

const _exit = new THREE.Vector3();

async function boot() {
  const engine = createEngine();
  const loader = createLoader();
  const input = createInput(engine.canvas);

  loader.setStatus('Building the city');
  const lighting = createLighting(engine.scene);
  const city = createCity(engine.scene);

  const player = await createPlayer(engine.scene, loader.manager, city.playerSpawn, loader.setStatus);
  loader.setStatus('Starting city traffic');
  const traffic = createTraffic(engine.scene, city.graph);
  const pedestrians = createPedestrians(engine.scene, 48);

  const parkRng = makeRng(4711);
  const parked = city.parking.map((p) => new Vehicle(engine.scene, {
    x: p.x, z: p.z, heading: p.heading, colour: parkRng.pick(CAR_COLOURS),
  }));
  const allVehicles = [...traffic.vehicles, ...parked];

  const cameraRig = new FollowCamera(engine.camera, input);
  const postfx = createPostFX(engine);
  const hud = createHud();
  const minimap = createMinimap(city.minimap);
  const siren = createPoliceSiren();

  const frozenInput = { isDown: () => false, consumePress: () => false };
  player.placeAt(city.playerSpawn.x, city.playerSpawn.z, Math.PI);
  cameraRig.snapBehind(Math.PI);

  let wantedLevel = 0;
  let wantedTimer = 0;
  let stolenCars = 0;

  function nearestVehicle() {
    let best = null, bestDist = CAR.enterRange;
    for (const v of allVehicles) {
      const d = v.distanceTo(player.position.x, player.position.z);
      if (d < bestDist) { bestDist = d; best = v; }
    }
    return best;
  }

  function toggleVehicle() {
    if (state.mode === Mode.ON_FOOT) {
      const v = state.nearbyVehicle;
      if (!v) return;
      if (v.driver === 'ai') {
        v.ejectDriver(engine.scene);
        v.stolen = true;
        v.speed *= 0.12;
        wantedLevel = Math.min(5, Math.max(2, wantedLevel + 1));
        wantedTimer = 28;
        stolenCars++;
        siren.start();
        hud.notify('Sürücü araçtan indi! Polis peşine düştü.');
      } else {
        v.openDriverDoor();
        hud.notify('Araca bindin.');
      }
      state.activeVehicle = v;
      state.mode = Mode.DRIVING;
      v.driver = 'player';
      traffic.takeControl(v);
      player.setVisible(false);
      cameraRig.snapBehind(v.heading);
      return;
    }

    const v = state.activeVehicle;
    v.openDriverDoor();
    v.speed = 0;
    v.getExitPoint(_exit);
    if (isBlocked(_exit.x, _exit.z, PLAYER.radius)) {
      const rightX = Math.cos(v.heading), rightZ = -Math.sin(v.heading);
      _exit.set(v.position.x + rightX * 2.1, 0, v.position.z + rightZ * 2.1);
    }
    player.placeAt(_exit.x, _exit.z, v.heading);
    player.setVisible(true);
    traffic.releaseControl(v);
    state.activeVehicle = null;
    state.mode = Mode.ON_FOOT;
    cameraRig.snapBehind(v.heading);
  }

  const timer = new THREE.Timer();
  timer.connect(document);
  const focus = new THREE.Vector3();
  let started = false;

  function step(dt) {
    const frozen = false;
    const control = frozen ? frozenInput : input;
    if (control.consumePress('KeyF')) toggleVehicle();

    if (state.mode === Mode.ON_FOOT) {
      player.update(dt, control, cameraRig);
      state.speed = player.speed;
      state.nearbyVehicle = nearestVehicle();
      focus.copy(player.position);
      cameraRig.update(dt, player.root.position, { height: 1.5, distance: 6.4, autoYaw: null });
    } else {
      const v = state.activeVehicle;
      const throttle = (control.isDown('KeyW') || control.isDown('ArrowUp') ? 1 : 0) -
        (control.isDown('KeyS') || control.isDown('ArrowDown') ? 1 : 0);
      const steer = (control.isDown('KeyD') || control.isDown('ArrowRight') ? 1 : 0) -
        (control.isDown('KeyA') || control.isDown('ArrowLeft') ? 1 : 0);
      v.update(dt, { throttle, steer, handbrake: control.isDown('Space') });
      state.speed = Math.abs(v.speed);
      state.nearbyVehicle = null;
      focus.copy(v.position);
      cameraRig.update(dt, v.position, { height: 2.05, distance: 9.4, autoYaw: v.heading + Math.PI, autoYawRate: 3.2, followLag: 9 });
    }

    if (wantedLevel > 0) {
      wantedTimer -= dt;
      if (wantedTimer <= 0) {
        wantedLevel = 0;
        siren.stop();
        hud.notify('Polis araması sona erdi.');
      }
    }

    traffic.update(dt, parked, focus, wantedLevel > 0);
    for (const v of allVehicles) if (v !== state.activeVehicle && v.driver !== 'ai') v.update(dt, { throttle: 0, steer: 0, handbrake: false });
    pedestrians.update(dt);
    lighting.update(focus);

    const heading = state.mode === Mode.DRIVING ? state.activeVehicle.heading : player.yaw;
    hud.update(state.speed, state.mode, !!state.nearbyVehicle, state.nearbyVehicle?.driver === 'ai');
    hud.updateWanted(wantedLevel, wantedTimer, stolenCars);
    minimap.update(focus, heading, allVehicles, []);

    postfx.render();
    input.showOverlay(true);
    input.endFrame();

    if (!started) { started = true; loader.dismiss(); }
  }

  function frame() {
    requestAnimationFrame(frame);
    timer.update();
    step(Math.min(timer.getDelta(), 1 / 20));
  }

  if (import.meta.env.DEV) {
    window.__game = { engine, player, city, traffic, pedestrians, state, cameraRig, allVehicles, input, step, toggleVehicle,
      run(frames=60,dt=1/60){for(let i=0;i<frames;i++)step(dt);},
    };
  }
  frame();
}
boot().catch((err) => {
  console.error(err);
  const status = document.getElementById('load-status');
  if (status) status.textContent = `Failed to start: ${err.message}`;
});
