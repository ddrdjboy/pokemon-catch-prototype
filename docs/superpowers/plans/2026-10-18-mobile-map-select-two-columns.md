# Mobile Map Select Two Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile web (viewport ≤720px), the map selection grid shows exactly two map cards per row.

**Architecture:** One-line CSS change inside the existing `@media (max-width: 720px)` block in `css/game.css`. Desktop grid rules stay untouched. No JS or HTML changes.

**Tech Stack:** Vanilla CSS (existing `game.css` mobile breakpoint).

**Spec:** `docs/superpowers/specs/2026-10-18-mobile-map-select-two-columns-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `css/game.css` | Mobile `.map-cards` column count (`repeat(2, 1fr)`) |

Do **not** change `.map-card img` height, `.meta` typography, desktop `.map-cards`, or any JS/HTML.

---

### Task 1: Mobile two-column map grid

**Files:**
- Modify: `css/game.css` (inside `@media (max-width: 720px)`, around lines 1330–1332)

- [ ] **Step 1: Confirm current single-column rule**

Run:

```bash
rg -n "grid-template-columns" css/game.css
```

Expected: inside the `max-width: 720px` block, `.map-cards` has `grid-template-columns: 1fr;`. Base (non-media) rule remains `repeat(auto-fill, minmax(220px, 1fr))`.

- [ ] **Step 2: Change mobile grid to two columns**

In `css/game.css`, inside `@media (max-width: 720px)`, replace:

```css
  .map-cards {
    grid-template-columns: 1fr;
  }
```

with:

```css
  .map-cards {
    grid-template-columns: repeat(2, 1fr);
  }
```

Do not edit the `.map-card img { height: 100px; }` rule in the same media block.

- [ ] **Step 3: Verify CSS values**

Run:

```bash
rg -n -A2 "^\.map-cards|^  \.map-cards" css/game.css
```

Expected:
- Base `.map-cards` still uses `repeat(auto-fill, minmax(220px, 1fr))`
- Mobile `.map-cards` uses `repeat(2, 1fr)`
- No other `.map-cards` column overrides

- [ ] **Step 4: Manual visual check**

Open the game in a browser (or DevTools device mode) with viewport width ≤720px on the 选择地图 screen.

Expected:
- Map cards render two per row
- Card image height and meta text look the same as before (only width shrinks)
- Widen past 720px: desktop multi-column `auto-fill` behavior unchanged

- [ ] **Step 5: Commit**

```bash
git add css/game.css
git commit -m "$(cat <<'EOF'
fix(ui): show two map cards per row on mobile web

EOF
)"
```
