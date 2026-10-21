# 灵堂小地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 灵堂视口右上角用 Canvas 显示整层缩略图（墙/地板/楼梯/玩家），纯展示不可点。

**Architecture:** 纯函数 `paintMazeMinimap(ctx, run, size)` 放在 `js/maze-minimap.js`，用 mock canvas 做 Node 测试。`game.js` 在 `renderMaze` / `syncMazePlayer` 时取 `#maze-minimap` 的 2d context 调用绘制。CSS 绝对定位右上角、`pointer-events: none`。

**Tech Stack:** 原生 Canvas 2D、现有 `mazeRun`、Node 断言测试

**Spec:** `docs/superpowers/specs/2026-10-21-spirit-hall-minimap-design.md`

---

### Task 1: paintMazeMinimap 纯函数 + 测试

**Files:**
- Create: `js/maze-minimap.js`
- Modify: `tests/battle-catch.test.js`

- [x] **Step 1: Write the failing test**

在 `tests/battle-catch.test.js` import 区追加：

```js
import { paintMazeMinimap, MAZE_MINIMAP_SIZE } from '../js/maze-minimap.js';
```

在 `spirit hall maze` 段落后追加：

```js
console.log('spirit hall minimap');
{
  const ops = [];
  const ctx = {
    canvas: { width: 0, height: 0 },
    fillStyle: '',
    clearRect(...a) { ops.push(['clear', ...a]); },
    fillRect(...a) { ops.push(['fill', this.fillStyle, ...a]); },
  };
  const run = {
    grid: [
      ['wall', 'wall', 'wall'],
      ['wall', 'floor', 'stairs'],
      ['wall', 'wall', 'wall'],
    ],
    player: { x: 1, y: 1 },
    stairs: { x: 2, y: 1 },
  };
  paintMazeMinimap(ctx, run, 90);
  assert(ctx.canvas.width === 90 && ctx.canvas.height === 90, 'sets canvas size');
  assert(ops.some((o) => o[0] === 'clear'), 'clears canvas');
  assert(ops.some((o) => o[0] === 'fill' && o[1] === '#ffd54f'), 'paints stairs gold');
  assert(ops.some((o) => o[0] === 'fill' && o[1] === '#4fc3f7'), 'paints player cyan');
  assert(ops.filter((o) => o[0] === 'fill' && o[1] === '#2a3340').length >= 7, 'paints walls');
  assert(paintMazeMinimap(ctx, null) === false, 'null run is no-op');
  assert(MAZE_MINIMAP_SIZE === 104, 'default size constant');
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — cannot find module `../js/maze-minimap.js`

- [x] **Step 3: Write minimal implementation**

Create `js/maze-minimap.js`:

```js
export const MAZE_MINIMAP_SIZE = 104;

const COLORS = {
  bg: 'rgba(10, 12, 18, 0.72)',
  wall: '#2a3340',
  floor: '#6b7c8f',
  stairs: '#ffd54f',
  player: '#4fc3f7',
};

/** Paint a spirit-hall overview onto a 2d canvas context. */
export function paintMazeMinimap(ctx, run, size = MAZE_MINIMAP_SIZE) {
  if (!ctx || !run?.grid?.length) return false;
  const h = run.grid.length;
  const w = run.grid[0].length;
  if (!w) return false;
  ctx.canvas.width = size;
  ctx.canvas.height = size;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, size, size);
  const cell = Math.min(size / w, size / h);
  const ox = (size - cell * w) / 2;
  const oy = (size - cell * h) / 2;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const kind = run.grid[y][x];
      ctx.fillStyle = kind === 'wall' ? COLORS.wall : kind === 'stairs' ? COLORS.stairs : COLORS.floor;
      ctx.fillRect(ox + x * cell, oy + y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  if (run.stairs) {
    ctx.fillStyle = COLORS.stairs;
    ctx.fillRect(ox + run.stairs.x * cell, oy + run.stairs.y * cell, Math.ceil(cell), Math.ceil(cell));
  }
  if (run.player) {
    const pad = cell * 0.2;
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(
      ox + run.player.x * cell + pad,
      oy + run.player.y * cell + pad,
      Math.max(1, cell - pad * 2),
      Math.max(1, cell - pad * 2),
    );
  }
  return true;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS including `spirit hall minimap` asserts.

---

### Task 2: DOM + CSS + wire into game.js

**Files:**
- Modify: `index.html`
- Modify: `css/game.css`
- Modify: `js/game.js`

- [x] **Step 1: Add canvas in viewport**

In `index.html` inside `#maze-viewport`, after `.maze-crosshair`, add:

```html
<canvas id="maze-minimap" class="maze-minimap" width="104" height="104" aria-hidden="true"></canvas>
```

Also add importmap entry and bump cache keys:

- Add `"./js/maze-minimap.js": "./js/maze-minimap.js?v=minimap1"`
- Bump `css/game.css?v=` and `js/game.js?v=` (script + importmap game.js) to `minimap1`

- [x] **Step 2: CSS**

After `.maze-crosshair { ... }` block in `css/game.css`, add:

```css
.maze-minimap {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 104px;
  height: 104px;
  z-index: 8;
  pointer-events: none;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
  background: rgba(10, 12, 18, 0.72);
  image-rendering: pixelated;
}
@media (max-width: 720px) {
  .maze-minimap {
    width: 88px;
    height: 88px;
  }
}
```

- [x] **Step 3: Wire game.js**

Import:

```js
import { paintMazeMinimap, MAZE_MINIMAP_SIZE } from './maze-minimap.js';
```

Add helper near maze render helpers:

```js
function refreshMazeMinimap() {
  const canvas = $('maze-minimap');
  if (!canvas || !mazeRun) return;
  const cssW = parseFloat(getComputedStyle(canvas).width) || MAZE_MINIMAP_SIZE;
  const size = Math.round(cssW) || MAZE_MINIMAP_SIZE;
  const ctx = canvas.getContext('2d');
  paintMazeMinimap(ctx, mazeRun, size);
}
```

Call `refreshMazeMinimap()` at end of `renderMaze()` and at end of `syncMazePlayer()`.

- [x] **Step 4: Run tests**

Run: `npm test`

Expected: all pass.

- [ ] **Step 5: Manual check**

Enter spirit hall — top-right minimap shows layout; walk — player dot moves; stick/tap still work.

- [ ] **Step 6: Commit**（用户要求时）

```bash
git add js/maze-minimap.js tests/battle-catch.test.js index.html css/game.css js/game.js docs/superpowers/specs/2026-10-21-spirit-hall-minimap-design.md docs/superpowers/plans/2026-10-21-spirit-hall-minimap.md
git commit -m "$(cat <<'EOF'
feat: add spirit hall canvas minimap

EOF
)"
```
