/**
 * 10 later maps, 5 new species each, plus an ultra ball sprite.
 * Run: node scripts/generate-region.mjs
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
    set(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    },
    fillRect(x, y, rw, rh, r, g, b, a = 255) {
      for (let yy = y; yy < y + rh; yy++) {
        for (let xx = x; xx < x + rw; xx++) this.set(xx, yy, r, g, b, a);
      }
    },
    fillCircle(cx, cy, rad, r, g, b, a = 255) {
      for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++) {
        for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++) {
          if ((xx - cx) ** 2 + (yy - cy) ** 2 <= rad * rad) this.set(xx, yy, r, g, b, a);
        }
      }
    },
    save(file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, pngFromRgba(w, h, rgba));
    },
  };
}

function upscale(src, scale) {
  const dst = canvas(src.w * scale, src.h * scale);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      dst.fillRect(x * scale, y * scale, scale, scale, src.rgba[i], src.rgba[i + 1], src.rgba[i + 2], src.rgba[i + 3]);
    }
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
  ghost: [100, 70, 160],
  dragon: [80, 100, 220],
  ice: [140, 220, 255],
  ground: [210, 170, 90],
  fighting: [200, 70, 50],
  steel: [160, 170, 190],
  dark: [70, 70, 90],
  fairy: [255, 160, 200],
  psychic: [255, 100, 160],
};

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function makePokemonSprite(id, type) {
  const c = canvas(32, 32);
  const [r, g, b] = TYPE_RGB[type] || [180, 180, 180];
  const n = hash(id);
  const body = 7 + (n % 4);
  const tall = (n >> 3) % 3;
  c.fillCircle(16, 18 - tall, body, r, g, b);
  c.fillCircle(16, 10 - tall, Math.max(5, body - 2), r, g, b);
  c.fillRect(12, 9 - tall, 2, 2, 20, 20, 20);
  c.fillRect(18, 9 - tall, 2, 2, 20, 20, 20);
  const ear = 4 + (n % 5);
  c.fillRect(8, 2, 3, ear, Math.min(255, r + 30), Math.min(255, g + 30), Math.min(255, b + 30));
  c.fillRect(21, 2, 3, ear, Math.min(255, r + 30), Math.min(255, g + 30), Math.min(255, b + 30));
  if ((n >> 6) % 2) c.fillRect(24, 16, 6, 3, r, g, b);
  c.fillRect(11, 24, 3, 5, r, g, b);
  c.fillRect(18, 24, 3, 5, r, g, b);
  return upscale(c, 4);
}

function stage() {
  const w = 160;
  const h = 90;
  const c = canvas(w, h);
  const s = {
    w,
    h,
    c,
    px(x, y, col) {
      c.set(x | 0, y | 0, col[0], col[1], col[2]);
    },
    rect(x, y, rw, rh, col) {
      c.fillRect(x | 0, y | 0, rw | 0, rh | 0, col[0], col[1], col[2]);
    },
    dither(x, y, rw, rh, a, b) {
      for (let yy = y; yy < y + rh; yy++) {
        for (let xx = x; xx < x + rw; xx++) this.px(xx, yy, ((xx + yy) & 1) ? b : a);
      }
    },
    disc(cx, cy, r, col) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) this.px(cx + x, cy + y, col);
        }
      }
    },
    hill(cx, base, hw, hh, col) {
      for (let i = 0; i < hh; i++) {
        const half = Math.max(1, Math.round(hw * (1 - i / hh)));
        this.rect(cx - half, base - 1 - i, half * 2, 1, col);
      }
    },
  };
  return s;
}

function paintLava(s) {
  const sky = [42, 16, 18];
  const sky2 = [92, 32, 20];
  const rock = [58, 32, 28];
  const rockD = [32, 18, 18];
  const lava = [220, 72, 18];
  const lavaH = [255, 176, 48];
  const crust = [110, 36, 16];
  s.rect(0, 0, 160, 90, sky);
  s.dither(0, 18, 160, 20, sky, sky2);
  s.hill(26, 62, 40, 34, rockD);
  s.hill(136, 60, 42, 36, rockD);
  s.rect(0, 56, 42, 34, rock);
  s.rect(118, 54, 42, 36, rock);
  for (let i = 0; i < 5; i++) s.rect(6 + i * 7, 64, 2, 10, [96, 32, 18]);
  for (let i = 0; i < 4; i++) s.rect(126 + i * 8, 62, 2, 12, [96, 32, 18]);
  s.rect(36, 48, 88, 42, lava);
  s.rect(44, 52, 18, 16, lavaH);
  s.rect(52, 66, 56, 6, lavaH);
  s.rect(60, 78, 36, 4, lavaH);
  for (const [x, y, w] of [[48, 60, 10], [78, 72, 14], [96, 58, 8], [66, 84, 12]]) s.rect(x, y, w, 2, crust);
  s.px(22, 14, lavaH);
  s.px(148, 20, [255, 120, 40]);
  s.px(70, 10, lavaH);
}

function paintSea(s) {
  const deep = [8, 28, 62];
  const mid = [14, 58, 102];
  const light = [64, 150, 186];
  const sand = [72, 86, 64];
  const kelp = [18, 72, 58];
  s.rect(0, 0, 160, 90, deep);
  s.rect(0, 0, 160, 10, light);
  s.dither(0, 10, 160, 8, light, mid);
  s.rect(0, 18, 160, 28, mid);
  for (const x of [18, 46, 78, 112, 140]) s.rect(x, 0, 2, 36, [186, 230, 236]);
  s.dither(0, 18, 160, 36, mid, deep);
  for (const x of [6, 22, 132, 148]) {
    s.rect(x, 28, 3, 48, kelp);
    s.rect(x - 4, 40, 6, 2, kelp);
    s.rect(x + 2, 52, 6, 2, kelp);
  }
  s.rect(54, 40, 28, 6, [28, 64, 92]);
  s.rect(70, 36, 18, 4, [28, 64, 92]);
  s.rect(86, 42, 8, 3, [210, 230, 236]);
  s.rect(0, 78, 160, 12, sand);
  s.rect(0, 78, 160, 2, [48, 60, 48]);
  for (const [x, y] of [[30, 24], [40, 36], [96, 20], [110, 44], [60, 58]]) s.disc(x, y, 1, [210, 236, 242]);
}

function paintGrave(s) {
  const sky = [18, 14, 36];
  const sky2 = [36, 24, 58];
  const ground = [22, 26, 22];
  const stone = [150, 148, 158];
  const stoneD = [78, 76, 92];
  s.rect(0, 0, 160, 58, sky);
  s.dither(0, 36, 160, 22, sky, sky2);
  s.disc(124, 16, 7, [236, 230, 196]);
  s.disc(127, 15, 6, sky);
  for (const [x, y] of [[16, 10], [40, 18], [70, 8], [96, 22], [148, 12]]) s.px(x, y, [236, 230, 196]);
  s.rect(16, 34, 4, 24, [52, 36, 28]);
  s.rect(8, 30, 10, 3, [52, 36, 28]);
  s.rect(20, 26, 3, 10, [52, 36, 28]);
  s.rect(6, 24, 3, 8, [52, 36, 28]);
  s.rect(22, 20, 3, 8, [52, 36, 28]);
  s.rect(0, 58, 160, 32, ground);
  s.rect(0, 58, 160, 3, [34, 42, 30]);
  const graves = [36, 58, 78, 102, 128];
  graves.forEach((x, i) => {
    const gh = 12 + (i % 3) * 4;
    s.rect(x, 58 - gh, 10, gh, stoneD);
    s.rect(x + 1, 58 - gh + 1, 8, gh - 2, stone);
    s.disc(x + 5, 58 - gh, 4, stone);
    s.rect(x + 4, 58 - gh + 4, 2, 5, stoneD);
  });
  s.rect(0, 78, 160, 12, [16, 20, 16]);
}

function paintGrove(s) {
  const canopy = [22, 72, 36];
  const canopyD = [12, 42, 22];
  const leaf = [48, 120, 48];
  const trunk = [72, 48, 28];
  const moss = [36, 86, 40];
  s.rect(0, 0, 160, 90, canopyD);
  s.rect(0, 0, 160, 22, canopy);
  s.dither(0, 16, 160, 14, canopy, leaf);
  for (const x of [10, 30, 50, 108, 128, 146]) {
    s.disc(x + 3, 18, 11, canopy);
    s.disc(x + 3, 16, 7, leaf);
    s.rect(x, 22, 5, 52, trunk);
  }
  for (let i = 0; i < 48; i++) {
    const half = 6 + Math.floor(i / 4);
    s.rect(80 - half, 18 + i, half * 2, 1, i % 3 === 0 ? [210, 228, 160] : [176, 210, 128]);
  }
  s.rect(0, 72, 160, 18, moss);
  s.rect(0, 72, 160, 2, canopyD);
  for (const x of [16, 70, 96, 138]) {
    s.rect(x, 66, 2, 6, [230, 220, 200]);
    s.disc(x + 1, 64, 3, [196, 48, 42]);
  }
  s.rect(74, 78, 16, 4, [92, 70, 40]);
}

function paintStorm(s) {
  const sky = [28, 32, 52];
  const cloud = [18, 20, 36];
  const cloudL = [70, 74, 96];
  const grass = [42, 78, 40];
  const grassD = [24, 48, 26];
  const bolt = [255, 236, 120];
  s.rect(0, 0, 160, 90, sky);
  s.hill(24, 22, 28, 14, cloud);
  s.hill(70, 18, 36, 16, cloud);
  s.hill(120, 24, 40, 18, cloudL);
  s.dither(0, 8, 160, 12, cloud, cloudL);
  const zig = [0, 0, 4, 4, 4, -4, -4, 6, 6, 6, -5, -5, 3, 3, -6, -6, 2, 2, 0];
  let x = 108;
  let y = 22;
  for (const step of zig) {
    x += step;
    s.rect(x, y, 3, 3, bolt);
    y += 3;
  }
  s.rect(x - 6, y, 14, 2, bolt);
  s.rect(0, 68, 160, 22, grassD);
  s.rect(0, 68, 160, 4, grass);
  for (let i = 0; i < 20; i++) {
    const gx = 4 + i * 8;
    s.rect(gx, 66 - (i % 3), 1, 6, grass);
    s.rect(gx + 1, 64, 3, 1, grass);
  }
  s.hill(30, 70, 28, 10, [36, 48, 40]);
}

function paintShrine(s) {
  const sky = [186, 214, 228];
  const sky2 = [214, 230, 238];
  const snow = [236, 242, 246];
  const ice = [120, 176, 206];
  const iceD = [62, 108, 142];
  const stone = [176, 196, 210];
  s.rect(0, 0, 160, 90, sky);
  s.dither(0, 0, 160, 24, sky2, sky);
  s.hill(24, 64, 34, 26, snow);
  s.hill(42, 66, 24, 18, ice);
  s.hill(136, 64, 36, 28, snow);
  s.rect(0, 62, 160, 28, snow);
  s.rect(0, 70, 160, 8, ice);
  s.dither(0, 70, 160, 8, ice, [170, 210, 224]);
  s.rect(58, 36, 44, 28, stone);
  s.rect(50, 30, 60, 8, iceD);
  s.hill(80, 32, 28, 16, iceD);
  s.rect(64, 44, 8, 20, ice);
  s.rect(88, 44, 8, 20, ice);
  s.rect(74, 48, 12, 16, [40, 64, 88]);
  s.rect(66, 40, 4, 4, [255, 220, 90]);
  s.rect(90, 40, 4, 4, [255, 220, 90]);
  for (const [x, y] of [[12, 14], [30, 22], [110, 12], [146, 20], [70, 16]]) s.px(x, y, snow);
}

function paintWaste(s) {
  const sky = [176, 112, 64];
  const sky2 = [214, 156, 86];
  const mesa = [120, 64, 40];
  const bone = [214, 196, 160];
  const boneD = [120, 96, 72];
  const sand = [168, 112, 62];
  s.rect(0, 0, 160, 48, sky2);
  s.dither(0, 0, 160, 22, sky2, sky);
  s.rect(0, 48, 160, 42, sand);
  s.hill(16, 52, 20, 14, mesa);
  s.hill(146, 52, 24, 18, mesa);
  const ribs = [14, 22, 28, 30, 26, 16];
  let prev = null;
  ribs.forEach((hh, i) => {
    const x = 46 + i * 12;
    const top = 60 - hh;
    s.rect(x, top, 3, hh, boneD);
    s.rect(x + 1, top + 1, 2, hh - 2, bone);
    if (prev) {
      const [px, py] = prev;
      const span = x - px;
      for (let t = 0; t <= span; t++) {
        const yy = py + Math.round(((top - py) * t) / span);
        s.rect(px + t, yy, 2, 3, bone);
      }
    }
    prev = [x, top];
  });
  s.disc(118, 70, 7, bone);
  s.rect(114, 68, 4, 3, [48, 32, 28]);
  s.rect(122, 68, 4, 3, [48, 32, 28]);
  for (let i = 0; i < 8; i++) s.rect(8 + i * 18, 80, 10, 1, [120, 72, 40]);
}

function paintGarden(s) {
  const sky = [232, 176, 206];
  const sky2 = [186, 160, 214];
  const hedge = [48, 110, 62];
  const hedgeD = [28, 72, 40];
  const path = [214, 176, 140];
  const petal = [236, 84, 120];
  s.rect(0, 0, 160, 36, sky2);
  s.dither(0, 0, 160, 36, sky2, sky);
  s.disc(126, 14, 6, [255, 214, 120]);
  s.rect(0, 36, 160, 54, [72, 140, 72]);
  s.rect(70, 36, 20, 54, path);
  s.rect(68, 36, 2, 54, [160, 120, 80]);
  s.rect(90, 36, 2, 54, [160, 120, 80]);
  for (const y of [42, 58, 74]) {
    s.rect(8, y, 52, 10, hedgeD);
    s.rect(10, y + 1, 48, 7, hedge);
    s.rect(100, y, 52, 10, hedgeD);
    s.rect(102, y + 1, 48, 7, hedge);
    for (let i = 0; i < 5; i++) s.disc(16 + i * 9, y + 4, 2, i % 2 ? petal : [255, 196, 72]);
    for (let i = 0; i < 5; i++) s.disc(108 + i * 9, y + 4, 2, i % 2 ? [120, 160, 255] : [255, 240, 250]);
  }
  s.rect(74, 48, 12, 10, [90, 150, 190]);
  s.rect(76, 44, 8, 4, [210, 230, 236]);
  s.px(40, 28, petal);
  s.px(100, 24, [255, 240, 250]);
  s.rect(38, 30, 3, 1, [60, 40, 50]);
}

function paintDojo(s) {
  const wood = [92, 48, 28];
  const woodD = [48, 24, 16];
  const paper = [232, 214, 176];
  const tatami = [196, 168, 96];
  const tatamiD = [120, 96, 52];
  const red = [150, 32, 32];
  s.rect(0, 0, 160, 90, woodD);
  s.rect(0, 0, 160, 14, wood);
  for (let i = 0; i < 6; i++) s.rect(8 + i * 26, 0, 4, 14, woodD);
  s.rect(6, 18, 148, 28, paper);
  s.rect(6, 18, 148, 2, wood);
  s.rect(78, 18, 2, 28, wood);
  s.rect(8, 46, 8, 44, red);
  s.rect(144, 46, 8, 44, red);
  s.rect(16, 50, 128, 40, tatami);
  for (let y = 54; y < 86; y += 8) s.rect(16, y, 128, 1, tatamiD);
  s.rect(76, 50, 8, 40, tatamiD);
  s.disc(80, 68, 10, [160, 42, 36]);
  s.disc(80, 68, 6, tatami);
  s.rect(28, 22, 10, 16, red);
  s.rect(122, 22, 10, 16, red);
  s.rect(30, 20, 6, 4, [240, 200, 80]);
  s.rect(124, 20, 6, 4, [240, 200, 80]);
}

function paintAbyss(s) {
  const voidC = [10, 6, 22];
  const neb = [72, 28, 110];
  const neb2 = [140, 48, 120];
  const stone = [48, 40, 64];
  const stoneL = [92, 80, 112];
  const glow = [186, 96, 255];
  s.rect(0, 0, 160, 90, voidC);
  s.disc(42, 20, 18, neb);
  s.disc(68, 28, 12, neb2);
  s.disc(118, 24, 20, neb2);
  s.disc(96, 16, 8, neb);
  for (let i = 0; i < 28; i++) {
    const x = (i * 47) % 160;
    const y = (i * 29) % 80;
    s.px(x, y, i % 4 === 0 ? [255, 240, 210] : [180, 180, 210]);
  }
  s.hill(36, 78, 22, 14, stone);
  s.rect(24, 70, 24, 8, stoneL);
  s.hill(128, 64, 18, 12, stone);
  s.rect(118, 58, 20, 6, stoneL);
  s.rect(70, 48, 20, 28, stone);
  s.rect(66, 40, 28, 10, stoneL);
  s.rect(76, 44, 8, 18, glow);
  s.dither(76, 44, 8, 18, glow, [255, 210, 255]);
  s.rect(74, 36, 12, 4, glow);
  s.rect(62, 78, 36, 6, stone);
  s.rect(66, 76, 28, 3, stoneL);
}

const SCENES = {
  lava: paintLava,
  sea: paintSea,
  grave: paintGrave,
  grove: paintGrove,
  storm: paintStorm,
  shrine: paintShrine,
  waste: paintWaste,
  garden: paintGarden,
  dojo: paintDojo,
  abyss: paintAbyss,
};

function makeMap(kind) {
  const s = stage();
  (SCENES[kind] || paintLava)(s);
  return upscale(s.c, 4);
}

function makeUltraBall() {
  const c = canvas(32, 32);
  c.fillCircle(16, 16, 13, 40, 40, 40);
  c.fillCircle(16, 16, 12, 240, 240, 240);
  for (let y = 4; y <= 15; y++) {
    for (let x = 4; x <= 27; x++) {
      if ((x - 16) ** 2 + (y - 16) ** 2 <= 144) c.set(x, y, 210, 30, 40);
    }
  }
  c.fillRect(4, 15, 24, 3, 30, 30, 30);
  c.fillCircle(16, 16, 4, 250, 210, 60);
  c.fillCircle(16, 16, 2, 255, 255, 255);
  return upscale(c, 2);
}

const STATS = {
  fire: [62, 72, 50, 66],
  water: [66, 60, 64, 54],
  grass: [66, 58, 64, 50],
  electric: [52, 70, 46, 78],
  ghost: [50, 72, 48, 74],
  dark: [56, 74, 50, 70],
  bug: [58, 72, 54, 72],
  ice: [68, 62, 58, 50],
  dragon: [70, 80, 60, 64],
  rock: [74, 76, 84, 38],
  ground: [72, 78, 72, 42],
  fairy: [70, 58, 64, 54],
  psychic: [60, 66, 56, 62],
  fighting: [68, 82, 56, 64],
  steel: [72, 76, 92, 44],
};

const REGIONS = [
  ['lava_canyon', '熔岩峡谷', 'lava', ['熔岩旅人', '炎之学者'], [
    ['cyndaquil', '火球鼠', 'fire', '火花'],
    ['growlithe', '卡蒂狗', 'fire', '咬住'],
    ['slugma', '熔岩虫', 'fire', '火花'],
    ['numel', '呆火驼', 'fire', '撞击'],
    ['torchic', '火稚鸡', 'fire', '火花'],
  ]],
  ['deep_trench', '深海海沟', 'sea', ['潜水员', '航海士'], [
    ['totodile', '小锯鳄', 'water', '水枪'],
    ['poliwag', '蚊香蝌蚪', 'water', '泡沫'],
    ['staryu', '海星星', 'water', '水枪'],
    ['chinchou', '灯笼鱼', 'water', '电击'],
    ['piplup', '波加曼', 'water', '水枪'],
  ]],
  ['gloom_yard', '幽暗墓园', 'grave', ['守墓人', '灵媒'], [
    ['misdreavus', '梦妖', 'ghost', '影子球'],
    ['sableye', '勾魂眼', 'dark', '抓'],
    ['shuppet', '怨影娃娃', 'ghost', '黑夜魔影'],
    ['duskull', '夜巡灵', 'ghost', '影子球'],
    ['murkrow', '黑暗鸦', 'dark', '啄'],
  ]],
  ['moss_wilds', '苔原密林', 'grove', ['园丁', '昆虫学家'], [
    ['treecko', '木守宫', 'grass', '藤鞭'],
    ['bellsprout', '喇叭芽', 'grass', '藤鞭'],
    ['paras', '派拉斯', 'bug', '吸取'],
    ['scyther', '飞天螳螂', 'bug', '连斩'],
    ['snivy', '藤藤蛇', 'grass', '藤鞭'],
  ]],
  ['volt_plain', '雷鸣平原', 'storm', ['电工长', '暴风骑士'], [
    ['electrike', '落雷兽', 'electric', '电击'],
    ['mareep', '咩利羊', 'electric', '电击'],
    ['voltorb', '霹雳电球', 'electric', '电击'],
    ['electabuzz', '电击兽', 'electric', '雷电拳'],
    ['plusle', '正电拍拍', 'electric', '电光'],
  ]],
  ['frost_shrine', '冰封神殿', 'shrine', ['祭司', '雪原猎人'], [
    ['swinub', '小山猪', 'ice', '细雪'],
    ['snover', '雪笠怪', 'ice', '冰砾'],
    ['sneasel', '狃拉', 'dark', '抓'],
    ['cubchoo', '喷嚏熊', 'ice', '细雪'],
    ['vanillite', '迷你冰', 'ice', '冰冻之风'],
  ]],
  ['bone_waste', '龙骨荒原', 'waste', ['化石猎人', '龙之使者'], [
    ['larvitar', '幼基拉斯', 'rock', '落石'],
    ['gible', '圆陆鲨', 'dragon', '龙息'],
    ['axew', '牙牙', 'dragon', '龙爪'],
    ['trapinch', '大颚蚁', 'ground', '咬住'],
    ['rhyhorn', '独角犀牛', 'rock', '角撞'],
  ]],
  ['fairy_court', '妖精庭园', 'garden', ['庭园侍女', '诗人'], [
    ['clefairy', '皮皮', 'fairy', '拍击'],
    ['jigglypuff', '胖丁', 'fairy', '唱歌'],
    ['togepi', '波克比', 'fairy', '魅惑之声'],
    ['snubbull', '布鲁', 'fairy', '咬住'],
    ['marill', '玛力露', 'water', '水枪'],
  ]],
  ['fight_dojo', '格斗道场', 'dojo', ['馆主弟子', '空手道家'], [
    ['hitmonlee', '飞腿郎', 'fighting', '飞踢'],
    ['hitmonchan', '快拳郎', 'fighting', '冲天拳'],
    ['tyrogue', '无畏小子', 'fighting', '撞击'],
    ['makuhita', '幕下力士', 'fighting', '臂锤'],
    ['riolu', '利欧路', 'fighting', '真空波'],
  ]],
  ['final_realm', '终焉领域', 'abyss', ['领域守卫', '终焉冠军'], [
    ['lucario', '路卡利欧', 'fighting', '波导弹'],
    ['garchomp', '烈咬陆鲨', 'dragon', '龙爪'],
    ['metagross', '巨金怪', 'steel', '彗星拳'],
    ['tyranitar', '班基拉斯', 'rock', '岩崩'],
    ['togekiss', '波克基斯', 'fairy', '空气斩'],
  ]],
];

const species = {};
const maps = {};

REGIONS.forEach((region, tier) => {
  const [id, name, kind, trainerNames, mons] = region;
  const start = 26 + tier * 5;
  const built = mons.map(([sid, sname, type, move], n) => {
    const row = STATS[type];
    const scale = 1 + tier * 0.12;
    const sp = {
      id: sid,
      name: sname,
      type,
      base: {
        hp: Math.floor(row[0] * scale),
        atk: Math.floor(row[1] * scale),
        def: Math.floor(row[2] * scale),
        spd: Math.floor(row[3] * scale),
      },
      move: { name: move, power: 45 + tier * 4, type },
      catchRate: Math.max(0.08, 0.42 - tier * 0.03),
      sprite: `assets/pokemon/${sid}.png`,
      eyeOffset: { x: 0, y: -8 },
    };
    species[sid] = sp;
    return { sid, level: start + n };
  });

  const teamOf = (count, levelBump) => built.slice(0, count).map((mon, i) => ({
    speciesId: mon.sid,
    level: mon.level + levelBump + i,
  }));

  maps[id] = {
    id,
    name,
    image: `assets/maps/${id}.png`,
    bossChance: Math.min(0.35, 0.12 + tier * 0.02),
    encounters: [
      ...built.map((mon, n) => ({
        id: `${id}-w${n}`,
        kind: 'wild',
        speciesId: mon.sid,
        level: mon.level,
        x: [22, 40, 58, 74, 88][n],
        y: [62, 48, 68, 44, 58][n],
      })),
      {
        id: `${id}-t0`,
        kind: 'trainer',
        trainerName: trainerNames[0],
        reward: 1600 + tier * 350,
        x: 30,
        y: 30,
        team: teamOf(4, 1),
      },
      {
        id: `${id}-t1`,
        kind: 'trainer',
        trainerName: trainerNames[1],
        reward: 1900 + tier * 350,
        x: 66,
        y: 26,
        team: teamOf(3, 2),
      },
    ],
  };
  makeMap(kind).save(path.join(root, `assets/maps/${id}.png`));
});

makeUltraBall().save(path.join(root, 'assets/balls/ultra.png'));

const out = `/** Auto-generated by scripts/generate-region.mjs — do not edit by hand. */\n\nexport const REGION_SPECIES = ${JSON.stringify(species, null, 2)};\n\nexport const REGION_MAPS = ${JSON.stringify(maps, null, 2)};\n`;
fs.writeFileSync(path.join(root, 'js/region-content.js'), out);
console.log('species', Object.keys(species).length, 'maps', Object.keys(maps).length);
