# Game Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loop explore/battle BGM with level/rift track selection, and play type-bucket attack SFX on each hit.

**Architecture:** Pure helpers + thin `HTMLAudioElement` wrapper in `js/audio.js`; `game.js` calls unlock / explore / battle / attack at screen and hit boundaries. Spec: `docs/superpowers/specs/2026-10-17-game-audio-design.md`.

**Tech Stack:** Vanilla ES modules, `HTMLAudioElement`, existing `npm test` assert harness.

**Files:**
- Create: `js/audio.js`
- Create: `assets/sound/effect/*.wav` (≤8) + `SOURCES.md`
- Modify: `js/game.js` (wire calls)
- Modify: `index.html` (importmap cache-bust for audio)
- Modify: `tests/battle-catch.test.js` (or append audio section)

---

### Task 1: Pure selection helpers + failing tests

**Files:**
- Create: `js/audio.js` (exports only pure helpers first)
- Modify: `tests/battle-catch.test.js`

- [ ] **Step 1: Write failing tests** for `selectBattleTrack` and `sfxKeyForMoveType`

```js
import { selectBattleTrack, sfxKeyForMoveType } from '../js/audio.js';

console.log('audio tracks');
assert(selectBattleTrack({ rift: true, playerLevel: 100, foeLevel: 200 }) === 'b2', 'rift uses b2');
assert(selectBattleTrack({ rift: false, playerLevel: 10, foeLevel: 5 }) === 'b0', 'lower foe uses b0');
assert(selectBattleTrack({ rift: false, playerLevel: 10, foeLevel: 10 }) === 'b0', 'equal uses b0');
assert(selectBattleTrack({ rift: false, playerLevel: 10, foeLevel: 11 }) === 'b1', 'higher foe uses b1');

assert(sfxKeyForMoveType('fire') === 'fire', 'fire');
assert(sfxKeyForMoveType('ice') === 'water', 'ice→water');
assert(sfxKeyForMoveType('bug') === 'grass', 'bug→grass');
assert(sfxKeyForMoveType('steel') === 'rock', 'steel→rock');
assert(sfxKeyForMoveType('ghost') === 'psychic', 'ghost→psychic');
assert(sfxKeyForMoveType('flying') === 'dragon', 'flying→dragon');
assert(sfxKeyForMoveType('fighting') === 'normal', 'fighting→normal');
assert(sfxKeyForMoveType('unknown') === 'normal', 'unknown→normal');
```

- [ ] **Step 2: Run `npm test`** — expect fail (module missing)

- [ ] **Step 3: Implement pure helpers in `js/audio.js`**

```js
export function selectBattleTrack({ rift, playerLevel, foeLevel }) {
  if (rift) return 'b2';
  return foeLevel > playerLevel ? 'b1' : 'b0';
}

const SFX_BUCKETS = {
  fire: 'fire',
  water: 'water', ice: 'water',
  electric: 'electric',
  grass: 'grass', bug: 'grass',
  rock: 'rock', steel: 'rock', ground: 'rock',
  psychic: 'psychic', ghost: 'psychic', fairy: 'psychic',
  dragon: 'dragon', flying: 'dragon', dark: 'dragon',
  fighting: 'normal', poison: 'normal', normal: 'normal',
};

export function sfxKeyForMoveType(moveType) {
  return SFX_BUCKETS[moveType] || 'normal';
}
```

- [ ] **Step 4: `npm test` passes for these asserts**

- [ ] **Step 5: Commit** `feat: add battle track and sfx type selectors`

---

### Task 2: Audio runtime (BGM + SFX players)

**Files:**
- Modify: `js/audio.js`

- [ ] Add path constants, `unlockAudio`, `playExploreBgm`, `playBattleBgm`, `playAttackSfx`, visibility pause/resume
- [ ] BGM: single looping element; swap `src` on mode change; volume ~0.45
- [ ] SFX: one element per key; `currentTime=0` restart; volume ~0.55
- [ ] All `play()` failures caught and ignored
- [ ] Commit `feat: add HTMLAudio BGM and attack sfx runtime`

---

### Task 3: Download attack SFX assets

**Files:**
- Create: `assets/sound/effect/fire.wav` … `normal.wav` (8 files)
- Create: `assets/sound/effect/SOURCES.md`

- [ ] Download ≤8 free CC0/CC-BY short impact/whoosh clips; rename to keys
- [ ] Document URL + license in `SOURCES.md`
- [ ] Commit assets (with existing `assets/sound/bg` and `battle` if not yet tracked)

---

### Task 4: Wire `game.js`

**Files:**
- Modify: `js/game.js`
- Modify: `index.html` importmap

- [ ] Import audio helpers
- [ ] On first pointer/click: `unlockAudio()` + explore BGM if not on battle screen
- [ ] `startBattle`: `playBattleBgm({ rift: !!allies, playerLevel, foeLevel })` when `freshLog`; on trainer next foe re-select
- [ ] `showScreen` / leave battle paths: `playExploreBgm()` when leaving battle
- [ ] Mid-battle switch (`freshLog: false`): do not change BGM
- [ ] `playTurnHits`: `playAttackSfx(line.moveType)` before/with `playHit`
- [ ] Commit `feat: wire explore/battle BGM and attack sfx into game flow`

---

### Task 5: Verify

- [ ] `npm test` all green
- [ ] Manual note: unlock → explore → low/high/rift → SFX → leave
