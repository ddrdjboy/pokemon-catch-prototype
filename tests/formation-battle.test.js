import { SPECIES, createPokemon } from '../js/data.js';
import {
  FORMATION_FIELD_CAP,
  defaultLoadout,
  normalizeLoadout,
  basicMoveFor,
  skillMovesFor,
} from '../js/loadout.js';

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

console.log(`formation-battle tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
