import { SPECIES, typeMultiplier } from './data.js';
import { moveRange } from './move-range.js';

export function withBattleState(mon) {
  return {
    ...mon,
    usedUtility: mon.usedUtility ?? false,
    atkMul: mon.atkMul ?? 1,
    defMul: mon.defMul ?? 1,
  };
}

function withMoveRange(move) {
  const next = { ...move };
  const range = moveRange(next);
  if (range) next.range = range;
  return next;
}

export function speciesMoveList(sp) {
  if (sp?.moves?.length) return sp.moves.map(withMoveRange);
  return sp?.move ? [withMoveRange(sp.move)] : [];
}

export function moveTarget(move) {
  if (move?.target) return move.target;
  if (move?.effect) return 'self';
  return 'foe';
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

function livingOn(sideArr, sideName) {
  return sideArr
    .map((mon, index) => ({ side: sideName, index, mon }))
    .filter((u) => u.mon && u.mon.hp > 0);
}

/**
 * Resolve concrete targets for a move command at execution time.
 * cmd: { type:'move', move, targetSide, targetIndex }
 */
export function resolveMoveTargets(actor, cmd, players, foes) {
  const move = cmd.move;
  const kind = moveTarget(move);
  const allies = actor.side === 'player' ? players : foes;
  const enemies = actor.side === 'player' ? foes : players;
  const allySide = actor.side;
  const enemySide = actor.side === 'player' ? 'foe' : 'player';

  if (kind === 'self') {
    const self = allies[actor.index];
    return self?.hp > 0 ? [{ side: allySide, index: actor.index, mon: self }] : [];
  }
  if (kind === 'allies') return livingOn(allies, allySide);
  if (kind === 'foes') return livingOn(enemies, enemySide);
  if (kind === 'ally') {
    const list = livingOn(allies, allySide);
    const preferred = list.find((t) => t.index === cmd.targetIndex) || list[0];
    return preferred ? [preferred] : [];
  }
  const list = livingOn(enemies, enemySide);
  const preferred = list.find((t) => t.index === cmd.targetIndex) || list[0];
  return preferred ? [preferred] : [];
}

function preferredFoeIndex(attackerIndex, foes, move) {
  const living = foes
    .map((mon, index) => ({ mon, index }))
    .filter((t) => t.mon.hp > 0);
  if (!living.length) return 0;
  const same = living.find((t) => t.index === attackerIndex);
  if (living.length === 1) return living[0].index;
  if (!same) return living[0].index;
  const other = living.find((t) => t.index !== attackerIndex);
  if (!other) return same.index;
  const a = typeMultiplier(move.type, SPECIES[same.mon.speciesId].type);
  const b = typeMultiplier(move.type, SPECIES[other.mon.speciesId].type);
  if (b > a) return other.index;
  return same.index;
}

export function chooseDualFoeCmd(attacker, attackerIndex, players, rng = Math.random) {
  const kit = speciesMoveList(SPECIES[attacker.speciesId]);
  const primary = kit[0];
  const attacks = kit.filter((m) => !m.effect);
  const coverage = attacks[1] || null;
  const heal = kit.find((m) => m.effect === 'heal');
  const buffAtk = kit.find((m) => m.effect === 'atk');
  const buffDef = kit.find((m) => m.effect === 'def');

  let move = primary;
  if (!attacker.usedUtility && heal && attacker.hp / attacker.maxHp <= 0.4) {
    move = heal;
  } else {
    const trial = coverage || primary;
    const prefIdx = preferredFoeIndex(attackerIndex, players, trial);
    const defender = players[prefIdx];
    if (coverage && defender) {
      const covMult = typeMultiplier(coverage.type, SPECIES[defender.speciesId].type);
      const priMult = typeMultiplier(primary.type, SPECIES[defender.speciesId].type);
      if (covMult > 1 && !(priMult > 1)) move = coverage;
    }
    if (move === primary && !attacker.usedUtility && (buffAtk || buffDef) && rng() < 0.25) {
      const base = SPECIES[attacker.speciesId].base;
      move = buffAtk && buffDef
        ? (base.atk >= base.def ? buffAtk : buffDef)
        : (buffAtk || buffDef);
    }
  }

  const kind = moveTarget(move);
  if (kind === 'self' || kind === 'ally' || kind === 'allies') {
    return {
      type: 'move',
      move,
      targetSide: 'foe',
      targetIndex: attackerIndex,
    };
  }
  const targetIndex = preferredFoeIndex(attackerIndex, players, move);
  return {
    type: 'move',
    move,
    targetSide: 'player',
    targetIndex,
  };
}
