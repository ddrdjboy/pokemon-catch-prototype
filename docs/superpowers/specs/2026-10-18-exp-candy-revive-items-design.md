# Experience Candy & Revive Items Design

Date: 2026-10-18  
Status: approved for implementation

## Goal

Add consumable **experience candies** (five tiers) and **revive items** (活力碎片 / 活力块) to the unified item system. Players can buy them in the shop, use them in battle like heal items (auto-target, costs a turn), and use them out of battle via a same-style item entry with manual target selection.

## Decisions (from brainstorming)

- Unified `ITEMS` registry with typed effects (`heal` | `xp` | `revive`); not separate parallel registries.
- Usable **in battle and out of battle**.
- In battle: same panel as heal items; **auto-select** targets; using an item costs a turn.
- Out of battle: same-style item list, then party picker for the target.
- Revive: 活力碎片 = 50% HP, 活力块 = 100% HP.
- Exp candy tiers: S/M/L/XL/XXL → +100 / +400 / +1000 / +2500 / +6000.
- All new items sold in the shop at the prices below.
- Fainted mons may receive XP candy; after `gainExperience`, keep `hp = 0` (same as battle XP award path).

## Item catalog

| id | name | effect | param | price | icon |
|----|------|--------|-------|-------|------|
| potion | 伤药 | heal | 20 | 50 | 💊 |
| superPotion | 好伤药 | heal | 50 | 150 | 💉 |
| hyperPotion | 厉害伤药 | heal | 200 | 400 | 🧪 |
| maxPotion | 全满药 | heal | full | 800 | 🧴 |
| expCandyS | 经验糖果 S | xp | 100 | 200 | 🍬 |
| expCandyM | 经验糖果 M | xp | 400 | 700 | 🍬 |
| expCandyL | 经验糖果 L | xp | 1000 | 1600 | 🍭 |
| expCandyXL | 经验糖果 XL | xp | 2500 | 3500 | 🧁 |
| expCandyXXL | 经验糖果 XXL | xp | 6000 | 8000 | 🎂 |
| vitalityShard | 活力碎片 | revive | 0.5 | 1200 | 💠 |
| vitalityBlock | 活力块 | revive | 1 | 2800 | 💎 |

Existing heal prices and behavior stay unchanged. `HEAL_ITEMS` may remain as a thin alias/filter of heal-effect entries during migration, then be removed once call sites use `ITEMS`.

## Effect rules

| effect | Valid target | Result |
|--------|--------------|--------|
| heal | `hp > 0` and `hp < maxHp` | Restore fixed HP or full (current `applyHealItem`) |
| revive | `hp <= 0` | Set `hp` to `floor(maxHp * ratio)` (shard 0.5, block 1.0); minimum 1 if maxHp ≥ 1 |
| xp | any party mon | `gainExperience(mon, amount)`; if was fainted, force `hp = 0` after |

`applyItem(mon, itemId)` returns a small result object (e.g. `{ ok, kind, amount, logs }`) so UI can log consistently. Invalid target → `ok: false`, no inventory decrement.

## Usage flows

### In battle

1. `#btn-item` opens the shared item panel listing owned counts (`state.items[id] > 0`).
2. Enable the battle Item button when any owned item has a legal auto-target in the current battle context.
3. Auto-target:
   - **heal**: most-damaged conscious on-field mon (unchanged).
   - **revive**: first fainted on-field mon (slot order), else first fainted mon in `state.party` order among those eligible for the current battle mode.
   - **xp**: first conscious on-field mon (slot order).
4. On use: decrement stack, apply effect, append logs, resolve item turn (foe acts) via existing `resolveFoeOnlyTurn` / dual / squad helpers.
5. Failed apply (race / no target): do not consume item or turn.

### Out of battle

1. Party pane (`#party-pane`) gains an Item button that opens the same-style item list (visible outside battle).
2. Choose an owned item → party picker filtered by effect validity.
3. Apply immediately; no turn cost; persist via existing `save()`.
4. Show short feedback (heal amount / revived / XP + level-up / evolve lines from `gainExperience`).

### Shop

`renderShop` iterates all `ITEMS` (heal + candy + revive) with the same buy row pattern as today.

## State & persistence

- `state.items` holds counts for every item id.
- `emptyItems()` returns zeros for the full catalog.
- `initialPlayerState` / `hydrateState` use `emptyItems()` and merge saved counts; unknown keys ignored; missing keys default to 0.
- No separate `state` fields for candies or revives.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `js/data.js` | `ITEMS`, `emptyItems()`, `applyItem` (dispatch by effect); migrate heal helpers |
| `js/level.js` | Unchanged XP API (`gainExperience`, `xpToNext`) |
| `js/game.js` | Shop, battle item UI enable/list/use, out-of-battle item entry + target picker, hydrate/save |
| `js/battle.js` | Reuse existing item-turn resolvers; no new turn semantics |
| `index.html` / `css/game.css` | Out-of-battle entry + target picker markup/styles (reuse `.item-panel` / `.party-list`) |
| tests | Contract tests for apply rules and inventory keys |

Combat math for attacks stays untouched. Item use remains a full player action in battle.

## Out of scope

- Status cures, held items, berries with residual effects
- Manual target picking **in battle**
- Non-shop acquisition (drops, gifts)
- New SFX / pixel art icons (emoji icons for v1)
- Changing XP curve or battle XP rewards

## Testing

- `applyItem` heal: reject fainted / full HP; restore clamps to maxHp.
- `applyItem` revive: reject living; shard ≈ 50%, block = full; inventory not tested here.
- `applyItem` xp: adds exp; level-up/evolve messages; fainted stays at 0 HP after.
- Hydrate: old saves without new keys get 0 stock for candies/revives.
- Shop lists new items at agreed prices (smoke or unit on catalog).
- Existing heal item turn tests still pass.

## Success criteria

1. All seven new items appear in the shop at the listed prices and stack in `state.items`.
2. Battle: candies and revives usable from the item panel with auto-target and turn cost like potions.
3. Out of battle: same-style flow can revive fainted mons and feed candy to any party mon.
4. No soft-lock: invalid targets never consume stock; fainted + candy cannot leave a “zombie” full-HP fainted mon.
