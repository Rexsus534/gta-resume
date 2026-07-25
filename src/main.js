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
import { createCoins } from './entities/coins.js';

import { createPostFX } from './render/postfx.js';
import { createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { createMission } from './ui/mission.js';

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

  const player = await createPlayer(
    engine.scene,
    loader.manager,
    city.playerSpawn,
    loader.setStatus,
  );

  loader.setStatus('Starting traffic');
  const traffic = createTraffic(engine.scene, city.graph);

  const parkRng = makeRng(4711);
  const parked = city.parking.map(
    (p) =>
      new Vehicle(engine.scene, {
        x: p.x,
        z: p.z,
        heading: p.heading,
        colour: parkRng.pick(CAR_COLOURS),
      }),
  );

  const allVehicles = [...traffic.vehicles, ...parked];

  const cameraRig = new FollowCamera(engine.camera, input);
  const postfx = createPostFX(engine);
  const hud = createHud();
  const minimap = createMinimap(city.minimap);
  const mission = createMission();

  const coins = createCoins(engine.scene, city, {
    onCollect: (coin) => mission.celebrate(coin),
  });
  state.collectibles = coins.coins;

  // While a panel is up the world keeps running but the player stops taking
  // input, so nobody reads their own resume into the side of a building.
  const frozenInput = {
    isDown: () => false,
    consumePress: () => false,
  };

  player.placeAt(city.playerSpawn.x, city.playerSpawn.z, Math.PI);
  cameraRig.snapBehind(Math.PI);

  // ------------------------------------------------------------ enter / exit

  function nearestVehicle() {
    let best = null;
    let bestDist = CAR.enterRange;
    for (const v of allVehicles) {
      const d = v.distanceTo(player.position.x, player.position.z);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  function toggleVehicle() {
    if (state.mode === Mode.ON_FOOT) {
      const v = state.nearbyVehicle;
      if (!v) return;
      state.activeVehicle = v;
      state.mode = Mode.DRIVING;
      v.driver = 'player';
      traffic.takeControl(v);
      player.setVisible(false);
      cameraRig.snapBehind(v.heading);
      return;
    }

    const v = state.activeVehicle;
    v.getExitPoint(_exit);

    // If the driver's door is up against a wall, step out the other side.
    if (isBlocked(_exit.x, _exit.z, PLAYER.radius)) {
      const rightX = Math.cos(v.heading);
      const rightZ = -Math.sin(v.heading);
      _exit.set(v.position.x + rightX * 2.1, 0, v.position.z + rightZ * 2.1);
    }

    player.placeAt(_exit.x, _exit.z, v.heading);
    player.setVisible(true);
    traffic.releaseControl(v);
    state.activeVehicle = null;
    state.mode = Mode.ON_FOOT;
    cameraRig.snapBehind(v.heading);
  }

  // ------------------------------------------------------------------- loop

  const timer = new THREE.Timer();
  timer.connect(document);
  const focus = new THREE.Vector3();
  let started = false;

  function step(dt) {
    const frozen = mission.panelOpen;
    state.panelOpen = frozen;
    const control = frozen ? frozenInput : input;

    if (control.consumePress('KeyF')) toggleVehicle();

    if (state.mode === Mode.ON_FOOT) {
      player.update(dt, control, cameraRig);
      state.speed = player.speed;
      state.nearbyVehicle = nearestVehicle();
      focus.copy(player.position);

      cameraRig.update(dt, player.root.position, {
        height: 1.5,
        distance: 6.4,
        autoYaw: null,
      });
    } else {
      const v = state.activeVehicle;
      const throttle =
        (control.isDown('KeyW') || control.isDown('ArrowUp') ? 1 : 0) -
        (control.isDown('KeyS') || control.isDown('ArrowDown') ? 1 : 0);
      const steer =
        (control.isDown('KeyD') || control.isDown('ArrowRight') ? 1 : 0) -
        (control.isDown('KeyA') || control.isDown('ArrowLeft') ? 1 : 0);

      v.update(dt, {
        throttle,
        steer,
        handbrake: control.isDown('Space'),
      });

      state.speed = Math.abs(v.speed);
      state.nearbyVehicle = null;
      focus.copy(v.position);

      // Swing back behind the bonnet whenever the player isn't steering the
      // camera, so forward on screen stays forward.
      cameraRig.update(dt, v.position, {
        height: 2.05,
        distance: 9.4,
        autoYaw: v.heading + Math.PI,
        autoYawRate: 3.2,
        followLag: 9,
      });
    }

    traffic.update(dt, parked);
    lighting.update(focus);

    // Collection is a horizontal check, so you can drive under a monument or
    // walk into its base and either counts.
    coins.update(dt, focus);

    const heading = state.mode === Mode.DRIVING ? state.activeVehicle.heading : player.yaw;
    const target = coins.nearestTarget(focus.x, focus.z);
    mission.updateObjective(target, focus, heading, coins.collected, coins.total);

    hud.update(state.speed, state.mode, !!state.nearbyVehicle);
    minimap.update(focus, heading, allVehicles, coins.markers(target?.coin.id));

    postfx.render();
    input.showOverlay(true);
    input.endFrame();

    if (!started) {
      started = true;
      loader.dismiss();
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    timer.update();
    step(Math.min(timer.getDelta(), 1 / 20));
  }

  if (import.meta.env.DEV) {
    // Lets the sim be advanced and grabbed without depending on rAF, which the
    // browser suspends whenever the page isn't compositing.
    window.__game = {
      engine,
      player,
      city,
      traffic,
      state,
      cameraRig,
      allVehicles,
      input,
      coins,
      mission,
      step,
      toggleVehicle,
      /** Teleport to a monument by id, to test collection without the drive. */
      goTo(id) {
        const coin = coins.coins.find((c) => c.id === id);
        if (!coin) return false;
        if (state.mode === Mode.DRIVING) toggleVehicle();
        player.placeAt(coin.position.x + 3, coin.position.z + 3, 0);
        step(1 / 60);
        return true;
      },
      run(frames = 60, dt = 1 / 60) {
        for (let i = 0; i < frames; i++) step(dt);
      },
      shot(width = 760, quality = 0.7) {
        step(1 / 60); // redraw, then read the buffer in the same task
        const source = engine.renderer.domElement;
        const out = document.createElement('canvas');
        out.width = width;
        out.height = Math.round((source.height / source.width) * width);
        out.getContext('2d').drawImage(source, 0, 0, out.width, out.height);
        return out.toDataURL('image/jpeg', quality);
      },
    };
  }

  frame();
}

boot().catch((err) => {
  console.error(err);
  const status = document.getElementById('load-status');
  if (status) status.textContent = `Failed to start: ${err.message}`;
});
