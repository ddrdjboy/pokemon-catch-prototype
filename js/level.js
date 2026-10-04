import { SPECIES, statsFor } from './data.js';

export const EVOLVE_LEVEL = 8;
export const EVOLVE_LEVEL_2 = 16;
export const EVOLVE_LEVEL_MEGA = 24;

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level) {
  return 30 + level * 20;
}

/** XP earned for defeating a foe. */
export function xpReward(foe, { trainer = false } = {}) {
  let xp = foe.level * 40;
  if (trainer) xp = Math.floor(xp * 1.5);
  if (foe.boss) xp = Math.floor(xp * 1.5);
  return Math.max(1, xp);
}

export function applyStats(mon) {
  const stats = statsFor(mon.speciesId, mon.level, mon.boss);
  mon.maxHp = stats.hp;
  mon.hp = stats.hp;
  mon.atk = stats.atk;
  mon.def = stats.def;
  mon.spd = stats.spd;
  return mon;
}

/**
 * Evolve as many times as level allows (8 → 16 → 24 mega).
 * Returns list of messages (may be empty).
 */
export function tryEvolve(mon) {
  const messages = [];
  while (true) {
    const sp = SPECIES[mon.speciesId];
    if (!sp?.evolvesTo) break;
    const need = sp.evolveLevel ?? EVOLVE_LEVEL;
    if (mon.level < need) break;
    const next = SPECIES[sp.evolvesTo];
    if (!next) break;
    const fromName = sp.name;
    mon.speciesId = next.id;
    applyStats(mon);
    const kind = next.mega ? '超级进化' : '进化';
    messages.push(`${fromName} ${kind}成了 ${next.name}！`);
  }
  return messages;
}

/**
 * Add XP, level up as needed, then try evolution chain.
 * Mutates mon. Returns log lines.
 */
export function gainExperience(mon, amount) {
  const logs = [];
  if (!Number.isFinite(mon.exp)) mon.exp = 0;
  mon.exp += amount;
  logs.push(`${SPECIES[mon.speciesId].name} 获得了 ${amount} 点经验！`);

  while (mon.exp >= xpToNext(mon.level)) {
    mon.exp -= xpToNext(mon.level);
    mon.level += 1;
    applyStats(mon);
    logs.push(`${SPECIES[mon.speciesId].name} 升到了 Lv.${mon.level}！`);
    for (const msg of tryEvolve(mon)) logs.push(msg);
  }

  // Also evolve if already high enough (e.g. caught high level)
  for (const msg of tryEvolve(mon)) logs.push(msg);
  return logs;
}
