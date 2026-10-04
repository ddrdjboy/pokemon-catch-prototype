/**
 * Original pixel-style sprites for the 10 new maps (50 species).
 * Same pipeline as render-sprites-v2: 128 canvas → hard 64 + outline → 192.
 * Run: node scripts/render-region-sprites.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { create } from './render-sprites-v2.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets/pokemon');

function shadow(g) {
  for (let x = 30; x < 98; x++) {
    for (let y = 108; y < 118; y++) {
      const dx = (x - 64) / 34;
      const dy = (y - 112) / 5;
      if (dx * dx + dy * dy < 1) g.blend(x, y, 20, 20, 30, 50 * (1 - dx * dx));
    }
  }
}

function disc(g, cx, cy, rx, ry, color, pred) {
  const [r, gc, b] = color;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      if (pred && !pred(x, y)) continue;
      g.blend(x, y, r, gc, b, 255);
    }
  }
}

function star(g, cx, cy, R, color) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : R * 0.4;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  const [r, gc, b] = color;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) {
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      let c = false;
      for (let i = 0, j = 9; i < 10; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0001) + xi) c = !c;
      }
      if (c) g.blend(x, y, r, gc, b, 255);
    }
  }
}

const painters = {
  cyndaquil(g) {
    const cream = [246, 224, 170];
    const back = [42, 52, 78];
    const flame = [230, 48, 36];
    const hot = [255, 210, 70];
    g.oval(88, 80, 8, 6, cream);
    g.oval(72, 76, 30, 14, cream);
    g.oval(74, 66, 24, 8, back);
    g.oval(40, 66, 14, 11, cream);
    g.oval(26, 68, 8, 5, cream);
    g.oval(36, 54, 3, 6, back);
    g.oval(48, 52, 3, 6, back);
    for (const [x, y] of [[58, 56], [70, 50], [82, 56], [76, 42]]) {
      g.oval(x, y + 6, 4.5, 8, flame);
      g.oval(x, y, 2.6, 5, hot);
    }
    g.oval(52, 94, 6, 5, cream);
    g.oval(68, 96, 6, 5, cream);
    g.oval(84, 94, 6, 5, cream);
    g.oval(96, 92, 5, 4, cream);
    g.eye(32, 64, 2.2);
    g.eye(42, 62, 2.2);
    g.oval(20, 70, 2, 1.4, [48, 36, 32]);
  },

  growlithe(g) {
    const fur = [242, 140, 48];
    const mane = [250, 232, 196];
    const dark = [48, 36, 32];
    g.oval(70, 82, 22, 14, fur);
    g.oval(64, 70, 8, 4, dark);
    g.oval(72, 78, 10, 3, dark);
    g.oval(48, 58, 16, 14, fur);
    g.oval(48, 50, 18, 10, mane);
    g.oval(36, 46, 8, 8, mane);
    g.oval(58, 44, 8, 8, mane);
    g.oval(40, 38, 5, 8, fur);
    g.oval(56, 36, 5, 8, fur);
    g.oval(34, 58, 6, 4, mane);
    g.oval(92, 78, 8, 6, fur);
    g.oval(100, 68, 6, 6, mane);
    g.oval(46, 96, 6, 5, fur);
    g.oval(62, 98, 6, 5, fur);
    g.oval(76, 96, 6, 5, fur);
    g.oval(88, 98, 5, 4, dark);
    g.eye(42, 56, 2.6);
    g.eye(54, 56, 2.6);
    g.oval(32, 60, 2.2, 1.6, dark);
  },

  slugma(g) {
    const lava = [214, 78, 36];
    const glow = [255, 196, 48];
    const crust = [120, 48, 36];
    g.oval(64, 78, 30, 22, lava);
    g.oval(64, 86, 24, 12, crust);
    g.oval(50, 90, 6, 8, lava);
    g.oval(78, 92, 5, 7, lava);
    g.oval(64, 62, 22, 16, lava);
    g.oval(58, 58, 8, 5, glow);
    g.oval(74, 66, 6, 4, glow);
    g.oval(48, 70, 5, 3, glow);
    g.oval(52, 60, 5, 6, [255, 236, 80]);
    g.oval(76, 60, 5, 6, [255, 236, 80]);
    g.oval(52, 60, 2.2, 2.6, [40, 24, 20]);
    g.oval(76, 60, 2.2, 2.6, [40, 24, 20]);
  },

  numel(g) {
    const sand = [236, 214, 160];
    const hump = [86, 150, 64];
    const crater = [196, 48, 36];
    g.oval(70, 80, 28, 16, sand);
    g.oval(78, 58, 16, 18, hump);
    g.oval(78, 44, 8, 5, crater);
    g.oval(78, 42, 4, 3, [255, 180, 48]);
    g.oval(52, 62, 12, 14, hump);
    g.oval(36, 58, 8, 6, sand);
    g.oval(28, 54, 7, 6, sand);
    g.oval(24, 50, 3, 4, sand);
    g.oval(48, 98, 6, 5, sand);
    g.oval(66, 100, 6, 5, sand);
    g.oval(84, 98, 6, 5, sand);
    g.oval(98, 96, 5, 4, sand);
    g.eye(26, 52, 2.2);
    g.oval(20, 56, 2, 1.3, [90, 50, 40]);
  },

  torchic(g) {
    const body = [242, 120, 42];
    const cream = [255, 236, 200];
    const beak = [255, 196, 48];
    g.oval(64, 72, 20, 22, body);
    g.oval(64, 80, 12, 12, cream);
    g.oval(64, 46, 16, 14, body);
    g.oval(64, 28, 3, 8, body);
    g.oval(54, 32, 3, 7, body);
    g.oval(74, 32, 3, 7, body);
    g.oval(78, 50, 5, 3, beak);
    g.oval(46, 70, 6, 8, body);
    g.oval(82, 70, 6, 8, body);
    g.oval(54, 100, 6, 6, [255, 160, 40]);
    g.oval(54, 94, 3, 5, [255, 230, 80]);
    g.oval(74, 100, 6, 6, [255, 160, 40]);
    g.oval(74, 94, 3, 5, [255, 230, 80]);
    g.eye(58, 46, 2.8);
    g.eye(70, 46, 2.8);
  },

  totodile(g) {
    const blue = [56, 130, 210];
    const cream = [255, 236, 210];
    const red = [214, 48, 52];
    g.oval(86, 82, 12, 8, blue);
    g.oval(62, 74, 20, 22, blue);
    g.oval(64, 80, 10, 12, cream);
    g.oval(50, 48, 16, 13, blue);
    g.oval(66, 54, 12, 7, blue);
    g.oval(66, 60, 10, 4, cream);
    g.oval(70, 58, 2, 3, [255, 255, 255]);
    g.oval(62, 58, 2, 3, [255, 255, 255]);
    g.oval(48, 36, 4, 6, red);
    g.oval(58, 32, 4, 7, red);
    g.oval(70, 38, 4, 5, red);
    g.oval(44, 72, 6, 8, blue);
    g.oval(78, 74, 6, 8, blue);
    g.oval(54, 100, 7, 5, blue);
    g.oval(72, 100, 7, 5, blue);
    g.eye(46, 46, 2.8);
    g.eye(58, 46, 2.8);
  },

  poliwag(g) {
    const blue = [88, 144, 232];
    const belly = [236, 242, 248];
    g.oval(64, 70, 28, 26, blue);
    g.oval(64, 76, 16, 16, belly);
    g.oval(86, 86, 6, 4, blue);
    for (let t = 0; t < 8; t++) {
      const a = -0.6 + t * 0.85;
      const rad = 3 + t * 1.5;
      g.oval(64 + Math.cos(a) * rad, 78 + Math.sin(a) * rad * 0.75, 2.8, 2.8, [28, 32, 44], { shade: 0 });
    }
    g.eye(54, 52, 3.2);
    g.eye(74, 52, 3.2);
    g.oval(64, 60, 3, 2, [40, 48, 70]);
  },

  staryu(g) {
    star(g, 64, 66, 36, [244, 196, 48]);
    star(g, 64, 66, 16, [232, 56, 48]);
    g.oval(64, 66, 6, 6, [255, 230, 120]);
    g.eye(64, 66, 2.2);
  },

  chinchou(g) {
    const blue = [72, 150, 186];
    const light = [255, 220, 64];
    g.oval(64, 74, 24, 18, blue);
    g.oval(64, 80, 12, 8, [210, 230, 236]);
    g.oval(40, 78, 8, 5, blue);
    g.oval(88, 70, 10, 6, blue);
    g.oval(46, 48, 3, 16, blue);
    g.oval(82, 48, 3, 16, blue);
    g.oval(46, 30, 8, 8, light);
    g.oval(82, 30, 8, 8, light);
    g.oval(46, 30, 3, 3, [255, 255, 220]);
    g.oval(82, 30, 3, 3, [255, 255, 220]);
    g.eye(56, 70, 2.6);
    g.eye(72, 70, 2.6);
  },

  piplup(g) {
    const blue = [48, 120, 200];
    const face = [248, 248, 252];
    const beak = [255, 196, 48];
    g.oval(64, 76, 20, 22, blue);
    g.oval(64, 50, 16, 15, blue);
    g.oval(64, 54, 11, 10, face);
    g.oval(64, 28, 3, 6, blue);
    g.oval(80, 58, 6, 3.5, beak);
    g.oval(46, 74, 6, 10, blue);
    g.oval(82, 74, 6, 10, blue);
    g.oval(54, 102, 7, 4, beak);
    g.oval(74, 102, 7, 4, beak);
    g.eye(58, 50, 2.6);
    g.eye(70, 50, 2.6);
  },

  misdreavus(g) {
    const body = [96, 196, 168];
    const gem = [214, 64, 96];
    g.oval(34, 58, 10, 24, body);
    g.oval(94, 58, 10, 24, body);
    g.oval(64, 72, 22, 28, body);
    g.oval(52, 98, 8, 6, body);
    g.oval(76, 100, 8, 6, body);
    g.oval(64, 42, 16, 14, body);
    g.oval(78, 38, 10, 14, body);
    g.oval(46, 56, 4.5, 4.5, gem);
    g.oval(64, 60, 4.5, 4.5, gem);
    g.oval(82, 56, 4.5, 4.5, gem);
    g.eye(54, 44, 3.2);
  },

  sableye(g) {
    const skin = [72, 56, 96];
    const gem = [48, 200, 190];
    g.oval(64, 74, 18, 20, skin);
    g.oval(64, 48, 16, 14, skin);
    g.oval(46, 36, 4, 6, skin);
    g.oval(82, 36, 4, 6, skin);
    g.oval(64, 32, 4, 4, gem);
    g.oval(52, 70, 4, 4, [220, 48, 56]);
    g.oval(76, 78, 4, 4, gem);
    g.oval(60, 86, 3, 3, [80, 200, 80]);
    g.oval(44, 78, 5, 7, skin);
    g.oval(84, 78, 5, 7, skin);
    g.oval(54, 100, 6, 4, skin);
    g.oval(74, 100, 6, 4, skin);
    g.oval(54, 48, 5, 4.5, [210, 32, 40]);
    g.oval(74, 48, 5, 4.5, [210, 32, 40]);
    g.oval(54, 48, 2, 2.2, [20, 12, 16]);
    g.oval(74, 48, 2, 2.2, [20, 12, 16]);
  },

  shuppet(g) {
    const cloth = [120, 72, 168];
    g.oval(64, 36, 6, 8, cloth);
    g.oval(64, 70, 26, 28, cloth);
    g.oval(40, 78, 8, 10, cloth);
    g.oval(88, 78, 8, 10, cloth);
    g.oval(64, 58, 7, 6, [255, 214, 64]);
    g.oval(64, 58, 3, 3.2, [32, 24, 40]);
    g.oval(52, 74, 4, 3, [32, 24, 48]);
    g.oval(64, 78, 4, 3, [32, 24, 48]);
    g.oval(76, 74, 4, 3, [32, 24, 48]);
  },

  duskull(g) {
    const bone = [214, 214, 220];
    const robe = [36, 36, 44];
    g.oval(64, 86, 22, 18, robe);
    g.oval(44, 90, 6, 8, robe);
    g.oval(84, 90, 6, 8, robe);
    g.oval(64, 52, 24, 22, bone);
    g.oval(48, 56, 6, 8, [32, 32, 40]);
    g.oval(80, 56, 6, 8, [32, 32, 40]);
    g.oval(64, 54, 6, 7, [200, 32, 40]);
    g.oval(64, 54, 2.4, 3, [40, 12, 16]);
    g.oval(58, 66, 3, 2, [32, 32, 40]);
    g.oval(70, 66, 3, 2, [32, 32, 40]);
  },

  murkrow(g) {
    const black = [36, 36, 44];
    const beak = [244, 196, 48];
    g.oval(78, 78, 16, 8, black);
    g.oval(64, 70, 16, 18, black);
    g.oval(52, 48, 12, 11, black);
    g.oval(40, 36, 3, 8, black);
    g.oval(50, 30, 3, 9, black);
    g.oval(60, 34, 3, 7, black);
    g.oval(40, 50, 8, 3, beak);
    g.oval(36, 64, 12, 5, black);
    g.oval(90, 64, 12, 5, black);
    g.oval(56, 96, 4, 3, beak);
    g.oval(70, 96, 4, 3, beak);
    g.oval(48, 46, 3.2, 3, [200, 40, 48]);
    g.oval(48, 46, 1.4, 1.6, [20, 12, 16]);
  },

  treecko(g) {
    const green = [88, 184, 72];
    const belly = [236, 220, 160];
    const red = [210, 56, 56];
    g.oval(86, 78, 8, 5, green);
    g.oval(96, 70, 5, 4, green);
    g.oval(62, 74, 14, 20, green);
    g.oval(64, 80, 7, 10, belly);
    g.oval(64, 78, 3, 8, red);
    g.oval(62, 46, 13, 12, green);
    g.oval(46, 72, 5, 8, green);
    g.oval(78, 72, 5, 8, green);
    g.oval(54, 100, 6, 4, green);
    g.oval(72, 100, 6, 4, green);
    g.oval(56, 46, 4, 4.5, [255, 220, 48]);
    g.oval(70, 46, 4, 4.5, [255, 220, 48]);
    g.oval(56, 46, 1.8, 2.2, [32, 32, 28]);
    g.oval(70, 46, 1.8, 2.2, [32, 32, 28]);
  },

  bellsprout(g) {
    const yel = [236, 206, 56];
    const leaf = [64, 160, 64];
    g.oval(64, 78, 5, 16, yel);
    g.oval(50, 100, 9, 4, leaf);
    g.oval(78, 100, 9, 4, leaf);
    g.oval(40, 72, 12, 5, leaf);
    g.oval(88, 72, 12, 5, leaf);
    g.oval(64, 44, 16, 16, yel);
    g.oval(64, 54, 6, 3, [214, 96, 120]);
    g.eye(56, 42, 2.2);
    g.eye(72, 42, 2.2);
  },

  paras(g) {
    const shell = [214, 120, 48];
    const cap = [196, 40, 44];
    g.oval(64, 78, 22, 14, shell);
    g.oval(46, 86, 8, 6, shell);
    g.oval(82, 86, 8, 6, shell);
    g.oval(40, 74, 7, 5, shell);
    g.oval(88, 74, 7, 5, shell);
    g.oval(50, 52, 10, 12, cap);
    g.oval(78, 48, 11, 13, cap);
    g.oval(46, 48, 2.2, 2.2, [255, 255, 255], { shade: 0 });
    g.oval(54, 54, 2, 2, [255, 255, 255], { shade: 0 });
    g.oval(74, 44, 2.2, 2.2, [255, 255, 255], { shade: 0 });
    g.oval(82, 52, 2, 2, [255, 255, 255], { shade: 0 });
    g.eye(56, 74, 2.4);
    g.eye(72, 74, 2.4);
  },

  scyther(g) {
    const green = [96, 176, 56];
    const blade = [210, 196, 96];
    const cream = [236, 228, 180];
    g.oval(48, 22, 10, 4, [176, 206, 216], { alpha: 170 });
    g.oval(80, 22, 10, 4, [176, 206, 216], { alpha: 170 });
    g.oval(64, 74, 12, 24, green);
    g.oval(64, 80, 6, 11, cream);
    g.oval(64, 46, 11, 10, green);
    g.oval(64, 32, 3, 8, green);
    for (const s of [-1, 1]) {
      for (let t = 0; t <= 26; t++) {
        const x = 64 + s * (12 + t * 1.2);
        const y = 76 - t * 1.45;
        for (let w = -3; w <= 3; w++) g.blend((x + w * 0.2) | 0, (y + w) | 0, blade[0], blade[1], blade[2], 255);
      }
      g.oval(64 + s * 44, 34, 8, 4, blade);
    }
    g.oval(54, 102, 6, 5, green);
    g.oval(74, 102, 6, 5, green);
    g.oval(58, 46, 2.8, 3, [200, 40, 40]);
    g.oval(70, 46, 2.8, 3, [200, 40, 40]);
    g.oval(58, 46, 1.2, 1.4, [24, 16, 16]);
    g.oval(70, 46, 1.2, 1.4, [24, 16, 16]);
  },

  snivy(g) {
    const green = [104, 186, 72];
    const cream = [236, 232, 196];
    const leaf = [56, 150, 56];
    g.oval(90, 86, 14, 5, green);
    g.oval(104, 80, 6, 5, leaf);
    g.oval(64, 74, 12, 22, green);
    g.oval(66, 80, 6, 12, cream);
    g.oval(64, 46, 12, 11, green);
    g.oval(50, 52, 10, 6, leaf);
    g.oval(78, 52, 10, 6, leaf);
    g.oval(46, 76, 4, 8, green);
    g.oval(80, 76, 4, 8, green);
    g.oval(56, 100, 5, 4, green);
    g.oval(72, 100, 5, 4, green);
    g.oval(58, 46, 3.4, 2.2, [255, 220, 60]);
    g.oval(72, 46, 3.4, 2.2, [255, 220, 60]);
    g.oval(58, 47, 1.4, 1.2, [32, 36, 24]);
    g.oval(72, 47, 1.4, 1.2, [32, 36, 24]);
  },

  electrike(g) {
    const green = [96, 176, 64];
    const spark = [255, 220, 48];
    const muzzle = [230, 236, 210];
    g.oval(74, 80, 22, 14, green);
    g.oval(46, 62, 14, 12, green);
    g.oval(34, 66, 8, 5, muzzle);
    g.oval(36, 46, 4, 8, spark);
    g.oval(46, 40, 4, 10, spark);
    g.oval(56, 46, 4, 7, spark);
    g.oval(30, 54, 4, 6, spark);
    g.oval(70, 68, 4, 4, spark);
    g.oval(98, 76, 8, 4, green);
    g.oval(52, 96, 5, 5, green);
    g.oval(68, 98, 5, 5, green);
    g.oval(84, 96, 5, 5, green);
    g.oval(96, 94, 4, 4, green);
    g.oval(40, 60, 3, 3, [64, 140, 220]);
    g.oval(50, 58, 3, 3, [64, 140, 220]);
    g.oval(40, 60, 1.3, 1.5, [20, 24, 32]);
    g.oval(50, 58, 1.3, 1.5, [20, 24, 32]);
  },

  mareep(g) {
    const wool = [255, 214, 64];
    const skin = [96, 144, 200];
    const face = [255, 186, 196];
    g.oval(64, 74, 14, 12, wool);
    g.oval(48, 66, 10, 10, wool);
    g.oval(80, 66, 10, 10, wool);
    g.oval(56, 84, 9, 9, wool);
    g.oval(74, 86, 9, 9, wool);
    g.oval(64, 50, 12, 11, skin);
    g.oval(64, 54, 8, 7, face);
    g.oval(54, 38, 3, 6, skin);
    g.oval(74, 38, 3, 6, skin);
    g.oval(52, 98, 5, 6, skin);
    g.oval(76, 98, 5, 6, skin);
    g.oval(52, 106, 5, 3, [36, 36, 40]);
    g.oval(76, 106, 5, 3, [36, 36, 40]);
    g.eye(58, 50, 2.4);
    g.eye(70, 50, 2.4);
  },

  voltorb(g) {
    disc(g, 64, 66, 26, 26, [232, 48, 48]);
    disc(g, 64, 66, 26, 26, [248, 248, 248], (x, y) => y > 66);
    g.oval(64, 66, 26, 3, [40, 40, 44]);
    g.oval(52, 58, 5, 4, [248, 248, 248]);
    g.oval(74, 56, 6, 5, [248, 248, 248]);
    g.eye(54, 60, 2.6);
    g.eye(74, 58, 3);
    g.oval(64, 74, 6, 2, [40, 40, 44]);
  },

  electabuzz(g) {
    const yel = [255, 208, 48];
    const stripe = [32, 32, 40];
    g.oval(78, 96, 6, 14, yel);
    g.oval(88, 108, 4, 4, stripe);
    g.oval(70, 108, 4, 4, stripe);
    g.oval(64, 70, 16, 24, yel);
    g.oval(64, 74, 6, 14, stripe);
    g.oval(64, 42, 13, 12, yel);
    g.oval(56, 24, 2.5, 10, stripe);
    g.oval(72, 24, 2.5, 10, stripe);
    g.oval(42, 66, 8, 6, yel);
    g.oval(86, 66, 8, 6, yel);
    g.oval(54, 100, 7, 5, yel);
    g.oval(74, 100, 7, 5, yel);
    g.eye(58, 42, 2.8);
    g.eye(72, 42, 2.8);
  },

  plusle(g) {
    const cream = [255, 228, 176];
    const red = [220, 48, 56];
    g.oval(48, 36, 4, 14, cream);
    g.oval(80, 36, 4, 14, cream);
    g.oval(48, 24, 4, 5, red);
    g.oval(80, 24, 4, 5, red);
    g.oval(64, 70, 16, 18, cream);
    g.oval(64, 48, 13, 12, cream);
    g.oval(90, 78, 8, 4, cream);
    g.oval(100, 74, 4, 4, red);
    g.oval(46, 74, 5, 7, cream);
    g.oval(82, 74, 5, 7, cream);
    g.oval(56, 98, 5, 4, cream);
    g.oval(74, 98, 5, 4, cream);
    g.oval(52, 56, 4, 1.4, red);
    g.oval(52, 56, 1.4, 4, red);
    g.oval(76, 56, 4, 1.4, red);
    g.oval(76, 56, 1.4, 4, red);
    g.eye(58, 46, 2.4);
    g.eye(70, 46, 2.4);
  },

  swinub(g) {
    const brown = [166, 112, 68];
    const dark = [72, 48, 36];
    g.oval(74, 74, 26, 18, brown);
    g.oval(70, 64, 14, 4, dark);
    g.oval(78, 80, 12, 3, dark);
    g.oval(40, 66, 14, 12, brown);
    g.oval(28, 52, 4, 5, brown);
    g.oval(48, 50, 4, 5, brown);
    g.oval(22, 70, 9, 6, [196, 140, 96]);
    g.oval(18, 68, 2.2, 1.6, dark);
    g.oval(26, 68, 2.2, 1.6, dark);
    g.oval(16, 74, 2, 3, [236, 226, 200]);
    g.oval(20, 76, 2, 3, [236, 226, 200]);
    g.oval(52, 96, 7, 6, brown);
    g.oval(70, 98, 7, 6, brown);
    g.oval(88, 96, 7, 6, brown);
    g.oval(102, 92, 5, 4, brown);
    g.eye(32, 62, 2.2);
    g.eye(44, 60, 2.2);
  },

  snover(g) {
    const trunk = [132, 86, 52];
    const pine = [48, 128, 58];
    const snow = [236, 244, 248];
    g.oval(64, 90, 16, 14, trunk);
    g.oval(64, 74, 12, 10, trunk);
    g.oval(42, 84, 6, 10, trunk);
    g.oval(86, 84, 6, 10, trunk);
    g.oval(64, 64, 24, 14, pine);
    g.oval(64, 50, 16, 10, pine);
    g.oval(64, 38, 9, 7, pine);
    g.oval(64, 56, 18, 4, snow);
    g.oval(64, 44, 11, 3, snow);
    g.oval(52, 58, 2.4, 2.4, [200, 40, 48], { shade: 0 });
    g.oval(76, 54, 2.4, 2.4, [200, 40, 48], { shade: 0 });
    g.eye(56, 88, 2.4);
    g.eye(72, 88, 2.4);
    g.oval(64, 96, 3, 2, [90, 56, 40]);
  },

  sneasel(g) {
    const fur = [48, 56, 96];
    const feather = [210, 48, 64];
    const claw = [230, 220, 190];
    g.oval(86, 80, 8, 16, fur);
    g.oval(62, 72, 14, 22, fur);
    g.oval(58, 44, 12, 12, fur);
    g.oval(48, 28, 3, 12, feather);
    g.oval(66, 26, 3, 12, feather);
    g.oval(40, 64, 4, 10, feather);
    g.oval(46, 78, 5, 4, claw);
    g.oval(78, 70, 5, 8, fur);
    g.oval(82, 80, 4, 3, claw);
    g.oval(54, 100, 5, 4, fur);
    g.oval(70, 100, 5, 4, fur);
    g.oval(54, 44, 3, 3.2, [255, 210, 48]);
    g.oval(64, 44, 3, 3.2, [255, 210, 48]);
    g.oval(54, 44, 1.3, 1.5, [24, 20, 16]);
    g.oval(64, 44, 1.3, 1.5, [24, 20, 16]);
  },

  cubchoo(g) {
    const fur = [244, 248, 252];
    const drip = [96, 176, 220];
    g.oval(64, 76, 22, 18, fur);
    g.oval(64, 50, 18, 16, fur);
    g.oval(48, 38, 5, 6, fur);
    g.oval(80, 38, 5, 6, fur);
    g.oval(46, 78, 6, 8, fur);
    g.oval(82, 78, 6, 8, fur);
    g.oval(54, 100, 7, 5, fur);
    g.oval(74, 100, 7, 5, fur);
    g.oval(64, 58, 4, 3, [140, 90, 60]);
    g.oval(64, 66, 3.2, 5, drip);
    g.eye(56, 48, 2.6);
    g.eye(72, 48, 2.6);
  },

  vanillite(g) {
    const ice = [236, 248, 255];
    const cone = [196, 140, 72];
    g.oval(64, 96, 12, 8, cone);
    g.oval(64, 84, 8, 8, cone);
    g.oval(64, 58, 20, 18, ice);
    g.oval(64, 36, 4, 8, cone);
    g.oval(64, 28, 8, 3, cone);
    g.eye(56, 56, 2.6);
    g.eye(72, 56, 2.6);
    g.oval(64, 66, 4, 2, [80, 140, 180]);
  },

  larvitar(g) {
    const hide = [88, 140, 64];
    const rock = [120, 124, 112];
    const gem = [200, 48, 48];
    g.oval(64, 78, 16, 14, hide);
    g.oval(64, 50, 26, 22, hide);
    g.oval(46, 40, 6, 6, rock);
    g.oval(80, 36, 7, 6, rock);
    g.oval(64, 30, 6, 5, rock);
    g.oval(64, 70, 6, 8, gem);
    g.oval(50, 98, 6, 5, hide);
    g.oval(78, 98, 6, 5, hide);
    g.eye(54, 52, 3);
    g.eye(76, 52, 3);
  },

  gible(g) {
    const blue = [72, 128, 196];
    const belly = [210, 56, 48];
    g.oval(78, 86, 14, 8, blue);
    g.oval(64, 74, 20, 18, blue);
    g.oval(66, 80, 10, 10, belly);
    g.oval(48, 56, 18, 12, blue);
    g.oval(36, 62, 10, 6, blue);
    g.oval(64, 48, 5, 8, blue);
    g.oval(44, 78, 5, 6, blue);
    g.oval(80, 72, 5, 6, blue);
    g.oval(54, 100, 6, 5, blue);
    g.oval(72, 100, 6, 5, blue);
    g.eye(42, 52, 2.8);
    g.eye(56, 50, 2.8);
    g.oval(32, 64, 3, 2, [255, 255, 255]);
  },

  axew(g) {
    const green = [96, 168, 56];
    const tusk = [236, 220, 170];
    const dark = [48, 90, 40];
    g.oval(64, 74, 16, 18, green);
    g.oval(64, 78, 8, 10, [210, 220, 160]);
    g.oval(64, 62, 14, 4, dark);
    g.oval(62, 46, 14, 12, green);
    g.oval(50, 58, 4, 10, tusk);
    g.oval(76, 58, 4, 10, tusk);
    g.oval(46, 74, 5, 7, green);
    g.oval(82, 74, 5, 7, green);
    g.oval(54, 100, 6, 4, green);
    g.oval(74, 100, 6, 4, green);
    g.oval(56, 44, 3, 3, [200, 40, 40]);
    g.oval(70, 44, 3, 3, [200, 40, 40]);
    g.oval(56, 44, 1.3, 1.4, [24, 16, 16]);
    g.oval(70, 44, 1.3, 1.4, [24, 16, 16]);
  },

  trapinch(g) {
    const sand = [224, 156, 80];
    const jaw = [176, 96, 48];
    g.oval(64, 78, 24, 16, sand);
    g.oval(36, 70, 16, 10, jaw);
    g.oval(92, 70, 16, 10, jaw);
    g.oval(28, 78, 6, 4, [240, 220, 180]);
    g.oval(100, 78, 6, 4, [240, 220, 180]);
    g.oval(48, 96, 7, 4, sand);
    g.oval(80, 96, 7, 4, sand);
    g.eye(54, 68, 2.6);
    g.eye(74, 68, 2.6);
  },

  rhyhorn(g) {
    const hide = [168, 168, 176];
    const plate = [132, 104, 72];
    const horn = [236, 214, 160];
    g.oval(76, 62, 30, 15, hide);
    g.oval(70, 46, 11, 6, plate);
    g.oval(86, 42, 9, 5, plate);
    g.oval(98, 52, 7, 5, plate);
    g.oval(40, 54, 16, 13, hide);
    g.oval(22, 50, 12, 5, horn);
    g.oval(12, 48, 6, 4, horn);
    g.oval(52, 84, 6, 12, hide);
    g.oval(70, 88, 6, 12, hide);
    g.oval(90, 86, 6, 12, hide);
    g.oval(108, 80, 5, 9, hide);
    g.oval(28, 58, 4, 3, [210, 48, 48]);
    g.eye(34, 50, 2.6);
    g.eye(46, 48, 2.4);
  },

  clefairy(g) {
    const pink = [244, 160, 176];
    const tip = [120, 72, 56];
    g.oval(64, 74, 22, 20, pink);
    g.oval(64, 50, 16, 14, pink);
    g.oval(48, 32, 5, 12, pink);
    g.oval(80, 32, 5, 12, pink);
    g.oval(48, 22, 5, 5, tip);
    g.oval(80, 22, 5, 5, tip);
    g.oval(44, 58, 7, 4, pink);
    g.oval(84, 58, 7, 4, pink);
    g.oval(64, 40, 3, 4, pink);
    g.oval(50, 78, 5, 7, pink);
    g.oval(78, 78, 5, 7, pink);
    g.oval(54, 100, 7, 5, pink);
    g.oval(74, 100, 7, 5, pink);
    g.eye(58, 50, 3);
    g.eye(72, 50, 3);
  },

  jigglypuff(g) {
    const pink = [255, 176, 196];
    g.oval(64, 70, 26, 24, pink);
    g.oval(50, 42, 5, 8, pink);
    g.oval(78, 42, 5, 8, pink);
    g.oval(64, 40, 4, 6, pink);
    g.oval(48, 78, 6, 6, pink);
    g.oval(80, 78, 6, 6, pink);
    g.oval(54, 100, 7, 5, pink);
    g.oval(74, 100, 7, 5, pink);
    g.oval(56, 64, 6, 7, [72, 176, 200]);
    g.oval(74, 64, 6, 7, [72, 176, 200]);
    g.oval(56, 64, 2.4, 3, [24, 32, 40]);
    g.oval(74, 64, 2.4, 3, [24, 32, 40]);
    g.oval(58, 62, 1.4, 1.4, [255, 255, 255], { shade: 0 });
    g.oval(76, 62, 1.4, 1.4, [255, 255, 255], { shade: 0 });
  },

  togepi(g) {
    const shell = [248, 244, 236];
    g.oval(64, 72, 24, 26, shell);
    disc(g, 64, 72, 24, 26, [232, 220, 190], (x, y) => y > 88);
    g.oval(48, 58, 5, 5, [220, 56, 56], { shade: 0 });
    g.oval(80, 54, 5, 5, [56, 120, 210], { shade: 0 });
    g.oval(60, 78, 4, 4, [240, 196, 48], { shade: 0 });
    g.oval(76, 76, 4, 4, [64, 170, 80], { shade: 0 });
    g.oval(46, 74, 5, 5, shell);
    g.oval(82, 74, 5, 5, shell);
    g.eye(56, 66, 2.4);
    g.eye(72, 66, 2.4);
    g.oval(64, 74, 3, 2, [200, 120, 100]);
  },

  snubbull(g) {
    const pink = [240, 150, 176];
    const spot = [64, 96, 200];
    g.oval(64, 76, 24, 18, pink);
    g.oval(64, 52, 18, 14, pink);
    g.oval(64, 66, 16, 8, pink);
    g.oval(56, 70, 3, 5, [248, 248, 248]);
    g.oval(72, 70, 3, 5, [248, 248, 248]);
    g.oval(48, 48, 5, 5, spot);
    g.oval(78, 44, 4, 4, spot);
    g.oval(70, 80, 5, 4, spot);
    g.oval(50, 36, 4, 5, pink);
    g.oval(78, 36, 4, 5, pink);
    g.oval(48, 96, 7, 5, pink);
    g.oval(80, 96, 7, 5, pink);
    g.eye(56, 50, 2.8);
    g.eye(74, 50, 2.8);
  },

  marill(g) {
    const blue = [72, 144, 224];
    const belly = [248, 248, 252];
    g.oval(92, 78, 16, 16, blue);
    g.oval(92, 78, 8, 8, belly);
    g.oval(64, 74, 16, 16, blue);
    g.oval(64, 80, 9, 9, belly);
    g.oval(64, 52, 13, 12, blue);
    g.oval(52, 32, 4, 14, blue);
    g.oval(76, 32, 4, 14, blue);
    g.oval(52, 20, 4, 5, [32, 32, 40]);
    g.oval(76, 20, 4, 5, [32, 32, 40]);
    g.oval(54, 98, 6, 4, blue);
    g.oval(74, 98, 6, 4, blue);
    g.eye(58, 50, 2.6);
    g.eye(72, 50, 2.6);
  },

  hitmonlee(g) {
    const skin = [186, 120, 72];
    const band = [236, 220, 180];
    g.oval(64, 36, 12, 11, skin);
    g.oval(64, 54, 14, 12, skin);
    g.oval(64, 48, 12, 3, band);
    g.oval(48, 72, 7, 5, skin);
    g.oval(44, 82, 8, 4, band);
    g.oval(48, 92, 7, 5, skin);
    g.oval(52, 102, 8, 4, skin);
    g.oval(80, 72, 7, 5, skin);
    g.oval(84, 82, 8, 4, band);
    g.oval(80, 92, 7, 5, skin);
    g.oval(76, 102, 8, 4, skin);
    g.eye(58, 36, 2.4);
    g.eye(70, 36, 2.4);
  },

  hitmonchan(g) {
    const skin = [186, 120, 72];
    const glove = [220, 48, 56];
    const band = [236, 220, 180];
    g.oval(64, 40, 13, 12, skin);
    g.oval(64, 52, 12, 3, band);
    g.oval(64, 68, 16, 16, skin);
    g.oval(36, 64, 12, 10, glove);
    g.oval(92, 64, 12, 10, glove);
    g.oval(28, 64, 5, 6, [248, 248, 248]);
    g.oval(100, 64, 5, 6, [248, 248, 248]);
    g.oval(54, 98, 7, 6, skin);
    g.oval(74, 98, 7, 6, skin);
    g.eye(58, 40, 2.4);
    g.eye(70, 40, 2.4);
  },

  tyrogue(g) {
    const skin = [160, 110, 190];
    const wrap = [244, 244, 248];
    g.oval(64, 48, 14, 13, skin);
    g.oval(64, 40, 12, 3, wrap);
    g.oval(64, 74, 12, 14, skin);
    g.oval(48, 70, 6, 5, wrap);
    g.oval(80, 70, 6, 5, wrap);
    g.oval(54, 98, 6, 5, wrap);
    g.oval(74, 98, 6, 5, wrap);
    g.eye(58, 48, 2.6);
    g.eye(72, 48, 2.6);
  },

  makuhita(g) {
    const yel = [236, 196, 64];
    const black = [36, 36, 40];
    g.oval(64, 70, 24, 20, yel);
    g.oval(64, 46, 14, 12, yel);
    g.oval(64, 32, 4, 6, black);
    g.oval(40, 72, 10, 8, black);
    g.oval(88, 72, 10, 8, black);
    g.oval(64, 86, 14, 6, black);
    g.oval(52, 100, 8, 5, yel);
    g.oval(76, 100, 8, 5, yel);
    g.eye(58, 46, 2.6);
    g.eye(72, 46, 2.6);
  },

  riolu(g) {
    const blue = [64, 128, 200];
    const black = [32, 36, 48];
    const chest = [230, 220, 190];
    g.oval(64, 76, 14, 16, blue);
    g.oval(64, 80, 7, 8, chest);
    g.oval(52, 34, 4, 8, blue);
    g.oval(76, 34, 4, 8, blue);
    g.oval(64, 50, 14, 13, blue);
    g.oval(64, 52, 13, 5, black);
    g.oval(44, 72, 5, 8, blue);
    g.oval(84, 72, 5, 8, blue);
    g.oval(54, 100, 6, 6, black);
    g.oval(74, 100, 6, 6, black);
    g.oval(56, 50, 2.8, 2.6, [210, 40, 48]);
    g.oval(72, 50, 2.8, 2.6, [210, 40, 48]);
    g.oval(56, 50, 1.2, 1.3, [24, 16, 16]);
    g.oval(72, 50, 1.2, 1.3, [24, 16, 16]);
  },

  lucario(g) {
    const blue = [56, 88, 160];
    const black = [28, 32, 44];
    const cream = [236, 214, 160];
    g.oval(64, 72, 14, 22, blue);
    g.oval(64, 78, 6, 10, cream);
    g.oval(64, 70, 3, 8, cream);
    g.oval(64, 42, 12, 12, blue);
    g.oval(52, 24, 4, 12, black);
    g.oval(76, 24, 4, 12, black);
    g.oval(64, 46, 10, 4, black);
    g.oval(42, 64, 6, 10, blue);
    g.oval(86, 64, 6, 10, blue);
    g.oval(52, 100, 6, 6, black);
    g.oval(76, 100, 6, 6, black);
    g.oval(58, 42, 2.4, 2.2, [210, 40, 48]);
    g.oval(72, 42, 2.4, 2.2, [210, 40, 48]);
    g.oval(58, 42, 1, 1.1, [20, 12, 16]);
    g.oval(72, 42, 1, 1.1, [20, 12, 16]);
  },

  garchomp(g) {
    const blue = [64, 124, 196];
    const red = [204, 48, 48];
    const sand = [220, 170, 110];
    g.oval(88, 86, 16, 8, blue);
    g.oval(64, 70, 18, 24, blue);
    g.oval(66, 78, 9, 14, red);
    g.oval(48, 46, 20, 12, blue);
    g.oval(30, 40, 10, 6, blue);
    g.oval(78, 40, 10, 6, blue);
    g.oval(48, 54, 10, 5, sand);
    g.oval(36, 66, 8, 5, red);
    g.oval(90, 60, 10, 5, red);
    g.oval(64, 28, 4, 10, blue);
    g.oval(54, 102, 7, 5, blue);
    g.oval(76, 102, 7, 5, blue);
    g.oval(40, 42, 3, 3, [255, 210, 48]);
    g.oval(56, 40, 3, 3, [255, 210, 48]);
    g.oval(40, 42, 1.3, 1.4, [24, 20, 16]);
    g.oval(56, 40, 1.3, 1.4, [24, 20, 16]);
  },

  metagross(g) {
    const steel = [176, 186, 198];
    const face = [96, 140, 190];
    g.oval(36, 86, 14, 8, steel);
    g.oval(92, 86, 14, 8, steel);
    g.oval(36, 48, 12, 7, steel);
    g.oval(92, 48, 12, 7, steel);
    g.oval(28, 96, 6, 5, steel);
    g.oval(100, 96, 6, 5, steel);
    disc(g, 64, 64, 16, 16, steel);
    for (let i = -12; i <= 12; i++) {
      for (let w = -2; w <= 2; w++) {
        g.blend(64 + i, 64 + i + w, face[0], face[1], face[2], 255);
        g.blend(64 + i, 64 - i + w, face[0], face[1], face[2], 255);
      }
    }
    g.oval(64, 64, 3.5, 3.5, [200, 40, 48]);
  },

  tyranitar(g) {
    const hide = [56, 120, 64];
    const belly = [230, 214, 160];
    const plate = [90, 110, 120];
    g.oval(90, 84, 14, 10, hide);
    g.oval(64, 72, 22, 24, hide);
    g.oval(64, 80, 12, 14, belly);
    g.oval(50, 48, 8, 8, plate);
    g.oval(74, 42, 8, 8, plate);
    g.oval(86, 56, 7, 7, plate);
    g.oval(48, 46, 16, 13, hide);
    g.oval(36, 54, 10, 6, hide);
    g.oval(42, 72, 7, 8, hide);
    g.oval(84, 68, 7, 8, hide);
    g.oval(54, 102, 8, 6, hide);
    g.oval(76, 102, 8, 6, hide);
    g.eye(42, 44, 2.8);
    g.eye(56, 42, 2.8);
  },

  togekiss(g) {
    const white = [248, 248, 252];
    g.oval(28, 64, 22, 8, white);
    g.oval(100, 64, 22, 8, white);
    g.oval(36, 58, 8, 5, [210, 48, 56]);
    g.oval(92, 58, 8, 5, [48, 110, 200]);
    g.oval(64, 70, 16, 18, white);
    g.oval(64, 48, 12, 11, white);
    g.oval(76, 50, 5, 3, [255, 196, 64]);
    g.oval(48, 40, 4, 4, [210, 48, 56], { shade: 0 });
    g.oval(78, 36, 4, 4, [48, 110, 200], { shade: 0 });
    g.oval(64, 86, 8, 6, white);
    g.oval(58, 46, 3, 1.6, [40, 40, 48]);
    g.oval(70, 46, 3, 1.6, [40, 40, 48]);
  },
};

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [id, paint] of Object.entries(painters)) {
  const g = create();
  g.clear();
  paint(g);
  shadow(g);
  g.save(path.join(OUT, `${id}.png`));
  n += 1;
}
console.log(`rendered ${n} region sprites → ${OUT}`);
