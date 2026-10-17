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

- Prefer **species fight-frame strips** on the attacker’s main sprite (not only type VFX).
- POC species: `charmander`, `scorbunny` — 5 frames under `assets/fx/fighters/<id>/frame_0..4.png`.
- Play frames on attacker → defender hit flash + type burst.
- Player/ally side flips frames horizontally so the strike reads toward the foe.
- Other species or missing frames: fall back to medium.
- Ally chips: flash only (no body strip on chips).

## Assets (heavy POC)

- Fighter strips: `assets/fx/fighters/charmander/`, `assets/fx/fighters/scorbunny/` (192×192, magenta-keyed).
- Legacy type bursts under `assets/fx/{fire,water,electric}/` remain optional medium/heavy accent only.

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
