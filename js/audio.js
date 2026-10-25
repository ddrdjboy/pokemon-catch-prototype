/**
 * Game BGM + attack SFX. Failures are silent; never block gameplay.
 */

const BGM = {
  explore: 'assets/sound/bg/v2bgm_ex.wav',
  b0: 'assets/sound/battle/cgbgm_b0.wav',
  b1: 'assets/sound/battle/cgbgm_b1.wav',
  b2: 'assets/sound/battle/cgbgm_b2.wav',
};

const SFX_KEYS = ['fire', 'water', 'electric', 'grass', 'rock', 'psychic', 'dragon', 'normal'];
const CATCH_SUCCESS_KEY = 'catch_success';

const SFX_BUCKETS = {
  fire: 'fire',
  water: 'water',
  ice: 'water',
  electric: 'electric',
  grass: 'grass',
  bug: 'grass',
  rock: 'rock',
  steel: 'rock',
  ground: 'rock',
  psychic: 'psychic',
  ghost: 'psychic',
  fairy: 'psychic',
  dragon: 'dragon',
  flying: 'dragon',
  dark: 'dragon',
  fighting: 'normal',
  poison: 'normal',
  normal: 'normal',
};

const BGM_VOLUME = 0.45;
const SFX_VOLUME = 0.55;

/** @type {HTMLAudioElement | null} */
let bgmEl = null;
/** @type {Map<string, HTMLAudioElement>} */
const sfxEls = new Map();
let unlocked = false;
let currentBgmKey = null;
let pausedByVisibility = false;
let musicEnabled = true;
let sfxEnabled = true;

export function selectBattleTrack({ rift, boss, playerLevel, foeLevel }) {
  // Rift raids and ghost-nether formation always use the boss battle theme.
  if (rift || boss) return 'b2';
  return foeLevel > playerLevel ? 'b1' : 'b0';
}

export function sfxKeyForMoveType(moveType) {
  return SFX_BUCKETS[moveType] || 'normal';
}

export function battleTrackUrl(track) {
  return BGM[track] || BGM.b0;
}

function canUseAudio() {
  return typeof Audio !== 'undefined';
}

function ensureBgm() {
  if (!canUseAudio()) return null;
  if (!bgmEl) {
    bgmEl = new Audio();
    bgmEl.loop = true;
    bgmEl.preload = 'none';
    bgmEl.volume = BGM_VOLUME;
  }
  return bgmEl;
}

function ensureSfx(key) {
  if (!canUseAudio()) return null;
  let el = sfxEls.get(key);
  if (!el) {
    el = new Audio(`assets/sound/effect/${key}.wav`);
    el.preload = 'none';
    el.volume = SFX_VOLUME;
    sfxEls.set(key, el);
  }
  return el;
}

function safePlay(el) {
  if (!el) return;
  const p = el.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

function setBgmSrc(key, url) {
  const el = ensureBgm();
  if (!el) return;
  if (currentBgmKey === key && !el.paused) return;
  currentBgmKey = key;
  el.src = url;
  el.loop = true;
  el.volume = BGM_VOLUME;
  if (unlocked && musicEnabled) safePlay(el);
  else if (el && !musicEnabled) el.pause();
}

export function setMusicEnabled(on) {
  musicEnabled = !!on;
  const el = ensureBgm();
  if (!el) return;
  if (!musicEnabled) {
    el.pause();
    return;
  }
  if (unlocked && el.src) safePlay(el);
}

export function setSfxEnabled(on) {
  sfxEnabled = !!on;
}

export function isMusicEnabled() {
  return musicEnabled;
}

export function isSfxEnabled() {
  return sfxEnabled;
}

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  // Do not preload BGM/SFX here — load on first real play to avoid
  // contending with first-paint image downloads.
  const el = bgmEl;
  if (el && el.src && musicEnabled) safePlay(el);
}

export function playExploreBgm() {
  setBgmSrc('explore', BGM.explore);
}

export function playBattleBgm({ rift, boss, playerLevel, foeLevel }) {
  const track = selectBattleTrack({ rift, boss, playerLevel, foeLevel });
  setBgmSrc(track, battleTrackUrl(track));
}

function playSfxKey(key) {
  if (!unlocked || !sfxEnabled) return;
  const el = ensureSfx(key);
  if (!el) return;
  try {
    el.currentTime = 0;
  } catch {
    /* ignore seek errors on unloaded media */
  }
  safePlay(el);
}

export function playAttackSfx(moveType) {
  playSfxKey(sfxKeyForMoveType(moveType));
}

/** One-shot when a catch succeeds (“咔哒！抓住了！”). */
export function playCatchSuccessSfx() {
  playSfxKey(CATCH_SUCCESS_KEY);
}

export function pauseBgmForHidden() {
  const el = ensureBgm();
  if (!el || el.paused) return;
  el.pause();
  pausedByVisibility = true;
}

export function resumeBgmIfNeeded() {
  if (!pausedByVisibility || !unlocked || !musicEnabled) return;
  pausedByVisibility = false;
  safePlay(ensureBgm());
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseBgmForHidden();
    else resumeBgmIfNeeded();
  });
}
