import { SPECIES, createPokemon, MAPS } from '../js/data.js';
import {
  FORMATION_FIELD_CAP,
  defaultLoadout,
  normalizeLoadout,
  basicMoveFor,
  skillMovesFor,
} from '../js/loadout.js';
import {
  fieldParty,
  resolveFormationRound,
  formationSideResult,
} from '../js/formation-battle.js';
import { withBattleState } from '../js/battle-moves.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed += 1; console.log(`  ✓ ${msg}`); }
  else { failed += 1; console.error(`  ✗ ${msg}`); }
}

console.log('loadout');
{
  assert(FORMATION_FIELD_CAP === 5, 'field cap is 5');
  const sp = SPECIES.scorbunny;
  const d = defaultLoadout(sp);
  assert(d.basicMoveName === sp.move.name || d.basicMoveName === sp.moves?.[0]?.name
    || typeof d.basicMoveName === 'string', 'default has basic name');
  assert(Array.isArray(d.skillMoveNames) && d.skillMoveNames.length <= 3, 'skills capped at 3');

  const mon = createPokemon('scorbunny', 10);
  mon.loadout = { basicMoveName: '不存在的招', skillMoveNames: ['火花', '也没有'] };
  const fixed = normalizeLoadout(mon, sp);
  assert(fixed.basicMoveName && fixed.basicMoveName !== '不存在的招', 'invalid basic falls back');
  assert(!fixed.skillMoveNames.includes('也没有'), 'invalid skills dropped');

  const basic = basicMoveFor(mon, sp);
  assert(basic?.name && basic.power >= 0 || basic?.effect, 'basicMoveFor returns a move');
  const skills = skillMovesFor(mon, sp);
  assert(skills.every((m) => m.name), 'skillMovesFor returns moves');
}

console.log('formation field party');
{
  const party = [
    createPokemon('scorbunny', 10),
    createPokemon('bulbasaur', 10),
    createPokemon('squirtle', 10),
    createPokemon('pikachu', 10),
    createPokemon('raboot', 10),
    createPokemon('ivysaur', 10),
  ];
  party[1].hp = 0;
  const field = fieldParty(party);
  assert(field.length === 5, 'skips fainted and fills up to 5 living');
  assert(field.every((m) => m.hp > 0), 'only conscious on field');
  assert(!field.some((m) => m.speciesId === 'bulbasaur'), 'fainted skipped');
}

console.log('formation round');
{
  const p1 = withBattleState(createPokemon('scorbunny', 20));
  const p2 = withBattleState(createPokemon('bulbasaur', 5));
  p1.spd = 100;
  p2.spd = 1;
  const f1 = withBattleState(createPokemon('squirtle', 10));
  f1.spd = 50;
  const players = [p1, p2];
  const foes = [f1];
  const commands = [
    { uid: p1.uid, side: 'player', action: 'attack', targetUid: f1.uid },
    { uid: p2.uid, side: 'player', action: 'defend' },
    { uid: f1.uid, side: 'foe', action: 'attack', targetUid: p2.uid },
  ];
  const rng = () => 1; // no crit
  const turn = resolveFormationRound({ players, foes, commands, rng });
  assert(turn.logs.length >= 2, 'produces action logs');
  assert(turn.foes[0].hp < turn.foes[0].maxHp, 'foe took damage from player attack');
  assert(turn.players.every((p) => p.defending !== true), 'defend flags cleared after round');
  assert(turn.logs.some((l) => l.side === 'foe'), 'foe acted');
}

console.log('formation defend halves damage');
{
  const atk = withBattleState(createPokemon('scorbunny', 30));
  const def = withBattleState(createPokemon('bulbasaur', 30));
  atk.spd = 10;
  def.spd = 1;
  const open = resolveFormationRound({
    players: [withBattleState({ ...atk })],
    foes: [withBattleState({ ...def })],
    commands: [
      { uid: atk.uid, side: 'player', action: 'attack', targetUid: def.uid },
      { uid: def.uid, side: 'foe', action: 'attack', targetUid: atk.uid },
    ],
    rng: () => 1,
  });
  const shielded = resolveFormationRound({
    players: [withBattleState({ ...atk })],
    foes: [withBattleState({ ...def })],
    commands: [
      { uid: atk.uid, side: 'player', action: 'attack', targetUid: def.uid },
      { uid: def.uid, side: 'foe', action: 'defend' },
    ],
    rng: () => 1,
  });
  const dmgOpen = open.foes[0].maxHp - open.foes[0].hp;
  const dmgShield = shielded.foes[0].maxHp - shielded.foes[0].hp;
  assert(dmgOpen > 0, 'open round deals damage');
  assert(dmgShield <= Math.ceil(dmgOpen / 2) + 1, 'defend roughly halves incoming damage');
}

console.log('formation side result');
{
  const a = withBattleState(createPokemon('scorbunny', 5));
  const b = withBattleState(createPokemon('bulbasaur', 5));
  b.hp = 0;
  assert(formationSideResult([a], [b]) === 'win', 'foe all faint → win');
  a.hp = 0;
  assert(formationSideResult([a], [b]) === 'draw', 'both down → draw');
}

console.log('final realm formation flag');
assert(MAPS.final_realm?.battleMode === 'formation', 'final_realm uses formation battles');
assert(MAPS.grassland?.battleMode !== 'formation', 'grassland stays classic');

console.log(`formation-battle tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
