# Twin Towers Command Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 双子塔双打每回合为两只分别选招、按招式标签选目标，并支持主动换人（换人槽本回合不攻击）。

**Architecture:** 纯函数放在 `js/battle-moves.js`（目标解析、战斗状态、功能招、双打 AI 指令）与扩展后的 `js/battle.js`（`resolveDualTurn` / `resolveDualItemTurn` 接收指令数组）。`js/game.js` 仅在 `battle.dual` 下跑指令状态机；1v1/裂隙仍用现有「攻击」按钮。招式 `target` 缺省由 `moveTarget()` 推导。

**Tech Stack:** 原生 ES modules、现有 DOM 战斗 UI、Node 断言测试（`npm test`）

**Spec:** `docs/superpowers/specs/2026-10-21-twin-towers-command-design.md`

---

## File map

| File | Responsibility |
| --- | --- |
| `js/battle-moves.js` | `withBattleState`、`moveTarget`、`speciesMoveList`、`applyMoveEffect`、`resolveMoveTargets`、`chooseDualFoeCmd` |
| `js/battle.js` | `calcDamage` 支持倍率；`resolveDualTurn` / `resolveDualItemTurn` 吃指令 |
| `js/data.js` | 双子塔 8 传说 `moves` + 少数 `target: 'foes'` |
| `index.html` / `css/game.css` | 技能区、换人/返回/重选、目标高亮、提示条 |
| `js/game.js` | 双打指令状态机、目标点击、主动换人、结算接线 |
| `tests/battle-moves.test.js` | 目标/功能招/AI |
| `tests/battle-catch.test.js` | 兼容旧 `resolveDualTurn` 调用；追加指令用例 |
| `package.json` | test 脚本追加 `battle-moves.test.js` |

---

### Task 1: 目标标签与战斗辅助纯函数

**Files:**
- Create: `js/battle-moves.js`
- Create: `tests/battle-moves.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create `tests/battle-moves.test.js`:

```js
import assert from 'node:assert/strict';
import {
  withBattleState,
  speciesMoveList,
  moveTarget,
  applyMoveEffect,
  resolveMoveTargets,
  chooseDualFoeCmd,
} from '../js/battle-moves.js';
import { SPECIES, createPokemon, typeMultiplier } from '../js/data.js';

const mon = withBattleState(createPokemon('zacian', 50));
assert.equal(mon.usedUtility, false);
assert.equal(mon.atkMul, 1);
assert.equal(mon.defMul, 1);

assert.equal(moveTarget({ name: '圣剑', power: 110, type: 'fairy' }), 'foe');
assert.equal(moveTarget({ name: '剑舞', power: 0, type: 'normal', effect: 'atk' }), 'self');
assert.equal(moveTarget({ name: '横扫', power: 80, type: 'flying', target: 'foes' }), 'foes');
assert.equal(moveTarget({ name: '帮助', power: 0, type: 'normal', effect: 'atk', target: 'ally' }), 'ally');

const p0 = withBattleState(createPokemon('zacian', 50));
const p1 = withBattleState(createPokemon('zamazenta', 50));
const f0 = withBattleState(createPokemon('charmander', 10));
const f1 = withBattleState({ ...createPokemon('squirtle', 10), hp: 0 });
const players = [p0, p1];
const foes = [f0, f1];

assert.deepEqual(
  resolveMoveTargets({ side: 'player', index: 0, mon: p0 }, { type: 'move', move: { name: 'x', power: 1, type: 'normal' }, targetSide: 'foe', targetIndex: 1 }, players, foes)
    .map((t) => t.index),
  [0],
  'foe falls back to first living foe when preferred dead',
);

assert.deepEqual(
  resolveMoveTargets({ side: 'player', index: 0, mon: p0 }, { type: 'move', move: { name: 'x', power: 1, type: 'normal', target: 'foes' }, targetSide: 'foe', targetIndex: 0 }, players, foes)
    .map((t) => t.index),
  [0],
);

const healMon = withBattleState({ ...createPokemon('lugia', 50), hp: 10 });
const healed = applyMoveEffect(healMon, { name: '自我再生', power: 0, type: 'normal', effect: 'heal' });
assert.equal(healed.mon.usedUtility, true);
assert.equal(healed.mon.hp, 10 + Math.floor(healed.mon.maxHp * 0.5));
assert.equal(applyMoveEffect(healed.mon, { name: '自我再生', power: 0, type: 'normal', effect: 'heal' }), null);

const kit = [
  { name: '主力', power: 100, type: 'fire' },
  { name: '覆盖', power: 85, type: 'grass' },
  { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
];
const fakeAtk = withBattleState({ ...createPokemon('zacian', 50), speciesId: 'zacian' });
// chooseDualFoeCmd needs SPECIES moves — after Task 4 kit exists; for now stub via patching is avoided:
// Test AI with a mon that has only `move` until kits land — returns primary foe cmd.
const cmd = chooseDualFoeCmd(
  withBattleState(createPokemon('zacian', 200)),
  0,
  [withBattleState(createPokemon('charmander', 50)), withBattleState(createPokemon('squirtle', 50))],
  () => 0.99,
);
assert.equal(cmd.type, 'move');
assert.equal(cmd.targetSide, 'foe');
assert.ok(cmd.move?.name);
assert.equal(typeof cmd.targetIndex, 'number');

assert.equal(speciesMoveList(SPECIES.zacian).length >= 1, true);
```

In `package.json` set:

```json
"test": "node tests/battle-catch.test.js && node tests/battle-moves.test.js"
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

export function moveTarget(move) {
  if (move?.target) return move.target;
  if (move?.effect) return 'self';
  return 'foe';
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

function livingOn(sideArr, sideName) {
  return sideArr
    .map((mon, index) => ({ side: sideName, index, mon }))
    .filter((u) => u.mon && u.mon.hp > 0);
}

/**
 * Resolve concrete targets for a move command at execution time.
 * cmd: { type:'move', move, targetSide, targetIndex }
 */
export function resolveMoveTargets(actor, cmd, players, foes) {
  const move = cmd.move;
  const kind = moveTarget(move);
  const allies = actor.side === 'player' ? players : foes;
  const enemies = actor.side === 'player' ? foes : players;
  const allySide = actor.side;
  const enemySide = actor.side === 'player' ? 'foe' : 'player';

  if (kind === 'self') {
    const self = allies[actor.index];
    return self?.hp > 0 ? [{ side: allySide, index: actor.index, mon: self }] : [];
  }
  if (kind === 'allies') return livingOn(allies, allySide);
  if (kind === 'foes') return livingOn(enemies, enemySide);
  if (kind === 'ally') {
    const list = livingOn(allies, allySide);
    const preferred = list.find((t) => t.index === cmd.targetIndex) || list[0];
    return preferred ? [preferred] : [];
  }
  // foe (default)
  const list = livingOn(enemies, enemySide);
  const preferred = list.find((t) => t.index === cmd.targetIndex) || list[0];
  return preferred ? [preferred] : [];
}

function preferredFoeIndex(attackerIndex, foes, move) {
  const living = foes
    .map((mon, index) => ({ mon, index }))
    .filter((t) => t.mon.hp > 0);
  if (!living.length) return 0;
  const same = living.find((t) => t.index === attackerIndex);
  if (living.length === 1) return living[0].index;
  if (!same) return living[0].index;
  const other = living.find((t) => t.index !== attackerIndex);
  if (!other) return same.index;
  const a = typeMultiplier(move.type, SPECIES[same.mon.speciesId].type);
  const b = typeMultiplier(move.type, SPECIES[other.mon.speciesId].type);
  if (b > a) return other.index;
  return same.index;
}

export function chooseDualFoeCmd(attacker, attackerIndex, players, rng = Math.random) {
  const kit = speciesMoveList(SPECIES[attacker.speciesId]);
  const primary = kit[0];
  const attacks = kit.filter((m) => !m.effect);
  const coverage = attacks[1] || null;
  const heal = kit.find((m) => m.effect === 'heal');
  const buffAtk = kit.find((m) => m.effect === 'atk');
  const buffDef = kit.find((m) => m.effect === 'def');
  const utility = kit.find((m) => m.effect);

  let move = primary;
  if (!attacker.usedUtility && heal && attacker.hp / attacker.maxHp <= 0.4) {
    move = heal;
  } else {
    const prefIdx = preferredFoeIndex(attackerIndex, players, coverage || primary);
    const defender = players[prefIdx];
    if (coverage && defender) {
      const covMult = typeMultiplier(coverage.type, SPECIES[defender.speciesId].type);
      const priMult = typeMultiplier(primary.type, SPECIES[defender.speciesId].type);
      if (covMult > 1 && !(priMult > 1)) move = coverage;
    }
    if (move === primary && !attacker.usedUtility && utility && (buffAtk || buffDef) && rng() < 0.25) {
      const base = SPECIES[attacker.speciesId].base;
      move = buffAtk && buffDef
        ? (base.atk >= base.def ? buffAtk : buffDef)
        : (buffAtk || buffDef);
    } else if (move !== heal) {
      // keep coverage/primary chosen above
    }
  }

  const kind = moveTarget(move);
  if (kind === 'self' || kind === 'ally' || kind === 'allies') {
    return {
      type: 'move',
      move,
      targetSide: 'foe', // unused for self/allies; resolveMoveTargets uses actor side
      targetIndex: attackerIndex,
    };
  }
  const targetIndex = preferredFoeIndex(attackerIndex, players, move);
  return {
    type: 'move',
    move,
    targetSide: 'player',
    targetIndex,
  };
}
```

实现 `chooseDualFoeCmd` 的选招分支时用这一版（先 heal，再克制覆盖，再 25% 强化，否则主力），不要留半成品 `else`：

```js
  let move = primary;
  if (!attacker.usedUtility && heal && attacker.hp / attacker.maxHp <= 0.4) {
    move = heal;
  } else {
    const trial = coverage || primary;
    const prefIdx = preferredFoeIndex(attackerIndex, players, trial);
    const defender = players[prefIdx];
    if (coverage && defender) {
      const covMult = typeMultiplier(coverage.type, SPECIES[defender.speciesId].type);
      const priMult = typeMultiplier(primary.type, SPECIES[defender.speciesId].type);
      if (covMult > 1 && !(priMult > 1)) move = coverage;
    }
    if (move === primary && !attacker.usedUtility && (buffAtk || buffDef) && rng() < 0.25) {
      const base = SPECIES[attacker.speciesId].base;
      move = buffAtk && buffDef
        ? (base.atk >= base.def ? buffAtk : buffDef)
        : (buffAtk || buffDef);
    }
  }
```

- [ ] **Step 4: Run tests**

Run: `node tests/battle-moves.test.js`  
Expected: PASS（若 `SPECIES.zacian` 尚无三招，`speciesMoveList` 长度仍 ≥1）

- [ ] **Step 5: Commit**

```bash
git add js/battle-moves.js tests/battle-moves.test.js package.json
git commit -m "$(cat <<'EOF'
Add dual battle move helpers for targets and foe AI.

EOF
)"
```

---

### Task 2: `resolveDualTurn` / `resolveDualItemTurn` 吃指令

**Files:**
- Modify: `js/battle.js`
- Modify: `tests/battle-moves.test.js`
- Modify: `tests/battle-catch.test.js`（旧调用保持可跑）

- [ ] **Step 1: Append failing dual-command tests**

Append to `tests/battle-moves.test.js`:

```js
import { calcDamage, resolveDualTurn, resolveDualItemTurn } from '../js/battle.js';

const buffAtk = withBattleState({ ...createPokemon('zacian', 40), atkMul: 1.5 });
const plain = withBattleState(createPokemon('zacian', 40));
const dummy = withBattleState(createPokemon('charmander', 40));
const mv = { name: '圣剑', power: 110, type: 'fairy' };
assert.ok(calcDamage(buffAtk, dummy, mv).damage > calcDamage(plain, dummy, mv).damage);

const a = withBattleState(createPokemon('lucario', 80));
const b = withBattleState(createPokemon('garchomp', 80));
const e0 = withBattleState(createPokemon('charmander', 5));
const e1 = withBattleState(createPokemon('squirtle', 5));
const slash = SPECIES.lucario?.move || { name: '波导弹', power: 81, type: 'fighting' };
const claw = SPECIES.garchomp?.move || { name: '龙爪', power: 81, type: 'dragon' };
const dual = resolveDualTurn(
  [a, b],
  [e0, e1],
  () => 0,
  [
    { type: 'move', move: slash, targetSide: 'foe', targetIndex: 1 },
    { type: 'switch' },
  ],
  [
    { type: 'move', move: SPECIES.charmander.move, targetSide: 'player', targetIndex: 0 },
    { type: 'move', move: SPECIES.squirtle.move, targetSide: 'player', targetIndex: 0 },
  ],
);
assert.ok(dual.logs.some((l) => l.side === 'player' && l.actorIndex === 0));
assert.ok(!dual.logs.some((l) => l.side === 'player' && l.actorIndex === 1 && l.damage > 0), 'switch slot does not attack');

const focus = resolveDualTurn(
  [withBattleState(createPokemon('zacian', 100)), withBattleState(createPokemon('zamazenta', 100))],
  [
    withBattleState({ ...createPokemon('charmander', 5), hp: 1 }),
    withBattleState(createPokemon('squirtle', 50)),
  ],
  () => 0,
  [
    { type: 'move', move: { name: '圣剑', power: 110, type: 'fairy' }, targetSide: 'foe', targetIndex: 0 },
    { type: 'move', move: { name: '横扫', power: 40, type: 'flying', target: 'foes' }, targetSide: 'foe', targetIndex: 0 },
  ],
  [null, null],
);
assert.ok(focus.logs.filter((l) => l.side === 'player' && l.actorIndex === 1).length >= 1);

const itemTurn = resolveDualItemTurn(
  [withBattleState(createPokemon('zacian', 50)), withBattleState(createPokemon('zamazenta', 50))],
  [withBattleState(createPokemon('charmander', 20)), withBattleState(createPokemon('squirtle', 20))],
  () => 0,
  [
    { type: 'move', move: SPECIES.charmander.move, targetSide: 'player', targetIndex: 0 },
    { type: 'move', move: SPECIES.squirtle.move, targetSide: 'player', targetIndex: 1 },
  ],
);
assert.ok(itemTurn.logs.every((l) => l.side === 'foe'));
```

- [ ] **Step 2: Run — expect fail**

Run: `node tests/battle-moves.test.js`  
Expected: FAIL — `resolveDualTurn` 忽略指令 / `calcDamage` 无倍率

- [ ] **Step 3: Update `js/battle.js`**

1. Import helpers:

```js
import {
  withBattleState,
  applyMoveEffect,
  resolveMoveTargets,
  moveTarget,
  chooseDualFoeCmd,
  speciesMoveList,
} from './battle-moves.js';
```

2. Update `calcDamage`:

```js
export function calcDamage(attacker, defender, move) {
  const mult = typeMultiplier(move.type, SPECIES[defender.speciesId].type);
  const atkMul = attacker.atkMul ?? 1;
  const defMul = defender.defMul ?? 1;
  const raw = Math.floor(
    (attacker.atk * atkMul * move.power) / Math.max(1, defender.def * defMul) * mult,
  );
  return { damage: Math.max(1, raw), typeMult: mult };
}
```

3. Replace dual resolvers（保留第 3 参 `rng`，第 4/5 为指令；缺省时自动构造同槽主力，兼容旧测试）:

```js
function defaultDualCmds(sideMons, side, opponents, rng) {
  return sideMons.map((mon, index) => {
    if (!mon || mon.hp <= 0) return null;
    if (side === 'foe') return chooseDualFoeCmd(withBattleState(mon), index, opponents, rng);
    const move = speciesMoveList(SPECIES[mon.speciesId])[0];
    return { type: 'move', move, targetSide: 'foe', targetIndex: index };
  });
}

export function resolveDualTurn(players, foes, rng = Math.random, playerCmds, foeCmds) {
  const team = players.map((mon) => withBattleState({ ...mon }));
  const enemy = foes.map((mon) => withBattleState({ ...mon }));
  const logs = [];
  const pCmds = playerCmds || defaultDualCmds(team, 'player', enemy, rng);
  const fCmds = foeCmds || defaultDualCmds(enemy, 'foe', team, rng);

  const livingPlayers = () => team.map((mon, index) => ({ side: 'player', index, mon })).filter((u) => u.mon.hp > 0);
  const livingFoes = () => enemy.map((mon, index) => ({ side: 'foe', index, mon })).filter((u) => u.mon.hp > 0);

  const actors = [...livingPlayers(), ...livingFoes()]
    .filter((a) => {
      const cmd = a.side === 'player' ? pCmds[a.index] : fCmds[a.index];
      return cmd && cmd.type === 'move';
    })
    .sort((a, b) => {
      if (b.mon.spd !== a.mon.spd) return b.mon.spd - a.mon.spd;
      if (a.side !== b.side) return a.side === 'player' ? -1 : 1;
      return a.index - b.index;
    });

  for (const actor of actors) {
    const sideArr = actor.side === 'player' ? team : enemy;
    actor.mon = sideArr[actor.index];
    if (actor.mon.hp <= 0) continue;
    const cmd = actor.side === 'player' ? pCmds[actor.index] : fCmds[actor.index];
    if (!cmd || cmd.type !== 'move') continue;

    if (cmd.move.effect) {
      const applied = applyMoveEffect(actor.mon, cmd.move);
      if (!applied) continue;
      sideArr[actor.index] = applied.mon;
      logs.push({
        ...applied.log,
        side: actor.side,
        actorIndex: actor.index,
        targetIndex: actor.index,
      });
      continue;
    }

    const targets = resolveMoveTargets(actor, cmd, team, enemy);
    if (!targets.length) continue;
    const atkName = SPECIES[actor.mon.speciesId].name;
    const wave = moveTarget(cmd.move) === 'foes' || moveTarget(cmd.move) === 'allies';
    for (const t of targets) {
      const defArr = t.side === 'player' ? team : enemy;
      const { damage, typeMult } = calcDamage(actor.mon, t.mon, cmd.move);
      defArr[t.index].hp = Math.max(0, defArr[t.index].hp - damage);
      const defName = SPECIES[t.mon.speciesId].name;
      logs.push({
        text: `${atkName} 使用了 ${cmd.move.name}！${wave ? '横扫' : '打向'}${defName}，造成 ${damage} 点伤害${typeHint(typeMult)}`,
        damage,
        typeMult,
        moveType: cmd.move.type,
        side: actor.side,
        actorIndex: actor.index,
        targetIndex: t.index,
      });
    }
  }

  const playersUp = livingPlayers().length;
  const foesUp = livingFoes().length;
  let result = 'ongoing';
  if (foesUp <= 0 && playersUp <= 0) result = 'draw';
  else if (foesUp <= 0) result = 'win';
  else if (playersUp <= 0) result = 'lose';
  else if (team.some((mon) => mon.hp <= 0)) result = 'switch';

  return { players: team, foes: enemy, logs, result };
}

export function resolveDualItemTurn(players, foes, rng = Math.random, foeCmds) {
  const team = players.map((mon) => withBattleState({ ...mon }));
  const enemy = foes.map((mon) => withBattleState({ ...mon }));
  const fCmds = foeCmds || defaultDualCmds(enemy, 'foe', team, rng);
  // Reuse: only foe move cmds, same hit loop as above but actors = living foes with move cmds only
  return resolveDualTurn(team, enemy, rng, team.map(() => ({ type: 'switch' })), fCmds);
}
```

Note: `resolveDualItemTurn` via `resolveDualTurn` with all-player `switch` cmds works（玩家不攻击）。若 `result` 因玩家 hp 被打出 `switch` 仍正确。

- [ ] **Step 4: Run**

Run: `node tests/battle-moves.test.js && npm test`  
Expected: PASS。若 `lucario`/`garchomp` 无物种则改用 `zacian`/`zamazenta`。

- [ ] **Step 5: Commit**

```bash
git add js/battle.js tests/battle-moves.test.js tests/battle-catch.test.js
git commit -m "$(cat <<'EOF'
Resolve dual turns from move and switch commands.

EOF
)"
```

---

### Task 3: 双子塔传说三招 + 抽样 `foes`

**Files:**
- Modify: `js/data.js`（8 传说物种）
- Modify: `tests/battle-moves.test.js`（断言 kit / target）

- [ ] **Step 1: Failing assertions**

```js
for (const id of ['zacian', 'zamazenta', 'lugia', 'ho_oh', 'latias', 'latios', 'koraidon', 'miraidon']) {
  const kit = speciesMoveList(SPECIES[id]);
  assert.equal(kit.length, 3, `${id} has 3 moves`);
  assert.equal(moveTarget(kit[0]), 'foe');
  assert.equal(moveTarget(kit[2]), 'self');
}
assert.equal(moveTarget(SPECIES.lugia.moves[1]), 'foes'); // 气旋攻击
assert.equal(moveTarget(SPECIES.miraidon.moves[1]), 'foes'); // 雷霆风暴
assert.equal(SPECIES.zacian.move.name, SPECIES.zacian.moves[0].name);
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Add `moves` on each twin legendary in `js/data.js`**

Keep existing `move` as primary. Add:

```js
// zacian
moves: [
  { name: '圣剑', power: 110, type: 'fairy' },
  { name: '地震', power: 95, type: 'ground' },
  { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
],
// zamazenta
moves: [
  { name: '巨兽斩', power: 105, type: 'fighting' },
  { name: '咬碎', power: 90, type: 'dark' },
  { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
],
// lugia
moves: [
  { name: '空气爆破', power: 100, type: 'flying' },
  { name: '气旋攻击', power: 85, type: 'flying', target: 'foes' },
  { name: '自我再生', power: 0, type: 'normal', effect: 'heal' },
],
// ho_oh
moves: [
  { name: '神圣之火', power: 110, type: 'fire' },
  { name: '日光束', power: 95, type: 'grass' },
  { name: '自我再生', power: 0, type: 'normal', effect: 'heal' },
],
// latias
moves: [
  { name: '薄雾球', power: 95, type: 'psychic' },
  { name: '真气弹', power: 80, type: 'fighting' },
  { name: '治愈波动', power: 0, type: 'normal', effect: 'heal' },
],
// latios
moves: [
  { name: '洁净光芒', power: 100, type: 'dragon' },
  { name: '地震', power: 85, type: 'ground' },
  { name: '冥想', power: 0, type: 'normal', effect: 'atk' },
],
// koraidon
moves: [
  { name: '大愤慨', power: 120, type: 'fighting' },
  { name: '岩崩', power: 105, type: 'rock' },
  { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
],
// miraidon
moves: [
  { name: '电光束', power: 120, type: 'electric' },
  { name: '雷霆风暴', power: 105, type: 'electric', target: 'foes' },
  { name: '充电', power: 0, type: 'normal', effect: 'atk' },
],
```

（洛奇亚覆盖在传说表是「精神强念」；此处第二格改为 `foes` 抽样招「气旋攻击」，与规格「2～4 个 foes」一致。若需严格对齐原表，可把精神强念作第四概念、仍只保留三格并以气旋攻击替换覆盖格。）

- [ ] **Step 4: Run `node tests/battle-moves.test.js && npm test`**

- [ ] **Step 5: Commit**

```bash
git add js/data.js tests/battle-moves.test.js
git commit -m "$(cat <<'EOF'
Add Twin Towers legendary move kits with sample AOE targets.

EOF
)"
```

---

### Task 4: 战斗 UI 壳（技能 / 换人 / 提示 / 高亮）

**Files:**
- Modify: `index.html`
- Modify: `css/game.css`

- [ ] **Step 1: HTML**

Replace attack button row with:

```html
<p id="battle-cmd-hint" class="battle-cmd-hint hidden"></p>
<div class="row-actions">
  <div id="move-buttons" class="move-buttons hidden"></div>
  <button id="btn-attack" type="button" class="primary">攻击</button>
  <button id="btn-switch-cmd" type="button" class="dual-cmd-only hidden">换人</button>
  <button id="btn-cmd-back" type="button" class="dual-cmd-only hidden">返回</button>
  <button id="btn-cmd-undo" type="button" class="dual-cmd-only hidden">重选上一只</button>
  <button id="btn-item" type="button">道具</button>
  <button id="btn-flee-battle" type="button">逃跑</button>
</div>
```

On each `.fighter` keep `data-slot`; ensure clickable class hook: fighters already have `data-slot`.

- [ ] **Step 2: CSS**

```css
.battle-cmd-hint {
  margin: 0 0 8px;
  font-size: 0.95rem;
  opacity: 0.9;
}
.move-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
.move-buttons button {
  text-align: left;
}
.fighter.targetable {
  outline: 2px solid #f5d76e;
  cursor: pointer;
}
.fighter.target-dim {
  opacity: 0.45;
  pointer-events: none;
}
.fighter.cmd-ready::after {
  content: '就绪';
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 12px;
}
.battle-field.dual .fighter.player {
  position: relative;
}
```

- [ ] **Step 3: Manual check** — open `npm start`，进战斗确认按钮出现（逻辑下一步再接线）

- [ ] **Step 4: Commit**

```bash
git add index.html css/game.css
git commit -m "$(cat <<'EOF'
Add dual command-phase battle UI chrome.

EOF
)"
```

---

### Task 5: `game.js` 双打指令状态机

**Files:**
- Modify: `js/game.js`

- [ ] **Step 1: Add imports and dual cmd state**

```js
import {
  withBattleState,
  speciesMoveList,
  moveTarget,
  chooseDualFoeCmd,
} from './battle-moves.js';
```

Near other battle locals:

```js
let dualCmdPhase = null; // null | 'action' | 'target' | 'switch'
let dualCmdSlot = 0;
let dualCmds = []; // length 2
let pendingMove = null;
```

- [ ] **Step 2: Helpers**

```js
function livingDualSlots(side) {
  const arr = side === 'player' ? battle.players : battle.foes;
  return arr.map((mon, index) => ({ mon, index })).filter((x) => x.mon?.hp > 0);
}

function nextDualCmdSlot(from = 0) {
  for (let i = from; i < 2; i += 1) {
    if (battle.players[i]?.hp > 0 && !dualCmds[i]) return i;
  }
  return -1;
}

function setDualCmdChrome({ hint, showMoves, showSwitch, showBack, showUndo, hideAttack }) {
  const hintEl = $('battle-cmd-hint');
  if (hintEl) {
    hintEl.textContent = hint || '';
    hintEl.classList.toggle('hidden', !hint);
  }
  $('btn-attack')?.classList.toggle('hidden', !!hideAttack);
  $('move-buttons')?.classList.toggle('hidden', !showMoves);
  $('btn-switch-cmd')?.classList.toggle('hidden', !showSwitch);
  $('btn-cmd-back')?.classList.toggle('hidden', !showBack);
  $('btn-cmd-undo')?.classList.toggle('hidden', !showUndo);
}

function clearTargetHighlight() {
  document.querySelectorAll('#battle-field .fighter').forEach((el) => {
    el.classList.remove('targetable', 'target-dim');
  });
}

function markReadySlots() {
  document.querySelectorAll('#battle-field .fighter.player').forEach((el) => {
    const slot = Number(el.dataset.slot);
    el.classList.toggle('cmd-ready', !!dualCmds[slot]);
  });
}

function renderDualMoveButtons(mon) {
  const box = $('move-buttons');
  box.innerHTML = '';
  const kit = speciesMoveList(SPECIES[mon.speciesId]);
  for (const move of kit) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const kind = moveTarget(move);
    if (move.effect) {
      btn.textContent = `${move.name} · ${move.effect === 'heal' ? '回复' : move.effect === 'atk' ? '加攻' : '加防'}`;
      btn.disabled = !!mon.usedUtility;
    } else {
      btn.textContent = `${move.name} · ${typeLabel(move.type)} · 威力 ${move.power}${kind === 'foes' ? ' · 全体' : ''}`;
    }
    btn.addEventListener('click', () => onDualPickMove(move));
    box.appendChild(btn);
  }
}

function beginDualCommandPhase() {
  dualCmds = [null, null];
  dualCmdSlot = nextDualCmdSlot(0);
  pendingMove = null;
  clearTargetHighlight();
  if (dualCmdSlot < 0) return;
  enterDualAction(dualCmdSlot);
}

function enterDualAction(slot) {
  dualCmdPhase = 'action';
  dualCmdSlot = slot;
  pendingMove = null;
  clearTargetHighlight();
  const mon = battle.players[slot];
  renderDualMoveButtons(mon);
  const undo = slot > 0 && dualCmds.some(Boolean);
  setDualCmdChrome({
    hint: `请为 ${SPECIES[mon.speciesId].name} 选择行动`,
    showMoves: true,
    showSwitch: true,
    showBack: false,
    showUndo: undo,
    hideAttack: true,
  });
  markReadySlots();
  setBattleActionBusy(false);
}

function legalTargetSlots(kind, actorIndex) {
  if (kind === 'self') return { side: 'player', slots: [actorIndex] };
  if (kind === 'ally' || kind === 'allies') {
    return { side: 'player', slots: livingDualSlots('player').map((x) => x.index) };
  }
  return { side: 'foe', slots: livingDualSlots('foe').map((x) => x.index) };
}

function enterDualTarget(move) {
  const kind = moveTarget(move);
  const { side, slots } = legalTargetSlots(kind, dualCmdSlot);
  if (kind === 'self' || slots.length <= 1) {
    const idx = kind === 'self' ? dualCmdSlot : slots[0];
    commitDualMove(move, side, idx ?? 0);
    return;
  }
  dualCmdPhase = 'target';
  pendingMove = move;
  setDualCmdChrome({
    hint: kind === 'foes' || kind === 'allies' ? '将打击该侧全体 — 点击确认' : '选择目标',
    showMoves: false,
    showSwitch: false,
    showBack: true,
    showUndo: false,
    hideAttack: true,
  });
  document.querySelectorAll(`#battle-field .fighter.${side}`).forEach((el) => {
    const slot = Number(el.dataset.slot);
    const ok = slots.includes(slot);
    el.classList.toggle('targetable', ok);
    el.classList.toggle('target-dim', !ok);
  });
  document.querySelectorAll(`#battle-field .fighter:not(.${side})`).forEach((el) => {
    el.classList.add('target-dim');
  });
}

function commitDualMove(move, targetSide, targetIndex) {
  dualCmds[dualCmdSlot] = { type: 'move', move, targetSide, targetIndex };
  pendingMove = null;
  clearTargetHighlight();
  const next = nextDualCmdSlot(0);
  if (next < 0) {
    void resolveDualCommands();
    return;
  }
  enterDualAction(next);
}

function onDualPickMove(move) {
  if (dualCmdPhase !== 'action' || battleBusy) return;
  enterDualTarget(move);
}

async function resolveDualCommands() {
  dualCmdPhase = null;
  setDualCmdChrome({ hint: '', showMoves: false, showSwitch: false, showBack: false, showUndo: false, hideAttack: true });
  clearTargetHighlight();
  markReadySlots();
  battleBusy = true;
  setBattleActionBusy(true);
  try {
    const startPlayers = battle.players.map((mon) => ({ ...mon }));
    const startFoes = battle.foes.map((mon) => ({ ...mon }));
    const foeCmds = startFoes.map((mon, index) => (
      mon.hp > 0 ? chooseDualFoeCmd(withBattleState(mon), index, startPlayers) : null
    ));
    const turn = resolveDualTurn(startPlayers, startFoes, Math.random, dualCmds, foeCmds);
    await playDualTurnHits(turn);
    finishTurnOutcome(turn);
  } catch (err) {
    console.error(err);
    beginDualCommandPhase();
  }
}
```

- [ ] **Step 3: Wire start / reset / busy**

- In `startDualBattle`, after `renderBattle`, call `battle.players = battle.players.map(withBattleState)`（及 foes），然后 `beginDualCommandPhase()` 替代 `resetAttackButton()` 的纯攻击路径。
- `resetAttackButton`：若 `battle?.dual`，改调 `beginDualCommandPhase()`；否则保持原逻辑。
- `setBattleActionBusy`：同时 disable `#move-buttons button`、`#btn-switch-cmd`、`#btn-cmd-back`、`#btn-cmd-undo`。
- `onAttack`：若 `battle.dual`，仅处理 `continueResolver`；不要再直接 `resolveDualTurn`。
- 非 dual：隐藏 `#move-buttons`、dual-cmd 按钮，显示 `#btn-attack`。

- [ ] **Step 4: Event listeners**

```js
$('btn-cmd-back')?.addEventListener('click', () => {
  if (dualCmdPhase === 'target') enterDualAction(dualCmdSlot);
});
$('btn-cmd-undo')?.addEventListener('click', () => {
  if (dualCmdPhase !== 'action') return;
  const prev = [...dualCmds].map((c, i) => (i < dualCmdSlot ? c : null));
  // clear last committed before current slot
  for (let i = dualCmdSlot - 1; i >= 0; i -= 1) {
    if (dualCmds[i]) {
      dualCmds[i] = null;
      enterDualAction(i);
      return;
    }
  }
});
$('battle-field')?.addEventListener('click', (e) => {
  if (dualCmdPhase !== 'target' || !pendingMove) return;
  const fighter = e.target.closest?.('.fighter.targetable');
  if (!fighter) return;
  const side = fighter.classList.contains('foe') ? 'foe' : 'player';
  commitDualMove(pendingMove, side, Number(fighter.dataset.slot));
});
```

- [ ] **Step 5: Item path**

In `onUseItem`, when `battle.dual` at start：`dualCmds = [null,null]; dualCmdPhase = null;` 然后照旧 `resolveDualItemTurn(..., foeCmdsFromAI)`。

- [ ] **Step 6: Manual + `npm test`**

进双子塔：两只各选招、点目标、结算。  
Run: `npm test`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
Wire Twin Towers dual move and target command phase.

EOF
)"
```

---

### Task 6: 主动换人

**Files:**
- Modify: `js/game.js`

- [ ] **Step 1: Switch command entry**

```js
function onDualSwitchCmd() {
  if (dualCmdPhase !== 'action' || !battle?.dual) return;
  dualCmdPhase = 'switch';
  setDualCmdChrome({
    hint: '选择补位宝可梦',
    showMoves: false,
    showSwitch: false,
    showBack: true,
    showUndo: false,
    hideAttack: true,
  });
  // Reuse pick screen in voluntary mode
  pickMode = 'dual-voluntary';
  switchSlotIndex = dualCmdSlot;
  $('pick-title').textContent = '选择换上场的宝可梦';
  $('btn-cancel-pick').classList.remove('hidden');
  $('btn-cancel-pick').textContent = '返回';
  const onField = new Set(battle.playerUids);
  const party = activeParty(state.party).filter((p) => p.hp > 0 && !onField.has(p.uid));
  renderParty($('pick-party'), true, (mon) => commitDualVoluntarySwitch(mon), party, { onlyConscious: true });
  showScreen('pick');
}
```

- [ ] **Step 2: Commit switch**

```js
function commitDualVoluntarySwitch(mon) {
  const slot = dualCmdSlot;
  const oldUid = battle.playerUids[slot];
  const old = state.party.find((p) => p.uid === oldUid);
  if (old) {
    old.hp = battle.players[slot].hp;
    // do not persist atkMul/usedUtility
  }
  battle.players[slot] = withBattleState({ ...mon });
  battle.playerUids[slot] = mon.uid;
  battle.player = battle.players[0];
  battle.playerUid = battle.playerUids[0];
  dualCmds[slot] = { type: 'switch' };
  appendLog(`${SPECIES[mon.speciesId].name}，交换上场！（本回合不攻击）`);
  showScreen('battle');
  renderBattle();
  const next = nextDualCmdSlot(0);
  if (next < 0) void resolveDualCommands();
  else enterDualAction(next);
}
```

- [ ] **Step 3: Cancel pick**

When `pickMode === 'dual-voluntary'` and cancel：`showScreen('battle'); enterDualAction(dualCmdSlot);`

- [ ] **Step 4: Listener**

`$('btn-switch-cmd').addEventListener('click', onDualSwitchCmd);`

- [ ] **Step 5: Manual check** — 一只换人一只攻击；换上者本回合无攻击日志；下回合可选招

- [ ] **Step 6: Commit**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
Add voluntary dual switch that skips the switcher attack.

EOF
)"
```

---

### Task 7: 收尾与验收对齐

**Files:**
- Modify: `tests/battle-moves.test.js`（若有缺口）
- Modify: `js/game.js` / `css/game.css`（提示与 busy 边角）

- [ ] **Step 1: Checklist against spec**

1. 两只分别选招+目标后结算  
2. `self` / 单目标自动跳过点选  
3. 主动换人当场上场且本回合不攻击  
4. 目标倒下回退；`foes` 打存活全体  
5. 敌方 AI 选招+目标  
6. 强制补位与选抓不变  
7. `npm test` 通过  

- [ ] **Step 2: Fix any gap found in Step 1**（只改与缺口相关的文件）

- [ ] **Step 3: Run full test**

Run: `npm test`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "$(cat <<'EOF'
Polish Twin Towers command phase to match acceptance checks.

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| 指令队列两道再结算 | 5 |
| `target` 五标签 + 缺省 | 1, 3 |
| 点选 / self / 单目标跳过 | 5 |
| 结算回退与全体 | 1, 2 |
| 主动换人不攻击 | 6 |
| 强制换人下回合 | 既有 + 5（`beginDualCommandPhase`） |
| 敌方 AI | 1, 5 |
| 道具清指令 | 5 Step 5 |
| 传说 kit + foes 抽样 | 3 |
| 1v1/裂隙不改操作 | 5（dual 才藏攻击按钮） |
| 验收 / 测试 | 2, 7 |
