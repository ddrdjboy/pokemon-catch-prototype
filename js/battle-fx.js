/**
 * Battle presentation FX (POC). Combat math stays in battle.js.
 * Modes: off | light | medium | heavy
 */

const MODES = new Set(['off', 'light', 'medium', 'heavy']);

const TYPE_TINT = {
  fire: '#ff6a2a',
  water: '#3aa0ff',
  electric: '#ffd84a',
  grass: '#5dce4a',
  rock: '#c4a36a',
  ground: '#d2a15a',
  psychic: '#ff6ec7',
  ghost: '#7b5cff',
  fighting: '#d04545',
  ice: '#8ee8ff',
  dragon: '#6a7bff',
  steel: '#a8b4c4',
  dark: '#5a4a6a',
  fairy: '#ff9ad5',
  flying: '#9ec8ff',
  bug: '#a6c43a',
  poison: '#a85adf',
  normal: '#e8e0d0',
};

const HEAVY_TYPES = new Set(['fire', 'water', 'electric']);
const FRAME_COUNT = 5;
const FRAME_MS = 70;

const frameCache = new Map(); // type -> HTMLImageElement[] | null (null = failed)

export function normalizeBattleAnim(value) {
  if (MODES.has(value)) return value;
  return 'light';
}

export function typeTint(type) {
  return TYPE_TINT[type] || TYPE_TINT.normal;
}

export function effectiveBattleAnim(mode, { reducedMotion = false } = {}) {
  const m = normalizeBattleAnim(mode);
  if (reducedMotion && (m === 'medium' || m === 'heavy')) return 'light';
  if (reducedMotion && m === 'light') return 'light';
  return m;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  } catch {
    return false;
  }
}

function bumpClass(el, className, ms) {
  if (!el) return wait(ms);
  el.classList.remove(className);
  // force reflow
  void el.offsetWidth;
  el.classList.add(className);
  return wait(ms).then(() => {
    el.classList.remove(className);
  });
}

function ensureBurstLayer(defenderEl) {
  if (!defenderEl) return null;
  let layer = defenderEl.querySelector('.fx-burst');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'fx-burst';
    defenderEl.appendChild(layer);
  }
  return layer;
}

function playBurst(defenderEl, type, ms = 320) {
  const layer = ensureBurstLayer(defenderEl);
  if (!layer) return wait(ms);
  layer.style.setProperty('--fx-tint', typeTint(type));
  layer.classList.remove('play');
  void layer.offsetWidth;
  layer.classList.add('play');
  return wait(ms).then(() => layer.classList.remove('play'));
}

function frameUrls(type) {
  const urls = [];
  for (let i = 0; i < FRAME_COUNT; i += 1) {
    urls.push(`assets/fx/${type}/frame_${i}.png`);
  }
  return urls;
}

export async function loadHeavyFrames(type, { loader } = {}) {
  if (!HEAVY_TYPES.has(type)) return null;
  if (frameCache.has(type)) return frameCache.get(type);

  const loadOne = loader || ((url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`fx frame missing: ${url}`));
    img.src = url;
  }));

  try {
    const imgs = [];
    for (const url of frameUrls(type)) {
      imgs.push(await loadOne(url));
    }
    frameCache.set(type, imgs);
    return imgs;
  } catch {
    frameCache.set(type, null);
    return null;
  }
}

/** Test helper: clear cached frame loads. */
export function clearHeavyFrameCache() {
  frameCache.clear();
}

function ensureStrip(defenderEl) {
  if (!defenderEl) return null;
  let strip = defenderEl.querySelector('.fx-strip');
  if (!strip) {
    strip = document.createElement('img');
    strip.className = 'fx-strip';
    strip.alt = '';
    defenderEl.appendChild(strip);
  }
  return strip;
}

async function playHeavyStrip(defenderEl, type) {
  const frames = await loadHeavyFrames(type);
  if (!frames?.length) return false;
  const strip = ensureStrip(defenderEl);
  if (!strip) return false;
  strip.classList.add('show');
  for (const img of frames) {
    strip.src = img.src;
    await wait(FRAME_MS);
  }
  strip.classList.remove('show');
  strip.removeAttribute('src');
  return true;
}

async function playLight(attackerEl, defenderEl, side) {
  const atkClass = side === 'foe' ? 'fx-lunge-left' : 'fx-lunge-right';
  await Promise.all([
    bumpClass(attackerEl, atkClass, 160),
    bumpClass(defenderEl, 'fx-hit', 220),
  ]);
}

/**
 * @param {object} opts
 * @param {'player'|'foe'|'ally'} opts.side who dealt the hit
 * @param {string} opts.moveType
 * @param {Element|null} opts.attackerEl
 * @param {Element|null} opts.defenderEl
 * @param {string} [opts.mode]
 * @param {boolean} [opts.reducedMotion]
 */
export async function playHit({
  side,
  moveType,
  attackerEl,
  defenderEl,
  mode = 'light',
  reducedMotion = prefersReducedMotion(),
} = {}) {
  const m = effectiveBattleAnim(mode, { reducedMotion });
  if (m === 'off') return { played: 'off' };

  // Ally chips: flash chip, then hit/VFX on the battlefield target (no lunge).
  if (side === 'ally' && attackerEl?.classList?.contains('ally-chip')) {
    await bumpClass(attackerEl, 'fx-chip-flash', 140);
    await bumpClass(defenderEl, 'fx-hit', 180);
    if (m === 'light') return { played: 'light-ally' };
    if (m === 'heavy' && HEAVY_TYPES.has(moveType)) {
      const ok = await playHeavyStrip(defenderEl, moveType);
      if (ok) {
        await playBurst(defenderEl, moveType, 200);
        return { played: 'heavy-ally' };
      }
    }
    await playBurst(defenderEl, moveType);
    return { played: m === 'heavy' ? 'medium-fallback-ally' : 'medium-ally' };
  }

  await playLight(attackerEl, defenderEl, side);

  if (m === 'light') return { played: 'light' };

  if (m === 'heavy' && HEAVY_TYPES.has(moveType)) {
    const ok = await playHeavyStrip(defenderEl, moveType);
    if (ok) {
      await playBurst(defenderEl, moveType, 200);
      return { played: 'heavy' };
    }
  }

  await playBurst(defenderEl, moveType);
  return { played: m === 'heavy' ? 'medium-fallback' : 'medium' };
}
