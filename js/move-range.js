/** Melee / ranged classification for formation column lock (and future use). */

/** @type {Record<string, 'melee' | 'ranged'>} */
export const MOVE_RANGE = {
  // —— ranged ——
  暗黑洞: 'ranged',
  暗影之光: 'ranged',
  薄雾球: 'ranged',
  暴风雪: 'ranged',
  爆炸烈焰: 'ranged',
  冰冻光束: 'ranged',
  冰冻之风: 'ranged',
  冰砾: 'ranged',
  波导弹: 'ranged',
  唱歌: 'ranged',
  冲浪: 'ranged',
  穿影袭: 'ranged',
  大地掌控: 'ranged',
  大字爆炎: 'ranged',
  电磁飘浮: 'ranged',
  电光: 'ranged',
  电光束: 'ranged',
  电击: 'ranged',
  恶之波动: 'ranged',
  噩梦缠绕: 'ranged',
  飞弹针: 'ranged',
  飞叶快刀: 'ranged',
  黑夜魔影: 'ranged',
  花瓣暴风: 'ranged',
  花瓣舞: 'ranged',
  幻象光线: 'ranged',
  幻影光线: 'ranged',
  火花: 'ranged',
  '火焰球·极': 'ranged',
  加农光炮: 'ranged',
  加农水炮: 'ranged',
  洁净光芒: 'ranged',
  金属爆炸: 'ranged',
  精神强念: 'ranged',
  绝对零度: 'ranged',
  空气爆破: 'ranged',
  空气斩: 'ranged',
  雷霆风暴: 'ranged',
  炼狱: 'ranged',
  烈焰球: 'ranged',
  流星群: 'ranged',
  龙息: 'ranged',
  龙星群: 'ranged',
  龙之波动: 'ranged',
  龙之怒: 'ranged',
  麻痹粉: 'ranged',
  满月冲击: 'ranged',
  魅惑之声: 'ranged',
  冥门横扫: 'ranged',
  魔法叶: 'ranged',
  泥巴射击: 'ranged',
  念力: 'ranged',
  泡沫: 'ranged',
  喷射火焰: 'ranged',
  破坏光线: 'ranged',
  奇异之光: 'ranged',
  日光光束: 'ranged',
  日光束: 'ranged',
  神圣之火: 'ranged',
  十万伏特: 'ranged',
  水炮: 'ranged',
  水枪: 'ranged',
  水之波动: 'ranged',
  未来预知: 'ranged',
  细雪: 'ranged',
  新月舞: 'ranged',
  阳光烈焰: 'ranged',
  影子球: 'ranged',
  月光守护: 'ranged',
  月亮之力: 'ranged',
  真气弹: 'ranged',
  浊流: 'ranged',
  真空波: 'ranged',

  // —— melee ——
  暗影潜袭: 'melee',
  报复: 'melee',
  臂锤: 'melee',
  冰冻拳: 'melee',
  冰冻牙: 'melee',
  缠绕: 'melee',
  冲天拳: 'melee',
  虫咬: 'melee',
  大愤慨: 'melee',
  地震: 'melee',
  '电光一闪·霆': 'melee',
  毒针: 'melee',
  飞冲升天: 'melee',
  飞踢: 'melee',
  飞膝踢: 'melee',
  飞翔: 'melee',
  疯狂伏特: 'melee',
  伏特攻击: 'melee',
  伏特替换: 'melee',
  核心惩罚者: 'melee',
  彗星拳: 'melee',
  火焰拳: 'melee',
  火焰踢: 'melee',
  火焰牙: 'melee',
  角撞: 'melee',
  近身战: 'melee',
  巨兽斩: 'melee',
  空手劈: 'melee',
  雷电拳: 'melee',
  连斩: 'melee',
  龙爪: 'melee',
  落石: 'melee',
  逆鳞: 'melee',
  拍击: 'melee',
  攀瀑: 'melee',
  气旋攻击: 'melee',
  强力鞭: 'melee',
  舌舔: 'melee',
  圣剑: 'melee',
  十字劈: 'melee',
  双针: 'melee',
  水之尾: 'melee',
  藤鞭: 'melee',
  铁卷尾: 'melee',
  铁头: 'melee',
  铁尾: 'melee',
  无限之枪: 'melee',
  吸取: 'melee',
  岩崩: 'melee',
  岩石爆击: 'melee',
  岩石崩塌: 'melee',
  咬碎: 'melee',
  咬住: 'melee',
  跃起: 'melee',
  重磅冲撞: 'melee',
  抓: 'melee',
  撞击: 'melee',
  啄: 'melee',
};

/**
 * Resolve melee/ranged for a damage move.
 * Priority: explicit move.range → pierce → name table → null if unknown/utility.
 * @returns {'melee' | 'ranged' | null}
 */
export function moveRange(move) {
  if (!move || move.effect) return null;
  if (move.range === 'melee' || move.range === 'ranged') return move.range;
  if (move.pierce) return 'ranged';
  const byName = MOVE_RANGE[move.name];
  return byName || null;
}

/** True when the move ignores formation column lock. Utility moves are not ranged. */
export function moveIsRanged(move) {
  return moveRange(move) === 'ranged';
}

/** Chinese label for UI pills. Empty string if not a damage range. */
export function rangeLabel(rangeOrMove) {
  const range = typeof rangeOrMove === 'string' ? rangeOrMove : moveRange(rangeOrMove);
  if (range === 'ranged') return '远程';
  if (range === 'melee') return '近战';
  return '';
}

/** Pill classes matching `.tag.type.type-*` style. */
export function rangeTagClass(rangeOrMove) {
  const range = typeof rangeOrMove === 'string' ? rangeOrMove : moveRange(rangeOrMove);
  if (range !== 'melee' && range !== 'ranged') return '';
  return `tag range range-${range}`;
}
