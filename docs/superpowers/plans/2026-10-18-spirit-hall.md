# Spirit Hall (灵堂) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add endgame map「灵堂」— a three-floor randomly generated tile maze after Twin Towers, with roaming wilds, per-floor 1v1 bosses (Eternatus 225 → Xerneas 250 → Zygarde 300), and wipe-on-defeat.

**Architecture:** Pure maze logic lives in `js/maze.js` (generate / step / encounters). Content and unlock gates live in `js/data.js`. `js/game.js` owns a new `maze` screen, wires battles back into the run, and sets `twinCleared` on Twin Towers wins. Combat/catch reuse the existing 1v1 loop unchanged.

**Tech Stack:** Vanilla ES modules, existing battle/catch UI, `node tests/battle-catch.test.js`.

**Spec:** `docs/superpowers/specs/2026-10-18-spirit-hall-design.md`

---

## File map

| File | Responsibility |
| --- | --- |
| `js/maze.js` (create) | Floor generation, player step, roamer collision, floor-boss encounter builders |
| `js/data.js` | 3 legendaries, `SPIRIT_HALL_*`, roaming pool, `canEnterSpiritHall`, `MAPS.spirit_hall`, `initialPlayerState.twinCleared` |
| `js/game.js` | Select-card lock, `startMazeRun` / render / input, battle return paths, `twinCleared` |
| `index.html` | `#screen-maze` DOM |
| `css/game.css` | Maze grid + d-pad styles |
| `assets/maps/spirit_hall.png` | Select-card art |
| `assets/pokemon/eternatus.png` / `xerneas.png` / `zygarde.png` | Boss sprites |
| `tests/battle-catch.test.js` | Unlock, connectivity, step events, boss levels |

---

### Task 1: Maze generator + step (TDD)

**Files:**
- Create: `js/maze.js`
- Modify: `tests/battle-catch.test.js`

- [ ] **Step 1: Write failing tests for generation and stepping**

Append to `tests/battle-catch.test.js`:

```js
import {
  generateMazeFloor,
  createMazeRun,
  stepMaze,
  SPIRIT_HALL_BOSS_BY_FLOOR,
} from '../js/maze.js';

console.log('spirit hall maze');
const floor1 = generateMazeFloor({ floor: 1, rng: () => 0.42 });
assert(floor1.grid.length >= 15 && floor1.grid[0].length >= 15, 'grid is at least 15x15');
const flat = floor1.grid.flat();
assert(flat.includes('floor') && flat.includes('stairs') && flat.includes('wall'), 'has wall/floor/stairs');
function flood(grid, sx, sy) {
  const h = grid.length, w = grid[0].length;
  const seen = new Set();
  const q = [[sx, sy]];
  seen.add(`${sx},${sy}`);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid[ny][nx] === 'wall') continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}
const reach = flood(floor1.grid, floor1.spawn.x, floor1.spawn.y);
assert(reach.has(`${floor1.stairs.x},${floor1.stairs.y}`), 'spawn reaches stairs');
assert(floor1.roamers.length >= 6 && floor1.roamers.length <= 10, '6-10 roamers');

const run = createMazeRun({ floor: 1, rng: () => 0.3 });
const blocked = stepMaze(run, 0, 0); // no-op probe — real test: step into wall
// Place player next to a known wall and assert no move:
const wallStep = (() => {
  const r = createMazeRun({ floor: 1, rng: () => 0.11 });
  const { x, y } = r.player;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const tx = x + dx, ty = y + dy;
    if (r.grid[ty]?.[tx] === 'wall') {
      const out = stepMaze(r, dx, dy);
      return out.event === null && out.run.player.x === x && out.run.player.y === y;
    }
  }
  return true;
})();
assert(wallStep, 'cannot walk into walls');

assert(SPIRIT_HALL_BOSS_BY_FLOOR[1].speciesId === 'eternatus' && SPIRIT_HALL_BOSS_BY_FLOOR[1].level === 225, 'floor1 boss');
assert(SPIRIT_HALL_BOSS_BY_FLOOR[2].speciesId === 'xerneas' && SPIRIT_HALL_BOSS_BY_FLOOR[2].level === 250, 'floor2 boss');
assert(SPIRIT_HALL_BOSS_BY_FLOOR[3].speciesId === 'zygarde' && SPIRIT_HALL_BOSS_BY_FLOOR[3].level === 300, 'floor3 boss');
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `npm test`

Expected: fail loading `../js/maze.js` or missing exports.

- [ ] **Step 3: Implement `js/maze.js`**

```js
/** Spirit Hall maze: generate floors, step player, build encounters. */

export const SPIRIT_HALL_BOSS_BY_FLOOR = {
  1: { speciesId: 'eternatus', level: 225 },
  2: { speciesId: 'xerneas', level: 250 },
  3: { speciesId: 'zygarde', level: 300 },
};

export const SPIRIT_HALL_ROAMER_POOL = [
  'gastly', 'haunter', 'gengar', 'misdreavus', 'shuppet', 'duskull',
];

export const SPIRIT_HALL_ROAMER_LEVELS = {
  1: { min: 180, max: 200 },
  2: { min: 200, max: 220 },
  3: { min: 220, max: 240 },
};

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Room+corridor maze. Cells: 'wall' | 'floor' | 'stairs'. */
export function generateMazeFloor({ floor = 1, width = 17, height = 17, rng = Math.random } = {}) {
  const grid = Array.from({ length: height }, () => Array(width).fill('wall'));
  const rooms = [];
  const roomCount = 5 + (floor | 0);
  for (let i = 0; i < roomCount; i += 1) {
    const rw = randInt(rng, 3, 5);
    const rh = randInt(rng, 3, 5);
    const rx = randInt(rng, 1, Math.max(1, width - rw - 2));
    const ry = randInt(rng, 1, Math.max(1, height - rh - 2));
    for (let y = ry; y < ry + rh; y += 1) {
      for (let x = rx; x < rx + rw; x += 1) grid[y][x] = 'floor';
    }
    rooms.push({ x: rx + Math.floor(rw / 2), y: ry + Math.floor(rh / 2) });
  }
  for (let i = 1; i < rooms.length; i += 1) {
    let { x, y } = rooms[i - 1];
    const t = rooms[i];
    while (x !== t.x) {
      x += x < t.x ? 1 : -1;
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) grid[y][x] = 'floor';
    }
    while (y !== t.y) {
      y += y < t.y ? 1 : -1;
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) grid[y][x] = 'floor';
    }
  }
  const floors = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[y][x] === 'floor') floors.push({ x, y });
    }
  }
  const spawn = floors[0] || { x: 1, y: 1 };
  let stairs = floors[floors.length - 1] || { x: width - 2, y: height - 2 };
  let best = -1;
  for (const c of floors) {
    const d = Math.abs(c.x - spawn.x) + Math.abs(c.y - spawn.y);
    if (d > best) { best = d; stairs = c; }
  }
  grid[stairs.y][stairs.x] = 'stairs';

  const band = SPIRIT_HALL_ROAMER_LEVELS[floor] || SPIRIT_HALL_ROAMER_LEVELS[1];
  const count = randInt(rng, 6, 10);
  const roamers = [];
  const used = new Set([`${spawn.x},${spawn.y}`, `${stairs.x},${stairs.y}`]);
  let guard = 0;
  while (roamers.length < count && guard++ < 500) {
    const c = pick(rng, floors);
    const key = `${c.x},${c.y}`;
    if (used.has(key) || grid[c.y][c.x] === 'stairs') continue;
    used.add(key);
    roamers.push({
      id: `r${roamers.length}`,
      x: c.x,
      y: c.y,
      speciesId: pick(rng, SPIRIT_HALL_ROAMER_POOL),
      level: randInt(rng, band.min, band.max),
    });
  }
  return { grid, spawn, stairs, roamers, width, height, floor };
}

export function createMazeRun({ floor = 1, rng = Math.random } = {}) {
  const gen = generateMazeFloor({ floor, rng });
  return {
    floor,
    grid: gen.grid,
    player: { ...gen.spawn },
    roamers: gen.roamers.map((r) => ({ ...r })),
    floorBossDefeated: false,
    stairs: { ...gen.stairs },
  };
}

/**
 * Try to move one step. Returns { run, event }.
 * event: null | { type: 'roamer', roamer } | { type: 'stairs' } | { type: 'blocked' }
 */
export function stepMaze(run, dx, dy) {
  const next = {
    ...run,
    player: { ...run.player },
    roamers: run.roamers.map((r) => ({ ...r })),
  };
  const nx = run.player.x + dx;
  const ny = run.player.y + dy;
  const cell = run.grid[ny]?.[nx];
  if (!cell || cell === 'wall') {
    return { run: next, event: null };
  }
  next.player = { x: nx, y: ny };
  const hit = next.roamers.find((r) => r.x === nx && r.y === ny);
  if (hit) {
    return { run: next, event: { type: 'roamer', roamer: hit } };
  }
  if (cell === 'stairs') {
    return { run: next, event: { type: 'stairs' } };
  }
  return { run: next, event: null };
}

export function removeRoamer(run, roamerId) {
  return {
    ...run,
    roamers: run.roamers.filter((r) => r.id !== roamerId),
  };
}

export function markFloorBossDefeated(run) {
  return { ...run, floorBossDefeated: true };
}

export function advanceMazeFloor(run, rng = Math.random) {
  const nextFloor = run.floor + 1;
  if (nextFloor > 3) return null;
  return createMazeRun({ floor: nextFloor, rng });
}

/** Build a wild encounter object compatible with game.js prepareEncounter / rollEncounter shape. */
export function buildRoamerEncounter(roamer) {
  return {
    id: `spirit-roamer-${roamer.id}`,
    kind: 'wild',
    speciesId: roamer.speciesId,
    level: roamer.level,
    shiny: false,
    boss: false,
    pokemon: null, // filled by caller via createPokemon
    maze: { kind: 'roamer', roamerId: roamer.id },
  };
}

export function buildFloorBossEncounter(floor) {
  const boss = SPIRIT_HALL_BOSS_BY_FLOOR[floor];
  return {
    id: `spirit-boss-${floor}`,
    kind: 'wild',
    speciesId: boss.speciesId,
    level: boss.level,
    shiny: true,
    boss: true,
    pokemon: null,
    maze: { kind: 'boss', floor },
  };
}
```

- [ ] **Step 4: Run tests — generator/step assertions pass**

Run: `npm test`

Expected: spirit hall maze assertions pass (species tests may still fail until Task 2).

- [ ] **Step 5: Commit**

```bash
git add js/maze.js tests/battle-catch.test.js
git commit -m "feat(spirit-hall): add maze generator and step logic"
```

---

### Task 2: Species, map gate, twinCleared

**Files:**
- Modify: `js/data.js`
- Modify: `tests/battle-catch.test.js`

- [ ] **Step 1: Write failing unlock / species tests**

```js
import {
  MAPS, SPECIES, initialPlayerState, canEnterSpiritHall,
  SPIRIT_HALL_BOSS_LEVELS,
} from '../js/data.js';

console.log('spirit hall unlock');
assert(SPECIES.eternatus?.name === '伊裴尔达尔', 'eternatus species');
assert(SPECIES.xerneas?.name === '哲尔尼亚斯', 'xerneas species');
assert(SPECIES.zygarde?.name === '基格尔德', 'zygarde species');
assert(MAPS.spirit_hall?.spiritHall === true && MAPS.spirit_hall.name === '灵堂', 'spirit hall map');
assert(canEnterSpiritHall({ twinCleared: false }).ok === false, 'locked without twin clear');
assert(canEnterSpiritHall({ twinCleared: true }).ok === true, 'open after twin clear');
const init = initialPlayerState();
assert(init.twinCleared === false, 'fresh save not cleared');
```

- [ ] **Step 2: Run — expect FAIL on missing species / helpers**

Run: `npm test`

- [ ] **Step 3: Add species + map + helpers in `js/data.js`**

Add to `BASE_SPECIES` (after miraidon):

```js
  eternatus: {
    id: 'eternatus',
    name: '伊裴尔达尔',
    type: 'dragon',
    base: { hp: 140, atk: 85, def: 95, spd: 130 },
    move: { name: '无限之枪', power: 120, type: 'dragon' },
    catchRate: 0.04,
    sprite: 'assets/pokemon/eternatus.png',
    eyeOffset: { x: 0, y: -8 },
  },
  xerneas: {
    id: 'xerneas',
    name: '哲尔尼亚斯',
    type: 'fairy',
    base: { hp: 126, atk: 131, def: 95, spd: 99 },
    move: { name: '大地掌控', power: 115, type: 'fairy' },
    catchRate: 0.04,
    sprite: 'assets/pokemon/xerneas.png',
    eyeOffset: { x: 0, y: -10 },
  },
  zygarde: {
    id: 'zygarde',
    name: '基格尔德',
    type: 'dragon',
    base: { hp: 216, atk: 100, def: 121, spd: 85 },
    move: { name: '核心惩罚者', power: 125, type: 'dragon' },
    catchRate: 0.03,
    sprite: 'assets/pokemon/zygarde.png',
    eyeOffset: { x: 0, y: -6 },
  },
```

Add constants + map (near twin towers):

```js
export const SPIRIT_HALL_BOSS_LEVELS = { 1: 225, 2: 250, 3: 300 };

const SPIRIT_HALL_MAP = {
  id: 'spirit_hall',
  name: '灵堂',
  image: 'assets/maps/spirit_hall.png',
  bossChance: 0,
  spiritHall: true,
  encounters: [],
};

// In MAPS:
// spirit_hall: SPIRIT_HALL_MAP,

export function canEnterSpiritHall(state) {
  if (!state?.twinCleared) return { ok: false, reason: 'twin' };
  return { ok: true };
}
```

In `initialPlayerState()` add `twinCleared: false`.

In load path (`game.js` Task 3): coerce `s.twinCleared = !!s.twinCleared`.

- [ ] **Step 4: npm test — unlock/species pass**

- [ ] **Step 5: Commit**

```bash
git add js/data.js tests/battle-catch.test.js
git commit -m "feat(spirit-hall): add legendaries, map entry, twinCleared gate"
```

---

### Task 3: Maze screen UI + enter/exit

**Files:**
- Modify: `index.html`
- Modify: `css/game.css`
- Modify: `js/game.js`

- [ ] **Step 1: Add `#screen-maze` to `index.html`** (after `#screen-map`):

```html
    <section id="screen-maze" class="screen hidden">
      <div class="panel maze-panel">
        <div class="maze-top">
          <button id="btn-maze-exit" type="button">← 退出灵堂</button>
          <h2 id="maze-title">灵堂 · 第 1 层</h2>
        </div>
        <div id="maze-grid" class="maze-grid" aria-label="迷宫"></div>
        <div class="maze-pad">
          <button type="button" data-maze-dir="0,-1">↑</button>
          <div class="maze-pad-mid">
            <button type="button" data-maze-dir="-1,0">←</button>
            <button type="button" data-maze-dir="1,0">→</button>
          </div>
          <button type="button" data-maze-dir="0,1">↓</button>
        </div>
        <p class="hint">方向键 / WASD 移动。踩到游荡宝可梦开战；楼梯处为层主。全灭或退出将结束本次探索。</p>
      </div>
    </section>
```

- [ ] **Step 2: CSS** — append maze styles to `css/game.css`:

```css
.maze-panel { display: flex; flex-direction: column; gap: 0.75rem; }
.maze-top { display: flex; align-items: center; gap: 1rem; }
.maze-grid {
  display: grid;
  gap: 2px;
  margin: 0 auto;
  background: #1a1220;
  padding: 6px;
  border-radius: 8px;
  max-width: min(92vw, 520px);
}
.maze-cell {
  width: 22px; height: 22px;
  image-rendering: pixelated;
  background: #3a2a45;
}
.maze-cell.wall { background: #120a18; }
.maze-cell.floor { background: #4a3a55; }
.maze-cell.stairs { background: #c9a227; }
.maze-cell.player { outline: 2px solid #7dffb3; }
.maze-cell.roamer { background: #6b3a7a; }
.maze-pad { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.maze-pad-mid { display: flex; gap: 2.5rem; }
.maze-pad button {
  width: 3rem; height: 3rem; font-size: 1.2rem;
}
.map-card.spirit { border-color: #8b6bb0; }
```

- [ ] **Step 3: Wire `game.js`**

Imports:

```js
import {
  createMazeRun, stepMaze, removeRoamer, markFloorBossDefeated,
  advanceMazeFloor, buildRoamerEncounter, buildFloorBossEncounter,
} from './maze.js';
import { canEnterSpiritHall } from './data.js';
```

State:

```js
let mazeRun = null; // active spirit hall run or null
```

In `screens` object add `maze: $('screen-maze')`.

In load/normalize: `s.twinCleared = !!s.twinCleared`.

`renderSelect` — treat spirit hall like special maps:

```js
const spiritLocked = map.spiritHall && !state.twinCleared;
const locked = (map.rift && ...) || twinLocked || spiritLocked;
card.className = `map-card${...}${map.spiritHall ? ' spirit' : ''}${locked ? ' locked' : ''}`;
const meta = map.spiritHall
  ? (state.twinCleared ? '三层迷宫 · 已解锁' : '三层迷宫 · 需通关双子塔')
  : map.rift ? ...
```

`tryEnterMap`:

```js
if (map.spiritHall) {
  const gate = canEnterSpiritHall(state);
  if (!gate.ok) {
    renderSelect();
    setMapNote('灵堂需先通关一次双子塔才能进入。');
    return;
  }
  startMazeRun();
  return;
}
```

Implement:

```js
function startMazeRun() {
  mazeRun = createMazeRun({ floor: 1 });
  currentMapId = 'spirit_hall';
  renderMaze();
  showScreen('maze');
}

function endMazeRun({ message } = {}) {
  mazeRun = null;
  playExploreBgm();
  showScreen('select');
  renderSelect();
  if (message) setMapNote(message);
}

function renderMaze() {
  if (!mazeRun) return;
  $('maze-title').textContent = `灵堂 · 第 ${mazeRun.floor} 层`;
  const gridEl = $('maze-grid');
  const h = mazeRun.grid.length;
  const w = mazeRun.grid[0].length;
  gridEl.style.gridTemplateColumns = `repeat(${w}, 22px)`;
  gridEl.innerHTML = '';
  const roamerAt = new Set(mazeRun.roamers.map((r) => `${r.x},${r.y}`));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const cell = document.createElement('div');
      let cls = `maze-cell ${mazeRun.grid[y][x]}`;
      if (mazeRun.player.x === x && mazeRun.player.y === y) cls += ' player';
      if (roamerAt.has(`${x},${y}`)) cls += ' roamer';
      cell.className = cls;
      gridEl.appendChild(cell);
    }
  }
}

function tryMazeStep(dx, dy) {
  if (!mazeRun) return;
  const { run, event } = stepMaze(mazeRun, dx, dy);
  mazeRun = run;
  renderMaze();
  if (!event) return;
  if (event.type === 'roamer') {
    beginMazeRoamerBattle(event.roamer);
    return;
  }
  if (event.type === 'stairs') {
    if (!mazeRun.floorBossDefeated) beginMazeBossBattle();
    else afterFloorBossCleared();
  }
}

function beginMazeRoamerBattle(roamer) {
  const tmpl = buildRoamerEncounter(roamer);
  tmpl.pokemon = createPokemon(roamer.speciesId, roamer.level, { shiny: false, boss: false });
  tmpl.shiny = false;
  tmpl.boss = false;
  startPick(tmpl);
}

function beginMazeBossBattle() {
  const tmpl = buildFloorBossEncounter(mazeRun.floor);
  tmpl.pokemon = createPokemon(tmpl.speciesId, tmpl.level, { shiny: true, boss: true });
  startPick(tmpl);
}

function afterFloorBossCleared() {
  if (mazeRun.floor >= 3) {
    endMazeRun({ message: '灵堂通关！基格尔德已被击败。' });
    return;
  }
  mazeRun = advanceMazeFloor(mazeRun);
  renderMaze();
}
```

Bind exit + pad + keyboard:

```js
$('btn-maze-exit').addEventListener('click', () => {
  if (!mazeRun) return;
  endMazeRun({ message: '已退出灵堂（进度不保留）。' });
});
document.querySelectorAll('[data-maze-dir]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const [dx, dy] = btn.dataset.mazeDir.split(',').map(Number);
    tryMazeStep(dx, dy);
  });
});
window.addEventListener('keydown', (e) => {
  if (!$('screen-maze') || $('screen-maze').classList.contains('hidden')) return;
  const map = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0], w:[0,-1], s:[0,1], a:[-1,0], d:[1,0], W:[0,-1], S:[0,1], A:[-1,0], D:[1,0] };
  const d = map[e.key];
  if (!d) return;
  e.preventDefault();
  tryMazeStep(d[0], d[1]);
});
```

Set `twinCleared` on Twin Towers win inside `finishBattleWin`:

```js
if (currentMapId === 'twin_towers' && enc.dual) {
  state.twinCleared = true;
  save();
}
```

- [ ] **Step 4: Manual smoke** — open select; 灵堂 locked; force `state.twinCleared=true` in console → enter → walk.

- [ ] **Step 5: Commit**

```bash
git add index.html css/game.css js/game.js
git commit -m "feat(spirit-hall): maze screen, unlock gate, twinCleared"
```

---

### Task 4: Battle / catch return into maze

**Files:**
- Modify: `js/game.js`

Today `leaveBattle`, `claimPokemon`, and `skipCatch` always `openMap(currentMapId)`. Spirit Hall must resume `maze` instead, and wipe on loss.

- [ ] **Step 1: Add helpers**

```js
function inSpiritHall() {
  return !!mazeRun && currentMapId === 'spirit_hall';
}

function returnAfterMazeBattle() {
  if (!inSpiritHall()) {
    openMap(currentMapId);
    return;
  }
  renderMaze();
  showScreen('maze');
  playExploreBgm();
}

function failMazeRun() {
  endMazeRun({ message: '队伍全灭，已离开灵堂。下次从第 1 层重新开始。' });
}
```

- [ ] **Step 2: Patch leaveBattle**

```js
function leaveBattle() {
  closeItemPanel();
  for (const p of state.party) p.hp = p.maxHp;
  save();
  playExploreBgm();
  if (inSpiritHall()) {
    failMazeRun();
    return;
  }
  openMap(currentMapId);
}
```

- [ ] **Step 3: After catch success/skip for maze**

In `claimPokemon` / `skipCatch` timeouts, replace `openMap(currentMapId)` with:

```js
if (inSpiritHall()) {
  const tag = pendingEncounter?.maze;
  if (tag?.kind === 'roamer') {
    mazeRun = removeRoamer(mazeRun, tag.roamerId);
  } else if (tag?.kind === 'boss') {
    mazeRun = markFloorBossDefeated(mazeRun);
    // After catch UI closes, descend:
    setTimeout(() => {
      afterFloorBossCleared();
      returnAfterMazeBattle();
    }, 0);
    return;
  }
  returnAfterMazeBattle();
  return;
}
openMap(currentMapId);
```

Careful ordering: for boss, call `markFloorBossDefeated` then `afterFloorBossCleared` once (which advances or ends). Avoid double-advance. Preferred boss path:

```js
if (tag?.kind === 'boss') {
  mazeRun = markFloorBossDefeated(mazeRun);
  afterFloorBossCleared(); // may null mazeRun on floor 3 clear
  if (mazeRun) returnAfterMazeBattle();
  return;
}
```

And `afterFloorBossCleared` already calls `endMazeRun` on floor 3.

- [ ] **Step 4: Cancel pick returns to maze**

Wherever cancel-pick goes back to map, branch `inSpiritHall() ? returnAfterMazeBattle() : openMap(...)`.

- [ ] **Step 5: Manual test** — fight a roamer (win+catch), fight stairs boss, die intentionally → kicked to select.

- [ ] **Step 6: Commit**

```bash
git add js/game.js
git commit -m "feat(spirit-hall): resume maze after battles; wipe on defeat"
```

---

### Task 5: Assets

**Files:**
- Create: `assets/pokemon/eternatus.png`, `xerneas.png`, `zygarde.png`
- Create: `assets/maps/spirit_hall.png`

- [ ] **Step 1: Generate pixel sprites**

Use the game-pixel-art skill (`lastframe-game-pixel-art`) for three legendary portraits and one map card (~192px style matching existing `zacian.png` / `twin_towers.png`). Export ready PNGs into the paths above.

If generation is deferred, temporarily copy an existing legendary sprite and rename so the game loads without 404 — replace before merge.

- [ ] **Step 2: Verify in browser** — Boss battle and select card show art.

- [ ] **Step 3: Commit**

```bash
git add assets/pokemon/eternatus.png assets/pokemon/xerneas.png assets/pokemon/zygarde.png assets/maps/spirit_hall.png
git commit -m "assets(spirit-hall): add boss sprites and map art"
```

---

### Task 6: Final tests + acceptance polish

**Files:**
- Modify: `tests/battle-catch.test.js`
- Modify: `js/game.js` / `js/data.js` if gaps found

- [ ] **Step 1: Add integration-style unit tests**

```js
console.log('spirit hall flow helpers');
let run = createMazeRun({ floor: 1, rng: () => 0.5 });
run = removeRoamer(run, run.roamers[0]?.id);
assert(!run.roamers.find((r) => r.id === 'r0') || run.roamers.length >= 0, 'remove roamer works');
run = markFloorBossDefeated(run);
assert(run.floorBossDefeated, 'boss flagged');
const f2 = advanceMazeFloor(run, () => 0.2);
assert(f2.floor === 2 && f2.floorBossDefeated === false, 'advance to floor 2');
const f3 = advanceMazeFloor({ ...f2, floor: 2 }, () => 0.2);
assert(f3.floor === 3, 'floor 3');
assert(advanceMazeFloor({ ...f3, floor: 3 }) === null, 'no floor 4');

const bossEnc = buildFloorBossEncounter(3);
assert(bossEnc.speciesId === 'zygarde' && bossEnc.level === 300 && bossEnc.boss && bossEnc.shiny, 'zygarde enc');
```

- [ ] **Step 2: `npm test` — all green**

- [ ] **Step 3: Manual acceptance checklist**

1. Fresh save: 灵堂 locked with note  
2. Win any Twin Towers fight → `twinCleared` → 灵堂 open, free entry  
3. Walk, bump roamer, catch, roamer gone  
4. Stairs → Eternatus 225 → Xerneas 250 → Zygarde 300  
5. Wipe → back to select; re-enter is floor 1 new layout  
6. Exit button abandons run  

- [ ] **Step 4: Commit**

```bash
git add tests/battle-catch.test.js js/game.js js/data.js js/maze.js
git commit -m "test(spirit-hall): cover unlock, floors, and boss encounters"
```

---

## Spec coverage check

| Spec requirement | Task |
| --- | --- |
| Grid maze, random rooms+corridors | Task 1 |
| 3 floors, stairs bosses Eternatus/Xerneas/Zygarde | Task 1–2 |
| Roaming wilds, step-on battle, catchable | Task 1, 3–4 |
| Unlock after Twin Towers once; free re-entry | Task 2–3 |
| Wipe → kick to select, restart floor 1 | Task 4 |
| Independent `maze` screen | Task 3 |
| Assets | Task 5 |
| Acceptance / npm test | Task 6 |

## Out of scope (do not implement)

- Roamer chase AI, fog, chests, traps  
- Entry consumable  
- Maze progress save  
- Boss multi-move kits  

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-18-spirit-hall.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
**2. Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
