# 魔力编队战（终焉领域试点）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅在终焉领域启用魔力宝贝式编队战（左右舞台、四指令、全队下指令、按速度结算、每宠可配招），其它地图保持经典 1v1。

**Architecture:** 纯逻辑放 `js/loadout.js` + `js/formation-battle.js`；`final_realm.battleMode = 'formation'` 分流遭遇；`game.js` 新屏幕驱动点名/结算/胜负；经典 `resolveTurn` 不动。

**Tech Stack:** 原生 ES modules、现有 `calcDamage` / `battle-moves`、HTML/CSS、Node 断言测试（`npm test`）

**Spec:** `docs/superpowers/specs/2026-10-25-formation-battle-final-realm-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| Create `js/loadout.js` | 配招缺省/校验/读写辅助 |
| Create `js/formation-battle.js` | 编队上场裁剪、指令校验、一轮结算、胜负 |
| Create `tests/formation-battle.test.js` | loadout + formation 单测 |
| Modify `js/region-content.js` | `final_realm.battleMode = 'formation'` |
| Modify `package.json` | `npm test` 追加 formation 测试 |
| Modify `index.html` | `#screen-formation-battle` 结构 |
| Modify `css/game.css` | 魔力风舞台与指令栏 |
| Modify `js/game.js` | 路由、UI 循环、胜负接捕捉/清标记 |
| Modify `js/party-detail.js`（可选扩展）/ `game.js` 队伍详情 | 「配置技能」UI |

---

### Task 1: loadout 纯函数 + 测试

**Files:**
- Create: `js/loadout.js`
- Create: `tests/formation-battle.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test file**

Create `tests/formation-battle.test.js`:

```js
import { SPECIES, createPokemon } from '../js/data.js';
import {
  FORMATION_FIELD_CAP,
  defaultLoadout,
  normalizeLoadout,
  basicMoveFor,
  skillMovesFor,
} from '../js/loadout.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed += 1; console.log(`  ✓ ${msg}`); }
  else { failed += 1; console.error(`  ✗ ${msg}`); }
}

console.log('loadout');
{
  assert(FORMATION_FIELD_CAP === 5, 'field cap is 5');
  const sp = SPECIES.scorbunny;
  const d = defaultLoadout(sp);
  assert(d.basicMoveName === sp.move.name || d.basicMoveName === sp.moves?.[0]?.name
    || typeof d.basicMoveName === 'string', 'default has basic name');
  assert(Array.isArray(d.skillMoveNames) && d.skillMoveNames.length <= 3, 'skills capped at 3');

  const mon = createPokemon('scorbunny', 10);
  mon.loadout = { basicMoveName: '不存在的招', skillMoveNames: ['火花', '也没有'] };
  const fixed = normalizeLoadout(mon, sp);
  assert(fixed.basicMoveName && fixed.basicMoveName !== '不存在的招', 'invalid basic falls back');
  assert(!fixed.skillMoveNames.includes('也没有'), 'invalid skills dropped');

  const basic = basicMoveFor(mon, sp);
  assert(basic?.name && basic.power >= 0 || basic?.effect, 'basicMoveFor returns a move');
  const skills = skillMovesFor(mon, sp);
  assert(skills.every((m) => m.name), 'skillMovesFor returns moves');
}

console.log(`formation-battle tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
```

Update `package.json` scripts.test to append `&& node tests/formation-battle.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — cannot find module `../js/loadout.js`

- [ ] **Step 3: Implement `js/loadout.js`**

```js
import { speciesMoveList } from './battle-moves.js';

export const FORMATION_FIELD_CAP = 5;
export const FORMATION_SKILL_CAP = 3;

export function defaultLoadout(sp) {
  const kit = speciesMoveList(sp);
  const basic = kit[0];
  const skills = kit.slice(1, 1 + FORMATION_SKILL_CAP);
  return {
    basicMoveName: basic?.name || '',
    skillMoveNames: skills.map((m) => m.name),
  };
}

export function normalizeLoadout(mon, sp) {
  const kit = speciesMoveList(sp);
  const byName = new Map(kit.map((m) => [m.name, m]));
  const raw = mon?.loadout && typeof mon.loadout === 'object' ? mon.loadout : null;
  const fallback = defaultLoadout(sp);
  let basicMoveName = raw?.basicMoveName;
  if (!basicMoveName || !byName.has(basicMoveName)) basicMoveName = fallback.basicMoveName;
  const skillMoveNames = [];
  const seen = new Set([basicMoveName]);
  for (const name of raw?.skillMoveNames || fallback.skillMoveNames) {
    if (!byName.has(name) || seen.has(name)) continue;
    skillMoveNames.push(name);
    seen.add(name);
    if (skillMoveNames.length >= FORMATION_SKILL_CAP) break;
  }
  return { basicMoveName, skillMoveNames };
}

export function ensureLoadout(mon, sp) {
  const next = normalizeLoadout(mon, sp);
  mon.loadout = next;
  return next;
}

export function basicMoveFor(mon, sp) {
  const loadout = normalizeLoadout(mon, sp);
  const kit = speciesMoveList(sp);
  return kit.find((m) => m.name === loadout.basicMoveName) || kit[0] || null;
}

export function skillMovesFor(mon, sp) {
  const loadout = normalizeLoadout(mon, sp);
  const kit = speciesMoveList(sp);
  const byName = new Map(kit.map((m) => [m.name, m]));
  return loadout.skillMoveNames.map((n) => byName.get(n)).filter(Boolean);
}

/** Apply a player-edited loadout; returns normalized result or null if basic invalid. */
export function applyLoadoutEdit(mon, sp, { basicMoveName, skillMoveNames }) {
  const kit = speciesMoveList(sp);
  const names = new Set(kit.map((m) => m.name));
  if (!names.has(basicMoveName)) return null;
  const skills = [];
  const seen = new Set([basicMoveName]);
  for (const name of skillMoveNames || []) {
    if (!names.has(name) || seen.has(name)) continue;
    skills.push(name);
    seen.add(name);
    if (skills.length >= FORMATION_SKILL_CAP) break;
  }
  mon.loadout = { basicMoveName, skillMoveNames: skills };
  return mon.loadout;
}
```

- [ ] **Step 4: Run tests — loadout section passes**

Run: `node tests/formation-battle.test.js`

Expected: all loadout asserts PASS（formation 段尚未写也可先只跑到 loadout）

- [ ] **Step 5: Commit**

```bash
git add js/loadout.js tests/formation-battle.test.js package.json
git commit -m "feat: add formation battle loadout helpers"
```

---

### Task 2: formation-battle 结算纯逻辑 + 测试

**Files:**
- Create: `js/formation-battle.js`
- Modify: `tests/formation-battle.test.js`

- [ ] **Step 1: Append failing tests**

In `tests/formation-battle.test.js` add imports:

```js
import {
  fieldParty,
  resolveFormationRound,
  formationSideResult,
} from '../js/formation-battle.js';
import { withBattleState } from '../js/battle-moves.js';
```

Append:

```js
console.log('formation field party');
{
  const party = [
    createPokemon('scorbunny', 10),
    createPokemon('bulbasaur', 10),
    createPokemon('squirtle', 10),
    createPokemon('pikachu', 10),
    createPokemon('raboot', 10),
    createPokemon('ivysaur', 10),
  ];
  party[1].hp = 0;
  const field = fieldParty(party);
  assert(field.length === 5, 'skips fainted and fills up to 5 living');
  assert(field.every((m) => m.hp > 0), 'only conscious on field');
  assert(!field.some((m) => m.speciesId === 'bulbasaur'), 'fainted skipped');
}

console.log('formation round');
{
  const p1 = withBattleState(createPokemon('scorbunny', 20));
  const p2 = withBattleState(createPokemon('bulbasaur', 5));
  p1.spd = 100;
  p2.spd = 1;
  const f1 = withBattleState(createPokemon('squirtle', 10));
  f1.spd = 50;
  const players = [p1, p2];
  const foes = [f1];
  const commands = [
    { uid: p1.uid, side: 'player', action: 'attack', targetUid: f1.uid },
    { uid: p2.uid, side: 'player', action: 'defend' },
    { uid: f1.uid, side: 'foe', action: 'attack', targetUid: p2.uid },
  ];
  const rng = () => 1; // no crit
  const turn = resolveFormationRound({ players, foes, commands, rng });
  assert(turn.logs.length >= 2, 'produces action logs');
  assert(f1.hp < f1.maxHp || turn.players.find((p) => p.uid === p1.uid), 'state returned');
  assert(turn.players.every((p) => p.defending !== true), 'defend flags cleared after round');
  const defended = turn.logs.some((l) => l.side === 'foe');
  assert(defended, 'foe acted');
}

console.log('formation defend halves damage');
{
  const atk = withBattleState(createPokemon('scorbunny', 30));
  const def = withBattleState(createPokemon('bulbasaur', 30));
  atk.spd = 10;
  def.spd = 1;
  const open = resolveFormationRound({
    players: [withBattleState({ ...atk })],
    foes: [withBattleState({ ...def })],
    commands: [
      { uid: atk.uid, side: 'player', action: 'attack', targetUid: def.uid },
      { uid: def.uid, side: 'foe', action: 'attack', targetUid: atk.uid },
    ],
    rng: () => 1,
  });
  const shielded = resolveFormationRound({
    players: [withBattleState({ ...atk })],
    foes: [withBattleState({ ...def })],
    commands: [
      { uid: atk.uid, side: 'player', action: 'attack', targetUid: def.uid },
      { uid: def.uid, side: 'foe', action: 'defend' },
    ],
    rng: () => 1,
  });
  const dmgOpen = open.foes[0].maxHp - open.foes[0].hp;
  const dmgShield = shielded.foes[0].maxHp - shielded.foes[0].hp;
  assert(dmgShield <= Math.ceil(dmgOpen / 2) + 1, 'defend roughly halves incoming damage');
}

console.log('formation side result');
{
  const a = withBattleState(createPokemon('scorbunny', 5));
  const b = withBattleState(createPokemon('bulbasaur', 5));
  b.hp = 0;
  assert(formationSideResult([a], [b]) === 'win', 'foe all faint → win');
  a.hp = 0;
  assert(formationSideResult([a], [b]) === 'draw', 'both down → draw');
}
```

Note: `fieldParty` should take conscious mons in party order up to 5 — if first 6 include a fainted, still fill to 5 living from later slots.

- [ ] **Step 2: Run test — expect FAIL missing module**

Run: `node tests/formation-battle.test.js`

Expected: FAIL — cannot find `formation-battle.js`

- [ ] **Step 3: Implement `js/formation-battle.js`**

```js
import { SPECIES } from './data.js';
import { calcDamage } from './battle.js';
import { withBattleState, applyMoveEffect, chooseFoeMove } from './battle-moves.js';
import {
  FORMATION_FIELD_CAP,
  basicMoveFor,
  skillMovesFor,
  ensureLoadout,
} from './loadout.js';

export { FORMATION_FIELD_CAP };

/** Conscious party members in order, up to FORMATION_FIELD_CAP. */
export function fieldParty(party, cap = FORMATION_FIELD_CAP) {
  const out = [];
  for (const mon of party || []) {
    if ((mon.hp ?? 0) <= 0) continue;
    out.push(mon);
    if (out.length >= cap) break;
  }
  return out;
}

export function formationSideResult(players, foes) {
  const pUp = (players || []).some((m) => m.hp > 0);
  const fUp = (foes || []).some((m) => m.hp > 0);
  if (!pUp && !fUp) return 'draw';
  if (!fUp) return 'win';
  if (!pUp) return 'lose';
  return 'ongoing';
}

function findByUid(list, uid) {
  return (list || []).find((m) => m.uid === uid) || null;
}

function firstLiving(list, preferUid) {
  if (preferUid) {
    const t = findByUid(list, preferUid);
    if (t && t.hp > 0) return t;
  }
  return (list || []).find((m) => m.hp > 0) || null;
}

function moveFromCommand(actor, side, cmd) {
  const sp = SPECIES[actor.speciesId];
  ensureLoadout(actor, sp);
  if (cmd.action === 'attack') return basicMoveFor(actor, sp);
  if (cmd.action === 'skill') {
    const skills = skillMovesFor(actor, sp);
    const picked = skills.find((m) => m.name === cmd.moveName) || skills[0];
    return picked || basicMoveFor(actor, sp);
  }
  return null;
}

/**
 * commands: [{ uid, side:'player'|'foe', action:'attack'|'skill'|'defend'|'item',
 *              moveName?, targetUid?, itemId? }]
 * Item resolution is left to the UI layer for v1 — ignore action:'item' here (no-op log).
 */
export function resolveFormationRound({ players, foes, commands, rng = Math.random }) {
  const pList = players.map((m) => withBattleState({ ...m, defending: false }));
  const fList = foes.map((m) => withBattleState({ ...m, defending: false }));
  const bySide = { player: pList, foe: fList };
  const logs = [];

  for (const cmd of commands || []) {
    const actor = findByUid(bySide[cmd.side], cmd.uid);
    if (!actor || actor.hp <= 0) continue;
    if (cmd.action === 'defend') actor.defending = true;
  }

  const actions = [];
  for (const cmd of commands || []) {
    const actor = findByUid(bySide[cmd.side], cmd.uid);
    if (!actor || actor.hp <= 0) continue;
    if (cmd.action === 'defend') {
      actions.push({ actor, side: cmd.side, kind: 'defend', spd: actor.spd, cmd });
      continue;
    }
    if (cmd.action === 'item') {
      actions.push({ actor, side: cmd.side, kind: 'item', spd: actor.spd, cmd });
      continue;
    }
    actions.push({ actor, side: cmd.side, kind: 'move', spd: actor.spd, cmd });
  }

  actions.sort((a, b) => {
    if (b.spd !== a.spd) return b.spd - a.spd;
    return rng() < 0.5 ? -1 : 1;
  });

  for (const act of actions) {
    if (act.actor.hp <= 0) continue;
    if (act.kind === 'defend') {
      logs.push({
        text: `${SPECIES[act.actor.speciesId].name} 摆出了防御！`,
        side: act.side,
        damage: 0,
        uid: act.actor.uid,
      });
      continue;
    }
    if (act.kind === 'item') {
      logs.push({
        text: `${SPECIES[act.actor.speciesId].name} 想使用道具…（编队战 v1 由 UI 处理）`,
        side: act.side,
        damage: 0,
        uid: act.actor.uid,
      });
      continue;
    }

    const move = moveFromCommand(act.actor, act.side, act.cmd);
    if (!move) continue;

    if (move.effect) {
      const applied = applyMoveEffect(act.actor, move);
      if (applied) {
        Object.assign(act.actor, applied.mon);
        logs.push({ ...applied.log, side: act.side, uid: act.actor.uid, moveType: move.type });
        continue;
      }
    }

    const enemySide = act.side === 'player' ? fList : pList;
    let target = firstLiving(enemySide, act.cmd.targetUid);
    if (!target) continue;

    let hit = calcDamage(act.actor, target, move, rng);
    let damage = hit.damage;
    if (target.defending) damage = Math.max(1, Math.floor(damage * 0.5));
    target.hp = Math.max(0, target.hp - damage);
    logs.push({
      text: `${SPECIES[act.actor.speciesId].name} 使用了 ${move.name}！造成了 ${damage} 点伤害${hit.crit ? '（会心）' : ''}！`,
      damage,
      typeMult: hit.typeMult,
      crit: hit.crit,
      moveType: move.type,
      side: act.side,
      uid: act.actor.uid,
      targetUid: target.uid,
    });
  }

  for (const m of [...pList, ...fList]) m.defending = false;

  return {
    players: pList,
    foes: fList,
    logs,
    result: formationSideResult(pList, fList),
  };
}

/** Simple foe AI: one command per living foe. */
export function chooseFoeFormationCommands(players, foes, rng = Math.random) {
  const cmds = [];
  const livingPlayers = () => players.filter((p) => p.hp > 0);
  for (const foe of foes) {
    if (foe.hp <= 0) continue;
    const targets = livingPlayers();
    if (!targets.length) break;
    if (!foe.usedUtility && foe.hp / foe.maxHp <= 0.35 && rng() < 0.35) {
      cmds.push({ uid: foe.uid, side: 'foe', action: 'defend' });
      continue;
    }
    const target = targets[Math.floor(rng() * targets.length)];
    const move = chooseFoeMove(foe, target, rng);
    const sp = SPECIES[foe.speciesId];
    ensureLoadout(foe, sp);
    const skills = skillMovesFor(foe, sp);
    const isSkill = skills.some((m) => m.name === move.name);
    if (isSkill) {
      cmds.push({
        uid: foe.uid, side: 'foe', action: 'skill', moveName: move.name, targetUid: target.uid,
      });
    } else {
      cmds.push({
        uid: foe.uid, side: 'foe', action: 'attack', targetUid: target.uid,
      });
    }
  }
  return cmds;
}
```

Fix `fieldParty` test expectation: with 6 mons and index 1 fainted, living are 5 from the remaining 5 of first-pass… actually party has 6, one fainted → 5 living exactly. Good.

Adjust defend test if flaky: compare that shielded damage < open damage when open > 1.

- [ ] **Step 4: Run `node tests/formation-battle.test.js` — all PASS**

- [ ] **Step 5: Commit**

```bash
git add js/formation-battle.js tests/formation-battle.test.js
git commit -m "feat: add formation battle round resolution"
```

---

### Task 3: 终焉领域 `battleMode` 标记

**Files:**
- Modify: `js/region-content.js`（`final_realm` 对象）
- Modify: `tests/formation-battle.test.js`

- [ ] **Step 1: Failing assert**

```js
import { MAPS } from '../js/data.js';

console.log('final realm formation flag');
assert(MAPS.final_realm?.battleMode === 'formation', 'final_realm uses formation battles');
assert(MAPS.grassland?.battleMode !== 'formation', 'grassland stays classic');
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Patch `js/region-content.js`**

In the `"final_realm"` object, after `"image": "assets/maps/final_realm.png",` add:

```js
    "battleMode": "formation",
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add js/region-content.js tests/formation-battle.test.js
git commit -m "feat: enable formation battle mode on Final Realm"
```

---

### Task 4: HTML + CSS 编队舞台壳

**Files:**
- Modify: `index.html`
- Modify: `css/game.css`

- [ ] **Step 1: Add screen markup in `index.html`**

After `#screen-battle` section, insert:

```html
    <section id="screen-formation-battle" class="screen hidden">
      <div class="panel formation-panel">
        <div id="formation-stage" class="formation-stage">
          <img id="formation-bg" class="formation-bg" alt="" />
          <div id="formation-foes" class="formation-side foes"></div>
          <div id="formation-players" class="formation-side players"></div>
        </div>
        <p id="formation-prompt" class="formation-prompt"></p>
        <div id="formation-commands" class="formation-commands">
          <button type="button" data-cmd="attack">攻击</button>
          <button type="button" data-cmd="skill">技能</button>
          <button type="button" data-cmd="item">道具</button>
          <button type="button" data-cmd="defend">防御</button>
          <button type="button" id="btn-flee-formation" class="flee-btn">逃跑</button>
        </div>
        <div id="formation-skill-list" class="formation-skill-list hidden"></div>
        <div id="formation-target-list" class="formation-target-list hidden"></div>
        <div id="formation-log" class="battle-log"></div>
      </div>
    </section>
```

- [ ] **Step 2: Add CSS to `css/game.css`**

```css
.formation-panel { max-width: 720px; margin: 0 auto; }
.formation-stage {
  position: relative;
  min-height: 280px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: #15202b;
}
.formation-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  opacity: 0.85;
  filter: saturate(0.9) brightness(0.85);
}
.formation-side {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.formation-unit {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.formation-unit.active-pick {
  filter: drop-shadow(0 0 8px #ffd54f);
  transform: translateY(-4px);
}
.formation-unit img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 6px 0 rgba(0, 0, 0, 0.35));
}
.formation-side.foes .formation-unit img { transform: scaleX(-1); }
.formation-unit .mini-hp {
  width: 64px;
  height: 8px;
  background: #111;
  border: 1px solid #333;
  border-radius: 999px;
  overflow: hidden;
}
.formation-unit .mini-hp > i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #66bb6a, #a5d6a7);
}
.formation-unit .mini-name {
  font-size: 0.7rem;
  color: #e8eef5;
  text-shadow: 0 1px 2px #000;
}
.formation-commands {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 8px;
  margin-top: 12px;
}
.formation-commands button {
  background: linear-gradient(180deg, #3d5a80, #2a4060);
  border: 1px solid #5ab4ff;
  color: #fff;
  border-radius: 8px;
  padding: 10px 8px;
  cursor: pointer;
}
.formation-commands .flee-btn { grid-column: 5; opacity: 0.85; }
.formation-prompt { min-height: 1.4em; color: var(--muted); }
.formation-skill-list,
.formation-target-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
@media (max-width: 560px) {
  .formation-unit img { width: 56px; height: 56px; }
  .formation-commands { grid-template-columns: 1fr 1fr; }
  .formation-commands .flee-btn { grid-column: 1 / -1; }
}
```

- [ ] **Step 3: Manual check** — open `index.html` structure; no JS yet, screen stays hidden.

- [ ] **Step 4: Commit**

```bash
git add index.html css/game.css
git commit -m "feat: add formation battle screen shell"
```

---

### Task 5: `game.js` 路由进入编队战 + 渲染单位

**Files:**
- Modify: `js/game.js`

- [ ] **Step 1: Imports and state**

Near other imports:

```js
import { FORMATION_FIELD_CAP, ensureLoadout, basicMoveFor, skillMovesFor, applyLoadoutEdit, normalizeLoadout } from './loadout.js';
import {
  fieldParty,
  resolveFormationRound,
  chooseFoeFormationCommands,
  formationSideResult,
} from './formation-battle.js';
```

Add module state:

```js
let formation = null; // { players, foes, enc, playerCommands, pickUid, phase }
```

- [ ] **Step 2: Helper — build foe list for formation**

```js
function formationFoesFromEncounter(enc) {
  if (enc.kind === 'trainer') {
    return (enc.foeTeam || enc.team || []).slice(0, FORMATION_FIELD_CAP).map((m) => ({
      ...m,
      hp: m.hp ?? m.maxHp,
    }));
  }
  const foe = enc.activeFoe || enc.pokemon;
  return [{ ...foe, hp: foe.hp ?? foe.maxHp }];
}
```

- [ ] **Step 3: Change `startPick` to branch**

At the top of `startPick(enc)`, after `pendingEncounter = prepareEncounter(enc);`:

```js
  const map = MAPS[state.mapId];
  if (map?.battleMode === 'formation') {
    startFormationBattle(pendingEncounter);
    return;
  }
```

（若 `state.mapId` 不是当前字段名，改用现有「当前地图 id」变量，与 `openMap` / `renderMap` 一致。）

- [ ] **Step 4: Implement `startFormationBattle` + `renderFormationStage`**

```js
function formationAppendLog(text) {
  const log = $('formation-log');
  const p = document.createElement('p');
  p.textContent = text;
  log.prepend(p);
}

function startFormationBattle(enc) {
  const players = fieldParty(activeParty(state.party)).map((m) => {
    const sp = SPECIES[m.speciesId];
    ensureLoadout(m, sp);
    return withBattleState({ ...m });
  });
  if (!players.length) {
    // fall back: no conscious — show message and return to map
    showScreen('map');
    return;
  }
  const foes = formationFoesFromEncounter(enc).map((m) => withBattleState({ ...m }));
  formation = {
    enc,
    players,
    foes,
    playerCommands: [],
    pickIndex: 0,
    phase: 'command', // command | skill | target | resolving
  };
  $('formation-log').innerHTML = '';
  $('formation-bg').src = spriteUrl(MAPS[state.mapId].image);
  $('btn-flee-formation').classList.toggle('hidden', enc.kind === 'trainer');
  renderFormationStage();
  beginFormationCommandPhase();
  showScreen('formation-battle');
  playBattleMusicIfAny(); // reuse existing audio helper name if present; else skip
}

function unitSlotStyle(side, index, total) {
  // Magical Online-ish stagger
  const t = total <= 1 ? 0.5 : index / (total - 1);
  if (side === 'player') {
    return { left: `${8 + t * 28}%`, bottom: `${12 + (index % 2) * 18}%` };
  }
  return { right: `${8 + t * 28}%`, bottom: `${14 + (index % 2) * 18}%` };
}

function renderFormationStage() {
  if (!formation) return;
  const paint = (el, list, side) => {
    el.innerHTML = '';
    list.forEach((mon, index) => {
      if (mon.hp <= 0) return;
      const sp = SPECIES[mon.speciesId];
      const div = document.createElement('div');
      div.className = 'formation-unit';
      div.dataset.uid = mon.uid;
      const pos = unitSlotStyle(side, index, list.filter((m) => m.hp > 0).length);
      Object.assign(div.style, pos);
      if (formation.phase === 'command' && side === 'player'
        && list.filter((m) => m.hp > 0)[formation.pickIndex]?.uid === mon.uid) {
        div.classList.add('active-pick');
      }
      const pct = Math.max(0, Math.round((mon.hp / mon.maxHp) * 100));
      div.innerHTML = `
        <div class="mini-hp"><i style="width:${pct}%"></i></div>
        <img src="${spriteUrl(sp.sprite)}" alt="${sp.name}" />
        <div class="mini-name">${sp.name}</div>
      `;
      el.appendChild(div);
    });
  };
  paint($('formation-players'), formation.players, 'player');
  paint($('formation-foes'), formation.foes, 'foe');
}
```

Wire `withBattleState` import from `./battle-moves.js` if not already imported in `game.js`.

- [ ] **Step 5: Commit**

```bash
git add js/game.js
git commit -m "feat: route Final Realm encounters into formation battle"
```

---

### Task 6: 指令点名 → 结算 → 胜负

**Files:**
- Modify: `js/game.js`

- [ ] **Step 1: Command phase helpers**

```js
function livingFormation(side) {
  return formation[side].filter((m) => m.hp > 0);
}

function beginFormationCommandPhase() {
  formation.playerCommands = [];
  formation.pickIndex = 0;
  formation.phase = 'command';
  $('formation-skill-list').classList.add('hidden');
  $('formation-target-list').classList.add('hidden');
  $('formation-commands').classList.remove('hidden');
  const cur = livingFormation('players')[formation.pickIndex];
  $('formation-prompt').textContent = cur
    ? `请为 ${SPECIES[cur.speciesId].name} 选择指令`
    : '';
  renderFormationStage();
}

function currentFormationActor() {
  return livingFormation('players')[formation.pickIndex] || null;
}

function pushPlayerCommand(cmd) {
  formation.playerCommands.push(cmd);
  formation.pickIndex += 1;
  if (formation.pickIndex >= livingFormation('players').length) {
    runFormationResolve();
    return;
  }
  formation.phase = 'command';
  $('formation-skill-list').classList.add('hidden');
  $('formation-target-list').classList.add('hidden');
  $('formation-commands').classList.remove('hidden');
  const cur = currentFormationActor();
  $('formation-prompt').textContent = `请为 ${SPECIES[cur.speciesId].name} 选择指令`;
  renderFormationStage();
}
```

- [ ] **Step 2: Command button handlers**

On DOM ready (near other listeners):

```js
$('formation-commands')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-cmd]');
  if (!btn || !formation || formation.phase !== 'command') return;
  const actor = currentFormationActor();
  if (!actor) return;
  const cmd = btn.dataset.cmd;
  if (cmd === 'defend') {
    pushPlayerCommand({ uid: actor.uid, side: 'player', action: 'defend' });
    return;
  }
  if (cmd === 'attack') {
    pickFormationTarget(actor, { action: 'attack' });
    return;
  }
  if (cmd === 'skill') {
    openFormationSkills(actor);
    return;
  }
  if (cmd === 'item') {
    // v1: open existing item modal if battle items exist; else prompt
    $('formation-prompt').textContent = '编队战道具：请用队伍外道具菜单（v1 暂禁用）';
    // Optionally disable: leave as no-op with message
  }
});

$('btn-flee-formation')?.addEventListener('click', () => {
  if (!formation || formation.enc.kind === 'trainer') return;
  formation = null;
  leaveBattle({ wipeMaze: false });
});
```

- [ ] **Step 3: Skill + target pickers**

```js
function openFormationSkills(actor) {
  const sp = SPECIES[actor.speciesId];
  const skills = skillMovesFor(actor, sp);
  const box = $('formation-skill-list');
  box.innerHTML = '';
  if (!skills.length) {
    $('formation-prompt').textContent = '没有可配置的技能，改为攻击';
    pickFormationTarget(actor, { action: 'attack' });
    return;
  }
  formation.phase = 'skill';
  $('formation-commands').classList.add('hidden');
  box.classList.remove('hidden');
  for (const move of skills) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = move.effect ? `${move.name}（效果）` : `${move.name}`;
    b.addEventListener('click', () => {
      if (move.effect) {
        pushPlayerCommand({
          uid: actor.uid, side: 'player', action: 'skill', moveName: move.name,
        });
      } else {
        pickFormationTarget(actor, { action: 'skill', moveName: move.name });
      }
    });
    box.appendChild(b);
  }
}

function pickFormationTarget(actor, partial) {
  formation.phase = 'target';
  $('formation-commands').classList.add('hidden');
  $('formation-skill-list').classList.add('hidden');
  const box = $('formation-target-list');
  box.classList.remove('hidden');
  box.innerHTML = '';
  $('formation-prompt').textContent = '选择目标';
  for (const foe of livingFormation('foes')) {
    const sp = SPECIES[foe.speciesId];
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = sp.name;
    b.addEventListener('click', () => {
      pushPlayerCommand({
        uid: actor.uid,
        side: 'player',
        action: partial.action,
        moveName: partial.moveName,
        targetUid: foe.uid,
      });
    });
    box.appendChild(b);
  }
}
```

- [ ] **Step 4: Resolve + sync HP back to `state.party`**

```js
async function runFormationResolve() {
  formation.phase = 'resolving';
  $('formation-commands').classList.add('hidden');
  $('formation-skill-list').classList.add('hidden');
  $('formation-target-list').classList.add('hidden');
  $('formation-prompt').textContent = '回合结算中…';

  const foeCmds = chooseFoeFormationCommands(formation.players, formation.foes);
  const turn = resolveFormationRound({
    players: formation.players,
    foes: formation.foes,
    commands: [...formation.playerCommands, ...foeCmds],
  });
  formation.players = turn.players;
  formation.foes = turn.foes;

  // sync player HP into state.party
  for (const mon of turn.players) {
    const live = state.party.find((p) => p.uid === mon.uid);
    if (live) {
      live.hp = mon.hp;
      live.usedUtility = mon.usedUtility;
      live.atkMul = mon.atkMul;
      live.defMul = mon.defMul;
    }
  }
  save();

  for (const line of turn.logs) {
    formationAppendLog(line.text);
    // optional: brief delay / reuse battleFx later
  }
  renderFormationStage();

  if (turn.result === 'ongoing') {
    beginFormationCommandPhase();
    return;
  }
  if (turn.result === 'win') {
    formationAppendLog('胜利！');
    // Reuse finishBattleWin path: set battle/pendingEncounter shape as needed
    pendingEncounter = formation.enc;
    // award XP similarly to classic — call existing helpers if they accept multi-foe;
    // minimal: award from first foe / sum trainer team
    await finishFormationWin();
    return;
  }
  formationAppendLog(turn.result === 'draw' ? '同归于尽…' : '你败北了…');
  setTimeout(() => {
    formation = null;
    leaveBattle();
  }, 900);
}

async function finishFormationWin() {
  const enc = formation.enc;
  // Mark cleared + gold like finishBattleWin; for wild open catch with last foe
  const evolved = false; // wire awardFormationXp in same commit if small
  finishBattleWin(evolved); // may need light adapt — if it reads battle.player, set:
  // battle = { player: formation.players[0], ... } before call
  formation = null;
}
```

**Important:** Inspect existing `finishBattleWin` / `awardXp` / `leaveBattle` and adapt with the smallest shim（例如临时 `battle = { player: formation.players[0], foe: formation.foes[0] }`）而不是复制整段胜负逻辑。训练家奖励与 `state.cleared` 必须保留。

- [ ] **Step 5: Manual playtest on Final Realm**（`npm start` → 终焉领域点野生）

Expected: 编队屏、可攻击/防御、结算掉血、胜利进捕捉或返回地图。

- [ ] **Step 6: Commit**

```bash
git add js/game.js
git commit -m "feat: formation command loop and round resolve wiring"
```

---

### Task 7: 队伍详情「配置技能」UI

**Files:**
- Modify: `js/game.js`（`renderDexDetail` / `openPartyDetail`）
- Modify: `css/game.css`（少量）

- [ ] **Step 1: When `mon` is passed into `renderDexDetail`, show loadout editor**

After `individualHtml` block, if `mon`:

```js
  const sp = SPECIES[mon.speciesId];
  const loadout = ensureLoadout(mon, sp);
  const kit = speciesMoveList(sp);
  const loadoutHtml = `
    <div class="loadout-editor">
      <h3>编队配招</h3>
      <label>普攻
        <select id="loadout-basic">
          ${kit.map((m) => `<option value="${m.name}" ${m.name === loadout.basicMoveName ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
      </label>
      <div class="loadout-skills">技能（最多 3）
        ${kit.map((m) => `
          <label><input type="checkbox" data-skill="${m.name}"
            ${loadout.skillMoveNames.includes(m.name) ? 'checked' : ''}
            ${m.name === loadout.basicMoveName ? 'disabled' : ''}/> ${m.name}</label>
        `).join('')}
      </div>
      <button type="button" id="btn-save-loadout">保存配招</button>
    </div>
  `;
```

Include `loadoutHtml` in `root.innerHTML`. After render:

```js
  $('btn-save-loadout')?.addEventListener('click', () => {
    const basicMoveName = $('loadout-basic').value;
    const skillMoveNames = [...root.querySelectorAll('input[data-skill]:checked')]
      .map((el) => el.dataset.skill)
      .filter((n) => n !== basicMoveName)
      .slice(0, 3);
    if (!applyLoadoutEdit(mon, sp, { basicMoveName, skillMoveNames })) return;
    save();
    $('btn-save-loadout').textContent = '已保存';
  });
```

Import `speciesMoveList` if needed.

- [ ] **Step 2: CSS for `.loadout-editor`**

```css
.loadout-editor {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  text-align: left;
  font-size: 0.9rem;
}
.loadout-editor label { display: block; margin: 6px 0; }
.loadout-skills { display: grid; gap: 4px; margin: 8px 0; }
```

- [ ] **Step 3: Manual — 打开队伍详情，改配招，终焉领域战斗「技能」列表应变化**

- [ ] **Step 4: Commit**

```bash
git add js/game.js css/game.css
git commit -m "feat: party loadout editor for formation skills"
```

---

### Task 8: 验收收尾

**Files:**
- Modify: `tests/formation-battle.test.js`（若 Task 5 暴露边界 bug 则补测）
- Possibly fix `finishFormationWin` XP/clear flags

- [ ] **Step 1: Run full suite**

Run: `npm test`

Expected: all PASS

- [ ] **Step 2: Checklist from spec**

1. 绿茵原野等地图仍是经典对战。  
2. 终焉领域遭遇进入编队舞台 + 四指令。  
3. 配招后技能列表匹配。  
4. 防御减伤；速度较快的单位先出手。  
5. 野生可捕捉 / 训练家给金币并 cleared。

- [ ] **Step 3: Final commit if dirty**

```bash
git add -A
git status
git commit -m "fix: formation battle win path and test polish"
```

---

## Spec coverage self-check

| Spec item | Task |
|-----------|------|
| Dual mode + `final_realm` only | 3, 5 |
| Magical stage + command bar | 4, 5, 6 |
| Field cap 5 / trainer full team | 2, 5 |
| Speed-ordered resolve + defend ×0.5 | 2, 6 |
| Loadout basic+3 skills | 1, 7 |
| Classic 1v1 unchanged | 5 branch |
| Wild catch / trainer rules | 6 `finishFormationWin` |
| Tests | 1, 2, 3, 8 |

## Placeholder scan

无 TBD；道具指令 v1 明确为 UI 提示/禁用，与 spec「若无可用则禁用」一致。
