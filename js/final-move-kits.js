/** Final-form kits: [primary, coverage, utility]. Utility effect is heal | atk | def. */
export const FINAL_MOVE_KITS = {
  mega_beedrill: [
    { name: '飞弹针', power: 89, type: 'bug' },
    { name: '地震', power: 74, type: 'ground' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_salamence: [
    { name: '流星群', power: 89, type: 'dragon' },
    { name: '地震', power: 74, type: 'ground' },
    { name: '龙之舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_dragonite: [
    { name: '流星群', power: 89, type: 'dragon' },
    { name: '火焰拳', power: 74, type: 'fire' },
    { name: '龙之舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_raichu: [
    { name: '伏特攻击', power: 90, type: 'electric' },
    { name: '冰冻拳', power: 75, type: 'ice' },
    { name: '诡计', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_luxray: [
    { name: '伏特替换', power: 89, type: 'electric' },
    { name: '冰冻牙', power: 74, type: 'ice' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_gardevoir: [
    { name: '薄雾球', power: 89, type: 'fairy' },
    { name: '真气弹', power: 74, type: 'fighting' },
    { name: '冥想', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_machamp: [
    { name: '近身战', power: 89, type: 'fighting' },
    { name: '岩崩', power: 74, type: 'rock' },
    { name: '健美', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_ninetales: [
    { name: '炼狱', power: 89, type: 'fire' },
    { name: '日光束', power: 74, type: 'grass' },
    { name: '冥想', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_charizard: [
    { name: '爆炸烈焰', power: 89, type: 'fire' },
    { name: '日光束', power: 74, type: 'grass' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_cinderace: [
    { name: '火焰球·极', power: 90, type: 'fire' },
    { name: '飞膝踢', power: 75, type: 'fighting' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_gengar: [
    { name: '暗影潜袭', power: 89, type: 'ghost' },
    { name: '真气弹', power: 74, type: 'fighting' },
    { name: '诡计', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_vileplume: [
    { name: '强力鞭', power: 89, type: 'grass' },
    { name: '地震', power: 74, type: 'ground' },
    { name: '光合作用', power: 0, type: 'normal', effect: 'heal' },
  ],
  mega_meganium: [
    { name: '日光光束', power: 89, type: 'grass' },
    { name: '地震', power: 74, type: 'ground' },
    { name: '光合作用', power: 0, type: 'normal', effect: 'heal' },
  ],
  mega_venusaur: [
    { name: '花瓣暴风', power: 90, type: 'grass' },
    { name: '地震', power: 75, type: 'ground' },
    { name: '光合作用', power: 0, type: 'normal', effect: 'heal' },
  ],
  mega_walrein: [
    { name: '绝对零度', power: 89, type: 'ice' },
    { name: '地震', power: 74, type: 'ground' },
    { name: '睡觉', power: 0, type: 'normal', effect: 'heal' },
  ],
  mega_golduck: [
    { name: '幻象光线', power: 89, type: 'psychic' },
    { name: '真气弹', power: 74, type: 'fighting' },
    { name: '冥想', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_alakazam: [
    { name: '未来预知', power: 89, type: 'psychic' },
    { name: '真气弹', power: 74, type: 'fighting' },
    { name: '冥想', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_golem: [
    { name: '岩石崩塌', power: 90, type: 'rock' },
    { name: '地震', power: 75, type: 'ground' },
    { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
  ],
  mega_aggron: [
    { name: '重磅冲撞', power: 89, type: 'steel' },
    { name: '地震', power: 74, type: 'ground' },
    { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
  ],
  mega_steelix: [
    { name: '重磅冲撞', power: 89, type: 'steel' },
    { name: '地震', power: 74, type: 'ground' },
    { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
  ],
  mega_magnezone: [
    { name: '铁卷尾', power: 89, type: 'steel' },
    { name: '地震', power: 74, type: 'ground' },
    { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
  ],
  mega_gyarados: [
    { name: '破坏光线', power: 89, type: 'water' },
    { name: '冰冻牙', power: 74, type: 'ice' },
    { name: '龙之舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_kingdra: [
    { name: '水炮', power: 89, type: 'water' },
    { name: '冰冻光束', power: 74, type: 'ice' },
    { name: '龙之舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_swampert: [
    { name: '浊流', power: 89, type: 'water' },
    { name: '冰冻拳', power: 74, type: 'ice' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  mega_blastoise: [
    { name: '加农水炮', power: 90, type: 'water' },
    { name: '冰冻光束', power: 75, type: 'ice' },
    { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
  ],
  mega_rayquaza: [
    { name: '飞冲升天', power: 140, type: 'flying' },
    { name: '龙星群', power: 125, type: 'dragon' },
    { name: '龙之舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  zacian: [
    { name: '圣剑', power: 110, type: 'fairy' },
    { name: '地震', power: 95, type: 'ground' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  zamazenta: [
    { name: '巨兽斩', power: 105, type: 'fighting' },
    { name: '咬碎', power: 90, type: 'dark' },
    { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
  ],
  lugia: [
    { name: '空气爆破', power: 100, type: 'flying' },
    { name: '精神强念', power: 85, type: 'psychic' },
    { name: '自我再生', power: 0, type: 'normal', effect: 'heal' },
  ],
  ho_oh: [
    { name: '神圣之火', power: 110, type: 'fire' },
    { name: '日光束', power: 95, type: 'grass' },
    { name: '自我再生', power: 0, type: 'normal', effect: 'heal' },
  ],
  latias: [
    { name: '薄雾球', power: 95, type: 'psychic' },
    { name: '真气弹', power: 80, type: 'fighting' },
    { name: '治愈波动', power: 0, type: 'normal', effect: 'heal' },
  ],
  latios: [
    { name: '洁净光芒', power: 100, type: 'dragon' },
    { name: '地震', power: 85, type: 'ground' },
    { name: '冥想', power: 0, type: 'normal', effect: 'atk' },
  ],
  koraidon: [
    { name: '大愤慨', power: 120, type: 'fighting' },
    { name: '岩崩', power: 105, type: 'rock' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  miraidon: [
    { name: '电光束', power: 120, type: 'electric' },
    { name: '冰冻光束', power: 105, type: 'ice' },
    { name: '充电', power: 0, type: 'normal', effect: 'atk' },
  ],
  lucario: [
    { name: '波导弹', power: 81, type: 'fighting' },
    { name: '恶之波动', power: 66, type: 'dark' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  garchomp: [
    { name: '龙爪', power: 81, type: 'dragon' },
    { name: '地震', power: 66, type: 'ground' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  tyranitar: [
    { name: '岩崩', power: 81, type: 'rock' },
    { name: '地震', power: 66, type: 'ground' },
    { name: '龙之舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  metagross: [
    { name: '彗星拳', power: 81, type: 'steel' },
    { name: '地震', power: 66, type: 'ground' },
    { name: '铁壁', power: 0, type: 'normal', effect: 'def' },
  ],
  togekiss: [
    { name: '空气斩', power: 81, type: 'fairy' },
    { name: '喷射火焰', power: 66, type: 'fire' },
    { name: '羽栖', power: 0, type: 'normal', effect: 'heal' },
  ],
  hitmonlee: [
    { name: '飞踢', power: 77, type: 'fighting' },
    { name: '岩崩', power: 62, type: 'rock' },
    { name: '剑舞', power: 0, type: 'normal', effect: 'atk' },
  ],
  hitmonchan: [
    { name: '冲天拳', power: 77, type: 'fighting' },
    { name: '岩崩', power: 62, type: 'rock' },
    { name: '健美', power: 0, type: 'normal', effect: 'atk' },
  ],
};

export function castMoveNames(species, { squadBoss = false } = {}) {
  if (!squadBoss) return [];
  const moves = species?.moves?.length ? species.moves : (species?.move ? [species.move] : []);
  return moves.filter((move) => !move.effect).map((move) => move.name);
}

export function applyFinalMoveKits(species, kits = FINAL_MOVE_KITS) {
  const next = { ...species };
  for (const [id, moves] of Object.entries(kits)) {
    if (!next[id]) throw new Error(`final move kit missing species ${id}`);
    const primary = moves[0];
    next[id] = {
      ...next[id],
      move: { name: primary.name, power: primary.power, type: primary.type },
      moves: moves.map((move) => ({ ...move })),
    };
  }
  return next;
}
