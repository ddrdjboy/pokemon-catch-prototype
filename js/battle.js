import { SPECIES, typeMultiplier } from './data.js';

/** Critical hits land when rng() is below this rate (about 1/16). */
export const CRIT_RATE = 1 / 16;
/** Applied after the type multiplier, before the final floor. */
export const CRIT_MULT = 1.5;

/**
 * Damage: max(1, floor(atk * power / def * typeMult * critMult))
 * rng() < CRIT_RATE is a critical hit. Pass a fixed rng in tests.
 */
export function calcDamage(attacker, defender, move, rng = Math.random) {
  const mult = typeMultiplier(move.type, SPECIES[defender.speciesId].type);
  const crit = rng() < CRIT_RATE;
  const raw = Math.floor(
    (attacker.atk * move.power) / Math.max(1, defender.def) * mult * (crit ? CRIT_MULT : 1),
  );
  return { damage: Math.max(1, raw), typeMult: mult, crit };
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
      const hit = calcDamage(p, f, pMove, rng);
      f.hp = Math.max(0, f.hp - hit.damage);
      logs.push({
        text: `${SPECIES[p.speciesId].name} 使用了 ${pMove.name}！${damageClause(hit)}`,
        damage: hit.damage,
        typeMult: hit.typeMult,
        crit: hit.crit,
        moveType: pMove.type,
        side: 'player',
      });
    } else {
      const hit = calcDamage(f, p, fMove, rng);
      p.hp = Math.max(0, p.hp - hit.damage);
      logs.push({
        text: `${SPECIES[f.speciesId].name} 使用了 ${fMove.name}！${damageClause(hit)}`,
        damage: hit.damage,
        typeMult: hit.typeMult,
        crit: hit.crit,
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
 * Player plus computer allies all strike, then the boss casts one non-utility
 * skill into a single target, and any remaining aoe moves across the squad.
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
    const hit = calcDamage(attacker.mon, f, move, rng);
    f.hp = Math.max(0, f.hp - hit.damage);
    const who = attacker.kind === 'ally' ? `电脑的${SPECIES[attacker.mon.speciesId].name}` : SPECIES[attacker.mon.speciesId].name;
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
    const kit = speciesMoves(f.speciesId);
    const heavies = kit.filter((move) => !move.aoe && !move.effect);
    const waves = kit.filter((move) => move.aoe && !move.effect);
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
export function resolveFoeOnlyTurn(player, foe, rng = Math.random) {
  const logs = [];
  const p = { ...player };
  const f = { ...foe };
  if (p.hp > 0 && f.hp > 0) {
    const fMove = SPECIES[f.speciesId].move;
    const hit = calcDamage(f, p, fMove, rng);
    p.hp = Math.max(0, p.hp - hit.damage);
    logs.push({
      text: `${SPECIES[f.speciesId].name} 使用了 ${fMove.name}！${damageClause(hit)}`,
      damage: hit.damage,
      typeMult: hit.typeMult,
      crit: hit.crit,
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
    const heavies = kit.filter((move) => !move.aoe && !move.effect);
    const waves = kit.filter((move) => move.aoe && !move.effect);
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
export function resolveDualTurn(players, foes, rng = Math.random) {
  const team = players.map((mon) => ({ ...mon }));
  const enemy = foes.map((mon) => ({ ...mon }));
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
    const move = SPECIES[actor.mon.speciesId].move;
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
export function resolveDualItemTurn(players, foes, rng = Math.random) {
  const team = players.map((mon) => ({ ...mon }));
  const enemy = foes.map((mon) => ({ ...mon }));
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
    const move = SPECIES[actor.mon.speciesId].move;
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
