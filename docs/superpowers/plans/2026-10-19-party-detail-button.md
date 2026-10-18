# 队伍宠物「详情」按钮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「我的宝可梦」操作菜单最上方增加「详情」，打开现有详情弹框并同时展示该只个体信息与图鉴信息。

**Architecture:** 纯函数 `partyIndividualView` 放在 `js/party-detail.js`（避免 `data.js` ↔ `level.js` 循环依赖），由 Node 测试覆盖。`game.js` 在 popover 第一项调用它，并把可选 `mon` 传给现有 `renderDexDetail` / `openDexDetail`。图鉴入口不传 `mon`。不新增 HTML 弹框。

**Tech Stack:** 原生 ES modules、现有 DOM UI、Node 断言测试（`npm test`）

**Spec:** `docs/superpowers/specs/2026-10-19-party-detail-button-design.md`

---

### Task 1: 个体信息投影

**Files:**
- Create: `js/party-detail.js`
- Modify: `tests/battle-catch.test.js`

- [ ] **Step 1: Write the failing test**

在 `tests/battle-catch.test.js` 的 import 区追加：

```js
import { partyIndividualView } from '../js/party-detail.js';
```

在文件末尾、汇总 `passed`/`failed` 之前追加：

```js
console.log('\nparty individual view');
{
  const view = partyIndividualView({
    speciesId: 'bulbasaur',
    level: 5,
    hp: 12,
    maxHp: 20,
    atk: 11,
    def: 10,
    spd: 9,
    exp: 4,
    shiny: true,
  });
  assert(view.level === 5, 'level');
  assert(view.hpText === '12/20', 'hp text');
  assert(view.atk === 11 && view.def === 10 && view.spd === 9, 'combat stats');
  assert(view.expText === `4/${xpToNext(5)}`, 'exp toward next level');
  assert(view.shiny === true && view.fainted === false, 'shiny not fainted');
}
{
  const view = partyIndividualView({
    speciesId: 'pikachu',
    level: 8,
    hp: 0,
    maxHp: 30,
    atk: 1,
    def: 1,
    spd: 1,
  });
  assert(view.expText === `0/${xpToNext(8)}`, 'missing exp counts as 0');
  assert(view.fainted === true && view.shiny === false, 'fainted not shiny');
}
assert(partyIndividualView(null) === null, 'null mon');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — cannot find module `../js/party-detail.js` or `partyIndividualView` is not exported.

- [ ] **Step 3: Write minimal implementation**

Create `js/party-detail.js`:

```js
import { xpToNext } from './level.js';

/** Individual fields for the party detail dialog. Null if mon is missing. */
export function partyIndividualView(mon) {
  if (!mon) return null;
  const exp = Number.isFinite(mon.exp) ? mon.exp : 0;
  return {
    level: mon.level,
    hpText: `${mon.hp}/${mon.maxHp}`,
    atk: mon.atk,
    def: mon.def,
    spd: mon.spd,
    expText: `${exp}/${xpToNext(mon.level)}`,
    shiny: !!mon.shiny,
    fainted: (mon.hp ?? 0) <= 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS, including the new `party individual view` asserts. Existing asserts stay green.

- [ ] **Step 5: Commit**

```bash
git add js/party-detail.js tests/battle-catch.test.js
git commit -m "$(cat <<'EOF'
Add party individual detail view helper.

EOF
)"
```

---

### Task 2: 详情弹框渲染个体区块

**Files:**
- Modify: `js/game.js`（import、`renderDexDetail`、`openDexDetail`）

- [ ] **Step 1: Import the helper**

在 `js/game.js` 现有 import 块之后增加：

```js
import { partyIndividualView } from './party-detail.js';
```

- [ ] **Step 2: Render the individual block only when a mon is passed**

把 `renderDexDetail(detail)` 改成 `renderDexDetail(detail, mon = null)`。在拼 `root.innerHTML` 时，于动画按钮与 `.meta` 之间插入个体 HTML。图鉴路径 `mon == null` 时该段为空字符串。

在函数内、`root.innerHTML =` 之前：

```js
  const individual = partyIndividualView(mon);
  const individualHtml = individual
    ? `<div class="individual">
        <div>个体：Lv.${individual.level} · HP ${individual.hpText}</div>
        <div>能力：攻 ${individual.atk} · 防 ${individual.def} · 速 ${individual.spd}</div>
        <div>经验：${individual.expText}</div>
        <div class="meta">
          ${individual.shiny ? '<span class="tag shiny">闪光</span>' : ''}
          ${individual.fainted ? '<span class="tag">倒地</span>' : ''}
        </div>
      </div>`
    : '';
```

模板中紧接动画按钮、位于现有 `<div class="meta">` 之前插入 `${individualHtml}`。

- [ ] **Step 3: Thread mon through open**

```js
function openDexDetail(speciesId, mon = null) {
  const detail = getDexDetail(speciesId, SPECIES);
  if (!detail) return;
  renderDexDetail(detail, mon);
  $('dex-detail-modal').classList.remove('hidden');
}

function openPartyDetail(mon) {
  closePartyPopover();
  openDexDetail(mon.speciesId, mon);
}
```

图鉴行仍调用 `openDexDetail(e.id)`，不传第二参。

- [ ] **Step 4: Manual check (no automated DOM test)**

用本地静态服务打开页面（`npm start`），从图鉴点一条目：弹框无「个体：」行。此步先不点队伍按钮（Task 3 才接线）。

- [ ] **Step 5: Commit**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
Show individual stats in the shared dex detail dialog.

EOF
)"
```

---

### Task 3: 菜单「详情」按钮与样式

**Files:**
- Modify: `js/game.js`（`buildPartyPopover`）
- Modify: `css/game.css`（`.party-popover`、`.dex-detail .individual`）

- [ ] **Step 1: Add the button first**

在 `buildPartyPopover` 里，`add('左移', ...)` 之前插入：

```js
  add('详情', false, '', () => openPartyDetail(mon));
```

`add` 的 click 已 `stopPropagation`。`openPartyDetail` 会关掉 popover。不要把「详情」放进 `runPartyAction`（那会 `save()` 并重绘选怪界面）。

- [ ] **Step 2: Fit four buttons on the card**

`css/game.css` 的 `.party-popover`：`gap: 4px` 改为 `gap: 2px`，`padding: 4px` 改为 `padding: 3px`。

`.party-popover button` 的 `min-height: 26px` 改为 `min-height: 22px`。

在 `.dex-detail .moves` 规则旁增加：

```css
.dex-detail .individual {
  width: 100%;
  text-align: left;
  line-height: 1.45;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
```

- [ ] **Step 3: Verify in the browser**

`npm start`，打开选怪界面：

1. 点一只「我的宝可梦」卡片，菜单第一项是「详情」，其后仍是左移、右移、收回或上场。
2. 点「详情」：popover 关闭，弹框含等级、HP、攻防速、经验，以及属性、种族值、招式、捕捉率、进化。闪光宠物有「闪光」；HP 为 0 时有「倒地」。
3. 关闭按钮和点遮罩都能关掉弹框。
4. 打开图鉴再点一行：没有个体区块，其余与原来一致。
5. 再跑 `npm test`，全部通过。

- [ ] **Step 4: Commit**

```bash
git add js/game.js css/game.css
git commit -m "$(cat <<'EOF'
Add a detail action to the party card menu.

EOF
)"
```

---

## Self-review

- 菜单第一项「详情」、复用 `#dex-detail-modal`、个体+图鉴、图鉴入口不变、关 popover、不新建弹框节点：Task 2–3 覆盖。
- 非目标（改名、放生、独立弹框、卡片内展开）未进入任务。
- `partyIndividualView` 的字段名在测试与 `renderDexDetail` 中一致。
