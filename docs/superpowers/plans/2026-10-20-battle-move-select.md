# 战斗技能选择 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 战斗底部常驻技能按钮；玩家点招出手；功能招结算；对手简单 AI；覆盖 1v1 / 双打 / 裂隙。

**Architecture:** 纯函数战斗逻辑放在 `js/battle-moves.js`（场上状态、选招 AI、功能招结算）。`js/battle.js` 的结算函数改为接收可选招式参数（缺省时玩家用主力、对手走 AI）。`game.js` 用 `#move-buttons` 替换 `#btn-attack`，双打先收两道指令再结算。

**Tech Stack:** 原生 ES modules、现有 DOM 战斗 UI、Node 断言测试（`npm test`）

**Spec:** `docs/superpowers/specs/2026-10-20-battle-move-select-design.md`

---

### Task 1: 战斗状态、功能招、对手 AI

**Files:**
- Create: `js/battle-moves.js`
- Create: `tests/battle-moves.test.js`
- Modify: `package.json`（test 脚本追加新文件）

- [ ] **Step 1: Write the failing test**

Create `tests/battle-moves.test.js`:

```js
import assert from 'node:assert/strict';
import {
  withBattleState,
  speciesMoveList,
  applyMoveEffect,
  chooseFoeMove,
} from '../js/battle-moves.js';
import { SPECIES, createPokemon, typeMultiplier } from '../js/data.js';

const mon = withBattleState(createPokemon('mega_charizard', 30));
assert.equal(mon.usedUtility, false);
assert.equal(mon.atkMul, 1);
assert.equal(mon.defMul, 1);
assert.equal(withBattleState(mon).atkMul, 1);

assert.equal(speciesMoveList(SPECIES.charmander).length, 1);
assert.equal(speciesMoveList(SPECIES.mega_charizard).length, 3);

const healed = applyMoveEffect(
  withBattleState({ ...createPokemon('mega_venusaur', 30), hp: 10 }),
  { name: '光合作用', power: 0, type: 'normal', effect: 'heal' },
);
assert.equal(healed.mon.usedUtility, true);
assert.equal(healed.mon.hp, 10 + Math.floor(healed.mon.maxHp * 0.5));
assert.match(healed.log.text, /光合作用/);

const danced = applyMoveEffect(
  withBattleState(createPokemon('mega_charizard', 30)),
  { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
);
assert.equal(danced.mon.atkMul, 1.5);
assert.equal(danced.mon.usedUtility, true);

const walled = applyMoveEffect(
  withBattleState(createPokemon('mega_blastoise', 30)),
  { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
);
assert.equal(walled.mon.defMul, 1.5);

const again = applyMoveEffect(danced.mon, { name: '剑舞', power: 0, type: 'normal', effect: 'atk' });
assert.equal(again, null);

const grassFoe = withBattleState(createPokemon('mega_venusaur', 30));
const fireAtk = withBattleState(createPokemon('mega_charizard', 30));
const pickCoverage = chooseFoeMove(fireAtk, grassFoe, () => 0.99);
assert.equal(pickCoverage.name, '爆炸烈焰');

const waterFoe = withBattleState(createPokemon('mega_blastoise', 30));
assert.equal(typeMultiplier('grass', 'water'), 1.5);
assert.equal(typeMultiplier('fire', 'water'), 0.5);
const pickGrass = chooseFoeMove(fireAtk, waterFoe, () => 0.99);
assert.equal(pickGrass.name, '日光束');

const low = withBattleState({ ...createPokemon('mega_venusaur', 30), hp: 1 });
assert.equal(chooseFoeMove(low, fireAtk, () => 0.99).effect, 'heal');

assert.equal(speciesMoveList(SPECIES.charmander)[0].name, chooseFoeMove(
  withBattleState(createPokemon('charmander', 10)),
  withBattleState(createPokemon('squirtle', 10)),
  () => 0,
).name);
```

Append to `package.json` test script:

```json
"test": "node tests/battle-catch.test.js && node tests/final-move-kits.test.js && node tests/battle-moves.test.js"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/battle-moves.test.js`  
Expected: FAIL — cannot find module `../js/battle-moves.js`

- [ ] **Step 3: Implement `js/battle-moves.js`**

```js
import { SPECIES, typeMultiplier } from './data.js';

export function withBattleState(mon) {
  return {
    ...mon,
    usedUtility: mon.usedUtility ?? false,
    atkMul: mon.atkMul ?? 1,
    defMul: mon.defMul ?? 1,
  };
}

export function speciesMoveList(sp) {
  if (sp?.moves?.length) return sp.moves.map((m) => ({ ...m }));
  return sp?.move ? [{ ...sp.move }] : [];
}

export function applyMoveEffect(mon, move) {
  if (!move?.effect) return null;
  if (mon.usedUtility) return null;
  const next = withBattleState({ ...mon });
  let text = '';
  if (move.effect === 'heal') {
    const gained = Math.floor(next.maxHp * 0.5);
    next.hp = Math.min(next.maxHp, next.hp + gained);
    next.usedUtility = true;
    text = `${SPECIES[next.speciesId].name} 使用了 ${move.name}！回复了 ${gained} 点 HP！`;
  } else if (move.effect === 'atk') {
    next.atkMul = 1.5;
    next.usedUtility = true;
    text = `${SPECIES[next.speciesId].name} 使用了 ${move.name}！攻击提升了！`;
  } else if (move.effect === 'def') {
    next.defMul = 1.5;
    next.usedUtility = true;
    text = `${SPECIES[next.speciesId].name} 使用了 ${move.name}！防御提升了！`;
  } else {
    return null;
  }
  return {
    mon: next,
    log: { text, side: null, moveType: move.type, effect: move.effect, damage: 0 },
  };
}

export function chooseFoeMove(attacker, defender, rng = Math.random) {
  const sp = SPECIES[attacker.speciesId];
  const kit = speciesMoveList(sp);
  const primary = kit[0];
  if (kit.length < 2) return primary;

  const attacks = kit.filter((m) => !m.effect);
  const coverage = attacks[1] || null;
  const utility = kit.find((m) => m.effect);
  const heal = kit.find((m) => m.effect === 'heal');
  const buffAtk = kit.find((m) => m.effect === 'atk');
  const buffDef = kit.find((m) => m.effect === 'def');

  if (!attacker.usedUtility && heal && attacker.hp / attacker.maxHp <= 0.4) return heal;

  if (coverage && defender) {
    const covMult = typeMultiplier(coverage.type, SPECIES[defender.speciesId].type);
    const priMult = typeMultiplier(primary.type, SPECIES[defender.speciesId].type);
    if (covMult > 1 && !(priMult > 1)) return coverage;
  }

  if (!attacker.usedUtility && utility && (buffAtk || buffDef) && rng() < 0.25) {
    if (buffAtk && buffDef) {
      const base = sp.base;
      return base.atk >= base.def ? buffAtk : buffDef;
    }
    return buffAtk || buffDef;
  }

  return primary;
}
```

- [ ] **Step 4: Run tests**

Run: `node tests/battle-moves.test.js && npm test`  
Expected: new file passes; full suite still passes (or only unrelated failures).

- [ ] **Step 5: Commit**

```bash
git add js/battle-moves.js tests/battle-moves.test.js package.json
git commit -m "$(cat <<'EOF'
Add battle move helpers for state, utility, and foe AI.

EOF
)"
```

---

### Task 2: 伤害倍率与 1v1 / 敌方单独回合结算

**Files:**
- Modify: `js/battle.js`
- Modify: `tests/battle-moves.test.js`（追加结算用例）
- Modify: existing callers of `calcDamage` / `resolveTurn` / `resolveFoeOnlyTurn` only if signatures require it

- [ ] **Step 1: Extend failing tests**

Append to `tests/battle-moves.test.js`:

```js
import { calcDamage, resolveTurn } from '../js/battle.js';

const atk = withBattleState(createPokemon('mega_charizard', 40));
const def = withBattleState(createPokemon('mega_blastoise', 40));
const move = SPECIES.mega_charizard.moves[0];
const base = calcDamage(atk, def, move, () => 1);
const buffed = calcDamage({ ...atk, atkMul: 1.5 }, def, move, () => 1);
assert.ok(buffed.damage > base.damage);

const p = withBattleState({ ...createPokemon('mega_venusaur', 40), hp: 20 });
const f = withBattleState(createPokemon('scorbunny', 5));
const healMove = SPECIES.mega_venusaur.moves[2];
const turn = resolveTurn(p, f, () => 1, healMove, SPECIES.scorbunny.move);
assert.equal(turn.player.usedUtility, true);
assert.ok(turn.player.hp > 20);
assert.ok(turn.logs.some((l) => l.text.includes('光合作用')));
```

- [ ] **Step 2: Run to verify fail**

Run: `node tests/battle-moves.test.js`  
Expected: FAIL — `resolveTurn` ignores custom move / no mul in damage.

- [ ] **Step 3: Update `calcDamage` and turn resolvers**

In `js/battle.js`:

1. Import `withBattleState`, `applyMoveEffect`, `chooseFoeMove`, `speciesMoveList` from `./battle-moves.js`.

2. Change damage line to:

```js
const atkMul = attacker.atkMul ?? 1;
const defMul = defender.defMul ?? 1;
const raw = Math.floor(
  (attacker.atk * atkMul * move.power) / Math.max(1, defender.def * defMul) * mult * (crit ? CRIT_MULT : 1),
);
```

3. Change signatures (keep `rng` as 3rd arg for compatibility):

```js
export function resolveTurn(player, foe, rng = Math.random, playerMove, foeMove) {
  const logs = [];
  let p = withBattleState({ ...player });
  let f = withBattleState({ ...foe });
  const pMove = playerMove || SPECIES[p.speciesId].move;
  const fMove = foeMove || chooseFoeMove(f, p, rng);
  // ... whoGoesFirst ...
  // For each side: if move.effect then applyMoveEffect and push log with side set;
  // else calcDamage as today. Skip actor if hp<=0.
}
```

Same pattern for `resolveFoeOnlyTurn(player, foe, rng, foeMove)` — foe uses `foeMove || chooseFoeMove(...)`.

Utility log from `applyMoveEffect` has `side: null`; set `side` when pushing.

If `move.effect` and `applyMoveEffect` returns `null` (already used), fall back to primary attack move for that actor.

- [ ] **Step 4: Run `npm test`**

Expected: all pass. Update any battle-catch assertions only if text/order changed for default AI (default foe may now pick coverage — tests that fix rng may need `resolveTurn(p, f, rng, pMove, fMove)` with explicit moves to keep old expectations). Prefer fixing call sites that assume primary-only by passing explicit `SPECIES[id].move` as both moves.

- [ ] **Step 5: Commit**

```bash
git add js/battle.js tests/battle-moves.test.js tests/battle-catch.test.js
git commit -m "$(cat <<'EOF'
Resolve 1v1 turns with chosen moves and stat multipliers.

EOF
)"
```

---

### Task 3: 双打与裂隙结算接招

**Files:**
- Modify: `js/battle.js`
- Modify: `tests/battle-moves.test.js`

- [ ] **Step 1: Tests**

```js
import { resolveDualTurn, resolveSquadTurn } from '../js/battle.js';

const p0 = withBattleState(createPokemon('lucario', 50));
const p1 = withBattleState(createPokemon('garchomp', 50));
const f0 = withBattleState(createPokemon('scorbunny', 10));
const f1 = withBattleState(createPokemon('charmander', 10));
const dual = resolveDualTurn(
  [p0, p1],
  [f0, f1],
  () => 1,
  [SPECIES.lucario.moves[0], SPECIES.garchomp.moves[0]],
  [SPECIES.scorbunny.move, SPECIES.charmander.move],
);
assert.ok(dual.logs.some((l) => l.text.includes('波导弹')));
assert.ok(dual.logs.some((l) => l.text.includes('龙爪')));

const lead = withBattleState(createPokemon('mega_charizard', 100));
const allies = [withBattleState(createPokemon('scorbunny', 20))];
const boss = withBattleState(createPokemon('mega_rayquaza', 50));
const squad = resolveSquadTurn(
  lead,
  allies,
  boss,
  () => 1,
  SPECIES.mega_charizard.moves[0],
  SPECIES.mega_rayquaza.moves[0],
);
assert.ok(squad.logs.some((l) => l.side === 'player' && l.text.includes('爆炸烈焰')));
assert.ok(squad.logs.some((l) => l.side === 'foe' && l.text.includes('飞冲升天')));
```

- [ ] **Step 2: Run — expect fail on new args**

- [ ] **Step 3: Implement**

```js
export function resolveDualTurn(players, foes, rng = Math.random, playerMoves, foeMoves) {
  // copy with withBattleState
  // for each actor in speed order:
  //   move = (side player ? playerMoves?.[index] : foeMoves?.[index])
  //        || (side player ? SPECIES.move : chooseFoeMove(actor, preferredTarget, rng))
  //   if effect: applyMoveEffect; else damage
}

export function resolveSquadTurn(player, allies, foe, rng = Math.random, playerMove, foeMove) {
  // player uses playerMove || SPECIES.move
  // allies use SPECIES.move
  // boss uses foeMove || chooseFoeMove(foe, player, rng)
  // If boss move has effect: apply to boss (no aoe). Else existing single-target cast.
  // Remove filter that skips effect moves when an explicit/AI move is chosen.
}

export function resolveDualItemTurn(players, foes, rng = Math.random, foeMoves) { /* foes AI or list */ }
export function resolveSquadItemTurn(player, allies, foe, rng = Math.random, foeMove) { /* boss AI */ }
```

Keep aoe support if any move still has `aoe` (none in current kits).

- [ ] **Step 4: `npm test` + fix battle-catch rift tests**

Rift tests that assumed random heavy without player move: pass explicit moves or accept AI. Update assertions that required skipping 龙之舞 — boss may now cast it via AI when `rng < 0.25` and not low HP; tests should pass fixed `foeMove` for deterministic cases.

- [ ] **Step 5: Commit**

```bash
git add js/battle.js tests/battle-moves.test.js tests/battle-catch.test.js
git commit -m "$(cat <<'EOF'
Wire chosen moves into dual and squad battle resolution.

EOF
)"
```

---

### Task 4: 战斗 UI 常驻技能按钮

**Files:**
- Modify: `index.html`（`#btn-attack` → `#move-buttons`）
- Modify: `css/game.css`（技能按钮样式）
- Modify: `js/game.js`

- [ ] **Step 1: HTML**

Replace:

```html
<button id="btn-attack" type="button" class="primary">攻击</button>
```

with:

```html
<div id="move-buttons" class="move-buttons"></div>
<p id="move-prompt" class="move-prompt hidden"></p>
```

- [ ] **Step 2: CSS**

```css
.move-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
.move-buttons button {
  flex: 1 1 120px;
  min-height: 44px;
}
.move-buttons button:disabled {
  opacity: 0.45;
}
.move-prompt {
  width: 100%;
  margin: 0 0 6px;
  font-size: 0.9rem;
  opacity: 0.85;
}
```

- [ ] **Step 3: game.js wiring**

1. Import `withBattleState`, `speciesMoveList`, `chooseFoeMove` from `./battle-moves.js`.
2. Replace every `$('btn-attack')` with helpers:

```js
function moveButtonsRoot() { return $('move-buttons'); }

function setBattleActionBusy(busy) {
  moveButtonsRoot()?.querySelectorAll('button').forEach((btn) => { btn.disabled = busy || btn.dataset.locked === '1'; });
  $('btn-item').disabled = busy;
  // ... existing item/flee disables
}

function battleMovesFor(mon) {
  return speciesMoveList(SPECIES[mon.speciesId]);
}

function renderMoveButtons(mon, { dualSlot = null } = {}) {
  const root = moveButtonsRoot();
  const prompt = $('move-prompt');
  root.innerHTML = '';
  if (!mon) { prompt.classList.add('hidden'); return; }
  if (battle?.dual && dualSlot != null) {
    prompt.textContent = `请为 ${SPECIES[mon.speciesId].name} 选择技能`;
    prompt.classList.remove('hidden');
  } else {
    prompt.classList.add('hidden');
  }
  for (const move of battleMovesFor(mon)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary';
    if (move.effect) {
      const label = { heal: '回复', atk: '加攻', def: '加防' }[move.effect];
      btn.textContent = `${move.name} · ${label}`;
      if (mon.usedUtility) { btn.disabled = true; btn.dataset.locked = '1'; }
    } else {
      btn.textContent = `${move.name} · ${typeLabel(move.type)} · 威力 ${move.power}`;
    }
    btn.addEventListener('click', () => onPickMove(move, dualSlot));
    root.appendChild(btn);
  }
}

function ensureBattleStateOnField() {
  if (battle.dual) {
    battle.players = battle.players.map(withBattleState);
    battle.foes = battle.foes.map(withBattleState);
  } else {
    battle.player = withBattleState(battle.player);
    battle.foe = withBattleState(battle.foe);
    if (battle.allies) battle.allies = battle.allies.map(withBattleState);
  }
}
```

3. Call `ensureBattleStateOnField()` + `renderMoveButtons(...)` wherever battle UI is shown / after switch / after turn.

4. Replace `onAttack` with:

```js
let dualMovePicks = [null, null];

async function onPickMove(move, dualSlot) {
  if (continueResolver) { continueResolver(); return; }
  if (!battle || battleBusy) return;
  if (move.effect && (dualSlot != null ? battle.players[dualSlot] : battle.player).usedUtility) return;

  if (battle.dual) {
    const slot = dualSlot ?? dualPickSlot();
    dualMovePicks[slot] = move;
    const next = nextLivingPlayerSlot(slot);
    if (next != null) {
      renderMoveButtons(battle.players[next], { dualSlot: next });
      return;
    }
    await runDualTurnWithPicks(dualMovePicks);
    dualMovePicks = [null, null];
    return;
  }

  battleBusy = true;
  setBattleActionBusy(true);
  try {
    const startPlayer = { ...battle.player };
    const startFoe = { ...battle.foe };
    const foeMove = chooseFoeMove(startFoe, startPlayer);
    if (battle.allies) {
      const startAllies = battle.allies.map((a) => ({ ...a }));
      const bossMove = chooseFoeMove(startFoe, startPlayer);
      const turn = resolveSquadTurn(startPlayer, startAllies, startFoe, Math.random, move, bossMove);
      await playTurnHits(turn, startPlayer, startFoe);
      finishTurnOutcome(turn);
    } else {
      const turn = resolveTurn(startPlayer, startFoe, Math.random, move, foeMove);
      await playTurnHits(turn, startPlayer, startFoe);
      finishTurnOutcome(turn);
    }
  } catch (err) {
    console.error(err);
    renderMoveButtons(battle?.player);
    battleBusy = false;
    setBattleActionBusy(false);
  }
}
```

5. Item turns: when calling `resolveFoeOnlyTurn` / `resolveSquadItemTurn` / `resolveDualItemTurn`, let them pick AI moves via new signatures (defaults OK).

6. Remove `resetAttackButton` continue-mode wiring that toggled `#btn-attack` text; keep continueResolver but re-enable move buttons / show「点击任意技能继续」on prompt if needed. Simplest: on continue wait, disable moves except one ghost path — **keep existing continueResolver pattern**: when waiting, first click on any move button calls `continueResolver()` (same as old attack button). Document in `setBattleActionBusy` / click handler (already first lines of `onPickMove`).

7. Delete dead `#btn-attack` listeners.

- [ ] **Step 4: Manual sanity** — `npm test`; open game, enter battle, confirm 1–3 buttons; use 剑舞 once then disabled; heal raises HP.

- [ ] **Step 5: Commit**

```bash
git add index.html css/game.css js/game.js
git commit -m "$(cat <<'EOF'
Show selectable move buttons in battle.

EOF
)"
```

---

## 不做

- 不改 `TYPE_CHART`、不补初阶技能包
- 不做 PP / 命中 / 异常
- 电脑队友不跑 AI（仍主力）
