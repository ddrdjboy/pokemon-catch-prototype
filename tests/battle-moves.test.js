import assert from 'node:assert/strict';
import {
  withBattleState,
  speciesMoveList,
  applyMoveEffect,
  chooseFoeMove,
} from '../js/battle-moves.js';
import { SPECIES, createPokemon, typeMultiplier } from '../js/data.js';

const mon = withBattleState(createPokemon('mega_charizard', 30));
assert.equal(mon.usedUtility, false);
assert.equal(mon.atkMul, 1);
assert.equal(mon.defMul, 1);
assert.equal(withBattleState(mon).atkMul, 1);

assert.equal(speciesMoveList(SPECIES.charmander).length, 1);
assert.equal(speciesMoveList(SPECIES.mega_charizard).length, 3);

const healed = applyMoveEffect(
  withBattleState({ ...createPokemon('mega_venusaur', 30), hp: 10 }),
  { name: '光合作用', power: 0, type: 'normal', effect: 'heal' },
);
assert.equal(healed.mon.usedUtility, true);
assert.equal(healed.mon.hp, 10 + Math.floor(healed.mon.maxHp * 0.5));
assert.match(healed.log.text, /光合作用/);

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
const pickCoverage = chooseFoeMove(fireAtk, grassFoe, () => 0.99);
assert.equal(pickCoverage.name, '爆炸烈焰');

const waterFoe = withBattleState(createPokemon('mega_blastoise', 30));
assert.equal(typeMultiplier('grass', 'water'), 1.5);
assert.equal(typeMultiplier('fire', 'water'), 0.5);
const pickGrass = chooseFoeMove(fireAtk, waterFoe, () => 0.99);
assert.equal(pickGrass.name, '日光束');

const low = withBattleState({ ...createPokemon('mega_venusaur', 30), hp: 1 });
assert.equal(chooseFoeMove(low, fireAtk, () => 0.99).effect, 'heal');

assert.equal(speciesMoveList(SPECIES.charmander)[0].name, chooseFoeMove(
  withBattleState(createPokemon('charmander', 10)),
  withBattleState(createPokemon('squirtle', 10)),
  () => 0,
).name);

console.log('battle-moves helpers ok');
