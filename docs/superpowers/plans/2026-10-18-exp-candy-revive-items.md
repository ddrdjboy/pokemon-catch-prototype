# Experience Candy & Revive Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five-tier experience candies and two revive items (活力碎片 / 活力块) to a unified item catalog, usable in battle (auto-target, turn cost) and out of battle (party pane → pick item → pick mon), all buyable in the shop.

**Architecture:** Item definitions live in `js/items.js` (not `data.js`) so `applyItem` can call `gainExperience` without a `data.js` ↔ `level.js` cycle. `game.js` wires shop, battle item panel, and party-pane bag UI. Spec: `docs/superpowers/specs/2026-10-18-exp-candy-revive-items-design.md`.

**Tech Stack:** Vanilla ES modules, existing `npm test` assert harness (`node tests/battle-catch.test.js`).

**Files:**
- Create: `js/items.js` — `ITEMS`, `emptyItems()`, `applyItem()`, labels, heal aliases
- Modify: `js/data.js` — remove inline `HEAL_ITEMS` / `emptyHealItems` / `applyHealItem` (re-export from `items.js` OR delete and update imports)
- Modify: `js/game.js` — shop, hydrate, battle item flow, out-of-battle bag
- Modify: `index.html` — party-pane Item button + bag panels
- Modify: `css/game.css` — bag panel layout if needed (reuse `.item-panel`)
- Modify: `tests/battle-catch.test.js` — catalog + applyItem contracts
- Modify: `index.html` importmap cache-bust for `items.js` if present

---

### Task 1: Item catalog + `applyItem` (TDD)

**Files:**
- Create: `js/items.js`
- Modify: `js/data.js` (stop defining heal items; re-export from `items.js` for one release if needed)
- Modify: `tests/battle-catch.test.js`

- [ ] **Step 1: Write failing tests** — append after the existing `heal items` section (or replace that section) in `tests/battle-catch.test.js`:

```js
import {
  ITEMS, HEAL_ITEMS, emptyItems, emptyHealItems, applyItem, applyHealItem,
} from '../js/items.js';
// keep createPokemon / initialPlayerState imports from data.js

console.log('unified items');
assert(ITEMS.expCandyS.effect === 'xp' && ITEMS.expCandyS.value === 100 && ITEMS.expCandyS.price === 200, 'candy S');
assert(ITEMS.expCandyM.value === 400 && ITEMS.expCandyM.price === 700, 'candy M');
assert(ITEMS.expCandyL.value === 1000 && ITEMS.expCandyL.price === 1600, 'candy L');
assert(ITEMS.expCandyXL.value === 2500 && ITEMS.expCandyXL.price === 3500, 'candy XL');
assert(ITEMS.expCandyXXL.value === 6000 && ITEMS.expCandyXXL.price === 8000, 'candy XXL');
assert(ITEMS.vitalityShard.effect === 'revive' && ITEMS.vitalityShard.value === 0.5 && ITEMS.vitalityShard.price === 1200, 'shard');
assert(ITEMS.vitalityBlock.value === 1 && ITEMS.vitalityBlock.price === 2800, 'block');
assert(HEAL_ITEMS.potion.heal === 20 && HEAL_ITEMS.potion.price === 50, 'potion alias');

const stock = emptyItems();
for (const id of Object.keys(ITEMS)) {
  assert(stock[id] === 0, `empty ${id}`);
}
const starter = initialPlayerState().items;
assert(starter.expCandyS === 0 && starter.vitalityShard === 0, 'new game has new item keys');

const hurt = createPokemon('scorbunny', 5);
hurt.hp = Math.max(1, hurt.maxHp - 30);
const healOk = applyItem(hurt, 'potion');
assert(healOk.ok && healOk.kind === 'heal' && healOk.amount === 20, 'applyItem heal');
assert(applyHealItem(hurt, 'potion') >= 0, 'applyHealItem still works');

const fainted = createPokemon('scorbunny', 5);
fainted.hp = 0;
assert(applyItem(fainted, 'potion').ok === false, 'no heal fainted');
const shard = applyItem(fainted, 'vitalityShard');
assert(shard.ok && shard.kind === 'revive', 'shard revives');
assert(fainted.hp === Math.max(1, Math.floor(fainted.maxHp * 0.5)), 'shard 50%');
const living = createPokemon('scorbunny', 5);
assert(applyItem(living, 'vitalityBlock').ok === false, 'no revive living');
living.hp = 0;
const block = applyItem(living, 'vitalityBlock');
assert(block.ok && living.hp === living.maxHp, 'block full');

const pup = createPokemon('scorbunny', 5);
pup.exp = 0;
const beforeLevel = pup.level;
const candy = applyItem(pup, 'expCandyS');
assert(candy.ok && candy.kind === 'xp' && candy.amount === 100, 'candy grants 100');
assert(pup.exp === 100 || pup.level > beforeLevel, 'exp applied');
const down = createPokemon('scorbunny', 5);
down.hp = 0;
down.exp = 0;
applyItem(down, 'expCandyM');
assert(down.hp === 0, 'fainted stays 0 after candy');
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test
```

Expected: FAIL (cannot find `../js/items.js` or missing exports)

- [ ] **Step 3: Implement `js/items.js`**

```js
import { gainExperience } from './level.js';

export const ITEMS = {
  potion: { id: 'potion', name: '伤药', effect: 'heal', value: 20, price: 50, icon: '💊' },
  superPotion: { id: 'superPotion', name: '好伤药', effect: 'heal', value: 50, price: 150, icon: '💉' },
  hyperPotion: { id: 'hyperPotion', name: '厉害伤药', effect: 'heal', value: 200, price: 400, icon: '🧪' },
  maxPotion: { id: 'maxPotion', name: '全满药', effect: 'heal', value: 'full', price: 800, icon: '🧴' },
  expCandyS: { id: 'expCandyS', name: '经验糖果 S', effect: 'xp', value: 100, price: 200, icon: '🍬' },
  expCandyM: { id: 'expCandyM', name: '经验糖果 M', effect: 'xp', value: 400, price: 700, icon: '🍬' },
  expCandyL: { id: 'expCandyL', name: '经验糖果 L', effect: 'xp', value: 1000, price: 1600, icon: '🍭' },
  expCandyXL: { id: 'expCandyXL', name: '经验糖果 XL', effect: 'xp', value: 2500, price: 3500, icon: '🧁' },
  expCandyXXL: { id: 'expCandyXXL', name: '经验糖果 XXL', effect: 'xp', value: 6000, price: 8000, icon: '🎂' },
  vitalityShard: { id: 'vitalityShard', name: '活力碎片', effect: 'revive', value: 0.5, price: 1200, icon: '💠' },
  vitalityBlock: { id: 'vitalityBlock', name: '活力块', effect: 'revive', value: 1, price: 2800, icon: '💎' },
};

/** @deprecated use ITEMS; kept for heal-only callers/tests */
export const HEAL_ITEMS = Object.fromEntries(
  Object.values(ITEMS)
    .filter((i) => i.effect === 'heal')
    .map((i) => [i.id, { ...i, heal: i.value }]),
);

export function emptyItems() {
  return Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 0]));
}

export function emptyHealItems() {
  return emptyItems();
}

export function itemEffectLabel(item) {
  if (item.effect === 'heal') {
    return item.value === 'full' ? '回复全部 HP' : `回复 ${item.value} HP`;
  }
  if (item.effect === 'xp') return `经验 +${item.value}`;
  if (item.effect === 'revive') {
    return item.value >= 1 ? '复活并回复全部 HP' : '复活并回复 50% HP';
  }
  return '';
}

/**
 * @returns {{ ok: boolean, kind?: string, amount?: number, logs?: string[] }}
 */
export function applyItem(mon, itemId) {
  const item = ITEMS[itemId];
  if (!item || !mon) return { ok: false };
  if (item.effect === 'heal') {
    if (mon.hp <= 0) return { ok: false };
    const missing = Math.max(0, mon.maxHp - mon.hp);
    if (missing <= 0) return { ok: false };
    const amount = item.value === 'full' ? missing : Math.min(item.value, missing);
    mon.hp += amount;
    return { ok: true, kind: 'heal', amount, logs: [] };
  }
  if (item.effect === 'revive') {
    if (mon.hp > 0) return { ok: false };
    const amount = Math.max(1, Math.floor(mon.maxHp * item.value));
    mon.hp = Math.min(mon.maxHp, amount);
    return { ok: true, kind: 'revive', amount: mon.hp, logs: [] };
  }
  if (item.effect === 'xp') {
    const wasFainted = mon.hp <= 0;
    const logs = gainExperience(mon, item.value);
    if (wasFainted) mon.hp = 0;
    return { ok: true, kind: 'xp', amount: item.value, logs };
  }
  return { ok: false };
}

export function applyHealItem(mon, itemId) {
  const r = applyItem(mon, itemId);
  return r.ok && r.kind === 'heal' ? r.amount : 0;
}
```

- [ ] **Step 4: Update `js/data.js`** — delete the old `HEAL_ITEMS` / `emptyHealItems` / `applyHealItem` block; change `initialPlayerState` to:

```js
import { emptyItems } from './items.js';
// ...
items: emptyItems(),
```

If other files import heal helpers from `data.js`, either re-export:

```js
export { HEAL_ITEMS, emptyHealItems, applyHealItem, ITEMS, emptyItems, applyItem } from './items.js';
```

or update those imports to `./items.js`. Prefer updating `game.js` + tests to import from `items.js` and re-export only if something else still needs `data.js`.

- [ ] **Step 5: Run `npm test`** — expect PASS for new asserts and existing heal-turn tests

- [ ] **Step 6: Commit**

```bash
git add js/items.js js/data.js tests/battle-catch.test.js
git commit -m "$(cat <<'EOF'
feat: add unified items with exp candy and revive effects

EOF
)"
```

---

### Task 2: Shop + persistence for full catalog

**Files:**
- Modify: `js/game.js` (imports, `hydrateState`, `renderShop`)

- [ ] **Step 1: Switch imports** at top of `game.js` from heal-only to:

```js
import {
  ITEMS,
  HEAL_ITEMS, // remove once unused
  emptyItems,
  applyItem,
  itemEffectLabel,
} from './items.js';
```

Remove `emptyHealItems` / `applyHealItem` / `HEAL_ITEMS` imports from `data.js` if moved.

- [ ] **Step 2: Hydrate** — replace heal-only merge with full catalog:

```js
items: { ...emptyItems(), ...(parsed.items || {}) },
// ...
for (const id of Object.keys(ITEMS)) {
  s.items[id] = Math.max(0, Math.floor(Number(s.items[id]) || 0));
}
```

- [ ] **Step 3: Shop loop** — change `Object.values(HEAL_ITEMS)` to `Object.values(ITEMS)` in `renderShop` (keep the same `shopItem` buy handler; ensure `state.items = emptyItems()` when missing).

- [ ] **Step 4: Manual check** — `npm test` still passes. Optionally open shop in browser and confirm candy/revive rows + prices.

- [ ] **Step 5: Commit**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
feat: sell all items in shop and hydrate full item inventory

EOF
)"
```

---

### Task 3: Battle item panel — all effects + auto-target

**Files:**
- Modify: `js/game.js` (`healTargetsOnField`, `canUseHealItem`, `renderItemList`, `onUseItem`, helpers)

- [ ] **Step 1: Add targeting helpers** near the existing heal helpers:

```js
function onFieldMons() {
  if (!battle) return [];
  return battle.dual ? (battle.players || []) : [battle.player];
}

function healTargetsOnField() {
  return onFieldMons()
    .map((mon, index) => ({ mon, index }))
    .filter(({ mon }) => mon && mon.hp > 0 && mon.hp < mon.maxHp);
}

function xpTargetsOnField() {
  return onFieldMons()
    .map((mon, index) => ({ mon, index }))
    .filter(({ mon }) => mon && mon.hp > 0);
}

function reviveTargets() {
  if (!battle) return [];
  const field = onFieldMons()
    .map((mon, index) => ({ mon, index, uid: battle.dual ? battle.playerUids[index] : battle.playerUid, onField: true }))
    .filter(({ mon }) => mon && mon.hp <= 0);
  if (field.length) return field;
  // Bench / party: fainted party mons (uid not required for out-of-sync edge; prefer party order)
  return state.party
    .filter((p) => p.hp <= 0)
    .map((mon) => ({ mon, index: -1, uid: mon.uid, onField: false }));
}

function autoTargetForItem(item) {
  if (item.effect === 'heal') {
    const targets = healTargetsOnField();
    if (!targets.length) return null;
    targets.sort((a, b) => (a.mon.maxHp - a.mon.hp) - (b.mon.maxHp - b.mon.hp));
    const t = targets[targets.length - 1];
    const uid = battle.dual ? battle.playerUids[t.index] : battle.playerUid;
    return { ...t, uid, onField: true };
  }
  if (item.effect === 'xp') {
    const targets = xpTargetsOnField();
    if (!targets.length) return null;
    const t = targets[0];
    const uid = battle.dual ? battle.playerUids[t.index] : battle.playerUid;
    return { ...t, uid, onField: true };
  }
  if (item.effect === 'revive') {
    const targets = reviveTargets();
    return targets[0] || null;
  }
  return null;
}

function ownedItemUsableInBattle(item) {
  return (state.items?.[item.id] || 0) > 0 && !!autoTargetForItem(item);
}

function canUseBattleItem() {
  if (!battle || battleBusy || continueResolver) return false;
  return Object.values(ITEMS).some((item) => ownedItemUsableInBattle(item));
}
```

Replace `canUseHealItem` call sites with `canUseBattleItem` (`updateItemButton`, `openItemPanel`, etc.).

- [ ] **Step 2: Rewrite `renderItemList`** to list all `ITEMS`, show `itemEffectLabel(item)`, disable when `!ownedItemUsableInBattle(item)` (owned 0 or no target).

- [ ] **Step 3: Rewrite `onUseItem`**

```js
async function onUseItem(itemId) {
  if (!battle || battleBusy || continueResolver) return;
  const item = ITEMS[itemId];
  if (!item || (state.items?.[itemId] || 0) <= 0) return;
  const target = autoTargetForItem(item);
  if (!target) return;

  const fighter = state.party.find((p) => p.uid === target.uid);
  if (!fighter) return;

  // Sync field HP onto party copy before apply for on-field targets
  if (target.onField && target.index >= 0) {
    const fieldMon = onFieldMons()[target.index];
    if (fieldMon) fighter.hp = fieldMon.hp;
  }

  closeItemPanel();
  battleBusy = true;
  setBattleActionBusy(true);

  const result = applyItem(fighter, itemId);
  if (!result.ok) {
    battleBusy = false;
    setBattleActionBusy(false);
    return;
  }
  state.items[itemId] -= 1;

  if (target.onField && target.index >= 0) {
    if (battle.dual) {
      battle.players[target.index] = { ...fighter };
      battle.player = battle.players[0];
    } else {
      battle.player = { ...fighter };
    }
  }

  if (result.kind === 'heal') {
    appendLog(`使用了 ${item.name}！${SPECIES[fighter.speciesId].name} 回复了 ${result.amount} 点 HP！`);
  } else if (result.kind === 'revive') {
    appendLog(`使用了 ${item.name}！${SPECIES[fighter.speciesId].name} 复活了！（HP ${fighter.hp}/${fighter.maxHp}）`);
  } else if (result.kind === 'xp') {
    appendLog(`使用了 ${item.name}！`);
    for (const line of result.logs || []) appendLog(line);
  }
  save();
  renderBattle();

  try {
    // same item-turn resolution as before (dual / squad / foe-only)
    if (battle.dual) {
      const startPlayers = battle.players.map((mon) => ({ ...mon }));
      const startFoes = battle.foes.map((mon) => ({ ...mon }));
      const turn = resolveDualItemTurn(startPlayers, startFoes);
      await playDualTurnHits(turn);
      finishTurnOutcome(turn);
      return;
    }
    const startPlayer = { ...battle.player };
    const startFoe = { ...battle.foe };
    const startAllies = battle.allies ? battle.allies.map((ally) => ({ ...ally })) : null;
    const turn = startAllies
      ? resolveSquadItemTurn(startPlayer, startAllies, startFoe)
      : resolveFoeOnlyTurn(startPlayer, startFoe);
    await playTurnHits(turn, startPlayer, startFoe);
    finishTurnOutcome(turn);
  } catch (err) {
    console.error(err);
    resetAttackButton();
  }
}
```

Important: decrement inventory **only after** `result.ok` (spec: failed apply does not consume).

- [ ] **Step 4: `npm test`** + quick manual battle: potion still works; revive on fainted; candy on active.

- [ ] **Step 5: Commit**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
feat: use candy and revive items in battle with auto-target

EOF
)"
```

---

### Task 4: Out-of-battle bag UI (party pane)

**Files:**
- Modify: `index.html`
- Modify: `css/game.css` (minimal)
- Modify: `js/game.js`

- [ ] **Step 1: Markup** in `#party-pane` after the hint (or beside party head):

```html
<div class="party-item-bar">
  <button id="btn-party-items" type="button">道具</button>
</div>
<div id="bag-item-panel" class="item-panel hidden">
  <div class="item-panel-head">
    <span>选择道具</span>
    <button id="btn-close-bag-items" type="button">取消</button>
  </div>
  <div id="bag-item-list" class="item-list"></div>
</div>
<div id="bag-target-panel" class="item-panel hidden">
  <div class="item-panel-head">
    <span>选择宝可梦</span>
    <button id="btn-close-bag-target" type="button">取消</button>
  </div>
  <div id="bag-target-list" class="party-list"></div>
</div>
<p id="bag-item-feedback" class="hint party-hint" hidden></p>
```

- [ ] **Step 2: CSS** — reuse `.item-panel`; optional `.party-item-bar { margin: 0.5rem 0; }`. Ensure bag panels stack inside party pane without breaking split layout.

- [ ] **Step 3: Bag logic in `game.js`**

```js
let bagSelectedItemId = null;

function monAcceptsItem(mon, item) {
  if (!mon || !item) return false;
  if (item.effect === 'heal') return mon.hp > 0 && mon.hp < mon.maxHp;
  if (item.effect === 'revive') return mon.hp <= 0;
  if (item.effect === 'xp') return true;
  return false;
}

function closeBagPanels() {
  bagSelectedItemId = null;
  $('bag-item-panel')?.classList.add('hidden');
  $('bag-target-panel')?.classList.add('hidden');
}

function renderBagItemList() {
  const list = $('bag-item-list');
  if (!list) return;
  list.innerHTML = '';
  for (const item of Object.values(ITEMS)) {
    const owned = state.items?.[item.id] || 0;
    const anyTarget = state.party.some((m) => monAcceptsItem(m, item));
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'item-row';
    row.disabled = owned <= 0 || !anyTarget;
    row.innerHTML = `
      <span class="item-icon">${item.icon}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-effect">${itemEffectLabel(item)}</span>
      <span class="item-owned">×${owned}</span>
    `;
    row.addEventListener('click', () => openBagTargetPicker(item.id));
    list.appendChild(row);
  }
}

function openBagItemPanel() {
  if (battle) return; // party bag is out-of-battle only
  renderBagItemList();
  $('bag-target-panel')?.classList.add('hidden');
  $('bag-item-panel')?.classList.remove('hidden');
}

function openBagTargetPicker(itemId) {
  const item = ITEMS[itemId];
  if (!item || (state.items?.[itemId] || 0) <= 0) return;
  bagSelectedItemId = itemId;
  const list = $('bag-target-list');
  list.innerHTML = '';
  for (const mon of state.party) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'party-card';
    const ok = monAcceptsItem(mon, item);
    btn.disabled = !ok;
    const sp = SPECIES[mon.speciesId];
    btn.textContent = `${sp?.name || mon.speciesId} Lv.${mon.level}  HP ${mon.hp}/${mon.maxHp}`;
    btn.addEventListener('click', () => onBagUseItem(mon.uid));
    list.appendChild(btn);
  }
  $('bag-item-panel')?.classList.add('hidden');
  $('bag-target-panel')?.classList.remove('hidden');
}

function onBagUseItem(uid) {
  const item = ITEMS[bagSelectedItemId];
  const mon = state.party.find((p) => p.uid === uid);
  if (!item || !mon || (state.items?.[item.id] || 0) <= 0) return;
  if (!monAcceptsItem(mon, item)) return;
  const result = applyItem(mon, item.id);
  if (!result.ok) return;
  state.items[item.id] -= 1;
  const lines = [];
  if (result.kind === 'heal') {
    lines.push(`使用了 ${item.name}！${SPECIES[mon.speciesId].name} 回复了 ${result.amount} 点 HP！`);
  } else if (result.kind === 'revive') {
    lines.push(`使用了 ${item.name}！${SPECIES[mon.speciesId].name} 复活了！（HP ${mon.hp}/${mon.maxHp}）`);
  } else if (result.kind === 'xp') {
    lines.push(`使用了 ${item.name}！`);
    for (const line of result.logs || []) lines.push(line);
  }
  const fb = $('bag-item-feedback');
  if (fb) {
    fb.hidden = false;
    fb.textContent = lines.join(' ');
  }
  save();
  renderParty($('party-list'), false);
  closeBagPanels();
  updateHeader(); // if coins/party count helpers exist; else skip
}

// wire in boot / listener setup:
$('btn-party-items')?.addEventListener('click', openBagItemPanel);
$('btn-close-bag-items')?.addEventListener('click', closeBagPanels);
$('btn-close-bag-target')?.addEventListener('click', () => {
  $('bag-target-panel')?.classList.add('hidden');
  openBagItemPanel();
});
```

Match existing party card markup if `renderParty` uses a richer structure — prefer cloning that card style over plain `textContent` when easy.

- [ ] **Step 4: Manual test** — on select screen: buy candy/revive in shop, open 道具, feed candy, faint a mon (or set hp 0 in console), revive with shard/block.

- [ ] **Step 5: Commit**

```bash
git add index.html css/game.css js/game.js
git commit -m "$(cat <<'EOF'
feat: use items from party pane outside battle

EOF
)"
```

---

### Task 5: Import map + final verification

**Files:**
- Modify: `index.html` (importmap / script cache query if the project cache-busts modules)

- [ ] **Step 1:** If `index.html` has an import map listing `./js/data.js` etc., add `"./js/items.js": "./js/items.js?v=<bump>"` or bump a shared version query consistently with other recent features.

- [ ] **Step 2: Full test run**

```bash
npm test
```

Expected: all asserts pass, including heal items, item turn, unified items.

- [ ] **Step 3: Spec checklist**
  - [ ] Shop sells 5 candies + 2 revives at listed prices
  - [ ] Battle auto-target heal / xp / revive + turn cost
  - [ ] Out-of-battle party bag with target picker
  - [ ] Fainted + candy keeps `hp === 0`
  - [ ] Failed apply does not decrement stock

- [ ] **Step 4: Commit** only if importmap/docs tweaks remain; otherwise done.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Unified ITEMS + effects | Task 1 |
| Candy S–XXL values/prices | Task 1 |
| Vitality shard/block 50%/100% | Task 1 |
| `applyItem` result object | Task 1 |
| Fainted candy keeps hp 0 | Task 1 |
| Shop sells all | Task 2 |
| Hydrate missing keys → 0 | Task 2 |
| Battle auto-target + turn | Task 3 |
| No consume on failed apply | Task 3 |
| Out-of-battle party entry | Task 4 |
| Party target filter by effect | Task 4 |

No placeholders left. `applyItem` lives in `js/items.js` (intentional deviation from spec’s `data.js` path to avoid circular imports); behavior matches the spec.
