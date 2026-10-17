# Game Audio Design

Date: 2026-10-17  
Status: approved for implementation

## Goal

Play looping background music outside battle, switch to battle BGM during fights (track chosen by encounter type and level gap), and play short attack SFX on each hit keyed by move type groups. Audio must never block gameplay if load or autoplay fails.

## Decisions (from brainstorming)

- Equal level uses the same track as “foe lower or equal”: `cgbgm_b0`.
- Attack SFX are fixed per type bucket (not random), grouped so total files ≤ 10.
- Level comparison uses the **current fighter** vs the **current foe**.
- Architecture: dedicated `js/audio.js` (not inlined into `game.js` / `battle-fx.js`).
- `cgbgm_b3.wav` is unused for now.
- No mute UI, no victory fanfare in this scope.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `js/audio.js` (new) | BGM loop, battle track selection, attack SFX, unlock/preload |
| `js/game.js` | Call audio at explore / battle start / hit / leave battle |
| `js/battle.js` | Unchanged (already emits `moveType` on log lines) |
| `js/battle-fx.js` | Unchanged visually; SFX triggered from `playTurnHits`, not from FX module |
| `assets/sound/bg/` | Explore BGM (existing) |
| `assets/sound/battle/` | Battle BGM (existing) |
| `assets/sound/effect/` | Attack SFX (download ≤ 10 free-licensed clips) |

Combat math stays pure. Audio failures are silent no-ops.

### API (conceptual)

```js
unlockAudio();                    // call on first user gesture
playExploreBgm();                 // non-battle screens
playBattleBgm({ rift, playerLevel, foeLevel });
playAttackSfx(moveType);          // one-shot per hit log line
selectBattleTrack({ rift, playerLevel, foeLevel }); // pure, unit-tested
```

## BGM tracks

| Scene | File |
|-------|------|
| Non-battle (map select, map, pick, catch, shop, etc.) | `assets/sound/bg/v2bgm_ex.wav` |
| Battle, foe level ≤ player level | `assets/sound/battle/cgbgm_b0.wav` |
| Battle, foe level > player level | `assets/sound/battle/cgbgm_b1.wav` |
| Rift / dimensional squad boss (`pendingEncounter.squad`) | `assets/sound/battle/cgbgm_b2.wav` |
| Reserved | `cgbgm_b3.wav` — not used |

Selection priority: if `rift` (squad) → `b2`; else compare levels → `b1` or `b0`.

## Attack SFX mapping

Download ≤ 10 short clips (prefer CC0 / CC-BY from Kenney, Mixkit, or Freesound). Store under `assets/sound/effect/` and note sources in a short `assets/sound/effect/SOURCES.md`.

Proposed 8 keys:

| Key | Covers `moveType` |
|-----|-------------------|
| `fire` | fire |
| `water` | water, ice |
| `electric` | electric |
| `grass` | grass, bug |
| `rock` | rock, steel, ground |
| `psychic` | psychic, ghost, fairy |
| `dragon` | dragon, flying, dark |
| `normal` | fighting, poison, normal, unknown |

Playback: on each damage log line in `playTurnHits`, call `playAttackSfx(line.moveType)` alongside `playHit`. Same key: restart/cut previous instance of that key (avoid stacking noise). SFX volume lower than BGM. Independent of battle-anim mode (`off` still plays SFX).

## Lifecycle / edge cases

| Moment | Behavior |
|--------|----------|
| First meaningful click (map / attack / throw / etc.) | `unlockAudio()` then start explore BGM if not in battle |
| `startBattle()` | Switch to selected battle track, loop |
| Leave battle → explore screens | Switch to explore BGM |
| Mid-battle switch (`freshLog: false`) | Keep current battle track |
| Trainer sends next foe | Re-select track from new foe level vs current fighter |
| Tab hidden | Pause; resume on visible if unlocked |
| Load / autoplay failure | Silent; game continues |

## Testing

- Unit-test `selectBattleTrack` (and type→sfx key mapping) in `tests/` — pure functions, no DOM Audio required.
- Manual smoke: unlock → explore loop → enter low/high/rift battles → hear attack SFX → leave battle → explore again.

## Out of scope

- Mute / volume UI
- Victory / defeat jingles
- Using `cgbgm_b3`
- Footstep or UI click SFX
