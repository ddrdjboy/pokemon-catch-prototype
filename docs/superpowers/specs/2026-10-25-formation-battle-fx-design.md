# Formation battle FX (approach A)

**Status:** Approved (user chose A)  
**Date:** 2026-10-25

## Goal

Ghost nether formation turns show the same attack motion + damage numbers + SFX as normal/dual battles, one log line at a time. Win/lose rules unchanged (all foes down / player down).

## Design

1. **`resolveFormationTurn` logs** carry indexes for playback:
   - Player/ally → foe: `side`, `targetIndex`, and `allyIndex` when side is `ally`
   - Foe → squad: `side: 'foe'`, `actorIndex`, `target: 'player'|'ally'`, `allyIndex` when ally
2. **Chip anchors:** foe chips expose `data-foe-index`; party chips expose `data-ally-index` / player class.
3. **`playFormationTurnHits`:** for each log → append text → resolve chip els → `playAttackSfx` → `playHit` → apply HP on `battle.*` in place (keep DOM for floating numbers) → `playDamageNumber` → wait → gap. End: sync from `turn`, `renderBattle`, continue prompts on win/lose.
4. **Out of scope:** new heavy frame strips for nether species; redesign of anim modes.

## Success

- Each hit lunges/flashes attacker chip and hits defender chip
- Damage (or heal) number appears on defender
- HP bars update per hit; KO slot goes empty-placeholder without shifting others
