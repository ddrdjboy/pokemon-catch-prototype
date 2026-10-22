/** Class / silhouette-outline helpers for boss UI. */

export const BOSS_OUTLINE_COLOR = '#ff6b6b';
/** CSS px — 1px × 4-way is visible and thinner than the old 2px × 8-way halo. */
export const BOSS_OUTLINE_PX = 1;

export function spriteWrapClassName({ shiny = false, boss = false } = {}) {
  return `sprite-wrap${shiny ? ' shiny' : ''}${boss ? ' boss' : ''}`;
}

export function partyCardClassName({
  selectable = false,
  selected = false,
  shiny = false,
  boss = false,
} = {}) {
  return `party-card${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}${shiny ? ' shiny' : ''}${boss ? ' boss' : ''}`;
}

export function markerClassName({
  kind,
  shiny = false,
  boss = false,
  cleared = false,
} = {}) {
  return `marker ${kind}${shiny ? ' shiny' : ''}${boss ? ' boss' : ''}${cleared ? ' cleared' : ''}`;
}

/** Build a literal drop-shadow list (no calc/var) for mobile Safari compatibility. */
export function bossOutlineFilter(px = BOSS_OUTLINE_PX, color = BOSS_OUTLINE_COLOR) {
  const n = Number(px);
  const p = Number.isFinite(n) && n > 0 ? n : BOSS_OUTLINE_PX;
  return [
    `drop-shadow(-${p}px 0 0 ${color})`,
    `drop-shadow(${p}px 0 0 ${color})`,
    `drop-shadow(0 -${p}px 0 ${color})`,
    `drop-shadow(0 ${p}px 0 ${color})`,
  ].join(' ');
}

/** Apply outline filter vars so CSS `var(--boss-outline)` always resolves to literals. */
export function syncBossOutlineHairline(root = (typeof document !== 'undefined' ? document.documentElement : null), px = BOSS_OUTLINE_PX) {
  if (!root?.style) return px;
  const filter = bossOutlineFilter(px);
  root.style.setProperty('--boss-outline', filter);
  root.style.setProperty('--boss-outline-sm', filter);
  return px;
}

/** 4 cardinal offsets only — diagonals made the ring look thicker. */
export function bossOutlineOffsets(px = BOSS_OUTLINE_PX) {
  const n = Number(px);
  const p = Number.isFinite(n) && n > 0 ? n : BOSS_OUTLINE_PX;
  return [
    [-p, 0], [p, 0], [0, -p], [0, p],
  ];
}

/**
 * Paint a solid-color silhouette of `img` behind the eventual sprite draw.
 * Uses an offscreen canvas + source-in fill so the outline stays pure red
 * even when the main sprite is hue-shifted for shiny.
 */
export function paintBossSpriteOutline(ctx, img, dx, dy, dw, dh, {
  color = BOSS_OUTLINE_COLOR,
  px = BOSS_OUTLINE_PX,
} = {}) {
  if (!ctx || !img) return;
  const pad = Math.ceil(Math.max(1, px)) + 2;
  const tw = Math.ceil(dw) + pad * 2;
  const th = Math.ceil(dh) + pad * 2;
  if (!paintBossSpriteOutline._c) {
    paintBossSpriteOutline._c = document.createElement('canvas');
  }
  const t = paintBossSpriteOutline._c;
  if (t.width !== tw || t.height !== th) {
    t.width = tw;
    t.height = th;
  }
  const tctx = t.getContext('2d');
  tctx.clearRect(0, 0, tw, th);
  tctx.globalCompositeOperation = 'source-over';
  tctx.drawImage(img, pad, pad, dw, dh);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = color;
  tctx.fillRect(0, 0, tw, th);
  tctx.globalCompositeOperation = 'source-over';
  for (const [ox, oy] of bossOutlineOffsets(px)) {
    ctx.drawImage(t, dx - pad + ox, dy - pad + oy);
  }
}
