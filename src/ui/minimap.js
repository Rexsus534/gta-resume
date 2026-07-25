import { CITY, BLOCK_HALF } from '../config.js';

const PPM = 1.25; // pixels per metre, so the 220px dial shows ~176m
const MARGIN = 40;

export function createMinimap(data) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const half = size / 2;

  const span = (CITY.size + MARGIN * 2) * PPM;
  const originX = CITY.origin - MARGIN;
  const originZ = CITY.origin - MARGIN;

  const toX = (x) => (x - originX) * PPM;
  const toZ = (z) => (z - originZ) * PPM;

  // The city never changes, so it is painted once and then panned under the dial.
  const layer = document.createElement('canvas');
  layer.width = span;
  layer.height = span;
  const lc = layer.getContext('2d');

  lc.fillStyle = '#1c1815';
  lc.fillRect(0, 0, span, span);

  // Roads: draw the grid as thick strokes, which is cheaper and cleaner than
  // replicating every segment.
  lc.strokeStyle = '#6c6158';
  lc.lineWidth = CITY.roadHalfWidth * 2 * PPM;
  lc.beginPath();
  for (let i = 0; i <= CITY.blocks; i++) {
    const p = CITY.origin + i * CITY.blockPitch;
    lc.moveTo(toX(p), toZ(CITY.origin));
    lc.lineTo(toX(p), toZ(CITY.origin + CITY.size));
    lc.moveTo(toX(CITY.origin), toZ(p));
    lc.lineTo(toX(CITY.origin + CITY.size), toZ(p));
  }
  lc.stroke();

  // Block pads on top of the road grid.
  for (const b of data.blocks) {
    lc.fillStyle = b.isPark ? '#41582a' : '#2a2420';
    lc.fillRect(
      toX(b.x - b.half),
      toZ(b.z - b.half),
      BLOCK_HALF * 2 * PPM,
      BLOCK_HALF * 2 * PPM,
    );
  }

  for (const b of data.buildings) {
    lc.fillStyle = '#6d5f52';
    lc.fillRect(toX(b.x - b.hw), toZ(b.z - b.hd), b.hw * 2 * PPM, b.hd * 2 * PPM);
  }

  for (const l of data.landmarks) {
    const x = toX(l.x);
    const z = toZ(l.z);
    lc.fillStyle = '#ffb257';
    lc.beginPath();
    lc.moveTo(x, z - 5);
    lc.lineTo(x + 5, z);
    lc.lineTo(x, z + 5);
    lc.lineTo(x - 5, z);
    lc.closePath();
    lc.fill();
  }

  return {
    /**
     * @param {{x:number,z:number}} focus  world position at the dial centre
     * @param {number} heading             radians, 0 = +Z
     * @param {Array}  vehicles            anything with .position
     * @param {Array}  markers             {x, z, collected, active} monuments
     */
    update(focus, heading, vehicles, markers = []) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#0f0d0c';
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.translate(half - toX(focus.x), half - toZ(focus.z));
      ctx.drawImage(layer, 0, 0);
      ctx.restore();

      // Traffic blips
      ctx.fillStyle = 'rgba(120,200,255,0.9)';
      for (const v of vehicles) {
        const dx = (v.position.x - focus.x) * PPM;
        const dz = (v.position.z - focus.z) * PPM;
        if (dx * dx + dz * dz > (half - 6) ** 2) continue;
        ctx.beginPath();
        ctx.arc(half + dx, half + dz, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Monument markers, drawn over the traffic but under the player.
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 380);
      for (const mk of markers) {
        let dx = (mk.x - focus.x) * PPM;
        let dz = (mk.z - focus.z) * PPM;
        const dist = Math.hypot(dx, dz);
        const limit = half - 12;
        const offMap = dist > limit;

        if (offMap) {
          // Pin it to the rim so it keeps pointing the way even from across town.
          if (mk.collected) continue;
          dx = (dx / dist) * limit;
          dz = (dz / dist) * limit;
        }

        const px = half + dx;
        const py = half + dz;

        if (mk.collected) {
          ctx.strokeStyle = 'rgba(255,255,255,0.34)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px - 2.2, py);
          ctx.lineTo(px - 0.4, py + 2);
          ctx.lineTo(px + 2.4, py - 2.2);
          ctx.stroke();
          continue;
        }

        if (mk.active) {
          ctx.strokeStyle = `rgba(255,201,74,${0.25 + pulse * 0.5})`;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(px, py, 7 + pulse * 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#ffc94a';
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(px, py, offMap ? 3.6 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Heading arrow. World +Z runs down the canvas, so an arrow drawn
      // pointing up needs rotating by (pi - yaw).
      ctx.save();
      ctx.translate(half, half);
      ctx.rotate(Math.PI - heading);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6.5, 8);
      ctx.lineTo(0, 4.5);
      ctx.lineTo(-6.5, 8);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Soft edge so the circular mask doesn't look pasted on.
      const vig = ctx.createRadialGradient(half, half, half * 0.62, half, half, half);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.38)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, size, size);
    },
  };
}
