# 顶栏统一道具与队伍说明 toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 顶栏「道具」打开全局统一弹窗（场外选目标 / 战斗中自动目标并耗回合）；队伍排序说明改为标题旁 ⓘ toast。

**Architecture:** 复用商店遮罩模式做 `#items-modal`（列表 + 可选目标列表同弹窗内切换）。`openItemsUi()` 按 `battle && canUseBattleItem()` 分流：战斗走现有 `onUseItem`，场外走 `applyItem` + 选宠。顶栏 `#btn-items` 替代 `#btn-party-items` 与 `#btn-item`。页面级 `#app-toast` + `showAppToast` 供队伍 ⓘ 使用（样式对齐 `.maze-info-btn` / `.maze-toast`）。

**Tech Stack:** 原生 ES modules、现有 DOM UI、`npm test`（Node assert；本改动以手动 UI 验收为主，保持现有测试通过）

**Spec:** `docs/superpowers/specs/2026-10-18-items-menu-party-info-design.md`

**Files:**
- Modify: `index.html`
- Modify: `css/game.css`
- Modify: `js/game.js`
- No new JS module; no test file changes unless a selector-based smoke is added (skip — no DOM harness)

---

### Task 1: HTML — 顶栏入口、ⓘ、统一弹窗、清理旧面板

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 顶栏加入道具按钮**

在 `#btn-shop` 后插入：

```html
<button id="btn-items" type="button">道具</button>
```

- [ ] **Step 2: 队伍标题旁加 ⓘ，删除常驻 hint 与队伍道具条**

把：

```html
<h2 class="party-head">我的宝可梦 <span id="party-count">1/99</span></h2>
<p class="hint party-hint">点卡排序。前 6 出场；收回进背包，上场回前 6。</p>
<div class="party-item-bar">
  <button id="btn-party-items" type="button">道具</button>
</div>
<div id="bag-item-panel" class="item-panel hidden">...</div>
<div id="bag-target-panel" class="item-panel hidden">...</div>
<p id="bag-item-feedback" class="hint party-hint" hidden></p>
```

换成：

```html
<h2 class="party-head">
  <span class="party-head-title">我的宝可梦 <span id="party-count">1/99</span></span>
  <button id="btn-party-info" type="button" class="maze-info-btn" aria-label="队伍说明" title="队伍说明">i</button>
</h2>
```

（完整删除 `party-hint` 那行、`party-item-bar`、`bag-item-panel`、`bag-target-panel`、`bag-item-feedback`。）

- [ ] **Step 3: 战斗栏去掉道具按钮与嵌入式 item-panel**

`row-actions` 只留攻击 / 逃跑：

```html
<button id="btn-attack" type="button" class="primary">攻击</button>
<button id="btn-flee-battle" type="button">逃跑</button>
```

删除紧随其后的整个 `#item-panel` 块。

- [ ] **Step 4: 在 `</div><!-- #app -->` 后（与 shop-modal 同级）增加统一弹窗与 app toast**

```html
<div id="items-modal" class="shop-modal hidden" role="dialog" aria-modal="true" aria-labelledby="items-title">
  <div class="shop-dialog panel items-dialog">
    <h2 id="items-title">道具</h2>
    <div id="items-step-list">
      <div id="items-list" class="item-list"></div>
    </div>
    <div id="items-step-target" class="hidden">
      <p class="hint">选择宝可梦</p>
      <div id="items-target-list" class="party-list"></div>
    </div>
    <button id="btn-close-items" type="button">关闭</button>
  </div>
</div>
<div id="app-toast" class="app-toast hidden" role="status"></div>
```

注意：旧的 `#btn-close-items` 随 `#item-panel` 删除后，新弹窗复用同一 id。

- [ ] **Step 5: cache-bust**

把 `css/game.css?v=`、`/js/game.js` importmap 与底部 script 的 query 改成新值，例如 `v=itemsmenu1`。

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add top items button, party info, unified items modal markup"
```

---

### Task 2: CSS — 弹窗、toast、标题行

**Files:**
- Modify: `css/game.css`

- [ ] **Step 1: party-head 容纳 ⓘ**

在现有 `.party-head` 旁增加：

```css
.party-head-title {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.party-head .maze-info-btn {
  margin-left: auto;
  align-self: center;
}
```

可删除不再使用的 `.party-hint`、`.party-item-bar`（若无其它引用）。

- [ ] **Step 2: items dialog + app toast**

```css
.items-dialog {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.items-dialog .item-list,
.items-dialog #items-target-list {
  overflow: auto;
  min-height: 0;
  max-height: 55vh;
  margin: 8px 0 12px;
}

.app-toast {
  position: fixed;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 80;
  max-width: min(420px, calc(100% - 24px));
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  background: rgba(18, 12, 28, 0.92);
  border: 1px solid #8b6bb0;
  color: #f2e9ff;
  font-size: 0.85rem;
  line-height: 1.45;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.app-toast.hidden { display: none; }
```

- [ ] **Step 3: Commit**

```bash
git add css/game.css
git commit -m "style: items modal, party info button, app toast"
```

---

### Task 3: JS — `showAppToast` + 队伍 ⓘ

**Files:**
- Modify: `js/game.js`

- [ ] **Step 1: 常量与 toast 函数**

在 `MAZE_HELP_TEXT` / `showMazeToast` 附近增加：

```js
const PARTY_HELP_TEXT = '点卡排序。前 6 出场；收回进背包，上场回前 6。';

let appToastTimer = null;

function showAppToast(text, ms = 4000) {
  const el = $('app-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  if (appToastTimer) clearTimeout(appToastTimer);
  appToastTimer = setTimeout(() => {
    el.classList.add('hidden');
    appToastTimer = null;
  }, ms);
}
```

- [ ] **Step 2: 绑定 ⓘ**

在事件绑定区增加：

```js
$('btn-party-info')?.addEventListener('click', () => {
  showAppToast(PARTY_HELP_TEXT);
});
```

- [ ] **Step 3: Commit**

```bash
git add js/game.js
git commit -m "feat: party info i-button shows sort help toast"
```

---

### Task 4: JS — 统一道具弹窗（打开 / 渲染 / 关闭 / 分流）

**Files:**
- Modify: `js/game.js`

- [ ] **Step 1: 状态与关闭**

用一个变量跟踪弹窗模式与已选道具（可替换 `bagSelectedItemId`）：

```js
let itemsUiSelectedId = null; // bag / modal selected item

function closeItemsModal() {
  itemsUiSelectedId = null;
  $('items-modal')?.classList.add('hidden');
  $('items-step-list')?.classList.remove('hidden');
  $('items-step-target')?.classList.add('hidden');
}

function closeItemPanel() {
  closeItemsModal();
}
```

保留 `closeItemPanel` 名字作为别名，避免漏改战斗路径里的调用。

- [ ] **Step 2: 更新顶栏按钮可用状态**

把 `updateItemButton` 改为更新 `#btn-items`（战斗中才需要按可用性禁用；场外始终可点）：

```js
function updateItemButton() {
  const btn = $('btn-items');
  if (!btn) return;
  if (battle) {
    btn.disabled = !canUseBattleItem();
  } else {
    btn.disabled = false;
  }
}
```

`setBattleActionBusy` / `waitForContinue` / `resetAttackButton` 里所有 `$('btn-item')` 改为 `$('btn-items')`（或只调 `updateItemButton()` / `closeItemPanel()`，删除对已删 `#btn-item` 的直接引用）。

- [ ] **Step 3: 渲染道具列表（战斗 vs 场外）**

```js
function renderItemsModalList() {
  const list = $('items-list');
  if (!list) return;
  list.innerHTML = '';
  const inBattle = !!battle;
  for (const item of Object.values(ITEMS)) {
    const owned = state.items?.[item.id] || 0;
    const usable = inBattle
      ? ownedItemUsableInBattle(item)
      : owned > 0 && state.party.some((m) => monAcceptsItem(m, item));
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'item-row';
    row.disabled = !usable;
    row.innerHTML = `
      <span class="item-icon">${item.icon}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-effect">${itemEffectLabel(item)}</span>
      <span class="item-owned">×${owned}</span>
    `;
    row.addEventListener('click', () => {
      if (inBattle) onUseItem(item.id);
      else openItemsTargetPicker(item.id);
    });
    list.appendChild(row);
  }
}
```

- [ ] **Step 4: 场外选目标 + 使用**

把 `openBagTargetPicker` / `onBagUseItem` 改挂到新 DOM id（或重写为）：

```js
function openItemsTargetPicker(itemId) {
  const item = ITEMS[itemId];
  if (!item || (state.items?.[itemId] || 0) <= 0) return;
  itemsUiSelectedId = itemId;
  const list = $('items-target-list');
  list.innerHTML = '';
  for (const mon of state.party) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'party-card';
    const ok = monAcceptsItem(mon, item);
    btn.disabled = !ok;
    const sp = SPECIES[mon.speciesId];
    btn.textContent = `${sp?.name || mon.speciesId} Lv.${mon.level}  HP ${mon.hp}/${mon.maxHp}`;
    btn.addEventListener('click', () => onItemsUseOutOfBattle(mon.uid));
    list.appendChild(btn);
  }
  $('items-step-list').classList.add('hidden');
  $('items-step-target').classList.remove('hidden');
  $('items-title').textContent = '选择宝可梦';
}

function onItemsUseOutOfBattle(uid) {
  const item = ITEMS[itemsUiSelectedId];
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
  showAppToast(lines.join(' '));
  save();
  renderParty($('party-list'), false);
  closeItemsModal();
  $('items-title').textContent = '道具';
}
```

- [ ] **Step 5: 打开入口**

```js
function openItemsUi() {
  if (battle) {
    if (!canUseBattleItem()) {
      showAppToast('现在不能用道具');
      return;
    }
    $('items-title').textContent = '道具';
    $('items-step-list').classList.remove('hidden');
    $('items-step-target').classList.add('hidden');
    renderItemsModalList();
    $('items-modal').classList.remove('hidden');
    return;
  }
  $('items-title').textContent = '道具';
  $('items-step-list').classList.remove('hidden');
  $('items-step-target').classList.add('hidden');
  renderItemsModalList();
  $('items-modal').classList.remove('hidden');
}
```

删除或改为空操作：`openItemPanel`、`openBagItemPanel`、`renderItemList`、`renderBagItemList`、`closeBagPanels`（凡仍被引用的改为 `closeItemsModal`）。

`onUseItem` 开头成功路径里已有 `closeItemPanel()` —— 保持即可（现映射到 `closeItemsModal`）。

- [ ] **Step 6: 事件绑定**

替换旧绑定为：

```js
$('btn-items')?.addEventListener('click', openItemsUi);
$('btn-close-items')?.addEventListener('click', closeItemsModal);
$('items-modal')?.addEventListener('click', (e) => {
  if (e.target === $('items-modal')) closeItemsModal();
});
```

删除：`$('btn-item')`、`$('btn-party-items')`、`$('btn-close-bag-items')`、`$('btn-close-bag-target')` 的监听。

`btn-flee-battle` 里保留 `closeItemPanel()`。

- [ ] **Step 7: 全文搜索残留**

Run: `rg -n "btn-item|btn-party-items|bag-item|item-panel|bag-target|bagSelectedItemId|openBag|renderItemList|openItemPanel" js/game.js index.html`

Expected: 无旧 id / 死函数引用（`closeItemPanel` 别名可保留）。

- [ ] **Step 8: Commit**

```bash
git add js/game.js
git commit -m "feat: unify items UI in top-bar modal with battle turn cost"
```

---

### Task 5: 验证

**Files:** none（手动 + 测试）

- [ ] **Step 1: 跑测试**

Run: `npm test`

Expected: 全部 passed（与改前数量一致或更高；0 failed）。

- [ ] **Step 2: 手动检查清单**

1. 顶栏商店旁有「道具」；队伍区无「道具」、无常驻排序文案；标题旁有 `i`
2. 点 `i` → 底部 toast 出现原文，约 4s 消失
3. 选图界面：道具 → 选道具 → 选宝可梦 → 生效 + toast
4. 战斗中：顶栏道具 → 选道具 → 生效且敌方行动（占回合）；战斗栏无「道具」
5. 战斗忙碌时顶栏道具禁用；不可用时 toast「现在不能用道具」
6. 点遮罩 / 关闭可关弹窗

- [ ] **Step 3: 若有遗漏修完后最终 commit（仅当还有未提交改动）**

```bash
git status -sb
# 若干净则跳过；否则
git add -u
git commit -m "fix: polish unified items menu after manual check"
```

---

## Spec coverage

| Spec 要求 | Task |
| --- | --- |
| 顶栏商店后「道具」 | Task 1 |
| 任意界面可见 | Task 1 + 4 |
| 统一 `#items-modal` | Task 1 + 4 |
| 去掉队伍/战斗栏旧入口 | Task 1 + 4 |
| 场外选目标 | Task 4 |
| 战斗自动目标 + 占回合 | Task 4（复用 `onUseItem`） |
| 不可用禁用 / toast | Task 4 |
| ⓘ + 排序 toast | Task 1 + 3 |
| 删常驻 hint | Task 1 |
| `npm test` | Task 5 |
