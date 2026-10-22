/** Class / silhouette-outline helpers for boss UI. */

export const BOSS_OUTLINE_COLOR = '#ff6b6b';
/** Logical CSS fallback; prefer syncBossOutlineHairline() → 1 device pixel. */
export const BOSS_OUTLINE_PX = 0.5;

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

/** CSS px for ~1 physical pixel (avoids fat rings on retina). */
export function bossOutlineCssPx(dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1)) {
  const ratio = Math.max(1, Number(dpr) || 1);
  return 1 / ratio;
}

/** Set --boss-o so drop-shadow hairline tracks devicePixelRatio. */
export function syncBossOutlineHairline(root = (typeof document !== 'undefined' ? document.documentElement : null), dpr) {
  if (!root?.style) return bossOutlineCssPx(dpr);
  const px = bossOutlineCssPx(dpr);
  root.style.setProperty('--boss-o', `${px}px`);
  return px;
}

/** 4 cardinal offsets only — diagonals made the ring look ~2× thicker. */
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
  px = bossOutlineCssPx(),
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
