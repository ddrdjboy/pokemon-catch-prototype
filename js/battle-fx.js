/**
 * Battle presentation FX (POC). Combat math stays in battle.js.
 * Modes: off | light | medium | heavy
 *
 * Heavy: play species fight-frame strips from
 * `assets/fx/fighters/<speciesId>/frame_0..4.png` when present;
 * otherwise fall back to medium.
 */

import { assetUrl } from './assets.js';

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

const fighterCache = new Map(); // speciesId -> HTMLImageElement[] | null
/** @type {Map<string, Promise<HTMLImageElement[] | null>>} */
const fighterPending = new Map();

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
  if (fighterPending.has(speciesId)) return fighterPending.get(speciesId);

  const loadOne = loader || ((url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`fighter frame missing: ${url}`));
    img.src = assetUrl(url);
  }));

  const pending = (async () => {
    try {
      const imgs = await Promise.all(fighterFrameUrls(speciesId).map((url) => loadOne(url)));
      fighterCache.set(speciesId, imgs);
      return imgs;
    } catch {
      fighterCache.set(speciesId, null);
      return null;
    } finally {
      fighterPending.delete(speciesId);
    }
  })();

  fighterPending.set(speciesId, pending);
  return pending;
}

/** Warm the fighter-frame cache for every unique species id (parallel per species). */
export function preloadFighterFrames(speciesIds, opts) {
  const ids = [...new Set((speciesIds || []).filter(Boolean))];
  return Promise.all(ids.map((id) => loadFighterFrames(id, opts)));
}

export function clearFighterFrameCache() {
  fighterCache.clear();
  fighterPending.clear();
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

const DASH_IN_MS = 240;
const DASH_HOLD_MS = 90;
const DASH_OUT_MS = 200;

/** Ease in-out for arc travel. */
function dashEase(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

/**
 * Animate el along a quadratic bezier from → to with a sideways bulge.
 * Coordinates are CSS translate px relative to the chip's home slot.
 */
function animateArcTranslate(el, fromX, fromY, toX, toY, ms, { bulge = 0, leanDeg = 0 } = {}) {
  return new Promise((resolve) => {
    const vx = toX - fromX;
    const vy = toY - fromY;
    const dist = Math.hypot(vx, vy) || 1;
    const nx = -vy / dist;
    const ny = vx / dist;
    const cx = (fromX + toX) / 2 + nx * bulge;
    const cy = (fromY + toY) / 2 + ny * bulge;
    const t0 = performance.now();
    function frame(now) {
      const u = Math.min(1, (now - t0) / ms);
      const t = dashEase(u);
      const omt = 1 - t;
      // Quadratic bezier: (1-t)^2 P0 + 2(1-t)t Ctrl + t^2 P1
      const x = omt * omt * fromX + 2 * omt * t * cx + t * t * toX;
      const y = omt * omt * fromY + 2 * omt * t * cy + t * t * toY;
      const lean = leanDeg * Math.sin(Math.PI * t);
      el.style.transform = `translate(${x}px, ${y}px) rotate(${lean}deg)`;
      if (u < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

/**
 * Rush attacker to just in front of defender along a slight arc, strike, then arc home.
 * Falls back to in-place lunge when geometry is unavailable.
 */
async function playDashStrike(attackerEl, defenderEl, side, {
  moveType,
  mode = 'light',
  attackerSpeciesId,
  reducedMotion = false,
} = {}) {
  if (!attackerEl || !defenderEl || reducedMotion) {
    await playLight(attackerEl, defenderEl, side);
    if (mode !== 'light') await playBurst(defenderEl, moveType);
    return { played: mode === 'light' ? 'light' : 'medium' };
  }

  const a = attackerEl.getBoundingClientRect();
  const d = defenderEl.getBoundingClientRect();
  if (!(a.width > 0 && d.width > 0)) {
    await playLight(attackerEl, defenderEl, side);
    if (mode !== 'light') await playBurst(defenderEl, moveType);
    return { played: 'light' };
  }

  const aCx = a.left + a.width / 2;
  const aCy = a.top + a.height / 2;
  const dCx = d.left + d.width / 2;
  const dCy = d.top + d.height / 2;
  const fullDx = dCx - aCx;
  const fullDy = dCy - aCy;
  const dist = Math.hypot(fullDx, fullDy) || 1;
  // Stop short of the target center so the attacker stands "in front".
  const stopShort = Math.min(44, Math.max(22, dist * 0.28));
  const dx = fullDx - (fullDx / dist) * stopShort;
  const dy = fullDy - (fullDy / dist) * stopShort;
  // Modest sideways bulge (~18% of travel, capped) for bounce/arc feel.
  const bulge = Math.min(36, Math.max(14, dist * 0.18)) * (side === 'foe' ? -1 : 1);
  const leanDeg = side === 'foe' ? -8 : 8;

  const prevTransition = attackerEl.style.transition;
  const prevTransform = attackerEl.style.transform;
  const prevZ = attackerEl.style.zIndex;
  attackerEl.classList.add('fx-dashing');
  attackerEl.style.zIndex = '24';
  attackerEl.style.transition = 'none';
  void attackerEl.offsetWidth;

  await animateArcTranslate(attackerEl, 0, 0, dx, dy, DASH_IN_MS, { bulge, leanDeg });

  if (mode === 'heavy' && attackerSpeciesId) {
    await playFighterAttack(attackerEl, attackerSpeciesId, { side });
  } else if (side === 'ally' && attackerEl.classList?.contains('ally-chip')) {
    await bumpClass(attackerEl, 'fx-chip-flash', 120);
  }

  await Promise.all([
    bumpClass(defenderEl, 'fx-hit', 220),
    mode === 'light' ? wait(DASH_HOLD_MS) : playBurst(defenderEl, moveType, 280),
  ]);

  // Arc back home with mirrored bulge so the hop reads continuous.
  await animateArcTranslate(attackerEl, dx, dy, 0, 0, DASH_OUT_MS, {
    bulge: -bulge * 0.65,
    leanDeg: -leanDeg * 0.6,
  });

  attackerEl.classList.remove('fx-dashing');
  attackerEl.style.transition = prevTransition;
  attackerEl.style.transform = prevTransform;
  attackerEl.style.zIndex = prevZ;

  if (mode === 'heavy' && attackerSpeciesId) return { played: 'heavy-dash' };
  if (side === 'ally') return { played: mode === 'light' ? 'light-ally-dash' : 'medium-ally-dash' };
  return { played: mode === 'light' ? 'light-dash' : (mode === 'heavy' ? 'medium-fallback' : 'medium-dash') };
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

  // Dash to the target whenever both anchors exist (formation chips, sprites, allies).
  if (attackerEl && defenderEl) {
    return playDashStrike(attackerEl, defenderEl, side, {
      moveType,
      mode: m,
      attackerSpeciesId,
      reducedMotion,
    });
  }

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

const NUM_FLOAT_MS = 720;
const NUM_STILL_MS = 420;

/**
 * Class tokens for a floating combat number.
 * heal wins over damage styling. crit stacks with super/resist.
 */
export function damageNumberVariant({ typeMult = 1, crit = false, heal = false } = {}) {
  if (heal) return 'heal';
  let base = 'normal';
  if (typeMult > 1) base = 'super';
  else if (typeMult < 1) base = 'resist';
  return crit ? `${base} crit` : base;
}

/**
 * Pop a damage or heal number above anchorEl. Does not block the caller.
 * enabled false, missing anchor, or amount <= 0 shows nothing.
 * Reduced motion keeps the number in place, then fades it.
 */
export function playDamageNumber(anchorEl, {
  amount,
  typeMult = 1,
  crit = false,
  heal = false,
  enabled = true,
  reducedMotion = prefersReducedMotion(),
} = {}) {
  const n = Math.floor(Number(amount) || 0);
  if (!enabled || !anchorEl || n <= 0) return false;

  const el = document.createElement('span');
  el.className = `fx-num ${damageNumberVariant({ typeMult, crit, heal })}`;
  if (reducedMotion) el.className += ' still';
  const stack = anchorEl.querySelectorAll('.fx-num').length;
  el.style.setProperty('--fx-num-shift', `${((stack % 3) - 1) * 16}px`);

  const value = document.createElement('span');
  value.className = 'fx-num-value';
  value.textContent = heal ? `+${n}` : String(n);
  el.appendChild(value);
  if (crit && !heal) {
    const tag = document.createElement('span');
    tag.className = 'fx-num-tag';
    tag.textContent = '暴击';
    el.appendChild(tag);
  }

  anchorEl.appendChild(el);
  const remove = () => {
    el.remove();
  };
  el.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, reducedMotion ? NUM_STILL_MS : NUM_FLOAT_MS);
  return true;
}

export async function loadHeavyFrames() {
  return null;
}

export function clearHeavyFrameCache() {
  clearFighterFrameCache();
}
