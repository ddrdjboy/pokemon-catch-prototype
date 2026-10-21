import { SPECIES, typeMultiplier } from './data.js';
import {
  withBattleState,
  applyMoveEffect,
  resolveMoveTargets,
  moveTarget,
  chooseDualFoeCmd,
  speciesMoveList,
} from './battle-moves.js';

/**
 * Damage: max(1, floor(atk * power / def * typeMult))
 */
export function calcDamage(attacker, defender, move) {
  const mult = typeMultiplier(move.type, SPECIES[defender.speciesId].type);
  const atkMul = attacker.atkMul ?? 1;
  const defMul = defender.defMul ?? 1;
  const raw = Math.floor(
    (attacker.atk * atkMul * move.power) / Math.max(1, defender.def * defMul) * mult,
  );
  return { damage: Math.max(1, raw), typeMult: mult };
}

export function whoGoesFirst(a, b) {
  if (a.spd > b.spd) return 'a';
  if (b.spd > a.spd) return 'b';
  return Math.random() < 0.5 ? 'a' : 'b';
}

/**
 * Resolve one full turn: both sides attack if still conscious.
 * Returns log lines and updated hp on copies.
 */
export function resolveTurn(player, foe, rng = Math.random) {
  const logs = [];
  const p = { ...player };
  const f = { ...foe };
  const pMove = SPECIES[p.speciesId].move;
  const fMove = SPECIES[f.speciesId].move;

  const order = whoGoesFirst(p, f) === 'a' ? ['player', 'foe'] : ['foe', 'player'];

  for (const side of order) {
    if (p.hp <= 0 || f.hp <= 0) break;
    if (side === 'player') {
      const { damage, typeMult } = calcDamage(p, f, pMove);
      f.hp = Math.max(0, f.hp - damage);
      logs.push({
        text: `${SPECIES[p.speciesId].name} 使用了 ${pMove.name}！造成 ${damage} 点伤害${typeHint(typeMult)}`,
        damage,
        typeMult,
        moveType: pMove.type,
        side: 'player',
      });
    } else {
      const { damage, typeMult } = calcDamage(f, p, fMove);
      p.hp = Math.max(0, p.hp - damage);
      logs.push({
        text: `${SPECIES[f.speciesId].name} 使用了 ${fMove.name}！造成 ${damage} 点伤害${typeHint(typeMult)}`,
        damage,
        typeMult,
        moveType: fMove.type,
        side: 'foe',
      });
    }
  }

  let result = 'ongoing';
  if (f.hp <= 0 && p.hp <= 0) result = 'draw';
  else if (f.hp <= 0) result = 'win';
  else if (p.hp <= 0) result = 'lose';

  return { player: p, foe: f, logs, result };
}

function speciesMoves(speciesId) {
  const sp = SPECIES[speciesId];
  return sp.moves?.length ? sp.moves : [sp.move];
}

/**
 * Player plus computer allies all strike, then the boss casts its kit:
 * one heavy skill into a single target, then 空气斩 across the squad.
 */
export function resolveSquadTurn(player, allies, foe, rng = Math.random) {
  const p = { ...player };
  const team = allies.map((ally) => ({ ...ally }));
  const f = { ...foe };
  const logs = [];

  const attackers = [
    { kind: 'player', mon: p },
    ...team.map((mon, index) => ({ kind: 'ally', mon, index })),
  ].filter((a) => a.mon.hp > 0);

  for (const attacker of attackers) {
    if (f.hp <= 0) break;
    const move = SPECIES[attacker.mon.speciesId].move;
    const { damage, typeMult } = calcDamage(attacker.mon, f, move);
    f.hp = Math.max(0, f.hp - damage);
    const who = attacker.kind === 'ally' ? `电脑的${SPECIES[attacker.mon.speciesId].name}` : SPECIES[attacker.mon.speciesId].name;
    logs.push({
      text: `${who} 使用了 ${move.name}！造成 ${damage} 点伤害${typeHint(typeMult)}`,
      damage,
      typeMult,
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
    const kit = speciesMoves(f.speciesId);
    const heavies = kit.filter((move) => !move.aoe);
    const waves = kit.filter((move) => move.aoe);
    const heavy = heavies[Math.min(heavies.length - 1, Math.floor(rng() * heavies.length))] || kit[0];
    castBossMove(f, heavy, living(), logs, rng);
    if (living().length) {
      for (const wave of waves) castBossMove(f, wave, living(), logs, rng);
    }
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
export function resolveFoeOnlyTurn(player, foe) {
  const logs = [];
  const p = { ...player };
  const f = { ...foe };
  if (p.hp > 0 && f.hp > 0) {
    const fMove = SPECIES[f.speciesId].move;
    const { damage, typeMult } = calcDamage(f, p, fMove);
    p.hp = Math.max(0, p.hp - damage);
    logs.push({
      text: `${SPECIES[f.speciesId].name} 使用了 ${fMove.name}！造成 ${damage} 点伤害${typeHint(typeMult)}`,
      damage,
      typeMult,
      moveType: fMove.type,
      side: 'foe',
    });
  }

  let result = 'ongoing';
  if (f.hp <= 0 && p.hp <= 0) result = 'draw';
  else if (f.hp <= 0) result = 'win';
  else if (p.hp <= 0) result = 'lose';

  return { player: p, foe: f, logs, result };
}

/**
 * Item turn in a squad raid: player/allies skip attacking; boss still uses its kit.
 */
export function resolveSquadItemTurn(player, allies, foe, rng = Math.random) {
  const p = { ...player };
  const team = allies.map((ally) => ({ ...ally }));
  const f = { ...foe };
  const logs = [];

  const living = () => [
    { kind: 'player', mon: p },
    ...team.map((mon, index) => ({ kind: 'ally', mon, index })),
  ].filter((a) => a.mon.hp > 0);

  if (f.hp > 0 && living().length) {
    const kit = speciesMoves(f.speciesId);
    const heavies = kit.filter((move) => !move.aoe);
    const waves = kit.filter((move) => move.aoe);
    const heavy = heavies[Math.min(heavies.length - 1, Math.floor(rng() * heavies.length))] || kit[0];
    castBossMove(f, heavy, living(), logs, rng);
    if (living().length) {
      for (const wave of waves) castBossMove(f, wave, living(), logs, rng);
    }
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

function castBossMove(foe, move, squad, logs, rng) {
  const targets = move.aoe ? squad : [squad[Math.min(squad.length - 1, Math.floor(rng() * squad.length))]];
  for (const target of targets) {
    if (target.mon.hp <= 0) continue;
    const hit = calcDamage(foe, target.mon, move);
    target.mon.hp = Math.max(0, target.mon.hp - hit.damage);
    const who = target.kind === 'ally' ? `电脑的${SPECIES[target.mon.speciesId].name}` : SPECIES[target.mon.speciesId].name;
    const wave = move.aoe ? '横扫' : '打向';
    logs.push({
      text: `${SPECIES[foe.speciesId].name} 使用了 ${move.name}！${wave}${who}，造成 ${hit.damage} 点伤害${typeHint(hit.typeMult)}`,
      damage: hit.damage,
      typeMult: hit.typeMult,
      moveType: move.type,
      side: 'foe',
      target: target.kind,
      allyIndex: target.index,
    });
  }
}

function typeHint(mult) {
  if (mult > 1) return '（效果拔群！）';
  if (mult < 1) return '（效果不佳…）';
  return '';
}

function defaultDualCmds(sideMons, side, opponents, rng) {
  return sideMons.map((mon, index) => {
    if (!mon || mon.hp <= 0) return null;
    if (side === 'foe') return chooseDualFoeCmd(withBattleState(mon), index, opponents, rng);
    const move = speciesMoveList(SPECIES[mon.speciesId])[0];
    return { type: 'move', move, targetSide: 'foe', targetIndex: index };
  });
}

/**
 * True 2v2: living players and foes act in speed order from move/switch commands.
 */
export function resolveDualTurn(players, foes, rng = Math.random, playerCmds, foeCmds) {
  const team = players.map((mon) => withBattleState({ ...mon }));
  const enemy = foes.map((mon) => withBattleState({ ...mon }));
  const logs = [];
  const pCmds = playerCmds || defaultDualCmds(team, 'player', enemy, rng);
  const fCmds = foeCmds || defaultDualCmds(enemy, 'foe', team, rng);

  const livingPlayers = () => team.map((mon, index) => ({ side: 'player', index, mon })).filter((u) => u.mon.hp > 0);
  const livingFoes = () => enemy.map((mon, index) => ({ side: 'foe', index, mon })).filter((u) => u.mon.hp > 0);

  const actors = [...livingPlayers(), ...livingFoes()]
    .filter((a) => {
      const cmd = a.side === 'player' ? pCmds[a.index] : fCmds[a.index];
      return cmd && cmd.type === 'move';
    })
    .sort((a, b) => {
      if (b.mon.spd !== a.mon.spd) return b.mon.spd - a.mon.spd;
      if (a.side !== b.side) return a.side === 'player' ? -1 : 1;
      return a.index - b.index;
    });

  for (const actor of actors) {
    const sideArr = actor.side === 'player' ? team : enemy;
    actor.mon = sideArr[actor.index];
    if (actor.mon.hp <= 0) continue;
    const cmd = actor.side === 'player' ? pCmds[actor.index] : fCmds[actor.index];
    if (!cmd || cmd.type !== 'move') continue;

    if (cmd.move.effect) {
      const applied = applyMoveEffect(actor.mon, cmd.move);
      if (!applied) continue;
      sideArr[actor.index] = applied.mon;
      logs.push({
        ...applied.log,
        side: actor.side,
        actorIndex: actor.index,
        targetIndex: actor.index,
      });
      continue;
    }

    const targets = resolveMoveTargets(actor, cmd, team, enemy);
    if (!targets.length) continue;
    const atkName = SPECIES[actor.mon.speciesId].name;
    const wave = moveTarget(cmd.move) === 'foes' || moveTarget(cmd.move) === 'allies';
    for (const t of targets) {
      const defArr = t.side === 'player' ? team : enemy;
      const { damage, typeMult } = calcDamage(actor.mon, t.mon, cmd.move);
      defArr[t.index].hp = Math.max(0, defArr[t.index].hp - damage);
      const defName = SPECIES[t.mon.speciesId].name;
      logs.push({
        text: `${atkName} 使用了 ${cmd.move.name}！${wave ? '横扫' : '打向'}${defName}，造成 ${damage} 点伤害${typeHint(typeMult)}`,
        damage,
        typeMult,
        moveType: cmd.move.type,
        side: actor.side,
        actorIndex: actor.index,
        targetIndex: t.index,
      });
    }
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
export function resolveDualItemTurn(players, foes, rng = Math.random, foeCmds) {
  const team = players.map((mon) => withBattleState({ ...mon }));
  const enemy = foes.map((mon) => withBattleState({ ...mon }));
  const fCmds = foeCmds || defaultDualCmds(enemy, 'foe', team, rng);
  return resolveDualTurn(team, enemy, rng, team.map(() => ({ type: 'switch' })), fCmds);
}

/** Deterministic first-striker for tests (speed only; ties prefer player). */
export function whoGoesFirstDeterministic(a, b) {
  if (a.spd >= b.spd) return 'a';
  return 'b';
}
