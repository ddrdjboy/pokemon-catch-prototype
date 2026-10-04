/**
 * Soft-shaded, species-recognizable Pokémon-style sprites (original art).
 * Run: node scripts/render-sprites-v2.mjs
 */
import fs from 'fs';
import path from 'path';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets/pokemon');
const SIZE = 128;
const OUT_PX = 64;
const SCALE = 3; // final 192×192

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

function create() {
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  const api = {
    rgba,
    clear() {
      rgba.fill(0);
    },
    blend(x, y, r, g, b, a) {
      x = x | 0;
      y = y | 0;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return;
      const i = (y * SIZE + x) * 4;
      const oa = rgba[i + 3] / 255;
      const na = a / 255;
      const outA = na + oa * (1 - na);
      if (outA <= 0) return;
      rgba[i] = Math.round((r * na + rgba[i] * oa * (1 - na)) / outA);
      rgba[i + 1] = Math.round((g * na + rgba[i + 1] * oa * (1 - na)) / outA);
      rgba[i + 2] = Math.round((b * na + rgba[i + 2] * oa * (1 - na)) / outA);
      rgba[i + 3] = Math.round(outA * 255);
    },
    /** Ellipse with hard-ish core + light top-left band (pixel friendly) */
    oval(cx, cy, rx, ry, color, opts = {}) {
      const [r, g, b] = color;
      const shade = opts.shade ?? 0.22;
      const light = opts.light ?? [-0.4, -0.45];
      const x0 = Math.floor(cx - rx - 1);
      const x1 = Math.ceil(cx + rx + 1);
      const y0 = Math.floor(cy - ry - 1);
      const y1 = Math.ceil(cy + ry + 1);
      const baseA = opts.alpha ?? 255;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const nx = (x - cx) / rx;
          const ny = (y - cy) / ry;
          const d = nx * nx + ny * ny;
          if (d > 1.0) continue;
          const lx = nx * light[0] + ny * light[1];
          const lit = 1 + lx * shade;
          const rr = Math.min(255, Math.max(0, Math.round(r * lit)));
          const gg = Math.min(255, Math.max(0, Math.round(g * lit)));
          const bb = Math.min(255, Math.max(0, Math.round(b * lit)));
          // hard fill — avoid soft fringe that becomes muddy when quantized
          const aa = d > 0.92 ? Math.round(baseA * 0.55) : baseA;
          if (aa < 40) continue;
          api.blend(x, y, rr, gg, bb, aa);
        }
      }
    },
    eye(cx, cy, s = 3.2) {
      api.oval(cx, cy, s, s * 1.15, [28, 28, 32]);
      api.oval(cx - s * 0.25, cy - s * 0.3, s * 0.35, s * 0.35, [255, 255, 255], { alpha: 230, shade: 0 });
    },
    /** Soft 128 → hard 64 pixel art + outline → ×3 NN 192 */
    save(file) {
      const hard = Buffer.alloc(OUT_PX * OUT_PX * 4);
      const step = SIZE / OUT_PX;
      for (let y = 0; y < OUT_PX; y++) {
        for (let x = 0; x < OUT_PX; x++) {
          // pick most-opaque source pixel (keeps painter colors clean)
          let bestA = 0;
          let br = 0,
            bg = 0,
            bb = 0;
          const x0 = Math.floor(x * step);
          const y0 = Math.floor(y * step);
          for (let dy = 0; dy < step; dy++)
            for (let dx = 0; dx < step; dx++) {
              const i = ((y0 + dy) * SIZE + (x0 + dx)) * 4;
              const a = rgba[i + 3];
              if (a > bestA) {
                bestA = a;
                br = rgba[i];
                bg = rgba[i + 1];
                bb = rgba[i + 2];
              }
            }
          const o = (y * OUT_PX + x) * 4;
          if (bestA < 120) continue;
          // gentle posterize (8-step); clamp so 255→248 not 256 (Buffer wrap → 0 = green bug)
          hard[o] = Math.min(248, Math.floor(br / 8) * 8);
          hard[o + 1] = Math.min(248, Math.floor(bg / 8) * 8);
          hard[o + 2] = Math.min(248, Math.floor(bb / 8) * 8);
          hard[o + 3] = 255;
        }
      }
      // soft colored outline
      const outline = [];
      for (let y = 0; y < OUT_PX; y++)
        for (let x = 0; x < OUT_PX; x++) {
          const i = (y * OUT_PX + x) * 4;
          if (hard[i + 3]) continue;
          let nr = 0,
            ng = 0,
            nb = 0,
            hit = false;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + dx,
              ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= OUT_PX || ny >= OUT_PX) continue;
            const j = (ny * OUT_PX + nx) * 4;
            if (!hard[j + 3]) continue;
            nr = hard[j];
            ng = hard[j + 1];
            nb = hard[j + 2];
            hit = true;
            break;
          }
          if (hit) outline.push([i, Math.max(16, (nr * 0.38) | 0), Math.max(16, (ng * 0.38) | 0), Math.max(20, (nb * 0.38) | 0)]);
        }
      for (const [i, r, g, b] of outline) {
        hard[i] = r;
        hard[i + 1] = g;
        hard[i + 2] = b;
        hard[i + 3] = 255;
      }
      // ×3 nearest neighbor
      const fw = OUT_PX * SCALE;
      const fh = OUT_PX * SCALE;
      const final = Buffer.alloc(fw * fh * 4);
      for (let y = 0; y < OUT_PX; y++)
        for (let x = 0; x < OUT_PX; x++) {
          const i = (y * OUT_PX + x) * 4;
          for (let dy = 0; dy < SCALE; dy++)
            for (let dx = 0; dx < SCALE; dx++) {
              const o = ((y * SCALE + dy) * fw + (x * SCALE + dx)) * 4;
              final[o] = hard[i];
              final[o + 1] = hard[i + 1];
              final[o + 2] = hard[i + 2];
              final[o + 3] = hard[i + 3];
            }
        }
      fs.writeFileSync(file, pngFromRgba(fw, fh, final));
    },
  };
  return api;
}

function tint(c, f) {
  return c.map((v) => Math.min(255, Math.max(0, Math.round(v * f))));
}
function mix(a, b, t) {
  return a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
}

/** Family painters: (g, stage 0-3, mega) */
const painters = {
  rabbit_fire(g, stage, mega) {
    const white = [248, 246, 242];
    const orange = mega ? [255, 120, 40] : [255, 110, 50];
    const s = 1 + stage * 0.12;
    // ears
    g.oval(48, 22, 6 * s, 20 * s, white);
    g.oval(80, 22, 6 * s, 20 * s, white);
    g.oval(48, 24, 3 * s, 14 * s, orange);
    g.oval(80, 24, 3 * s, 14 * s, orange);
    // head + body
    g.oval(64, 46, 20 * s, 18 * s, white);
    g.oval(64, 78, 24 * s, 24 * s, white);
    // collar band
    g.oval(64, 62, 22 * s, 8 * s, orange);
    // arms / feet
    g.oval(40, 72, 8 * s, 10 * s, orange);
    g.oval(88, 72, 8 * s, 10 * s, orange);
    g.oval(50, 102, 8 * s, 7 * s, orange);
    g.oval(78, 102, 8 * s, 7 * s, orange);
    if (stage >= 1) g.oval(64, 70, 16 * s, 6 * s, tint(orange, 0.75));
    g.eye(56, 44, 3.2 * s);
    g.eye(72, 44, 3.2 * s);
    g.oval(64, 52, 3, 2, orange);
    if (mega) {
      g.oval(40, 36, 5, 9, [255, 220, 100]);
      g.oval(88, 36, 5, 9, [255, 220, 100]);
    }
  },

  lizard_fire(g, stage, mega) {
    const body = stage === 1 ? [230, 90, 40] : [255, 140, 70];
    const belly = [255, 230, 160];
    const s = 1 + stage * 0.12;
    if (stage >= 2) {
      g.oval(30, 52, 16 * s, 10 * s, [70, 70, 110]);
      g.oval(98, 52, 16 * s, 10 * s, [70, 70, 110]);
      g.oval(30, 52, 10 * s, 6 * s, [210, 70, 70]);
      g.oval(98, 52, 10 * s, 6 * s, [210, 70, 70]);
    }
    // head + snout
    g.oval(60, 44, 15 * s, 14 * s, body);
    g.oval(74, 48, 8 * s, 6 * s, body);
    // body + belly
    g.oval(60, 74, 18 * s, 20 * s, body);
    g.oval(60, 78, 11 * s, 12 * s, belly);
    // arms / legs
    g.oval(42, 70, 6 * s, 8 * s, body);
    g.oval(78, 70, 6 * s, 8 * s, body);
    g.oval(50, 98, 6 * s, 6 * s, body);
    g.oval(70, 98, 6 * s, 6 * s, body);
    // flame tail
    g.oval(88, 86, 7 * s, 12 * s, body);
    g.oval(96, 70, 9 * s, 11 * s, [255, 210, 50]);
    g.oval(98, 58, 6 * s, 8 * s, [255, 130, 40]);
    g.eye(54, 42, 3 * s);
    g.eye(68, 42, 3 * s);
    if (stage >= 2) {
      g.oval(52, 30, 3, 5, body);
      g.oval(66, 28, 3, 6, body);
    }
    if (mega) g.oval(64, 64, 42, 42, [255, 200, 60], { alpha: 40, shade: 0 });
  },

  turtle(g, stage, mega) {
    const skin = [90, 180, 210];
    const shell = stage >= 2 ? [70, 120, 160] : [180, 150, 90];
    const s = 1 + stage * 0.12;
    g.oval(64, 78, 26 * s, 20 * s, shell);
    g.oval(64, 78, 16 * s, 12 * s, tint(shell, 0.75));
    g.oval(64, 52, 16 * s, 14 * s, skin);
    g.eye(56, 50, 3 * s);
    g.eye(70, 50, 3 * s);
    g.oval(48, 88, 7 * s, 5 * s, skin);
    g.oval(80, 88, 7 * s, 5 * s, skin);
    g.oval(88, 60, 10 * s, 5 * s, skin);
    g.oval(96, 52, 8 * s, 7 * s, [255, 210, 90]);
    if (stage >= 2) {
      g.oval(50, 62, 5, 10, [120, 160, 190]);
      g.oval(78, 62, 5, 10, [120, 160, 190]);
    }
    if (mega) g.oval(64, 64, 44, 44, [120, 200, 255], { alpha: 40, shade: 0 });
  },

  seed_dino(g, stage, mega) {
    const body = [90, 190, 120];
    const bulb = stage >= 2 ? [50, 140, 70] : [60, 160, 80];
    const s = 1 + stage * 0.12;
    g.oval(64, 80, 26 * s, 20 * s, body);
    g.oval(64, 54, 18 * s, 16 * s, body);
    g.oval(64, 36, 16 * s, 14 * s, bulb);
    if (stage >= 1) g.oval(64, 24, 12 * s, 8 * s, [220, 90, 140]);
    if (stage >= 2) {
      g.oval(50, 20, 10 * s, 8 * s, [230, 100, 150]);
      g.oval(78, 20, 10 * s, 8 * s, [230, 100, 150]);
    }
    g.eye(54, 52, 3.2 * s);
    g.eye(72, 52, 3.2 * s);
    g.oval(48, 92, 8 * s, 6 * s, tint(body, 0.85));
    g.oval(80, 92, 8 * s, 6 * s, tint(body, 0.85));
    if (mega) g.oval(64, 30, 22, 16, [255, 180, 200], { alpha: 180 });
  },

  mouse_electric(g, stage, mega) {
    const yel = stage === 0 ? [255, 220, 70] : [255, 175, 90];
    const tip = [36, 36, 40];
    const stripe = stage === 0 ? [210, 150, 40] : [210, 90, 40];
    const s = 1 + stage * 0.1;
    // ears
    g.oval(46, 24, 5 * s, 16 * s, yel);
    g.oval(82, 22, 5 * s, 17 * s, yel);
    g.oval(46, 16, 5 * s, 6 * s, tip);
    g.oval(82, 14, 5 * s, 6 * s, tip);
    // head / body
    g.oval(64, 46, 17 * s, 15 * s, yel);
    g.oval(64, 74, 20 * s, 18 * s, yel);
    // arms / legs
    g.oval(42, 70, 6 * s, 8 * s, yel);
    g.oval(86, 70, 6 * s, 8 * s, yel);
    g.oval(52, 96, 6 * s, 7 * s, yel);
    g.oval(76, 96, 6 * s, 7 * s, yel);
    // back stripes
    g.oval(64, 62, 12 * s, 3 * s, stripe);
    g.oval(64, 78, 10 * s, 3 * s, stripe);
    // lightning tail
    g.oval(92, 72, 8 * s, 5 * s, yel);
    g.oval(102, 58, 7 * s, 9 * s, yel);
    g.oval(108, 48, 6 * s, 5 * s, stripe);
    g.eye(56, 44, 3 * s);
    g.eye(72, 44, 3 * s);
    g.oval(48, 54, 5 * s, 4 * s, [255, 80, 80]);
    g.oval(80, 54, 5 * s, 4 * s, [255, 80, 80]);
    if (mega) g.oval(64, 64, 40, 40, [255, 240, 120], { alpha: 50, shade: 0 });
  },

  rock_arms(g, stage, mega) {
    const rock = stage >= 2 ? [140, 120, 95] : [165, 145, 115];
    const s = 1 + stage * 0.14;
    g.oval(64, 64, 28 * s, 26 * s, rock);
    g.oval(64, 64, 18 * s, 16 * s, tint(rock, 0.85));
    g.eye(52, 58, 4 * s);
    g.eye(76, 58, 4 * s);
    g.oval(28, 64, 12 * s, 10 * s, rock);
    g.oval(100, 64, 12 * s, 10 * s, rock);
    if (stage >= 1) {
      g.oval(24, 48, 8 * s, 7 * s, rock);
      g.oval(104, 48, 8 * s, 7 * s, rock);
    }
    if (stage >= 2) {
      g.oval(40, 96, 10 * s, 8 * s, rock);
      g.oval(88, 96, 10 * s, 8 * s, rock);
    }
    if (mega) g.oval(64, 64, 44, 44, [255, 200, 100], { alpha: 40, shade: 0 });
  },

  worm_bug(g, stage, mega) {
    if (stage === 0) {
      g.oval(64, 70, 28, 14, [200, 180, 60]);
      g.oval(40, 62, 12, 10, [60, 50, 40]);
      g.oval(36, 50, 3, 10, [40, 40, 40]);
      g.eye(48, 60, 2.5);
    } else if (stage === 1) {
      g.oval(64, 70, 18, 26, [220, 200, 90]);
      g.oval(64, 50, 14, 12, [200, 180, 70]);
    } else {
      const body = [230, 220, 80];
      g.oval(64, 70, 16, 20, body);
      g.oval(64, 48, 14, 12, body);
      g.oval(36, 56, 14, 5, [40, 40, 40]);
      g.oval(92, 56, 14, 5, [40, 40, 40]);
      g.oval(30, 56, 6, 4, [160, 60, 200]);
      g.oval(98, 56, 6, 4, [160, 60, 200]);
      g.eye(56, 46, 3);
      g.eye(72, 46, 3);
      if (mega) g.oval(64, 64, 40, 40, [200, 255, 80], { alpha: 45, shade: 0 });
    }
  },

  plant_biped(g, stage, mega) {
    const leaf = [80, 180, 90];
    const blue = [90, 120, 200];
    const s = 1 + stage * 0.1;
    g.oval(64, 78, 16 * s, 18 * s, blue);
    g.oval(64, 52, 14 * s, 12 * s, blue);
    g.oval(48, 40, 12 * s, 8 * s, leaf);
    g.oval(80, 40, 12 * s, 8 * s, leaf);
    if (stage >= 2) g.oval(64, 28, 18 * s, 12 * s, [220, 80, 140]);
    g.eye(56, 52, 2.8 * s);
    g.eye(70, 52, 2.8 * s);
    if (mega) g.oval(64, 24, 20, 14, [255, 150, 190]);
  },

  duck(g, stage, mega) {
    const yel = [240, 210, 80];
    const blue = stage >= 1 ? [70, 130, 200] : yel;
    const s = 1 + stage * 0.12;
    g.oval(64, 78, 24 * s, 20 * s, blue);
    g.oval(64, 50, 18 * s, 16 * s, blue);
    g.oval(64, 58, 10 * s, 5 * s, [255, 180, 60]);
    g.eye(54, 46, 3.5 * s);
    g.eye(72, 46, 3.5 * s);
    g.oval(48, 96, 8 * s, 5 * s, tint(blue, 0.8));
    g.oval(80, 96, 8 * s, 5 * s, tint(blue, 0.8));
    if (stage >= 2) g.oval(88, 70, 10 * s, 14 * s, [50, 90, 160]);
    if (mega) g.oval(64, 40, 20, 10, [180, 220, 255], { alpha: 160 });
  },

  muscle(g, stage, mega) {
    const skin = [210, 160, 120];
    const s = 1 + stage * 0.16;
    g.oval(64, 70, 20 * s, 22 * s, skin);
    g.oval(64, 42, 14 * s, 13 * s, skin);
    g.oval(36, 68, 12 * s, 10 * s, skin);
    g.oval(92, 68, 12 * s, 10 * s, skin);
    if (stage >= 2) {
      g.oval(28, 60, 10 * s, 9 * s, skin);
      g.oval(100, 60, 10 * s, 9 * s, skin);
    }
    g.eye(56, 40, 3 * s);
    g.eye(70, 40, 3 * s);
    g.oval(54, 96, 7 * s, 6 * s, tint(skin, 0.85));
    g.oval(74, 96, 7 * s, 6 * s, tint(skin, 0.85));
    if (mega) g.oval(64, 64, 42, 42, [255, 100, 80], { alpha: 40, shade: 0 });
  },

  magnet(g, stage, mega) {
    const blue = [100, 160, 200];
    const red = [220, 80, 80];
    const s = 1 + stage * 0.15;
    if (stage === 0) {
      g.oval(64, 64, 18, 18, blue);
      g.oval(40, 64, 8, 10, red);
      g.oval(88, 64, 8, 10, blue);
      g.eye(58, 60, 3);
      g.eye(70, 60, 3);
    } else if (stage === 1) {
      for (const [x, y] of [[44, 56], [64, 72], [84, 56]]) {
        g.oval(x, y, 14, 14, blue);
        g.eye(x - 4, y - 2, 2.2);
        g.eye(x + 4, y - 2, 2.2);
      }
    } else {
      g.oval(64, 70, 28 * s, 22 * s, [80, 90, 110]);
      g.oval(40, 50, 12 * s, 14 * s, red);
      g.oval(88, 50, 12 * s, 14 * s, blue);
      g.oval(64, 48, 10 * s, 8 * s, [200, 200, 210]);
      if (mega) g.oval(64, 64, 40, 40, [180, 220, 255], { alpha: 50, shade: 0 });
    }
  },

  fox_fire(g, stage, mega) {
    const orange = [255, 150, 70];
    const cream = [255, 230, 200];
    const s = 1 + stage * 0.12;
    const tails = stage === 0 ? 1 : stage >= 2 ? 6 : 3;
    for (let i = 0; i < Math.min(tails, 6); i++) {
      const a = (i - (tails - 1) / 2) * 10;
      g.oval(64 + a, 88, 8 * s, 16 * s, orange);
      g.oval(64 + a, 78, 5 * s, 6 * s, cream);
    }
    g.oval(64, 68, 18 * s, 16 * s, orange);
    g.oval(64, 48, 15 * s, 14 * s, orange);
    g.oval(50, 34, 6 * s, 10 * s, orange);
    g.oval(78, 34, 6 * s, 10 * s, orange);
    g.eye(56, 46, 3 * s);
    g.eye(70, 46, 3 * s);
    g.oval(64, 56, 8 * s, 5 * s, cream);
    if (mega) g.oval(64, 64, 42, 42, [255, 200, 100], { alpha: 45, shade: 0 });
  },

  psychic(g, stage, mega) {
    const yel = [240, 210, 100];
    const s = 1 + stage * 0.14;
    g.oval(64, 70, 16 * s, 20 * s, yel);
    g.oval(64, 42, 18 * s, 16 * s, yel);
    g.oval(48, 28, 5 * s, 8 * s, yel);
    g.oval(80, 28, 5 * s, 8 * s, yel);
    g.eye(54, 42, 4 * s);
    g.eye(74, 42, 4 * s);
    if (stage >= 1) {
      g.oval(40, 60, 6 * s, 14 * s, [180, 120, 200]);
      g.oval(88, 60, 6 * s, 14 * s, [180, 120, 200]);
    }
    if (stage >= 2) g.oval(64, 55, 10 * s, 6 * s, [100, 80, 140]);
    if (mega) g.oval(64, 64, 40, 40, [255, 150, 220], { alpha: 50, shade: 0 });
  },

  ghost(g, stage, mega) {
    const purple = stage >= 2 ? [120, 70, 160] : [160, 120, 200];
    const s = 1 + stage * 0.14;
    if (stage === 0) {
      g.oval(64, 60, 22, 24, purple, { alpha: 200 });
      g.oval(64, 48, 10, 8, [40, 40, 50]);
      g.eye(54, 55, 3);
      g.eye(74, 55, 3);
    } else {
      g.oval(64, 70, 22 * s, 24 * s, purple);
      g.oval(64, 48, 18 * s, 16 * s, purple);
      g.oval(40, 72, 10 * s, 14 * s, purple);
      g.oval(88, 72, 10 * s, 14 * s, purple);
      g.eye(54, 48, 3.5 * s);
      g.eye(74, 48, 3.5 * s);
      g.oval(64, 60, 8 * s, 5 * s, [40, 30, 50]);
      if (mega) {
        g.oval(64, 64, 44, 44, [200, 100, 255], { alpha: 45, shade: 0 });
        g.oval(64, 30, 12, 8, [255, 80, 120]);
      }
    }
  },

  serpent_steel(g, stage, mega) {
    const gray = stage >= 1 ? [140, 150, 160] : [160, 140, 110];
    const s = 1 + stage * 0.08;
    for (let i = 0; i < 5; i++) {
      g.oval(40 + i * 12, 50 + Math.sin(i) * 8, 12 * s, 11 * s, tint(gray, 1 - i * 0.05));
    }
    g.oval(36, 48, 14 * s, 12 * s, gray);
    g.eye(30, 46, 3 * s);
    g.eye(40, 46, 3 * s);
    if (mega) g.oval(64, 64, 48, 36, [255, 220, 120], { alpha: 40, shade: 0 });
  },

  seahorse(g, stage, mega) {
    const blue = [80, 160, 210];
    const s = 1 + stage * 0.14;
    g.oval(64, 70, 14 * s, 22 * s, blue);
    g.oval(64, 42, 12 * s, 12 * s, blue);
    g.oval(78, 36, 10 * s, 6 * s, blue);
    g.oval(70, 90, 8 * s, 12 * s, tint(blue, 0.85));
    g.eye(58, 40, 3 * s);
    if (stage >= 2) {
      g.oval(50, 55, 8 * s, 4 * s, [50, 100, 160]);
      g.oval(78, 55, 8 * s, 4 * s, [50, 100, 160]);
    }
    if (mega) g.oval(64, 64, 36, 40, [100, 220, 255], { alpha: 45, shade: 0 });
  },

  fish(g, stage, mega) {
    if (stage === 0) {
      g.oval(64, 70, 22, 14, [255, 100, 110]);
      g.oval(88, 70, 10, 8, [255, 100, 110]);
      g.eye(52, 68, 3);
      g.oval(48, 74, 4, 2, [40, 40, 40]);
    } else {
      const blue = [60, 100, 170];
      const s = 1 + (stage - 1) * 0.15;
      g.oval(64, 70, 28 * s, 18 * s, blue);
      g.oval(40, 50, 16 * s, 10 * s, blue);
      g.oval(88, 50, 16 * s, 10 * s, blue);
      g.oval(64, 48, 16 * s, 14 * s, blue);
      g.eye(54, 48, 3.5 * s);
      g.eye(70, 48, 3.5 * s);
      g.oval(64, 58, 10 * s, 6 * s, [220, 80, 80]);
      if (mega) g.oval(64, 64, 44, 36, [255, 80, 80], { alpha: 45, shade: 0 });
    }
  },

  dragon_long(g, stage, mega) {
    const blue = stage >= 2 ? [255, 180, 70] : [90, 140, 220];
    const s = 1 + stage * 0.14;
    if (stage >= 2) {
      g.oval(36, 60, 16 * s, 10 * s, [80, 100, 160]);
      g.oval(92, 60, 16 * s, 10 * s, [80, 100, 160]);
    }
    g.oval(64, 72, 20 * s, 18 * s, blue);
    g.oval(64, 48, 16 * s, 14 * s, blue);
    g.oval(88, 70, 14 * s, 8 * s, blue);
    g.eye(56, 46, 3.2 * s);
    g.eye(70, 46, 3.2 * s);
    g.oval(54, 96, 7 * s, 6 * s, tint(blue, 0.85));
    g.oval(74, 96, 7 * s, 6 * s, tint(blue, 0.85));
    if (mega) g.oval(64, 64, 42, 42, [255, 220, 100], { alpha: 50, shade: 0 });
  },

  leaf_dino(g, stage, mega) {
    const green = [100, 200, 120];
    const cream = [240, 230, 180];
    const s = 1 + stage * 0.12;
    g.oval(64, 78, 22 * s, 20 * s, cream);
    g.oval(64, 52, 18 * s, 16 * s, cream);
    g.oval(64, 30, 16 * s, 10 * s, green);
    if (stage >= 1) g.oval(64, 70, 18 * s, 8 * s, green);
    if (stage >= 2) g.oval(64, 22, 20 * s, 12 * s, [60, 160, 90]);
    g.eye(54, 50, 3 * s);
    g.eye(72, 50, 3 * s);
    if (mega) g.oval(64, 28, 24, 14, [180, 255, 160], { alpha: 160 });
  },

  mudfish(g, stage, mega) {
    const blue = [70, 150, 200];
    const orange = [230, 140, 70];
    const s = 1 + stage * 0.14;
    g.oval(64, 78, 24 * s, 18 * s, blue);
    g.oval(64, 52, 18 * s, 15 * s, blue);
    g.oval(64, 60, 12 * s, 8 * s, orange);
    g.eye(54, 48, 3.2 * s);
    g.eye(72, 48, 3.2 * s);
    if (stage >= 1) {
      g.oval(40, 88, 10 * s, 8 * s, [120, 90, 60]);
      g.oval(88, 88, 10 * s, 8 * s, [120, 90, 60]);
    }
    if (stage >= 2) g.oval(64, 85, 20 * s, 12 * s, [100, 80, 50]);
    if (mega) g.oval(64, 64, 42, 40, [80, 180, 255], { alpha: 45, shade: 0 });
  },

  fairy_psychic(g, stage, mega) {
    const white = [245, 240, 250];
    const green = [120, 200, 150];
    const s = 1 + stage * 0.12;
    if (stage >= 2) {
      g.oval(64, 78, 22 * s, 28 * s, [220, 200, 240]);
      g.oval(64, 78, 16 * s, 20 * s, white);
    } else {
      g.oval(64, 78, 14 * s, 16 * s, white);
    }
    g.oval(64, 48, 16 * s, 15 * s, white);
    g.oval(48, 36, 5 * s, 10 * s, green);
    g.oval(80, 36, 5 * s, 10 * s, green);
    g.eye(56, 48, 3.5 * s);
    g.eye(72, 48, 3.5 * s);
    g.oval(64, 58, 5 * s, 3 * s, [255, 150, 180]);
    if (mega) {
      g.oval(64, 64, 40, 44, [255, 180, 230], { alpha: 50, shade: 0 });
      g.oval(40, 70, 8, 20, [200, 160, 230]);
      g.oval(88, 70, 8, 20, [200, 160, 230]);
    }
  },

  armor_quad(g, stage, mega) {
    const gray = [140, 150, 160];
    const s = 1 + stage * 0.14;
    g.oval(64, 72, 28 * s, 20 * s, gray);
    g.oval(64, 48, 18 * s, 14 * s, gray);
    g.oval(64, 40, 14 * s, 8 * s, tint(gray, 0.75));
    g.eye(54, 48, 3 * s);
    g.eye(72, 48, 3 * s);
    g.oval(40, 88, 8 * s, 7 * s, gray);
    g.oval(88, 88, 8 * s, 7 * s, gray);
    if (stage >= 2) g.oval(64, 58, 24 * s, 10 * s, [90, 100, 110]);
    if (mega) g.oval(64, 64, 44, 40, [255, 210, 100], { alpha: 40, shade: 0 });
  },

  wyvern(g, stage, mega) {
    const blue = [70, 110, 190];
    const red = [200, 70, 70];
    const s = 1 + stage * 0.14;
    if (stage === 0) {
      g.oval(64, 72, 18, 16, blue);
      g.oval(64, 50, 14, 12, blue);
      g.oval(64, 40, 8, 6, red);
      g.eye(56, 48, 3);
      g.eye(70, 48, 3);
    } else if (stage === 1) {
      g.oval(64, 70, 22, 20, whiteish(blue));
      g.oval(64, 50, 16, 14, whiteish(blue));
      g.eye(56, 48, 3);
      g.eye(70, 48, 3);
    } else {
      g.oval(34, 58, 18 * s, 12 * s, red);
      g.oval(94, 58, 18 * s, 12 * s, red);
      g.oval(64, 72, 22 * s, 18 * s, blue);
      g.oval(64, 48, 16 * s, 14 * s, blue);
      g.eye(56, 46, 3.2 * s);
      g.eye(70, 46, 3.2 * s);
      if (mega) g.oval(64, 64, 44, 40, [255, 120, 80], { alpha: 45, shade: 0 });
    }
    function whiteish(c) {
      return mix(c, [230, 230, 235], 0.45);
    }
  },

  seal_ice(g, stage, mega) {
    const blue = [160, 200, 230];
    const s = 1 + stage * 0.14;
    g.oval(64, 78, 26 * s, 20 * s, blue);
    g.oval(64, 52, 18 * s, 16 * s, blue);
    g.oval(64, 58, 10 * s, 6 * s, [255, 255, 255]);
    g.eye(54, 48, 3.2 * s);
    g.eye(72, 48, 3.2 * s);
    if (stage >= 1) g.oval(64, 70, 20 * s, 8 * s, [100, 140, 180]);
    if (stage >= 2) {
      g.oval(40, 44, 8 * s, 6 * s, [240, 240, 250]);
      g.oval(88, 44, 8 * s, 6 * s, [240, 240, 250]);
    }
    if (mega) g.oval(64, 64, 42, 40, [200, 240, 255], { alpha: 50, shade: 0 });
  },

  lynx_electric(g, stage, mega) {
    const blue = [70, 120, 200];
    const yel = [255, 220, 80];
    const s = 1 + stage * 0.12;
    g.oval(64, 78, 20 * s, 18 * s, blue);
    g.oval(64, 52, 16 * s, 14 * s, blue);
    g.oval(50, 34, 5 * s, 10 * s, blue);
    g.oval(78, 34, 5 * s, 10 * s, blue);
    g.oval(50, 28, 5 * s, 4 * s, yel);
    g.oval(78, 28, 5 * s, 4 * s, yel);
    g.eye(56, 50, 3.2 * s);
    g.eye(72, 50, 3.2 * s);
    g.oval(64, 60, 6 * s, 3 * s, [40, 40, 50]);
    g.oval(90, 80, 10 * s, 5 * s, blue);
    if (stage >= 2) g.oval(64, 44, 8 * s, 4 * s, yel);
    if (mega) g.oval(64, 64, 40, 40, [255, 240, 100], { alpha: 50, shade: 0 });
  },

  rayquaza(g, stage, mega) {
    const green = [56, 176, 72];
    const dark = [28, 110, 48];
    const yellow = [248, 204, 40];
    g.oval(34, 100, 20, 9, green);
    g.oval(52, 84, 16, 11, green);
    g.oval(70, 66, 15, 12, green);
    g.oval(88, 46, 16, 11, green);
    g.oval(46, 92, 7, 3, yellow);
    g.oval(64, 74, 7, 3, yellow);
    g.oval(80, 56, 6, 3, yellow);
    g.oval(104, 42, 10, 4, yellow);
    g.oval(98, 48, 6, 2, [190, 40, 36]);
    g.oval(62, 52, 14, 5, dark);
    g.oval(78, 78, 12, 4, dark);
    g.eye(86, 40, 2.4);
    g.eye(96, 38, 2.4);
    if (mega) g.oval(68, 70, 50, 42, [255, 214, 70], { alpha: 46, shade: 0 });
  },
};

/** Map species id → [painterKey, stage 0-3] */
const SPECIES_MAP = {
  scorbunny: ['rabbit_fire', 0],
  raboot: ['rabbit_fire', 1],
  cinderace: ['rabbit_fire', 2],
  mega_cinderace: ['rabbit_fire', 3],
  bulbasaur: ['seed_dino', 0],
  ivysaur: ['seed_dino', 1],
  venusaur: ['seed_dino', 2],
  mega_venusaur: ['seed_dino', 3],
  squirtle: ['turtle', 0],
  wartortle: ['turtle', 1],
  blastoise: ['turtle', 2],
  mega_blastoise: ['turtle', 3],
  pikachu: ['mouse_electric', 0],
  raichu: ['mouse_electric', 1],
  raichu_x: ['mouse_electric', 2],
  mega_raichu: ['mouse_electric', 3],
  geodude: ['rock_arms', 0],
  graveler: ['rock_arms', 1],
  golem: ['rock_arms', 2],
  mega_golem: ['rock_arms', 3],
  charmander: ['lizard_fire', 0],
  charmeleon: ['lizard_fire', 1],
  charizard: ['lizard_fire', 2],
  mega_charizard: ['lizard_fire', 3],
  weedle: ['worm_bug', 0],
  kakuna: ['worm_bug', 1],
  beedrill: ['worm_bug', 2],
  mega_beedrill: ['worm_bug', 3],
  oddish: ['plant_biped', 0],
  gloom: ['plant_biped', 1],
  vileplume: ['plant_biped', 2],
  mega_vileplume: ['plant_biped', 3],
  psyduck: ['duck', 0],
  golduck: ['duck', 1],
  golduck_x: ['duck', 2],
  mega_golduck: ['duck', 3],
  machop: ['muscle', 0],
  machoke: ['muscle', 1],
  machamp: ['muscle', 2],
  mega_machamp: ['muscle', 3],
  magnemite: ['magnet', 0],
  magneton: ['magnet', 1],
  magnezone: ['magnet', 2],
  mega_magnezone: ['magnet', 3],
  vulpix: ['fox_fire', 0],
  ninetales: ['fox_fire', 1],
  ninetales_x: ['fox_fire', 2],
  mega_ninetales: ['fox_fire', 3],
  abra: ['psychic', 0],
  kadabra: ['psychic', 1],
  alakazam: ['psychic', 2],
  mega_alakazam: ['psychic', 3],
  gastly: ['ghost', 0],
  haunter: ['ghost', 1],
  gengar: ['ghost', 2],
  mega_gengar: ['ghost', 3],
  onix: ['serpent_steel', 0],
  steelix: ['serpent_steel', 1],
  steelix_x: ['serpent_steel', 2],
  mega_steelix: ['serpent_steel', 3],
  horsea: ['seahorse', 0],
  seadra: ['seahorse', 1],
  kingdra: ['seahorse', 2],
  mega_kingdra: ['seahorse', 3],
  magikarp: ['fish', 0],
  gyarados: ['fish', 1],
  gyarados_x: ['fish', 2],
  mega_gyarados: ['fish', 3],
  dratini: ['dragon_long', 0],
  dragonair: ['dragon_long', 1],
  dragonite: ['dragon_long', 2],
  mega_dragonite: ['dragon_long', 3],
  chikorita: ['leaf_dino', 0],
  bayleef: ['leaf_dino', 1],
  meganium: ['leaf_dino', 2],
  mega_meganium: ['leaf_dino', 3],
  mudkip: ['mudfish', 0],
  marshtomp: ['mudfish', 1],
  swampert: ['mudfish', 2],
  mega_swampert: ['mudfish', 3],
  ralts: ['fairy_psychic', 0],
  kirlia: ['fairy_psychic', 1],
  gardevoir: ['fairy_psychic', 2],
  mega_gardevoir: ['fairy_psychic', 3],
  aron: ['armor_quad', 0],
  lairon: ['armor_quad', 1],
  aggron: ['armor_quad', 2],
  mega_aggron: ['armor_quad', 3],
  bagon: ['wyvern', 0],
  shelgon: ['wyvern', 1],
  salamence: ['wyvern', 2],
  mega_salamence: ['wyvern', 3],
  spheal: ['seal_ice', 0],
  sealeo: ['seal_ice', 1],
  walrein: ['seal_ice', 2],
  mega_walrein: ['seal_ice', 3],
  shinx: ['lynx_electric', 0],
  luxio: ['lynx_electric', 1],
  luxray: ['lynx_electric', 2],
  mega_luxray: ['lynx_electric', 3],
  mega_rayquaza: ['rayquaza', 3],
};

export { create, tint, mix };

const entry = process.argv[1] || '';
const runAll = entry.endsWith('render-sprites-v2.mjs') || entry.endsWith('pixel-pokemon.mjs');
if (runAll) {
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
const only = process.argv[2];
for (const [id, [key, stage]] of Object.entries(SPECIES_MAP)) {
  if (only && id !== only) continue;
  const g = create();
  g.clear();
  const mega = stage >= 3 || id.startsWith('mega_');
  const st = Math.min(3, stage);
  painters[key](g, st, mega);
  // ground shadow
  for (let x = 30; x < 98; x++) {
    for (let y = 108; y < 118; y++) {
      const dx = (x - 64) / 34;
      const dy = (y - 112) / 5;
      if (dx * dx + dy * dy < 1) g.blend(x, y, 20, 20, 30, 50 * (1 - dx * dx));
    }
  }
  g.save(path.join(OUT, `${id}.png`));
  n += 1;
}
console.log(`rendered ${n} sprites → ${OUT}`);
}
