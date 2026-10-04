/**
 * Generates sprites + js/generated-content.js for new species/maps.
 * Run: node scripts/generate-content.mjs
 */
import fs from 'fs';
import path from 'path';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function pngFromRgba(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = rgba[i];
      raw[o + 1] = rgba[i + 1];
      raw[o + 2] = rgba[i + 2];
      raw[o + 3] = rgba[i + 3];
    }
  }
  const compressed = deflateSync(raw);
  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

function canvas(w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  return {
    w,
    h,
    rgba,
    clear(r, g, b, a = 255) {
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = r;
        rgba[i * 4 + 1] = g;
        rgba[i * 4 + 2] = b;
        rgba[i * 4 + 3] = a;
      }
    },
    set(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    },
    fillRect(x, y, rw, rh, r, g, b, a = 255) {
      for (let yy = y; yy < y + rh; yy++)
        for (let xx = x; xx < x + rw; xx++) this.set(xx, yy, r, g, b, a);
    },
    fillCircle(cx, cy, rad, r, g, b, a = 255) {
      for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++)
        for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++)
          if ((xx - cx) ** 2 + (yy - cy) ** 2 <= rad * rad) this.set(xx, yy, r, g, b, a);
    },
    save(file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, pngFromRgba(w, h, rgba));
    },
  };
}

function upscale(src, scale) {
  const dst = canvas(src.w * scale, src.h * scale);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      dst.fillRect(x * scale, y * scale, scale, scale, src.rgba[i], src.rgba[i + 1], src.rgba[i + 2], src.rgba[i + 3]);
    }
  return dst;
}

const TYPE_RGB = {
  fire: [255, 100, 40],
  water: [60, 150, 230],
  grass: [70, 180, 90],
  electric: [250, 210, 50],
  rock: [160, 140, 110],
  bug: [170, 200, 50],
  poison: [160, 80, 200],
  psychic: [255, 100, 160],
  ghost: [100, 70, 160],
  dragon: [80, 100, 220],
  ice: [140, 220, 255],
  ground: [210, 170, 90],
  flying: [150, 190, 240],
  fighting: [200, 70, 50],
  normal: [200, 200, 190],
  steel: [160, 170, 190],
  dark: [70, 70, 90],
  fairy: [255, 160, 200],
};

function makePokemonSprite(type, stage, mega = false) {
  const c = canvas(32, 32);
  const [r, g, b] = TYPE_RGB[type] || [180, 180, 180];
  const bodyR = 6 + stage * 2;
  const accent = [
    Math.min(255, r + 40),
    Math.min(255, g + 40),
    Math.min(255, b + 40),
  ];
  if (mega) {
    c.fillCircle(16, 16, bodyR + 4, 255, 215, 80, 180);
  }
  c.fillCircle(16, 18, bodyR, r, g, b);
  c.fillCircle(16, 11, Math.max(5, bodyR - 1), r, g, b);
  c.fillRect(12, 10, 2, 2, 30, 30, 30);
  c.fillRect(18, 10, 2, 2, 30, 30, 30);
  // ears / horns by stage
  c.fillRect(9, 3, 3, 6 + stage, accent[0], accent[1], accent[2]);
  c.fillRect(20, 3, 3, 6 + stage, accent[0], accent[1], accent[2]);
  if (stage >= 2) {
    c.fillRect(24, 14, 5, 3, accent[0], accent[1], accent[2]);
  }
  if (mega) {
    c.fillRect(14, 2, 4, 3, 255, 230, 100);
    c.fillCircle(16, 22, 3, 255, 230, 120);
  }
  c.fillRect(11, 24, 3, 5, r, g, b);
  c.fillRect(18, 24, 3, 5, r, g, b);
  return upscale(c, 4);
}

function makeMap(kind) {
  const c = canvas(320, 180);
  if (kind === 'forest') {
    c.clear(90, 140, 100);
    c.fillRect(0, 0, 320, 70, 60, 90, 120);
    for (let i = 0; i < 25; i++) {
      const x = (i * 47) % 320;
      c.fillRect(x + 8, 70, 8, 40, 90, 60, 30);
      c.fillCircle(x + 12, 65, 18, 30, 100, 50);
    }
    c.fillRect(0, 130, 320, 50, 50, 80, 45);
  } else if (kind === 'thunder') {
    c.clear(50, 55, 80);
    c.fillRect(0, 100, 320, 80, 90, 85, 70);
    for (const x of [40, 100, 180, 260]) {
      c.fillRect(x, 40, 6, 70, 200, 200, 80);
      c.fillRect(x - 10, 70, 26, 4, 220, 220, 100);
    }
    c.fillCircle(280, 30, 10, 255, 240, 100);
  } else if (kind === 'ruins') {
    c.clear(180, 150, 100);
    c.fillRect(0, 120, 320, 60, 140, 110, 70);
    c.fillRect(60, 50, 80, 70, 160, 140, 110);
    c.fillRect(200, 40, 60, 80, 150, 130, 100);
    c.fillRect(90, 70, 20, 30, 40, 30, 20);
    c.fillRect(220, 70, 20, 30, 40, 30, 20);
  } else if (kind === 'frost') {
    c.clear(180, 220, 255);
    c.fillRect(0, 90, 320, 90, 200, 230, 250);
    c.fillRect(40, 120, 240, 40, 80, 160, 220);
    for (let i = 0; i < 12; i++) c.fillCircle(20 + i * 28, 100, 8, 240, 250, 255);
  } else if (kind === 'sky') {
    c.clear(120, 180, 255);
    c.fillRect(0, 110, 320, 70, 160, 220, 160);
    for (let i = 0; i < 8; i++) {
      c.fillCircle(30 + i * 40, 90 + (i % 3) * 8, 20, 255, 255, 255, 200);
    }
    c.fillCircle(260, 36, 22, 255, 230, 120);
  } else if (kind === 'champion') {
    c.clear(30, 30, 50);
    c.fillRect(0, 100, 320, 80, 60, 50, 70);
    c.fillRect(120, 40, 80, 100, 180, 150, 80);
    c.fillRect(140, 70, 40, 50, 40, 30, 20);
    for (let i = 0; i < 5; i++) c.fillCircle(40 + i * 60, 50, 6, 255, 215, 80);
  }
  return c;
}

/** 20 new base lines + completion stages for originals */
const LINES = [
  // complete originals (stages from 2nd evo / mega only where missing)
  {
    stages: [
      null, // scorbunny exists
      null, // raboot exists
      { id: 'cinderace', name: '闪焰王牌', type: 'fire', base: { hp: 70, atk: 95, def: 65, spd: 100 }, move: { name: '烈焰球', power: 70, type: 'fire' }, catchRate: 0.15 },
      { id: 'mega_cinderace', name: '超级闪焰王牌', type: 'fire', base: { hp: 85, atk: 120, def: 80, spd: 120 }, move: { name: '火焰球·极', power: 90, type: 'fire' }, catchRate: 0.08, mega: true },
    ],
    linkFrom: ['scorbunny', 'raboot', 'cinderace', 'mega_cinderace'],
  },
  {
    stages: [
      null,
      null,
      { id: 'venusaur', name: '妙蛙花', type: 'grass', base: { hp: 75, atk: 75, def: 75, spd: 60 }, move: { name: '阳光烈焰', power: 70, type: 'grass' }, catchRate: 0.15 },
      { id: 'mega_venusaur', name: '超级妙蛙花', type: 'grass', base: { hp: 90, atk: 95, def: 100, spd: 70 }, move: { name: '花瓣暴风', power: 90, type: 'grass' }, catchRate: 0.08, mega: true },
    ],
    linkFrom: ['bulbasaur', 'ivysaur', 'venusaur', 'mega_venusaur'],
  },
  {
    stages: [
      null,
      null,
      { id: 'blastoise', name: '水箭龟', type: 'water', base: { hp: 75, atk: 75, def: 90, spd: 60 }, move: { name: '水炮', power: 70, type: 'water' }, catchRate: 0.15 },
      { id: 'mega_blastoise', name: '超级水箭龟', type: 'water', base: { hp: 90, atk: 95, def: 115, spd: 70 }, move: { name: '加农水炮', power: 90, type: 'water' }, catchRate: 0.08, mega: true },
    ],
    linkFrom: ['squirtle', 'wartortle', 'blastoise', 'mega_blastoise'],
  },
  {
    stages: [
      null,
      null,
      { id: 'raichu_x', name: '雷丘·迅', type: 'electric', base: { hp: 65, atk: 95, def: 60, spd: 110 }, move: { name: '电光一闪·霆', power: 70, type: 'electric' }, catchRate: 0.12 },
      { id: 'mega_raichu', name: '超级雷丘', type: 'electric', base: { hp: 80, atk: 115, def: 75, spd: 130 }, move: { name: '伏特攻击', power: 90, type: 'electric' }, catchRate: 0.08, mega: true },
    ],
    linkFrom: ['pikachu', 'raichu', 'raichu_x', 'mega_raichu'],
  },
  {
    stages: [
      null,
      null,
      { id: 'golem', name: '隆隆岩', type: 'rock', base: { hp: 80, atk: 100, def: 115, spd: 40 }, move: { name: '地震', power: 70, type: 'rock' }, catchRate: 0.12 },
      { id: 'mega_golem', name: '超级隆隆岩', type: 'rock', base: { hp: 95, atk: 125, def: 140, spd: 50 }, move: { name: '岩石崩塌', power: 90, type: 'rock' }, catchRate: 0.08, mega: true },
    ],
    linkFrom: ['geodude', 'graveler', 'golem', 'mega_golem'],
  },
];

const NEW_LINES = [
  ['charmander', '小火龙', 'charmeleon', '火恐龙', 'charizard', '喷火龙', 'mega_charizard', '超级喷火龙', 'fire', { hp: 42, atk: 55, def: 40, spd: 55 }, ['火花', '火焰牙', '喷射火焰', '爆炸烈焰']],
  ['weedle', '独角虫', 'kakuna', '铁壳蛹', 'beedrill', '大针蜂', 'mega_beedrill', '超级大针蜂', 'bug', { hp: 38, atk: 50, def: 30, spd: 50 }, ['虫咬', '毒针', '双针', '飞弹针']],
  ['oddish', '走路草', 'gloom', '臭臭花', 'vileplume', '霸王花', 'mega_vileplume', '超级霸王花', 'grass', { hp: 45, atk: 48, def: 50, spd: 35 }, ['吸取', '麻痹粉', '花瓣舞', '强力鞭']],
  ['psyduck', '可达鸭', 'golduck', '哥达鸭', 'golduck_x', '哥达鸭·念', 'mega_golduck', '超级哥达鸭', 'psychic', { hp: 44, atk: 48, def: 42, spd: 50 }, ['念力', '水之波动', '精神强念', '幻象光线']],
  ['machop', '腕力', 'machoke', '豪力', 'machamp', '怪力', 'mega_machamp', '超级怪力', 'fighting', { hp: 50, atk: 65, def: 40, spd: 35 }, ['空手劈', '报复', '十字劈', '近身战']],
  ['magnemite', '小磁怪', 'magneton', '三合一磁怪', 'magnezone', '自爆磁怪', 'mega_magnezone', '超级自爆磁怪', 'steel', { hp: 35, atk: 50, def: 60, spd: 40 }, ['电击', '电磁飘浮', '加农光炮', '铁卷尾']],
  ['vulpix', '六尾', 'ninetales', '九尾', 'ninetales_x', '九尾·曜', 'mega_ninetales', '超级九尾', 'fire', { hp: 40, atk: 45, def: 40, spd: 58 }, ['火花', '奇异之光', '大字爆炎', '炼狱']],
  ['abra', '凯西', 'kadabra', '勇基拉', 'alakazam', '胡地', 'mega_alakazam', '超级胡地', 'psychic', { hp: 30, atk: 30, def: 25, spd: 80 }, ['念力', '幻象光线', '精神强念', '未来预知']],
  ['gastly', '鬼斯', 'haunter', '鬼斯通', 'gengar', '耿鬼', 'mega_gengar', '超级耿鬼', 'ghost', { hp: 35, atk: 45, def: 30, spd: 70 }, ['舌舔', '影子球', '恶之波动', '暗影潜袭']],
  ['onix', '大岩蛇', 'steelix', '大钢蛇', 'steelix_x', '大钢蛇·铠', 'mega_steelix', '超级大钢蛇', 'steel', { hp: 45, atk: 50, def: 90, spd: 30 }, ['落石', '铁尾', '铁头', '重磅冲撞']],
  ['horsea', '墨海马', 'seadra', '海刺龙', 'kingdra', '刺龙王', 'mega_kingdra', '超级刺龙王', 'water', { hp: 35, atk: 45, def: 45, spd: 55 }, ['水枪', '龙之怒', '冲浪', '水炮']],
  ['magikarp', '鲤鱼王', 'gyarados', '暴鲤龙', 'gyarados_x', '暴鲤龙·浪', 'mega_gyarados', '超级暴鲤龙', 'water', { hp: 30, atk: 20, def: 40, spd: 60 }, ['跃起', '咬住', '攀瀑', '破坏光线']],
  ['dratini', '迷你龙', 'dragonair', '哈克龙', 'dragonite', '快龙', 'mega_dragonite', '超级快龙', 'dragon', { hp: 42, atk: 55, def: 45, spd: 45 }, ['缠绕', '龙之波动', '逆鳞', '流星群']],
  ['chikorita', '菊草叶', 'bayleef', '月桂叶', 'meganium', '大竺葵', 'mega_meganium', '超级大竺葵', 'grass', { hp: 48, atk: 45, def: 55, spd: 40 }, ['藤鞭', '魔法叶', '花瓣舞', '日光光束']],
  ['mudkip', '水跃鱼', 'marshtomp', '沼跃鱼', 'swampert', '巨沼怪', 'mega_swampert', '超级巨沼怪', 'water', { hp: 50, atk: 55, def: 45, spd: 40 }, ['水枪', '泥巴射击', '地震', '浊流']],
  ['ralts', '拉鲁拉丝', 'kirlia', '奇鲁莉安', 'gardevoir', '沙奈朵', 'mega_gardevoir', '超级沙奈朵', 'fairy', { hp: 32, atk: 35, def: 30, spd: 45 }, ['念力', '魅惑之声', '月亮之力', '薄雾球']],
  ['aron', '可可多拉', 'lairon', '可多拉', 'aggron', '波士可多拉', 'mega_aggron', '超级波士可多拉', 'steel', { hp: 45, atk: 60, def: 80, spd: 30 }, ['撞击', '铁头', '金属爆炸', '重磅冲撞']],
  ['bagon', '宝贝龙', 'shelgon', '甲壳龙', 'salamence', '暴飞龙', 'mega_salamence', '超级暴飞龙', 'dragon', { hp: 45, atk: 65, def: 45, spd: 45 }, ['咬住', '龙爪', '飞翔', '流星群']],
  ['spheal', '海豹球', 'sealeo', '海魔狮', 'walrein', '帝牙海狮', 'mega_walrein', '超级帝牙海狮', 'ice', { hp: 55, atk: 45, def: 50, spd: 30 }, ['细雪', '冰砾', '暴风雪', '绝对零度']],
  ['shinx', '小猫怪', 'luxio', '勒克猫', 'luxray', '伦琴猫', 'mega_luxray', '超级伦琴猫', 'electric', { hp: 42, atk: 55, def: 35, spd: 50 }, ['电击', '电光', '疯狂伏特', '伏特替换']],
];

function scaleBase(base, stage) {
  const m = 1 + stage * 0.22;
  return {
    hp: Math.floor(base.hp * m),
    atk: Math.floor(base.atk * m),
    def: Math.floor(base.def * m),
    spd: Math.floor(base.spd * m),
  };
}

function buildSpecies() {
  const species = {};
  const evolveLevels = [8, 16, 24];

  for (const row of NEW_LINES) {
    const [id0, n0, id1, n1, id2, n2, id3, n3, type, base, moves] = row;
    const ids = [id0, id1, id2, id3];
    const names = [n0, n1, n2, n3];
    for (let s = 0; s < 4; s++) {
      const id = ids[s];
      const mega = s === 3;
      const power = 35 + s * 18;
      species[id] = {
        id,
        name: names[s],
        type: type === 'bug' && s >= 2 ? 'bug' : type,
        base: scaleBase(base, s),
        move: { name: moves[s], power, type },
        catchRate: Math.max(0.06, 0.45 - s * 0.1),
        sprite: `assets/pokemon/${id}.png`,
        eyeOffset: { x: 0, y: -10 + s },
        mega: mega || undefined,
      };
      if (s < 3) {
        species[id].evolvesTo = ids[s + 1];
        species[id].evolveLevel = evolveLevels[s];
      }
      // magikarp stage0 very weak atk already in base
    }
  }

  // completion stages for originals
  const completions = [
    ['cinderace', '闪焰王牌', 'fire', { hp: 70, atk: 95, def: 65, spd: 100 }, '烈焰球', 70, 'mega_cinderace', '超级闪焰王牌', { hp: 85, atk: 120, def: 80, spd: 120 }, '火焰球·极', 90],
    ['venusaur', '妙蛙花', 'grass', { hp: 75, atk: 75, def: 75, spd: 60 }, '阳光烈焰', 70, 'mega_venusaur', '超级妙蛙花', { hp: 90, atk: 95, def: 100, spd: 70 }, '花瓣暴风', 90],
    ['blastoise', '水箭龟', 'water', { hp: 75, atk: 75, def: 90, spd: 60 }, '水炮', 70, 'mega_blastoise', '超级水箭龟', { hp: 90, atk: 95, def: 115, spd: 70 }, '加农水炮', 90],
    ['raichu_x', '雷丘·迅', 'electric', { hp: 65, atk: 95, def: 60, spd: 110 }, '电光一闪·霆', 70, 'mega_raichu', '超级雷丘', { hp: 80, atk: 115, def: 75, spd: 130 }, '伏特攻击', 90],
    ['golem', '隆隆岩', 'rock', { hp: 80, atk: 100, def: 115, spd: 40 }, '地震', 70, 'mega_golem', '超级隆隆岩', { hp: 95, atk: 125, def: 140, spd: 50 }, '岩石崩塌', 90],
  ];

  for (const [id2, n2, type, b2, m2, p2, id3, n3, b3, m3, p3] of completions) {
    species[id2] = {
      id: id2,
      name: n2,
      type,
      base: b2,
      move: { name: m2, power: p2, type },
      catchRate: 0.15,
      sprite: `assets/pokemon/${id2}.png`,
      eyeOffset: { x: 0, y: -8 },
      evolvesTo: id3,
      evolveLevel: 24,
    };
    species[id3] = {
      id: id3,
      name: n3,
      type,
      base: b3,
      move: { name: m3, power: p3, type },
      catchRate: 0.08,
      sprite: `assets/pokemon/${id3}.png`,
      eyeOffset: { x: 0, y: -6 },
      mega: true,
    };
  }

  return species;
}

function buildMaps() {
  return {
    misty_woods: {
      id: 'misty_woods',
      name: '迷雾森林',
      image: 'assets/maps/misty_woods.png',
      bossChance: 0.1,
      encounters: [
        { id: 'w-weedle', kind: 'wild', speciesId: 'weedle', level: 9, x: 30, y: 55 },
        { id: 'w-oddish', kind: 'wild', speciesId: 'oddish', level: 10, x: 55, y: 60 },
        { id: 't-ranger', kind: 'trainer', trainerName: '巡林员', speciesId: 'chikorita', level: 11, reward: 450, x: 75, y: 45 },
      ],
    },
    thunder_ridge: {
      id: 'thunder_ridge',
      name: '雷鸣山脊',
      image: 'assets/maps/thunder_ridge.png',
      bossChance: 0.12,
      encounters: [
        { id: 'w-shinx', kind: 'wild', speciesId: 'shinx', level: 11, x: 28, y: 52 },
        { id: 'w-magnemite', kind: 'wild', speciesId: 'magnemite', level: 12, x: 50, y: 48 },
        { id: 't-engineer', kind: 'trainer', trainerName: '电工', speciesId: 'abra', level: 13, reward: 550, x: 72, y: 42 },
      ],
    },
    ancient_ruins: {
      id: 'ancient_ruins',
      name: '古代遗迹',
      image: 'assets/maps/ancient_ruins.png',
      bossChance: 0.14,
      encounters: [
        { id: 'w-gastly', kind: 'wild', speciesId: 'gastly', level: 13, x: 32, y: 50 },
        { id: 'w-aron', kind: 'wild', speciesId: 'aron', level: 14, x: 58, y: 58 },
        { id: 't-ruins', kind: 'trainer', trainerName: '遗迹猎人', speciesId: 'machop', level: 15, reward: 650, x: 78, y: 40 },
      ],
    },
    frost_lake: {
      id: 'frost_lake',
      name: '霜冻湖泊',
      image: 'assets/maps/frost_lake.png',
      bossChance: 0.15,
      encounters: [
        { id: 'w-spheal', kind: 'wild', speciesId: 'spheal', level: 15, x: 35, y: 58 },
        { id: 'w-horsea', kind: 'wild', speciesId: 'horsea', level: 16, x: 55, y: 62 },
        { id: 't-skier', kind: 'trainer', trainerName: '滑雪者', speciesId: 'psyduck', level: 17, reward: 750, x: 74, y: 44 },
      ],
    },
    sky_terrace: {
      id: 'sky_terrace',
      name: '云端花园',
      image: 'assets/maps/sky_terrace.png',
      bossChance: 0.16,
      encounters: [
        { id: 'w-ralts', kind: 'wild', speciesId: 'ralts', level: 17, x: 30, y: 50 },
        { id: 'w-bagon', kind: 'wild', speciesId: 'bagon', level: 18, x: 52, y: 46 },
        { id: 't-pilot', kind: 'trainer', trainerName: '飞行员', speciesId: 'vulpix', level: 20, reward: 900, x: 76, y: 40 },
      ],
    },
    champion_path: {
      id: 'champion_path',
      name: '冠军之路',
      image: 'assets/maps/champion_path.png',
      bossChance: 0.2,
      encounters: [
        { id: 'w-dratini', kind: 'wild', speciesId: 'dratini', level: 20, x: 28, y: 52 },
        { id: 'w-magikarp', kind: 'wild', speciesId: 'magikarp', level: 21, x: 48, y: 60 },
        { id: 'w-charmander', kind: 'wild', speciesId: 'charmander', level: 22, x: 62, y: 48 },
        { id: 't-champ', kind: 'trainer', trainerName: '挑战者', speciesId: 'onix', level: 24, reward: 1200, x: 80, y: 38 },
      ],
    },
  };
}

// --- generate ---
const species = buildSpecies();
const maps = buildMaps();

for (const sp of Object.values(species)) {
  const stage = sp.mega ? 3 : sp.evolveLevel === 24 ? 2 : sp.evolveLevel === 16 ? 1 : sp.evolvesTo ? 0 : 2;
  let st = 0;
  if (sp.mega) st = 3;
  else if (sp.evolveLevel === 24) st = 2;
  else if (sp.evolveLevel === 16) st = 1;
  else if (sp.evolvesTo) st = 0;
  else st = 2;
  makePokemonSprite(sp.type, st, !!sp.mega).save(path.join(root, sp.sprite));
}

const mapKinds = {
  misty_woods: 'forest',
  thunder_ridge: 'thunder',
  ancient_ruins: 'ruins',
  frost_lake: 'frost',
  sky_terrace: 'sky',
  champion_path: 'champion',
};
for (const [id, kind] of Object.entries(mapKinds)) {
  makeMap(kind).save(path.join(root, `assets/maps/${id}.png`));
}

const outPath = path.join(root, 'js/generated-content.js');
const payload = `/** Auto-generated by scripts/generate-content.mjs — do not edit by hand. */\n\nexport const GENERATED_SPECIES = ${JSON.stringify(species, null, 2)};\n\nexport const GENERATED_MAPS = ${JSON.stringify(maps, null, 2)};\n`;
fs.writeFileSync(outPath, payload);
console.log('species', Object.keys(species).length);
console.log('maps', Object.keys(maps).length);
console.log('wrote', outPath);
