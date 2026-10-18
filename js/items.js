import { gainExperience } from './level.js';

export const ITEMS = {
  potion: { id: 'potion', name: '伤药', effect: 'heal', value: 20, price: 50, icon: '💊' },
  superPotion: { id: 'superPotion', name: '好伤药', effect: 'heal', value: 50, price: 150, icon: '💉' },
  hyperPotion: { id: 'hyperPotion', name: '厉害伤药', effect: 'heal', value: 200, price: 400, icon: '🧪' },
  maxPotion: { id: 'maxPotion', name: '全满药', effect: 'heal', value: 'full', price: 800, icon: '🧴' },
  expCandyS: { id: 'expCandyS', name: '经验糖果 S', effect: 'xp', value: 100, price: 200, icon: '🍬' },
  expCandyM: { id: 'expCandyM', name: '经验糖果 M', effect: 'xp', value: 400, price: 700, icon: '🍬' },
  expCandyL: { id: 'expCandyL', name: '经验糖果 L', effect: 'xp', value: 1000, price: 1600, icon: '🍭' },
  expCandyXL: { id: 'expCandyXL', name: '经验糖果 XL', effect: 'xp', value: 2500, price: 3500, icon: '🧁' },
  expCandyXXL: { id: 'expCandyXXL', name: '经验糖果 XXL', effect: 'xp', value: 6000, price: 8000, icon: '🎂' },
  vitalityShard: { id: 'vitalityShard', name: '活力碎片', effect: 'revive', value: 0.5, price: 1200, icon: '💠' },
  vitalityBlock: { id: 'vitalityBlock', name: '活力块', effect: 'revive', value: 1, price: 2800, icon: '💎' },
};

export const HEAL_ITEMS = Object.fromEntries(
  Object.values(ITEMS)
    .filter((i) => i.effect === 'heal')
    .map((i) => [i.id, { ...i, heal: i.value }]),
);

export function emptyItems() {
  return Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 0]));
}

export function emptyHealItems() {
  return emptyItems();
}

export function itemEffectLabel(item) {
  if (item.effect === 'heal') {
    return item.value === 'full' ? '回复全部 HP' : `回复 ${item.value} HP`;
  }
  if (item.effect === 'xp') return `经验 +${item.value}`;
  if (item.effect === 'revive') {
    return item.value >= 1 ? '复活并回复全部 HP' : '复活并回复 50% HP';
  }
  return '';
}

export function applyItem(mon, itemId) {
  const item = ITEMS[itemId];
  if (!item || !mon) return { ok: false };
  if (item.effect === 'heal') {
    if (mon.hp <= 0) return { ok: false };
    const missing = Math.max(0, mon.maxHp - mon.hp);
    if (missing <= 0) return { ok: false };
    const amount = item.value === 'full' ? missing : Math.min(item.value, missing);
    mon.hp += amount;
    return { ok: true, kind: 'heal', amount, logs: [] };
  }
  if (item.effect === 'revive') {
    if (mon.hp > 0) return { ok: false };
    const amount = Math.max(1, Math.floor(mon.maxHp * item.value));
    mon.hp = Math.min(mon.maxHp, amount);
    return { ok: true, kind: 'revive', amount: mon.hp, logs: [] };
  }
  if (item.effect === 'xp') {
    const wasFainted = mon.hp <= 0;
    const logs = gainExperience(mon, item.value);
    if (wasFainted) mon.hp = 0;
    return { ok: true, kind: 'xp', amount: item.value, logs };
  }
  return { ok: false };
}

export function applyHealItem(mon, itemId) {
  const r = applyItem(mon, itemId);
  return r.ok && r.kind === 'heal' ? r.amount : 0;
}
