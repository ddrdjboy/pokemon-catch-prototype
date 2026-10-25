# 幽灵冥界 Formation Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add endgame map「幽灵冥界」(`ghost_nether`) with a map-only `formation` battle: 1 player + 4 random AI allies vs 10 foes in two rows (3 remake bosses + 7 minions), Magical-Fantasy targeting + full speed queue, gated by 冥界符.

**Architecture:** Mirror twin-towers / rift: content + gate in `js/data.js`; pure combat in `resolveFormationTurn` + `legalFormationTargets` in `js/battle.js`; orchestration/UI only on the `ghost_nether` path in `js/game.js`. Do **not** wire `formation` into normal / squad / dual maps.

**Tech Stack:** Vanilla ES modules, existing `calcDamage` / `createPokemon` / catch loop, Node `npm test` (`tests/battle-catch.test.js`).

**Spec:** `docs/superpowers/specs/2026-10-25-ghost-nether-design.md`

---

## File map

| File | Role |
|------|------|
| `js/data.js` | 3 Boss species, NETHER_* constants, map, seal spend, ally pool, `rollEncounter` / `syncEncounters` for `formation` |
| `js/battle.js` | `legalFormationTargets`, `resolveFormationTurn` |
| `js/game.js` | Gate, shop, header, pick-1, start/render formation battle, target click, sequential boss catch |
| `index.html` | `#nether-seal-display`, `#foe-formation` container, cache bumps |
| `css/game.css` | `.map-card.nether`, two-row foe grid, 4-ally row, formation field |
| `assets/maps/ghost_nether.png` | Map art |
| `assets/pokemon/remake_darkrai.png` etc. | 3 Boss sprites (copy/adapt placeholders OK for first green) |
| `tests/battle-catch.test.js` | Map count 22, seal gate, formation rules |

---

### Task 1: Failing tests for seal gate + map + species stubs

**Files:**
- Modify: `tests/battle-catch.test.js`
- Modify: `js/data.js` (minimal stubs only if needed so imports resolve — prefer fail-first on missing exports)

- [ ] **Step 1: Append ghost-nether assertions after the twin towers block**

After the twin towers section in `tests/battle-catch.test.js`, add imports at top:

```js
import {
  // ...existing...
  createGhostNetherAllies,
  trySpendNetherSeal,
  NETHER_UNLOCK_LEVEL, NETHER_UNLOCK_COUNT, NETHER_SEAL_COST, NETHER_SEAL, NETHER_BOSS_LEVEL,
} from '../js/data.js';
import { legalFormationTargets, resolveFormationTurn } from '../js/battle.js';
```

Update map count:

```js
assert(Object.keys(MAPS).length === 22, '22 maps total');
```

(Change the existing `=== 21` assertion; keep `>= 9` as-is.)

Append:

```js
console.log('ghost nether');
assert(MAPS.ghost_nether?.nether && MAPS.ghost_nether.encounters.length === 1, 'ghost nether single fight');
assert(NETHER_SEAL.price === 5000 && NETHER_SEAL_COST === 1 && NETHER_UNLOCK_COUNT === 2, 'nether seal shop and gate');
assert(NETHER_UNLOCK_LEVEL === 100 && NETHER_BOSS_LEVEL === 200, 'nether unlock and boss level');
for (const id of ['remake_darkrai', 'remake_cresselia', 'remake_lunala']) {
  assert(SPECIES[id]?.name?.startsWith('改·') && SPECIES[id].sprite, `${id} remake species`);
}
const netherGate = { netherSeals: 1 };
assert(trySpendNetherSeal(netherGate, [{ level: 101 }]).reason === 'level', 'one over-100 cannot enter nether');
assert(trySpendNetherSeal({ netherSeals: 0 }, [{ level: 101 }, { level: 102 }]).reason === 'seal', 'needs nether seal');
assert(trySpendNetherSeal(netherGate, [{ level: 101 }, { level: 102 }]).ok && netherGate.netherSeals === 0, 'seal opens ghost nether');
const formation = rollEncounter(MAPS.ghost_nether.encounters[0], { hasCharm: false, bossChance: 0 });
assert(formation.formation && formation.foes.length === 10, 'formation rolls 10 foes');
assert(formation.foes.filter((f) => f.row === 'front').length === 5, '5 front');
assert(formation.foes.filter((f) => f.row === 'back').length === 5, '5 back');
assert(formation.foes.filter((f) => f.boss).length === 3, '3 bosses');
const allies4 = createGhostNetherAllies(() => 0.1);
assert(allies4.length === 4 && new Set(allies4.map((a) => a.speciesId)).size === 4, '4 distinct allies');
```

- [ ] **Step 2: Run tests — expect FAIL on missing exports / map count**

Run: `npm test`

Expected: FAIL (e.g. `trySpendNetherSeal is not defined` or map count 21 !== 22).

- [ ] **Step 3: Commit test scaffolding only**

```bash
git add tests/battle-catch.test.js
git commit -m "test: scaffold ghost nether gate and formation assertions"
```

---

### Task 2: Species, seal, map, roll/sync in `data.js`

**Files:**
- Modify: `js/data.js`
- Create: `assets/pokemon/remake_darkrai.png`, `remake_cresselia.png`, `remake_lunala.png` (copy any existing legendary PNG as placeholder if art not ready)
- Create: `assets/maps/ghost_nether.png` (copy `assets/maps/twin_towers.png` or `gloom_yard` as placeholder)

- [ ] **Step 1: Add three Boss species inside `BASE_SPECIES` (before closing `};`)**

```js
  remake_darkrai: {
    id: 'remake_darkrai',
    name: '改·达克莱伊',
    type: 'dark',
    base: { hp: 90, atk: 130, def: 90, spd: 125 },
    move: { name: '暗黑洞', power: 100, type: 'dark' },
    moves: [
      { name: '暗黑洞', power: 100, type: 'dark' },
      { name: '穿影袭', power: 85, type: 'ghost', pierce: true },
      { name: '噩梦缠绕', power: 70, type: 'dark' },
    ],
    catchRate: 0.04,
    sprite: 'assets/pokemon/remake_darkrai.png',
    eyeOffset: { x: 0, y: -8 },
  },
  remake_cresselia: {
    id: 'remake_cresselia',
    name: '改·克雷色利亚',
    type: 'psychic',
    base: { hp: 120, atk: 85, def: 130, spd: 95 },
    move: { name: '新月舞', power: 40, type: 'psychic' },
    moves: [
      { name: '新月舞', power: 40, type: 'psychic' },
      { name: '月光守护', power: 1, type: 'psychic' },
      { name: '幻影光线', power: 90, type: 'psychic' },
    ],
    catchRate: 0.05,
    sprite: 'assets/pokemon/remake_cresselia.png',
    eyeOffset: { x: 0, y: -8 },
  },
  remake_lunala: {
    id: 'remake_lunala',
    name: '改·露奈雅拉',
    type: 'ghost',
    base: { hp: 140, atk: 115, def: 110, spd: 105 },
    move: { name: '暗影之光', power: 110, type: 'ghost' },
    moves: [
      { name: '暗影之光', power: 110, type: 'ghost' },
      { name: '冥门横扫', power: 55, type: 'ghost', aoe: true },
      { name: '满月冲击', power: 120, type: 'psychic' },
    ],
    catchRate: 0.04,
    sprite: 'assets/pokemon/remake_lunala.png',
    eyeOffset: { x: 0, y: -6 },
  },
```

Note: `月光守护` healing can be ignored in v1 combat (treat as weak hit) unless Task 3 adds heal; YAGNI — keep as low-power move for now.

- [ ] **Step 2: Add constants + map after `TWIN_MAP`**

```js
export const NETHER_UNLOCK_LEVEL = 100;
export const NETHER_UNLOCK_COUNT = 2;
export const NETHER_SEAL_COST = 1;
export const NETHER_BOSS_LEVEL = 200;
export const NETHER_FRONT_LEVEL = 160;
export const NETHER_BACK_MINION_LEVEL = 180;
export const NETHER_SEAL = {
  id: 'netherSeal',
  name: '冥界符',
  price: 5000,
};

/** Front 5 + back 2 minions (existing ghost/dark species). */
export const GHOST_NETHER_MINIONS = {
  front: [
    { speciesId: 'misdreavus' },
    { speciesId: 'sableye' },
    { speciesId: 'shuppet' },
    { speciesId: 'duskull' },
    { speciesId: 'murkrow' },
  ],
  back: [
    { speciesId: 'haunter' },
    { speciesId: 'gengar' },
  ],
};

export const GHOST_NETHER_BOSSES = [
  { speciesId: 'remake_darkrai' },
  { speciesId: 'remake_lunala' },
  { speciesId: 'remake_cresselia' },
];

export const GHOST_NETHER_ALLIES = [
  { speciesId: 'mega_salamence', level: 100 },
  { speciesId: 'mega_dragonite', level: 100 },
  { speciesId: 'garchomp', level: 100 },
  { speciesId: 'mega_charizard', level: 100 },
  { speciesId: 'mega_gengar', level: 100 },
  { speciesId: 'latios', level: 100 },
  { speciesId: 'zacian', level: 100 },
  { speciesId: 'miraidon', level: 100 },
];

const GHOST_NETHER_MAP = {
  id: 'ghost_nether',
  name: '幽灵冥界',
  image: 'assets/maps/ghost_nether.png',
  bossChance: 0,
  nether: true,
  encounters: [
    {
      id: 'triad',
      kind: 'wild',
      formation: true,
      x: 50,
      y: 48,
      front: GHOST_NETHER_MINIONS.front.map((s) => ({ ...s, level: NETHER_FRONT_LEVEL })),
      back: [
        { ...GHOST_NETHER_MINIONS.back[0], level: NETHER_BACK_MINION_LEVEL },
        { ...GHOST_NETHER_BOSSES[0], level: NETHER_BOSS_LEVEL, boss: true },
        { ...GHOST_NETHER_BOSSES[1], level: NETHER_BOSS_LEVEL, boss: true },
        { ...GHOST_NETHER_BOSSES[2], level: NETHER_BOSS_LEVEL, boss: true },
        { ...GHOST_NETHER_MINIONS.back[1], level: NETHER_BACK_MINION_LEVEL },
      ],
    },
  ],
};
```

Register in `MAPS`:

```js
export const MAPS = {
  ...BASE_MAPS,
  ...GENERATED_MAPS,
  ...REGION_MAPS,
  rift: RIFT_MAP,
  twin_towers: TWIN_MAP,
  ghost_nether: GHOST_NETHER_MAP,
};
```

- [ ] **Step 3: Add spend + ally helpers next to `trySpendTwinKey`**

```js
export function trySpendNetherSeal(state, party) {
  if (partyOverLevelCount(party, NETHER_UNLOCK_LEVEL) < NETHER_UNLOCK_COUNT) {
    return { ok: false, reason: 'level' };
  }
  const owned = state.netherSeals || 0;
  if (owned < NETHER_SEAL_COST) return { ok: false, reason: 'seal' };
  state.netherSeals = owned - NETHER_SEAL_COST;
  return { ok: true };
}

/** Pick 4 distinct allies from the pool (deterministic with injected rng). */
export function createGhostNetherAllies(rng = Math.random) {
  const pool = [...GHOST_NETHER_ALLIES];
  const picked = [];
  while (picked.length < 4 && pool.length) {
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    const [slot] = pool.splice(i, 1);
    picked.push(createPokemon(slot.speciesId, slot.level));
  }
  return picked;
}
```

- [ ] **Step 4: Extend `rollEncounter` — handle `formation` before `dual`**

```js
  if (tmpl.formation && tmpl.front && tmpl.back) {
    const make = (slot, row) => {
      const isBoss = !!slot.boss;
      const mon = createPokemon(slot.speciesId, slot.level, {
        shiny: isBoss,
        boss: isBoss,
      });
      return { ...mon, row };
    };
    const front = tmpl.front.map((s) => make(s, 'front'));
    const back = tmpl.back.map((s) => make(s, 'back'));
    const foes = [...front, ...back];
    const lead = foes.find((f) => f.boss) || foes[0];
    return {
      ...tmpl,
      formation: true,
      shiny: true,
      boss: true,
      speciesId: lead.speciesId,
      foes,
      pokemon: lead,
    };
  }
```

- [ ] **Step 5: Extend `syncEncounters` — ready check for formation**

Inside the `map.encounters.map` callback, before `tmpl.dual`:

```js
      if (tmpl.formation) {
        const ready = prev?.formation
          && prev.foes?.length === 10
          && prev.foes.filter((f) => f.boss).length === 3;
        return ready ? prev : roll(map, tmpl);
      }
```

- [ ] **Step 6: Placeholder assets**

```bash
cp assets/maps/twin_towers.png assets/maps/ghost_nether.png
cp assets/pokemon/latios.png assets/pokemon/remake_darkrai.png
cp assets/pokemon/latias.png assets/pokemon/remake_cresselia.png
cp assets/pokemon/lugia.png assets/pokemon/remake_lunala.png
```

- [ ] **Step 7: Run gate/map tests**

Run: `npm test`

Expected: gate/map/species/ally asserts PASS; formation combat asserts may still FAIL if Task 3 not done — if `legalFormationTargets` import fails, comment those imports until Task 3, OR add stub exports that throw. Prefer implementing Task 3 next in same session if imports already added.

- [ ] **Step 8: Commit**

```bash
git add js/data.js assets/maps/ghost_nether.png assets/pokemon/remake_*.png tests/battle-catch.test.js
git commit -m "feat: add ghost nether map data, seal gate, and remake bosses"
```

---

### Task 3: `legalFormationTargets` + `resolveFormationTurn` (TDD)

**Files:**
- Modify: `js/battle.js`
- Modify: `tests/battle-catch.test.js`

- [ ] **Step 1: Add combat assertions to the ghost nether test block**

```js
const formFoes = formation.foes.map((f) => ({ ...f }));
const legalFront = legalFormationTargets(formFoes, { pierce: false });
assert(legalFront.length === 5 && legalFront.every((f) => f.row === 'front'), 'default lock front only');
const legalPierce = legalFormationTargets(formFoes, { pierce: true });
assert(legalPierce.length === 10, 'pierce can lock all');
formFoes.filter((f) => f.row === 'front').forEach((f) => { f.hp = 0; });
assert(legalFormationTargets(formFoes, { pierce: false }).every((f) => f.row === 'back'), 'back opens after front clear');

const formPlayer = createPokemon('mega_charizard', 140);
const formAllies = createGhostNetherAllies(() => 0.2);
const formTurn = resolveFormationTurn(formPlayer, formAllies, formation.foes.map((f) => ({ ...f })), {
  rng: () => 0,
  playerTargetIndex: formation.foes.findIndex((f) => f.row === 'front'),
});
assert(formTurn.logs.length >= 5, 'player+allies+foes act in speed order');
assert(formTurn.player && formTurn.allies.length === 4 && formTurn.foes.length === 10, 'formation turn shape');
assert(['ongoing', 'win', 'lose'].includes(formTurn.result), 'formation result');
```

- [ ] **Step 2: Run — expect FAIL (missing functions)**

Run: `npm test`

Expected: FAIL `legalFormationTargets is not a function` (or similar).

- [ ] **Step 3: Implement helpers at end of `js/battle.js`**

```js
/** Living foes the attacker may lock. pierce ignores front-row gate. */
export function legalFormationTargets(foes, { pierce = false } = {}) {
  const living = foes.filter((f) => f.hp > 0);
  const frontUp = living.some((f) => f.row === 'front');
  if (!pierce && frontUp) return living.filter((f) => f.row === 'front');
  return living;
}

function pickLowestHp(targets) {
  return targets.slice().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
}

/**
 * Full-field speed queue. Player uses SPECIES.move (or moves[0]);
 * optional playerTargetIndex into foes array; optional pierce via move.pierce.
 * Lose when player.hp <= 0 (allies wiping does not lose). Win when all foes down.
 */
export function resolveFormationTurn(player, allies, foes, {
  rng = Math.random,
  playerTargetIndex = -1,
  playerMove = null,
} = {}) {
  const p = { ...player };
  const team = allies.map((a) => ({ ...a }));
  const enemy = foes.map((f) => ({ ...f }));
  const logs = [];

  const livingAllies = () => [
    ...(p.hp > 0 ? [{ side: 'player', index: -1, mon: p }] : []),
    ...team.map((mon, index) => ({ side: 'ally', index, mon })).filter((u) => u.mon.hp > 0),
  ];
  const livingFoes = () => enemy
    .map((mon, index) => ({ side: 'foe', index, mon }))
    .filter((u) => u.mon.hp > 0);

  const actors = [...livingAllies(), ...livingFoes()].sort((a, b) => {
    if (b.mon.spd !== a.mon.spd) return b.mon.spd - a.mon.spd;
    if (a.side !== b.side) {
      const rank = { player: 0, ally: 1, foe: 2 };
      return rank[a.side] - rank[b.side];
    }
    return a.index - b.index;
  });

  for (const actor of actors) {
    if (actor.mon.hp <= 0) continue;
    if (actor.side === 'foe') {
      const squad = livingAllies().map((u) => u.mon);
      if (!squad.length) break;
      const kit = speciesMoves(actor.mon.speciesId);
      const move = kit[Math.min(kit.length - 1, Math.floor(rng() * kit.length))] || SPECIES[actor.mon.speciesId].move;
      const targets = move.aoe ? squad : [pickLowestHp(squad)];
      for (const t of targets) {
        if (t.hp <= 0) continue;
        const { damage, typeMult } = calcDamage(actor.mon, t, move);
        t.hp = Math.max(0, t.hp - damage);
        logs.push({
          text: `${SPECIES[actor.mon.speciesId].name} 使用了 ${move.name}！造成 ${damage} 点伤害${typeHint(typeMult)}`,
          damage,
          typeMult,
          moveType: move.type,
          side: 'foe',
          actorIndex: actor.index,
        });
      }
      continue;
    }

    const move = actor.side === 'player'
      ? (playerMove || SPECIES[p.speciesId].move)
      : SPECIES[actor.mon.speciesId].move;
    const pierce = !!move.pierce;
    let targets = legalFormationTargets(enemy, { pierce });
    if (!targets.length) break;
    let chosen;
    if (actor.side === 'player' && playerTargetIndex >= 0 && enemy[playerTargetIndex]?.hp > 0) {
      const want = enemy[playerTargetIndex];
      chosen = targets.includes(want) ? want : targets[0];
    } else {
      chosen = pickLowestHp(targets);
    }
    const { damage, typeMult } = calcDamage(actor.mon, chosen, move);
    chosen.hp = Math.max(0, chosen.hp - damage);
    logs.push({
      text: `${SPECIES[actor.mon.speciesId].name} 使用了 ${move.name}！打向${SPECIES[chosen.speciesId].name}，造成 ${damage} 点伤害${typeHint(typeMult)}`,
      damage,
      typeMult,
      moveType: move.type,
      side: actor.side === 'player' ? 'player' : 'ally',
      targetIndex: enemy.indexOf(chosen),
    });
  }

  let result = 'ongoing';
  if (enemy.every((f) => f.hp <= 0) && p.hp <= 0) result = 'draw';
  else if (enemy.every((f) => f.hp <= 0)) result = 'win';
  else if (p.hp <= 0) result = 'lose';

  return { player: p, allies: team, foes: enemy, logs, result };
}
```

Ensure `speciesMoves` / `typeHint` already exist in file (they do from squad path).

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS including ghost nether formation asserts.

- [ ] **Step 5: Commit**

```bash
git add js/battle.js tests/battle-catch.test.js
git commit -m "feat: add formation turn resolver with front-row lock"
```

---

### Task 4: Game flow — gate, shop, header, save field

**Files:**
- Modify: `js/game.js`
- Modify: `index.html`

- [ ] **Step 1: Import new symbols in `game.js`**

```js
  NETHER_SEAL,
  NETHER_SEAL_COST,
  NETHER_UNLOCK_LEVEL,
  NETHER_UNLOCK_COUNT,
  trySpendNetherSeal,
  createGhostNetherAllies,
```

And from battle:

```js
import { nextBattleStep, resolveDualTurn, resolveFormationTurn, resolveSquadTurn, resolveTurn, legalFormationTargets } from './battle.js';
```

- [ ] **Step 2: Normalize save — next to `twinKeys`**

```js
  s.netherSeals = Math.max(0, Math.floor(Number(s.netherSeals) || 0));
```

- [ ] **Step 3: Header display**

In `index.html` status bar after twin-key:

```html
<span id="nether-seal-display">冥界符 0</span>
```

In the function that refreshes fruit/twin displays:

```js
  const netherEl = $('nether-seal-display');
  if (netherEl) netherEl.textContent = `冥界符 ${state.netherSeals || 0}`;
```

- [ ] **Step 4: Map card lock + meta (mirror twin)**

Where `twinLocked` is computed, add:

```js
    const netherLocked = map.nether
      && partyOverLevelCount(state.party, NETHER_UNLOCK_LEVEL) < NETHER_UNLOCK_COUNT;
    const locked = (map.rift && partyMaxLevel(state.party) < RIFT_UNLOCK_LEVEL)
      || twinLocked
      || netherLocked;
```

Card class:

```js
    card.className = `map-card${map.rift ? ' rift' : ''}${map.twin ? ' twin' : ''}${map.nether ? ' nether' : ''}${locked ? ' locked' : ''}`;
```

Meta string branch for `map.nether`:

```js
        ? `阵型挑战 · 冥界符 ${state.netherSeals || 0}/${NETHER_SEAL_COST}`
```

(Fit into existing rift/twin ternary — extend carefully.)

- [ ] **Step 5: Shop item for 冥界符** (copy twin key shop block)

```js
    title: NETHER_SEAL.name,
    price: NETHER_SEAL.price,
    owned: state.netherSeals || 0,
    disabled: state.coins < NETHER_SEAL.price,
    // on buy: state.coins -= price; state.netherSeals = (state.netherSeals||0)+1;
```

- [ ] **Step 6: `tryEnterMap` gate after twin block**

```js
  if (map.nether) {
    const spent = trySpendNetherSeal(state, state.party);
    if (!spent.ok) {
      const owned = state.netherSeals || 0;
      const have = partyOverLevelCount(state.party, NETHER_UNLOCK_LEVEL);
      alert(spent.reason === 'level'
        ? `幽灵冥界要队伍里至少 ${NETHER_UNLOCK_COUNT} 只宝可梦超过 ${NETHER_UNLOCK_LEVEL} 级（现有 ${have} 只）。`
        : `还差冥界符：需要 ${NETHER_SEAL_COST} 个（现有 ${owned}）。可在商店花 ${NETHER_SEAL.price} 金币买。`);
      return;
    }
  }
```

- [ ] **Step 7: Commit**

```bash
git add js/game.js index.html
git commit -m "feat: ghost nether enter gate, shop seal, and header"
```

---

### Task 5: Formation battle UI + start/attack/catch (map-only)

**Files:**
- Modify: `index.html`, `css/game.css`, `js/game.js`

- [ ] **Step 1: HTML — formation foe container inside `#battle-field`** (before ally-row)

```html
          <div id="foe-formation" class="foe-formation hidden">
            <div id="foe-row-back" class="foe-row back"></div>
            <div id="foe-row-front" class="foe-row front"></div>
          </div>
          <p id="formation-next" class="hint formation-only hidden"></p>
```

Keep existing single/dual foe nodes; when `battle.formation`, hide them and show `#foe-formation`.

- [ ] **Step 2: CSS — two rows + nether card**

```css
.map-card.nether {
  border-color: #5b4b8a;
  box-shadow: 0 0 0 1px rgba(120, 90, 180, 0.35);
}
.foe-formation {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}
.foe-row {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.foe-row .foe-chip {
  width: 64px;
  text-align: center;
  font-size: 11px;
  opacity: 1;
  cursor: pointer;
}
.foe-row .foe-chip.locked {
  opacity: 0.4;
  pointer-events: none;
}
.foe-row .foe-chip.boss {
  width: 76px;
  outline: 1px solid #c44;
}
.foe-row .foe-chip.selected {
  outline: 2px solid #f5d76e;
}
.foe-row .foe-chip.down {
  opacity: 0.25;
  pointer-events: none;
}
#battle-field.formation-mode .fighter.foe {
  display: none;
}
#battle-field.formation-mode #ally-row {
  display: flex;
}
```

Bump `css/game.css?v=` and importmap `?v=` in `index.html`.

- [ ] **Step 3: Start path — when encounter has `formation: true`**

On marker click / pick flow (same place dual is detected):

1. Pick **one** fighter (reuse normal pick, not dual pick-two).
2. `battle = { formation: true, player, allies: createGhostNetherAllies(), foes: enc.foes.map(copy), selectedTarget: first legal front index, encounter: enc }`
3. `startFormationBattle()` → show battle screen, `renderFormationBattle()`, enable attack.

Hide dual-only nodes; add class `formation-mode` on `#battle-field`; show `#foe-formation` and build chips for back then front from `battle.foes` (preserve array order: indices 0–4 front, 5–9 back **or** filter by `row` — match `rollEncounter` order `[...front, ...back]` so index 0–4 front, 5–9 back).

- [ ] **Step 4: Target selection**

Chip click sets `battle.selectedTarget` to foe index if `legalFormationTargets` includes that foe (use player move pierce if selected move has pierce; v1: only default `move`, check `SPECIES[player].move.pierce` or first pierce in moves).

Update chip `.selected` / `.locked` each render.

- [ ] **Step 5: Attack button branch**

```js
  if (battle.formation) {
    const turn = resolveFormationTurn(battle.player, battle.allies, battle.foes, {
      playerTargetIndex: battle.selectedTarget,
    });
    battle.player = turn.player;
    battle.allies = turn.allies;
    battle.foes = turn.foes;
    // append logs, sync party HP for player uid, render
    if (turn.result === 'win') {
      // open catch queue for bosses only
      const bosses = turn.foes.filter((f) => f.boss).map((f) => ({ ...f, hp: f.maxHp })); // catch uses fainted template — follow twin: use pre-faint snapshot
      beginNetherCatchQueue(bosses);
      return;
    }
    if (turn.result === 'lose') { /* existing lose path */ }
    return;
  }
```

**Catch:** Keep a copy of the three boss pokemon (full stats) at battle start (`battle.bossCatchPool`). On win, queue UI: for each boss in order, ask 捕捉 / 跳过; on 捕捉 reuse existing catch screen with that mon; on finish return to map.

- [ ] **Step 6: Ally row**

Reuse `#ally-row` chip rendering from rift; ensure 4 chips. Do not show on dual/1v1.

- [ ] **Step 7: Manual smoke (optional)**

Run: `npm start` → buy seal → enter map → fight one turn → confirm front lock.

- [ ] **Step 8: Commit**

```bash
git add js/game.js index.html css/game.css
git commit -m "feat: ghost nether formation battle UI and catch queue"
```

---

### Task 6: Final verification

**Files:** none new

- [ ] **Step 1: Full test suite**

Run: `npm test`

Expected: all asserts PASS; map count 22; ghost nether + twin + rift green.

- [ ] **Step 2: Grep that formation is not used elsewhere**

Run:

```bash
rg -n "formation" js/game.js js/data.js js/battle.js
```

Expected: only `ghost_nether` / `resolveFormationTurn` / `legalFormationTargets` paths — no wiring on grassland etc.

- [ ] **Step 3: Commit any leftover fixes**

```bash
git add -u
git status
# if clean, skip; else:
git commit -m "fix: ghost nether formation polish"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Map `ghost_nether` / 幽灵冥界 | 2 |
| `formation` only on this map | 5, 6 |
| 3 Boss 改·达克莱伊/克雷色利亚/露奈雅拉 | 2 |
| 7 minions two rows | 2 |
| Front lock + pierce | 3 |
| Full speed queue | 3 |
| Clear-all win; lose on player faint | 3, 5 |
| 4 random allies from pool | 2, 5 |
| 2×>100 + 冥界符 5000 | 2, 4 |
| Enter deduct once | 4 (same as twin) |
| Sequential boss catch | 5 |
| UI two rows + 4 allies | 5 |
| Tests | 1, 3, 6 |

## Placeholder scan

No TBD steps. Ally heal skill for Cresselia deferred (low-power move). Art may be placeholder PNGs until pixel pass.
