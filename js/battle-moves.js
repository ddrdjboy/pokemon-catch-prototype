import { SPECIES, typeMultiplier } from './data.js';

export function withBattleState(mon) {
  return {
    ...mon,
    usedUtility: mon.usedUtility ?? false,
    atkMul: mon.atkMul ?? 1,
    defMul: mon.defMul ?? 1,
  };
}

export function speciesMoveList(sp) {
  if (sp?.moves?.length) return sp.moves.map((m) => ({ ...m }));
  return sp?.move ? [{ ...sp.move }] : [];
}

export function applyMoveEffect(mon, move) {
  if (!move?.effect) return null;
  if (mon.usedUtility) return null;
  const next = withBattleState({ ...mon });
  let text = '';
  if (move.effect === 'heal') {
    const gained = Math.floor(next.maxHp * 0.5);
    next.hp = Math.min(next.maxHp, next.hp + gained);
    next.usedUtility = true;
    text = `${SPECIES[next.speciesId].name} 使用了 ${move.name}！回复了 ${gained} 点 HP！`;
  } else if (move.effect === 'atk') {
    next.atkMul = 1.5;
    next.usedUtility = true;
    text = `${SPECIES[next.speciesId].name} 使用了 ${move.name}！攻击提升了！`;
  } else if (move.effect === 'def') {
    next.defMul = 1.5;
    next.usedUtility = true;
    text = `${SPECIES[next.speciesId].name} 使用了 ${move.name}！防御提升了！`;
  } else {
    return null;
  }
  return {
    mon: next,
    log: { text, side: null, moveType: move.type, effect: move.effect, damage: 0 },
  };
}

export function chooseFoeMove(attacker, defender, rng = Math.random) {
  const sp = SPECIES[attacker.speciesId];
  const kit = speciesMoveList(sp);
  const primary = kit[0];
  if (kit.length < 2) return primary;

  const attacks = kit.filter((m) => !m.effect);
  const coverage = attacks[1] || null;
  const heal = kit.find((m) => m.effect === 'heal');
  const buffAtk = kit.find((m) => m.effect === 'atk');
  const buffDef = kit.find((m) => m.effect === 'def');

  if (!attacker.usedUtility && heal && attacker.hp / attacker.maxHp <= 0.4) return heal;

  if (coverage && defender) {
    const covMult = typeMultiplier(coverage.type, SPECIES[defender.speciesId].type);
    const priMult = typeMultiplier(primary.type, SPECIES[defender.speciesId].type);
    if (covMult > 1 && !(priMult > 1)) return coverage;
  }

  // Use the high quartile so tests that pass rng => 0 (crit / first index) do not always buff.
  if (!attacker.usedUtility && (buffAtk || buffDef) && rng() >= 0.75) {
    if (buffAtk && buffDef) {
      const base = sp.base;
      return base.atk >= base.def ? buffAtk : buffDef;
    }
    return buffAtk || buffDef;
  }

  return primary;
}
