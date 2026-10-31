import { speciesMoveList } from './battle-moves.js';

export const FORMATION_FIELD_CAP = 5;
export const FORMATION_SKILL_CAP = 3;

export function defaultLoadout(sp) {
  const kit = speciesMoveList(sp);
  const basic = kit[0];
  const skills = kit.slice(1, 1 + FORMATION_SKILL_CAP);
  return {
    basicMoveName: basic?.name || '',
    skillMoveNames: skills.map((m) => m.name),
  };
}

export function normalizeLoadout(mon, sp) {
  const kit = speciesMoveList(sp);
  const byName = new Map(kit.map((m) => [m.name, m]));
  const raw = mon?.loadout && typeof mon.loadout === 'object' ? mon.loadout : null;
  const fallback = defaultLoadout(sp);
  let basicMoveName = raw?.basicMoveName;
  if (!basicMoveName || !byName.has(basicMoveName)) basicMoveName = fallback.basicMoveName;
  const skillMoveNames = [];
  const seen = new Set([basicMoveName]);
  for (const name of raw?.skillMoveNames || fallback.skillMoveNames) {
    if (!byName.has(name) || seen.has(name)) continue;
    skillMoveNames.push(name);
    seen.add(name);
    if (skillMoveNames.length >= FORMATION_SKILL_CAP) break;
  }
  return { basicMoveName, skillMoveNames };
}

export function ensureLoadout(mon, sp) {
  const next = normalizeLoadout(mon, sp);
  mon.loadout = next;
  return next;
}

export function basicMoveFor(mon, sp) {
  const loadout = normalizeLoadout(mon, sp);
  const kit = speciesMoveList(sp);
  return kit.find((m) => m.name === loadout.basicMoveName) || kit[0] || null;
}

export function skillMovesFor(mon, sp) {
  const loadout = normalizeLoadout(mon, sp);
  const kit = speciesMoveList(sp);
  const byName = new Map(kit.map((m) => [m.name, m]));
  return loadout.skillMoveNames.map((n) => byName.get(n)).filter(Boolean);
}

/** Apply a player-edited loadout; returns normalized result or null if basic invalid. */
export function applyLoadoutEdit(mon, sp, { basicMoveName, skillMoveNames }) {
  const kit = speciesMoveList(sp);
  const names = new Set(kit.map((m) => m.name));
  if (!names.has(basicMoveName)) return null;
  const skills = [];
  const seen = new Set([basicMoveName]);
  for (const name of skillMoveNames || []) {
    if (!names.has(name) || seen.has(name)) continue;
    skills.push(name);
    seen.add(name);
    if (skills.length >= FORMATION_SKILL_CAP) break;
  }
  mon.loadout = { basicMoveName, skillMoveNames: skills };
  return mon.loadout;
}
