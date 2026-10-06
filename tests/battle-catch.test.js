import { calcDamage, nextBattleStep, resolveSquadTurn, whoGoesFirstDeterministic } from '../js/battle.js';
import {
  normalizeBattleAnim,
  effectiveBattleAnim,
  typeTint,
  playHit,
  hasFighterFrames,
  loadFighterFrames,
  clearFighterFrameCache,
  playFighterFrameStrip,
} from '../js/battle-fx.js';
import { catchChance, catchOutlook, shakeCount, velocityFromDrag, simulateThrow } from '../js/catch.js';
import {
  createPokemon, createRiftAllies, typeMultiplier, sellPrice, sellPokemon, PARTY_CAP, ACTIVE_CAP,
  activeParty, movePartyMember, BALLS,
  encounterLevels, rollEncounter, syncEncounters, trimParty, SHINY_RATE_WITH_CHARM,
  partyMaxLevel, riftFruitDrop, trySpendRiftFruit,
  RIFT_UNLOCK_LEVEL, RIFT_FRUIT_COST, RIFT_FRUIT, RIFT_BOSS_LEVEL,
} from '../js/data.js';
import { gainExperience, xpReward, xpToNext, tryEvolve, EVOLVE_LEVEL, EVOLVE_LEVEL_MEGA } from '../js/level.js';
import { SPECIES, MAPS, listDexEntries, listDexTypes, getDexDetail } from '../js/data.js';

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
const { damage, typeMult } = calcDamage(atk, def, { power: 40, type: 'fire' });
assert(typeMult === 1.5, 'super effective mult');
assert(damage === Math.max(1, Math.floor((atk.atk * 40) / def.def * 1.5)), 'damage formula');

const rock = createPokemon('geodude', 5);
const { damage: d2, typeMult: m2 } = calcDamage(atk, rock, { power: 40, type: 'fire' });
assert(m2 === 0.5, 'fire vs rock resisted');
assert(d2 >= 1, 'min damage 1');

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
assert(Object.keys(MAPS).length === 20, '20 maps total');

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

assert(hasFighterFrames('charmander') && hasFighterFrames('scorbunny'), 'POC fighters registered');
assert(!hasFighterFrames('pikachu'), 'pikachu not in fighter POC');
clearFighterFrameCache();
const missing = await loadFighterFrames('charmander', {
  loader: async () => { throw new Error('missing'); },
});
assert(missing === null, 'fighter frames missing → null');
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
  attackerSpeciesId: 'pikachu',
  moveType: 'electric',
  attackerEl: null,
  defenderEl: null,
  mode: 'heavy',
  reducedMotion: false,
});
assert(otherHeavy.played === 'medium-fallback', 'heavy non-POC species uses medium path');

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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
