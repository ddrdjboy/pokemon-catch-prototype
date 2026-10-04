import { SPECIES, typeMultiplier } from './data.js';

/**
 * Damage: max(1, floor(atk * power / def * typeMult))
 */
export function calcDamage(attacker, defender, move) {
  const mult = typeMultiplier(move.type, SPECIES[defender.speciesId].type);
  const raw = Math.floor((attacker.atk * move.power) / Math.max(1, defender.def) * mult);
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
        side: 'player',
      });
    } else {
      const { damage, typeMult } = calcDamage(f, p, fMove);
      p.hp = Math.max(0, p.hp - damage);
      logs.push({
        text: `${SPECIES[f.speciesId].name} 使用了 ${fMove.name}！造成 ${damage} 点伤害${typeHint(typeMult)}`,
        damage,
        typeMult,
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

/** Deterministic first-striker for tests (speed only; ties prefer player). */
export function whoGoesFirstDeterministic(a, b) {
  if (a.spd >= b.spd) return 'a';
  return 'b';
}
