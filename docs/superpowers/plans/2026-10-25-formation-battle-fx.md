# Formation Battle FX Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Wire formation turns to existing `playHit` / damage numbers / SFX.

**Architecture:** Enrich `resolveFormationTurn` logs with actor/target indexes; tag formation chips with data attributes; rewrite `playFormationTurnHits` like dual playback without destroying chip DOM mid-hit.

**Tech Stack:** Vanilla JS, existing `js/battle-fx.js`, formation UI in `js/game.js`.

---

### Task 1: Log indexes + test

**Files:** `js/battle.js`, `tests/battle-catch.test.js`

- [ ] Assert player/ally logs have `targetIndex`; ally has `allyIndex`; foe logs have `actorIndex` + `target`
- [ ] Fix `resolveFormationTurn` extras accordingly

### Task 2: Chip data attrs + playback

**Files:** `js/game.js`, `css/game.css` (if overflow), `index.html` cache bump

- [ ] `data-foe-index` / `data-ally-index` on chips
- [ ] `formationHitElements` + rewrite `playFormationTurnHits`
- [ ] In-place HP / KO empty slot updates
- [ ] Bump `nether12`
