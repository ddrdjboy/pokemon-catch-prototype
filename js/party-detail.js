import { xpToNext } from './level.js';

/** Individual fields for the party detail dialog. Null if mon is missing. */
export function partyIndividualView(mon) {
  if (!mon) return null;
  const exp = Number.isFinite(mon.exp) ? mon.exp : 0;
  return {
    level: mon.level,
    hpText: `${mon.hp}/${mon.maxHp}`,
    atk: mon.atk,
    def: mon.def,
    spd: mon.spd,
    expText: `${exp}/${xpToNext(mon.level)}`,
    shiny: !!mon.shiny,
    fainted: (mon.hp ?? 0) <= 0,
  };
}
