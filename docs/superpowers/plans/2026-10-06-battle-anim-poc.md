# Battle Animation POC Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Add switchable `off|light|medium|heavy` battle FX with a global header control, without changing combat math.

**Architecture:** New `js/battle-fx.js` plays per-hit timelines; `playTurnHits` awaits it; header cycles `state.battleAnim`; heavy uses `assets/fx/{fire,water,electric}/` frames with fallback to medium.

**Tech Stack:** Vanilla ES modules, CSS animations, optional Image frames, existing `npm test` harness.

---

### Task 1: battle-fx module + unit tests

**Files:**
- Create: `js/battle-fx.js`
- Modify: `tests/battle-catch.test.js` (or create `tests/battle-fx.test.js` + package.json script)

- [ ] Export `normalizeBattleAnim`, `typeTint`, `playHit` (testable pure helpers + async play)
- [ ] Tests: normalize unknowns → light; heavy without frames falls back path; off resolves ASAP
- [ ] `npm test` passes

### Task 2: Wire settings + playTurnHits

**Files:**
- Modify: `js/data.js` bootState `battleAnim: 'light'`
- Modify: `js/game.js` hydrate + header control + await playHit
- Modify: `index.html` button
- Modify: `css/game.css` FX classes / overlay

- [ ] Persist `battleAnim`
- [ ] Header cycles four modes
- [ ] `playTurnHits` awaits FX before HP update timing

### Task 3: Heavy POC frames

**Files:**
- Create: `assets/fx/fire|water|electric/frame_0..N.png`
- Create: `scripts/gen-battle-fx-frames.mjs` (procedural 8bit-ish bursts)

- [ ] Generate 5 frames × 3 types at 96×96 transparent PNG
- [ ] Heavy mode loads and plays strip; missing → medium

### Task 4: Verify + commit

- [ ] `npm test`
- [ ] Manual sanity notes in commit message
- [ ] Commit
