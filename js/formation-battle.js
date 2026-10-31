import { SPECIES } from './data.js';
import { calcDamage } from './battle.js';
import { withBattleState, applyMoveEffect, chooseFoeMove } from './battle-moves.js';
import {
  FORMATION_FIELD_CAP,
  basicMoveFor,
  skillMovesFor,
  ensureLoadout,
} from './loadout.js';

export { FORMATION_FIELD_CAP };

/** Conscious party members in order, up to FORMATION_FIELD_CAP. */
export function fieldParty(party, cap = FORMATION_FIELD_CAP) {
  const out = [];
  for (const mon of party || []) {
    if ((mon.hp ?? 0) <= 0) continue;
    out.push(mon);
    if (out.length >= cap) break;
  }
  return out;
}

export function formationSideResult(players, foes) {
  const pUp = (players || []).some((m) => m.hp > 0);
  const fUp = (foes || []).some((m) => m.hp > 0);
  if (!pUp && !fUp) return 'draw';
  if (!fUp) return 'win';
  if (!pUp) return 'lose';
  return 'ongoing';
}

function findByUid(list, uid) {
  return (list || []).find((m) => m.uid === uid) || null;
}

function firstLiving(list, preferUid) {
  if (preferUid) {
    const t = findByUid(list, preferUid);
    if (t && t.hp > 0) return t;
  }
  return (list || []).find((m) => m.hp > 0) || null;
}

function moveFromCommand(actor, cmd) {
  const sp = SPECIES[actor.speciesId];
  ensureLoadout(actor, sp);
  if (cmd.action === 'attack') return basicMoveFor(actor, sp);
  if (cmd.action === 'skill') {
    const skills = skillMovesFor(actor, sp);
    const picked = skills.find((m) => m.name === cmd.moveName) || skills[0];
    return picked || basicMoveFor(actor, sp);
  }
  return null;
}

/**
 * commands: [{ uid, side:'player'|'foe', action:'attack'|'skill'|'defend'|'item',
 *              moveName?, targetUid?, itemId? }]
 * Item resolution is left to the UI layer for v1 — ignore action:'item' here (no-op log).
 */
export function resolveFormationRound({ players, foes, commands, rng = Math.random }) {
  const pList = players.map((m) => withBattleState({ ...m, defending: false }));
  const fList = foes.map((m) => withBattleState({ ...m, defending: false }));
  const bySide = { player: pList, foe: fList };
  const logs = [];

  for (const cmd of commands || []) {
    const actor = findByUid(bySide[cmd.side], cmd.uid);
    if (!actor || actor.hp <= 0) continue;
    if (cmd.action === 'defend') actor.defending = true;
  }

  const actions = [];
  for (const cmd of commands || []) {
    const actor = findByUid(bySide[cmd.side], cmd.uid);
    if (!actor || actor.hp <= 0) continue;
    if (cmd.action === 'defend') {
      actions.push({ actor, side: cmd.side, kind: 'defend', spd: actor.spd, cmd });
      continue;
    }
    if (cmd.action === 'item') {
      actions.push({ actor, side: cmd.side, kind: 'item', spd: actor.spd, cmd });
      continue;
    }
    actions.push({ actor, side: cmd.side, kind: 'move', spd: actor.spd, cmd });
  }

  actions.sort((a, b) => {
    if (b.spd !== a.spd) return b.spd - a.spd;
    return rng() < 0.5 ? -1 : 1;
  });

  for (const act of actions) {
    if (act.actor.hp <= 0) continue;
    if (act.kind === 'defend') {
      logs.push({
        text: `${SPECIES[act.actor.speciesId].name} 摆出了防御！`,
        side: act.side,
        damage: 0,
        uid: act.actor.uid,
      });
      continue;
    }
    if (act.kind === 'item') {
      logs.push({
        text: `${SPECIES[act.actor.speciesId].name} 想使用道具…（编队战 v1 由 UI 处理）`,
        side: act.side,
        damage: 0,
        uid: act.actor.uid,
      });
      continue;
    }

    const move = moveFromCommand(act.actor, act.cmd);
    if (!move) continue;

    if (move.effect) {
      const applied = applyMoveEffect(act.actor, move);
      if (applied) {
        Object.assign(act.actor, applied.mon);
        logs.push({ ...applied.log, side: act.side, uid: act.actor.uid, moveType: move.type });
        continue;
      }
    }

    const enemySide = act.side === 'player' ? fList : pList;
    const target = firstLiving(enemySide, act.cmd.targetUid);
    if (!target) continue;

    const hit = calcDamage(act.actor, target, move, rng);
    let damage = hit.damage;
    if (target.defending) damage = Math.max(1, Math.floor(damage * 0.5));
    target.hp = Math.max(0, target.hp - damage);
    logs.push({
      text: `${SPECIES[act.actor.speciesId].name} 使用了 ${move.name}！造成了 ${damage} 点伤害${hit.crit ? '（会心）' : ''}！`,
      damage,
      typeMult: hit.typeMult,
      crit: hit.crit,
      moveType: move.type,
      side: act.side,
      uid: act.actor.uid,
      targetUid: target.uid,
    });
  }

  for (const m of [...pList, ...fList]) m.defending = false;

  return {
    players: pList,
    foes: fList,
    logs,
    result: formationSideResult(pList, fList),
  };
}

/** Simple foe AI: one command per living foe. */
export function chooseFoeFormationCommands(players, foes, rng = Math.random) {
  const cmds = [];
  const livingPlayers = () => players.filter((p) => p.hp > 0);
  for (const foe of foes) {
    if (foe.hp <= 0) continue;
    const targets = livingPlayers();
    if (!targets.length) break;
    if (!foe.usedUtility && foe.hp / foe.maxHp <= 0.35 && rng() < 0.35) {
      cmds.push({ uid: foe.uid, side: 'foe', action: 'defend' });
      continue;
    }
    const target = targets[Math.floor(rng() * targets.length)];
    const move = chooseFoeMove(foe, target, rng);
    const sp = SPECIES[foe.speciesId];
    ensureLoadout(foe, sp);
    const skills = skillMovesFor(foe, sp);
    const isSkill = skills.some((m) => m.name === move.name);
    if (isSkill) {
      cmds.push({
        uid: foe.uid, side: 'foe', action: 'skill', moveName: move.name, targetUid: target.uid,
      });
    } else {
      cmds.push({
        uid: foe.uid, side: 'foe', action: 'attack', targetUid: target.uid,
      });
    }
  }
  return cmds;
}
