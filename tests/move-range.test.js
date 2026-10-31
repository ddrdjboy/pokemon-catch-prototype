import assert from 'node:assert/strict';
import { moveIsRanged, moveRange, MOVE_RANGE } from '../js/move-range.js';
import { SPECIES } from '../js/data.js';
import { speciesMoveList } from '../js/battle-moves.js';

console.log('move range helpers');

assert.equal(moveRange({ name: '撞击', power: 40, type: 'normal' }), 'melee');
assert.equal(moveRange({ name: '水枪', power: 40, type: 'water' }), 'ranged');
assert.equal(moveRange({ name: '火焰牙', power: 65, type: 'fire' }), 'melee');
assert.equal(moveRange({ name: '真空波', power: 40, type: 'fighting' }), 'ranged');
assert.equal(moveRange({ name: '龙之怒', power: 40, type: 'dragon' }), 'ranged');
assert.equal(moveRange({ name: '睡觉', power: 0, type: 'normal', effect: 'heal' }), null);
assert.equal(moveIsRanged({ name: '穿影袭', power: 85, type: 'ghost', pierce: true }), true);
assert.equal(moveIsRanged({ name: '水枪', power: 40, type: 'water' }), true);
assert.equal(moveIsRanged({ name: '龙爪', power: 80, type: 'dragon' }), false);
assert.equal(moveIsRanged({ name: '剑舞', power: 0, type: 'normal', effect: 'atk' }), false);

// Inline range overrides the name table.
assert.equal(moveRange({ name: '撞击', power: 40, type: 'normal', range: 'ranged' }), 'ranged');

console.log('every damage move in SPECIES resolves');
const seen = new Set();
for (const sp of Object.values(SPECIES)) {
  for (const move of speciesMoveList(sp)) {
    if (move.effect) {
      assert.equal(moveRange(move), null, `${sp.id} utility ${move.name}`);
      continue;
    }
    const r = move.range || moveRange(move);
    assert.ok(r === 'melee' || r === 'ranged', `${sp.id} ${move.name} needs range`);
    seen.add(move.name);
    assert.equal(move.range, r, `${sp.id} ${move.name} stamped on speciesMoveList`);
  }
}
assert.ok(seen.size >= 80, `expected a broad move set, got ${seen.size}`);
assert.ok(MOVE_RANGE.水枪 === 'ranged' && MOVE_RANGE.撞击 === 'melee', 'table entries');

console.log('move-range ok');
