import * as THREE from 'three';

/**
 * Wraps a LoadingManager around the loading overlay. The character GLB is ~16MB,
 * so progress here is worth showing rather than faking.
 */
export function createLoader() {
  const overlay = document.getElementById('loading');
  const fill = document.getElementById('bar-fill');
  const status = document.getElementById('load-status');

  const manager = new THREE.LoadingManager();
  let settled = null;
  const ready = new Promise((resolve) => {
    settled = resolve;
  });

  manager.onProgress = (url, loaded, total) => {
    const pct = total > 0 ? (loaded / total) * 100 : 0;
    fill.style.width = `${pct.toFixed(0)}%`;
    status.textContent = `Loading assets — ${loaded} / ${total}`;
  };

  manager.onError = (url) => {
    status.textContent = `Failed to load ${url.split('/').pop()}`;
    console.error('[loading] failed:', url);
  };

  manager.onLoad = () => {
    fill.style.width = '100%';
    settled();
  };

  function setStatus(text) {
    status.textContent = text;
  }

  function dismiss() {
    fill.style.width = '100%';
    overlay.classList.add('done');
    setTimeout(() => overlay.classList.add('hidden'), 800);
    document.getElementById('hud').classList.remove('hidden');
  }

  return { manager, ready, setStatus, dismiss };
}
