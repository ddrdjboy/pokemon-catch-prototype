import assert from 'node:assert/strict';
import {
  withBattleState,
  speciesMoveList,
  moveTarget,
  applyMoveEffect,
  resolveMoveTargets,
  chooseDualFoeCmd,
  chooseFoeMove,
} from '../js/battle-moves.js';
import { SPECIES, createPokemon, typeMultiplier } from '../js/data.js';
import { calcDamage, resolveTurn, resolveDualTurn, resolveDualItemTurn, resolveSquadTurn } from '../js/battle.js';

const mon = withBattleState(createPokemon('mega_charizard', 30));
assert.equal(mon.usedUtility, false);
assert.equal(mon.atkMul, 1);
assert.equal(mon.defMul, 1);
assert.equal(withBattleState(mon).atkMul, 1);

const zacian = withBattleState(createPokemon('zacian', 50));
assert.equal(zacian.usedUtility, false);
assert.equal(zacian.atkMul, 1);

assert.equal(moveTarget({ name: '圣剑', power: 110, type: 'fairy' }), 'foe');
assert.equal(moveTarget({ name: '剑舞', power: 0, type: 'normal', effect: 'atk' }), 'self');
assert.equal(moveTarget({ name: '横扫', power: 80, type: 'flying', target: 'foes' }), 'foes');
assert.equal(moveTarget({ name: '帮助', power: 0, type: 'normal', effect: 'atk', target: 'ally' }), 'ally');

assert.equal(speciesMoveList(SPECIES.charmander).length, 1);
assert.equal(speciesMoveList(SPECIES.mega_charizard).length, 3);
assert.equal(speciesMoveList(SPECIES.zacian).length >= 1, true);

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

const healed = applyMoveEffect(
  withBattleState({ ...createPokemon('mega_venusaur', 30), hp: 10 }),
  { name: '光合作用', power: 0, type: 'normal', effect: 'heal' },
);
assert.equal(healed.mon.usedUtility, true);
assert.equal(healed.mon.hp, 10 + Math.floor(healed.mon.maxHp * 0.5));
assert.match(healed.log.text, /光合作用/);

const healMon = withBattleState({ ...createPokemon('lugia', 50), hp: 10 });
const healedLugia = applyMoveEffect(healMon, { name: '自我再生', power: 0, type: 'normal', effect: 'heal' });
assert.equal(healedLugia.mon.usedUtility, true);
assert.equal(healedLugia.mon.hp, 10 + Math.floor(healedLugia.mon.maxHp * 0.5));
assert.equal(applyMoveEffect(healedLugia.mon, { name: '自我再生', power: 0, type: 'normal', effect: 'heal' }), null);

const danced = applyMoveEffect(
  withBattleState(createPokemon('mega_charizard', 30)),
  { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
);
assert.equal(danced.mon.atkMul, 1.5);
assert.equal(danced.mon.usedUtility, true);

const walled = applyMoveEffect(
  withBattleState(createPokemon('mega_blastoise', 30)),
  { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
);
assert.equal(walled.mon.defMul, 1.5);

const again = applyMoveEffect(danced.mon, { name: '剑舞', power: 0, type: 'normal', effect: 'atk' });
assert.equal(again, null);

const grassFoe = withBattleState(createPokemon('mega_venusaur', 30));
const fireAtk = withBattleState(createPokemon('mega_charizard', 30));
const pickCoverage = chooseFoeMove(fireAtk, grassFoe, () => 0.5);
assert.equal(pickCoverage.name, '爆炸烈焰');

const waterFoe = withBattleState(createPokemon('mega_blastoise', 30));
assert.equal(typeMultiplier('grass', 'water'), 1.5);
assert.equal(typeMultiplier('fire', 'water'), 0.5);
const pickGrass = chooseFoeMove(fireAtk, waterFoe, () => 0.5);
assert.equal(pickGrass.name, '日光束');

const low = withBattleState({ ...createPokemon('mega_venusaur', 30), hp: 1 });
assert.equal(chooseFoeMove(low, fireAtk, () => 0.5).effect, 'heal');

const buffPick = chooseFoeMove(fireAtk, grassFoe, () => 0.8);
assert.equal(buffPick.effect, 'atk');

assert.equal(speciesMoveList(SPECIES.charmander)[0].name, chooseFoeMove(
  withBattleState(createPokemon('charmander', 10)),
  withBattleState(createPokemon('squirtle', 10)),
  () => 0,
).name);

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

const atk = withBattleState(createPokemon('mega_charizard', 40));
const def = withBattleState(createPokemon('mega_blastoise', 40));
const move = SPECIES.mega_charizard.moves[0];
const noCrit = () => 1;
const base = calcDamage(atk, def, move, noCrit);
const buffed = calcDamage({ ...atk, atkMul: 1.5 }, def, move, noCrit);
assert.ok(buffed.damage > base.damage);

const buffAtk = withBattleState({ ...createPokemon('zacian', 40), atkMul: 1.5 });
const plain = withBattleState(createPokemon('zacian', 40));
const dummy = withBattleState(createPokemon('charmander', 40));
const sword = { name: '圣剑', power: 110, type: 'fairy' };
assert.ok(calcDamage(buffAtk, dummy, sword, noCrit).damage > calcDamage(plain, dummy, sword, noCrit).damage);

const p = withBattleState({ ...createPokemon('mega_venusaur', 40), hp: 20 });
const f = withBattleState(createPokemon('scorbunny', 5));
const healMove = SPECIES.mega_venusaur.moves[2];
const turn = resolveTurn(p, f, () => 1, healMove, SPECIES.scorbunny.move);
assert.equal(turn.player.usedUtility, true);
assert.ok(turn.player.hp > 20);
assert.ok(turn.logs.some((l) => l.text.includes('光合作用')));

const lucario = withBattleState(createPokemon('lucario', 50));
const garchomp = withBattleState(createPokemon('garchomp', 50));
const scorbunny = withBattleState(createPokemon('scorbunny', 10));
const charmander = withBattleState(createPokemon('charmander', 10));
const namedDual = resolveDualTurn(
  [lucario, garchomp],
  [scorbunny, charmander],
  () => 1,
  [SPECIES.lucario.moves[0], SPECIES.garchomp.moves[0]],
  [SPECIES.scorbunny.move, SPECIES.charmander.move],
);
assert.ok(namedDual.logs.some((l) => l.text.includes('波导弹')));
assert.ok(namedDual.logs.some((l) => l.text.includes('龙爪')));
assert.ok(namedDual.logs.every((l) => l.playersHp?.length === 2 && l.foesHp?.length === 2));

const slash = SPECIES.lucario.move;
const dual = resolveDualTurn(
  [withBattleState(createPokemon('lucario', 80)), withBattleState(createPokemon('garchomp', 80))],
  [withBattleState(createPokemon('charmander', 5)), withBattleState(createPokemon('squirtle', 5))],
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
assert.ok(itemTurn.logs.every((l) => l.playersHp?.length === 2 && l.foesHp?.length === 2));

const lead = withBattleState(createPokemon('mega_charizard', 100));
const allies = [withBattleState(createPokemon('scorbunny', 20))];
const boss = withBattleState(createPokemon('mega_rayquaza', 50));
const squad = resolveSquadTurn(
  lead,
  allies,
  boss,
  () => 1,
  SPECIES.mega_charizard.moves[0],
  SPECIES.mega_rayquaza.moves[0],
);
assert.ok(squad.logs.some((l) => l.side === 'player' && l.text.includes('爆炸烈焰')));
assert.ok(squad.logs.some((l) => l.side === 'foe' && l.text.includes('飞冲升天')));

for (const id of ['zacian', 'zamazenta', 'lugia', 'ho_oh', 'latias', 'latios', 'koraidon', 'miraidon']) {
  const kit = speciesMoveList(SPECIES[id]);
  assert.equal(kit.length, 3, `${id} has 3 moves`);
  assert.equal(moveTarget(kit[0]), 'foe');
  assert.equal(moveTarget(kit[2]), 'self');
  assert.equal(SPECIES[id].move.name, kit[0].name);
}

const healer = withBattleState({ ...createPokemon('lugia', 50), hp: 10 });
const partner = withBattleState(createPokemon('zamazenta', 50));
const weak = withBattleState(createPokemon('charmander', 5));
const weak2 = withBattleState(createPokemon('squirtle', 5));
const healTurn = resolveDualTurn(
  [healer, partner],
  [weak, weak2],
  () => 0,
  [
    { type: 'move', move: { name: '自我再生', power: 0, type: 'normal', effect: 'heal' }, targetSide: 'player', targetIndex: 0 },
    { type: 'switch' },
  ],
  [null, null],
);
const healLog = healTurn.logs.find((l) => l.effect === 'heal');
assert.ok(healLog);
assert.equal(healLog.playersHp.length, 2);
assert.equal(healLog.foesHp.length, 2);
assert.ok(healLog.playersHp[0] > 10);

console.log('battle-moves helpers ok');
