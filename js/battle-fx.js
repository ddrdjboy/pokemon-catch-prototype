/**
 * Battle presentation FX (POC). Combat math stays in battle.js.
 * Modes: off | light | medium | heavy
 *
 * Heavy: play species fight-frame strips from
 * `assets/fx/fighters/<speciesId>/frame_0..4.png` when present;
 * otherwise fall back to medium.
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

const FIGHTER_FRAME_COUNT = 5;
const FIGHTER_FRAME_MS = 90;
const FIGHTER_ASSET_VER = 'fighter2';

const fighterCache = new Map(); // speciesId -> HTMLImageElement[] | null

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

function fighterFrameUrls(speciesId) {
  const urls = [];
  for (let i = 0; i < FIGHTER_FRAME_COUNT; i += 1) {
    urls.push(`assets/fx/fighters/${speciesId}/frame_${i}.png`);
  }
  return urls;
}

/**
 * Whether fight frames are available for this species.
 * Unknown ids are optimistic (files exist for the full fighter queue);
 * after a failed load the cache stores null and this returns false.
 */
export function hasFighterFrames(speciesId) {
  if (!speciesId) return false;
  if (!fighterCache.has(speciesId)) return true;
  const cached = fighterCache.get(speciesId);
  return Array.isArray(cached) && cached.length === FIGHTER_FRAME_COUNT;
}

export async function loadFighterFrames(speciesId, { loader } = {}) {
  if (!speciesId) return null;
  if (fighterCache.has(speciesId)) return fighterCache.get(speciesId);

  const loadOne = loader || ((url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`fighter frame missing: ${url}`));
    img.src = `${url}?v=${FIGHTER_ASSET_VER}`;
  }));

  try {
    const imgs = [];
    for (const url of fighterFrameUrls(speciesId)) {
      imgs.push(await loadOne(url));
    }
    fighterCache.set(speciesId, imgs);
    return imgs;
  } catch {
    fighterCache.set(speciesId, null);
    return null;
  }
}

export function clearFighterFrameCache() {
  fighterCache.clear();
}

function mainSpriteImg(wrapEl) {
  if (!wrapEl) return null;
  return wrapEl.querySelector('img:not(.fx-strip)') || null;
}

/**
 * Swap an <img> through fight frames once, then restore the previous src.
 * Used by battle heavy mode and pokedex detail preview.
 */
export async function playFighterFrameStrip(img, speciesId, { frameMs = FIGHTER_FRAME_MS } = {}) {
  const frames = await loadFighterFrames(speciesId);
  if (!frames?.length || !img) return false;

  const prevSrc = img.getAttribute('src') || img.src;
  const prevIdle = img.style.animation;
  img.style.animation = 'none';

  try {
    for (const frame of frames) {
      img.src = frame.src;
      await wait(frameMs);
    }
  } finally {
    img.src = prevSrc;
    img.style.animation = prevIdle;
  }
  return true;
}

/**
 * Swap the attacker's main sprite through fight frames, then restore.
 * Player side flips horizontally so punches/kicks read toward the foe.
 */
export async function playFighterAttack(attackerEl, speciesId, { side = 'player' } = {}) {
  const img = mainSpriteImg(attackerEl);
  if (!img) return false;
  if (side === 'player' || side === 'ally') {
    attackerEl.classList.add('fx-face-right');
  }
  try {
    return await playFighterFrameStrip(img, speciesId);
  } finally {
    attackerEl.classList.remove('fx-face-right');
  }
}

async function playLight(attackerEl, defenderEl, side) {
  const atkClass = side === 'foe' ? 'fx-lunge-left' : 'fx-lunge-right';
  await Promise.all([
    bumpClass(attackerEl, atkClass, 160),
    bumpClass(defenderEl, 'fx-hit', 220),
  ]);
}

export async function playHit({
  side,
  attackerSpeciesId,
  moveType,
  attackerEl,
  defenderEl,
  mode = 'light',
  reducedMotion = prefersReducedMotion(),
} = {}) {
  const m = effectiveBattleAnim(mode, { reducedMotion });
  if (m === 'off') return { played: 'off' };

  if (side === 'ally' && attackerEl?.classList?.contains('ally-chip')) {
    await bumpClass(attackerEl, 'fx-chip-flash', 140);
    await bumpClass(defenderEl, 'fx-hit', 180);
    if (m === 'light') return { played: 'light-ally' };
    await playBurst(defenderEl, moveType);
    return { played: 'medium-ally' };
  }

  if (m === 'heavy' && attackerSpeciesId) {
    const fought = await playFighterAttack(attackerEl, attackerSpeciesId, { side });
    if (fought) {
      await Promise.all([
        bumpClass(defenderEl, 'fx-hit', 220),
        playBurst(defenderEl, moveType, 280),
      ]);
      return { played: 'heavy-fighter' };
    }
  }

  await playLight(attackerEl, defenderEl, side);
  if (m === 'light') return { played: 'light' };

  await playBurst(defenderEl, moveType);
  return { played: m === 'heavy' ? 'medium-fallback' : 'medium' };
}

export async function loadHeavyFrames() {
  return null;
}

export function clearHeavyFrameCache() {
  clearFighterFrameCache();
}
