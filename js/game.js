import {
  SPECIES,
  BALLS,
  MAPS,
  SHINY_CHARM,
  RIFT_FRUIT,
  RIFT_FRUIT_COST,
  RIFT_UNLOCK_LEVEL,
  createPokemon,
  createRiftAllies,
  initialPlayerState,
  partyMaxLevel,
  riftFruitDrop,
  statsFor,
  trySpendRiftFruit,
  PARTY_CAP,
  ACTIVE_CAP,
  activeParty,
  movePartyMember,
  sellPrice,
  sellPokemon,
  encounterLevels,
  rollEncounter,
  syncEncounters,
  trimParty,
  listDexEntries,
  listDexTypes,
  getDexDetail,
} from './data.js';
import { nextBattleStep, resolveSquadTurn, resolveTurn } from './battle.js';
import { catchChance, catchOutlook, catchProbability, createCatchController } from './catch.js';
import { gainExperience, xpReward, xpToNext, tryEvolve } from './level.js';

const STORAGE_KEY = 'poke-catch-prototype-v1';
const ASSET_VER = 'v2pixel192e-8bit3';
const spriteUrl = (path) => `${path}?${ASSET_VER}`;

const $ = (id) => document.getElementById(id);

const screens = {
  select: $('screen-select'),
  map: $('screen-map'),
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
let battleBusy = false;
let continueResolver = null;

const HP_ANIM_MS = 550;
const HIT_GAP_MS = 280;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attackLabel() {
  return battle?.allies ? '小队攻击' : '攻击';
}

function resetAttackButton() {
  const btn = $('btn-attack');
  btn.textContent = attackLabel();
  btn.disabled = false;
  $('btn-flee-battle').disabled = false;
  battleBusy = false;
  continueResolver = null;
}

function waitForContinue(message) {
  appendLog(message);
  return new Promise((resolve) => {
    const btn = $('btn-attack');
    btn.textContent = '继续';
    btn.disabled = false;
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
    party: trimParty((parsed.party || base.party).map((p) => ({ ...p }))),
    cleared: { ...(parsed.cleared || {}) },
    encounters: { ...(parsed.encounters || {}) },
  };
  s.riftFruit = Math.max(0, Math.floor(Number(s.riftFruit) || 0));
  if (s.catchStyle !== 'flick' && s.catchStyle !== 'sling') s.catchStyle = 'flick';
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
  $('charm-display').classList.toggle('hidden', !state.hasShinyCharm);
}

function renderSelect() {
  refreshHeader();
  const cards = $('map-cards');
  cards.innerHTML = '';
  setMapNote('');
  for (const map of Object.values(MAPS)) {
    const enc = state.encounters[map.id] || [];
    const remaining = enc.filter((e) => !state.cleared[`${map.id}:${e.id}`]).length;
    const levels = enc.flatMap((e) => encounterLevels(e));
    const lvMin = Math.min(...levels);
    const lvMax = Math.max(...levels);
    const locked = map.rift && partyMaxLevel(state.party) < RIFT_UNLOCK_LEVEL;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `map-card${map.rift ? ' rift' : ''}${locked ? ' locked' : ''}`;
    const meta = map.rift
      ? `小队挑战 Lv.${lvMin} · 异次元果 ${state.riftFruit || 0}/${RIFT_FRUIT_COST}`
      : `推荐 Lv.${lvMin}–${lvMax} · 剩余 ${remaining}/${enc.length}`;
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
  $('dex-detail-title').textContent = detail.name;
  root.innerHTML = `
    <img class="hero" src="${spriteUrl(detail.sprite)}" alt="${detail.name}" />
    <div class="meta">
      <span class="tag type">${typeLabel(detail.type)}</span>
      ${detail.mega ? '<span class="tag mega">超级</span>' : ''}
    </div>
    <div class="stats">种族值：HP ${detail.base.hp} · 攻 ${detail.base.atk} · 防 ${detail.base.def} · 速 ${detail.base.spd}</div>
    <div class="moves">招式：<ul>${moveLines}</ul></div>
    <div class="extra">捕捉率：${catchPct}%<br>${evo}</div>
  `;
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

function renderParty(container, selectable, onPick, mons = null, { onlyConscious = false } = {}) {
  container.innerHTML = '';
  let list = mons || state.party;
  if (onlyConscious) list = list.filter((mon) => mon.hp > 0);
  for (const mon of list) {
    const sp = SPECIES[mon.speciesId];
    const card = document.createElement(selectable ? 'button' : 'div');
    if (selectable) card.type = 'button';
    card.className = `party-card${selectable ? ' selectable' : ''}${mon.shiny ? ' shiny' : ''}`;
    const price = sellPrice(mon);
    const lastOne = state.party.length <= 1;
    const index = state.party.findIndex((p) => p.uid === mon.uid);
    const inBattle = index >= 0 && index < ACTIVE_CAP;
    if (inBattle && !selectable) card.classList.add('in-battle');
    card.innerHTML = `
      <div class="sprite-frame"><img src="${spriteUrl(sp.sprite)}" alt="${sp.name}" /></div>
      <div class="body">
        <strong>${sp.name}</strong>
        <div>Lv.${mon.level}${mon.hp <= 0 ? ' · 已倒下' : ` · HP ${mon.hp}/${mon.maxHp}`}</div>
        <div>经验 ${mon.exp ?? 0}/${xpToNext(mon.level)}</div>
        <div>攻${mon.atk} 防${mon.def} 速${mon.spd}</div>
        <div class="tags">
          <span class="tag type">${typeLabel(sp.type)}</span>
          ${inBattle ? '<span class="tag battle">出场</span>' : ''}
          ${mon.shiny ? '<span class="tag shiny">闪光</span>' : ''}
          ${mon.boss ? '<span class="tag boss">头目</span>' : ''}
          ${sp.mega ? '<span class="tag mega">超级</span>' : ''}
        </div>
      </div>
    `;
    if (selectable) {
      card.addEventListener('click', () => onPick(mon));
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sell';
      btn.textContent = `卖掉 ${price} 金币`;
      btn.disabled = lastOne;
      btn.title = lastOne ? '至少保留一只宝可梦' : `卖掉${sp.name}，获得 ${price} 金币`;
      btn.addEventListener('click', () => sellFromParty(mon));
      const actions = document.createElement('div');
      actions.className = 'party-actions';
      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '上移';
      up.disabled = index <= 0;
      up.addEventListener('click', () => shiftParty(mon.uid, -1));
      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '下移';
      down.disabled = index < 0 || index >= state.party.length - 1;
      down.addEventListener('click', () => shiftParty(mon.uid, 1));
      actions.append(up, down, btn);
      card.querySelector('.body').appendChild(actions);
    }
    container.appendChild(card);
  }
}

function shiftParty(uid, dir) {
  if (!movePartyMember(state.party, uid, dir)) return;
  save();
  renderSelect();
}

function sellFromParty(mon) {
  const sp = SPECIES[mon.speciesId];
  const price = sellPrice(mon);
  if (state.party.length <= 1) return;
  if (!confirm(`卖掉${sp?.name || '这只宝可梦'}，获得 ${price} 金币？`)) return;
  const sold = sellPokemon(state, mon.uid);
  if (!sold) return;
  save();
  renderSelect();
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
  openMap(mapId);
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
    const lead = trainer ? enc.team[0] : enc;
    const sp = SPECIES[lead.speciesId];
    const shiny = trainer ? enc.team.some((m) => m.shiny) : enc.shiny;
    const boss = trainer ? enc.team.some((m) => m.boss) : enc.boss;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `marker ${enc.kind}${shiny ? ' shiny' : ''}${cleared ? ' cleared' : ''}`;
    el.style.left = `${enc.x}%`;
    el.style.top = `${enc.y}%`;
    const who = enc.squad ? '小队挑战' : trainer ? `训练家 ${enc.trainerName}` : '野生';
    const detail = trainer ? `${enc.team.length}只` : `${sp.name} Lv.${enc.level}`;
    el.innerHTML = `
      <img src="${spriteUrl(sp.sprite)}" alt="" />
      <div class="label">
        ${who}<br/>${detail}
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
  const foe = { ...enc.pokemon, hp: enc.pokemon.maxHp };
  return { ...enc, activeFoe: foe, foeTeam: null, foeIndex: 0 };
}

function foeIntro(enc) {
  if (enc.kind === 'trainer') {
    return `对手：训练家 ${enc.trainerName}（${enc.foeTeam.length}只）`;
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
  pickMode = 'lead';
  pendingEncounter = prepareEncounter(enc);
  $('pick-title').textContent = '选择出战宝可梦';
  $('btn-cancel-pick').classList.remove('hidden');
  $('btn-cancel-pick').textContent = '取消';
  $('pick-foe-info').textContent = foeIntro(pendingEncounter);
  renderParty($('pick-party'), true, (mon) => startBattle(mon), activeParty(state.party), { onlyConscious: true });
  showScreen('pick');
}

function startBattle(playerMon, { freshLog = true } = {}) {
  const player = { ...playerMon };
  const foe = { ...pendingEncounter.activeFoe };
  const allies = pendingEncounter.squad
    ? (freshLog ? createRiftAllies() : battle.allies.map((ally) => ({ ...ally })))
    : null;
  battle = { player, foe, playerUid: playerMon.uid, allies };
  renderBattle();
  if (freshLog) {
    $('battle-log').innerHTML = '<p>对战开始！</p>';
    if (allies) appendLog('3 只电脑宝可梦加入了小队。');
  } else appendLog(`上吧，${SPECIES[player.speciesId].name}！`);
  resetAttackButton();
  showScreen('battle');
}

function renderSprite(wrapId, mon) {
  const wrap = $(wrapId);
  const sp = SPECIES[mon.speciesId];
  wrap.className = `sprite-wrap${mon.shiny ? ' shiny' : ''}`;
  wrap.innerHTML = `<img src="${spriteUrl(sp.sprite)}" alt="${sp.name}" />`;
  if (mon.boss) {
    wrap.innerHTML += '<div class="boss-eyes"><span></span><span></span></div>';
  }
}

function renderBattle() {
  const { player, foe } = battle;
  const psp = SPECIES[player.speciesId];
  const fsp = SPECIES[foe.speciesId];
  $('player-name').textContent = `${psp.name} Lv.${player.level}`;
  $('foe-name').textContent = `${fsp.name} Lv.${foe.level}`;
  const progress = pendingEncounter?.kind === 'trainer'
    ? `<span class="tag">${pendingEncounter.foeIndex + 1}/${pendingEncounter.foeTeam.length}</span>`
    : '';
  $('foe-tags').innerHTML = `
    ${progress}
    ${foe.shiny ? '<span class="tag shiny">闪光</span>' : ''}
    ${foe.boss ? '<span class="tag boss">头目</span>' : ''}
    ${fsp.mega ? '<span class="tag mega">超级</span>' : ''}
  `;
  const skillLine = $('foe-skills');
  if (skillLine) {
    skillLine.textContent = fsp.moves?.length
      ? `技能 ${fsp.moves.map((move) => move.name).join(' · ')}`
      : '';
  }
  setHpBar('player-hp', player.hp, player.maxHp);
  setHpBar('foe-hp', foe.hp, foe.maxHp);
  renderSprite('player-sprite-wrap', player);
  renderSprite('foe-sprite-wrap', foe);
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
  const member = state.party.find((p) => p.uid === battle.playerUid);
  if (member) member.hp = battle.player.hp;
  pendingEncounter.activeFoe = { ...battle.foe };
  if (pendingEncounter.foeTeam) {
    pendingEncounter.foeTeam[pendingEncounter.foeIndex] = { ...battle.foe };
  }
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

function grantRiftFruit(foe) {
  const n = riftFruitDrop(foe?.speciesId);
  if (!n) return;
  state.riftFruit = (state.riftFruit || 0) + n;
  appendLog(`获得了 ${n} 个异次元果！`);
  refreshHeader();
  save();
}

function finishTurnOutcome(turn) {
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
  $('btn-attack').disabled = true;
  $('btn-flee-battle').disabled = true;
  setTimeout(() => leaveBattle(), evolved ? 1400 : 900);
}

async function onAttack() {
  if (continueResolver) {
    continueResolver();
    return;
  }
  if (!battle || battleBusy) return;
  battleBusy = true;
  $('btn-attack').disabled = true;
  $('btn-flee-battle').disabled = true;

  const startPlayer = { ...battle.player };
  const startFoe = { ...battle.foe };
  const startAllies = battle.allies ? battle.allies.map((ally) => ({ ...ally })) : null;
  const turn = startAllies
    ? resolveSquadTurn(startPlayer, startAllies, startFoe)
    : resolveTurn(startPlayer, startFoe);

  try {
    await playTurnHits(turn, startPlayer, startFoe);
    finishTurnOutcome(turn);
  } catch (err) {
    console.error(err);
    resetAttackButton();
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

function sendNextFoe() {
  pendingEncounter.foeIndex += 1;
  const next = pendingEncounter.foeTeam[pendingEncounter.foeIndex];
  const sent = { ...next, hp: next.maxHp };
  pendingEncounter.activeFoe = sent;
  pendingEncounter.foeTeam[pendingEncounter.foeIndex] = sent;
  battle.foe = { ...sent };
  appendLog(`${pendingEncounter.trainerName} 派出了 ${SPECIES[sent.speciesId].name}！`);
  renderBattle();
}

function openSwitchPick() {
  pickMode = 'switch';
  $('pick-title').textContent = '选择下一只';
  $('btn-cancel-pick').classList.add('hidden');
  const foe = battle.foe;
  const sp = SPECIES[foe.speciesId];
  $('pick-foe-info').textContent = `对手：${sp.name} Lv.${foe.level} · HP ${foe.hp}/${foe.maxHp}`;
  renderParty($('pick-party'), true, (mon) => startBattle(mon, { freshLog: false }), activeParty(state.party), { onlyConscious: true });
  showScreen('pick');
}

function openCatchPick() {
  pickMode = 'catch';
  $('pick-title').textContent = '选择要捕捉的宝可梦';
  $('btn-cancel-pick').classList.remove('hidden');
  $('btn-cancel-pick').textContent = '放弃捕捉';
  $('pick-foe-info').textContent = `训练家 ${pendingEncounter.trainerName} 倒下了。选一只捕捉。`;
  renderParty($('pick-party'), true, (mon) => {
    pendingEncounter.activeFoe = mon;
    enterCatch(pendingEncounter);
  }, pendingEncounter.foeTeam);
  showScreen('pick');
}

function leaveBattle() {
  for (const p of state.party) p.hp = p.maxHp;
  save();
  openMap(currentMapId);
}

function finishBattleWin(evolved) {
  $('btn-attack').disabled = true;
  const enc = pendingEncounter;
  if (enc.kind === 'trainer' && enc.reward) {
    state.coins += enc.reward;
    appendLog(`获得 ${enc.reward} 金币！`);
    refreshHeader();
  }
  for (const p of state.party) p.hp = p.maxHp;
  save();
  setTimeout(() => {
    if (enc.kind === 'trainer') openCatchPick();
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
  const busy = !!catchCtrl?.isBusy();
  for (const btn of $('catch-style').querySelectorAll('button')) {
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
        setCatchResult('咔哒！抓住了！', 'ok');
        claimPokemon(pendingEncounter.catchTarget);
      } else {
        setCatchResult(breakoutLine(shakes), 'fail');
      }
    },
  });
}

function markCleared() {
  if (pendingEncounter?.squad) return;
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
    openMap(currentMapId);
  }, 1000);
}

function skipCatch() {
  markCleared();
  save();
  if (catchCtrl) {
    catchCtrl.destroy();
    catchCtrl = null;
  }
  openMap(currentMapId);
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
  else if (pickMode === 'lead') openMap(currentMapId);
});
$('btn-attack').addEventListener('click', onAttack);
$('btn-flee-battle').addEventListener('click', () => {
  if (battleBusy || continueResolver) return;
  leaveBattle();
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
  updateCatchCopy();
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

save();
showScreen('select');
renderSelect();
