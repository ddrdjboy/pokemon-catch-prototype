/** Class / geometry helpers for boss red-outline UI (see design spec). */

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

/** Ellipse stroke params for catch-canvas boss aura (container-style, not eyes). */
export function bossAuraEllipse({ x, y, size }) {
  return {
    cx: x,
    cy: y,
    rx: size * 0.55,
    ry: size * 0.48,
    color: '#ff6b6b',
    lineWidth: 2,
  };
}
