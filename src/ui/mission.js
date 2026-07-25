const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const COMPASS_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const BANNER_DELAY = 900; // panel slides in behind the banner
const BANNER_LIFE = 2800;

/** World bearing from north, clockwise, in radians. North is -Z. */
function bearingTo(dx, dz) {
  return Math.atan2(dx, -dz);
}

function compassIndex(bearing) {
  const t = ((bearing / (Math.PI * 2)) % 1 + 1) % 1;
  return Math.round(t * 8) % 8;
}

/**
 * Objective readout, the Mission Passed banner, and the resume panel.
 * Owns nothing about the world — main.js feeds it the current target.
 */
export function createMission() {
  const objective = document.getElementById('objective');
  const objProgress = document.getElementById('obj-progress');
  const objArrow = document.getElementById('obj-arrow');
  const objText = document.getElementById('obj-text');
  const objDist = document.getElementById('obj-dist');

  const banner = document.getElementById('mission-banner');
  const bannerName = document.getElementById('mb-name');

  const panel = document.getElementById('panel');
  const panelScroll = document.getElementById('panel-scroll');
  const panelClose = document.getElementById('panel-close');

  let panelOpen = false;
  let timers = [];
  let arrowAngle = 0;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    // textContent throughout, so real resume text with &, < or ' pastes in safely.
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildPanel(section) {
    panelScroll.replaceChildren();

    if (section.tag) panelScroll.append(el('p', 'panel-tag', section.tag));
    panelScroll.append(el('h2', 'panel-title', section.title));
    if (section.subtitle) panelScroll.append(el('p', 'panel-subtitle', section.subtitle));

    if (section.meta?.length) {
      const dl = el('dl', 'panel-meta');
      for (const row of section.meta) {
        dl.append(el('dt', null, row.label), el('dd', null, row.value));
      }
      panelScroll.append(dl);
    }

    for (const block of section.body ?? []) {
      if (block.heading) {
        const wrap = el('section', 'panel-block');
        wrap.append(el('h3', null, block.heading));
        const ul = el('ul');
        for (const item of block.items ?? []) ul.append(el('li', null, item));
        wrap.append(ul);
        panelScroll.append(wrap);
      } else if (block.text) {
        panelScroll.append(el('p', 'panel-para', block.text));
      }
    }

    panelScroll.scrollTop = 0;
  }

  function openPanel(section) {
    buildPanel(section);
    panel.classList.remove('hidden');
    // Flush layout so the transition has a start position to animate from.
    // A double rAF would also work when visible, but rAF is suspended whenever
    // the page isn't compositing, which would leave the panel parked off-screen.
    void panel.offsetWidth;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    panelOpen = true;
    // Hand the cursor back so the panel can be read, scrolled and closed.
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    timers.push(setTimeout(() => panel.classList.add('hidden'), 420));
  }

  panelClose.addEventListener('click', closePanel);
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closePanel();
  });
  window.addEventListener('keydown', (e) => {
    if (!panelOpen) return;
    if (['Escape', 'Enter', 'Space', 'KeyE'].includes(e.code)) {
      e.preventDefault();
      closePanel();
    }
  });

  return {
    get panelOpen() {
      return panelOpen;
    },
    closePanel,

    /** Runs the banner, then slides the panel in behind it. */
    celebrate(coin) {
      clearTimers();

      bannerName.textContent = coin.title;
      banner.classList.remove('hidden', 'out');
      // restart the entry animation even if a banner is already on screen
      banner.classList.remove('in');
      void banner.offsetWidth;
      banner.classList.add('in');

      timers.push(setTimeout(() => openPanel(coin.section), BANNER_DELAY));
      timers.push(
        setTimeout(() => {
          banner.classList.add('out');
          timers.push(setTimeout(() => banner.classList.add('hidden'), 600));
        }, BANNER_LIFE),
      );
    },

    /**
     * @param {{coin:object, distance:number}|null} target
     * @param {{x:number, z:number}} from     where the player currently is
     * @param {number} heading                what the player is facing, radians
     */
    updateObjective(target, from, heading, collected, total) {
      objProgress.textContent = `${collected} / ${total}`;

      if (!target) {
        objective.classList.add('done');
        objText.textContent = 'All monuments found';
        objDist.textContent = 'Nice driving.';
        return;
      }

      objective.classList.remove('done');
      const dx = target.coin.position.x - from.x;
      const dz = target.coin.position.z - from.z;

      // The arrow points where to steer, relative to where you are facing.
      // Unwrapped so crossing the back of the compass doesn't spin it the long
      // way round through the CSS transition.
      const relative = Math.atan2(dx, dz) - heading;
      const turns = Math.round((arrowAngle - relative) / (Math.PI * 2));
      arrowAngle = relative + turns * Math.PI * 2;
      objArrow.style.transform = `rotate(${(arrowAngle * 180) / Math.PI}deg)`;

      const dir = compassIndex(bearingTo(dx, dz));
      objText.textContent = `Head ${COMPASS[dir]} to ${target.coin.title}`;
      objDist.textContent = `${COMPASS_SHORT[dir]} · ${Math.round(target.distance)} m`;
    },
  };
}
