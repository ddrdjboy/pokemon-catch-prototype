import { SPECIES, typeMultiplier } from './data.js';
import {
  withBattleState,
  applyMoveEffect,
  chooseFoeMove,
  speciesMoveList,
} from './battle-moves.js';

/** Critical hits land when rng() is below this rate (about 1/16). */
export const CRIT_RATE = 1 / 16;
/** Applied after the type multiplier, before the final floor. */
export const CRIT_MULT = 1.5;

/**
 * Damage: max(1, floor(atk * atkMul * power / (def * defMul) * typeMult * critMult))
 * rng() < CRIT_RATE is a critical hit. Pass a fixed rng in tests.
 */
export function calcDamage(attacker, defender, move, rng = Math.random) {
  const mult = typeMultiplier(move.type, SPECIES[defender.speciesId].type);
  const crit = rng() < CRIT_RATE;
  const atkMul = attacker.atkMul ?? 1;
  const defMul = defender.defMul ?? 1;
  const raw = Math.floor(
    (attacker.atk * atkMul * move.power) / Math.max(1, defender.def * defMul) * mult * (crit ? CRIT_MULT : 1),
  );
  return { damage: Math.max(1, raw), typeMult: mult, crit };
}

export function whoGoesFirst(a, b) {
  if (a.spd > b.spd) return 'a';
  if (b.spd > a.spd) return 'b';
  return Math.random() < 0.5 ? 'a' : 'b';
}

function primaryMove(speciesId) {
  return SPECIES[speciesId].move;
}

function resolveMoveForActor(self, target, move, rng, side, extra = {}) {
  let chosen = move || primaryMove(self.speciesId);
  if (chosen.effect) {
    const applied = applyMoveEffect(self, chosen);
    if (applied) {
      Object.assign(self, applied.mon);
      return { ...applied.log, side, ...extra };
    }
    chosen = primaryMove(self.speciesId);
  }
  const hit = calcDamage(self, target, chosen, rng);
  target.hp = Math.max(0, target.hp - hit.damage);
  return {
    text: `${SPECIES[self.speciesId].name} 使用了 ${chosen.name}！${damageClause(hit)}`,
    damage: hit.damage,
    typeMult: hit.typeMult,
    crit: hit.crit,
    moveType: chosen.type,
    side,
    ...extra,
  };
}

/**
 * Resolve one full turn: both sides act if still conscious.
 * Optional playerMove / foeMove; foe defaults to chooseFoeMove.
 */
export function resolveTurn(player, foe, rng = Math.random, playerMove, foeMove) {
  const logs = [];
  const p = withBattleState({ ...player });
  const f = withBattleState({ ...foe });
  const pMove = playerMove || primaryMove(p.speciesId);
  const fMove = foeMove || chooseFoeMove(f, p, rng);

  const order = whoGoesFirst(p, f) === 'a' ? ['player', 'foe'] : ['foe', 'player'];

  for (const side of order) {
    if (p.hp <= 0 || f.hp <= 0) break;
    if (side === 'player') {
      logs.push(resolveMoveForActor(p, f, pMove, rng, 'player'));
    } else {
      logs.push(resolveMoveForActor(f, p, fMove, rng, 'foe'));
    }
  }

  let result = 'ongoing';
  if (f.hp <= 0 && p.hp <= 0) result = 'draw';
  else if (f.hp <= 0) result = 'win';
  else if (p.hp <= 0) result = 'lose';

  return { player: p, foe: f, logs, result };
}

function castBossMove(foe, move, squad, logs, rng) {
  if (move?.effect) {
    const applied = applyMoveEffect(foe, move);
    if (applied) {
      Object.assign(foe, applied.mon);
      logs.push({ ...applied.log, side: 'foe' });
      return;
    }
    move = primaryMove(foe.speciesId);
  }
  const targets = move.aoe ? squad : [squad[Math.min(squad.length - 1, Math.floor(rng() * squad.length))]];
  for (const target of targets) {
    if (target.mon.hp <= 0) continue;
    const hit = calcDamage(foe, target.mon, move, rng);
    target.mon.hp = Math.max(0, target.mon.hp - hit.damage);
    const who = target.kind === 'ally' ? `电脑的${SPECIES[target.mon.speciesId].name}` : SPECIES[target.mon.speciesId].name;
    const wave = move.aoe ? '横扫' : '打向';
    logs.push({
      text: `${SPECIES[foe.speciesId].name} 使用了 ${move.name}！${wave}${who}，${damageClause(hit)}`,
      damage: hit.damage,
      typeMult: hit.typeMult,
      crit: hit.crit,
      moveType: move.type,
      side: 'foe',
      target: target.kind,
      allyIndex: target.index,
    });
  }
}

/**
 * Player plus computer allies all strike, then the boss casts its chosen move.
 */
export function resolveSquadTurn(player, allies, foe, rng = Math.random, playerMove, foeMove) {
  const p = withBattleState({ ...player });
  const team = allies.map((ally) => withBattleState({ ...ally }));
  const f = withBattleState({ ...foe });
  const logs = [];
  const pMove = playerMove || primaryMove(p.speciesId);

  const attackers = [
    { kind: 'player', mon: p, move: pMove },
    ...team.map((mon, index) => ({ kind: 'ally', mon, index, move: primaryMove(mon.speciesId) })),
  ].filter((a) => a.mon.hp > 0);

  for (const attacker of attackers) {
    if (f.hp <= 0) break;
    const who = attacker.kind === 'ally' ? `电脑的${SPECIES[attacker.mon.speciesId].name}` : SPECIES[attacker.mon.speciesId].name;
    let move = attacker.move;
    if (move?.effect) {
      const applied = applyMoveEffect(attacker.mon, move);
      if (applied) {
        Object.assign(attacker.mon, applied.mon);
        logs.push({
          ...applied.log,
          text: applied.log.text.replace(SPECIES[attacker.mon.speciesId].name, who),
          side: attacker.kind === 'player' ? 'player' : 'ally',
          allyIndex: attacker.index,
        });
        continue;
      }
      move = primaryMove(attacker.mon.speciesId);
    }
    const hit = calcDamage(attacker.mon, f, move, rng);
    f.hp = Math.max(0, f.hp - hit.damage);
    logs.push({
      text: `${who} 使用了 ${move.name}！${damageClause(hit)}`,
      damage: hit.damage,
      typeMult: hit.typeMult,
      crit: hit.crit,
      moveType: move.type,
      side: attacker.kind === 'player' ? 'player' : 'ally',
      allyIndex: attacker.index,
    });
  }

  const living = () => [
    { kind: 'player', mon: p },
    ...team.map((mon, index) => ({ kind: 'ally', mon, index })),
  ].filter((a) => a.mon.hp > 0);

  if (f.hp > 0 && living().length) {
    const bossMove = foeMove || chooseFoeMove(f, p, rng);
    castBossMove(f, bossMove, living(), logs, rng);
  }

  const alliesUp = team.some((ally) => ally.hp > 0);
  let result = 'ongoing';
  if (f.hp <= 0) result = 'win';
  else if (p.hp <= 0 && alliesUp) result = 'switch';
  else if (p.hp <= 0) result = 'lose';

  return { player: p, allies: team, foe: f, logs, result };
}

/**
 * Player used an item this turn: only the foe attacks.
 */
export function resolveFoeOnlyTurn(player, foe, rng = Math.random, foeMove) {
  const logs = [];
  const p = withBattleState({ ...player });
  const f = withBattleState({ ...foe });
  if (p.hp > 0 && f.hp > 0) {
    const fMove = foeMove || chooseFoeMove(f, p, rng);
    logs.push(resolveMoveForActor(f, p, fMove, rng, 'foe'));
  }

  let result = 'ongoing';
  if (f.hp <= 0 && p.hp <= 0) result = 'draw';
  else if (f.hp <= 0) result = 'win';
  else if (p.hp <= 0) result = 'lose';

  return { player: p, foe: f, logs, result };
}

/**
 * Item turn in a squad raid: player/allies skip attacking; boss still acts.
 */
export function resolveSquadItemTurn(player, allies, foe, rng = Math.random, foeMove) {
  const p = withBattleState({ ...player });
  const team = allies.map((ally) => withBattleState({ ...ally }));
  const f = withBattleState({ ...foe });
  const logs = [];

  const living = () => [
    { kind: 'player', mon: p },
    ...team.map((mon, index) => ({ kind: 'ally', mon, index })),
  ].filter((a) => a.mon.hp > 0);

  if (f.hp > 0 && living().length) {
    const bossMove = foeMove || chooseFoeMove(f, p, rng);
    castBossMove(f, bossMove, living(), logs, rng);
  }

  const alliesUp = team.some((ally) => ally.hp > 0);
  let result = 'ongoing';
  if (f.hp <= 0) result = 'win';
  else if (p.hp <= 0 && alliesUp) result = 'switch';
  else if (p.hp <= 0) result = 'lose';

  return { player: p, allies: team, foe: f, logs, result };
}

/**
 * What happens after a turn once someone may have fainted.
 * foeRemaining: trainer Pokémon not yet sent. playerBackup: conscious party
 * members other than the one that just fainted.
 */
export function nextBattleStep({ result, foeRemaining, playerBackup }) {
  if (result === 'ongoing') return 'continue';
  if (result === 'win') return foeRemaining > 0 ? 'send-foe' : 'victory';
  if (result === 'lose') return playerBackup > 0 ? 'send-player' : 'defeat';
  if (playerBackup <= 0) return 'defeat';
  if (foeRemaining <= 0) return 'victory';
  return 'send-both';
}

function typeHint(mult) {
  if (mult > 1) return '（效果拔群！）';
  if (mult < 1) return '（效果不佳…）';
  return '';
}

function damageClause(hit) {
  return `造成 ${hit.damage} 点伤害${typeHint(hit.typeMult)}${hit.crit ? '会心一击！' : ''}`;
}

/**
 * True 2v2: living players and foes act in speed order each turn.
 * Prefer same-slot targets; fall back to the first living opponent.
 */
export function resolveDualTurn(players, foes, rng = Math.random, playerMoves, foeMoves) {
  const team = players.map((mon) => withBattleState({ ...mon }));
  const enemy = foes.map((mon) => withBattleState({ ...mon }));
  const logs = [];

  const livingPlayers = () => team
    .map((mon, index) => ({ side: 'player', index, mon }))
    .filter((u) => u.mon.hp > 0);
  const livingFoes = () => enemy
    .map((mon, index) => ({ side: 'foe', index, mon }))
    .filter((u) => u.mon.hp > 0);

  const actors = [...livingPlayers(), ...livingFoes()]
    .sort((a, b) => {
      if (b.mon.spd !== a.mon.spd) return b.mon.spd - a.mon.spd;
      if (a.side !== b.side) return a.side === 'player' ? -1 : 1;
      return a.index - b.index;
    });

  for (const actor of actors) {
    if (actor.mon.hp <= 0) continue;
    const targets = actor.side === 'player' ? livingFoes() : livingPlayers();
    if (!targets.length) break;
    const preferred = targets.find((t) => t.index === actor.index) || targets[0];
    const list = actor.side === 'player' ? playerMoves : foeMoves;
    let move = list?.[actor.index];
    if (!move) {
      move = actor.side === 'player'
        ? primaryMove(actor.mon.speciesId)
        : chooseFoeMove(actor.mon, preferred.mon, rng);
    }
    if (move.effect) {
      const applied = applyMoveEffect(actor.mon, move);
      if (applied) {
        Object.assign(actor.mon, applied.mon);
        logs.push({
          ...applied.log,
          side: actor.side,
          actorIndex: actor.index,
        });
        continue;
      }
      move = primaryMove(actor.mon.speciesId);
    }
    const hit = calcDamage(actor.mon, preferred.mon, move, rng);
    preferred.mon.hp = Math.max(0, preferred.mon.hp - hit.damage);
    const atkName = SPECIES[actor.mon.speciesId].name;
    const defName = SPECIES[preferred.mon.speciesId].name;
    logs.push({
      text: `${atkName} 使用了 ${move.name}！打向${defName}，${damageClause(hit)}`,
      damage: hit.damage,
      typeMult: hit.typeMult,
      crit: hit.crit,
      moveType: move.type,
      side: actor.side,
      actorIndex: actor.index,
      targetIndex: preferred.index,
    });
  }

  const playersUp = livingPlayers().length;
  const foesUp = livingFoes().length;
  let result = 'ongoing';
  if (foesUp <= 0 && playersUp <= 0) result = 'draw';
  else if (foesUp <= 0) result = 'win';
  else if (playersUp <= 0) result = 'lose';
  else if (team.some((mon) => mon.hp <= 0)) result = 'switch';

  return { players: team, foes: enemy, logs, result };
}

/**
 * Dual item turn: players skip attacking; living foes still strike.
 */
export function resolveDualItemTurn(players, foes, rng = Math.random, foeMoves) {
  const team = players.map((mon) => withBattleState({ ...mon }));
  const enemy = foes.map((mon) => withBattleState({ ...mon }));
  const logs = [];

  const livingPlayers = () => team
    .map((mon, index) => ({ side: 'player', index, mon }))
    .filter((u) => u.mon.hp > 0);
  const livingFoes = () => enemy
    .map((mon, index) => ({ side: 'foe', index, mon }))
    .filter((u) => u.mon.hp > 0);

  const actors = livingFoes()
    .sort((a, b) => {
      if (b.mon.spd !== a.mon.spd) return b.mon.spd - a.mon.spd;
      return a.index - b.index;
    });

  for (const actor of actors) {
    if (actor.mon.hp <= 0) continue;
    const targets = livingPlayers();
    if (!targets.length) break;
    const preferred = targets.find((t) => t.index === actor.index) || targets[0];
    let move = foeMoves?.[actor.index] || chooseFoeMove(actor.mon, preferred.mon, rng);
    if (move.effect) {
      const applied = applyMoveEffect(actor.mon, move);
      if (applied) {
        Object.assign(actor.mon, applied.mon);
        logs.push({
          ...applied.log,
          side: 'foe',
          actorIndex: actor.index,
        });
        continue;
      }
      move = primaryMove(actor.mon.speciesId);
    }
    const hit = calcDamage(actor.mon, preferred.mon, move, rng);
    preferred.mon.hp = Math.max(0, preferred.mon.hp - hit.damage);
    const atkName = SPECIES[actor.mon.speciesId].name;
    const defName = SPECIES[preferred.mon.speciesId].name;
    logs.push({
      text: `${atkName} 使用了 ${move.name}！打向${defName}，${damageClause(hit)}`,
      damage: hit.damage,
      typeMult: hit.typeMult,
      crit: hit.crit,
      moveType: move.type,
      side: 'foe',
      actorIndex: actor.index,
      targetIndex: preferred.index,
    });
  }

  const playersUp = livingPlayers().length;
  const foesUp = livingFoes().length;
  let result = 'ongoing';
  if (foesUp <= 0 && playersUp <= 0) result = 'draw';
  else if (foesUp <= 0) result = 'win';
  else if (playersUp <= 0) result = 'lose';
  else if (team.some((mon) => mon.hp <= 0)) result = 'switch';

  return { players: team, foes: enemy, logs, result };
}

/** Deterministic first-striker for tests (speed only; ties prefer player). */
export function whoGoesFirstDeterministic(a, b) {
  if (a.spd >= b.spd) return 'a';
  return 'b';
}

export { speciesMoveList };
