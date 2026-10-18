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
  createPokemon,
  createRiftAllies,
  initialPlayerState,
  partyMaxLevel,
  partyOverLevelCount,
  riftFruitDrop,
  statsFor,
  trySpendRiftFruit,
  trySpendTwinKey,
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
} from './battle.js';
import { hasFighterFrames, normalizeBattleAnim, playDamageNumber, playFighterFrameStrip, playHit } from './battle-fx.js';
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
  removeRoamer,
  markFloorBossDefeated,
  advanceMazeFloor,
  buildRoamerEncounter,
  buildFloorBossEncounter,
  SPIRIT_HALL_BOSS_BY_FLOOR,
} from './maze.js';

const STORAGE_KEY = 'poke-catch-prototype-v1';
const ASSET_VER = 'v2pixel192e-8bit-maze-scroll2';
const spriteUrl = (path) => `${path}?${ASSET_VER}`;

/** Pixel size of one maze cell; keep in sync with CSS `--maze-tile`. */
const MAZE_TILE = 56;
/** Visible tiles around the centered player (odd). */
const MAZE_VIEW_W = 11;
const MAZE_VIEW_H = 9;

const BATTLE_ANIM_ORDER = ['off', 'light', 'medium', 'heavy'];
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
let bagSelectedItemId = null;
let mazeRun = null;

const HP_ANIM_MS = 550;
const HIT_GAP_MS = 280;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attackLabel() {
  if (battle?.allies) return '小队攻击';
  if (battle?.dual) return '双打攻击';
  return '攻击';
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

function canUseBattleItem() {
  if (!battle || battleBusy || continueResolver) return false;
  return Object.values(ITEMS).some((item) => ownedItemUsableInBattle(item));
}

function updateItemButton() {
  const btn = $('btn-item');
  if (!btn) return;
  btn.disabled = !canUseBattleItem();
}

function closeItemPanel() {
  $('item-panel')?.classList.add('hidden');
}

function setBattleActionBusy(busy) {
  $('btn-attack').disabled = busy;
  $('btn-flee-battle').disabled = busy;
  if (busy) {
    $('btn-item').disabled = true;
    closeItemPanel();
  } else {
    updateItemButton();
  }
}

function resetAttackButton() {
  const btn = $('btn-attack');
  btn.textContent = attackLabel();
  btn.disabled = false;
  $('btn-flee-battle').disabled = false;
  battleBusy = false;
  continueResolver = null;
  updateItemButton();
}

function waitForContinue(message) {
  appendLog(message);
  return new Promise((resolve) => {
    const btn = $('btn-attack');
    btn.textContent = '继续';
    btn.disabled = false;
    $('btn-item').disabled = true;
    closeItemPanel();
    continueResolver = () => {
      btn.disabled = true;
      btn.textContent = attackLabel();
      continueResolver = null;
      resolve();
    };
  });
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
  if (s.catchStyle !== 'flick' && s.catchStyle !== 'sling') s.catchStyle = 'flick';
  delete s.partyStyle;
  s.battleAnim = normalizeBattleAnim(s.battleAnim);
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
}

function refreshHeader() {
  $('coin-display').textContent = `金币 ${state.coins}`;
  $('fruit-display').textContent = `异次元果 ${state.riftFruit || 0}`;
  const twinEl = $('twin-key-display');
  if (twinEl) twinEl.textContent = `双子钥匙 ${state.twinKeys || 0}`;
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
  const musicBtn = $('btn-music');
  const sfxBtn = $('btn-sfx');
  const numBtn = $('btn-damage-numbers');
  if (musicBtn) musicBtn.textContent = state.musicEnabled !== false ? '开' : '关';
  if (sfxBtn) sfxBtn.textContent = state.sfxEnabled !== false ? '开' : '关';
  if (numBtn) numBtn.textContent = state.damageNumbers !== false ? '开' : '关';
}

function renderSelect() {
  refreshHeader();
  const cards = $('map-cards');
  cards.innerHTML = '';
  setMapNote('');
  for (const map of Object.values(MAPS)) {
    const enc = state.encounters[map.id] || [];
    const remaining = enc.filter((e) => !state.cleared[`${map.id}:${e.id}`]).length;
    const spiritLocked = map.spiritHall && !state.twinCleared;
    const twinLocked = map.twin
      && partyOverLevelCount(state.party, TWIN_UNLOCK_LEVEL) < TWIN_UNLOCK_COUNT;
    const locked = (map.rift && partyMaxLevel(state.party) < RIFT_UNLOCK_LEVEL) || twinLocked || spiritLocked;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `map-card${map.rift ? ' rift' : ''}${map.twin ? ' twin' : ''}${map.spiritHall ? ' spirit' : ''}${locked ? ' locked' : ''}`;
    let meta;
    if (map.spiritHall) {
      meta = state.twinCleared ? '三层迷宫 · 已解锁' : '三层迷宫 · 需通关双子塔';
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
    card.innerHTML = `
      <img src="${spriteUrl(map.image)}" alt="${map.name}" />
      <div class="meta">
        <strong>${map.name}</strong>
        <span>${meta}</span>
      </div>
    `;
    card.addEventListener('click', () => tryEnterMap(map.id));
    cards.appendChild(card);
  }
  renderShop();
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
      img: ball.sprite,
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
      <img src="${spriteUrl(e.sprite)}" alt="${e.name}" />
      <span class="name">${e.name}</span>
      <span class="tag type">${typeLabel(e.type)}</span>
    `;
    row.addEventListener('click', () => openDexDetail(e.id));
    list.appendChild(row);
  }
}

function renderDexDetail(detail) {
  const root = $('dex-detail');
  const catchPct = Math.round((detail.catchRate ?? 0) * 100);
  const moveLines = detail.moves
    .map((m) => `<li>${m.name}（${typeLabel(m.type)} · 威力 ${m.power}）</li>`)
    .join('');
  const evo = detail.evolvesToName
    ? `进化：Lv.${detail.evolveLevel} → ${detail.evolvesToName}`
    : '进化：无';
  const canAnim = hasFighterFrames(detail.id);
  $('dex-detail-title').textContent = detail.name;
  root.innerHTML = `
    <div class="dex-hero-wrap">
      <img class="hero" src="${spriteUrl(detail.sprite)}" alt="${detail.name}" />
    </div>
    ${canAnim ? '<button type="button" id="btn-dex-anim" class="dex-anim-btn">播放动画</button>' : ''}
    <div class="meta">
      <span class="tag type">${typeLabel(detail.type)}</span>
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

function openDexDetail(speciesId) {
  const detail = getDexDetail(speciesId, SPECIES);
  if (!detail) return;
  renderDexDetail(detail);
  $('dex-detail-modal').classList.remove('hidden');
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
    card.className = `party-card${selectable ? ' selectable' : ''}${mon.shiny ? ' shiny' : ''}`;
    const index = state.party.findIndex((p) => p.uid === mon.uid);
    const inBattle = index >= 0 && index < ACTIVE_CAP;
    if (inBattle && !selectable) card.classList.add('in-battle');
    card.innerHTML = `
      <div class="sprite-frame"><img src="${spriteUrl(sp.sprite)}" alt="${sp.name}" /></div>
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
  openMap(mapId);
}

function startMazeRun() {
  mazeRun = createMazeRun({ floor: 1 });
  currentMapId = 'spirit_hall';
  renderMaze();
  showScreen('maze');
}

function endMazeRun({ message } = {}) {
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

const MAZE_HELP_TEXT = '点击角色相邻格子移动。地图会卷动，角色始终居中。踩到游荡宝可梦开战；楼梯处为层主。全灭或退出将结束本次探索。';

let mazeToastTimer = null;

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

function onMazeTileClick(x, y) {
  if (!mazeRun) return;
  const dx = x - mazeRun.player.x;
  const dy = y - mazeRun.player.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return;
  tryMazeStep(dx, dy);
}

function renderMaze() {
  if (!mazeRun) return;
  $('maze-title').textContent = `灵堂 · 第 ${mazeRun.floor} 层`;
  const world = $('maze-world');
  if (!world) return;
  const tile = mazeTilePx();
  const view = mazeViewSize();
  const h = mazeRun.grid.length;
  const w = mazeRun.grid[0].length;
  const px = mazeRun.player.x;
  const py = mazeRun.player.y;
  world.style.width = `${w * tile}px`;
  world.style.height = `${h * tile}px`;
  world.innerHTML = '';

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const kind = mazeRun.grid[y][x];
      const cell = document.createElement('div');
      const adjacent = Math.abs(x - px) + Math.abs(y - py) === 1 && kind !== 'wall';
      cell.className = `maze-tile ${kind}${adjacent ? ' adjacent' : ''}`;
      cell.style.left = `${x * tile}px`;
      cell.style.top = `${y * tile}px`;
      cell.style.width = `${tile}px`;
      cell.style.height = `${tile}px`;
      if (adjacent) {
        cell.dataset.mazeX = String(x);
        cell.dataset.mazeY = String(y);
        cell.addEventListener('click', () => onMazeTileClick(x, y));
      }
      world.appendChild(cell);
    }
  }

  for (const roamer of mazeRun.roamers) {
    const sp = SPECIES[roamer.speciesId];
    if (!sp) continue;
    const img = document.createElement('img');
    img.className = 'maze-entity roamer';
    img.src = spriteUrl(sp.sprite);
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
      img.src = spriteUrl(sp.sprite);
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
  playerImg.src = spriteUrl(mazePlayerSprite());
  playerImg.alt = '我方';
  playerImg.style.left = `${mazeRun.player.x * tile}px`;
  playerImg.style.top = `${mazeRun.player.y * tile}px`;
  playerImg.style.width = `${tile * 0.82}px`;
  playerImg.style.height = `${tile * 0.82}px`;
  world.appendChild(playerImg);

  // Keep the player tile centered in the viewport (camera scrolls the world).
  const camX = mazeRun.player.x * tile - (view.w * tile) / 2 + tile / 2;
  const camY = mazeRun.player.y * tile - (view.h * tile) / 2 + tile / 2;
  world.style.transform = `translate(${-camX}px, ${-camY}px)`;
}

function tryMazeStep(dx, dy) {
  if (!mazeRun) return;
  const { run, event } = stepMaze(mazeRun, dx, dy);
  mazeRun = run;
  renderMaze();
  if (!event) return;
  if (event.type === 'roamer') {
    beginMazeRoamerBattle(event.roamer);
    return;
  }
  if (event.type === 'stairs') {
    if (!mazeRun.floorBossDefeated) beginMazeBossBattle();
    else afterFloorBossCleared();
  }
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
  $('map-bg').src = spriteUrl(map.image);
  const markers = $('map-markers');
  markers.innerHTML = '';
  const encs = state.encounters[mapId] || [];
  for (const enc of encs) {
    const key = `${mapId}:${enc.id}`;
    const cleared = !!state.cleared[key];
    const trainer = enc.kind === 'trainer';
    const lead = trainer ? enc.team[0] : (enc.dual ? enc.foes[0] : enc);
    const sp = SPECIES[lead.speciesId];
    const shiny = trainer ? enc.team.some((m) => m.shiny) : enc.shiny;
    const boss = trainer ? enc.team.some((m) => m.boss) : enc.boss;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `marker ${enc.kind}${shiny ? ' shiny' : ''}${cleared ? ' cleared' : ''}`;
    el.style.left = `${enc.x}%`;
    el.style.top = `${enc.y}%`;
    const who = enc.dual
      ? '双打挑战'
      : enc.squad
        ? '小队挑战'
        : trainer
          ? `训练家 ${enc.trainerName}`
          : '野生';
    const detail = enc.dual
      ? enc.foes.map((f) => SPECIES[f.speciesId].name).join(' & ')
      : trainer
        ? `${enc.team.length}只`
        : `${sp.name} Lv.${enc.level}`;
    el.innerHTML = `
      <img src="${spriteUrl(sp.sprite)}" alt="" />
      <div class="label">
        ${who}<br/>${detail}${enc.dual ? `<br/>Lv.${enc.level}` : ''}
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
  const sp = SPECIES[enc.speciesId];
  const tags = `${enc.boss ? '（头目）' : ''}${enc.shiny ? '（闪光）' : ''}${sp.mega ? '（超级进化）' : ''}`;
  if (enc.squad) {
    const skills = (sp.moves || [sp.move]).map((move) => move.name).join('、');
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
    card.className = `party-card selectable${selected ? ' selected' : ''}${mon.shiny ? ' shiny' : ''}`;
    const order = dualPickUids.indexOf(mon.uid);
    card.innerHTML = `
      <div class="sprite-frame"><img src="${spriteUrl(sp.sprite)}" alt="${sp.name}" /></div>
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
  $('battle-log').innerHTML = '<p>双打对战开始！</p>';
  appendLog(`${SPECIES[players[0].speciesId].name} 与 ${SPECIES[players[1].speciesId].name} 同时出战！`);
  playBattleBgm({
    rift: false,
    playerLevel: players[0].level,
    foeLevel: Math.max(...foes.map((f) => f.level)),
  });
  resetAttackButton();
  showScreen('battle');
}

function startBattle(playerMon, { freshLog = true } = {}) {
  if (pendingEncounter?.dual && pickMode === 'switch') {
    fillDualSlot(playerMon);
    return;
  }
  const player = { ...playerMon };
  const foe = { ...pendingEncounter.activeFoe };
  const allies = pendingEncounter.squad
    ? (freshLog ? createRiftAllies() : battle.allies.map((ally) => ({ ...ally })))
    : null;
  battle = { player, foe, playerUid: playerMon.uid, allies, dual: false };
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
}

function renderSprite(wrapId, mon) {
  const wrap = $(wrapId);
  const sp = SPECIES[mon.speciesId];
  const floats = [...wrap.querySelectorAll('.fx-num')];
  wrap.className = `sprite-wrap${mon.shiny ? ' shiny' : ''}`;
  wrap.innerHTML = `<img src="${spriteUrl(sp.sprite)}" alt="${sp.name}" />`;
  if (mon.boss) {
    wrap.innerHTML += '<div class="boss-eyes"><span></span><span></span></div>';
  }
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
    $(skillsId).textContent = sp.moves?.length
      ? `技能 ${sp.moves.map((move) => move.name).join(' · ')}`
      : '';
  }
  setHpBar(hpId, mon.hp, mon.maxHp);
  renderSprite(wrapId, mon);
  if ($(wrapId)) $(wrapId).classList.toggle('fainted', mon.hp <= 0);
}

function renderBattle() {
  const field = $('battle-field');
  const dual = !!battle?.dual;
  field?.classList.toggle('dual', dual);
  for (const el of document.querySelectorAll('.dual-only')) {
    el.classList.toggle('hidden', !dual);
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

function renderAllies() {
  const row = $('ally-row');
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
      <img src="${spriteUrl(sp.sprite)}" alt="" />
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

function slotWrap(side, index) {
  const suffix = index === 0 ? '' : '-1';
  return $(side === 'player' ? `player-sprite-wrap${suffix}` : `foe-sprite-wrap${suffix}`);
}

function battleHitElements(line) {
  if (battle?.dual && (line.actorIndex != null || line.targetIndex != null)) {
    const atkSide = line.side;
    const defSide = line.side === 'player' ? 'foe' : 'player';
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
    const { attackerEl, defenderEl, attackerSpeciesId } = battleHitElements(line);
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
    if (line.side === 'player') {
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
    showLineNumber(line);
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
    $('btn-attack').disabled = true;
    $('btn-flee-battle').disabled = true;
    setTimeout(() => leaveBattle(), evolved ? 1400 : 900);
    return;
  }
  if (turn.result === 'lose') {
    appendLog('你没有可以继续对战的宝可梦了…');
    $('btn-attack').disabled = true;
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

function finishTurnOutcome(turn) {
  if (battle?.dual) {
    finishDualTurnOutcome(turn);
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

async function onAttack() {
  if (continueResolver) {
    continueResolver();
    return;
  }
  if (!battle || battleBusy) return;
  battleBusy = true;
  setBattleActionBusy(true);

  try {
    if (battle.dual) {
      const startPlayers = battle.players.map((mon) => ({ ...mon }));
      const startFoes = battle.foes.map((mon) => ({ ...mon }));
      const turn = resolveDualTurn(startPlayers, startFoes);
      await playDualTurnHits(turn);
      finishTurnOutcome(turn);
      return;
    }
    const startPlayer = { ...battle.player };
    const startFoe = { ...battle.foe };
    const startAllies = battle.allies ? battle.allies.map((ally) => ({ ...ally })) : null;
    const turn = startAllies
      ? resolveSquadTurn(startPlayer, startAllies, startFoe)
      : resolveTurn(startPlayer, startFoe);
    await playTurnHits(turn, startPlayer, startFoe);
    finishTurnOutcome(turn);
  } catch (err) {
    console.error(err);
    resetAttackButton();
  }
}

function renderItemList() {
  const list = $('item-list');
  list.innerHTML = '';
  for (const item of Object.values(ITEMS)) {
    const owned = state.items?.[item.id] || 0;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'item-row';
    row.disabled = !ownedItemUsableInBattle(item);
    row.innerHTML = `
      <span class="item-icon">${item.icon}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-effect">${itemEffectLabel(item)}</span>
      <span class="item-owned">×${owned}</span>
    `;
    row.addEventListener('click', () => onUseItem(item.id));
    list.appendChild(row);
  }
}

function openItemPanel() {
  if (!canUseBattleItem()) return;
  renderItemList();
  $('item-panel').classList.remove('hidden');
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

  const result = applyItem(fighter, itemId);
  if (!result.ok) {
    battleBusy = false;
    setBattleActionBusy(false);
    return;
  }
  state.items[itemId] -= 1;

  if (target.onField && target.index >= 0) {
    if (battle.dual) {
      battle.players[target.index] = { ...fighter };
      battle.player = battle.players[0];
    } else {
      battle.player = { ...fighter };
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
  showHealNumber(battle.dual ? slotWrap('player', slot) : $('player-sprite-wrap'), amount);

  try {
    if (battle.dual) {
      const startPlayers = battle.players.map((mon) => ({ ...mon }));
      const startFoes = battle.foes.map((mon) => ({ ...mon }));
      const turn = resolveDualItemTurn(startPlayers, startFoes);
      await playDualTurnHits(turn);
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

function closeBagPanels() {
  bagSelectedItemId = null;
  $('bag-item-panel')?.classList.add('hidden');
  $('bag-target-panel')?.classList.add('hidden');
}

function renderBagItemList() {
  const list = $('bag-item-list');
  if (!list) return;
  list.innerHTML = '';
  for (const item of Object.values(ITEMS)) {
    const owned = state.items?.[item.id] || 0;
    const anyTarget = state.party.some((m) => monAcceptsItem(m, item));
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'item-row';
    row.disabled = owned <= 0 || !anyTarget;
    row.innerHTML = `
      <span class="item-icon">${item.icon}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-effect">${itemEffectLabel(item)}</span>
      <span class="item-owned">×${owned}</span>
    `;
    row.addEventListener('click', () => openBagTargetPicker(item.id));
    list.appendChild(row);
  }
}

function openBagItemPanel() {
  if (battle) return; // party bag is out-of-battle only
  renderBagItemList();
  $('bag-target-panel')?.classList.add('hidden');
  $('bag-item-panel')?.classList.remove('hidden');
}

function openBagTargetPicker(itemId) {
  const item = ITEMS[itemId];
  if (!item || (state.items?.[itemId] || 0) <= 0) return;
  bagSelectedItemId = itemId;
  const list = $('bag-target-list');
  list.innerHTML = '';
  for (const mon of state.party) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'party-card';
    const ok = monAcceptsItem(mon, item);
    btn.disabled = !ok;
    const sp = SPECIES[mon.speciesId];
    btn.textContent = `${sp?.name || mon.speciesId} Lv.${mon.level}  HP ${mon.hp}/${mon.maxHp}`;
    btn.addEventListener('click', () => onBagUseItem(mon.uid));
    list.appendChild(btn);
  }
  $('bag-item-panel')?.classList.add('hidden');
  $('bag-target-panel')?.classList.remove('hidden');
}

function onBagUseItem(uid) {
  const item = ITEMS[bagSelectedItemId];
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
  const fb = $('bag-item-feedback');
  if (fb) {
    fb.hidden = false;
    fb.textContent = lines.join(' ');
  }
  save();
  renderParty($('party-list'), false);
  closeBagPanels();
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
  for (const p of state.party) p.hp = p.maxHp;
  save();
  playExploreBgm();
  if (inSpiritHall()) {
    if (wipeMaze) failMazeRun();
    else returnAfterMazeBattle();
    return;
  }
  openMap(currentMapId);
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
    if (enc.kind === 'trainer' || enc.dual) openCatchPick();
    else enterCatch(enc);
  }, evolved ? 1400 : 900);
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

function enterCatch(enc) {
  throwsThisEncounter = 0;
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
      <img src="${ball.sprite}" alt="" />
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
  if (pendingEncounter?.squad || pendingEncounter?.dual) return;
  state.cleared[`${currentMapId}:${pendingEncounter.id}`] = true;
}

function claimPokemon(foe) {
  markCleared();
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
  save();
  setTimeout(() => {
    if (catchCtrl) {
      catchCtrl.destroy();
      catchCtrl = null;
    }
    resumeAfterMazeCatch();
  }, 1000);
}

function skipCatch() {
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
  if (pickMode === 'catch') skipCatch();
  else returnAfterMazeBattle();
});
$('btn-maze-exit').addEventListener('click', () => {
  if (!mazeRun) return;
  endMazeRun({ message: '已退出灵堂（进度不保留）。' });
});
$('btn-maze-info')?.addEventListener('click', () => {
  showMazeToast(MAZE_HELP_TEXT);
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
  tryMazeStep(d[0], d[1]);
});
$('btn-attack').addEventListener('click', onAttack);
$('btn-item').addEventListener('click', () => {
  if (battleBusy || continueResolver) return;
  if ($('item-panel').classList.contains('hidden')) openItemPanel();
  else closeItemPanel();
});
$('btn-close-items').addEventListener('click', closeItemPanel);
$('btn-party-items')?.addEventListener('click', openBagItemPanel);
$('btn-close-bag-items')?.addEventListener('click', closeBagPanels);
$('btn-close-bag-target')?.addEventListener('click', () => {
  $('bag-target-panel')?.classList.add('hidden');
  openBagItemPanel();
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
});
$('btn-damage-numbers').addEventListener('click', () => {
  state.damageNumbers = !(state.damageNumbers !== false);
  save();
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
  if (!onBattle) playExploreBgm();
}, { once: true });

// Prevent accidental page zoom (double-tap / iOS gesture)
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

applyAudioSettings();
save();
showScreen('select');
renderSelect();
