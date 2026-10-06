/** Game content: species, maps, balls, type chart. */
import { GENERATED_SPECIES, GENERATED_MAPS } from './generated-content.js';
import { REGION_SPECIES, REGION_MAPS } from './region-content.js';

const BASE_SPECIES = {
  scorbunny: {
    id: 'scorbunny',
    name: '炎兔儿',
    type: 'fire',
    base: { hp: 45, atk: 55, def: 35, spd: 60 },
    move: { name: '火花', power: 40, type: 'fire' },
    catchRate: 0.45,
    sprite: 'assets/pokemon/scorbunny.png',
    eyeOffset: { x: 0, y: -18 },
    evolvesTo: 'raboot',
    evolveLevel: 8,
  },
  raboot: {
    id: 'raboot',
    name: '腾蹴小将',
    type: 'fire',
    base: { hp: 55, atk: 70, def: 50, spd: 75 },
    move: { name: '火焰踢', power: 55, type: 'fire' },
    catchRate: 0.25,
    sprite: 'assets/pokemon/raboot.png',
    eyeOffset: { x: 0, y: -16 },
    evolvesTo: 'cinderace',
    evolveLevel: 16,
  },
  bulbasaur: {
    id: 'bulbasaur',
    name: '妙蛙种子',
    type: 'grass',
    base: { hp: 50, atk: 45, def: 45, spd: 40 },
    move: { name: '藤鞭', power: 40, type: 'grass' },
    catchRate: 0.45,
    sprite: 'assets/pokemon/bulbasaur.png',
    eyeOffset: { x: 0, y: -8 },
    evolvesTo: 'ivysaur',
    evolveLevel: 8,
  },
  ivysaur: {
    id: 'ivysaur',
    name: '妙蛙草',
    type: 'grass',
    base: { hp: 60, atk: 58, def: 58, spd: 50 },
    move: { name: '飞叶快刀', power: 55, type: 'grass' },
    catchRate: 0.25,
    sprite: 'assets/pokemon/ivysaur.png',
    eyeOffset: { x: 0, y: -6 },
    evolvesTo: 'venusaur',
    evolveLevel: 16,
  },
  squirtle: {
    id: 'squirtle',
    name: '杰尼龟',
    type: 'water',
    base: { hp: 48, atk: 48, def: 55, spd: 42 },
    move: { name: '水枪', power: 40, type: 'water' },
    catchRate: 0.45,
    sprite: 'assets/pokemon/squirtle.png',
    eyeOffset: { x: 0, y: -14 },
    evolvesTo: 'wartortle',
    evolveLevel: 8,
  },
  wartortle: {
    id: 'wartortle',
    name: '卡咪龟',
    type: 'water',
    base: { hp: 58, atk: 58, def: 70, spd: 52 },
    move: { name: '水之尾', power: 55, type: 'water' },
    catchRate: 0.25,
    sprite: 'assets/pokemon/wartortle.png',
    eyeOffset: { x: 0, y: -12 },
    evolvesTo: 'blastoise',
    evolveLevel: 16,
  },
  pikachu: {
    id: 'pikachu',
    name: '皮卡丘',
    type: 'electric',
    base: { hp: 40, atk: 52, def: 35, spd: 70 },
    move: { name: '电击', power: 40, type: 'electric' },
    catchRate: 0.35,
    sprite: 'assets/pokemon/pikachu.png',
    eyeOffset: { x: 0, y: -12 },
    evolvesTo: 'raichu',
    evolveLevel: 8,
  },
  raichu: {
    id: 'raichu',
    name: '雷丘',
    type: 'electric',
    base: { hp: 52, atk: 75, def: 50, spd: 90 },
    move: { name: '十万伏特', power: 60, type: 'electric' },
    catchRate: 0.2,
    sprite: 'assets/pokemon/raichu.png',
    eyeOffset: { x: 0, y: -10 },
    evolvesTo: 'raichu_x',
    evolveLevel: 16,
  },
  geodude: {
    id: 'geodude',
    name: '小拳石',
    type: 'rock',
    base: { hp: 50, atk: 60, def: 70, spd: 25 },
    move: { name: '落石', power: 40, type: 'rock' },
    catchRate: 0.4,
    sprite: 'assets/pokemon/geodude.png',
    eyeOffset: { x: 0, y: -4 },
    evolvesTo: 'graveler',
    evolveLevel: 8,
  },
  graveler: {
    id: 'graveler',
    name: '隆隆石',
    type: 'rock',
    base: { hp: 65, atk: 80, def: 95, spd: 35 },
    move: { name: '岩石爆击', power: 55, type: 'rock' },
    catchRate: 0.25,
    sprite: 'assets/pokemon/graveler.png',
    eyeOffset: { x: 0, y: -2 },
    evolvesTo: 'golem',
    evolveLevel: 16,
  },
  mega_rayquaza: {
    id: 'mega_rayquaza',
    name: '超级裂空座',
    type: 'dragon',
    base: { hp: 80, atk: 120, def: 70, spd: 110 },
    move: { name: '飞冲升天', power: 140, type: 'flying' },
    moves: [
      { name: '龙星群', power: 120, type: 'dragon' },
      { name: '飞冲升天', power: 140, type: 'flying' },
      { name: '逆鳞', power: 110, type: 'dragon' },
      { name: '空气斩', power: 45, type: 'flying', aoe: true },
    ],
    catchRate: 0.04,
    sprite: 'assets/pokemon/mega_rayquaza.png',
    eyeOffset: { x: 0, y: -6 },
    mega: true,
  },
};

export const SPECIES = { ...GENERATED_SPECIES, ...REGION_SPECIES, ...BASE_SPECIES };

/** Sorted pokedex rows for UI: id, name, type, sprite. */
export function listDexEntries(species = SPECIES) {
  return Object.values(species)
    .map((sp) => ({
      id: sp.id,
      name: sp.name,
      type: sp.type,
      sprite: sp.sprite,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

/** Attack type -> defender type -> multiplier (missing = 1) */
export const TYPE_CHART = {
  fire: { grass: 1.5, ice: 1.5, bug: 1.5, steel: 1.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 1.5, rock: 1.5, ground: 1.5, water: 0.5, grass: 0.5, dragon: 0.5 },
  grass: { water: 1.5, rock: 1.5, ground: 1.5, fire: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
  electric: { water: 1.5, flying: 1.5, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0.5 },
  rock: { fire: 1.5, ice: 1.5, flying: 1.5, bug: 1.5, fighting: 0.5, ground: 0.5, steel: 0.5 },
  bug: { grass: 1.5, psychic: 1.5, dark: 1.5, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
  poison: { grass: 1.5, fairy: 1.5, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0.5 },
  psychic: { fighting: 1.5, poison: 1.5, psychic: 0.5, steel: 0.5, dark: 0.5 },
  ghost: { psychic: 1.5, ghost: 1.5, dark: 0.5, normal: 0.5 },
  dragon: { dragon: 1.5, steel: 0.5, fairy: 0.5 },
  ice: { grass: 1.5, ground: 1.5, flying: 1.5, dragon: 1.5, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  ground: { fire: 1.5, electric: 1.5, poison: 1.5, rock: 1.5, steel: 1.5, grass: 0.5, bug: 0.5 },
  flying: { grass: 1.5, fighting: 1.5, bug: 1.5, electric: 0.5, rock: 0.5, steel: 0.5 },
  fighting: { normal: 1.5, ice: 1.5, rock: 1.5, dark: 1.5, steel: 1.5, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0.5 },
  normal: { rock: 0.5, ghost: 0.5, steel: 0.5 },
  steel: { ice: 1.5, rock: 1.5, fairy: 1.5, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  dark: { psychic: 1.5, ghost: 1.5, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  fairy: { fighting: 1.5, dragon: 1.5, dark: 1.5, fire: 0.5, poison: 0.5, steel: 0.5 },
};

export const BALLS = {
  poke: {
    id: 'poke',
    name: '精灵球',
    multiplier: 1,
    price: 100,
    sprite: 'assets/balls/poke.png',
  },
  great: {
    id: 'great',
    name: '超级球',
    multiplier: 1.5,
    price: 300,
    sprite: 'assets/balls/great.png',
  },
  ultra: {
    id: 'ultra',
    name: '高级球',
    multiplier: 2,
    price: 600,
    sprite: 'assets/balls/ultra.png',
  },
  quick: {
    id: 'quick',
    name: '先机球',
    multiplier: 1,
    firstThrowBonus: 4,
    price: 400,
    sprite: 'assets/balls/quick.png',
  },
  master: {
    id: 'master',
    name: '大师球',
    multiplier: 1,
    alwaysCatch: true,
    price: 2000,
    sprite: 'assets/balls/master.png',
  },
};

export const SHINY_CHARM = {
  id: 'shinyCharm',
  name: '闪耀护符',
  price: 1000,
};

const BASE_MAPS = {
  grassland: {
    id: 'grassland',
    name: '绿茵原野',
    image: 'assets/maps/grassland.png',
    bossChance: 0.08,
    encounters: [
      {
        id: 'wild-bulbasaur',
        kind: 'wild',
        speciesId: 'bulbasaur',
        level: 5,
        x: 28,
        y: 55,
      },
      {
        id: 'trainer-path',
        kind: 'trainer',
        trainerName: '小路',
        reward: 250,
        x: 62,
        y: 48,
        team: [
          { speciesId: 'pikachu', level: 6 },
          { speciesId: 'bulbasaur', level: 5 },
          { speciesId: 'scorbunny', level: 5 },
        ],
      },
      {
        id: 'trainer-youngster',
        kind: 'trainer',
        trainerName: '少年',
        reward: 200,
        x: 45,
        y: 36,
        team: [
          { speciesId: 'squirtle', level: 5 },
          { speciesId: 'pikachu', level: 5 },
          { speciesId: 'bulbasaur', level: 6 },
          { speciesId: 'geodude', level: 5 },
        ],
      },
      {
        id: 'trainer-bug',
        kind: 'trainer',
        trainerName: '捕虫少年',
        reward: 280,
        x: 78,
        y: 64,
        team: [
          { speciesId: 'weedle', level: 5 },
          { speciesId: 'oddish', level: 6 },
          { speciesId: 'chikorita', level: 5 },
        ],
      },
    ],
  },
  coast: {
    id: 'coast',
    name: '潮汐海岸',
    image: 'assets/maps/coast.png',
    bossChance: 0.08,
    encounters: [
      {
        id: 'wild-squirtle',
        kind: 'wild',
        speciesId: 'squirtle',
        level: 6,
        x: 35,
        y: 58,
      },
      {
        id: 'trainer-sailor',
        kind: 'trainer',
        trainerName: '水手',
        reward: 350,
        x: 68,
        y: 45,
        team: [
          { speciesId: 'squirtle', level: 8 },
          { speciesId: 'wartortle', level: 7 },
          { speciesId: 'horsea', level: 6 },
          { speciesId: 'psyduck', level: 7 },
        ],
      },
      {
        id: 'trainer-swimmer',
        kind: 'trainer',
        trainerName: '泳者',
        reward: 300,
        x: 22,
        y: 40,
        team: [
          { speciesId: 'horsea', level: 6 },
          { speciesId: 'squirtle', level: 7 },
          { speciesId: 'magikarp', level: 6 },
        ],
      },
      {
        id: 'trainer-fisher',
        kind: 'trainer',
        trainerName: '渔夫',
        reward: 400,
        x: 50,
        y: 72,
        team: [
          { speciesId: 'magikarp', level: 7 },
          { speciesId: 'horsea', level: 8 },
          { speciesId: 'psyduck', level: 6 },
          { speciesId: 'wartortle', level: 8 },
          { speciesId: 'mudkip', level: 7 },
        ],
      },
    ],
  },
  cave: {
    id: 'cave',
    name: '熔岩洞窟',
    image: 'assets/maps/cave.png',
    bossChance: 0.2,
    isCave: true,
    encounters: [
      {
        id: 'wild-scorbunny',
        kind: 'wild',
        speciesId: 'scorbunny',
        level: 7,
        x: 40,
        y: 52,
      },
      {
        id: 'trainer-miner',
        kind: 'trainer',
        trainerName: '矿工',
        reward: 400,
        x: 70,
        y: 50,
        team: [
          { speciesId: 'geodude', level: 8 },
          { speciesId: 'graveler', level: 8 },
          { speciesId: 'geodude', level: 7 },
          { speciesId: 'onix', level: 8 },
        ],
      },
      {
        id: 'trainer-hiker',
        kind: 'trainer',
        trainerName: '登山男',
        reward: 350,
        x: 24,
        y: 70,
        team: [
          { speciesId: 'geodude', level: 7 },
          { speciesId: 'aron', level: 8 },
          { speciesId: 'machop', level: 7 },
        ],
      },
      {
        id: 'trainer-explorer',
        kind: 'trainer',
        trainerName: '探险家',
        reward: 450,
        x: 54,
        y: 34,
        team: [
          { speciesId: 'onix', level: 8 },
          { speciesId: 'geodude', level: 8 },
          { speciesId: 'aron', level: 7 },
          { speciesId: 'machop', level: 8 },
          { speciesId: 'gastly', level: 7 },
          { speciesId: 'graveler', level: 8 },
        ],
      },
    ],
  },
};

export const RIFT_UNLOCK_LEVEL = 100;
export const RIFT_FRUIT_COST = 3;
export const RIFT_FRUIT_SPECIES = 'chikorita';
export const RIFT_BOSS_LEVEL = 200;
export const RIFT_FRUIT = {
  id: 'riftFruit',
  name: '异次元果',
  price: 30,
};
export const RIFT_ALLIES = [
  { speciesId: 'mega_salamence', level: 100 },
  { speciesId: 'mega_dragonite', level: 100 },
  { speciesId: 'garchomp', level: 100 },
];

const RIFT_MAP = {
  id: 'rift',
  name: '异次元',
  image: 'assets/maps/rift.png',
  bossChance: 0,
  rift: true,
  encounters: [
    {
      id: 'rayquaza',
      kind: 'wild',
      squad: true,
      speciesId: 'mega_rayquaza',
      level: RIFT_BOSS_LEVEL,
      x: 50,
      y: 46,
    },
  ],
};

export const MAPS = { ...BASE_MAPS, ...GENERATED_MAPS, ...REGION_MAPS, rift: RIFT_MAP };

export const SHINY_RATE_WITH_CHARM = 1 / 8;
export const BOSS_STAT_MULT = 1.5;
export const BOSS_CATCH_MULT = 0.6;
export const PARTY_CAP = 99;
export const ACTIVE_CAP = 6;

/** Keep the earliest party members when a save exceeds the cap. */
export function trimParty(party, cap = PARTY_CAP) {
  if (!Array.isArray(party)) return [];
  return party.slice(0, cap);
}

/** The first Pokémon in party order are the ones that can be sent out. */
export function activeParty(party, cap = ACTIVE_CAP) {
  return (party || []).slice(0, cap);
}

/** Move one party member up (dir -1) or down (dir 1). */
export function movePartyMember(party, uid, dir) {
  const i = party.findIndex((p) => p.uid === uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= party.length) return false;
  const [mon] = party.splice(i, 1);
  party.splice(j, 0, mon);
  return true;
}

/** Levels shown for a wild encounter or a trainer team. */
export function encounterLevels(enc) {
  if (enc?.kind === 'trainer' && enc.team?.length) return enc.team.map((m) => m.level);
  return [enc.level];
}

/** Highest level among the party. The rift opens once this reaches 100. */
export function partyMaxLevel(party) {
  return (party || []).reduce((max, mon) => Math.max(max, mon?.level || 0), 0);
}

/** One fruit for defeating 菊草叶. Evolutions do not drop it. */
export function riftFruitDrop(speciesId) {
  return speciesId === RIFT_FRUIT_SPECIES ? 1 : 0;
}

/**
 * Spend fruit to enter the rift. Mutates state only when the gate opens.
 * Returns { ok, reason } where reason is 'level' or 'fruit'.
 */
export function trySpendRiftFruit(state, level) {
  if (level < RIFT_UNLOCK_LEVEL) return { ok: false, reason: 'level' };
  const owned = state.riftFruit || 0;
  if (owned < RIFT_FRUIT_COST) return { ok: false, reason: 'fruit' };
  state.riftFruit = owned - RIFT_FRUIT_COST;
  return { ok: true };
}

export function createRiftAllies() {
  return RIFT_ALLIES.map((slot) => createPokemon(slot.speciesId, slot.level));
}

/** Roll shiny and boss. Trainer rolls once per team member. Squad bosses are fixed. */
export function rollEncounter(tmpl, {
  hasCharm = false,
  bossChance = 0,
  rng = Math.random,
  shinyRate = SHINY_RATE_WITH_CHARM,
} = {}) {
  if (tmpl.squad) {
    return {
      ...tmpl,
      shiny: true,
      boss: true,
      pokemon: createPokemon(tmpl.speciesId, tmpl.level, { shiny: true, boss: true }),
    };
  }
  if (tmpl.kind === 'trainer') {
    const team = tmpl.team.map((slot) => {
      const shiny = !!hasCharm && rng() < shinyRate;
      const boss = rng() < bossChance;
      return createPokemon(slot.speciesId, slot.level, { shiny, boss });
    });
    return { ...tmpl, team };
  }
  const shiny = !!hasCharm && rng() < shinyRate;
  const boss = rng() < bossChance;
  return {
    ...tmpl,
    shiny,
    boss,
    pokemon: createPokemon(tmpl.speciesId, tmpl.level, { shiny, boss }),
  };
}

/**
 * Keep wild encounters already rolled. Rebuild trainers that have no team,
 * and append trainers added to the map. Clears the beaten flag when a
 * single-Pokémon trainer is upgraded so the new team can be fought.
 */
export function syncEncounters(saved, maps, roll) {
  const encounters = {};
  const cleared = { ...(saved?.cleared || {}) };
  for (const [mapId, map] of Object.entries(maps)) {
    const current = saved?.encounters?.[mapId];
    if (!current) {
      encounters[mapId] = map.encounters.map((tmpl) => roll(map, tmpl));
      continue;
    }
    const byId = new Map(current.map((e) => [e.id, e]));
    encounters[mapId] = map.encounters.map((tmpl) => {
      const prev = byId.get(tmpl.id);
      if (tmpl.squad) {
        const mon = prev?.pokemon;
        const ready = mon?.speciesId === tmpl.speciesId
          && mon.shiny && mon.boss && mon.level === tmpl.level && prev.squad;
        return ready ? prev : roll(map, tmpl);
      }
      if (tmpl.kind === 'trainer') {
        const size = prev?.team?.length || 0;
        if (size >= 3 && size <= 6) return prev;
        delete cleared[`${mapId}:${tmpl.id}`];
        return roll(map, tmpl);
      }
      if (prev?.pokemon) return prev;
      return roll(map, tmpl);
    });
  }
  return { encounters, cleared };
}

export function typeMultiplier(attackType, defendType) {
  const row = TYPE_CHART[attackType];
  if (!row) return 1;
  return row[defendType] ?? 1;
}

export function statsFor(speciesId, level, isBoss = false) {
  const sp = SPECIES[speciesId];
  if (!sp) {
    return { hp: 40, atk: 40, def: 40, spd: 40 };
  }
  const scale = 1 + (level - 1) * 0.08;
  const boss = isBoss ? BOSS_STAT_MULT : 1;
  return {
    hp: Math.floor(sp.base.hp * scale * boss),
    atk: Math.floor(sp.base.atk * scale * boss),
    def: Math.floor(sp.base.def * scale * boss),
    spd: Math.floor(sp.base.spd * scale * boss),
  };
}

export function createPokemon(speciesId, level, { shiny = false, boss = false, exp = 0 } = {}) {
  const stats = statsFor(speciesId, level, boss);
  return {
    uid: `${speciesId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    speciesId,
    level,
    exp,
    shiny,
    boss,
    maxHp: stats.hp,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
  };
}

/** Gold from selling one Pokémon. Level sets the base; shiny, boss, and mega multiply it. */
export function sellPrice(mon) {
  const sp = SPECIES[mon.speciesId];
  let price = mon.level * 20;
  if (mon.shiny) price *= 3;
  if (mon.boss) price *= 2;
  if (sp?.mega) price *= 2;
  return price;
}

/** Remove one party member and add its sell price. Keeps at least one Pokémon. */
export function sellPokemon(state, uid) {
  if (!state?.party || state.party.length <= 1) return null;
  const idx = state.party.findIndex((p) => p.uid === uid);
  if (idx < 0) return null;
  const [mon] = state.party.splice(idx, 1);
  const price = sellPrice(mon);
  state.coins += price;
  return { mon, price };
}

export function initialPlayerState() {
  return {
    coins: 300,
    riftFruit: 0,
    hasShinyCharm: false,
    catchStyle: 'flick',
    balls: { poke: 5, great: 0, ultra: 0, quick: 0, master: 0 },
    party: [createPokemon('scorbunny', 5)],
    cleared: {},
    encounters: {},
  };
}
