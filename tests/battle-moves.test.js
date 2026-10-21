import assert from 'node:assert/strict';
import {
  withBattleState,
  speciesMoveList,
  moveTarget,
  applyMoveEffect,
  resolveMoveTargets,
  chooseDualFoeCmd,
} from '../js/battle-moves.js';
import { calcDamage, resolveDualTurn, resolveDualItemTurn } from '../js/battle.js';
import { SPECIES, createPokemon } from '../js/data.js';

const mon = withBattleState(createPokemon('zacian', 50));
assert.equal(mon.usedUtility, false);
assert.equal(mon.atkMul, 1);
assert.equal(mon.defMul, 1);

assert.equal(moveTarget({ name: '圣剑', power: 110, type: 'fairy' }), 'foe');
assert.equal(moveTarget({ name: '剑舞', power: 0, type: 'normal', effect: 'atk' }), 'self');
assert.equal(moveTarget({ name: '横扫', power: 80, type: 'flying', target: 'foes' }), 'foes');
assert.equal(moveTarget({ name: '帮助', power: 0, type: 'normal', effect: 'atk', target: 'ally' }), 'ally');

const p0 = withBattleState(createPokemon('zacian', 50));
const p1 = withBattleState(createPokemon('zamazenta', 50));
const f0 = withBattleState(createPokemon('charmander', 10));
const f1 = withBattleState({ ...createPokemon('squirtle', 10), hp: 0 });
const players = [p0, p1];
const foes = [f0, f1];

assert.deepEqual(
  resolveMoveTargets({ side: 'player', index: 0, mon: p0 }, { type: 'move', move: { name: 'x', power: 1, type: 'normal' }, targetSide: 'foe', targetIndex: 1 }, players, foes)
    .map((t) => t.index),
  [0],
  'foe falls back to first living foe when preferred dead',
);

assert.deepEqual(
  resolveMoveTargets({ side: 'player', index: 0, mon: p0 }, { type: 'move', move: { name: 'x', power: 1, type: 'normal', target: 'foes' }, targetSide: 'foe', targetIndex: 0 }, players, foes)
    .map((t) => t.index),
  [0],
);

const healMon = withBattleState({ ...createPokemon('lugia', 50), hp: 10 });
const healed = applyMoveEffect(healMon, { name: '自我再生', power: 0, type: 'normal', effect: 'heal' });
assert.equal(healed.mon.usedUtility, true);
assert.equal(healed.mon.hp, 10 + Math.floor(healed.mon.maxHp * 0.5));
assert.equal(applyMoveEffect(healed.mon, { name: '自我再生', power: 0, type: 'normal', effect: 'heal' }), null);

const cmd = chooseDualFoeCmd(
  withBattleState(createPokemon('zacian', 200)),
  0,
  [withBattleState(createPokemon('charmander', 50)), withBattleState(createPokemon('squirtle', 50))],
  () => 0.99,
);
assert.equal(cmd.type, 'move');
assert.equal(cmd.targetSide, 'player');
assert.ok(cmd.move?.name);
assert.equal(typeof cmd.targetIndex, 'number');

assert.equal(speciesMoveList(SPECIES.zacian).length >= 1, true);

const buffAtk = withBattleState({ ...createPokemon('zacian', 40), atkMul: 1.5 });
const plain = withBattleState(createPokemon('zacian', 40));
const dummy = withBattleState(createPokemon('charmander', 40));
const mv = { name: '圣剑', power: 110, type: 'fairy' };
assert.ok(calcDamage(buffAtk, dummy, mv).damage > calcDamage(plain, dummy, mv).damage);

const a = withBattleState(createPokemon('lucario', 80));
const b = withBattleState(createPokemon('garchomp', 80));
const e0 = withBattleState(createPokemon('charmander', 5));
const e1 = withBattleState(createPokemon('squirtle', 5));
const slash = SPECIES.lucario?.move || { name: '波导弹', power: 81, type: 'fighting' };
const claw = SPECIES.garchomp?.move || { name: '龙爪', power: 81, type: 'dragon' };
const dual = resolveDualTurn(
  [a, b],
  [e0, e1],
  () => 0,
  [
    { type: 'move', move: slash, targetSide: 'foe', targetIndex: 1 },
    { type: 'switch' },
  ],
  [
    { type: 'move', move: SPECIES.charmander.move, targetSide: 'player', targetIndex: 0 },
    { type: 'move', move: SPECIES.squirtle.move, targetSide: 'player', targetIndex: 0 },
  ],
);
assert.ok(dual.logs.some((l) => l.side === 'player' && l.actorIndex === 0));
assert.ok(!dual.logs.some((l) => l.side === 'player' && l.actorIndex === 1 && l.damage > 0), 'switch slot does not attack');

const focus = resolveDualTurn(
  [withBattleState(createPokemon('zacian', 100)), withBattleState(createPokemon('zamazenta', 100))],
  [
    withBattleState({ ...createPokemon('charmander', 5), hp: 1 }),
    withBattleState(createPokemon('squirtle', 50)),
  ],
  () => 0,
  [
    { type: 'move', move: { name: '圣剑', power: 110, type: 'fairy' }, targetSide: 'foe', targetIndex: 0 },
    { type: 'move', move: { name: '横扫', power: 40, type: 'flying', target: 'foes' }, targetSide: 'foe', targetIndex: 0 },
  ],
  [null, null],
);
assert.ok(focus.logs.filter((l) => l.side === 'player' && l.actorIndex === 1).length >= 1);

const itemTurn = resolveDualItemTurn(
  [withBattleState(createPokemon('zacian', 50)), withBattleState(createPokemon('zamazenta', 50))],
  [withBattleState(createPokemon('charmander', 20)), withBattleState(createPokemon('squirtle', 20))],
  () => 0,
  [
    { type: 'move', move: SPECIES.charmander.move, targetSide: 'player', targetIndex: 0 },
    { type: 'move', move: SPECIES.squirtle.move, targetSide: 'player', targetIndex: 1 },
  ],
);
assert.ok(itemTurn.logs.every((l) => l.side === 'foe'));

console.log('battle-moves helpers ok');
