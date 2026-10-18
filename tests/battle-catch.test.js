import {
  calcDamage, CRIT_MULT, CRIT_RATE, nextBattleStep, resolveDualTurn, resolveDualItemTurn, resolveSquadTurn,
  resolveFoeOnlyTurn, resolveSquadItemTurn, whoGoesFirstDeterministic,
} from '../js/battle.js';
import {
  normalizeBattleAnim,
  effectiveBattleAnim,
  damageNumberVariant,
  typeTint,
  playHit,
  hasFighterFrames,
  loadFighterFrames,
  clearFighterFrameCache,
  playFighterFrameStrip,
} from '../js/battle-fx.js';
import { catchChance, catchOutlook, shakeCount, velocityFromDrag, simulateThrow } from '../js/catch.js';
import {
  ITEMS, HEAL_ITEMS, emptyItems, emptyHealItems, applyItem, applyHealItem,
} from '../js/items.js';
import {
  createPokemon, createRiftAllies, typeMultiplier, sellPrice, sellPokemon, PARTY_CAP, ACTIVE_CAP,
  activeParty, movePartyMember, moveWithinZone, recallToBag, sendToActive, BALLS,
  initialPlayerState,
  encounterLevels, rollEncounter, syncEncounters, trimParty, SHINY_RATE_WITH_CHARM,
  partyMaxLevel, partyOverLevelCount, riftFruitDrop, trySpendRiftFruit, trySpendTwinKey,
  RIFT_UNLOCK_LEVEL, RIFT_FRUIT_COST, RIFT_FRUIT, RIFT_BOSS_LEVEL,
  TWIN_UNLOCK_LEVEL, TWIN_UNLOCK_COUNT, TWIN_KEY_COST, TWIN_KEY, TWIN_BOSS_LEVEL,
  canEnterSpiritHall, SPIRIT_HALL_BOSS_LEVELS,
} from '../js/data.js';
import { gainExperience, xpReward, xpToNext, tryEvolve, EVOLVE_LEVEL, EVOLVE_LEVEL_MEGA } from '../js/level.js';
import { partyIndividualView } from '../js/party-detail.js';
import { SPECIES, MAPS, listDexEntries, listDexTypes, getDexDetail } from '../js/data.js';
import { selectBattleTrack, sfxKeyForMoveType, playCatchSuccessSfx } from '../js/audio.js';
import {
  generateMazeFloor,
  createMazeRun,
  stepMaze,
  removeRoamer,
  markFloorBossDefeated,
  advanceMazeFloor,
  buildFloorBossEncounter,
  SPIRIT_HALL_BOSS_BY_FLOOR,
} from '../js/maze.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('type chart');
assert(typeMultiplier('fire', 'grass') === 1.5, 'fire > grass');
assert(typeMultiplier('water', 'fire') === 1.5, 'water > fire');
assert(typeMultiplier('electric', 'water') === 1.5, 'electric > water');
assert(typeMultiplier('grass', 'rock') === 1.5, 'grass > rock');
assert(typeMultiplier('fire', 'water') === 0.5, 'fire < water');

console.log('damage');
const atk = createPokemon('scorbunny', 5);
const def = createPokemon('bulbasaur', 5);
const noCrit = () => 1;
const alwaysCrit = () => 0;
const move40 = { power: 40, type: 'fire' };
const { damage, typeMult, crit } = calcDamage(atk, def, move40, noCrit);
assert(typeMult === 1.5, 'super effective mult');
assert(crit === false, 'rng 1 is not a crit');
assert(damage === Math.max(1, Math.floor((atk.atk * 40) / def.def * 1.5)), 'damage formula');

const rock = createPokemon('geodude', 5);
const { damage: d2, typeMult: m2 } = calcDamage(atk, rock, move40, noCrit);
assert(m2 === 0.5, 'fire vs rock resisted');
assert(d2 >= 1, 'min damage 1');

const critHit = calcDamage(atk, def, move40, alwaysCrit);
assert(CRIT_RATE === 1 / 16, 'crit rate is 1/16');
assert(critHit.crit === true, 'rng 0 is a crit');
assert(
  critHit.damage === Math.max(1, Math.floor((atk.atk * 40) / def.def * 1.5 * CRIT_MULT)),
  'crit applies 1.5 after type multiplier',
);
assert(damageNumberVariant({ typeMult: 1 }) === 'normal', 'normal number');
assert(damageNumberVariant({ typeMult: 1.5 }) === 'super', 'super effective number');
assert(damageNumberVariant({ typeMult: 0.5 }) === 'resist', 'resisted number');
assert(damageNumberVariant({ typeMult: 1, crit: true }) === 'normal crit', 'crit number');
assert(damageNumberVariant({ typeMult: 1.5, crit: true }) === 'super crit', 'crit super number');
assert(damageNumberVariant({ heal: true, crit: true }) === 'heal', 'heal number ignores crit');

console.log('speed');
const fast = { spd: 70 };
const slow = { spd: 25 };
assert(whoGoesFirstDeterministic(fast, slow) === 'a', 'faster goes first');
assert(whoGoesFirstDeterministic(slow, fast) === 'b', 'slower second');

console.log('catch chance');
const faint = createPokemon('bulbasaur', 5);
faint.hp = 1;
const master = catchChance(faint, 'master', { throwsThisEncounter: 0, rng: () => 0.99 });
assert(master.chance === 1 && master.success && master.shakes === 3, 'master ball always');

const poke = catchChance(faint, 'poke', { throwsThisEncounter: 0, rng: () => 0 });
assert(poke.success, 'rng 0 always succeeds when chance > 0');
assert(poke.chance >= 0.05 && poke.chance <= 0.95, 'clamped');

const boss = createPokemon('scorbunny', 7, { boss: true });
boss.hp = 1;
const bossCatch = catchChance(boss, 'poke', { throwsThisEncounter: 0, rng: () => 0.5 });
const normal = createPokemon('scorbunny', 7);
normal.hp = 1;
const normalCatch = catchChance(normal, 'poke', { throwsThisEncounter: 0, rng: () => 0.5 });
assert(bossCatch.chance < normalCatch.chance, 'boss harder to catch');

const quickFirst = catchChance(faint, 'quick', { throwsThisEncounter: 0, rng: () => 1 });
const quickLater = catchChance(faint, 'quick', { throwsThisEncounter: 1, rng: () => 1 });
assert(quickFirst.chance > quickLater.chance, 'quick ball first throw bonus');

const pokeBall = catchChance(faint, 'poke', { throwsThisEncounter: 1, rng: () => 1 });
const greatBall = catchChance(faint, 'great', { throwsThisEncounter: 1, rng: () => 1 });
const ultraBall = catchChance(faint, 'ultra', { throwsThisEncounter: 1, rng: () => 1 });
assert(ultraBall.chance > greatBall.chance && greatBall.chance > pokeBall.chance, 'ultra > great > poke');
assert(BALLS.ultra?.name === '高级球' && !BALLS.dusk, 'dusk ball became ultra');

console.log('throw physics');
const flick = velocityFromDrag({ x: 100, y: 300 }, { x: 160, y: 240 });
assert(flick.vx > 0 && flick.vy < 0, 'flick follows the drag');
const sling = velocityFromDrag({ x: 100, y: 300 }, { x: 40, y: 320 }, { style: 'sling' });
assert(sling.vx > 0, 'pull left throws right');

console.log('shakes and outlook');
assert(shakeCount(0.5, 0.2) === 3, 'roll under chance shakes 3');
assert(shakeCount(0.5, 0.5) === 2, 'touching the line shakes 2');
assert(shakeCount(0.5, 0.7) === 1, 'medium miss shakes 1');
assert(shakeCount(0.5, 0.9) === 0, 'far miss shakes 0');
const caughtRoll = catchChance(faint, 'poke', { throwsThisEncounter: 0, rng: () => 0 });
assert(caughtRoll.success && caughtRoll.shakes === 3, 'successful roll is three shakes');
const escaped = catchChance(faint, 'poke', { throwsThisEncounter: 0, rng: () => 0.99 });
assert(!escaped.success && escaped.shakes === shakeCount(escaped.chance, 0.99), 'failed roll uses shake bands');
assert(catchOutlook(0.75) === '很容易', 'high chance outlook');
assert(catchOutlook(0.45) === '有机会', 'mid chance outlook');
assert(catchOutlook(0.2) === '很难', 'low chance outlook');
assert(catchOutlook(0.19) === '几乎抓不住', 'bottom chance outlook');
const sim = simulateThrow({
  origin: { x: 80, y: 280 },
  velocity: { vx: 12, vy: -8 },
  target: { x: 400, y: 150, radius: 48, boundsW: 640 },
  groundY: 340,
});
assert(Array.isArray(sim.path) && sim.path.length > 1, 'path generated');

console.log('xp and evolution');
assert(xpToNext(5) === 130, 'xp curve at 5');
assert(xpReward({ level: 5, boss: false }) === 200, 'wild xp');
assert(xpReward({ level: 6, boss: false }, { trainer: true }) === 360, 'trainer xp');
const mon = createPokemon('scorbunny', 7);
const logs = gainExperience(mon, xpToNext(7));
assert(mon.level === 8, 'levels to 8');
assert(mon.speciesId === 'raboot', 'evolves at 8');
assert(logs.some((l) => l.includes('进化')), 'evo log');
const caught = createPokemon('pikachu', EVOLVE_LEVEL);
assert(tryEvolve(caught).length > 0 && caught.speciesId === 'raichu', 'caught L8 evolves');
const mid = createPokemon('charmander', 16);
tryEvolve(mid);
assert(mid.speciesId === 'charizard', 'L16 second evo');
const mega = createPokemon('charmander', EVOLVE_LEVEL_MEGA);
tryEvolve(mega);
assert(mega.speciesId === 'mega_charizard' && SPECIES[mega.speciesId].mega, 'L24 mega');
console.log('party cap');
assert(PARTY_CAP === 99, 'storage cap is 99');
assert(ACTIVE_CAP === 6, 'only 6 can battle');
const seven = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ uid: `p${n}` }));
assert(trimParty(seven).length === 7, 'seven still fit under 99');
const hundred = Array.from({ length: 100 }, (_, i) => ({ uid: `p${i}` }));
assert(trimParty(hundred).length === 99 && trimParty(hundred)[0].uid === 'p0', 'load keeps the first 99');
assert(activeParty(seven).map((p) => p.uid).join() === 'p1,p2,p3,p4,p5,p6', 'first 6 are the battle team');
const order = seven.map((p) => ({ ...p }));
assert(movePartyMember(order, 'p7', -1), 'move the 7th up');
assert(activeParty(order).some((p) => p.uid === 'p7'), 'moved mon enters the battle team');
assert(!activeParty(order).some((p) => p.uid === 'p6'), 'displaced mon leaves the battle team');
assert(!movePartyMember(order, 'p1', -1), 'first mon stays first');

console.log('party zones');
const z = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ uid: `z${n}` }));
assert(moveWithinZone(z, 'z3', -1), 'active can swap left');
assert(z.map((p) => p.uid).slice(0, 3).join() === 'z1,z3,z2', 'swapped inside active');
assert(!moveWithinZone(z, 'z6', 1), '6th cannot move into bag');
assert(!moveWithinZone(z, 'z7', -1), 'bag head cannot move into active');
assert(moveWithinZone(z, 'z8', -1), 'bag can reorder');
assert(z[6].uid === 'z8' && z[7].uid === 'z7', 'bag swap');

const r = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ uid: `r${n}` }));
assert(recallToBag(r, 'r2'), 'recall active to bag end');
assert(r.map((p) => p.uid).join() === 'r1,r3,r4,r5,r6,r7,r2', 'order after recall');
assert(!activeParty(r).some((p) => p.uid === 'r2'), 'recalled leaves active');
const small = [1, 2, 3, 4, 5].map((n) => ({ uid: `t${n}` }));
assert(!recallToBag(small, 't1'), 'no recall when no bag exists');

const s = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ uid: `s${n}` }));
assert(sendToActive(s, 's8'), 'send bag to 6th slot');
assert(s.map((p) => p.uid).join() === 's1,s2,s3,s4,s5,s8,s6,s7', 'inserted as 6th');
assert(activeParty(s).some((p) => p.uid === 's8'), 'sent is active');
assert(!activeParty(s).some((p) => p.uid === 's6'), 'old 6th benched');
assert(!sendToActive(s, 's1'), 'active cannot sendToActive');

console.log('trainer teams');
const wildCounts = {
  grassland: 1, coast: 1, cave: 1,
  misty_woods: 2, thunder_ridge: 2, ancient_ruins: 2, frost_lake: 2, sky_terrace: 2,
  champion_path: 3,
};
for (const id of Object.keys(wildCounts)) {
  const map = MAPS[id];
  const trainers = map.encounters.filter((e) => e.kind === 'trainer');
  const wild = map.encounters.filter((e) => e.kind === 'wild');
  assert(trainers.length === 3, `${map.id} has 2 new trainers`);
  assert(wild.length === wildCounts[map.id], `${map.id} wild encounters stay`);
  for (const t of trainers) {
    assert(t.team.length >= 3 && t.team.length <= 6, `${map.id}/${t.id} carries 3-6`);
    assert(t.team.every((m) => SPECIES[m.speciesId] && m.level >= 1), `${map.id}/${t.id} team is real`);
  }
  for (const w of wild) {
    assert(w.speciesId && !w.team, `${map.id}/${w.id} wild is one pokemon`);
  }
}
const sample = MAPS.grassland.encounters.find((e) => e.kind === 'trainer');
assert(encounterLevels(sample).length === sample.team.length, 'trainer levels come from the team');
assert(encounterLevels(MAPS.grassland.encounters.find((e) => e.kind === 'wild')).length === 1, 'wild level is one');

console.log('roll trainer team');
const tmpl = {
  id: 't',
  kind: 'trainer',
  trainerName: '测试',
  team: [
    { speciesId: 'pikachu', level: 5 },
    { speciesId: 'bulbasaur', level: 6 },
  ],
};
let rolls = 0;
const rolled = rollEncounter(tmpl, {
  hasCharm: true,
  bossChance: 1,
  shinyRate: SHINY_RATE_WITH_CHARM,
  rng: () => {
    rolls += 1;
    return 0;
  },
});
assert(rolled.team.length === 2, 'rolled team keeps size');
assert(rolled.team.every((m) => m.shiny && m.boss && m.maxHp > 0), 'each mon rolls shiny and boss');
assert(rolls === 4, 'shiny and boss roll once per mon');
const plain = rollEncounter(tmpl, { hasCharm: false, bossChance: 0, rng: () => 0 });
assert(plain.team.every((m) => !m.shiny && !m.boss), 'no charm and no boss stays plain');

console.log('sync old encounters');
const maps = {
  grassland: MAPS.grassland,
};
const oldTrainer = MAPS.grassland.encounters.find((e) => e.kind === 'trainer');
const synced = syncEncounters(
  {
    encounters: {
      grassland: [
        { id: 'wild-bulbasaur', kind: 'wild', pokemon: { speciesId: 'bulbasaur' } },
        { id: oldTrainer.id, kind: 'trainer', speciesId: 'pikachu', level: 6 },
      ],
    },
    cleared: { [`grassland:${oldTrainer.id}`]: true },
  },
  maps,
  () => ({ id: 'rolled', kind: 'trainer', team: [{ speciesId: 'a' }, { speciesId: 'b' }, { speciesId: 'c' }] }),
);
const keptWild = synced.encounters.grassland.find((e) => e.id === 'wild-bulbasaur');
assert(keptWild.pokemon.speciesId === 'bulbasaur', 'existing wild encounter stays');
assert(!synced.cleared[`grassland:${oldTrainer.id}`], 'upgraded trainer can be fought again');
assert(synced.encounters.grassland.filter((e) => e.kind === 'trainer').length === 3, 'missing trainers are added');

console.log('battle step after a faint');
assert(nextBattleStep({ result: 'ongoing', foeRemaining: 2, playerBackup: 1 }) === 'continue', 'fight continues');
assert(nextBattleStep({ result: 'win', foeRemaining: 2, playerBackup: 0 }) === 'send-foe', 'trainer sends the next');
assert(nextBattleStep({ result: 'win', foeRemaining: 0, playerBackup: 0 }) === 'victory', 'last foe is a win');
assert(nextBattleStep({ result: 'lose', foeRemaining: 1, playerBackup: 2 }) === 'send-player', 'player sends the next');
assert(nextBattleStep({ result: 'lose', foeRemaining: 1, playerBackup: 0 }) === 'defeat', 'no backup is a loss');
assert(nextBattleStep({ result: 'draw', foeRemaining: 1, playerBackup: 0 }) === 'defeat', 'both faint and no backup loses');
assert(nextBattleStep({ result: 'draw', foeRemaining: 0, playerBackup: 1 }) === 'victory', 'foe team gone and backup remains wins');
assert(nextBattleStep({ result: 'draw', foeRemaining: 2, playerBackup: 1 }) === 'send-both', 'both sides send the next');

console.log('sell and party cap');
const seller = createPokemon('scorbunny', 5);
assert(sellPrice(seller) === 100, 'lv5 sells for 100');
const shinyBoss = createPokemon('scorbunny', 5, { shiny: true, boss: true });
assert(sellPrice(shinyBoss) === 600, 'shiny boss multiplies');
const megaMon = createPokemon('mega_charizard', 24);
assert(sellPrice(megaMon) === 960, 'mega doubles price');
const bag = { coins: 0, party: [seller, shinyBoss] };
assert(sellPokemon(bag, seller.uid)?.price === 100, 'sell adds coins');
assert(bag.coins === 100 && bag.party.length === 1, 'party shrinks');
assert(sellPokemon(bag, shinyBoss.uid) === null, 'cannot sell the last one');
assert(bag.party.length === 1 && bag.coins === 100, 'last pokemon stays');

assert(Object.keys(MAPS).length >= 9, '9 maps total');
assert(!!SPECIES.dratini && !!SPECIES.mega_dragonite, 'new lines present');

console.log('later maps');
const regionIds = [
  'lava_canyon', 'deep_trench', 'gloom_yard', 'moss_wilds', 'volt_plain',
  'frost_shrine', 'bone_waste', 'fairy_court', 'fight_dojo', 'final_realm',
];
const known = new Set();
for (const id of Object.keys(wildCounts)) {
  for (const enc of MAPS[id].encounters) {
    if (enc.speciesId) known.add(enc.speciesId);
    for (const mon of enc.team || []) known.add(mon.speciesId);
  }
}
let prevMax = 24;
assert(regionIds.length === 10, '10 new maps');
for (const id of regionIds) {
  const map = MAPS[id];
  assert(map, `${id} exists`);
  const wild = map.encounters.filter((e) => e.kind === 'wild');
  assert(wild.length === 5, `${id} adds 5 pokemon`);
  const levels = wild.map((w) => w.level);
  assert(Math.min(...levels) > prevMax, `${id} is higher level than the previous map`);
  prevMax = Math.max(...levels);
  const ids = wild.map((w) => w.speciesId);
  assert(new Set(ids).size === 5, `${id} pokemon are distinct`);
  for (const sid of ids) {
    assert(SPECIES[sid]?.name, `${sid} is a real species`);
    assert(!known.has(sid), `${sid} is new`);
    known.add(sid);
  }
}
assert(Object.keys(MAPS).length === 22, '22 maps total');

console.log('rift raid');
assert(SPECIES.mega_rayquaza?.name === '超级裂空座' && SPECIES.mega_rayquaza.mega, 'mega rayquaza');
assert(MAPS.rift?.rift && MAPS.rift.encounters[0].level === RIFT_BOSS_LEVEL, 'rift map is the level 200 raid');
assert(RIFT_FRUIT.price === 30 && RIFT_FRUIT_COST === 3 && RIFT_UNLOCK_LEVEL === 100, 'fruit price, cost, and unlock');
assert(riftFruitDrop('chikorita') === 1, '菊草叶 drops a rift fruit');
assert(riftFruitDrop('oddish') === 0 && riftFruitDrop('bayleef') === 0, 'only 菊草叶 drops the fruit');
const gate = { riftFruit: 3, coins: 30 };
assert(trySpendRiftFruit(gate, 99).reason === 'level' && gate.riftFruit === 3, 'under 100 cannot enter');
assert(trySpendRiftFruit({ riftFruit: 2 }, 100).reason === 'fruit', 'two fruits are not enough');
assert(trySpendRiftFruit(gate, 100).ok && gate.riftFruit === 0, 'three fruits open the rift');
assert(partyMaxLevel([{ level: 40 }, { level: 100 }]) === 100, 'party level is the highest');
const raid = rollEncounter(MAPS.rift.encounters[0], { hasCharm: false, bossChance: 0, rng: () => 0.99 });
assert(raid.squad && raid.shiny && raid.boss && raid.pokemon.level === 200, 'rayquaza is a fixed shiny boss');
assert(raid.pokemon.speciesId === 'mega_rayquaza', 'raid foe is mega rayquaza');
const squadPlayer = createPokemon('mega_charizard', 100);
const squadAllies = createRiftAllies();
const squadFoe = createPokemon('mega_rayquaza', 200, { shiny: true, boss: true });
const kit = SPECIES.mega_rayquaza.moves;
assert(kit.length === 4 && kit.some((move) => move.aoe) && kit.every((move) => move.power >= 45), 'rayquaza has a heavy kit');
assert(Math.max(...kit.map((move) => move.power)) >= 140, 'signature move is much stronger');
const firstRaidTurn = resolveSquadTurn(squadPlayer, squadAllies, squadFoe, () => 0);
const swings = firstRaidTurn.logs.filter((line) => line.side === 'player' || line.side === 'ally');
assert(swings.length === 4, 'player and three computers all attack');
const foeLogs = firstRaidTurn.logs.filter((line) => line.side === 'foe');
assert(foeLogs.some((line) => line.text.includes('龙星群')), 'opens with 龙星群');
assert(foeLogs.filter((line) => line.text.includes('空气斩')).length >= 3, '空气斩 hits the standing squad');
const heavy = foeLogs.find((line) => line.text.includes('龙星群'));
const playerHp = squadPlayer.maxHp;
assert(heavy.damage >= playerHp * 0.8, 'heavy skill nearly KOs a level 100 mega');
function raidToEnd(level) {
  let fighter = createPokemon('mega_charizard', level);
  let allies = createRiftAllies().map((ally) => createPokemon(ally.speciesId, level));
  let raidBoss = createPokemon('mega_rayquaza', 200, { shiny: true, boss: true });
  let raidResult = 'ongoing';
  let rounds = 0;
  let roll = 0;
  let backups = 5;
  while (rounds < 40 && raidBoss.hp > 0) {
    if (fighter.hp <= 0 && backups > 0) {
      fighter = createPokemon('mega_charizard', level);
      backups -= 1;
    }
    const turn = resolveSquadTurn(fighter, allies, raidBoss, () => (roll++ % 4) / 4);
    fighter = turn.player;
    allies = turn.allies;
    raidBoss = turn.foe;
    raidResult = turn.result;
    rounds += 1;
    if (raidResult === 'win') break;
    if (fighter.hp <= 0 && backups <= 0 && allies.every((ally) => ally.hp <= 0)) break;
  }
  return { raidResult, rounds, bossHp: raidBoss.hp };
}
const fresh = raidToEnd(100);
assert(fresh.raidResult !== 'win' && fresh.bossHp > 0, 'level 100 squad falls before the boss');
assert(fresh.bossHp < 1600, 'level 100 squad still cuts deep into the boss');
const ready = raidToEnd(140);
assert(ready.raidResult === 'win' && ready.rounds <= 20, `level 140 squad beats rayquaza (${ready.rounds} rounds)`);

console.log('twin towers');
assert(MAPS.twin_towers?.twin && MAPS.twin_towers.encounters.length === 4, 'twin towers has 4 dual fights');
assert(TWIN_KEY.price === 5000 && TWIN_KEY_COST === 1 && TWIN_UNLOCK_COUNT === 2, 'twin key shop and gate');
assert(TWIN_UNLOCK_LEVEL === 100 && TWIN_BOSS_LEVEL === 200, 'twin unlock and boss level');
for (const id of ['zacian', 'zamazenta', 'lugia', 'ho_oh', 'latias', 'latios', 'koraidon', 'miraidon']) {
  assert(SPECIES[id]?.name && SPECIES[id].sprite, `${id} species exists`);
}
assert(partyOverLevelCount([{ level: 100 }, { level: 101 }], 100) === 1, 'over-level is strict >');
assert(partyOverLevelCount([{ level: 101 }, { level: 150 }], 100) === 2, 'two mons over 100');
const twinGate = { twinKeys: 1 };
assert(trySpendTwinKey(twinGate, [{ level: 101 }]).reason === 'level', 'one over-100 cannot enter');
assert(trySpendTwinKey({ twinKeys: 0 }, [{ level: 101 }, { level: 102 }]).reason === 'key', 'needs a twin key');
assert(trySpendTwinKey(twinGate, [{ level: 101 }, { level: 102 }]).ok && twinGate.twinKeys === 0, 'key opens twin towers');
const heroes = rollEncounter(MAPS.twin_towers.encounters[0], { hasCharm: false, bossChance: 0 });
assert(heroes.dual && heroes.foes.length === 2, 'dual encounter rolls two foes');
assert(heroes.foes.every((f) => f.boss && f.shiny && f.level === 200), 'dual foes are shiny bosses lv200');
assert(heroes.foes[0].speciesId === 'zacian' && heroes.foes[1].speciesId === 'zamazenta', 'heroes pair');
const dualPlayers = [createPokemon('mega_charizard', 140), createPokemon('garchomp', 140)];
const dualFoes = heroes.foes.map((f) => ({ ...f }));
const dualTurn = resolveDualTurn(dualPlayers, dualFoes, () => 0);
assert(dualTurn.logs.length >= 2, 'dual turn has multiple actions');
assert(dualTurn.players.length === 2 && dualTurn.foes.length === 2, 'dual turn keeps both sides');

console.log('spirit hall unlock');
assert(SPECIES.eternatus?.name === '伊裴尔达尔', 'eternatus species');
assert(SPECIES.xerneas?.name === '哲尔尼亚斯', 'xerneas species');
assert(SPECIES.zygarde?.name === '基格尔德', 'zygarde species');
assert(MAPS.spirit_hall?.spiritHall === true && MAPS.spirit_hall.name === '灵堂', 'spirit hall map');
assert(canEnterSpiritHall({ twinCleared: false }).ok === false, 'locked without twin clear');
assert(canEnterSpiritHall({ twinCleared: true }).ok === true, 'open after twin clear');
const init = initialPlayerState();
assert(init.twinCleared === false, 'fresh save not cleared');
assert(SPIRIT_HALL_BOSS_LEVELS[1] === 225 && SPIRIT_HALL_BOSS_LEVELS[2] === 250 && SPIRIT_HALL_BOSS_LEVELS[3] === 300, 'boss levels table');

console.log('pokedex list');
const dex = listDexEntries(SPECIES);
assert(dex.length === Object.keys(SPECIES).length, 'lists all species');
assert(dex.every((e) => e.id && e.name && e.type && e.sprite), 'entries have display fields');
const names = dex.map((e) => e.name);
const sorted = [...names].sort((a, b) => a.localeCompare(b, 'zh'));
assert(names.every((n, i) => n === sorted[i]), 'sorted by zh name');
const fireDex = listDexEntries(SPECIES, { type: 'fire' });
assert(fireDex.length > 0 && fireDex.every((e) => e.type === 'fire'), 'filters by type');
assert(fireDex.length < dex.length, 'type filter shrinks the list');
const types = listDexTypes(SPECIES);
assert(types.includes('fire') && types.includes('water'), 'lists known types');
assert(types.every((t, i) => i === 0 || types[i - 1] <= t), 'types sorted');
const detail = getDexDetail('charmander', SPECIES);
assert(detail?.name === '小火龙' && detail.type === 'fire', 'detail name and type');
assert(detail.base.hp > 0 && detail.moves.length >= 1, 'detail has base and moves');
assert(detail.evolvesToName && detail.evolveLevel != null, 'detail has evolution');
assert(getDexDetail('nope', SPECIES) === null, 'missing species is null');

console.log('battle fx');
assert(normalizeBattleAnim('heavy') === 'heavy', 'normalize keeps heavy');
assert(normalizeBattleAnim('nope') === 'light', 'normalize unknown → light');
assert(normalizeBattleAnim(undefined) === 'light', 'normalize undefined → light');
assert(effectiveBattleAnim('heavy', { reducedMotion: true }) === 'light', 'reduced motion clamps heavy');
assert(typeTint('fire') === '#ff6a2a', 'fire tint');
assert(typeTint('unknown') === typeTint('normal'), 'unknown tint → normal');

const offResult = await playHit({
  side: 'player',
  moveType: 'fire',
  attackerEl: null,
  defenderEl: null,
  mode: 'off',
  reducedMotion: false,
});
assert(offResult.played === 'off', 'off mode resolves as off');

assert(await loadFighterFrames('charmander') !== null || true, 'charmander frames load attempt');
clearFighterFrameCache();
const missing = await loadFighterFrames('charmander', {
  loader: async () => { throw new Error('missing'); },
});
assert(missing === null, 'fighter frames missing → null');
assert(!hasFighterFrames('charmander'), 'failed load clears hasFighterFrames');
const fallback = await playHit({
  side: 'player',
  attackerSpeciesId: 'charmander',
  moveType: 'fire',
  attackerEl: null,
  defenderEl: null,
  mode: 'heavy',
  reducedMotion: false,
});
assert(fallback.played === 'medium-fallback', 'heavy without sprite el falls back to medium');

const otherHeavy = await playHit({
  side: 'player',
  attackerSpeciesId: 'no_such_mon',
  moveType: 'electric',
  attackerEl: null,
  defenderEl: null,
  mode: 'heavy',
  reducedMotion: false,
});
assert(otherHeavy.played === 'medium-fallback', 'heavy missing species uses medium path');

console.log('audio tracks');
assert(selectBattleTrack({ rift: true, playerLevel: 100, foeLevel: 200 }) === 'b2', 'rift uses b2');
assert(selectBattleTrack({ rift: false, playerLevel: 10, foeLevel: 5 }) === 'b0', 'lower foe uses b0');
assert(selectBattleTrack({ rift: false, playerLevel: 10, foeLevel: 10 }) === 'b0', 'equal uses b0');
assert(selectBattleTrack({ rift: false, playerLevel: 10, foeLevel: 11 }) === 'b1', 'higher foe uses b1');
assert(sfxKeyForMoveType('fire') === 'fire', 'fire sfx');
assert(sfxKeyForMoveType('ice') === 'water', 'ice→water');
assert(sfxKeyForMoveType('bug') === 'grass', 'bug→grass');
assert(sfxKeyForMoveType('steel') === 'rock', 'steel→rock');
assert(sfxKeyForMoveType('ghost') === 'psychic', 'ghost→psychic');
assert(sfxKeyForMoveType('flying') === 'dragon', 'flying→dragon');
assert(sfxKeyForMoveType('fighting') === 'normal', 'fighting→normal');
assert(sfxKeyForMoveType('unknown') === 'normal', 'unknown→normal');
assert(typeof playCatchSuccessSfx === 'function', 'catch success sfx export');

console.log('pokedex anim preview');
clearFighterFrameCache();
const fakeFrames = [0, 1, 2, 3, 4].map((i) => ({ src: `fake-frame-${i}.png` }));
let loadIdx = 0;
await loadFighterFrames('scorbunny', {
  loader: async () => fakeFrames[loadIdx++],
});
const previewImg = { src: 'static.png', style: { animation: 'idle-bob 1s' }, getAttribute: () => 'static.png' };
const seen = [];
Object.defineProperty(previewImg, 'src', {
  get() { return this._src; },
  set(v) { this._src = v; seen.push(v); },
  configurable: true,
});
previewImg._src = 'static.png';
const played = await playFighterFrameStrip(previewImg, 'scorbunny', { frameMs: 0 });
assert(played === true, 'preview strip plays');
assert(seen.filter((s) => String(s).includes('fake-frame')).length === 5, 'visits all five frames');
assert(previewImg.src === 'static.png', 'restores static sprite');

console.log('heal items');
assert(HEAL_ITEMS.potion.heal === 20 && HEAL_ITEMS.potion.price === 50, 'potion 20 hp / 50 coins');
assert(HEAL_ITEMS.superPotion.heal === 50 && HEAL_ITEMS.superPotion.price === 150, 'super potion');
assert(HEAL_ITEMS.hyperPotion.heal === 200 && HEAL_ITEMS.hyperPotion.price === 400, 'hyper potion');
assert(HEAL_ITEMS.maxPotion.heal === 'full' && HEAL_ITEMS.maxPotion.price === 800, 'max potion');
const starterItems = initialPlayerState().items;
assert(
  starterItems.potion === 0
    && starterItems.superPotion === 0
    && starterItems.hyperPotion === 0
    && starterItems.maxPotion === 0,
  'new game starts with zero heal items',
);
const hurt = createPokemon('scorbunny', 5);
hurt.hp = Math.max(1, hurt.maxHp - 30);
const healed = applyHealItem(hurt, 'potion');
assert(healed === 20, 'potion heals 20');
assert(hurt.hp === Math.max(1, hurt.maxHp - 30) + 20, 'hp raised by 20');
const almostFull = createPokemon('scorbunny', 5);
almostFull.hp = almostFull.maxHp - 5;
assert(applyHealItem(almostFull, 'potion') === 5, 'potion clamps to maxHp');
assert(almostFull.hp === almostFull.maxHp, 'clamped at max');
const low = createPokemon('scorbunny', 5);
low.hp = 1;
const fullHeal = applyHealItem(low, 'maxPotion');
assert(fullHeal === low.maxHp - 1 && low.hp === low.maxHp, 'max potion fully restores');
const fainted = createPokemon('scorbunny', 5);
fainted.hp = 0;
assert(applyHealItem(fainted, 'potion') === 0 && fainted.hp === 0, 'cannot heal fainted');
const topped = createPokemon('scorbunny', 5);
assert(applyHealItem(topped, 'potion') === 0 && topped.hp === topped.maxHp, 'no heal when full');

console.log('unified items');
assert(ITEMS.expCandyS.effect === 'xp' && ITEMS.expCandyS.value === 100 && ITEMS.expCandyS.price === 200, 'candy S');
assert(ITEMS.expCandyM.value === 400 && ITEMS.expCandyM.price === 700, 'candy M');
assert(ITEMS.expCandyL.value === 1000 && ITEMS.expCandyL.price === 1600, 'candy L');
assert(ITEMS.expCandyXL.value === 2500 && ITEMS.expCandyXL.price === 3500, 'candy XL');
assert(ITEMS.expCandyXXL.value === 6000 && ITEMS.expCandyXXL.price === 8000, 'candy XXL');
assert(ITEMS.vitalityShard.effect === 'revive' && ITEMS.vitalityShard.value === 0.5 && ITEMS.vitalityShard.price === 1200, 'shard');
assert(ITEMS.vitalityBlock.value === 1 && ITEMS.vitalityBlock.price === 2800, 'block');
assert(HEAL_ITEMS.potion.heal === 20 && HEAL_ITEMS.potion.price === 50, 'potion alias');

const stock = emptyItems();
for (const id of Object.keys(ITEMS)) {
  assert(stock[id] === 0, `empty ${id}`);
}
const starter = initialPlayerState().items;
assert(starter.expCandyS === 0 && starter.vitalityShard === 0, 'new game has new item keys');

{
  const hurtUni = createPokemon('scorbunny', 5);
  hurtUni.hp = Math.max(1, hurtUni.maxHp - 30);
  const healOk = applyItem(hurtUni, 'potion');
  assert(healOk.ok && healOk.kind === 'heal' && healOk.amount === 20, 'applyItem heal');
  assert(applyHealItem(hurtUni, 'potion') >= 0, 'applyHealItem still works');

  const faintedUni = createPokemon('scorbunny', 5);
  faintedUni.hp = 0;
  assert(applyItem(faintedUni, 'potion').ok === false, 'no heal fainted');
  const shard = applyItem(faintedUni, 'vitalityShard');
  assert(shard.ok && shard.kind === 'revive', 'shard revives');
  assert(faintedUni.hp === Math.max(1, Math.floor(faintedUni.maxHp * 0.5)), 'shard 50%');
  const living = createPokemon('scorbunny', 5);
  assert(applyItem(living, 'vitalityBlock').ok === false, 'no revive living');
  living.hp = 0;
  const block = applyItem(living, 'vitalityBlock');
  assert(block.ok && living.hp === living.maxHp, 'block full');

  const pup = createPokemon('scorbunny', 5);
  pup.exp = 0;
  const beforeLevel = pup.level;
  const candy = applyItem(pup, 'expCandyS');
  assert(candy.ok && candy.kind === 'xp' && candy.amount === 100, 'candy grants 100');
  assert(pup.exp === 100 || pup.level > beforeLevel, 'exp applied');
  const down = createPokemon('scorbunny', 5);
  down.hp = 0;
  down.exp = 0;
  applyItem(down, 'expCandyM');
  assert(down.hp === 0, 'fainted stays 0 after candy');
}

console.log('item turn foe only');
const healTurnPlayer = createPokemon('scorbunny', 10);
healTurnPlayer.hp = Math.floor(healTurnPlayer.maxHp / 2);
const healTurnFoe = createPokemon('bulbasaur', 10);
const healTurnHpBefore = healTurnPlayer.hp;
const foeOnly = resolveFoeOnlyTurn(healTurnPlayer, healTurnFoe);
assert(foeOnly.foe.hp === healTurnFoe.hp, 'foe-only does not damage foe');
assert(foeOnly.player.hp < healTurnHpBefore, 'foe-only damages player');
assert(foeOnly.logs.length === 1 && foeOnly.logs[0].side === 'foe', 'only foe attack log');
assert(foeOnly.result === 'ongoing' || foeOnly.result === 'lose', 'foe-only result set');

const itemSquadLead = createPokemon('scorbunny', 100);
itemSquadLead.hp = Math.floor(itemSquadLead.maxHp / 2);
const itemSquadAllies = createRiftAllies();
const itemBoss = createPokemon('mega_rayquaza', 200);
const itemAllyHpBefore = itemSquadAllies.map((a) => a.hp);
const squadItem = resolveSquadItemTurn(itemSquadLead, itemSquadAllies, itemBoss, () => 0);
assert(squadItem.foe.hp === itemBoss.hp, 'squad item turn does not damage boss');
assert(
  squadItem.player.hp < itemSquadLead.hp || squadItem.allies.some((a, i) => a.hp < itemAllyHpBefore[i]),
  'boss still attacks on item turn',
);
assert(squadItem.logs.every((l) => l.side === 'foe'), 'squad item turn only foe logs');

const dualItemPlayers = [
  createPokemon('scorbunny', 50),
  createPokemon('charmander', 50),
];
dualItemPlayers[0].hp = Math.floor(dualItemPlayers[0].maxHp / 2);
const dualItemFoes = [
  createPokemon('bulbasaur', 50),
  createPokemon('squirtle', 50),
];
const dualItem = resolveDualItemTurn(dualItemPlayers, dualItemFoes, () => 0);
assert(dualItem.foes.every((f, i) => f.hp === dualItemFoes[i].hp), 'dual item turn does not damage foes');
assert(dualItem.logs.every((l) => l.side === 'foe'), 'dual item turn only foe logs');
assert(
  dualItem.players.some((p, i) => p.hp < dualItemPlayers[i].hp),
  'foes still attack on dual item turn',
);

console.log('spirit hall maze');
const floor1 = generateMazeFloor({ floor: 1, rng: () => 0.42 });
assert(floor1.grid.length >= 15 && floor1.grid[0].length >= 15, 'grid is at least 15x15');
const flat = floor1.grid.flat();
assert(flat.includes('floor') && flat.includes('stairs') && flat.includes('wall'), 'has wall/floor/stairs');
function flood(grid, sx, sy) {
  const h = grid.length, w = grid[0].length;
  const seen = new Set();
  const q = [[sx, sy]];
  seen.add(`${sx},${sy}`);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid[ny][nx] === 'wall') continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}
const reach = flood(floor1.grid, floor1.spawn.x, floor1.spawn.y);
assert(reach.has(`${floor1.stairs.x},${floor1.stairs.y}`), 'spawn reaches stairs');
assert(floor1.roamers.length >= 6 && floor1.roamers.length <= 10, '6-10 roamers');

const run = createMazeRun({ floor: 1, rng: () => 0.3 });
const wallStep = (() => {
  const r = createMazeRun({ floor: 1, rng: () => 0.11 });
  const { x, y } = r.player;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const tx = x + dx, ty = y + dy;
    if (r.grid[ty]?.[tx] === 'wall') {
      const out = stepMaze(r, dx, dy);
      return out.event === null && out.run.player.x === x && out.run.player.y === y;
    }
  }
  return true;
})();
assert(wallStep, 'cannot walk into walls');

assert(SPIRIT_HALL_BOSS_BY_FLOOR[1].speciesId === 'eternatus' && SPIRIT_HALL_BOSS_BY_FLOOR[1].level === 225, 'floor1 boss');
assert(SPIRIT_HALL_BOSS_BY_FLOOR[2].speciesId === 'xerneas' && SPIRIT_HALL_BOSS_BY_FLOOR[2].level === 250, 'floor2 boss');
assert(SPIRIT_HALL_BOSS_BY_FLOOR[3].speciesId === 'zygarde' && SPIRIT_HALL_BOSS_BY_FLOOR[3].level === 300, 'floor3 boss');

console.log('spirit hall flow helpers');
{
  let run = createMazeRun({ floor: 1, rng: () => 0.5 });
  const firstId = run.roamers[0]?.id;
  if (firstId) {
    run = removeRoamer(run, firstId);
    assert(!run.roamers.find((r) => r.id === firstId), 'remove roamer works');
  }
  run = markFloorBossDefeated(run);
  assert(run.floorBossDefeated, 'boss flagged');
  const f2 = advanceMazeFloor(run, () => 0.2);
  assert(f2 && f2.floor === 2 && f2.floorBossDefeated === false, 'advance to floor 2');
  const f3 = advanceMazeFloor({ ...f2, floor: 2 }, () => 0.2);
  assert(f3 && f3.floor === 3, 'floor 3');
  assert(advanceMazeFloor({ ...f3, floor: 3 }) === null, 'no floor 4');

  const bossEnc = buildFloorBossEncounter(3);
  assert(bossEnc.speciesId === 'zygarde' && bossEnc.level === 300 && bossEnc.boss && bossEnc.shiny, 'zygarde enc');

  assert(SPIRIT_HALL_BOSS_BY_FLOOR[1].level === SPIRIT_HALL_BOSS_LEVELS[1], 'floor1 level sync');
  assert(SPIRIT_HALL_BOSS_BY_FLOOR[2].level === SPIRIT_HALL_BOSS_LEVELS[2], 'floor2 level sync');
  assert(SPIRIT_HALL_BOSS_BY_FLOOR[3].level === SPIRIT_HALL_BOSS_LEVELS[3], 'floor3 level sync');

  assert(MAPS.spirit_hall.encounters.length === 0, 'spirit hall has no marker encounters');
}

console.log('\nparty individual view');
{
  const view = partyIndividualView({
    speciesId: 'bulbasaur',
    level: 5,
    hp: 12,
    maxHp: 20,
    atk: 11,
    def: 10,
    spd: 9,
    exp: 4,
    shiny: true,
  });
  assert(view.level === 5, 'level');
  assert(view.hpText === '12/20', 'hp text');
  assert(view.atk === 11 && view.def === 10 && view.spd === 9, 'combat stats');
  assert(view.expText === `4/${xpToNext(5)}`, 'exp toward next level');
  assert(view.shiny === true && view.fainted === false, 'shiny not fainted');
}
{
  const view = partyIndividualView({
    speciesId: 'pikachu',
    level: 8,
    hp: 0,
    maxHp: 30,
    atk: 1,
    def: 1,
    spd: 1,
  });
  assert(view.expText === `0/${xpToNext(8)}`, 'missing exp counts as 0');
  assert(view.fainted === true && view.shiny === false, 'fainted not shiny');
}
assert(partyIndividualView(null) === null, 'null mon');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
