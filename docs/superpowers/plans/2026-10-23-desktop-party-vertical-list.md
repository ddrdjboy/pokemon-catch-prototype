# Desktop/iPad Party Vertical List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On viewports ≥721px, change the select-screen「我的宝可梦」list from a phone-style horizontal tile rail to a vertical row-card list that scrolls inside `.pane-scroll`; keep ≤720px horizontal tiles unchanged.

**Architecture:** CSS-only override scoped under `#screen-select #party-list` inside `@media (min-width: 721px)`. Base `.party-list` / `.party-card` rules stay as the mobile tile rail. No JS/DOM changes unless popover regression forces a tiny fix. Bump `css/game.css` cache query on `index.html` so Pages clients pick up the change.

**Tech Stack:** Static HTML/CSS/JS prototype; GitHub Pages from `main`; existing `720px` breakpoint.

**Spec:** `docs/superpowers/specs/2026-10-23-desktop-party-vertical-list-design.md`

**Base branch:** Implement on top of current `origin/main` (horizontal party rails live there). If the working tree is behind, rebase/merge `origin/main` before coding.

---

## File map

| File | Role |
|------|------|
| `css/game.css` | Add wide-viewport overrides for `#screen-select #party-list` flow + row cards; leave `#pick-party` and ≤720px alone |
| `index.html` | Bump `css/game.css?v=…` cache key only |
| `js/game.js` | No change unless popover clipped (fallback task) |
| `docs/superpowers/specs/2026-10-23-desktop-party-vertical-list-design.md` | Already written; do not rewrite |

---

### Task 1: Sync to main (if needed)

**Files:**
- Modify: working tree branch tip vs `origin/main`

- [ ] **Step 1: Check whether party rail CSS exists locally**

Run:

```bash
rg -n "Party pane: compact horizontal rails" css/game.css || true
git fetch origin
git log -1 --oneline origin/main
```

Expected: either the comment exists in local `css/game.css`, or local is behind and needs sync.

- [ ] **Step 2: If missing, merge or rebase onto `origin/main`**

Prefer merge if the current feature branch has commits to keep:

```bash
git merge origin/main
```

Resolve conflicts favoring main for `css/game.css` party-list / party-card sections unless twin-towers conflicts require keeping both.

- [ ] **Step 3: Confirm baseline selectors**

Run:

```bash
rg -n "^\.party-list \{|^\.party-card \{|@media \(min-width: 721px\)|@media \(max-width: 720px\)" css/game.css
```

Expected: `.party-list` uses `flex-direction: row` + `overflow-x: auto`; an existing `@media (min-width: 721px)` block near the party-pane rules; mobile `@media (max-width: 720px)` present.

- [ ] **Step 4: Commit sync only if merge created a merge commit / conflict resolution**

```bash
git status
# if merge commit already created by git merge, skip; otherwise:
git add -u
git commit -m "chore: sync main before desktop party list layout"
```

---

### Task 2: Wide-viewport list flow (column + no horizontal scroll)

**Files:**
- Modify: `css/game.css` (extend the existing `@media (min-width: 721px)` block that currently only sets party-pane flex, ~line 308 on main)

- [ ] **Step 1: Locate the existing wide media query**

Run:

```bash
rg -n -A6 "@media \(min-width: 721px\)" css/game.css | head -40
```

Expected: a block that sets `#screen-select .split-pane.party-pane:last-child { flex: 1 1 0; }`.

- [ ] **Step 2: Extend that block so `#party-list` stacks vertically**

Inside the same `@media (min-width: 721px)` block, add (do not replace the existing party-pane flex rule):

```css
  /* Select-screen party: vertical list on desktop/iPad; mobile keeps horizontal rail */
  #screen-select #party-list.party-list {
    flex-direction: column;
    flex-wrap: nowrap;
    overflow-x: visible;
    overflow-y: visible;
    padding-bottom: 0;
    overscroll-behavior-x: auto;
  }
```

Vertical scrolling must come from `.pane-scroll`, not from `#party-list` itself (`overflow-y: visible`).

- [ ] **Step 3: Smoke-check CSS parses (no build step)**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
css = Path('css/game.css').read_text()
assert '#screen-select #party-list.party-list' in css
assert 'flex-direction: column' in css
print('ok: selectors present')
PY
```

Expected: `ok: selectors present`

- [ ] **Step 4: Commit**

```bash
git add css/game.css
git commit -m "style: stack select party list vertically on wide viewports"
```

---

### Task 3: Wide-viewport row-card chrome

**Files:**
- Modify: `css/game.css` (same `@media (min-width: 721px)` block)

- [ ] **Step 1: Add row-card overrides scoped to select-screen party list**

Append inside the same `@media (min-width: 721px)` block:

```css
  #screen-select #party-list .party-card {
    flex: 0 0 auto;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    max-width: none;
    text-align: left;
    gap: 10px;
    padding: 8px 10px;
    min-height: 64px;
  }

  #screen-select #party-list .party-card .sprite-frame {
    width: 52px;
    height: 52px;
  }

  #screen-select #party-list .party-card img {
    width: 44px;
    height: 44px;
  }

  #screen-select #party-list .party-card > strong {
    flex: 1 1 auto;
    width: auto;
    font-size: 0.9rem;
  }

  #screen-select #party-list .party-card > .meta {
    position: static;
    margin-left: auto;
    padding: 2px 8px;
    background: rgba(0, 0, 0, 0.35);
    font-size: 0.75rem;
  }

  #screen-select #party-list .party-popover {
    border-radius: 10px;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px;
  }

  #screen-select #party-list .party-popover button {
    min-height: 28px;
    padding: 4px 8px;
    font-size: 0.78rem;
  }
```

Notes:
- Scope with `#screen-select #party-list` so `#pick-party`, `#items-target-list`, and mobile tiles are untouched.
- Keep `.party-card.in-battle` border/glow from base rules; no need to redeclare unless specificity fights.

- [ ] **Step 2: Confirm mobile base rules still define the tile rail**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import re
css = Path('css/game.css').read_text()
# Base .party-list (first occurrence) should still be row + overflow-x
m = re.search(r'\.party-list \{([^}]+)\}', css)
assert m, 'missing .party-list'
block = m.group(1)
assert 'flex-direction: row' in block
assert 'overflow-x: auto' in block
# Wide override exists
assert '#screen-select #party-list.party-list' in css
print('ok: base rail + wide override')
PY
```

Expected: `ok: base rail + wide override`

- [ ] **Step 3: Commit**

```bash
git add css/game.css
git commit -m "style: row-card party chrome for desktop select pane"
```

---

### Task 4: Cache bump + visual verification

**Files:**
- Modify: `index.html` (stylesheet query string)

- [ ] **Step 1: Bump CSS cache key**

In `index.html`, change the stylesheet href query (example current value `imgopt1` — use whatever is on the branch tip):

```html
<link rel="stylesheet" href="css/game.css?v=partydesk1" />
```

- [ ] **Step 2: Serve locally and check wide layout**

Run:

```bash
python3 -m http.server 9456 --bind 127.0.0.1
```

Open `http://127.0.0.1:9456/` in a viewport ≥721px wide (desktop or DevTools iPad width).

Checklist:
1. Select screen right pane shows vertical party rows (sprite left, name, Lv right).
2. No horizontal scrollbar on `#party-list`; overflowing party scrolls via the pane vertically.
3. Click a card: popover buttons usable (左移/右移/收回|上场/详情 as present).
4. `in-battle` / shiny / boss styling still visible.

- [ ] **Step 3: Check narrow layout**

In DevTools, set width ≤720px (or phone preset).

Checklist:
1. Party is still a single horizontal tile rail with `overflow-x` scroll.
2. Cards remain ~88px-wide tiles (column flex), not full-width rows.

- [ ] **Step 4: Check `#pick-party` unchanged**

Trigger pick-fighter screen; cards should still wrap as a tile grid (existing `#pick-party.party-list { flex-wrap: wrap }` behavior).

- [ ] **Step 5: Run unit tests (sanity)**

Run:

```bash
npm test
```

Expected: existing tests pass (no JS change).

- [ ] **Step 6: Commit**

```bash
git add index.html css/game.css
git commit -m "chore: bump css cache for desktop party list layout"
```

---

### Task 5: Popover fallback (only if Step 2/3 visual check fails)

**Files:**
- Modify: `css/game.css` and/or `js/game.js` only if popover is clipped or unusable on wide row cards

- [ ] **Step 1: Reproduce**

On wide viewport, open a party card popover. If buttons are clipped by `.pane-scroll` or too small to tap, continue; otherwise skip this whole task (no commit).

- [ ] **Step 2: Prefer CSS fix first**

If clipped because parent overflow hides absolute children incorrectly, ensure `#screen-select #party-list .party-card` keeps `position: relative` (already true) and popover stays `position: absolute; inset: 0` covering the taller row card. Increase row `min-height` if buttons need more room:

```css
  #screen-select #party-list .party-card.open {
    min-height: 88px;
  }
```

- [ ] **Step 3: Re-verify wide + narrow, then commit**

```bash
npm test
git add css/game.css
git commit -m "fix: keep party popover usable on desktop row cards"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| ≥721px vertical list, no horizontal scroll | Task 2, 3 |
| ≤720px keep tile rail | Task 2/3 scoping + Task 4 narrow check |
| Keep left/right select layout | unchanged (no HTML structure change) |
| Keep sort/recall/send/detail semantics | no JS change; Task 4 click check |
| `#pick-party` unchanged | Task 3 selector scope + Task 4 check |
| Cache bump / hard refresh | Task 4 |
| Popover not clipped | Task 3 popover CSS + Task 5 fallback |

## Placeholder / consistency review

- No TBD/TODO left in steps.
- Selectors consistently use `#screen-select #party-list` (and `#party-list.party-list` for the list container).
- Breakpoint remains `721px` / `720px` to match existing CSS.
