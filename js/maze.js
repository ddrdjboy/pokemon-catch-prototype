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
    const candidates = floors.filter((c) => {
      const key = `${c.x},${c.y}`;
      return !used.has(key) && grid[c.y][c.x] !== 'stairs';
    });
    if (!candidates.length) break;
    const c = pick(rng, candidates);
    const key = `${c.x},${c.y}`;
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
 * event: null | { type: 'roamer', roamer } | { type: 'stairs' }
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

/**
 * Four-direction path from the player to (tx, ty).
 * Walls are blocked. Floor, stairs, and roamer tiles are walkable.
 * Returns the cells to enter, excluding the current cell.
 * Empty when the target is the current cell, a wall, out of bounds, or unreachable.
 */
export function findMazePath(run, tx, ty) {
  const sx = run.player.x;
  const sy = run.player.y;
  if (sx === tx && sy === ty) return [];
  const grid = run.grid;
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (tx < 0 || ty < 0 || tx >= w || ty >= h) return [];
  const target = grid[ty][tx];
  if (!target || target === 'wall') return [];

  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [[sx, sy]];
  const seen = new Set([key(sx, sy)]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let found = false;
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) {
      found = true;
      break;
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const cell = grid[ny][nx];
      if (!cell || cell === 'wall') continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!found) return [];

  const path = [];
  let cx = tx;
  let cy = ty;
  while (!(cx === sx && cy === sy)) {
    path.push({ x: cx, y: cy });
    const from = prev.get(key(cx, cy));
    cx = from[0];
    cy = from[1];
  }
  path.reverse();
  return path;
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

export function buildRoamerEncounter(roamer) {
  return {
    id: `spirit-roamer-${roamer.id}`,
    kind: 'wild',
    speciesId: roamer.speciesId,
    level: roamer.level,
    shiny: false,
    boss: false,
    pokemon: null,
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
