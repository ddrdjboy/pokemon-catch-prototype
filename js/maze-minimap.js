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
