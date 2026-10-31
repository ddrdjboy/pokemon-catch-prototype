# 战斗「使用道具」按钮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 普通战斗下方行动栏在逃跑前提供「使用道具」；战斗中顶栏「道具」只能浏览；场外顶栏使用流程不变。

**Architecture:** 从 main 系战斗 UI 出发，复用 `#items-modal`。纯逻辑抽到 `js/items-ui-mode.js`（mode / 行禁用 / 按钮启用），`game.js` 接线 DOM。顶栏战斗中 `browse`；`#btn-use-item` 与编队「使用道具」走 `use`。

**Tech Stack:** 原生 ES modules、现有 DOM、`npm test`（Node assert）

**Spec:** `docs/superpowers/specs/2026-10-31-battle-use-item-button-design.md`

**Files:**
- Create: `js/items-ui-mode.js`
- Create: `tests/items-ui-mode.test.js`
- Modify: `package.json`（把新测试加入 `npm test`）
- Modify: `index.html`
- Modify: `js/game.js`
- Modify: `css/game.css`（仅必要时）
- Prerequisite: 工作区同步到含 `#items-modal` + `#battle-actions` 的 main

---

### Task 0: 同步到 main 系战斗 UI

**Files:**
- Branch / worktree based on `origin/main` (not the old 三键 `btn-item` layout)

- [ ] **Step 1: 确认当前树是否已是 main 战斗 UI**

Run:

```bash
rg -n 'id="btn-use-item"|id="items-modal"|id="battle-actions"|id="btn-item"' index.html
```

Expected on **pre-feature main**:
- has `items-modal`, `battle-actions`
- has **no** `btn-use-item` yet
- battle actions should **not** be the old `row-actions` with `#btn-item` between 攻击/逃跑

If still on old layout: create branch from `origin/main` (or rebase/reset onto it per team practice), then continue. Do **not** implement this feature on the old three-button battle row.

- [ ] **Step 2: Commit only if you created a sync/merge commit**

```bash
git status -sb
# if merge/rebase produced a commit, leave it; otherwise no empty commit
```

---

### Task 1: 纯逻辑模块 + 失败测试

**Files:**
- Create: `js/items-ui-mode.js`
- Create: `tests/items-ui-mode.test.js`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试**

Create `tests/items-ui-mode.test.js`:

```js
import assert from 'node:assert/strict';
import {
  resolveItemsUiMode,
  itemsModalTitle,
  shouldDisableItemRow,
  canEnableUseItemButton,
  shouldCloseItemsModalOnBusy,
} from '../js/items-ui-mode.js';

console.log('items-ui-mode');

assert.equal(resolveItemsUiMode({ source: 'top', inBattle: true }), 'browse');
assert.equal(resolveItemsUiMode({ source: 'top', inBattle: false }), 'use');
assert.equal(resolveItemsUiMode({ source: 'use-btn', inBattle: true }), 'use');
assert.equal(resolveItemsUiMode({ source: 'use-btn', inBattle: false }), 'use');

assert.equal(itemsModalTitle('browse'), '道具（浏览）');
assert.equal(itemsModalTitle('use'), '道具');

assert.equal(shouldDisableItemRow({ mode: 'browse', usable: true }), true);
assert.equal(shouldDisableItemRow({ mode: 'browse', usable: false }), true);
assert.equal(shouldDisableItemRow({ mode: 'use', usable: true }), false);
assert.equal(shouldDisableItemRow({ mode: 'use', usable: false }), true);

assert.equal(
  canEnableUseItemButton({ busy: false, continueWait: false, anyUsable: true }),
  true,
);
assert.equal(
  canEnableUseItemButton({ busy: true, continueWait: false, anyUsable: true }),
  false,
);
assert.equal(
  canEnableUseItemButton({ busy: false, continueWait: true, anyUsable: true }),
  false,
);
assert.equal(
  canEnableUseItemButton({ busy: false, continueWait: false, anyUsable: false }),
  false,
);

assert.equal(shouldCloseItemsModalOnBusy('use'), true);
assert.equal(shouldCloseItemsModalOnBusy('browse'), false);

console.log('items-ui-mode ok');
```

- [ ] **Step 2: 把测试挂进 npm test**

In `package.json` `scripts.test`, append:

```text
&& node tests/items-ui-mode.test.js
```

(keep existing test chain order; add at end)

- [ ] **Step 3: Run test — expect FAIL (module missing)**

Run: `node tests/items-ui-mode.test.js`

Expected: `ERR_MODULE_NOT_FOUND` for `../js/items-ui-mode.js`

- [ ] **Step 4: 实现最小模块**

Create `js/items-ui-mode.js`:

```js
/** @typedef {'browse' | 'use'} ItemsUiMode */
/** @typedef {'top' | 'use-btn'} ItemsUiSource */

/**
 * @param {{ source: ItemsUiSource, inBattle: boolean }} opts
 * @returns {ItemsUiMode}
 */
export function resolveItemsUiMode({ source, inBattle }) {
  if (source === 'top' && inBattle) return 'browse';
  return 'use';
}

/** @param {ItemsUiMode} mode */
export function itemsModalTitle(mode) {
  return mode === 'browse' ? '道具（浏览）' : '道具';
}

/**
 * @param {{ mode: ItemsUiMode, usable: boolean }} opts
 */
export function shouldDisableItemRow({ mode, usable }) {
  if (mode === 'browse') return true;
  return !usable;
}

/**
 * @param {{ busy: boolean, continueWait: boolean, anyUsable: boolean }} opts
 */
export function canEnableUseItemButton({ busy, continueWait, anyUsable }) {
  return !busy && !continueWait && !!anyUsable;
}

/** @param {ItemsUiMode | null | undefined} mode */
export function shouldCloseItemsModalOnBusy(mode) {
  return mode === 'use';
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `node tests/items-ui-mode.test.js && npm test`

Expected: `items-ui-mode ok` and full suite green

- [ ] **Step 6: Commit**

```bash
git add js/items-ui-mode.js tests/items-ui-mode.test.js package.json
git commit -m "$(cat <<'EOF'
feat: add items UI mode helpers for battle browse vs use

EOF
)"
```

---

### Task 2: HTML — 战斗栏「使用道具」+ 编队文案

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在逃跑前插入按钮**

Inside `#battle-actions`, immediately **before** `#btn-flee-battle`, insert:

```html
<button id="btn-use-item" type="button">使用道具</button>
```

Resulting order (other dual-cmd buttons unchanged):

```html
<div id="battle-actions" class="battle-actions" data-layout="list">
  <div id="move-buttons" class="move-buttons"></div>
  <button id="btn-attack" type="button" class="primary hidden">继续</button>
  <button id="btn-switch-cmd" type="button" class="dual-cmd-only hidden">换人</button>
  <button id="btn-cmd-back" type="button" class="dual-cmd-only hidden">返回</button>
  <button id="btn-cmd-undo" type="button" class="dual-cmd-only hidden">重选上一只</button>
  <button id="btn-use-item" type="button">使用道具</button>
  <button id="btn-flee-battle" class="flee-btn" type="button">逃跑</button>
</div>
```

- [ ] **Step 2: 编队指令文案**

Change:

```html
<button type="button" data-cmd="item">道具</button>
```

to:

```html
<button type="button" data-cmd="item">使用道具</button>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: add battle use-item button before flee

EOF
)"
```

---

### Task 3: game.js — browse/use 接线

**Files:**
- Modify: `js/game.js`
- Modify: import map / cache-bust query on `index.html` if the project bumps `?v=` for `game.js` (match local convention)

- [ ] **Step 1: Import helpers**

Near other local imports in `js/game.js`, add:

```js
import {
  resolveItemsUiMode,
  itemsModalTitle,
  shouldDisableItemRow,
  canEnableUseItemButton,
  shouldCloseItemsModalOnBusy,
} from './items-ui-mode.js';
```

Add module state next to other UI flags (near `itemsUiSelectedId` if present, else near battle UI lets):

```js
/** @type {'browse' | 'use' | null} */
let itemsUiMode = null;
```

If `index.html` importmap lists `./js/game.js` with `?v=…`, bump that token; also add/bump `./js/items-ui-mode.js` if importmap enumerates every module (follow existing pattern — many builds only map listed files; if unlisted relative imports work, only bump `game.js`).

- [ ] **Step 2: Widen「战斗中」检测**

Replace `isBattleScreenActive` with:

```js
function isBattleScreenActive() {
  const battleVisible = screens.battle && !screens.battle.classList.contains('hidden');
  const formation = screens['formation-battle'];
  const formationVisible = formation && !formation.classList.contains('hidden');
  return !!((battle && battleVisible) || formationVisible);
}
```

(Keep using `screens` map already defined in `game.js`.)

- [ ] **Step 3: `canUseBattleItem` helper for button enable**

Ensure this exists (or add):

```js
function canUseBattleItem() {
  if (!battle || battleBusy || continueResolver) return false;
  return Object.values(ITEMS).some((item) => ownedItemUsableInBattle(item));
}
```

- [ ] **Step 4: `updateUseItemButton` + keep top bar always enabled**

```js
function updateUseItemButton() {
  const btn = $('btn-use-item');
  if (!btn) return;
  const anyUsable = !!battle && Object.values(ITEMS).some((item) => ownedItemUsableInBattle(item));
  btn.disabled = !canEnableUseItemButton({
    busy: battleBusy,
    continueWait: !!continueResolver,
    anyUsable,
  });
}

function updateItemButton() {
  const top = $('btn-items');
  if (top) top.disabled = false;
  updateUseItemButton();
}
```

- [ ] **Step 5: Close modal on busy only for use**

In `setBattleActionBusy`, when `busy` is true, replace unconditional `closeItemPanel()` with:

```js
if (busy) {
  if (shouldCloseItemsModalOnBusy(itemsUiMode)) closeItemPanel();
  const useBtn = $('btn-use-item');
  if (useBtn) useBtn.disabled = true;
} else {
  updateItemButton();
}
```

Also disable `#btn-use-item` in the same busy loops that disable flee / moves (any direct `$('btn-flee-battle').disabled = true` during continue waits should call `updateUseItemButton()` or set use-item disabled).

In `closeItemsModal` / `closeItemPanel`, clear mode:

```js
itemsUiMode = null;
```

- [ ] **Step 6: Rewrite `openItemsUi` + list rendering**

```js
function openItemsUi(opts = {}) {
  const source = opts.source || 'top';
  const inBattle = isBattleScreenActive();
  const mode = opts.mode || resolveItemsUiMode({ source, inBattle });

  if (mode === 'use' && inBattle && (battleBusy || continueResolver)) return;

  itemsUiMode = mode;
  itemsUiSelectedId = null;
  const title = $('items-title');
  if (title) title.textContent = itemsModalTitle(mode);
  $('items-step-list')?.classList.remove('hidden');
  $('items-step-target')?.classList.add('hidden');
  renderItemsModalList();
  $('items-modal')?.classList.remove('hidden');
}

function renderItemsModalList() {
  const list = $('items-list');
  if (!list) return;
  list.innerHTML = '';
  const inBattle = isBattleScreenActive();
  const mode = itemsUiMode || (inBattle ? 'browse' : 'use');

  for (const item of Object.values(ITEMS)) {
    const owned = state.items?.[item.id] || 0;
    if (owned <= 0) continue;
    const usable = inBattle
      ? ownedItemUsableInBattle(item)
      : state.party.some((m) => monAcceptsItem(m, item));
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'item-row';
    row.disabled = shouldDisableItemRow({ mode, usable });
    if (row.disabled) {
      row.title = mode === 'browse' ? '战斗中请用下方「使用道具」' : '现在不能使用';
    }
    row.innerHTML = `
      <span class="item-icon">${item.icon}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-effect">${itemEffectLabel(item)}</span>
      <span class="item-owned">×${owned}</span>
    `;
    row.addEventListener('click', () => {
      if (shouldDisableItemRow({ mode, usable })) return;
      if (inBattle) onUseItem(item.id);
      else openItemsTargetPicker(item.id);
    });
    list.appendChild(row);
  }
  if (!list.children.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '没有道具';
    list.appendChild(empty);
  }
}
```

- [ ] **Step 7: Wire clicks**

Replace top-bar listener:

```js
$('btn-items')?.addEventListener('click', () => openItemsUi({ source: 'top' }));
```

Add:

```js
$('btn-use-item')?.addEventListener('click', () => {
  if (battleBusy || continueResolver) return;
  openItemsUi({ source: 'use-btn', mode: 'use' });
});
```

Call `updateUseItemButton()` / `updateItemButton()` from existing battle start / `resetAttackButton` / `renderBattle` paths that already call `updateItemButton()`.

- [ ] **Step 8: 编队「使用道具」**

In `formation-commands` click handler, replace the stub:

```js
if (cmd === 'item') {
  $('formation-prompt').textContent = '编队战道具暂未开放';
}
```

with:

```js
if (cmd === 'item') {
  if (battleBusy || continueResolver) return;
  // Realm formation item turn is still thin; open use modal so selection
  // goes through onUseItem when battle supports it. If realm-only stub
  // remains inside onUseItem, keep prompt fallback there — do not use top-bar browse here.
  openItemsUi({ source: 'use-btn', mode: 'use' });
  return;
}
```

If `onUseItem` no-ops for `battle.realmFormation` (no field targets), leave a single clear log/prompt inside `onUseItem` — do **not** reintroduce top-bar use during formation. Top bar on formation screen must stay browse via `isBattleScreenActive`.

- [ ] **Step 9: Manual smoke (local serve)**

Run: `npm start` → open battle with potions in bag:

1. Top「道具」→ title「道具（浏览）」→ rows disabled  
2. 「使用道具」→ title「道具」→ usable rows clickable → turn resolves  
3. Out of battle top「道具」→ pick target still works  
4. `npm test` green

- [ ] **Step 10: Commit**

```bash
git add js/game.js index.html css/game.css
git commit -m "$(cat <<'EOF'
feat: battle use-item button; top-bar items browse-only in battle

EOF
)"
```

---

### Task 4: CSS（仅当行动栏挤兑时）

**Files:**
- Modify: `css/game.css`

- [ ] **Step 1: Check mobile battle actions**

If `#btn-use-item` wraps awkwardly under existing `.battle-actions` / `@media` rules, add minimal flex tweak only, e.g. ensure buttons share row like flee:

```css
#btn-use-item {
  /* only if needed — prefer inheriting .battle-actions button rules */
}
```

If layout already fine, **skip CSS commit**.

- [ ] **Step 2: Commit only if CSS changed**

```bash
git add css/game.css
git commit -m "$(cat <<'EOF'
style: fit use-item button in battle action bar

EOF
)"
```

---

### Task 5: 验收清单

- [ ] **Step 1: Spec success criteria**

1. 普通战斗逃跑前可见「使用道具」  
2. 战斗中顶栏只能看、不能用  
3. 「使用道具」可用并耗回合  
4. 无可用 / busy 时按钮禁用，顶栏仍可 browse  
5. 场外顶栏不变  
6. 编队文案「使用道具」；顶栏在编队屏为 browse；指令打开 use（realm 结算若仍弱，不回退成顶栏使用）  
7. `npm test` 通过  

- [ ] **Step 2: Final commit only if leftover fixes**

No empty commit.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `#btn-use-item` before flee, label 使用道具 | Task 2 |
| Top bar battle = browse | Task 1 helpers + Task 3 |
| Bottom / 编队 = use | Task 3 |
| Mode titles / disable rows | Task 1 + Task 3 |
| Busy closes use only | Task 1 `shouldCloseItemsModalOnBusy` + Task 3 |
| `#btn-items` always enabled | Task 3 `updateItemButton` |
| Formation screen counts as in-battle | Task 3 `isBattleScreenActive` |
| Main-first prerequisite | Task 0 |
| Tests for mode rules | Task 1 |
| No item effect / auto-target changes | untouched |

## Placeholder / consistency check

- Mode name `browse` | `use` and sources `top` | `use-btn` used consistently.  
- No TBD steps.  
- Realm formation full item-turn polish is explicitly not expanded beyond opening use modal + existing `onUseItem` paths.
