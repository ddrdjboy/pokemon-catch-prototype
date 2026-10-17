# Party Horizontal Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tall vertical「我的宝可梦」panel with a compact horizontal scroller that supports three visual styles (`capsule` / `tile` / `split`), bag recall / send-to-active actions, and a persistent display setting.

**Architecture:** Keep the existing `party[]` order model (first `ACTIVE_CAP` = battle team). Add pure data helpers (`moveWithinZone`, `recallToBag`, `sendToActive`) with unit tests first. Rework select-screen party rendering to minimal cards + action popover. Drive the three looks via `data-party-style` on the party pane and `state.partyStyle` (same persistence pattern as `catchStyle`).

**Tech Stack:** Vanilla JS modules, CSS, `node tests/battle-catch.test.js`, localStorage save state.

**Spec:** `docs/superpowers/specs/2026-10-17-party-horizontal-styles-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `js/data.js` | `PARTY_STYLES`, `moveWithinZone`, `recallToBag`, `sendToActive`; default `partyStyle` on `initialPlayerState` |
| `tests/battle-catch.test.js` | Unit tests for the new party helpers and zone boundaries |
| `js/game.js` | Compact `renderParty` (manage mode), popover actions, `partyStyle` hydrate/apply, display modal |
| `css/game.css` | Horizontal party layout + three style variants + popover + display modal |
| `index.html` | Display button/modal; shorter party pane markup/hint |

Do **not** change unrestricted `movePartyMember` behavior (existing tests rely on it). UI must call `moveWithinZone` instead.

---

### Task 1: Party zone helpers + tests (TDD)

**Files:**
- Modify: `js/data.js` (after `movePartyMember`, ~line 446)
- Modify: `js/data.js` (`initialPlayerState`, ~line 615)
- Modify: `tests/battle-catch.test.js` (after existing party-cap block, ~line 135)

- [ ] **Step 1: Write the failing tests**

Append after the existing `movePartyMember` assertions in `tests/battle-catch.test.js`. Update the import list at the top to include the new exports:

```js
import {
  // ...existing imports...
  moveWithinZone, recallToBag, sendToActive, PARTY_STYLES,
} from '../js/data.js';
```

```js
console.log('party zones');
const z = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ uid: `z${n}` }));
assert(moveWithinZone(z, 'z3', -1), 'active can swap left');
assert(z.map((p) => p.uid).slice(0, 3).join() === 'z1,z3,z2', 'swapped inside active');
assert(!moveWithinZone(z, 'z6', 1), '6th cannot move into bag');
assert(!moveWithinZone(z, 'z7', -1), 'bag head cannot move into active');
assert(moveWithinZone(z, 'z8', -1), 'bag can reorder');
assert(z[6].uid === 'z8' && z[7].uid === 'z7', 'bag swap');

const r = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ uid: `r${n}` }));
assert(recallToBag(r, 'r2'), 'recall active to bag end');
assert(r.map((p) => p.uid).join() === 'r1,r3,r4,r5,r6,r7,r2', 'order after recall');
assert(!activeParty(r).some((p) => p.uid === 'r2'), 'recalled leaves active');
const small = [1, 2, 3, 4, 5].map((n) => ({ uid: `t${n}` }));
assert(!recallToBag(small, 't1'), 'no recall when no bag exists');

const s = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ uid: `s${n}` }));
assert(sendToActive(s, 's8'), 'send bag to 6th slot');
assert(s.map((p) => p.uid).join() === 's1,s2,s3,s4,s5,s8,s6,s7', 'inserted as 6th');
assert(activeParty(s).some((p) => p.uid === 's8'), 'sent is active');
assert(!activeParty(s).some((p) => p.uid === 's6'), 'old 6th benched');
assert(!sendToActive(s, 's1'), 'active cannot sendToActive');

assert(PARTY_STYLES.includes('capsule') && PARTY_STYLES.includes('tile') && PARTY_STYLES.includes('split'), 'styles listed');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL — `moveWithinZone` / `recallToBag` / `sendToActive` / `PARTY_STYLES` not exported.

- [ ] **Step 3: Implement helpers in `js/data.js`**

After `movePartyMember`:

```js
export const PARTY_STYLES = ['capsule', 'tile', 'split'];

/** Same-zone reorder only. Never crosses ACTIVE_CAP boundary. */
export function moveWithinZone(party, uid, dir, cap = ACTIVE_CAP) {
  const i = party.findIndex((p) => p.uid === uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= party.length) return false;
  const iActive = i < cap;
  const jActive = j < cap;
  if (iActive !== jActive) return false;
  const [mon] = party.splice(i, 1);
  party.splice(j, 0, mon);
  return true;
}

/** Move an active mon to the end of party (bag). Requires a real bag. */
export function recallToBag(party, uid, cap = ACTIVE_CAP) {
  if (!Array.isArray(party) || party.length <= cap) return false;
  const i = party.findIndex((p) => p.uid === uid);
  if (i < 0 || i >= cap) return false;
  const [mon] = party.splice(i, 1);
  party.push(mon);
  return true;
}

/** Insert a bag mon as the new last active slot (index cap-1). */
export function sendToActive(party, uid, cap = ACTIVE_CAP) {
  if (!Array.isArray(party) || party.length <= cap) return false;
  const i = party.findIndex((p) => p.uid === uid);
  if (i < 0 || i < cap) return false;
  const [mon] = party.splice(i, 1);
  party.splice(cap - 1, 0, mon);
  return true;
}
```

In `initialPlayerState`, add:

```js
partyStyle: 'capsule',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: all assertions pass, including `party zones`.

- [ ] **Step 5: Commit**

```bash
git add js/data.js tests/battle-catch.test.js
git commit -m "$(cat <<'EOF'
Add party zone move, recall, and send-to-active helpers.

EOF
)"
```

---

### Task 2: Persist `partyStyle` like `catchStyle`

**Files:**
- Modify: `js/game.js` (`hydrateState` ~line 121; imports ~line 16)

- [ ] **Step 1: Hydrate and default `partyStyle`**

Add to imports from `./data.js`:

```js
PARTY_STYLES,
moveWithinZone,
recallToBag,
sendToActive,
```

In `hydrateState`, after the `catchStyle` guard:

```js
if (!PARTY_STYLES.includes(s.partyStyle)) s.partyStyle = 'capsule';
```

- [ ] **Step 2: Smoke-check load path**

Run: `npm test`

Expected: PASS (no UI yet; hydration is defensive only).

- [ ] **Step 3: Commit**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
Persist and validate partyStyle on save load.

EOF
)"
```

---

### Task 3: Select-screen HTML shell + display modal markup

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add「显示」button and modal**

In the top-bar `.status`, before `#btn-shop`:

```html
<button id="btn-party-style" type="button">显示</button>
```

Before the shop modal (or after reset modal), add:

```html
<div id="party-style-modal" class="shop-modal hidden" role="dialog" aria-modal="true" aria-labelledby="party-style-title">
  <div class="panel shop-panel">
    <h2 id="party-style-title">队伍显示</h2>
    <div id="party-style-options" class="party-style-options">
      <button type="button" data-party-style="capsule">胶囊条</button>
      <button type="button" data-party-style="tile">精灵球瓷砖</button>
      <button type="button" data-party-style="split">双段横轨</button>
    </div>
    <button id="btn-close-party-style" type="button">关闭</button>
  </div>
</div>
```

- [ ] **Step 2: Slim the party pane markup**

Replace the party `split-pane` inner content with:

```html
<div class="panel split-pane party-pane" id="party-pane">
  <h2 class="party-head">我的宝可梦 <span id="party-count">1/99</span></h2>
  <p class="hint party-hint">点卡排序。前 6 出场；收回进背包，上场回前 6。</p>
  <div id="party-list" class="party-list"></div>
</div>
```

(Remove the wrapping `.pane-scroll` around the list.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Add party display setting modal and compact party pane shell.

EOF
)"
```

---

### Task 4: Compact manage-mode `renderParty` + popover actions

**Files:**
- Modify: `js/game.js` (`renderParty`, `shiftParty`, `renderSelect`, new helpers)

- [ ] **Step 1: Apply style attribute when rendering select**

In `renderSelect` (or a small `applyPartyStyle()` called from it):

```js
function applyPartyStyle() {
  const pane = $('party-pane');
  if (pane) pane.dataset.partyStyle = state.partyStyle || 'capsule';
  const modal = $('party-style-modal');
  if (!modal) return;
  for (const btn of modal.querySelectorAll('[data-party-style]')) {
    btn.classList.toggle('selected', btn.dataset.partyStyle === state.partyStyle);
  }
}
```

Call `applyPartyStyle()` from `renderSelect()` before `renderParty(...)`.

- [ ] **Step 2: Rewrite manage-mode card HTML (keep selectable path)**

When `selectable` is true, keep a compact card that still calls `onPick` (name + Lv + sprite is enough for pick screens).

When `selectable` is false (select-screen manage mode):

```js
card.innerHTML = `
  <div class="sprite-frame"><img src="${spriteUrl(sp.sprite)}" alt="${sp.name}" /></div>
  <div class="body">
    <strong>${sp.name}</strong>
    <div class="meta">Lv.${mon.level}${mon.hp <= 0 ? ' · 倒' : ''}</div>
  </div>
`;
```

Do **not** append sell / 上移 / 下移 buttons in manage mode anymore.

- [ ] **Step 3: Wire click → action popover**

Track `openPartyUid`. On manage-mode card click:

- If same uid open → close popover and return.
- Else build a `.party-popover` with up to three buttons.

Helper:

```js
function canShift(uid, dir) {
  const probe = state.party.map((p) => ({ ...p }));
  return moveWithinZone(probe, uid, dir);
}
```

Buttons:

- `左移` — disabled when `!canShift(uid, -1)`; on click: `moveWithinZone(state.party, uid, -1); save(); renderSelect();`
- `右移` — disabled when `!canShift(uid, 1)`; same with `+1`
- If `inActive`: `收回` — disabled when `state.party.length <= ACTIVE_CAP`; on click `recallToBag(state.party, uid)` then save + renderSelect
- Else: `上场` — on click `sendToActive(state.party, uid)` then save + renderSelect

Append popover to the card (or `party-pane`). Close on successful action, on outside click (`document` pointerdown once), or re-click same card.

Replace `shiftParty` to use `moveWithinZone` (or delete if unused). Remove the old sell-button path from manage-mode cards (sell stays out of scope).

- [ ] **Step 4: Split-style DOM**

When `state.partyStyle === 'split'`, render into two rows inside `#party-list`:

```html
<div class="party-zone">
  <div class="party-zone-label">出场</div>
  <div class="party-rail" data-zone="active">...</div>
</div>
<div class="party-zone" hidden-if-empty>
  <div class="party-zone-label">背包</div>
  <div class="party-rail" data-zone="bag">...</div>
</div>
```

Hide the bag zone entirely when `state.party.length <= ACTIVE_CAP`.

For `capsule` / `tile`, render cards directly as horizontal children of `#party-list` (single rail).

- [ ] **Step 5: Manual sanity via tests still green**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
Compact party cards with zone-safe popover actions.

EOF
)"
```

---

### Task 5: CSS for horizontal rails + three styles + popover

**Files:**
- Modify: `css/game.css`

- [ ] **Step 1: Party pane sizing on select screen**

Replace / extend so the party column no longer eats half the height on mobile:

```css
#screen-select .party-pane {
  flex: 0 0 auto;
  max-height: none;
}

.party-hint {
  flex-shrink: 0;
  margin: 0 0 8px;
  font-size: 0.85rem;
}

.party-list {
  display: flex;
  flex-direction: row;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  scrollbar-width: thin;
  overscroll-behavior-x: contain;
}

#screen-select .party-list {
  grid-template-columns: unset; /* override old grid rule */
}
```

Inside mobile media query, ensure `.party-pane` stays `flex: 0 0 auto` and map pane keeps `flex: 1 1 0`.

- [ ] **Step 2: Capsule (default)**

```css
.party-pane[data-party-style="capsule"] .party-card {
  flex: 0 0 auto;
  width: 148px;
  min-height: 56px;
  padding: 6px 8px;
  border-radius: 999px;
  gap: 8px;
}

.party-pane[data-party-style="capsule"] .party-card .sprite-frame {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.party-pane[data-party-style="capsule"] .party-card img {
  width: 40px;
  height: 40px;
}

.party-pane[data-party-style="capsule"] .party-card .body strong {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.party-pane[data-party-style="capsule"] .party-card .meta {
  font-size: 0.75rem;
  color: var(--muted);
}
```

- [ ] **Step 3: Tile**

```css
.party-pane[data-party-style="tile"] .party-card {
  flex: 0 0 auto;
  width: 88px;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 8px 6px;
  border-radius: 12px;
  gap: 4px;
  position: relative;
}

.party-pane[data-party-style="tile"] .party-card .sprite-frame {
  width: 64px;
  height: 64px;
}

.party-pane[data-party-style="tile"] .party-card .body strong {
  font-size: 0.75rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.party-pane[data-party-style="tile"] .party-card .meta {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 0.7rem;
  color: var(--gold);
}
```

- [ ] **Step 4: Split rails**

```css
.party-pane[data-party-style="split"] .party-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: visible;
}

.party-pane[data-party-style="split"] .party-rail {
  display: flex;
  flex-direction: row;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.party-pane[data-party-style="split"] .party-zone-label {
  font-size: 0.75rem;
  color: var(--muted);
  margin-bottom: 4px;
}

.party-pane[data-party-style="split"] .party-card {
  /* same dimensions as capsule */
  flex: 0 0 auto;
  width: 148px;
  min-height: 56px;
  padding: 6px 8px;
  border-radius: 999px;
}
```

- [ ] **Step 5: Shared in-battle + popover + style modal**

```css
.party-card.in-battle {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.party-card {
  position: relative;
  cursor: pointer;
}

.party-popover {
  position: absolute;
  z-index: 5;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 6px;
  background: #152232;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
}

.party-popover button {
  min-height: 36px;
  padding: 6px 10px;
  font-size: 0.8rem;
}

.party-style-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 16px;
}

.party-style-options button.selected {
  border-color: var(--accent);
  background: #1c3a52;
}
```

For `tile`, if the popover clips, allow:

```css
.party-pane[data-party-style="tile"] .party-popover {
  position: fixed;
  left: 50%;
  bottom: auto;
  top: 40%;
  transform: translate(-50%, -50%);
}
```

(or keep absolute — either is fine if usable on phone).

- [ ] **Step 6: Commit**

```bash
git add css/game.css
git commit -m "$(cat <<'EOF'
Style compact horizontal party rails for three display modes.

EOF
)"
```

---

### Task 6: Wire「显示」modal interactions

**Files:**
- Modify: `js/game.js` (bottom event listeners)

- [ ] **Step 1: Open / close / select handlers**

```js
function openPartyStyleModal() {
  $('party-style-modal').classList.remove('hidden');
  applyPartyStyle();
}

function closePartyStyleModal() {
  $('party-style-modal').classList.add('hidden');
}

$('btn-party-style').addEventListener('click', openPartyStyleModal);
$('btn-close-party-style').addEventListener('click', closePartyStyleModal);
$('party-style-modal').addEventListener('click', (e) => {
  if (e.target === $('party-style-modal')) closePartyStyleModal();
});
$('party-style-options').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-party-style]');
  if (!btn) return;
  const style = btn.dataset.partyStyle;
  if (!PARTY_STYLES.includes(style)) return;
  state.partyStyle = style;
  save();
  applyPartyStyle();
  renderParty($('party-list'), false);
  closePartyStyleModal();
});
```

Ensure `renderParty` for manage mode re-reads `state.partyStyle` for split vs single rail.

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
Add party display setting picker with persistence.

EOF
)"
```

---

### Task 7: Pick-screen polish + manual checklist

**Files:**
- Modify: `js/game.js` / `css/game.css` only if pick list broke

- [ ] **Step 1: Ensure `#pick-party` still works**

`renderParty($('pick-party'), true, ...)` must:

- Not attach manage popover
- Remain clickable to choose a fighter
- Look acceptable (compact card OK; can use default `.party-card` without `party-pane` style attribute)

If `#pick-party` is not inside `.party-pane`, style rules scoped under `.party-pane[...]` will not affect it — preferred.

- [ ] **Step 2: Manual checklist (browser `npm start`)**

1. Select screen: party is a short horizontal strip; maps have more room.
2. With ≤6 mons: no「收回」enabled; left/right reorder within the strip.
3. Catch / add until 7+:「收回」on an active mon moves it to bag end; it loses `in-battle` styling.
4. Bag mon「上场」becomes 6th; previous 6th goes to bag.
5. 6th active:「右移」disabled. First bag:「左移」disabled.
6. 「显示」→ switch capsule / tile / split; refresh page; style persists.
7. Split with ≤6 hides bag section.
8. Enter battle pick screen; can still select a conscious active mon.

- [ ] **Step 3: Final commit if polish needed**

```bash
git add js/game.js css/game.css index.html
git commit -m "$(cat <<'EOF'
Polish party pick-screen and display edge cases.

EOF
)"
```

(Skip empty commit if nothing changed.)

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Horizontal compact party | 3, 4, 5 |
| Minimal card (sprite/name/Lv) | 4 |
| Left/right same-zone only; 6th no right; bag head no left | 1, 4 |
| 收回 → bag end; disabled when length ≤ 6 | 1, 4 |
| 上场 → index `ACTIVE_CAP-1` | 1, 4 |
| Three styles capsule/tile/split | 4, 5 |
| 「显示」setting + persist `partyStyle` | 2, 3, 6 |
| No sell in popover | 4 |
| `#pick-party` unchanged behavior | 7 |
| Unit tests | 1 |

## Placeholder / consistency check

- APIs named consistently: `moveWithinZone`, `recallToBag`, `sendToActive`, `PARTY_STYLES`, `partyStyle`.
- Style ids: `capsule` | `tile` | `split` only.
- UI uses `moveWithinZone`; legacy `movePartyMember` left intact for old tests.
