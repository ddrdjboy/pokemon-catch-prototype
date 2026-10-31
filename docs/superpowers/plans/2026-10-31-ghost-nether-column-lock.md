# 幽灵冥界同列卡位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ghost_nether whole-front-row lock with same-column front/back gating and melee/ranged rules per `docs/superpowers/specs/2026-10-31-ghost-nether-column-lock-design.md`.

**Architecture:** Formation foes gain `col` 0–4 aligned front/back. `legalFormationTargets(foes, { ranged })` opens a back slot only when that column’s front is down (unless `ranged`). Player/ally turns call `moveIsRanged(move)` from `js/move-range.js`. UI still lets you aim any living foe, but marks melee-blocked backs and resolves illegal melee aims via the existing fallback.

**Tech Stack:** Vanilla ES modules, Node test scripts (`npm test`), existing `ghost_nether` / `formation` path on `origin/main`.

**Spec:** `docs/superpowers/specs/2026-10-31-ghost-nether-column-lock-design.md`

---

## File map

| File | Role |
| --- | --- |
| `js/move-range.js` | Name→range table, `moveRange` / `moveIsRanged` (may already exist on local) |
| `js/battle-moves.js` | Stamp `range` in `speciesMoveList` |
| `js/data.js` | `rollEncounter` formation `make()` writes `col`; sync re-rolls if `col` missing |
| `js/battle.js` | Column `legalFormationTargets`; `resolveFormationTurn` uses `moveIsRanged` |
| `js/game.js` | Formation chip legality/toasts use column + melee/ranged |
| `tests/move-range.test.js` | Range table coverage |
| `tests/battle-catch.test.js` | Replace whole-front assertions with column cases |

---

### Task 0: Sync with origin + land move-range

**Files:**
- Keep/create: `js/move-range.js`, `tests/move-range.test.js`
- Modify: `js/battle-moves.js`, `package.json` (test script includes move-range)
- Docs: `docs/superpowers/specs/2026-10-31-ghost-nether-column-lock-design.md` (already on local)

- [ ] **Step 1: Integrate with `origin/main`**

Local may be behind and have an unpushed column-lock spec commit plus uncommitted move-range work. Prefer:

```bash
git stash push -u -m "column-lock WIP"
git fetch origin
git rebase origin/main
# if rebase conflicts on docs only, keep both / ours for the new spec
git stash pop
```

If rebase is painful, `git merge origin/main` is OK. End state: `MAPS.ghost_nether` exists, `legalFormationTargets` / `resolveFormationTurn` exist, and move-range files are present.

- [ ] **Step 2: Ensure move-range is committed on this branch**

If `js/move-range.js` is missing after sync, recreate from the approved table (火焰牙 melee；真空波 / 龙之怒 ranged；`pierce` → ranged). Wire:

```js
// js/battle-moves.js
import { moveRange } from './move-range.js';

function withMoveRange(move) {
  const next = { ...move };
  const range = moveRange(next);
  if (range) next.range = range;
  return next;
}

export function speciesMoveList(sp) {
  if (sp?.moves?.length) return sp.moves.map(withMoveRange);
  return sp?.move ? [withMoveRange(sp.move)] : [];
}
```

`package.json` test script must end with `&& node tests/move-range.test.js`.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: PASS (including move-range). Formation tests still use old whole-front rules until Task 2.

- [ ] **Step 4: Commit if needed**

```bash
git add js/move-range.js tests/move-range.test.js js/battle-moves.js package.json docs/superpowers/specs/2026-10-31-ghost-nether-column-lock-design.md
git commit -m "$(cat <<'EOF'
feat: classify moves as melee or ranged for formation lock

EOF
)"
```

---

### Task 1: Assign `col` on formation foes

**Files:**
- Modify: `js/data.js` (`rollEncounter` formation branch; `syncEncounters` ready check)
- Test: `tests/battle-catch.test.js`

- [ ] **Step 1: Write failing asserts** (in the existing ghost_nether / formation block)

```js
const formation = rollEncounter(MAPS.ghost_nether.encounters[0], { hasCharm: false, bossChance: 0 });
assert(formation.foes.every((f) => Number.isInteger(f.col) && f.col >= 0 && f.col <= 4), 'each foe has col 0-4');
const byCol = (row, col) => formation.foes.find((f) => f.row === row && f.col === col);
assert(byCol('front', 2) && byCol('back', 2), 'col2 has front and back');
assert(byCol('front', 0).speciesId !== byCol('back', 2).speciesId || true, 'slots populated');
// front[i] and back[i] share col i
for (let i = 0; i < 5; i += 1) {
  assert(byCol('front', i).col === i && byCol('back', i).col === i, `aligned col ${i}`);
}
```

- [ ] **Step 2: Run test — expect FAIL** (`col` undefined)

```bash
node tests/battle-catch.test.js
```

- [ ] **Step 3: Implement `col` in `rollEncounter`**

In `js/data.js` formation branch, change `make` / maps to:

```js
const make = (slot, row, col) => {
  const isBoss = !!slot.boss;
  const mon = createPokemon(slot.speciesId, slot.level, {
    shiny: isBoss,
    boss: isBoss,
  });
  return { ...mon, row, col };
};
const front = tmpl.front.map((s, i) => make(s, 'front', i));
const back = tmpl.back.map((s, i) => make(s, 'back', i));
```

In `syncEncounters` formation `ready` check, also require:

```js
&& prev.foes.every((f) => Number.isInteger(f.col))
```

so old saves without `col` re-roll.

- [ ] **Step 4: Run tests — expect PASS for new asserts**

```bash
node tests/battle-catch.test.js
```

- [ ] **Step 5: Commit**

```bash
git add js/data.js tests/battle-catch.test.js
git commit -m "$(cat <<'EOF'
feat(nether): assign formation foe column indices

EOF
)"
```

---

### Task 2: Column `legalFormationTargets` + formation resolve

**Files:**
- Modify: `js/battle.js`
- Test: `tests/battle-catch.test.js`

- [ ] **Step 1: Replace old lock asserts with column cases**

Remove / rewrite the block that currently looks like:

```js
const legalFront = legalFormationTargets(formFoes, { pierce: false });
assert(legalFront.length === 5 && legalFront.every((f) => f.row === 'front'), 'default lock front only');
const legalPierce = legalFormationTargets(formFoes, { pierce: true });
assert(legalPierce.length === 10, 'pierce can lock all');
formFoes.filter((f) => f.row === 'front').forEach((f) => { f.hp = 0; });
assert(legalFormationTargets(formFoes, { pierce: false }).every((f) => f.row === 'back'), 'back opens after front clear');
```

With:

```js
import { moveIsRanged } from '../js/move-range.js';
// (or rely on battle.js re-export if you add one — prefer importing move-range in the test)

const formFoes = formation.foes.map((f) => ({ ...f }));
const meleeLegal = legalFormationTargets(formFoes, { ranged: false });
assert(meleeLegal.length === 5 && meleeLegal.every((f) => f.row === 'front'), 'melee: only fronts while all fronts up');
assert(legalFormationTargets(formFoes, { ranged: true }).length === 10, 'ranged locks all living');

const col2Front = formFoes.find((f) => f.row === 'front' && f.col === 2);
col2Front.hp = 0;
const after = legalFormationTargets(formFoes, { ranged: false });
assert(after.some((f) => f.row === 'back' && f.col === 2), 'melee can lock back col2 after front down');
assert(!after.some((f) => f.row === 'back' && f.col === 1), 'other back cols still blocked');

// pierce / range:'ranged' treated as ranged
assert(
  legalFormationTargets(formFoes, { ranged: moveIsRanged({ name: '穿影袭', pierce: true }) }).length
    === formFoes.filter((f) => f.hp > 0).length,
  'pierce counts as ranged',
);
```

Also add a resolve smoke that a melee playerMove aimed at a blocked back falls back to a legal target (optional but recommended):

```js
const blockedBack = formation.foes.findIndex((f) => f.row === 'back' && f.col === 0);
const turn = resolveFormationTurn(
  createPokemon('growlithe', 100), // 咬住 = melee
  createGhostNetherAllies(() => 0).slice(0, 4),
  formation.foes.map((f) => ({ ...f })),
  {
    rng: () => 0,
    playerTargetIndex: blockedBack,
    playerMove: { name: '咬住', power: 45, type: 'dark' },
  },
);
const playerHit = turn.logs.find((l) => l.side === 'player' && l.damage > 0);
assert(playerHit, 'player still attacks');
assert(turn.foes[blockedBack].hp === formation.foes[blockedBack].hp, 'blocked back not damaged by melee');
```

Adjust species/helpers to whatever the test file already imports (`createGhostNetherAllies` if exported).

- [ ] **Step 2: Run — expect FAIL** (API still `pierce`, whole-front logic)

```bash
node tests/battle-catch.test.js
```

- [ ] **Step 3: Implement new lock + resolve wiring**

```js
// js/battle.js
import { moveIsRanged } from './move-range.js';

/** Living foes the attacker may lock. Ranged ignores column gate. */
export function legalFormationTargets(foes, { ranged = false } = {}) {
  const living = foes.filter((f) => f.hp > 0);
  if (ranged) return living;
  const frontUpByCol = new Set(
    living.filter((f) => f.row === 'front').map((f) => f.col),
  );
  return living.filter((f) => {
    if (f.row === 'front') return true;
    return !frontUpByCol.has(f.col);
  });
}
```

In `resolveFormationTurn`, replace pierce gate with:

```js
const ranged = moveIsRanged(move);
const targets = legalFormationTargets(enemy, { ranged });
if (!targets.length) break;
let chosen;
if (actor.side === 'player' && playerTargetIndex >= 0 && enemy[playerTargetIndex]?.hp > 0) {
  const want = enemy[playerTargetIndex];
  if (targets.includes(want)) {
    chosen = want;
  } else {
    const sameCol = targets.find((t) => t.col === want.col) || null;
    chosen = sameCol || pickLowestHp(targets);
  }
} else {
  chosen = pickLowestHp(targets);
}
```

Keep `pierce` callers compiling: if any external code still passes `{ pierce }`, accept both during transition:

```js
export function legalFormationTargets(foes, opts = {}) {
  const ranged = opts.ranged ?? !!opts.pierce;
  // ...
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/battle.js tests/battle-catch.test.js
git commit -m "$(cat <<'EOF'
feat(nether): same-column formation lock for melee

EOF
)"
```

---

### Task 3: Formation UI — column gate + copy

**Files:**
- Modify: `js/game.js` (`ensureFormationTarget`, `renderFormationField` click / selected / toast)
- Optional CSS: `css/game.css` (`.formation-chip.melee-blocked`)

- [ ] **Step 1: Helper for current aim mode**

Near other formation helpers:

```js
import { moveIsRanged, moveRange } from './move-range.js';

function formationMeleeLegal() {
  return legalFormationTargets(battle.foes, { ranged: false });
}

function formationLiving() {
  return legalFormationTargets(battle.foes, { ranged: true });
}
```

- [ ] **Step 2: Update `ensureFormationTarget`**

```js
function ensureFormationTarget() {
  if (!battle?.formation || !battle.foes) return;
  const legal = formationMeleeLegal();
  const living = formationLiving();
  if (!living.length) {
    battle.selectedTarget = -1;
    return;
  }
  const cur = battle.foes[battle.selectedTarget];
  // Keep aim even on melee-blocked back (ranged can still hit); only fix dead/missing.
  if (cur && cur.hp > 0) return;
  const prefer = legal[0] || living[0];
  battle.selectedTarget = battle.foes.indexOf(prefer);
}
```

- [ ] **Step 3: Update chip render + click**

Replace whole-front `frontUp` gating:

```js
const meleeOk = new Set(formationMeleeLegal());

// selected: allow highlighting any living selected chip
const selected = index === battle.selectedTarget && mon.hp > 0;

chip.className = [
  'formation-chip',
  mon.boss ? 'boss' : '',
  selected ? 'selected' : '',
  mon.hp > 0 && !meleeOk.has(mon) ? 'melee-blocked' : '',
].filter(Boolean).join(' ');

chip.addEventListener('click', () => {
  if (mon.hp <= 0) return;
  if (!meleeOk.has(mon)) {
    showAppToast('同列前排挡住后排（近战不可选；远程可穿）');
  }
  battle.selectedTarget = index;
  battle.foe = battle.foes[index];
  renderFormationField();
});
```

In `onPickMove` formation branch, before resolve (defense in depth):

```js
if (battle.formation) {
  const legal = legalFormationTargets(battle.foes, { ranged: moveIsRanged(move) });
  const cur = battle.foes[battle.selectedTarget];
  if (!cur || !legal.includes(cur)) {
    const prefer = legal.find((t) => t.col === cur?.col) || legal[0];
    battle.selectedTarget = prefer ? battle.foes.indexOf(prefer) : -1;
  }
  const turn = resolveFormationTurn(/* ... */);
  // ...
}
```

- [ ] **Step 4: Optional CSS**

```css
.formation-chip.melee-blocked {
  opacity: 0.55;
}
```

- [ ] **Step 5: Manual smoke** (after `npm test`)

1. Enter 幽灵冥界 → 近战瞄准：后排半透；点后排有 toast，但仍可选中。  
2. 打死某一列前排 → 该列后排不再 `melee-blocked`。  
3. 选远程招（如水枪/穿影袭）打仍被挡的后排 → 能掉血。  
4. 选近战招瞄被挡后排 → 实际打到合法目标（前排或已开列）。

- [ ] **Step 6: Commit**

```bash
git add js/game.js css/game.css
git commit -m "$(cat <<'EOF'
feat(nether): formation UI for column melee gate

EOF
)"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full suite**

```bash
npm test
```

Expected: all suites PASS.

- [ ] **Step 2: Spec checklist**

Confirm against `2026-10-31-ghost-nether-column-lock-design.md` 验收 1–5.

- [ ] **Step 3: Commit plan doc if not already tracked**

```bash
git add docs/superpowers/plans/2026-10-31-ghost-nether-column-lock.md
git commit -m "$(cat <<'EOF'
docs: add ghost nether column-lock implementation plan

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| `col` 0–4 aligned | Task 1 |
| Melee: front always; back iff same-col front down | Task 2 |
| Ranged / pierce ignore gate | Task 2 (+ move-range Task 0) |
| Resolve fallback same-col then lowest HP | Task 2 |
| UI dim / toast / ranged can aim blocked | Task 3 |
| Only formation / ghost_nether | All tasks (no dual/1v1 changes) |
| No player front/back / swap | Not in plan |
| Tests rewrite whole-front cases | Task 2 |
| `npm test` | Task 4 |
