# Battle Animation POC Design

Date: 2026-10-06  
Status: approved for implementation

## Goal

Add switchable battle animation tiers (POC) so players can compare feedback intensity without changing combat math.

## Settings (global)

- Entry: main header control next to 图鉴 / 商店 (same pattern as catch style — global, not in-battle).
- Field: `state.battleAnim` persisted with save data.
- Values: `off` | `light` | `medium` | `heavy`.
- Default: `light`.
- Changing mid-battle applies from the next Attack press.
- Optional: respect `prefers-reduced-motion` by clamping to `off` or `light`.

Labels (UI):

| Value | Label |
|-------|-------|
| `off` | 关闭 |
| `light` | 轻量 |
| `medium` | 中度 |
| `heavy` | 重度 |

Helper copy: 重度仅火/水/电有专属帧动画，其余属性用中度特效。

## Architecture

Keep damage/turn resolution pure; decorate presentation only.

| Layer | Responsibility |
|-------|----------------|
| `js/battle.js` | Unchanged combat math / turn logs |
| `js/game.js` `playTurnHits` | Drive hit sequence; `await battleFx.playHit(...)` per log line before HP settle / gaps |
| `js/battle-fx.js` (new) | Mode-aware timelines; DOM + optional canvas/frame FX |
| `assets/fx/<type>/` | Heavy POC frame strips for `fire`, `water`, `electric` only |

`battleFx` must not mutate HP or save state.

### API (conceptual)

```js
await battleFx.playHit({
  side,           // 'player' | 'foe' | 'ally'
  moveType,       // species move type string
  attackerEl,     // Element | null
  defenderEl,     // Element | null
  damage,
  mode,           // off | light | medium | heavy
});
```

`off` resolves immediately (current log + HP bar behavior only).

## Tier behaviors

### Light (`light`)

- Attacker: short translate toward defender (~12–20px, ~120ms out-and-back).
- Defender: shake 2–3 times + brief flash (opacity / filter).
- HP bar: keep / slightly smooth existing transition.

### Medium (`medium`)

- Includes light.
- Overlay short VFX on defender (CSS or lightweight canvas): type-tinted burst/ring (~250–400ms).
- Type colors: fire orange, water blue, electric yellow, grass green, etc. Unknown type → neutral white/yellow.

### Heavy (`heavy`)

- Includes medium.
- If `moveType` is `fire` | `water` | `electric`: play 4–6 frame sprite sequence between attacker/defender (~300–500ms), then hit react.
- Other types: fall back to medium.
- Missing/failed frame load: fall back to medium (no throw).

Squad allies: full FX on main battlefield sprites; ally chips get a brief flash only.

## Assets (heavy POC)

- Paths: `assets/fx/fire/`, `assets/fx/water/`, `assets/fx/electric/`.
- Prefer 8-bit style, magenta-keyed transparent PNGs (game-pixel-art / pixel_export), sized for overlay (e.g. 96×96 or 128×128 frames).
- Exactly one short strip per type for POC (not per species).

## Data flow

1. Attack → `resolveTurn` / `resolveSquadTurn` (unchanged).
2. For each hit log: append log → `await battleFx.playHit` → update HP UI → gap.
3. Outcome / switch / catch flow unchanged.

## Testing

- Unit: mode normalization; heavy→medium fallback when frames missing; `off` resolves without delay.
- Manual: same fire-type battle under all four modes; persist setting across reload.

## Out of scope

- Rewriting battle to full canvas.
- Frame strips for every type/species.
- In-battle settings panel.
- Audio.
