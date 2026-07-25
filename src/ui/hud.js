import { Mode } from '../state.js';

// A 230-degree dial. The sweep deliberately skips straight-down (90 degrees in
// canvas space) so the arc stays inside the 200x130 canvas.
const START = Math.PI * 0.86;
const SWEEP = Math.PI * 1.28;

export function createHud() {
  const canvas = document.getElementById('speedo');
  const ctx = canvas.getContext('2d');
  const value = document.getElementById('speed-value');
  const label = document.getElementById('mode-label');
  const panel = document.getElementById('mode-panel');
  const prompt = document.getElementById('prompt');
  prompt.innerHTML = 'Press <b>F</b> to get in';

  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = 90;
  const radius = 72;

  let shown = 0;
  let lastMode = null;

  function drawGauge(fraction) {
    ctx.clearRect(0, 0, W, H);

    ctx.lineCap = 'round';

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, START, START + SWEEP);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Ticks
    for (let i = 0; i <= 10; i++) {
      const a = START + (SWEEP * i) / 10;
      const inner = radius - (i % 5 === 0 ? 15 : 10);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * (radius - 6), cy + Math.sin(a) * (radius - 6));
      ctx.strokeStyle = i / 10 > 0.8 ? 'rgba(255,120,90,0.55)' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = i % 5 === 0 ? 2.5 : 1.5;
      ctx.stroke();
    }

    // Fill
    if (fraction > 0.001) {
      const end = START + SWEEP * fraction;
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#ffb257');
      grad.addColorStop(0.7, '#ff8a3c');
      grad.addColorStop(1, '#ff5b3c');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, START, end);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 8;
      ctx.shadowColor = 'rgba(255,150,70,0.85)';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Needle tip
      ctx.beginPath();
      ctx.arc(cx + Math.cos(end) * radius, cy + Math.sin(end) * radius, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  return {
    /**
     * @param {number} speed  metres per second
     * @param {string} mode   Mode.ON_FOOT | Mode.DRIVING
     * @param {boolean} nearVehicle
     */
    update(speed, mode, nearVehicle) {
      const kph = speed * 3.6;
      const max = mode === Mode.DRIVING ? 140 : 26;

      // Ease the readout so it doesn't jitter on every frame.
      shown += (kph - shown) * 0.18;
      const fraction = Math.max(0, Math.min(1, shown / max));

      drawGauge(fraction);
      value.textContent = Math.round(shown).toString();

      if (mode !== lastMode) {
        label.textContent = mode;
        panel.classList.toggle('driving', mode === Mode.DRIVING);
        lastMode = mode;
      }

      // Only prompt on foot; a permanent "get out" banner while driving is noise.
      prompt.classList.toggle('hidden', !(mode === Mode.ON_FOOT && nearVehicle));
    },
  };
}
