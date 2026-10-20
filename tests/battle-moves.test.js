import assert from 'node:assert/strict';
import {
  withBattleState,
  speciesMoveList,
  applyMoveEffect,
  chooseFoeMove,
} from '../js/battle-moves.js';
import { SPECIES, createPokemon, typeMultiplier } from '../js/data.js';
import { calcDamage, resolveTurn, resolveDualTurn, resolveSquadTurn } from '../js/battle.js';

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

import { calcDamage, resolveTurn, resolveDualTurn, resolveSquadTurn } from '../js/battle.js';

const atk = withBattleState(createPokemon('mega_charizard', 40));
const def = withBattleState(createPokemon('mega_blastoise', 40));
const move = SPECIES.mega_charizard.moves[0];
const base = calcDamage(atk, def, move, () => 1);
const buffed = calcDamage({ ...atk, atkMul: 1.5 }, def, move, () => 1);
assert.ok(buffed.damage > base.damage);

const p = withBattleState({ ...createPokemon('mega_venusaur', 40), hp: 20 });
const f = withBattleState(createPokemon('scorbunny', 5));
const healMove = SPECIES.mega_venusaur.moves[2];
const turn = resolveTurn(p, f, () => 1, healMove, SPECIES.scorbunny.move);
assert.equal(turn.player.usedUtility, true);
assert.ok(turn.player.hp > 20);
assert.ok(turn.logs.some((l) => l.text.includes('光合作用')));

const p0 = withBattleState(createPokemon('lucario', 50));
const p1 = withBattleState(createPokemon('garchomp', 50));
const f0 = withBattleState(createPokemon('scorbunny', 10));
const f1 = withBattleState(createPokemon('charmander', 10));
const dual = resolveDualTurn(
  [p0, p1],
  [f0, f1],
  () => 1,
  [SPECIES.lucario.moves[0], SPECIES.garchomp.moves[0]],
  [SPECIES.scorbunny.move, SPECIES.charmander.move],
);
assert.ok(dual.logs.some((l) => l.text.includes('波导弹')));
assert.ok(dual.logs.some((l) => l.text.includes('龙爪')));

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

console.log('battle-moves helpers ok');
