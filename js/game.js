import {
  SPECIES,
  BALLS,
  MAPS,
  SHINY_CHARM,
  RIFT_FRUIT,
  RIFT_FRUIT_COST,
  RIFT_UNLOCK_LEVEL,
  TWIN_KEY,
  TWIN_KEY_COST,
  TWIN_UNLOCK_LEVEL,
  TWIN_UNLOCK_COUNT,
  NETHER_SEAL,
  NETHER_SEAL_COST,
  NETHER_UNLOCK_LEVEL,
  NETHER_UNLOCK_COUNT,
  createPokemon,
  createRiftAllies,
  createGhostNetherAllies,
  initialPlayerState,
  partyMaxLevel,
  partyOverLevelCount,
  riftFruitDrop,
  statsFor,
  trySpendRiftFruit,
  trySpendTwinKey,
  trySpendNetherSeal,
  PARTY_CAP,
  ACTIVE_CAP,
  activeParty,
  encounterLevels,
  rollEncounter,
  syncEncounters,
  trimParty,
  moveWithinZone,
  recallToBag,
  sendToActive,
  listDexEntries,
  listDexTypes,
  getDexDetail,
  canEnterSpiritHall,
} from './data.js';
import { castMoveNames } from './final-move-kits.js';
import {
  withBattleState,
  speciesMoveList,
  chooseFoeMove,
  moveTarget,
  chooseDualFoeCmd,
} from './battle-moves.js';
import {
  ITEMS,
  emptyItems,
  applyItem,
  itemEffectLabel,
} from './items.js';
import {
  nextBattleStep,
  resolveDualTurn,
  resolveDualItemTurn,
  resolveSquadTurn,
  resolveSquadItemTurn,
  resolveTurn,
  resolveFoeOnlyTurn,
  resolveFormationTurn,
  legalFormationTargets,
} from './battle.js';
import {
  hasFighterFrames,
  normalizeBattleAnim,
  playDamageNumber,
  playFighterFrameStrip,
  playHit,
  preloadFighterFrames,
} from './battle-fx.js';
import {
  unlockAudio,
  playExploreBgm,
  playBattleBgm,
  playAttackSfx,
  playCatchSuccessSfx,
  setMusicEnabled,
  setSfxEnabled,
} from './audio.js';
import { catchChance, catchOutlook, catchProbability, createCatchController } from './catch.js';
import { gainExperience, xpReward, tryEvolve } from './level.js';
import {
  createMazeRun,
  stepMaze,
  findMazePath,
  removeRoamer,
  markFloorBossDefeated,
  advanceMazeFloor,
  buildRoamerEncounter,
  buildFloorBossEncounter,
  SPIRIT_HALL_BOSS_BY_FLOOR,
} from './maze.js';
import {
  spriteWrapClassName,
  partyCardClassName,
  markerClassName,
  syncBossOutlineHairline,
} from './boss-ui.js';
import { partyIndividualView } from './party-detail.js';
import { paintMazeMinimap, MAZE_MINIMAP_SIZE } from './maze-minimap.js';
import { assetUrl, pokemonUrl, preloadImages } from './assets.js';

const STORAGE_KEY = 'poke-catch-prototype-v1';
/** First N map cards load eagerly; the rest use loading=lazy. */
const MAP_CARD_EAGER = 8;

/** Pixel size of one maze cell; keep in sync with CSS `--maze-tile`. */
const MAZE_TILE = 56;
/** Visible tiles around the centered player (odd). */
const MAZE_VIEW_W = 11;
const MAZE_VIEW_H = 9;

const BATTLE_ANIM_ORDER = ['off', 'light', 'medium', 'heavy'];
const BATTLE_MOVE_LAYOUTS = ['list', 'grid', 'primary'];
const BATTLE_MOVE_LAYOUT_LABEL = { list: '列表', grid: '棋盘', primary: '主招' };

function normalizeBattleMoveLayout(value) {
  return BATTLE_MOVE_LAYOUTS.includes(value) ? value : 'list';
}

function applyBattleMoveLayout() {
  const layout = normalizeBattleMoveLayout(state.battleMoveLayout);
  state.battleMoveLayout = layout;
  const bar = $('battle-actions');
  if (bar) bar.dataset.layout = layout;
  const btn = $('btn-move-layout');
  if (btn) btn.textContent = BATTLE_MOVE_LAYOUT_LABEL[layout];
}
const BATTLE_ANIM_LABEL = {
  off: '关闭',
  light: '轻量',
  medium: '中度',
  heavy: '重度',
};

const $ = (id) => document.getElementById(id);

const screens = {
  select: $('screen-select'),
  map: $('screen-map'),
  maze: $('screen-maze'),
  pick: $('screen-pick'),
  battle: $('screen-battle'),
  catch: $('screen-catch'),
};

let state = loadState();
let currentMapId = null;
let pendingEncounter = null;
let battle = null;
let catchCtrl = null;
let selectedBallId = 'poke';
let dexTypeFilter = null;
let throwsThisEncounter = 0;
let pickMode = 'lead';
let dualPickUids = [];
let switchSlotIndex = null;
let battleBusy = false;
let continueResolver = null;
let dualCmdPhase = null; // null | 'action' | 'target' | 'switch'
let dualCmdSlot = 0;
let dualCmds = [null, null];
let dualSwitchBackup = [null, null];
let pendingMove = null;
let itemsUiSelectedId = null;
let mazeRun = null;
let mazePath = [];
let mazeDest = null;
let mazeWalkTimer = null;
let mazeStickDir = null;
let mazeStickTimer = null;
let mazeStickPointer = null;
/** Blocks skip/advance while a formation catch claim is settling. */
let catchQueueLock = false;

const HP_ANIM_MS = 550;
const HIT_GAP_MS = 280;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attackLabel() {
  if (battle?.formation) return '阵型攻击';
  if (battle?.allies) return '小队攻击';
  if (battle?.dual) return '双打攻击';
  return '攻击';
}

function ensureBattleStateOnField() {
  if (!battle) return;
  if (battle.dual) {
    battle.players = battle.players.map((mon) => withBattleState(mon));
    battle.foes = battle.foes.map((mon) => withBattleState(mon));
    battle.player = battle.players[0];
    battle.foe = battle.foes.find((f) => f.hp > 0) || battle.foes[0];
  } else if (battle.formation) {
    battle.player = withBattleState(battle.player);
    if (battle.allies) battle.allies = battle.allies.map((ally) => withBattleState(ally));
    if (battle.foes) battle.foes = battle.foes.map((mon) => withBattleState(mon));
  } else {
    battle.player = withBattleState(battle.player);
    battle.foe = withBattleState(battle.foe);
    if (battle.allies) battle.allies = battle.allies.map((ally) => withBattleState(ally));
  }
}

function setMoveButtonsBusy(busy) {
  const root = $('move-buttons');
  if (!root) return;
  for (const btn of root.querySelectorAll('button')) {
    btn.disabled = busy || btn.dataset.locked === '1';
  }
}

function renderMoveButtons(mon, { dualSlot = null, continueMode = false } = {}) {
  const root = $('move-buttons');
  const prompt = $('move-prompt');
  if (!root) return;
  root.innerHTML = '';
  if (continueMode) {
    if (prompt) prompt.classList.add('hidden');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary';
    btn.textContent = '继续';
    btn.addEventListener('click', () => {
      if (continueResolver) continueResolver();
    });
    root.appendChild(btn);
    return;
  }
  if (!mon) {
    if (prompt) prompt.classList.add('hidden');
    return;
  }
  if (battle?.dual && dualSlot != null && prompt) {
    prompt.textContent = `请为 ${SPECIES[mon.speciesId].name} 选择技能`;
    prompt.classList.remove('hidden');
  } else if (prompt) {
    prompt.classList.add('hidden');
  }
  for (const move of speciesMoveList(SPECIES[mon.speciesId])) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary move-btn';
    const name = document.createElement('span');
    name.className = 'move-btn-name';
    name.textContent = move.name;
    const tags = document.createElement('span');
    tags.className = 'move-btn-tags tags';
    if (move.effect) {
      const effectTag = document.createElement('span');
      effectTag.className = 'tag effect';
      effectTag.textContent = { heal: '回复', atk: '加攻', def: '加防' }[move.effect];
      tags.appendChild(effectTag);
      if (mon.usedUtility) {
        btn.disabled = true;
        btn.dataset.locked = '1';
      }
    } else {
      const typeTag = document.createElement('span');
      typeTag.className = typeTagClass(move.type);
      typeTag.textContent = typeLabel(move.type);
      const powerTag = document.createElement('span');
      powerTag.className = 'tag power';
      powerTag.textContent = `威力 ${move.power}`;
      tags.appendChild(typeTag);
      tags.appendChild(powerTag);
    }
    btn.appendChild(name);
    btn.appendChild(tags);
    btn.addEventListener('click', () => onPickMove(move, dualSlot));
    root.appendChild(btn);
  }
}

function refreshMoveButtons() {
  applyBattleMoveLayout();
  if (!battle) {
    renderMoveButtons(null);
    return;
  }
  if (battle.dual) {
    if (dualCmdPhase === 'action' && battle.players[dualCmdSlot]) {
      renderDualMoveButtons(battle.players[dualCmdSlot]);
    }
    return;
  }
  ensureBattleStateOnField();
  renderMoveButtons(battle.player);
}

function onFieldMons() {
  if (!battle) return [];
  return battle.dual ? (battle.players || []) : [battle.player];
}

function healTargetsOnField() {
  return onFieldMons()
    .map((mon, index) => ({ mon, index }))
    .filter(({ mon }) => mon && mon.hp > 0 && mon.hp < mon.maxHp);
}

function xpTargetsOnField() {
  return onFieldMons()
    .map((mon, index) => ({ mon, index }))
    .filter(({ mon }) => mon && mon.hp > 0);
}

function reviveTargets() {
  if (!battle) return [];
  const field = onFieldMons()
    .map((mon, index) => ({ mon, index, uid: battle.dual ? battle.playerUids[index] : battle.playerUid, onField: true }))
    .filter(({ mon }) => mon && mon.hp <= 0);
  if (field.length) return field;
  const onFieldUids = new Set(
    battle.dual ? (battle.playerUids || []) : [battle.playerUid],
  );
  return activeParty(state.party)
    .filter((p) => p.hp <= 0 && !onFieldUids.has(p.uid))
    .map((mon) => ({ mon, index: -1, uid: mon.uid, onField: false }));
}

function autoTargetForItem(item) {
  if (item.effect === 'heal') {
    const targets = healTargetsOnField();
    if (!targets.length) return null;
    targets.sort((a, b) => (a.mon.maxHp - a.mon.hp) - (b.mon.maxHp - b.mon.hp));
    const t = targets[targets.length - 1];
    const uid = battle.dual ? battle.playerUids[t.index] : battle.playerUid;
    return { ...t, uid, onField: true };
  }
  if (item.effect === 'xp') {
    const targets = xpTargetsOnField();
    if (!targets.length) return null;
    const t = targets[0];
    const uid = battle.dual ? battle.playerUids[t.index] : battle.playerUid;
    return { ...t, uid, onField: true };
  }
  if (item.effect === 'revive') {
    const targets = reviveTargets();
    return targets[0] || null;
  }
  return null;
}

function ownedItemUsableInBattle(item) {
  return (state.items?.[item.id] || 0) > 0 && !!autoTargetForItem(item);
}

function isBattleScreenActive() {
  return !!battle && !screens.battle.classList.contains('hidden');
}

function formationPlayerMove() {
  if (!battle?.player) return null;
  return SPECIES[battle.player.speciesId]?.move || null;
}

function ensureFormationTarget() {
  if (!battle?.formation || !battle.foes) return;
  // Front-row gate: back is only legal once no front foes remain.
  const legal = legalFormationTargets(battle.foes, { pierce: false });
  if (!legal.length) {
    battle.selectedTarget = -1;
    return;
  }
  const cur = battle.foes[battle.selectedTarget];
  if (cur && legal.includes(cur)) return;
  battle.selectedTarget = battle.foes.indexOf(legal[0]);
}

function updateItemButton() {
  const btn = $('btn-items');
  if (!btn) return;
  btn.disabled = false;
}

function closeItemsModal() {
  itemsUiSelectedId = null;
  $('items-modal')?.classList.add('hidden');
  $('items-step-list')?.classList.remove('hidden');
  $('items-step-target')?.classList.add('hidden');
  const title = $('items-title');
  if (title) title.textContent = '道具';
}

function closeItemPanel() {
  closeItemsModal();
}

function setBattleActionBusy(busy) {
  setMoveButtonsBusy(busy);
  $('btn-flee-battle').disabled = busy;
  for (const id of ['btn-switch-cmd', 'btn-cmd-back', 'btn-cmd-undo', 'btn-attack']) {
    const el = $(id);
    if (el) el.disabled = busy;
  }
  if (busy) closeItemPanel();
  updateItemButton();
}

function resetAttackButton() {
  const flee = $('btn-flee-battle');
  if (flee) flee.disabled = false;
  battleBusy = false;
  continueResolver = null;
  updateItemButton();
  if (battle?.dual) {
    beginDualCommandPhase();
    return;
  }
  dualCmdPhase = null;
  dualCmds = [null, null];
  pendingMove = null;
  setDualCmdChrome({
    hint: '',
    showMoves: true,
    showSwitch: false,
    showBack: false,
    showUndo: false,
    hideAttack: true,
  });
  clearTargetHighlight();
  markReadySlots();
  refreshMoveButtons();
}

function waitForContinue(message) {
  appendLog(message);
  return new Promise((resolve) => {
    closeItemPanel();
    if (battle?.dual) {
      const btn = $('btn-attack');
      if (btn) {
        btn.textContent = '继续';
        btn.disabled = false;
        btn.classList.remove('hidden');
      }
      $('move-buttons')?.classList.add('hidden');
      $('btn-switch-cmd')?.classList.add('hidden');
      $('btn-cmd-back')?.classList.add('hidden');
      $('btn-cmd-undo')?.classList.add('hidden');
      $('battle-cmd-hint')?.classList.add('hidden');
      continueResolver = () => {
        if (btn) {
          btn.disabled = true;
          btn.textContent = attackLabel();
          btn.classList.add('hidden');
        }
        continueResolver = null;
        resolve();
      };
      return;
    }
    renderMoveButtons(null, { continueMode: true });
    continueResolver = () => {
      continueResolver = null;
      refreshMoveButtons();
      resolve();
    };
    updateItemButton();
  });
}

function livingDualSlots(side) {
  const arr = side === 'player' ? battle.players : battle.foes;
  return arr.map((mon, index) => ({ mon, index })).filter((x) => x.mon?.hp > 0);
}

function nextDualCmdSlot(from = 0) {
  for (let i = from; i < 2; i += 1) {
    if (battle.players[i]?.hp > 0 && !dualCmds[i]) return i;
  }
  return -1;
}

function setDualCmdChrome({ hint, showMoves, showSwitch, showBack, showUndo, hideAttack }) {
  const hintEl = $('battle-cmd-hint');
  if (hintEl) {
    hintEl.textContent = hint || '';
    hintEl.classList.toggle('hidden', !hint);
  }
  $('btn-attack')?.classList.toggle('hidden', !!hideAttack);
  $('move-buttons')?.classList.toggle('hidden', !showMoves);
  $('btn-switch-cmd')?.classList.toggle('hidden', !showSwitch);
  $('btn-cmd-back')?.classList.toggle('hidden', !showBack);
  $('btn-cmd-undo')?.classList.toggle('hidden', !showUndo);
}

function clearTargetHighlight() {
  document.querySelectorAll('#battle-field .fighter').forEach((el) => {
    el.classList.remove('targetable', 'target-dim');
  });
}

function markReadySlots() {
  document.querySelectorAll('#battle-field .fighter.player').forEach((el) => {
    const slot = Number(el.dataset.slot);
    el.classList.toggle('cmd-ready', !!dualCmds[slot]);
  });
}

function renderDualMoveButtons(mon) {
  const box = $('move-buttons');
  if (!box || !mon) return;
  box.innerHTML = '';
  const kit = speciesMoveList(SPECIES[mon.speciesId]);
  for (const move of kit) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary move-btn';
    const kind = moveTarget(move);
    if (move.effect) {
      btn.textContent = `${move.name} · ${move.effect === 'heal' ? '回复' : move.effect === 'atk' ? '加攻' : '加防'}`;
      btn.disabled = !!mon.usedUtility;
      if (mon.usedUtility) btn.dataset.locked = '1';
    } else {
      btn.textContent = `${move.name} · ${typeLabel(move.type)} · 威力 ${move.power}${kind === 'foes' ? ' · 全体' : ''}`;
    }
    btn.addEventListener('click', () => onDualPickMove(move));
    box.appendChild(btn);
  }
}

function beginDualCommandPhase() {
  dualCmds = [null, null];
  dualSwitchBackup = [null, null];
  dualCmdSlot = nextDualCmdSlot(0);
  pendingMove = null;
  clearTargetHighlight();
  battleBusy = false;
  if (dualCmdSlot < 0) return;
  enterDualAction(dualCmdSlot);
}

function enterDualAction(slot) {
  dualCmdPhase = 'action';
  dualCmdSlot = slot;
  pendingMove = null;
  clearTargetHighlight();
  const mon = battle.players[slot];
  renderDualMoveButtons(mon);
  const undo = slot > 0 && dualCmds.some(Boolean);
  setDualCmdChrome({
    hint: `请为 ${SPECIES[mon.speciesId].name} 选择行动`,
    showMoves: true,
    showSwitch: true,
    showBack: false,
    showUndo: undo,
    hideAttack: true,
  });
  markReadySlots();
  setBattleActionBusy(false);
}

function legalTargetSlots(kind, actorIndex) {
  if (kind === 'self') return { side: 'player', slots: [actorIndex] };
  if (kind === 'ally' || kind === 'allies') {
    return { side: 'player', slots: livingDualSlots('player').map((x) => x.index) };
  }
  return { side: 'foe', slots: livingDualSlots('foe').map((x) => x.index) };
}

function enterDualTarget(move) {
  const kind = moveTarget(move);
  const { side, slots } = legalTargetSlots(kind, dualCmdSlot);
  if (kind === 'self' || slots.length <= 1) {
    const idx = kind === 'self' ? dualCmdSlot : slots[0];
    commitDualMove(move, side, idx ?? 0);
    return;
  }
  dualCmdPhase = 'target';
  pendingMove = move;
  setDualCmdChrome({
    hint: kind === 'foes' || kind === 'allies' ? '将打击该侧全体 — 点击确认' : '选择目标',
    showMoves: false,
    showSwitch: false,
    showBack: true,
    showUndo: false,
    hideAttack: true,
  });
  document.querySelectorAll(`#battle-field .fighter.${side}`).forEach((el) => {
    const slot = Number(el.dataset.slot);
    const ok = slots.includes(slot);
    el.classList.toggle('targetable', ok);
    el.classList.toggle('target-dim', !ok);
  });
  document.querySelectorAll(`#battle-field .fighter:not(.${side})`).forEach((el) => {
    el.classList.add('target-dim');
  });
}

function commitDualMove(move, targetSide, targetIndex) {
  dualCmds[dualCmdSlot] = { type: 'move', move, targetSide, targetIndex };
  pendingMove = null;
  clearTargetHighlight();
  const next = nextDualCmdSlot(0);
  if (next < 0) {
    void resolveDualCommands();
    return;
  }
  enterDualAction(next);
}

function onDualPickMove(move) {
  if (dualCmdPhase !== 'action' || battleBusy) return;
  enterDualTarget(move);
}

function onDualSwitchCmd() {
  if (dualCmdPhase !== 'action' || !battle?.dual) return;
  const onField = new Set(battle.playerUids);
  const party = activeParty(state.party).filter((p) => p.hp > 0 && !onField.has(p.uid));
  if (!party.length) {
    appendLog('没有可以换上的宝可梦。');
    return;
  }
  dualCmdPhase = 'switch';
  setDualCmdChrome({
    hint: '选择补位宝可梦',
    showMoves: false,
    showSwitch: false,
    showBack: true,
    showUndo: false,
    hideAttack: true,
  });
  pickMode = 'dual-voluntary';
  switchSlotIndex = dualCmdSlot;
  $('pick-title').textContent = '选择换上场的宝可梦';
  $('btn-cancel-pick').classList.remove('hidden');
  $('btn-cancel-pick').textContent = '返回';
  const living = battle.foes.filter((f) => f.hp > 0).map((f) => SPECIES[f.speciesId].name).join(' & ');
  $('pick-foe-info').textContent = living ? `对手仍在：${living}` : '';
  renderParty($('pick-party'), true, (mon) => commitDualVoluntarySwitch(mon), party, { onlyConscious: true });
  showScreen('pick');
}

function commitDualVoluntarySwitch(mon) {
  const slot = dualCmdSlot;
  const oldUid = battle.playerUids[slot];
  const old = state.party.find((p) => p.uid === oldUid);
  if (old) {
    old.hp = battle.players[slot].hp;
  }
  dualSwitchBackup[slot] = {
    mon: { ...battle.players[slot] },
    uid: battle.playerUids[slot],
  };
  battle.players[slot] = withBattleState({
    ...mon,
    usedUtility: false,
    atkMul: 1,
    defMul: 1,
  });
  battle.playerUids[slot] = mon.uid;
  battle.player = battle.players[0];
  battle.playerUid = battle.playerUids[0];
  dualCmds[slot] = { type: 'switch' };
  appendLog(`${SPECIES[mon.speciesId].name}，交换上场！（本回合不攻击）`);
  showScreen('battle');
  renderBattle();
  const next = nextDualCmdSlot(0);
  if (next < 0) void resolveDualCommands();
  else enterDualAction(next);
}

async function resolveDualCommands() {
  dualCmdPhase = null;
  setDualCmdChrome({ hint: '', showMoves: false, showSwitch: false, showBack: false, showUndo: false, hideAttack: true });
  clearTargetHighlight();
  markReadySlots();
  battleBusy = true;
  setBattleActionBusy(true);
  try {
    const startPlayers = battle.players.map((mon) => ({ ...mon }));
    const startFoes = battle.foes.map((mon) => ({ ...mon }));
    const foeCmds = startFoes.map((mon, index) => (
      mon.hp > 0 ? chooseDualFoeCmd(withBattleState(mon), index, startPlayers) : null
    ));
    const turn = resolveDualTurn(startPlayers, startFoes, Math.random, dualCmds, foeCmds);
    await playDualTurnHits(turn);
    finishTurnOutcome(turn);
  } catch (err) {
    console.error(err);
    resetAttackButton();
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return bootState();
    const parsed = JSON.parse(raw);
    return hydrateState(parsed);
  } catch {
    return bootState();
  }
}

function bootState() {
  const s = initialPlayerState();
  for (const mapId of Object.keys(MAPS)) {
    s.encounters[mapId] = rollEncounters(mapId, s.hasShinyCharm);
  }
  return s;
}

function hydrateState(parsed) {
  const base = initialPlayerState();
  const s = {
    ...base,
    ...parsed,
    balls: { ...base.balls, ...(parsed.balls || {}) },
    items: { ...emptyItems(), ...(parsed.items || {}) },
    party: trimParty((parsed.party || base.party).map((p) => ({ ...p }))),
    cleared: { ...(parsed.cleared || {}) },
    encounters: { ...(parsed.encounters || {}) },
  };
  for (const id of Object.keys(ITEMS)) {
    s.items[id] = Math.max(0, Math.floor(Number(s.items[id]) || 0));
  }
  s.riftFruit = Math.max(0, Math.floor(Number(s.riftFruit) || 0));
  s.twinKeys = Math.max(0, Math.floor(Number(s.twinKeys) || 0));
  s.twinCleared = !!s.twinCleared;
  s.netherSeals = Math.max(0, Math.floor(Number(s.netherSeals) || 0));
  if (s.catchStyle !== 'flick' && s.catchStyle !== 'sling') s.catchStyle = 'flick';
  delete s.partyStyle;
  s.battleAnim = normalizeBattleAnim(s.battleAnim);
  s.battleMoveLayout = normalizeBattleMoveLayout(s.battleMoveLayout);
  s.damageNumbers = s.damageNumbers !== false;
  s.musicEnabled = s.musicEnabled !== false;
  s.sfxEnabled = s.sfxEnabled !== false;
  if (s.balls.dusk) {
    s.balls.ultra = (s.balls.ultra || 0) + s.balls.dusk;
    delete s.balls.dusk;
  }
  const synced = syncEncounters(s, MAPS, (map, tmpl) => rollEncounter(tmpl, {
    hasCharm: s.hasShinyCharm,
    bossChance: map.bossChance,
  }));
  s.encounters = synced.encounters;
  s.cleared = synced.cleared;
  // Full heal on load to avoid soft-lock
  for (const p of s.party) {
    if (!Number.isFinite(p.exp)) p.exp = 0;
    if (!SPECIES[p.speciesId]) continue;
    const st = statsFor(p.speciesId, p.level, p.boss);
    p.maxHp = st.hp;
    p.hp = st.hp;
    p.atk = st.atk;
    p.def = st.def;
    p.spd = st.spd;
  }
  return s;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function rollEncounters(mapId, hasCharm) {
  const map = MAPS[mapId];
  return map.encounters.map((tmpl) => rollEncounter(tmpl, {
    hasCharm,
    bossChance: map.bossChance,
  }));
}

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
  updateItemButton();
}

function refreshHeader() {
  $('coin-display').innerHTML = `<span class="coin-icon" aria-hidden="true"></span>${state.coins}`;
  $('fruit-display').textContent = `🍇 ${state.riftFruit || 0}`;
  const twinEl = $('twin-key-display');
  if (twinEl) twinEl.textContent = `🔑 ${state.twinKeys || 0}`;
  const netherEl = $('nether-seal-display');
  if (netherEl) netherEl.textContent = `🕯 ${state.netherSeals || 0}`;
  $('charm-display').classList.toggle('hidden', !state.hasShinyCharm);
}

function applyAudioSettings() {
  setMusicEnabled(state.musicEnabled !== false);
  setSfxEnabled(state.sfxEnabled !== false);
}

function openSettings() {
  refreshSettingsPanel();
  $('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  $('settings-modal').classList.add('hidden');
}

function refreshSettingsPanel() {
  refreshBattleAnimButton();
  renderCatchStyle();
  applyBattleMoveLayout();
  const musicBtn = $('btn-music');
  const sfxBtn = $('btn-sfx');
  const numBtn = $('btn-damage-numbers');
  if (musicBtn) musicBtn.textContent = state.musicEnabled !== false ? '开' : '关';
  if (sfxBtn) sfxBtn.textContent = state.sfxEnabled !== false ? '开' : '关';
  if (numBtn) numBtn.textContent = state.damageNumbers !== false ? '开' : '关';
}

function preloadSelectAssets() {
  const maps = Object.values(MAPS)
    .slice(0, MAP_CARD_EAGER)
    .map((m) => assetUrl(m.image));
  const party = (state.party || []).map((mon) => {
    const sp = SPECIES[mon.speciesId];
    return sp ? pokemonUrl(sp.sprite, 'thumb') : null;
  });
  void preloadImages([...maps, ...party]);
}

function renderSelect() {
  refreshHeader();
  const cards = $('map-cards');
  cards.innerHTML = '';
  setMapNote('');
  const maps = Object.values(MAPS);
  maps.forEach((map, index) => {
    const enc = state.encounters[map.id] || [];
    const remaining = enc.filter((e) => !state.cleared[`${map.id}:${e.id}`]).length;
    const spiritLocked = map.spiritHall && !state.twinCleared;
    const twinLocked = map.twin
      && partyOverLevelCount(state.party, TWIN_UNLOCK_LEVEL) < TWIN_UNLOCK_COUNT;
    const netherLocked = map.nether
      && partyOverLevelCount(state.party, NETHER_UNLOCK_LEVEL) < NETHER_UNLOCK_COUNT;
    const locked = (map.rift && partyMaxLevel(state.party) < RIFT_UNLOCK_LEVEL)
      || twinLocked
      || spiritLocked
      || netherLocked;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `map-card${map.rift ? ' rift' : ''}${map.twin ? ' twin' : ''}${map.spiritHall ? ' spirit' : ''}${map.nether ? ' nether' : ''}${locked ? ' locked' : ''}`;
    let meta;
    if (map.spiritHall) {
      meta = state.twinCleared ? '三层迷宫 · 已解锁' : '三层迷宫 · 需通关双子塔';
    } else if (map.nether) {
      meta = `阵型挑战 · 冥界符 ${state.netherSeals || 0}/${NETHER_SEAL_COST}`;
    } else {
      const levels = enc.flatMap((e) => encounterLevels(e));
      const lvMin = Math.min(...levels);
      const lvMax = Math.max(...levels);
      meta = map.rift
        ? `小队挑战 Lv.${lvMin} · 异次元果 ${state.riftFruit || 0}/${RIFT_FRUIT_COST}`
        : map.twin
          ? `双打挑战 Lv.${lvMin} · 双子钥匙 ${state.twinKeys || 0}/${TWIN_KEY_COST}`
          : `推荐 Lv.${lvMin}–${lvMax} · 剩余 ${remaining}/${enc.length}`;
    }
    const eager = index < MAP_CARD_EAGER;
    const imgAttrs = eager ? 'fetchpriority="high"' : 'loading="lazy"';
    card.innerHTML = `
      <img src="${assetUrl(map.image)}" alt="${map.name}" ${imgAttrs} />
      <div class="meta">
        <strong>${map.name}</strong>
        <span>${meta}</span>
      </div>
    `;
    card.addEventListener('click', () => tryEnterMap(map.id));
    cards.appendChild(card);
  });
  const count = $('party-count');
  count.textContent = `${state.party.length}/${PARTY_CAP}`;
  count.classList.toggle('full', state.party.length >= PARTY_CAP);
  renderParty($('party-list'), false);
}

function renderShop() {
  const shop = $('shop');
  shop.innerHTML = '';
  for (const ball of Object.values(BALLS)) {
    shop.appendChild(shopItem({
      title: ball.name,
      img: assetUrl(ball.sprite),
      price: ball.price,
      owned: state.balls[ball.id] || 0,
      disabled: state.coins < ball.price,
      onBuy: () => {
        if (state.coins < ball.price) return;
        state.coins -= ball.price;
        state.balls[ball.id] = (state.balls[ball.id] || 0) + 1;
        afterPurchase();
      },
    }));
  }
  for (const item of Object.values(ITEMS)) {
    shop.appendChild(shopItem({
      title: item.name,
      icon: item.icon,
      price: item.price,
      owned: state.items?.[item.id] || 0,
      disabled: state.coins < item.price,
      label: itemEffectLabel(item),
      onBuy: () => {
        if (state.coins < item.price) return;
        state.coins -= item.price;
        if (!state.items) state.items = emptyItems();
        state.items[item.id] = (state.items[item.id] || 0) + 1;
        afterPurchase();
      },
    }));
  }
  shop.appendChild(shopItem({
    title: RIFT_FRUIT.name,
    icon: '🍇',
    price: RIFT_FRUIT.price,
    owned: state.riftFruit || 0,
    disabled: state.coins < RIFT_FRUIT.price,
    label: '进入异次元',
    onBuy: () => {
      if (state.coins < RIFT_FRUIT.price) return;
      state.coins -= RIFT_FRUIT.price;
      state.riftFruit = (state.riftFruit || 0) + 1;
      afterPurchase();
      renderSelect();
    },
  }));
  shop.appendChild(shopItem({
    title: TWIN_KEY.name,
    icon: '🔑',
    price: TWIN_KEY.price,
    owned: state.twinKeys || 0,
    disabled: state.coins < TWIN_KEY.price,
    label: '进入双子塔',
    onBuy: () => {
      if (state.coins < TWIN_KEY.price) return;
      state.coins -= TWIN_KEY.price;
      state.twinKeys = (state.twinKeys || 0) + 1;
      afterPurchase();
      renderSelect();
    },
  }));
  shop.appendChild(shopItem({
    title: NETHER_SEAL.name,
    icon: '🕯️',
    price: NETHER_SEAL.price,
    owned: state.netherSeals || 0,
    disabled: state.coins < NETHER_SEAL.price,
    label: '进入幽灵冥界',
    onBuy: () => {
      if (state.coins < NETHER_SEAL.price) return;
      state.coins -= NETHER_SEAL.price;
      state.netherSeals = (state.netherSeals || 0) + 1;
      afterPurchase();
      renderSelect();
    },
  }));
  shop.appendChild(shopItem({
    title: SHINY_CHARM.name,
    img: null,
    price: SHINY_CHARM.price,
    owned: state.hasShinyCharm ? 1 : 0,
    disabled: state.hasShinyCharm || state.coins < SHINY_CHARM.price,
    label: state.hasShinyCharm ? '已拥有' : '永久',
    onBuy: () => {
      if (state.hasShinyCharm || state.coins < SHINY_CHARM.price) return;
      state.coins -= SHINY_CHARM.price;
      state.hasShinyCharm = true;
      afterPurchase();
    },
  }));
}

function afterPurchase() {
  save();
  refreshHeader();
  renderShop();
  if (!$('screen-catch').classList.contains('hidden')) renderBallPicker();
}

function openShop() {
  renderShop();
  $('shop-modal').classList.remove('hidden');
}

function closeShop() {
  $('shop-modal').classList.add('hidden');
}

function renderDexFilters() {
  const bar = $('dex-filters');
  bar.innerHTML = '';
  const chips = [{ id: null, label: '全部' }, ...listDexTypes(SPECIES).map((t) => ({ id: t, label: typeLabel(t) }))];
  for (const chip of chips) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dex-filter${dexTypeFilter === chip.id ? ' active' : ''}`;
    btn.textContent = chip.label;
    btn.addEventListener('click', () => {
      dexTypeFilter = chip.id;
      renderDex();
    });
    bar.appendChild(btn);
  }
}

function renderDex() {
  renderDexFilters();
  const list = $('dex-list');
  const entries = listDexEntries(SPECIES, { type: dexTypeFilter });
  $('dex-title').textContent = `图鉴（${entries.length}）`;
  list.innerHTML = '';
  for (const e of entries) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'dex-row';
    row.innerHTML = `
      <img src="${pokemonUrl(e.sprite, 'thumb')}" alt="${e.name}" loading="lazy" />
      <span class="name">${e.name}</span>
      <span class="${typeTagClass(e.type)}">${typeLabel(e.type)}</span>
    `;
    row.addEventListener('click', () => openDexDetail(e.id));
    list.appendChild(row);
  }
}

function renderDexDetail(detail, mon = null) {
  const root = $('dex-detail');
  const catchPct = Math.round((detail.catchRate ?? 0) * 100);
  const effectLabel = { heal: '回复', atk: '加攻', def: '加防' };
  const moveLines = detail.moves
    .map((m) => (
      m.effect
        ? `<li>${m.name}（${effectLabel[m.effect]}）</li>`
        : `<li>${m.name}（${typeLabel(m.type)} · 威力 ${m.power}）</li>`
    ))
    .join('');
  const evo = detail.evolvesToName
    ? `进化：Lv.${detail.evolveLevel} → ${detail.evolvesToName}`
    : '进化：无';
  const canAnim = hasFighterFrames(detail.id);
  const individual = partyIndividualView(mon);
  const individualHtml = individual
    ? `<div class="individual">
        <div>个体：Lv.${individual.level} · HP ${individual.hpText}</div>
        <div>能力：攻 ${individual.atk} · 防 ${individual.def} · 速 ${individual.spd}</div>
        <div>经验：${individual.expText}</div>
        <div class="meta">
          ${individual.shiny ? '<span class="tag shiny">闪光</span>' : ''}
          ${individual.fainted ? '<span class="tag">倒地</span>' : ''}
        </div>
      </div>`
    : '';
  $('dex-detail-title').textContent = detail.name;
  root.innerHTML = `
    <div class="dex-hero-wrap">
      <img class="hero" src="${pokemonUrl(detail.sprite, 'full')}" alt="${detail.name}" />
    </div>
    ${canAnim ? '<button type="button" id="btn-dex-anim" class="dex-anim-btn">播放动画</button>' : ''}
    ${individualHtml}
    <div class="meta">
      <span class="${typeTagClass(detail.type)}">${typeLabel(detail.type)}</span>
      ${detail.mega ? '<span class="tag mega">超级</span>' : ''}
    </div>
    <div class="stats">种族值：HP ${detail.base.hp} · 攻 ${detail.base.atk} · 防 ${detail.base.def} · 速 ${detail.base.spd}</div>
    <div class="moves">招式：<ul>${moveLines}</ul></div>
    <div class="extra">捕捉率：${catchPct}%<br>${evo}</div>
  `;
  const animBtn = $('btn-dex-anim');
  if (animBtn) {
    animBtn.addEventListener('click', async () => {
      if (animBtn.disabled) return;
      animBtn.disabled = true;
      const img = root.querySelector('img.hero');
      try {
        await playFighterFrameStrip(img, detail.id);
      } finally {
        animBtn.disabled = false;
      }
    });
  }
}

function openDexDetail(speciesId, mon = null) {
  const detail = getDexDetail(speciesId, SPECIES);
  if (!detail) return;
  renderDexDetail(detail, mon);
  $('dex-detail-modal').classList.remove('hidden');
}

function openPartyDetail(mon) {
  closePartyPopover();
  openDexDetail(mon.speciesId, mon);
}

function closeDexDetail() {
  $('dex-detail-modal').classList.add('hidden');
}

function openDex() {
  dexTypeFilter = null;
  closeDexDetail();
  renderDex();
  $('dex-modal').classList.remove('hidden');
}

function closeDex() {
  closeDexDetail();
  $('dex-modal').classList.add('hidden');
}

function shopItem({ title, img, price, owned, disabled, onBuy, label, icon }) {
  const el = document.createElement('div');
  el.className = 'shop-item';
  el.innerHTML = `
    ${img ? `<img src="${img}" alt="" />` : `<div style="font-size:28px">${icon || '✨'}</div>`}
    <div>${title}</div>
    <div class="price">${price} 金币</div>
    <div class="count">拥有 ${owned}${label ? ` · ${label}` : ''}</div>
  `;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '购买';
  btn.disabled = disabled;
  btn.addEventListener('click', onBuy);
  el.appendChild(btn);
  return el;
}

let openPartyUid = null;
let partyOutsideListenerBound = false;

function closePartyPopover() {
  if (openPartyUid == null) return;
  openPartyUid = null;
  const list = $('party-list');
  if (list) renderParty(list, false);
}

function bindPartyOutsideClose() {
  if (partyOutsideListenerBound) return;
  partyOutsideListenerBound = true;
  document.addEventListener('pointerdown', (e) => {
    if (openPartyUid == null) return;
    if (e.target.closest?.('.party-popover') || e.target.closest?.('#party-list .party-card')) return;
    closePartyPopover();
  });
}

function canShiftParty(uid, dir) {
  const probe = state.party.map((p) => ({ uid: p.uid }));
  return moveWithinZone(probe, uid, dir);
}

function runPartyAction(fn) {
  if (!fn()) return;
  openPartyUid = null;
  save();
  renderSelect();
}

function buildPartyPopover(mon, index) {
  const pop = document.createElement('div');
  pop.className = 'party-popover';
  pop.addEventListener('click', (e) => e.stopPropagation());
  const active = index >= 0 && index < ACTIVE_CAP;
  const add = (label, disabled, title, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.disabled = disabled;
    if (title) btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!btn.disabled) onClick();
    });
    pop.appendChild(btn);
  };
  add('详情', false, '', () => openPartyDetail(mon));
  add('左移', !canShiftParty(mon.uid, -1), '', () => runPartyAction(() => moveWithinZone(state.party, mon.uid, -1)));
  add('右移', !canShiftParty(mon.uid, 1), '', () => runPartyAction(() => moveWithinZone(state.party, mon.uid, 1)));
  if (active) {
    const noBag = state.party.length <= ACTIVE_CAP;
    add('收回', noBag, noBag ? '背包里没有位置：队伍不足以收回' : '', () => runPartyAction(() => recallToBag(state.party, mon.uid)));
  } else {
    add('上场', false, '', () => runPartyAction(() => sendToActive(state.party, mon.uid)));
  }
  return pop;
}

function renderParty(container, selectable, onPick, mons = null, { onlyConscious = false } = {}) {
  container.innerHTML = '';
  let list = mons || state.party;
  if (onlyConscious) list = list.filter((mon) => mon.hp > 0);
  if (!selectable) bindPartyOutsideClose();
  if (!selectable && openPartyUid != null && !state.party.some((p) => p.uid === openPartyUid)) openPartyUid = null;

  const buildCard = (mon) => {
    const sp = SPECIES[mon.speciesId];
    const card = document.createElement(selectable ? 'button' : 'div');
    if (selectable) card.type = 'button';
    card.className = partyCardClassName({
      selectable: !!selectable,
      shiny: !!mon.shiny,
      boss: !!mon.boss,
    });
    const index = state.party.findIndex((p) => p.uid === mon.uid);
    const inBattle = index >= 0 && index < ACTIVE_CAP;
    if (inBattle && !selectable) card.classList.add('in-battle');
    card.innerHTML = `
      <div class="sprite-frame"><img src="${pokemonUrl(sp.sprite, 'thumb')}" alt="${sp.name}" /></div>
      <strong>${sp.name}</strong>
      <div class="meta">Lv.${mon.level}${mon.hp <= 0 ? ' · 倒' : ''}</div>
    `;
    if (selectable) {
      card.addEventListener('click', () => onPick(mon));
      return card;
    }
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const toggle = () => {
      openPartyUid = openPartyUid === mon.uid ? null : mon.uid;
      renderParty(container, false);
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', (e) => {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
    if (openPartyUid === mon.uid) {
      card.classList.add('open');
      card.appendChild(buildPartyPopover(mon, index));
    }
    return card;
  };

  for (const mon of list) container.appendChild(buildCard(mon));
}

function typeLabel(t) {
  return {
    fire: '火', grass: '草', water: '水', electric: '电', rock: '岩石',
    bug: '虫', poison: '毒', psychic: '超能', ghost: '幽灵', dragon: '龙',
    ice: '冰', ground: '地面', flying: '飞行', fighting: '格斗', normal: '一般',
    steel: '钢', dark: '恶', fairy: '妖精',
  }[t] || t;
}

function typeTagClass(t) {
  return `tag type type-${t || 'normal'}`;
}

function setMapNote(text) {
  const note = $('map-note');
  if (note) note.textContent = text || '';
}

function tryEnterMap(mapId) {
  const map = MAPS[mapId];
  if (map.spiritHall) {
    const gate = canEnterSpiritHall(state);
    if (!gate.ok) {
      renderSelect();
      setMapNote('灵堂需先通关一次双子塔才能进入。');
      return;
    }
    startMazeRun();
    return;
  }
  if (map.rift) {
    const spent = trySpendRiftFruit(state, partyMaxLevel(state.party));
    if (!spent.ok) {
      const owned = state.riftFruit || 0;
      renderSelect();
      setMapNote(spent.reason === 'level'
        ? `异次元要队伍里有宝可梦达到 ${RIFT_UNLOCK_LEVEL} 级才能进。`
        : `还差异次元果：需要 ${RIFT_FRUIT_COST} 个（现有 ${owned}）。打败菊草叶，或在商店花 ${RIFT_FRUIT.price} 金币买。`);
      return;
    }
    save();
    refreshHeader();
  }
  if (map.twin) {
    const spent = trySpendTwinKey(state, state.party);
    if (!spent.ok) {
      const owned = state.twinKeys || 0;
      const have = partyOverLevelCount(state.party, TWIN_UNLOCK_LEVEL);
      renderSelect();
      setMapNote(spent.reason === 'level'
        ? `双子塔要队伍里至少 ${TWIN_UNLOCK_COUNT} 只宝可梦超过 ${TWIN_UNLOCK_LEVEL} 级（现有 ${have} 只）。`
        : `还差双子钥匙：需要 ${TWIN_KEY_COST} 个（现有 ${owned}）。可在商店花 ${TWIN_KEY.price} 金币买。`);
      return;
    }
    save();
    refreshHeader();
  }
  if (map.nether) {
    const spent = trySpendNetherSeal(state, state.party);
    if (!spent.ok) {
      const owned = state.netherSeals || 0;
      const have = partyOverLevelCount(state.party, NETHER_UNLOCK_LEVEL);
      renderSelect();
      setMapNote(spent.reason === 'level'
        ? `幽灵冥界要队伍里至少 ${NETHER_UNLOCK_COUNT} 只宝可梦超过 ${NETHER_UNLOCK_LEVEL} 级（现有 ${have} 只）。`
        : `还差冥界符：需要 ${NETHER_SEAL_COST} 个（现有 ${owned}）。可在商店花 ${NETHER_SEAL.price} 金币买。`);
      return;
    }
    save();
    refreshHeader();
  }
  openMap(mapId);
}

function startMazeRun() {
  stopMazeMotion();
  mazeRun = createMazeRun({ floor: 1 });
  currentMapId = 'spirit_hall';
  renderMaze();
  showScreen('maze');
}

function endMazeRun({ message } = {}) {
  stopMazeMotion();
  mazeRun = null;
  playExploreBgm();
  showScreen('select');
  renderSelect();
  if (message) setMapNote(message);
}

function inSpiritHall() {
  return !!mazeRun && currentMapId === 'spirit_hall';
}

function returnAfterMazeBattle() {
  if (!inSpiritHall()) {
    openMap(currentMapId);
    return;
  }
  renderMaze();
  showScreen('maze');
  playExploreBgm();
}

function failMazeRun() {
  endMazeRun({ message: '队伍全灭，已离开灵堂。下次从第 1 层重新开始。' });
}

function resumeAfterMazeCatch() {
  if (!inSpiritHall()) {
    openMap(currentMapId);
    return;
  }
  const tag = pendingEncounter?.maze;
  if (tag?.kind === 'roamer') {
    mazeRun = removeRoamer(mazeRun, tag.roamerId);
    returnAfterMazeBattle();
    return;
  }
  if (tag?.kind === 'boss') {
    mazeRun = markFloorBossDefeated(mazeRun);
    afterFloorBossCleared(); // may call endMazeRun on floor 3
    if (mazeRun) returnAfterMazeBattle();
    return;
  }
  returnAfterMazeBattle();
}

function mazeTilePx() {
  const vp = $('maze-viewport');
  const raw = vp ? getComputedStyle(vp).getPropertyValue('--maze-tile').trim() : '';
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : MAZE_TILE;
}

function mazeViewSize() {
  const vp = $('maze-viewport');
  if (!vp) return { w: MAZE_VIEW_W, h: MAZE_VIEW_H };
  const cs = getComputedStyle(vp);
  const w = parseInt(cs.getPropertyValue('--maze-view-w'), 10);
  const h = parseInt(cs.getPropertyValue('--maze-view-h'), 10);
  return {
    w: Number.isFinite(w) && w > 0 ? w : MAZE_VIEW_W,
    h: Number.isFinite(h) && h > 0 ? h : MAZE_VIEW_H,
  };
}

const MAZE_HELP_TEXT = '点任意可走格子，角色会自动走过去。也可以用左侧摇杆移动。踩到游荡宝可梦开战；楼梯处为层主。全灭或退出将结束本次探索。';
const MAZE_STEP_MS = 320;
const PARTY_HELP_TEXT = '点卡排序。前 6 出场；收回进背包，上场回前 6。';

let mazeToastTimer = null;
let appToastTimer = null;

function mazePlayerSprite() {
  const lead = activeParty(state.party).find((p) => p.hp > 0) || state.party[0];
  const sp = SPECIES[lead?.speciesId];
  return sp?.sprite || 'assets/pokemon/scorbunny.png';
}

function showMazeToast(text, ms = 4200) {
  const el = $('maze-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  if (mazeToastTimer) clearTimeout(mazeToastTimer);
  mazeToastTimer = setTimeout(() => {
    el.classList.add('hidden');
    mazeToastTimer = null;
  }, ms);
}

function showAppToast(text, ms = 4000) {
  const el = $('app-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  if (appToastTimer) clearTimeout(appToastTimer);
  appToastTimer = setTimeout(() => {
    el.classList.add('hidden');
    appToastTimer = null;
  }, ms);
}

function onMazeTileClick(x, y) {
  if (!mazeRun) return;
  const path = findMazePath(mazeRun, x, y);
  if (!path.length) return;
  mazeStickPointer = null;
  stopMazeStick();
  mazePath = path;
  mazeDest = path[path.length - 1];
  showMazeDest();
  if (!mazeWalkTimer) scheduleMazeStep();
}

function clearMazePath() {
  mazePath = [];
  mazeDest = null;
  if (mazeWalkTimer) {
    clearTimeout(mazeWalkTimer);
    mazeWalkTimer = null;
  }
  $('maze-world')?.querySelector('.maze-dest')?.remove();
}

function stopMazeStick() {
  mazeStickDir = null;
  if (mazeStickTimer) {
    clearInterval(mazeStickTimer);
    mazeStickTimer = null;
  }
  const knob = $('maze-stick-knob');
  if (knob) knob.style.transform = '';
  $('maze-stick')?.removeAttribute('data-dir');
}

function stopMazeMotion() {
  clearMazePath();
  stopMazeStick();
}

function showMazeDest() {
  const world = $('maze-world');
  if (!world || !mazeDest) return;
  let el = world.querySelector('.maze-dest');
  if (!el) {
    el = document.createElement('div');
    el.className = 'maze-dest';
    world.appendChild(el);
  }
  const tile = mazeTilePx();
  el.style.left = `${mazeDest.x * tile}px`;
  el.style.top = `${mazeDest.y * tile}px`;
  el.style.width = `${tile}px`;
  el.style.height = `${tile}px`;
}

function placeMazeCamera() {
  const world = $('maze-world');
  if (!world || !mazeRun) return;
  const tile = mazeTilePx();
  const view = mazeViewSize();
  const camX = mazeRun.player.x * tile - (view.w * tile) / 2 + tile / 2;
  const camY = mazeRun.player.y * tile - (view.h * tile) / 2 + tile / 2;
  world.style.transform = `translate(${-camX}px, ${-camY}px)`;
}

function refreshMazeMinimap() {
  const canvas = $('maze-minimap');
  if (!canvas || !mazeRun) return;
  const cssW = parseFloat(getComputedStyle(canvas).width) || MAZE_MINIMAP_SIZE;
  const size = Math.round(cssW) || MAZE_MINIMAP_SIZE;
  const ctx = canvas.getContext('2d');
  paintMazeMinimap(ctx, mazeRun, size);
}

function syncMazePlayer() {
  const world = $('maze-world');
  const playerImg = world?.querySelector('.maze-entity.player');
  if (!world || !playerImg || !mazeRun) return;
  const tile = mazeTilePx();
  playerImg.style.left = `${mazeRun.player.x * tile}px`;
  playerImg.style.top = `${mazeRun.player.y * tile}px`;
  placeMazeCamera();
  refreshMazeMinimap();
}

function scheduleMazeStep() {
  mazeWalkTimer = setTimeout(runMazeStep, MAZE_STEP_MS);
}

function runMazeStep() {
  mazeWalkTimer = null;
  if (!mazeRun || !mazePath.length) {
    clearMazePath();
    return;
  }
  const next = mazePath[0];
  const dx = next.x - mazeRun.player.x;
  const dy = next.y - mazeRun.player.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    clearMazePath();
    return;
  }
  mazePath.shift();
  const event = tryMazeStep(dx, dy);
  if (event || !mazeRun || !mazePath.length) {
    clearMazePath();
  } else {
    scheduleMazeStep();
  }
}

function stickVector(clientX, clientY) {
  const el = $('maze-stick');
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const dead = 16;
  if (dx * dx + dy * dy < dead * dead) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? { dir: [1, 0], name: 'e' } : { dir: [-1, 0], name: 'w' };
  return dy > 0 ? { dir: [0, 1], name: 's' } : { dir: [0, -1], name: 'n' };
}

function placeStickKnob(clientX, clientY) {
  const el = $('maze-stick');
  const knob = $('maze-stick-knob');
  if (!el || !knob) return;
  const rect = el.getBoundingClientRect();
  let dx = clientX - (rect.left + rect.width / 2);
  let dy = clientY - (rect.top + rect.height / 2);
  const max = rect.width * 0.28;
  const len = Math.hypot(dx, dy) || 1;
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function pauseStickSteps() {
  mazeStickDir = null;
  if (mazeStickTimer) {
    clearInterval(mazeStickTimer);
    mazeStickTimer = null;
  }
  $('maze-stick')?.removeAttribute('data-dir');
}

function applyMazeStick(e) {
  if (!mazeRun) return;
  placeStickKnob(e.clientX, e.clientY);
  const next = stickVector(e.clientX, e.clientY);
  if (!next) {
    pauseStickSteps();
    return;
  }
  if (!mazeStickDir) clearMazePath();
  mazeStickDir = next.dir;
  $('maze-stick')?.setAttribute('data-dir', next.name);
  if (!mazeStickTimer) {
    tryMazeStep(mazeStickDir[0], mazeStickDir[1]);
    if (!mazeRun || !mazeStickDir) return;
    mazeStickTimer = setInterval(() => {
      if (!mazeStickDir || !mazeRun) return;
      tryMazeStep(mazeStickDir[0], mazeStickDir[1]);
    }, MAZE_STEP_MS);
  }
}

function bindMazeStick() {
  const stick = $('maze-stick');
  if (!stick || stick.dataset.bound) return;
  stick.dataset.bound = '1';
  stick.addEventListener('pointerdown', (e) => {
    if (!mazeRun) return;
    mazeStickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    applyMazeStick(e);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', (e) => {
    if (mazeStickPointer !== e.pointerId) return;
    if (!stick.hasPointerCapture(e.pointerId)) return;
    applyMazeStick(e);
  });
  const end = (e) => {
    if (stick.hasPointerCapture(e.pointerId)) stick.releasePointerCapture(e.pointerId);
    if (mazeStickPointer !== e.pointerId) return;
    mazeStickPointer = null;
    stopMazeStick();
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
}

function onMazeWorldClick(e) {
  const cell = e.target.closest('.maze-tile');
  if (!cell || !mazeRun) return;
  const x = Number(cell.dataset.mazeX);
  const y = Number(cell.dataset.mazeY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  onMazeTileClick(x, y);
}

function renderMaze() {
  if (!mazeRun) return;
  $('maze-title').textContent = `灵堂 · 第 ${mazeRun.floor} 层`;
  const world = $('maze-world');
  if (!world) return;
  const tile = mazeTilePx();
  const h = mazeRun.grid.length;
  const w = mazeRun.grid[0].length;
  world.style.width = `${w * tile}px`;
  world.style.height = `${h * tile}px`;
  world.innerHTML = '';

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const kind = mazeRun.grid[y][x];
      const cell = document.createElement('div');
      const walkable = kind !== 'wall';
      cell.className = `maze-tile ${kind}${walkable ? ' walkable' : ''}`;
      cell.style.left = `${x * tile}px`;
      cell.style.top = `${y * tile}px`;
      cell.style.width = `${tile}px`;
      cell.style.height = `${tile}px`;
      if (walkable) {
        cell.dataset.mazeX = String(x);
        cell.dataset.mazeY = String(y);
      }
      world.appendChild(cell);
    }
  }

  for (const roamer of mazeRun.roamers) {
    const sp = SPECIES[roamer.speciesId];
    if (!sp) continue;
    const img = document.createElement('img');
    img.className = 'maze-entity roamer';
    img.src = pokemonUrl(sp.sprite, 'thumb');
    img.alt = sp.name;
    img.title = `${sp.name} Lv.${roamer.level}`;
    img.style.left = `${roamer.x * tile}px`;
    img.style.top = `${roamer.y * tile}px`;
    img.style.width = `${tile * 0.82}px`;
    img.style.height = `${tile * 0.82}px`;
    world.appendChild(img);
  }

  if (!mazeRun.floorBossDefeated && mazeRun.stairs) {
    const boss = SPIRIT_HALL_BOSS_BY_FLOOR[mazeRun.floor];
    const sp = SPECIES[boss?.speciesId];
    if (sp) {
      const img = document.createElement('img');
      img.className = 'maze-entity boss';
      img.src = pokemonUrl(sp.sprite, 'thumb');
      img.alt = sp.name;
      img.title = `${sp.name} Lv.${boss.level}`;
      img.style.left = `${mazeRun.stairs.x * tile}px`;
      img.style.top = `${mazeRun.stairs.y * tile}px`;
      img.style.width = `${tile * 0.82}px`;
      img.style.height = `${tile * 0.82}px`;
      world.appendChild(img);
    }
  }

  const playerImg = document.createElement('img');
  playerImg.className = 'maze-entity player';
  playerImg.src = pokemonUrl(mazePlayerSprite(), 'thumb');
  playerImg.alt = '我方';
  playerImg.style.left = `${mazeRun.player.x * tile}px`;
  playerImg.style.top = `${mazeRun.player.y * tile}px`;
  playerImg.style.width = `${tile * 0.82}px`;
  playerImg.style.height = `${tile * 0.82}px`;
  world.appendChild(playerImg);
  placeMazeCamera();
  refreshMazeMinimap();
  if (mazeDest) showMazeDest();
}

function tryMazeStep(dx, dy) {
  if (!mazeRun) return null;
  const beforeX = mazeRun.player.x;
  const beforeY = mazeRun.player.y;
  const { run, event } = stepMaze(mazeRun, dx, dy);
  mazeRun = run;
  if (event) {
    stopMazeMotion();
    renderMaze();
    if (event.type === 'roamer') beginMazeRoamerBattle(event.roamer);
    else if (event.type === 'stairs') {
      if (!mazeRun.floorBossDefeated) beginMazeBossBattle();
      else afterFloorBossCleared();
    }
    return event;
  }
  if (run.player.x !== beforeX || run.player.y !== beforeY) syncMazePlayer();
  return null;
}

function beginMazeRoamerBattle(roamer) {
  const tmpl = buildRoamerEncounter(roamer);
  tmpl.pokemon = createPokemon(roamer.speciesId, roamer.level, { shiny: false, boss: false });
  tmpl.shiny = false;
  tmpl.boss = false;
  startPick(tmpl);
}

function beginMazeBossBattle() {
  const tmpl = buildFloorBossEncounter(mazeRun.floor);
  tmpl.pokemon = createPokemon(tmpl.speciesId, tmpl.level, { shiny: true, boss: true });
  startPick(tmpl);
}

function afterFloorBossCleared() {
  if (mazeRun.floor >= 3) {
    endMazeRun({ message: '灵堂通关！基格尔德已被击败。' });
    return;
  }
  mazeRun = advanceMazeFloor(mazeRun);
  renderMaze();
}

function openMap(mapId) {
  currentMapId = mapId;
  const map = MAPS[mapId];
  $('map-title').textContent = map.name;
  $('map-bg').src = assetUrl(map.image);
  const markers = $('map-markers');
  markers.innerHTML = '';
  const encs = state.encounters[mapId] || [];
  for (const enc of encs) {
    const key = `${mapId}:${enc.id}`;
    const cleared = !!state.cleared[key];
    const trainer = enc.kind === 'trainer';
    const lead = trainer
      ? enc.team[0]
      : (enc.dual || enc.formation ? enc.foes[0] : enc);
    const sp = SPECIES[lead.speciesId];
    const shiny = trainer ? enc.team.some((m) => m.shiny) : enc.shiny;
    const boss = trainer ? enc.team.some((m) => m.boss) : enc.boss;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = markerClassName({
      kind: enc.kind,
      shiny: !!shiny,
      boss: !!boss,
      cleared: !!cleared,
    });
    el.style.left = `${enc.x}%`;
    el.style.top = `${enc.y}%`;
    const who = enc.formation
      ? '阵型战'
      : enc.dual
        ? '双打挑战'
        : enc.squad
          ? '小队挑战'
          : trainer
            ? `训练家 ${enc.trainerName}`
            : '野生';
    const detail = enc.formation
      ? enc.foes.filter((f) => f.boss).map((f) => SPECIES[f.speciesId].name).join('、')
      : enc.dual
        ? enc.foes.map((f) => SPECIES[f.speciesId].name).join(' & ')
        : trainer
          ? `${enc.team.length}只`
          : `${sp.name} Lv.${enc.level}`;
    el.innerHTML = `
      <img src="${pokemonUrl(sp.sprite, 'thumb')}" alt="" />
      <div class="label">
        ${who}<br/>${detail}${enc.dual ? `<br/>Lv.${enc.level}` : ''}${enc.formation ? `<br/>Lv.${enc.foes.find((f) => f.boss)?.level || enc.foes[0].level}` : ''}
        ${boss ? '<br/><span class="tag boss">头目</span>' : ''}
        ${shiny ? '<span class="tag shiny">闪光</span>' : ''}
        ${sp.mega ? '<span class="tag mega">超级</span>' : ''}
      </div>
    `;
    if (!cleared) {
      el.addEventListener('click', () => startPick(enc));
    }
    markers.appendChild(el);
  }
  showScreen('map');
}

function prepareEncounter(enc) {
  if (enc.kind === 'trainer') {
    const foeTeam = enc.team.map((m) => ({ ...m, hp: m.maxHp }));
    return {
      ...enc,
      foeTeam,
      foeIndex: 0,
      activeFoe: { ...foeTeam[0] },
    };
  }
  if (enc.dual) {
    const foes = enc.foes.map((m) => ({ ...m, hp: m.maxHp }));
    return {
      ...enc,
      foes,
      activeFoe: { ...foes[0] },
      foeTeam: null,
      foeIndex: 0,
    };
  }
  if (enc.formation) {
    const foes = enc.foes.map((m) => ({ ...m, hp: m.maxHp }));
    const lead = foes.find((f) => f.boss) || foes[0];
    return {
      ...enc,
      foes,
      activeFoe: { ...lead },
      foeTeam: null,
      foeIndex: 0,
    };
  }
  const foe = { ...enc.pokemon, hp: enc.pokemon.maxHp };
  return { ...enc, activeFoe: foe, foeTeam: null, foeIndex: 0 };
}

function foeIntro(enc) {
  if (enc.kind === 'trainer') {
    return `对手：训练家 ${enc.trainerName}（${enc.foeTeam.length}只）`;
  }
  if (enc.dual) {
    const names = enc.foes.map((f) => `${SPECIES[f.speciesId].name} Lv.${enc.level}`).join(' & ');
    return `双打对手：${names}（头目）。请选出 2 只宝可梦同时出战。`;
  }
  if (enc.formation) {
    const bosses = enc.foes.filter((f) => f.boss).map((f) => SPECIES[f.speciesId].name).join('、');
    return `阵型战：前排封锁，击败全部敌人。头目：${bosses}。选出 1 只宝可梦出战（4 只电脑同伴助战）。`;
  }
  const sp = SPECIES[enc.speciesId];
  const tags = `${enc.boss ? '（头目）' : ''}${enc.shiny ? '（闪光）' : ''}${sp.mega ? '（超级进化）' : ''}`;
  if (enc.squad) {
    const skills = castMoveNames(sp, { squadBoss: true }).join('、');
    return `对手：${sp.name} Lv.${enc.level}${tags}。技能：${skills}。你和 3 只电脑宝可梦组队应战。`;
  }
  return `对手：野生的 ${sp.name} Lv.${enc.level}${tags}`;
}

function startPick(enc) {
  pendingEncounter = prepareEncounter(enc);
  $('btn-cancel-pick').classList.remove('hidden');
  $('btn-cancel-pick').textContent = '取消';
  $('pick-foe-info').textContent = foeIntro(pendingEncounter);
  if (pendingEncounter.dual) {
    pickMode = 'dual-lead';
    dualPickUids = [];
    renderDualLeadPick();
    showScreen('pick');
    return;
  }
  pickMode = 'lead';
  $('pick-title').textContent = '选择出战宝可梦';
  renderParty($('pick-party'), true, (mon) => startBattle(mon), activeParty(state.party), { onlyConscious: true });
  showScreen('pick');
}

function renderDualLeadPick() {
  $('pick-title').textContent = `选择出战宝可梦（${dualPickUids.length}/2）`;
  const party = activeParty(state.party).filter((mon) => mon.hp > 0);
  const container = $('pick-party');
  container.innerHTML = '';
  for (const mon of party) {
    const sp = SPECIES[mon.speciesId];
    const card = document.createElement('button');
    card.type = 'button';
    const selected = dualPickUids.includes(mon.uid);
    card.className = partyCardClassName({
      selectable: true,
      selected: !!selected,
      shiny: !!mon.shiny,
      boss: !!mon.boss,
    });
    const order = dualPickUids.indexOf(mon.uid);
    card.innerHTML = `
      <div class="sprite-frame"><img src="${pokemonUrl(sp.sprite, 'thumb')}" alt="${sp.name}" /></div>
      <div class="body">
        <strong>${sp.name}${order >= 0 ? ` · #${order + 1}` : ''}</strong>
        <div>Lv.${mon.level} · HP ${mon.hp}/${mon.maxHp}</div>
        <div>攻${mon.atk} 防${mon.def} 速${mon.spd}</div>
        <div class="tags">
          <span class="tag type">${typeLabel(sp.type)}</span>
          ${selected ? '<span class="tag battle">已选</span>' : ''}
          ${mon.shiny ? '<span class="tag shiny">闪光</span>' : ''}
          ${mon.boss ? '<span class="tag boss">头目</span>' : ''}
        </div>
      </div>
    `;
    card.addEventListener('click', () => toggleDualLead(mon));
    container.appendChild(card);
  }
}

function toggleDualLead(mon) {
  const i = dualPickUids.indexOf(mon.uid);
  if (i >= 0) dualPickUids.splice(i, 1);
  else if (dualPickUids.length < 2) dualPickUids.push(mon.uid);
  if (dualPickUids.length === 2) {
    const party = activeParty(state.party);
    const mons = dualPickUids.map((uid) => party.find((p) => p.uid === uid)).filter(Boolean);
    if (mons.length === 2) {
      startDualBattle(mons);
      return;
    }
  }
  renderDualLeadPick();
}

function startDualBattle(playerMons) {
  const players = playerMons.map((mon) => ({ ...mon }));
  const foes = pendingEncounter.foes.map((mon) => ({ ...mon, hp: mon.maxHp }));
  pendingEncounter.foes = foes.map((mon) => ({ ...mon }));
  battle = {
    dual: true,
    players,
    foes,
    playerUids: playerMons.map((mon) => mon.uid),
    player: players[0],
    foe: foes[0],
    playerUid: playerMons[0].uid,
    allies: null,
  };
  renderBattle();
  battle.players = battle.players.map(withBattleState);
  battle.foes = battle.foes.map(withBattleState);
  $('battle-log').innerHTML = '<p>双打对战开始！</p>';
  appendLog(`${SPECIES[players[0].speciesId].name} 与 ${SPECIES[players[1].speciesId].name} 同时出战！`);
  playBattleBgm({
    rift: false,
    playerLevel: players[0].level,
    foeLevel: Math.max(...foes.map((f) => f.level)),
  });
  battleBusy = false;
  continueResolver = null;
  beginDualCommandPhase();
  showScreen('battle');
  preloadBattleFighterFrames();
}

function startBattle(playerMon, { freshLog = true } = {}) {
  if (pendingEncounter?.dual && pickMode === 'switch') {
    fillDualSlot(playerMon);
    return;
  }
  if (pendingEncounter?.formation && pickMode !== 'switch') {
    startFormationBattle(playerMon);
    return;
  }
  const player = { ...playerMon };
  const foe = { ...pendingEncounter.activeFoe };
  const allies = pendingEncounter.squad
    ? (freshLog ? createRiftAllies() : battle.allies.map((ally) => ({ ...ally })))
    : null;
  battle = { player, foe, playerUid: playerMon.uid, allies, dual: false, formation: false };
  renderBattle();
  if (freshLog) {
    $('battle-log').innerHTML = '<p>对战开始！</p>';
    if (allies) appendLog('3 只电脑宝可梦加入了小队。');
    playBattleBgm({
      rift: !!allies,
      playerLevel: player.level,
      foeLevel: foe.level,
    });
  } else appendLog(`上吧，${SPECIES[player.speciesId].name}！`);
  resetAttackButton();
  showScreen('battle');
  preloadBattleFighterFrames();
}

function startFormationBattle(playerMon) {
  const player = { ...playerMon };
  const foes = pendingEncounter.foes.map((mon) => ({ ...mon, hp: mon.maxHp }));
  pendingEncounter.foes = foes.map((mon) => ({ ...mon }));
  const bossCatchPool = foes
    .filter((f) => f.boss)
    .map((f) => ({ ...f, hp: f.maxHp }));
  const firstFront = foes.findIndex((f) => f.row === 'front' && f.hp > 0);
  battle = {
    formation: true,
    dual: false,
    player,
    playerUid: playerMon.uid,
    allies: createGhostNetherAllies(),
    foes,
    foe: foes[firstFront >= 0 ? firstFront : 0],
    selectedTarget: firstFront >= 0 ? firstFront : 0,
    bossCatchPool,
  };
  ensureFormationTarget();
  renderBattle();
  $('battle-log').innerHTML = '<p>阵型对战开始！</p>';
  appendLog('4 只电脑宝可梦加入了小队。前排未清前无法锁定后排。');
  resetAttackButton();
  showScreen('battle');
}

function fillDualSlot(playerMon) {
  const slot = switchSlotIndex ?? battle.players.findIndex((p) => p.hp <= 0);
  if (slot < 0) return;
  if (battle.playerUids.includes(playerMon.uid)) {
    appendLog('这只已经在场上了。');
    return;
  }
  battle.players[slot] = { ...playerMon };
  battle.playerUids[slot] = playerMon.uid;
  battle.player = battle.players[0];
  battle.playerUid = battle.playerUids[0];
  appendLog(`上吧，${SPECIES[playerMon.speciesId].name}！`);
  switchSlotIndex = null;
  renderBattle();
  resetAttackButton();
  showScreen('battle');
  preloadBattleFighterFrames();
}

function renderSprite(wrapId, mon) {
  const wrap = $(wrapId);
  const sp = SPECIES[mon.speciesId];
  const floats = [...wrap.querySelectorAll('.fx-num')];
  wrap.className = spriteWrapClassName({ shiny: !!mon.shiny, boss: !!mon.boss });
  wrap.innerHTML = `<img src="${pokemonUrl(sp.sprite, 'full')}" alt="${sp.name}" />`;
  for (const num of floats) wrap.appendChild(num);
}

function renderFighterSlot(side, index, mon) {
  const suffix = index === 0 ? '' : '-1';
  const nameId = side === 'player' ? `player-name${suffix}` : `foe-name${suffix}`;
  const tagsId = side === 'foe' ? `foe-tags${suffix}` : null;
  const skillsId = side === 'foe' ? `foe-skills${suffix}` : null;
  const hpId = side === 'player' ? `player-hp${suffix}` : `foe-hp${suffix}`;
  const wrapId = side === 'player' ? `player-sprite-wrap${suffix}` : `foe-sprite-wrap${suffix}`;
  if (!mon) {
    if ($(nameId)) $(nameId).textContent = '——';
    if (tagsId && $(tagsId)) $(tagsId).innerHTML = '';
    if (skillsId && $(skillsId)) $(skillsId).textContent = '';
    if ($(hpId)) setHpBar(hpId, 0, 1);
    if ($(wrapId)) {
      $(wrapId).className = 'sprite-wrap';
      $(wrapId).innerHTML = '';
    }
    return;
  }
  const sp = SPECIES[mon.speciesId];
  if ($(nameId)) $(nameId).textContent = `${sp.name} Lv.${mon.level}`;
  if (tagsId && $(tagsId)) {
    const progress = (side === 'foe' && index === 0 && pendingEncounter?.kind === 'trainer')
      ? `<span class="tag">${pendingEncounter.foeIndex + 1}/${pendingEncounter.foeTeam.length}</span>`
      : '';
    $(tagsId).innerHTML = `
      ${progress}
      ${mon.shiny ? '<span class="tag shiny">闪光</span>' : ''}
      ${mon.boss ? '<span class="tag boss">头目</span>' : ''}
      ${sp.mega ? '<span class="tag mega">超级</span>' : ''}
    `;
  }
  if (skillsId && $(skillsId)) {
    const names = castMoveNames(sp, { squadBoss: pendingEncounter?.squad && side === 'foe' });
    $(skillsId).textContent = names.length ? `技能 ${names.join(' · ')}` : '';
  }
  setHpBar(hpId, mon.hp, mon.maxHp);
  renderSprite(wrapId, mon);
  if ($(wrapId)) $(wrapId).classList.toggle('fainted', mon.hp <= 0);
}

function renderBattle() {
  const field = $('battle-field');
  const dual = !!battle?.dual;
  const formation = !!battle?.formation;
  field?.classList.toggle('dual', dual && !formation);
  field?.classList.toggle('formation-mode', formation);
  for (const el of document.querySelectorAll('.dual-only')) {
    el.classList.toggle('hidden', !dual || formation);
  }
  for (const el of document.querySelectorAll('.formation-only')) {
    el.classList.toggle('hidden', !formation);
  }
  const formEl = $('foe-formation');
  if (formEl) formEl.classList.toggle('hidden', !formation);

  if (formation) {
    renderFormationField();
    return;
  }

  if (dual) {
    renderFighterSlot('foe', 0, battle.foes[0]);
    renderFighterSlot('foe', 1, battle.foes[1]);
    renderFighterSlot('player', 0, battle.players[0]);
    renderFighterSlot('player', 1, battle.players[1]);
    battle.player = battle.players[0];
    battle.foe = battle.foes.find((f) => f.hp > 0) || battle.foes[0];
    renderAllies();
    return;
  }

  const { player, foe } = battle;
  renderFighterSlot('foe', 0, foe);
  renderFighterSlot('player', 0, player);
  renderAllies();
}

function formationChipHp(mon) {
  return Math.max(0, Math.round((mon.hp / mon.maxHp) * 100));
}

function renderFormationField() {
  ensureFormationTarget();
  const back = $('foe-row-back');
  const front = $('foe-row-front');
  if (!back || !front) return;
  back.innerHTML = '';
  front.innerHTML = '';

  const frontUp = battle.foes.some((f) => f.hp > 0 && f.row === 'front');

  battle.foes.forEach((mon, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.foeIndex = String(index);
    // Keep the slot so surviving foes do not shift into the empty space.
    if (mon.hp <= 0) {
      chip.className = 'formation-chip down';
      chip.disabled = true;
      chip.setAttribute('aria-hidden', 'true');
      chip.innerHTML = '<div class="chip-art"></div><div class="chip-meta"></div>';
      if (mon.row === 'back') back.appendChild(chip);
      else front.appendChild(chip);
      return;
    }
    const sp = SPECIES[mon.speciesId];
    const blocked = mon.row === 'back' && frontUp;
    const selected = index === battle.selectedTarget && !blocked;
    chip.className = [
      'formation-chip',
      mon.boss ? 'boss' : '',
      selected ? 'selected' : '',
    ].filter(Boolean).join(' ');
    const pct = formationChipHp(mon);
    chip.innerHTML = `
      <div class="chip-art"><img src="${pokemonUrl(sp.sprite, 'full')}" alt="" /></div>
      <div class="chip-meta">
        <span class="chip-name">${sp.name}</span>
        <div class="hp-bar"><div class="hp-fill${pct <= 25 ? ' low' : ''}" style="width:${pct}%"></div></div>
      </div>
    `;
    chip.addEventListener('click', () => {
      if (blocked) {
        showAppToast('前排还有敌人，无法选中后排');
        return;
      }
      battle.selectedTarget = index;
      battle.foe = battle.foes[index];
      renderFormationField();
    });
    if (mon.row === 'back') back.appendChild(chip);
    else front.appendChild(chip);
  });

  battle.foe = battle.foes[battle.selectedTarget] || battle.foes.find((f) => f.hp > 0) || battle.foes[0];
  const next = $('formation-next');
  if (next) {
    next.textContent = '';
    next.classList.add('hidden');
  }
  renderFormationParty();
}

/** Five equal slots: ally ally player ally ally. */
function renderFormationParty() {
  const row = $('player-row');
  const wrap = $('player-formation');
  if (!row || !wrap) return;
  wrap.classList.remove('hidden');
  const allies = battle.allies || [];
  const slots = [
    { mon: allies[0], role: 'ally', allyIndex: 0 },
    { mon: allies[1], role: 'ally', allyIndex: 1 },
    { mon: battle.player, role: 'player' },
    { mon: allies[2], role: 'ally', allyIndex: 2 },
    { mon: allies[3], role: 'ally', allyIndex: 3 },
  ];
  row.innerHTML = '';
  for (const slot of slots) {
    const mon = slot.mon;
    const chip = document.createElement('div');
    if (!mon) {
      chip.className = 'formation-chip down';
      chip.innerHTML = `<div class="chip-meta"><span class="chip-name">—</span></div>`;
      row.appendChild(chip);
      continue;
    }
    const sp = SPECIES[mon.speciesId];
    const pct = formationChipHp(mon);
    const isPlayer = slot.role === 'player';
    chip.className = [
      'formation-chip',
      isPlayer ? 'player-chip' : 'ally-chip',
      mon.hp <= 0 ? 'fainted' : '',
    ].filter(Boolean).join(' ');
    if (!isPlayer) chip.dataset.allyIndex = String(slot.allyIndex);
    chip.innerHTML = `
      <div class="chip-art"><img src="${pokemonUrl(sp.sprite, 'full')}" alt="" /></div>
      <div class="chip-meta">
        <span class="chip-name">${sp.name}</span>
        <div class="hp-bar"><div class="hp-fill${pct <= 25 ? ' low' : ''}" style="width:${pct}%"></div></div>
      </div>
    `;
    row.appendChild(chip);
  }
  // Keep classic player HP sync target for existing helpers when needed
  const playerHp = $('player-hp');
  if (playerHp && battle.player) {
    setHpBar('player-hp', battle.player.hp, battle.player.maxHp);
  }
  const playerName = $('player-name');
  if (playerName && battle.player) {
    playerName.textContent = SPECIES[battle.player.speciesId]?.name || '';
  }
}

function renderAllies() {
  const row = $('ally-row');
  if (!row) return;
  if (battle?.formation) {
    row.classList.add('hidden');
    row.innerHTML = '';
    renderFormationParty();
    return;
  }
  if (!battle?.allies) {
    row.classList.add('hidden');
    row.innerHTML = '';
    return;
  }
  row.classList.remove('hidden');
  row.innerHTML = battle.allies.map((mon) => {
    const sp = SPECIES[mon.speciesId];
    const pct = Math.max(0, Math.round((mon.hp / mon.maxHp) * 100));
    return `<div class="ally-chip${mon.hp <= 0 ? ' fainted' : ''}">
      <img src="${pokemonUrl(sp.sprite, 'thumb')}" alt="" />
      <div>电脑 ${sp.name}</div>
      <div class="hp-bar"><div class="hp-fill${pct <= 25 ? ' low' : ''}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function setHpBar(id, hp, max) {
  const el = $(id);
  const pct = Math.max(0, Math.round((hp / max) * 100));
  el.style.width = `${pct}%`;
  el.classList.toggle('low', pct <= 25);
}

function appendLog(text) {
  const log = $('battle-log');
  const p = document.createElement('p');
  p.textContent = text;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

function syncBattleHp() {
  if (battle?.dual) {
    for (let i = 0; i < battle.playerUids.length; i += 1) {
      const member = state.party.find((p) => p.uid === battle.playerUids[i]);
      if (member) member.hp = battle.players[i].hp;
    }
    pendingEncounter.foes = battle.foes.map((mon) => ({ ...mon }));
    pendingEncounter.activeFoe = { ...(battle.foes.find((f) => f.hp > 0) || battle.foes[0]) };
    return;
  }
  if (battle?.formation) {
    const member = state.party.find((p) => p.uid === battle.playerUid);
    if (member) member.hp = battle.player.hp;
    pendingEncounter.foes = battle.foes.map((mon) => ({ ...mon }));
    pendingEncounter.activeFoe = {
      ...(battle.foes[battle.selectedTarget]
        || battle.foes.find((f) => f.hp > 0)
        || battle.foes[0]),
    };
    return;
  }
  const member = state.party.find((p) => p.uid === battle.playerUid);
  if (member) member.hp = battle.player.hp;
  pendingEncounter.activeFoe = { ...battle.foe };
  if (pendingEncounter.foeTeam) {
    pendingEncounter.foeTeam[pendingEncounter.foeIndex] = { ...battle.foe };
  }
}

function refreshBattleAnimButton() {
  const btn = $('btn-battle-anim');
  if (!btn) return;
  const mode = normalizeBattleAnim(state.battleAnim);
  state.battleAnim = mode;
  btn.textContent = `动画 · ${BATTLE_ANIM_LABEL[mode]}`;
}

function battleSpeciesIds() {
  if (!battle) return [];
  const ids = [];
  if (battle.dual) {
    for (const mon of battle.players || []) ids.push(mon?.speciesId);
    for (const mon of battle.foes || []) ids.push(mon?.speciesId);
  } else {
    if (battle.player) ids.push(battle.player.speciesId);
    if (battle.foe) ids.push(battle.foe.speciesId);
    for (const mon of battle.allies || []) ids.push(mon?.speciesId);
  }
  return ids;
}

/** Fire-and-forget: warm heavy-mode fight frames while the battle screen is up. */
function preloadBattleFighterFrames() {
  if (normalizeBattleAnim(state.battleAnim) !== 'heavy') return;
  void preloadFighterFrames(battleSpeciesIds());
}

function slotWrap(side, index) {
  const suffix = index === 0 ? '' : '-1';
  return $(side === 'player' ? `player-sprite-wrap${suffix}` : `foe-sprite-wrap${suffix}`);
}

function battleHitElements(line) {
  if (battle?.dual && (line.actorIndex != null || line.targetIndex != null)) {
    const atkSide = line.side;
    const defSide = line.targetSide || (line.side === 'player' ? 'foe' : 'player');
    return {
      attackerEl: slotWrap(atkSide, line.actorIndex || 0),
      defenderEl: slotWrap(defSide, line.targetIndex || 0),
      attackerSpeciesId: atkSide === 'player'
        ? battle.players[line.actorIndex || 0]?.speciesId
        : battle.foes[line.actorIndex || 0]?.speciesId,
    };
  }
  const playerWrap = $('player-sprite-wrap');
  const foeWrap = $('foe-sprite-wrap');
  if (line.side === 'player') {
    return {
      attackerEl: playerWrap,
      defenderEl: foeWrap,
      attackerSpeciesId: battle?.player?.speciesId,
    };
  }
  if (line.side === 'ally') {
    const chips = document.querySelectorAll('#ally-row .ally-chip');
    const chip = chips[line.allyIndex] || null;
    return {
      attackerEl: chip,
      defenderEl: foeWrap,
      attackerSpeciesId: battle?.allies?.[line.allyIndex]?.speciesId,
    };
  }
  // foe hit
  if (line.target === 'ally') {
    const chips = document.querySelectorAll('#ally-row .ally-chip');
    return {
      attackerEl: foeWrap,
      defenderEl: chips[line.allyIndex] || playerWrap,
      attackerSpeciesId: battle?.foe?.speciesId,
    };
  }
  return {
    attackerEl: foeWrap,
    defenderEl: playerWrap,
    attackerSpeciesId: battle?.foe?.speciesId,
  };
}

async function playDualTurnHits(turn) {
  for (let i = 0; i < turn.logs.length; i += 1) {
    const line = turn.logs[i];
    appendLog(line.text);
    const actorIndex = line.actorIndex ?? 0;
    const effectFx = line.effect
      ? {
          attackerEl: slotWrap(line.side, actorIndex),
          defenderEl: slotWrap(line.side, actorIndex),
          attackerSpeciesId: line.side === 'player'
            ? battle.players[actorIndex]?.speciesId
            : battle.foes[actorIndex]?.speciesId,
        }
      : null;
    const { attackerEl, defenderEl, attackerSpeciesId } = effectFx || battleHitElements(line);
    const stripPlayed = await playFighterFrameStrip(attackerEl, {
      speciesId: attackerSpeciesId,
      mode: state.battleAnim,
    });
    if (!stripPlayed) {
      playHit(attackerEl, defenderEl, {
        moveType: line.moveType,
        typeMult: line.typeMult,
        mode: state.battleAnim,
      });
    }
    if (line.playersHp && line.foesHp) {
      line.playersHp.forEach((hp, idx) => {
        const mon = battle.players[idx];
        if (!mon) return;
        mon.hp = hp;
        renderFighterSlot('player', idx, mon);
      });
      line.foesHp.forEach((hp, idx) => {
        const mon = battle.foes[idx];
        if (!mon) return;
        mon.hp = hp;
        renderFighterSlot('foe', idx, mon);
      });
    } else if (line.effect && line.actorIndex != null) {
      const sideArr = line.side === 'player' ? battle.players : battle.foes;
      const source = line.side === 'player' ? turn.players : turn.foes;
      if (sideArr[line.actorIndex] && source[line.actorIndex]) {
        sideArr[line.actorIndex] = { ...source[line.actorIndex] };
        renderFighterSlot(line.side === 'player' ? 'player' : 'foe', line.actorIndex, sideArr[line.actorIndex]);
      }
    } else if (line.side === 'player') {
      const foe = battle.foes[line.targetIndex];
      if (foe) {
        foe.hp = Math.max(0, foe.hp - line.damage);
        renderFighterSlot('foe', line.targetIndex, foe);
      }
    } else {
      const player = battle.players[line.targetIndex];
      if (player) {
        player.hp = Math.max(0, player.hp - line.damage);
        renderFighterSlot('player', line.targetIndex, player);
      }
    }
    syncBattleHp();
    if (line.effect === 'heal') {
      const actor = line.side === 'player' ? battle.players[actorIndex] : battle.foes[actorIndex];
      showHealNumber(attackerEl, Math.floor((actor?.maxHp || 0) * 0.5));
    } else if (!line.effect) {
      showLineNumber(line);
    }
    await wait(HP_ANIM_MS);
    if (battle.foes.every((f) => f.hp <= 0)) {
      await waitForContinue('两只 Boss 都倒下了！');
      break;
    }
    if (i < turn.logs.length - 1) await wait(HIT_GAP_MS);
  }
  battle.players = turn.players.map((mon) => ({ ...mon }));
  battle.foes = turn.foes.map((mon) => ({ ...mon }));
  battle.player = battle.players[0];
  battle.foe = battle.foes.find((f) => f.hp > 0) || battle.foes[0];
  syncBattleHp();
  renderBattle();
}

async function playTurnHits(turn, startPlayer, startFoe) {
  let playerHp = startPlayer.hp;
  let foeHp = startFoe.hp;
  let playerFell = false;
  battle.player = { ...startPlayer };
  battle.foe = { ...startFoe };
  setHpBar('player-hp', playerHp, startPlayer.maxHp);
  setHpBar('foe-hp', foeHp, startFoe.maxHp);

  for (let i = 0; i < turn.logs.length; i += 1) {
    const line = turn.logs[i];
    const playerWasUp = playerHp > 0;
    appendLog(line.text);
    const { attackerEl, defenderEl, attackerSpeciesId } = battleHitElements(line);
    playAttackSfx(line.moveType || 'normal');
    if (line.effect) {
      if (line.side === 'player') {
        playerHp = turn.player.hp;
        battle.player = { ...battle.player, ...turn.player, hp: playerHp };
        setHpBar('player-hp', playerHp, battle.player.maxHp);
        if (line.effect === 'heal') showHealNumber(attackerEl, Math.floor(battle.player.maxHp * 0.5));
      } else if (line.side === 'foe') {
        foeHp = turn.foe.hp;
        battle.foe = { ...battle.foe, ...turn.foe, hp: foeHp };
        setHpBar('foe-hp', foeHp, battle.foe.maxHp);
        if (line.effect === 'heal') showHealNumber(attackerEl, Math.floor(battle.foe.maxHp * 0.5));
      }
      syncBattleHp();
      await wait(HP_ANIM_MS);
      if (i < turn.logs.length - 1) await wait(HIT_GAP_MS);
      continue;
    }
    await playHit({
      side: line.side,
      attackerSpeciesId,
      moveType: line.moveType || 'normal',
      attackerEl,
      defenderEl,
      damage: line.damage,
      mode: state.battleAnim,
    });
    if (line.side === 'player' || line.side === 'ally') {
      foeHp = Math.max(0, foeHp - line.damage);
      battle.foe = { ...battle.foe, hp: foeHp };
      setHpBar('foe-hp', foeHp, battle.foe.maxHp);
    } else if (line.target === 'ally' && battle.allies) {
      const ally = battle.allies[line.allyIndex];
      ally.hp = Math.max(0, ally.hp - line.damage);
      renderAllies();
    } else {
      playerHp = Math.max(0, playerHp - line.damage);
      battle.player = { ...battle.player, hp: playerHp };
      setHpBar('player-hp', playerHp, battle.player.maxHp);
    }
    syncBattleHp();
    showLineNumber(line);
    await wait(HP_ANIM_MS);

    if (playerWasUp && playerHp <= 0) playerFell = true;
    if (foeHp <= 0) {
      const msg = playerFell ? '双方都倒下了！' : `${SPECIES[battle.foe.speciesId].name} 倒下了！`;
      await waitForContinue(msg);
      break;
    }
    if (i < turn.logs.length - 1) await wait(HIT_GAP_MS);
  }

  if (playerFell && foeHp > 0) {
    await waitForContinue(`${SPECIES[battle.player.speciesId].name} 倒下了！`);
  }

  battle.player = turn.player;
  battle.foe = turn.foe;
  if (turn.allies) battle.allies = turn.allies.map((ally) => ({ ...ally }));
  syncBattleHp();
  renderAllies();
}

function showLineNumber(line) {
  const { defenderEl } = battleHitElements(line);
  playDamageNumber(defenderEl, {
    amount: line.damage,
    typeMult: line.typeMult,
    crit: !!line.crit,
    enabled: state.damageNumbers !== false,
  });
}

function showHealNumber(anchorEl, amount) {
  playDamageNumber(anchorEl, {
    amount,
    heal: true,
    enabled: state.damageNumbers !== false,
  });
}

function grantRiftFruit(foe) {
  const n = riftFruitDrop(foe?.speciesId);
  if (!n) return;
  state.riftFruit = (state.riftFruit || 0) + n;
  appendLog(`获得了 ${n} 个异次元果！`);
  refreshHeader();
  save();
}

function dualBackupCount() {
  const onField = new Set(battle.playerUids || []);
  return activeParty(state.party).filter((p) => p.hp > 0 && !onField.has(p.uid)).length;
}

function finishDualTurnOutcome(turn) {
  if (turn.result === 'win' || turn.result === 'draw') {
    const evolved = awardDualXp();
    if (turn.result === 'win') {
      appendLog('胜利！');
      finishBattleWin(evolved);
      return;
    }
    appendLog('同归于尽…你败北了。');
    setMoveButtonsBusy(true);
    $('btn-flee-battle').disabled = true;
    setTimeout(() => leaveBattle(), evolved ? 1400 : 900);
    return;
  }
  if (turn.result === 'lose') {
    appendLog('你没有可以继续对战的宝可梦了…');
    setMoveButtonsBusy(true);
    $('btn-flee-battle').disabled = true;
    setTimeout(() => leaveBattle(), 900);
    return;
  }
  if (turn.result === 'switch') {
    const slot = battle.players.findIndex((p) => p.hp <= 0);
    if (slot >= 0 && dualBackupCount() > 0) {
      appendLog('换上下一只补位吧。');
      openSwitchPick(slot);
      return;
    }
  }
  resetAttackButton();
}

function finishFormationTurnOutcome(turn) {
  if (turn.result === 'win') {
    appendLog('胜利！阵型溃散！');
    const evolved = awardFormationXp();
    finishBattleWin(evolved);
    return;
  }
  if (turn.result === 'lose' || turn.result === 'draw') {
    appendLog(turn.result === 'draw'
      ? '同归于尽…你败北了。'
      : '你的宝可梦倒下了…阵型战失败。');
    $('btn-attack').disabled = true;
    $('btn-flee-battle').disabled = true;
    setTimeout(() => leaveBattle(), 900);
    return;
  }
  resetAttackButton();
}

function awardFormationXp() {
  const fighter = state.party.find((p) => p.uid === battle.playerUid);
  if (!fighter) return false;
  const pool = battle.bossCatchPool?.length
    ? battle.bossCatchPool
    : (battle.foes || []).filter((f) => f.boss);
  const totalLevel = pool.reduce((sum, foe) => sum + foe.level, 0);
  const dummy = {
    level: Math.floor(totalLevel / Math.max(1, pool.length)) || (battle.foe?.level || 1),
    boss: true,
  };
  const wasFainted = fighter.hp <= 0;
  const amount = xpReward(dummy, { trainer: false });
  const xpLogs = gainExperience(fighter, amount);
  if (wasFainted) fighter.hp = 0;
  for (const line of xpLogs) appendLog(line);
  if (!wasFainted) {
    battle.player = { ...fighter };
    renderBattle();
  }
  return xpLogs.some((line) => line.includes('进化'));
}

function finishTurnOutcome(turn) {
  if (battle?.dual) {
    finishDualTurnOutcome(turn);
    return;
  }
  if (battle?.formation) {
    finishFormationTurnOutcome(turn);
    return;
  }
  if (battle.foe.hp <= 0) grantRiftFruit(battle.foe);
  if (turn.result === 'switch') {
    const backup = activeParty(state.party).filter((p) => p.uid !== battle.playerUid && p.hp > 0).length;
    if (backup > 0) {
      appendLog('换上下一只吧。电脑同伴还在。');
      openSwitchPick();
      return;
    }
    appendLog('没有可以替换的宝可梦了，电脑同伴继续应战。');
    resetAttackButton();
    return;
  }
  const foeRemaining = pendingEncounter.kind === 'trainer'
    ? pendingEncounter.foeTeam.length - pendingEncounter.foeIndex - 1
    : 0;
  const playerBackup = activeParty(state.party).filter((p) => p.uid !== battle.playerUid && p.hp > 0).length;
  const step = nextBattleStep({ result: turn.result, foeRemaining, playerBackup });
  const evolved = (turn.result === 'win' || turn.result === 'draw')
    ? awardXp(pendingEncounter.activeFoe)
    : false;

  if (step === 'continue') {
    resetAttackButton();
    return;
  }
  if (step === 'send-foe') {
    sendNextFoe();
    resetAttackButton();
    return;
  }
  if (step === 'send-player') {
    appendLog('换上下一只吧。');
    openSwitchPick();
    return;
  }
  if (step === 'send-both') {
    appendLog('双方都需要换上下一只。');
    sendNextFoe();
    openSwitchPick();
    return;
  }
  if (step === 'victory') {
    appendLog('胜利！');
    finishBattleWin(evolved);
    return;
  }
  appendLog(turn.result === 'draw' ? '同归于尽…你败北了。' : '你没有可以继续对战的宝可梦了…');
  setBattleActionBusy(true);
  setTimeout(() => leaveBattle(), evolved ? 1400 : 900);
}

function onAttack() {
  if (!battle?.dual) return;
  if (continueResolver) continueResolver();
}

async function onPickMove(move) {
  if (continueResolver) {
    continueResolver();
    return;
  }
  if (battle?.dual) return;
  if (!battle || battleBusy) return;
  if (move.effect && battle.player.usedUtility) return;
  battleBusy = true;
  setBattleActionBusy(true);
  try {
    // Formation must use full-field resolve — 1v1 / squad vs battle.foe would
    // declare win as soon as the aimed chip falls.
    if (battle.formation) {
      const turn = resolveFormationTurn(battle.player, battle.allies || [], battle.foes, {
        playerTargetIndex: battle.selectedTarget,
        playerMove: move,
      });
      await playFormationTurnHits(turn);
      finishTurnOutcome(turn);
      return;
    }
    const startPlayer = { ...battle.player };
    const startFoe = { ...battle.foe };
    const foeMove = chooseFoeMove(startFoe, startPlayer);
    const startAllies = battle.allies ? battle.allies.map((ally) => ({ ...ally })) : null;
    const turn = startAllies
      ? resolveSquadTurn(startPlayer, startAllies, startFoe, Math.random, move, chooseFoeMove(startFoe, startPlayer))
      : resolveTurn(startPlayer, startFoe, Math.random, move, foeMove);
    await playTurnHits(turn, startPlayer, startFoe);
    finishTurnOutcome(turn);
  } catch (err) {
    console.error(err);
    resetAttackButton();
  }
}

async function onUseItem(itemId) {
  if (!battle || battleBusy || continueResolver) return;
  const item = ITEMS[itemId];
  if (!item || (state.items?.[itemId] || 0) <= 0) return;
  const target = autoTargetForItem(item);
  if (!target) return;

  const fighter = state.party.find((p) => p.uid === target.uid);
  if (!fighter) return;

  if (target.onField && target.index >= 0) {
    const fieldMon = onFieldMons()[target.index];
    if (fieldMon) fighter.hp = fieldMon.hp;
  }

  closeItemPanel();
  battleBusy = true;
  setBattleActionBusy(true);
  if (battle.dual) {
    dualCmds = [null, null];
    dualCmdPhase = null;
    pendingMove = null;
    clearTargetHighlight();
    setDualCmdChrome({
      hint: '',
      showMoves: false,
      showSwitch: false,
      showBack: false,
      showUndo: false,
      hideAttack: true,
    });
  }

  const result = applyItem(fighter, itemId);
  if (!result.ok) {
    battleBusy = false;
    setBattleActionBusy(false);
    if (battle.dual) beginDualCommandPhase();
    return;
  }
  state.items[itemId] -= 1;

  if (target.onField && target.index >= 0) {
    if (battle.dual) {
      const prev = battle.players[target.index];
      battle.players[target.index] = withBattleState({
        ...fighter,
        usedUtility: prev?.usedUtility ?? false,
        atkMul: prev?.atkMul ?? 1,
        defMul: prev?.defMul ?? 1,
      });
      battle.player = battle.players[0];
    } else {
      const prev = battle.player;
      battle.player = withBattleState({
        ...fighter,
        usedUtility: prev?.usedUtility ?? false,
        atkMul: prev?.atkMul ?? 1,
        defMul: prev?.defMul ?? 1,
      });
    }
  }

  if (result.kind === 'heal') {
    appendLog(`使用了 ${item.name}！${SPECIES[fighter.speciesId].name} 回复了 ${result.amount} 点 HP！`);
  } else if (result.kind === 'revive') {
    appendLog(`使用了 ${item.name}！${SPECIES[fighter.speciesId].name} 复活了！（HP ${fighter.hp}/${fighter.maxHp}）`);
  } else if (result.kind === 'xp') {
    appendLog(`使用了 ${item.name}！`);
    for (const line of result.logs || []) appendLog(line);
  }
  save();
  renderBattle();
  if (result.kind === 'heal' || result.kind === 'revive') {
    const healAmt = result.kind === 'heal' ? result.amount : fighter.hp;
    const wrap = battle.dual && target.index >= 0
      ? slotWrap('player', target.index)
      : $('player-sprite-wrap');
    showHealNumber(wrap, healAmt);
  }

  try {
    if (battle.dual) {
      const startPlayers = battle.players.map((mon) => ({ ...mon }));
      const startFoes = battle.foes.map((mon) => ({ ...mon }));
      const foeCmds = startFoes.map((mon, index) => (
        mon.hp > 0 ? chooseDualFoeCmd(withBattleState(mon), index, startPlayers) : null
      ));
      const turn = resolveDualItemTurn(startPlayers, startFoes, Math.random, foeCmds);
      await playDualTurnHits(turn);
      finishTurnOutcome(turn);
      return;
    }
    if (battle.formation) {
      const turn = resolveFormationTurn(battle.player, battle.allies, battle.foes, {
        playerTargetIndex: battle.selectedTarget,
        playerMove: formationPlayerMove(),
      });
      await playFormationTurnHits(turn);
      finishTurnOutcome(turn);
      return;
    }
    const startPlayer = { ...battle.player };
    const startFoe = { ...battle.foe };
    const startAllies = battle.allies ? battle.allies.map((ally) => ({ ...ally })) : null;
    const turn = startAllies
      ? resolveSquadItemTurn(startPlayer, startAllies, startFoe)
      : resolveFoeOnlyTurn(startPlayer, startFoe);
    await playTurnHits(turn, startPlayer, startFoe);
    finishTurnOutcome(turn);
  } catch (err) {
    console.error(err);
    resetAttackButton();
  }
}

function monAcceptsItem(mon, item) {
  if (!mon || !item) return false;
  if (item.effect === 'heal') return mon.hp > 0 && mon.hp < mon.maxHp;
  if (item.effect === 'revive') return mon.hp <= 0;
  if (item.effect === 'xp') return true;
  return false;
}

function renderItemsModalList() {
  const list = $('items-list');
  if (!list) return;
  list.innerHTML = '';
  const inBattle = isBattleScreenActive();
  for (const item of Object.values(ITEMS)) {
    const owned = state.items?.[item.id] || 0;
    if (owned <= 0) continue;
    const usable = inBattle
      ? ownedItemUsableInBattle(item)
      : state.party.some((m) => monAcceptsItem(m, item));
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'item-row';
    row.disabled = !usable;
    if (!usable) row.title = '现在不能使用';
    row.innerHTML = `
      <span class="item-icon">${item.icon}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-effect">${itemEffectLabel(item)}</span>
      <span class="item-owned">×${owned}</span>
    `;
    row.addEventListener('click', () => {
      if (inBattle) onUseItem(item.id);
      else openItemsTargetPicker(item.id);
    });
    list.appendChild(row);
  }
  if (!list.children.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '没有道具';
    list.appendChild(empty);
  }
}

function openItemsTargetPicker(itemId) {
  const item = ITEMS[itemId];
  if (!item || (state.items?.[itemId] || 0) <= 0) return;
  itemsUiSelectedId = itemId;
  const list = $('items-target-list');
  list.innerHTML = '';
  for (const mon of state.party) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'party-card';
    const ok = monAcceptsItem(mon, item);
    btn.disabled = !ok;
    const sp = SPECIES[mon.speciesId];
    btn.textContent = `${sp?.name || mon.speciesId} Lv.${mon.level}  HP ${mon.hp}/${mon.maxHp}`;
    btn.addEventListener('click', () => onItemsUseOutOfBattle(mon.uid));
    list.appendChild(btn);
  }
  $('items-step-list').classList.add('hidden');
  $('items-step-target').classList.remove('hidden');
  $('items-title').textContent = '选择宝可梦';
}

function onItemsUseOutOfBattle(uid) {
  const item = ITEMS[itemsUiSelectedId];
  const mon = state.party.find((p) => p.uid === uid);
  if (!item || !mon || (state.items?.[item.id] || 0) <= 0) return;
  if (!monAcceptsItem(mon, item)) return;
  const result = applyItem(mon, item.id);
  if (!result.ok) return;
  state.items[item.id] -= 1;
  const lines = [];
  if (result.kind === 'heal') {
    lines.push(`使用了 ${item.name}！${SPECIES[mon.speciesId].name} 回复了 ${result.amount} 点 HP！`);
  } else if (result.kind === 'revive') {
    lines.push(`使用了 ${item.name}！${SPECIES[mon.speciesId].name} 复活了！（HP ${mon.hp}/${mon.maxHp}）`);
  } else if (result.kind === 'xp') {
    lines.push(`使用了 ${item.name}！`);
    for (const line of result.logs || []) lines.push(line);
  }
  showAppToast(lines.join(' '));
  save();
  renderParty($('party-list'), false);
  closeItemsModal();
}

function openItemsUi() {
  if (isBattleScreenActive() && (battleBusy || continueResolver)) return;
  $('items-title').textContent = '道具';
  $('items-step-list').classList.remove('hidden');
  $('items-step-target').classList.add('hidden');
  renderItemsModalList();
  $('items-modal').classList.remove('hidden');
}

function formationFoeChip(index) {
  return document.querySelector(`.formation-chip[data-foe-index="${index}"]`);
}

function formationAllyChip(index) {
  return document.querySelector(`#player-row .ally-chip[data-ally-index="${index}"]`);
}

function formationPlayerChip() {
  return document.querySelector('#player-row .player-chip');
}

function formationHitElements(line) {
  if (line.side === 'player') {
    return {
      attackerEl: formationPlayerChip(),
      defenderEl: formationFoeChip(line.targetIndex),
      attackerSpeciesId: battle?.player?.speciesId,
    };
  }
  if (line.side === 'ally') {
    return {
      attackerEl: formationAllyChip(line.allyIndex),
      defenderEl: formationFoeChip(line.targetIndex),
      attackerSpeciesId: battle?.allies?.[line.allyIndex]?.speciesId,
    };
  }
  // foe
  const defenderEl = line.target === 'ally'
    ? formationAllyChip(line.allyIndex)
    : formationPlayerChip();
  return {
    attackerEl: formationFoeChip(line.actorIndex),
    defenderEl,
    attackerSpeciesId: battle?.foes?.[line.actorIndex]?.speciesId,
  };
}

/** Update chip HP bar in place; KO foes become empty placeholders without reflow. */
function paintFormationChipHp(chip, mon) {
  if (!chip || !mon) return;
  if (chip.dataset.foeIndex != null && mon.hp <= 0) {
    chip.className = 'formation-chip down';
    chip.disabled = true;
    chip.setAttribute('aria-hidden', 'true');
    chip.innerHTML = '<div class="chip-art"></div><div class="chip-meta"></div>';
    return;
  }
  const pct = formationChipHp(mon);
  const fill = chip.querySelector('.hp-fill');
  if (fill) {
    fill.style.width = `${pct}%`;
    fill.classList.toggle('low', pct <= 25);
  }
  if (mon.hp <= 0) chip.classList.add('fainted');
}

function applyFormationLogHp(line) {
  if (line.effect) {
    if (line.side === 'player' && battle.player) {
      // Effect already applied in resolve; sync from turn at end. Soft-paint current.
      paintFormationChipHp(formationPlayerChip(), battle.player);
    }
    return;
  }
  if (line.side === 'foe') {
    if (line.target === 'ally' && battle.allies?.[line.allyIndex]) {
      const ally = battle.allies[line.allyIndex];
      ally.hp = Math.max(0, ally.hp - (line.damage || 0));
      paintFormationChipHp(formationAllyChip(line.allyIndex), ally);
    } else if (battle.player) {
      battle.player.hp = Math.max(0, battle.player.hp - (line.damage || 0));
      paintFormationChipHp(formationPlayerChip(), battle.player);
    }
    return;
  }
  const foe = battle.foes?.[line.targetIndex];
  if (!foe) return;
  foe.hp = Math.max(0, foe.hp - (line.damage || 0));
  paintFormationChipHp(formationFoeChip(line.targetIndex), foe);
  if (line.targetIndex === battle.selectedTarget && foe.hp <= 0) ensureFormationTarget();
}

async function playFormationTurnHits(turn) {
  for (let i = 0; i < turn.logs.length; i += 1) {
    const line = turn.logs[i];
    appendLog(line.text);
    const { attackerEl, defenderEl, attackerSpeciesId } = formationHitElements(line);
    playAttackSfx(line.moveType || 'normal');
    if (line.effect) {
      if (line.side === 'player' && turn.player) {
        battle.player = { ...battle.player, ...turn.player };
        paintFormationChipHp(formationPlayerChip(), battle.player);
        if (line.effect === 'heal') {
          showHealNumber(attackerEl, Math.floor((battle.player.maxHp || 0) * 0.5));
        }
      }
      syncBattleHp();
      await wait(HP_ANIM_MS);
      if (i < turn.logs.length - 1) await wait(HIT_GAP_MS);
      continue;
    }
    await playHit({
      side: line.side,
      attackerSpeciesId,
      moveType: line.moveType || 'normal',
      attackerEl,
      defenderEl,
      mode: state.battleAnim,
    });
    applyFormationLogHp(line);
    syncBattleHp();
    playDamageNumber(defenderEl, {
      amount: line.damage,
      typeMult: line.typeMult,
      crit: !!line.crit,
      enabled: state.damageNumbers !== false,
    });
    await wait(HP_ANIM_MS);
    if (i < turn.logs.length - 1) await wait(HIT_GAP_MS);
  }
  battle.player = turn.player;
  battle.allies = turn.allies.map((ally) => ({ ...ally }));
  battle.foes = turn.foes.map((mon) => ({ ...mon }));
  ensureFormationTarget();
  syncBattleHp();
  renderBattle();
  if (turn.result === 'win') {
    await waitForContinue('敌人全灭！');
  } else if (turn.result === 'lose' || turn.result === 'draw') {
    await waitForContinue(`${SPECIES[battle.player.speciesId].name} 倒下了！`);
  }
}

function awardXp(foe) {
  const fighter = state.party.find((p) => p.uid === battle.playerUid);
  if (!fighter) return false;
  const wasFainted = fighter.hp <= 0;
  const amount = xpReward(foe, { trainer: pendingEncounter.kind === 'trainer' });
  const xpLogs = gainExperience(fighter, amount);
  if (wasFainted) fighter.hp = 0;
  for (const line of xpLogs) appendLog(line);
  if (!wasFainted) {
    battle.player = { ...fighter };
    renderBattle();
  }
  return xpLogs.some((line) => line.includes('进化'));
}

function awardDualXp() {
  let evolved = false;
  const totalLevel = battle.foes.reduce((sum, foe) => sum + foe.level, 0);
  const dummy = { level: Math.floor(totalLevel / Math.max(1, battle.foes.length)), boss: true };
  for (let i = 0; i < battle.playerUids.length; i += 1) {
    const fighter = state.party.find((p) => p.uid === battle.playerUids[i]);
    if (!fighter) continue;
    const wasFainted = fighter.hp <= 0 || battle.players[i].hp <= 0;
    const amount = xpReward(dummy, { trainer: false });
    const xpLogs = gainExperience(fighter, amount);
    if (wasFainted) fighter.hp = 0;
    for (const line of xpLogs) appendLog(line);
    if (xpLogs.some((line) => line.includes('进化'))) evolved = true;
    if (!wasFainted) battle.players[i] = { ...fighter };
  }
  renderBattle();
  return evolved;
}

function sendNextFoe() {
  pendingEncounter.foeIndex += 1;
  const next = pendingEncounter.foeTeam[pendingEncounter.foeIndex];
  const sent = { ...next, hp: next.maxHp };
  pendingEncounter.activeFoe = sent;
  pendingEncounter.foeTeam[pendingEncounter.foeIndex] = sent;
  battle.foe = { ...sent };
  appendLog(`${pendingEncounter.trainerName} 派出了 ${SPECIES[sent.speciesId].name}！`);
  renderBattle();
  preloadBattleFighterFrames();
  if (battle?.player) {
    playBattleBgm({
      rift: !!battle.allies,
      playerLevel: battle.player.level,
      foeLevel: sent.level,
    });
  }
}

function openSwitchPick(slotIndex = null) {
  pickMode = 'switch';
  switchSlotIndex = slotIndex;
  $('pick-title').textContent = battle?.dual ? '选择补位宝可梦' : '选择下一只';
  $('btn-cancel-pick').classList.add('hidden');
  if (battle?.dual) {
    const living = battle.foes.filter((f) => f.hp > 0).map((f) => SPECIES[f.speciesId].name).join(' & ');
    $('pick-foe-info').textContent = `对手仍在：${living}`;
    const onField = new Set(battle.playerUids);
    const choices = activeParty(state.party).filter((p) => p.hp > 0 && !onField.has(p.uid));
    renderParty($('pick-party'), true, (mon) => startBattle(mon, { freshLog: false }), choices, { onlyConscious: true });
    showScreen('pick');
    return;
  }
  const foe = battle.foe;
  const sp = SPECIES[foe.speciesId];
  $('pick-foe-info').textContent = `对手：${sp.name} Lv.${foe.level} · HP ${foe.hp}/${foe.maxHp}`;
  renderParty($('pick-party'), true, (mon) => startBattle(mon, { freshLog: false }), activeParty(state.party), { onlyConscious: true });
  showScreen('pick');
}

function openCatchPick() {
  pickMode = 'catch';
  playExploreBgm();
  $('btn-cancel-pick').classList.remove('hidden');
  $('btn-cancel-pick').textContent = '放弃捕捉';
  if (pendingEncounter.dual) {
    $('pick-title').textContent = '选择要捕捉的 Boss（只能抓 1 只）';
    $('pick-foe-info').textContent = '双打胜利！从倒下的两只里选一只捕捉。';
    renderParty($('pick-party'), true, (mon) => {
      pendingEncounter.activeFoe = mon;
      enterCatch(pendingEncounter);
    }, pendingEncounter.foes);
    showScreen('pick');
    return;
  }
  $('pick-title').textContent = '选择要捕捉的宝可梦';
  $('pick-foe-info').textContent = `训练家 ${pendingEncounter.trainerName} 倒下了。选一只捕捉。`;
  renderParty($('pick-party'), true, (mon) => {
    pendingEncounter.activeFoe = mon;
    enterCatch(pendingEncounter);
  }, pendingEncounter.foeTeam);
  showScreen('pick');
}

function leaveBattle({ wipeMaze = true } = {}) {
  closeItemPanel();
  battle = null;
  battleBusy = false;
  continueResolver = null;
  for (const p of state.party) p.hp = p.maxHp;
  save();
  playExploreBgm();
  if (inSpiritHall()) {
    if (wipeMaze) failMazeRun();
    else returnAfterMazeBattle();
    updateItemButton();
    return;
  }
  openMap(currentMapId);
  updateItemButton();
}

function finishBattleWin(evolved) {
  setBattleActionBusy(true);
  const enc = pendingEncounter;
  if (enc.kind === 'trainer' && enc.reward) {
    state.coins += enc.reward;
    appendLog(`获得 ${enc.reward} 金币！`);
    refreshHeader();
  }
  if (currentMapId === 'twin_towers' && enc.dual) {
    state.twinCleared = true;
  }
  for (const p of state.party) p.hp = p.maxHp;
  save();
  setTimeout(() => {
    if (enc.formation) beginNetherCatchQueue();
    else if (enc.kind === 'trainer' || enc.dual) openCatchPick();
    else enterCatch(enc);
  }, evolved ? 1400 : 900);
}

/** Sequential catch/skip for the 3 formation bosses (dual-style pick + skip). */
function beginNetherCatchQueue() {
  const pool = (battle?.bossCatchPool?.length
    ? battle.bossCatchPool
    : (pendingEncounter?.foes || []).filter((f) => f.boss))
    .map((f) => ({ ...f, hp: f.maxHp }));
  pendingEncounter.formationCatchQueue = pool;
  advanceFormationCatch();
}

function advanceFormationCatch() {
  const queue = pendingEncounter?.formationCatchQueue;
  if (!queue?.length) {
    markCleared();
    save();
    if (catchCtrl) {
      catchCtrl.destroy();
      catchCtrl = null;
    }
    openMap(currentMapId);
    return;
  }
  const next = queue[0];
  pickMode = 'formation-catch';
  $('btn-cancel-pick').classList.remove('hidden');
  $('btn-cancel-pick').textContent = '跳过';
  $('pick-title').textContent = `捕捉头目？（剩余 ${queue.length}/3）`;
  $('pick-foe-info').textContent = `点选开始捕捉 ${SPECIES[next.speciesId].name}，或点「跳过」处理下一只。`;
  renderParty($('pick-party'), true, (mon) => {
    pendingEncounter.activeFoe = { ...mon, hp: mon.maxHp };
    enterCatch(pendingEncounter);
  }, [next]);
  showScreen('pick');
}

function skipFormationCatchOne() {
  if (!pendingEncounter?.formationCatchQueue?.length) {
    advanceFormationCatch();
    return;
  }
  pendingEncounter.formationCatchQueue.shift();
  advanceFormationCatch();
}

function ballTag(ball) {
  if (ball.alwaysCatch) return '必定抓住';
  if (ball.firstThrowBonus && throwsThisEncounter === 0) return '第一球更易';
  if (ball.id === 'ultra') return '捕获率最高';
  if (ball.id === 'great') return '捕获率较高';
  return '';
}

function catchHint() {
  return state.catchStyle === 'sling'
    ? '按住底部的球，向后拉开再松手。'
    : '按住底部的球，朝宝可梦甩出。';
}

function setCatchResult(text, kind) {
  const result = $('catch-result');
  result.textContent = text;
  result.className = kind ? `catch-result ${kind}` : 'catch-result';
}

function breakoutLine(shakes) {
  if (shakes >= 2) return '就差一下……挣脱了。';
  if (shakes === 1) return '挣扎了一下，挣脱了。';
  return '球弹开了。';
}

function updateCatchCopy() {
  const foe = pendingEncounter?.catchTarget;
  if (!foe) return;
  const sp = SPECIES[foe.speciesId];
  const tags = [foe.boss ? '头目' : '', foe.shiny ? '闪光' : ''].filter(Boolean);
  const tag = tags.length ? `（${tags.join('，')}）` : '';
  $('catch-info').textContent = `捕捉 ${sp.name}${tag}。${catchHint()}`;
  const chance = catchProbability(foe, selectedBallId, {
    mapId: currentMapId,
    throwsThisEncounter,
  });
  $('catch-outlook').textContent = catchOutlook(chance);
}

function renderCatchStyle() {
  const root = $('catch-style');
  if (!root) return;
  const busy = !!catchCtrl?.isBusy();
  for (const btn of root.querySelectorAll('button')) {
    btn.classList.toggle('selected', btn.dataset.style === state.catchStyle);
    btn.disabled = busy;
  }
}

function setCatchSkipEnabled(enabled) {
  const btn = $('btn-skip-catch');
  if (btn) btn.disabled = !enabled;
}

function enterCatch(enc) {
  throwsThisEncounter = 0;
  catchQueueLock = false;
  setCatchSkipEnabled(true);
  const foe = { ...enc.activeFoe };
  // Fainted for catch — hpFactor uses current hp; keep low hp for better catch
  foe.hp = Math.max(1, Math.floor(foe.maxHp * 0.05));
  pendingEncounter.catchTarget = foe;

  if (catchCtrl) {
    catchCtrl.destroy();
    catchCtrl = null;
  }

  playExploreBgm();
  setCatchResult('');
  updateCatchCopy();
  renderCatchStyle();
  renderBallPicker();
  showScreen('catch');

  const canvas = $('catch-canvas');
  catchCtrl = createCatchController(canvas, {
    targetPokemon: foe,
    mapId: currentMapId,
    getSelectedBall: () => selectedBallId,
    getCatchStyle: () => state.catchStyle,
    canThrow: () => (state.balls[selectedBallId] || 0) > 0,
    onAim: () => setCatchResult(''),
    onWeakThrow: () => setCatchResult('再拉远一点。', 'soft'),
    onEmpty: () => setCatchResult('没有这种球了！', 'fail'),
    onThrowStart: () => {
      state.balls[selectedBallId] -= 1;
      save();
      renderBallPicker();
      refreshHeader();
    },
    onThrowLanded: ({ hit }) => settleThrow(hit),
    onBusyChange: (busy) => {
      renderCatchStyle();
      renderBallPicker();
      if (!busy) updateCatchCopy();
    },
  });
}

function renderBallPicker() {
  const box = $('ball-picker');
  box.innerHTML = '';
  const busy = !!catchCtrl?.isBusy();
  const owned = Object.keys(BALLS).filter((id) => (state.balls[id] || 0) > 0);
  if (!busy && !owned.includes(selectedBallId)) {
    selectedBallId = owned[0] || 'poke';
  }
  for (const id of Object.keys(BALLS)) {
    const ball = BALLS[id];
    const count = state.balls[id] || 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ball-option${id === selectedBallId ? ' selected' : ''}`;
    btn.disabled = busy || count <= 0;
    btn.innerHTML = `
      <img src="${assetUrl(ball.sprite)}" alt="" />
      <div>${ball.name}</div>
      <div class="tag">${ballTag(ball)}</div>
      <div class="count">×${count}</div>
    `;
    btn.addEventListener('click', () => {
      if (busy || count <= 0 || catchCtrl?.isBusy()) return;
      selectedBallId = id;
      renderBallPicker();
      updateCatchCopy();
      catchCtrl?.reloadBall();
    });
    box.appendChild(btn);
  }
}

function settleThrow(hit) {
  const ballId = selectedBallId;
  if (!hit) {
    throwsThisEncounter += 1;
    setCatchResult('没打中。', 'fail');
    return;
  }

  const { success, shakes } = catchChance(pendingEncounter.catchTarget, ballId, {
    mapId: currentMapId,
    throwsThisEncounter,
  });
  throwsThisEncounter += 1;

  if (success && state.party.length >= PARTY_CAP) {
    state.balls[ballId] += 1;
    save();
    catchCtrl?.cancelHold();
    renderBallPicker();
    refreshHeader();
    setCatchResult(`队伍已满（${state.party.length}/${PARTY_CAP}），卖掉一只后再捕捉。球已退回。`, 'fail');
    return;
  }

  // Lock skip before shake animation so it cannot race claimPokemon.
  if (success && pendingEncounter?.formationCatchQueue?.length) {
    catchQueueLock = true;
    setCatchSkipEnabled(false);
  }

  catchCtrl?.playOutcome({
    shakes,
    caught: success,
    onDone() {
      if (success) {
        playCatchSuccessSfx();
        setCatchResult('咔哒！抓住了！', 'ok');
        claimPokemon(pendingEncounter.catchTarget);
      } else {
        setCatchResult(breakoutLine(shakes), 'fail');
      }
    },
  });
}

function markCleared() {
  if (pendingEncounter?.squad || pendingEncounter?.dual || pendingEncounter?.formation) return;
  if (!pendingEncounter?.id) return;
  state.cleared[`${currentMapId}:${pendingEncounter.id}`] = true;
}

function claimPokemon(foe) {
  const mon = createPokemon(foe.speciesId, foe.level, {
    shiny: foe.shiny,
    boss: foe.boss,
  });
  const evoMsgs = tryEvolve(mon);
  state.party.push(mon);
  if (evoMsgs.length) {
    const result = $('catch-result');
    result.textContent = `${result.textContent} ${evoMsgs.join(' ')}`;
  }
  const inFormationQueue = !!pendingEncounter?.formationCatchQueue?.length;
  if (inFormationQueue) {
    // Shift now so a late skip cannot double-advance during the celebration.
    pendingEncounter.formationCatchQueue.shift();
    catchQueueLock = true;
    setCatchSkipEnabled(false);
  } else {
    markCleared();
  }
  save();
  setTimeout(() => {
    if (catchCtrl) {
      catchCtrl.destroy();
      catchCtrl = null;
    }
    if (inFormationQueue) {
      catchQueueLock = false;
      setCatchSkipEnabled(true);
      advanceFormationCatch();
      return;
    }
    resumeAfterMazeCatch();
  }, 1000);
}

function skipCatch() {
  if (catchQueueLock || catchCtrl?.isBusy()) return;
  if (pendingEncounter?.formationCatchQueue?.length) {
    if (catchCtrl) {
      catchCtrl.destroy();
      catchCtrl = null;
    }
    skipFormationCatchOne();
    return;
  }
  markCleared();
  save();
  if (catchCtrl) {
    catchCtrl.destroy();
    catchCtrl = null;
  }
  resumeAfterMazeCatch();
}

function refreshAllEncounters() {
  for (const mapId of Object.keys(MAPS)) {
    state.encounters[mapId] = rollEncounters(mapId, state.hasShinyCharm);
  }
  state.cleared = {};
  save();
  renderSelect();
}

function openResetConfirm() {
  $('reset-modal').classList.remove('hidden');
}

function closeResetConfirm() {
  $('reset-modal').classList.add('hidden');
}

function resetGame() {
  closeResetConfirm();
  localStorage.removeItem(STORAGE_KEY);
  state = bootState();
  save();
  showScreen('select');
  renderSelect();
}

// Wire UI
$('btn-back-select').addEventListener('click', () => {
  showScreen('select');
  renderSelect();
});
$('btn-cancel-pick').addEventListener('click', () => {
  if (pickMode === 'dual-voluntary') {
    showScreen('battle');
    enterDualAction(dualCmdSlot);
    return;
  }
  if (pickMode === 'formation-catch') skipFormationCatchOne();
  else if (pickMode === 'catch') skipCatch();
  else returnAfterMazeBattle();
});
$('btn-attack')?.addEventListener('click', onAttack);
$('btn-switch-cmd')?.addEventListener('click', onDualSwitchCmd);
$('btn-cmd-back')?.addEventListener('click', () => {
  if (dualCmdPhase === 'target' || dualCmdPhase === 'switch') enterDualAction(dualCmdSlot);
});
$('btn-cmd-undo')?.addEventListener('click', () => {
  if (dualCmdPhase !== 'action') return;
  for (let i = dualCmdSlot - 1; i >= 0; i -= 1) {
    if (dualCmds[i]) {
      if (dualCmds[i]?.type === 'switch' && dualSwitchBackup[i]) {
        const bak = dualSwitchBackup[i];
        const curUid = battle.playerUids[i];
        const curParty = state.party.find((p) => p.uid === curUid);
        if (curParty) curParty.hp = battle.players[i].hp;
        battle.players[i] = bak.mon;
        battle.playerUids[i] = bak.uid;
        battle.player = battle.players[0];
        battle.playerUid = battle.playerUids[0];
        dualSwitchBackup[i] = null;
        renderBattle();
      }
      dualCmds[i] = null;
      enterDualAction(i);
      return;
    }
  }
});
$('battle-field')?.addEventListener('click', (e) => {
  if (dualCmdPhase !== 'target' || !pendingMove) return;
  const fighter = e.target.closest?.('.fighter.targetable');
  if (!fighter) return;
  const side = fighter.classList.contains('foe') ? 'foe' : 'player';
  commitDualMove(pendingMove, side, Number(fighter.dataset.slot));
});
$('btn-maze-exit').addEventListener('click', () => {
  if (!mazeRun) return;
  endMazeRun({ message: '已退出灵堂（进度不保留）。' });
});
$('btn-maze-info')?.addEventListener('click', () => {
  showMazeToast(MAZE_HELP_TEXT);
});
$('maze-world')?.addEventListener('click', onMazeWorldClick);
bindMazeStick();
$('btn-party-info')?.addEventListener('click', () => {
  showAppToast(PARTY_HELP_TEXT);
});
window.addEventListener('keydown', (e) => {
  if (!$('screen-maze') || $('screen-maze').classList.contains('hidden')) return;
  const dirs = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
  };
  const d = dirs[e.key];
  if (!d) return;
  e.preventDefault();
  clearMazePath();
  tryMazeStep(d[0], d[1]);
});
$('btn-items')?.addEventListener('click', openItemsUi);
$('btn-close-items')?.addEventListener('click', closeItemsModal);
$('items-modal')?.addEventListener('click', (e) => {
  if (e.target === $('items-modal')) closeItemsModal();
});
$('btn-flee-battle').addEventListener('click', () => {
  if (battleBusy || continueResolver) return;
  closeItemPanel();
  leaveBattle({ wipeMaze: false });
});
$('btn-skip-catch').addEventListener('click', skipCatch);
$('catch-style').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || catchCtrl?.isBusy()) return;
  const style = btn.dataset.style;
  if (style !== 'flick' && style !== 'sling') return;
  state.catchStyle = style;
  save();
  renderCatchStyle();
  if (!$('screen-catch').classList.contains('hidden')) updateCatchCopy();
});
$('btn-dex').addEventListener('click', openDex);
$('btn-close-dex').addEventListener('click', closeDex);
$('dex-modal').addEventListener('click', (e) => {
  if (e.target === $('dex-modal')) closeDex();
});
$('btn-close-dex-detail').addEventListener('click', closeDexDetail);
$('dex-detail-modal').addEventListener('click', (e) => {
  if (e.target === $('dex-detail-modal')) closeDexDetail();
});
$('btn-shop').addEventListener('click', openShop);
$('btn-settings').addEventListener('click', openSettings);
$('btn-close-settings').addEventListener('click', closeSettings);
$('settings-modal').addEventListener('click', (e) => {
  if (e.target === $('settings-modal')) closeSettings();
});
$('btn-battle-anim').addEventListener('click', () => {
  const cur = normalizeBattleAnim(state.battleAnim);
  const idx = BATTLE_ANIM_ORDER.indexOf(cur);
  state.battleAnim = BATTLE_ANIM_ORDER[(idx + 1) % BATTLE_ANIM_ORDER.length];
  save();
  refreshBattleAnimButton();
  if (isBattleScreenActive()) preloadBattleFighterFrames();
});
$('btn-damage-numbers').addEventListener('click', () => {
  state.damageNumbers = !(state.damageNumbers !== false);
  save();
  refreshSettingsPanel();
});
$('btn-move-layout')?.addEventListener('click', () => {
  const cur = normalizeBattleMoveLayout(state.battleMoveLayout);
  const idx = BATTLE_MOVE_LAYOUTS.indexOf(cur);
  state.battleMoveLayout = BATTLE_MOVE_LAYOUTS[(idx + 1) % BATTLE_MOVE_LAYOUTS.length];
  save();
  applyBattleMoveLayout();
  if (battle) refreshMoveButtons();
  refreshSettingsPanel();
});
$('btn-music').addEventListener('click', () => {
  state.musicEnabled = !(state.musicEnabled !== false);
  applyAudioSettings();
  save();
  refreshSettingsPanel();
});
$('btn-sfx').addEventListener('click', () => {
  state.sfxEnabled = !(state.sfxEnabled !== false);
  applyAudioSettings();
  save();
  refreshSettingsPanel();
});
$('btn-close-shop').addEventListener('click', closeShop);
$('shop-modal').addEventListener('click', (e) => {
  if (e.target === $('shop-modal')) closeShop();
});
$('btn-refresh-all').addEventListener('click', refreshAllEncounters);
$('btn-reset').addEventListener('click', openResetConfirm);
$('btn-reset-cancel').addEventListener('click', closeResetConfirm);
$('btn-reset-confirm').addEventListener('click', resetGame);
$('reset-modal').addEventListener('click', (e) => {
  if (e.target === $('reset-modal')) closeResetConfirm();
});

document.addEventListener('pointerdown', () => {
  unlockAudio();
  const onBattle = !screens.battle.classList.contains('hidden');
  if (onBattle) return;
  const startExplore = () => playExploreBgm();
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(startExplore, { timeout: 1500 });
  } else {
    setTimeout(startExplore, 0);
  }
}, { once: true });

// Prevent accidental page zoom (double-tap / iOS gesture)
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

syncBossOutlineHairline();
window.addEventListener('resize', () => syncBossOutlineHairline());

applyAudioSettings();
applyBattleMoveLayout();
save();
preloadSelectAssets();
showScreen('select');
renderSelect();
