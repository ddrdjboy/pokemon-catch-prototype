import assert from 'node:assert/strict';
import { SPECIES, getDexDetail } from '../js/data.js';
import { castMoveNames } from '../js/final-move-kits.js';

const EXPECTED = {
  mega_beedrill: [['飞弹针', 89, 'bug'], ['地震', 74, 'ground'], ['剑舞', 0, 'normal', 'atk']],
  mega_salamence: [['流星群', 89, 'dragon'], ['地震', 74, 'ground'], ['龙之舞', 0, 'normal', 'atk']],
  mega_dragonite: [['流星群', 89, 'dragon'], ['火焰拳', 74, 'fire'], ['龙之舞', 0, 'normal', 'atk']],
  mega_raichu: [['伏特攻击', 90, 'electric'], ['冰冻拳', 75, 'ice'], ['诡计', 0, 'normal', 'atk']],
  mega_luxray: [['伏特替换', 89, 'electric'], ['冰冻牙', 74, 'ice'], ['剑舞', 0, 'normal', 'atk']],
  mega_gardevoir: [['薄雾球', 89, 'fairy'], ['真气弹', 74, 'fighting'], ['冥想', 0, 'normal', 'atk']],
  mega_machamp: [['近身战', 89, 'fighting'], ['岩崩', 74, 'rock'], ['健美', 0, 'normal', 'atk']],
  mega_ninetales: [['炼狱', 89, 'fire'], ['日光束', 74, 'grass'], ['冥想', 0, 'normal', 'atk']],
  mega_charizard: [['爆炸烈焰', 89, 'fire'], ['日光束', 74, 'grass'], ['剑舞', 0, 'normal', 'atk']],
  mega_cinderace: [['火焰球·极', 90, 'fire'], ['飞膝踢', 75, 'fighting'], ['剑舞', 0, 'normal', 'atk']],
  mega_gengar: [['暗影潜袭', 89, 'ghost'], ['真气弹', 74, 'fighting'], ['诡计', 0, 'normal', 'atk']],
  mega_vileplume: [['强力鞭', 89, 'grass'], ['地震', 74, 'ground'], ['光合作用', 0, 'normal', 'heal']],
  mega_meganium: [['日光光束', 89, 'grass'], ['地震', 74, 'ground'], ['光合作用', 0, 'normal', 'heal']],
  mega_venusaur: [['花瓣暴风', 90, 'grass'], ['地震', 75, 'ground'], ['光合作用', 0, 'normal', 'heal']],
  mega_walrein: [['绝对零度', 89, 'ice'], ['地震', 74, 'ground'], ['睡觉', 0, 'normal', 'heal']],
  mega_golduck: [['幻象光线', 89, 'psychic'], ['真气弹', 74, 'fighting'], ['冥想', 0, 'normal', 'atk']],
  mega_alakazam: [['未来预知', 89, 'psychic'], ['真气弹', 74, 'fighting'], ['冥想', 0, 'normal', 'atk']],
  mega_golem: [['岩石崩塌', 90, 'rock'], ['地震', 75, 'ground'], ['铁壁', 0, 'normal', 'def']],
  mega_aggron: [['重磅冲撞', 89, 'steel'], ['地震', 74, 'ground'], ['铁壁', 0, 'normal', 'def']],
  mega_steelix: [['重磅冲撞', 89, 'steel'], ['地震', 74, 'ground'], ['铁壁', 0, 'normal', 'def']],
  mega_magnezone: [['铁卷尾', 89, 'steel'], ['地震', 74, 'ground'], ['铁壁', 0, 'normal', 'def']],
  mega_gyarados: [['破坏光线', 89, 'water'], ['冰冻牙', 74, 'ice'], ['龙之舞', 0, 'normal', 'atk']],
  mega_kingdra: [['水炮', 89, 'water'], ['冰冻光束', 74, 'ice'], ['龙之舞', 0, 'normal', 'atk']],
  mega_swampert: [['浊流', 89, 'water'], ['冰冻拳', 74, 'ice'], ['剑舞', 0, 'normal', 'atk']],
  mega_blastoise: [['加农水炮', 90, 'water'], ['冰冻光束', 75, 'ice'], ['铁壁', 0, 'normal', 'def']],
  mega_rayquaza: [['飞冲升天', 140, 'flying'], ['龙星群', 125, 'dragon'], ['龙之舞', 0, 'normal', 'atk']],
  zacian: [['圣剑', 110, 'fairy'], ['地震', 95, 'ground'], ['剑舞', 0, 'normal', 'atk']],
  zamazenta: [['巨兽斩', 105, 'fighting'], ['咬碎', 90, 'dark'], ['铁壁', 0, 'normal', 'def']],
  lugia: [['空气爆破', 100, 'flying'], ['精神强念', 85, 'psychic'], ['自我再生', 0, 'normal', 'heal']],
  ho_oh: [['神圣之火', 110, 'fire'], ['日光束', 95, 'grass'], ['自我再生', 0, 'normal', 'heal']],
  latias: [['薄雾球', 95, 'psychic'], ['真气弹', 80, 'fighting'], ['治愈波动', 0, 'normal', 'heal']],
  latios: [['洁净光芒', 100, 'dragon'], ['地震', 85, 'ground'], ['冥想', 0, 'normal', 'atk']],
  koraidon: [['大愤慨', 120, 'fighting'], ['岩崩', 105, 'rock'], ['剑舞', 0, 'normal', 'atk']],
  miraidon: [['电光束', 120, 'electric'], ['冰冻光束', 105, 'ice'], ['充电', 0, 'normal', 'atk']],
  lucario: [['波导弹', 81, 'fighting'], ['恶之波动', 66, 'dark'], ['剑舞', 0, 'normal', 'atk']],
  garchomp: [['龙爪', 81, 'dragon'], ['地震', 66, 'ground'], ['剑舞', 0, 'normal', 'atk']],
  tyranitar: [['岩崩', 81, 'rock'], ['地震', 66, 'ground'], ['龙之舞', 0, 'normal', 'atk']],
  metagross: [['彗星拳', 81, 'steel'], ['地震', 66, 'ground'], ['铁壁', 0, 'normal', 'def']],
  togekiss: [['空气斩', 81, 'fairy'], ['喷射火焰', 66, 'fire'], ['羽栖', 0, 'normal', 'heal']],
  hitmonlee: [['飞踢', 77, 'fighting'], ['岩崩', 62, 'rock'], ['剑舞', 0, 'normal', 'atk']],
  hitmonchan: [['冲天拳', 77, 'fighting'], ['岩崩', 62, 'rock'], ['健美', 0, 'normal', 'atk']],
};

assert.equal(Object.keys(EXPECTED).length, 41);
for (const [id, rows] of Object.entries(EXPECTED)) {
  const sp = SPECIES[id];
  assert.ok(sp, id);
  assert.equal(sp.moves?.length, 3, id);
  rows.forEach((row, index) => {
    const move = sp.moves[index];
    assert.equal(move.name, row[0], `${id} ${index} name`);
    assert.equal(move.power, row[1], `${id} ${index} power`);
    assert.equal(move.type, row[2], `${id} ${index} type`);
    if (row[3]) assert.equal(move.effect, row[3], `${id} effect`);
    else assert.equal(move.effect, undefined, `${id} ${index} effect`);
  });
  assert.deepEqual(sp.move, { name: rows[0][0], power: rows[0][1], type: rows[0][2] }, `${id} primary`);
  assert.equal(sp.moves.some((move) => move.aoe), false, `${id} aoe`);
}
assert.equal(SPECIES.charizard.moves, undefined);
assert.equal(SPECIES.charizard.move.name, '喷射火焰');
assert.equal(SPECIES.charmander.moves, undefined);
assert.equal(SPECIES.cyndaquil.moves, undefined);

const detail = getDexDetail('mega_charizard');
assert.equal(detail.moves.length, 3);
assert.equal(detail.moves[2].effect, 'atk');
assert.equal(detail.moves[0].effect, undefined);
assert.equal(getDexDetail('charmander').moves[0].effect, undefined);

assert.deepEqual(castMoveNames(SPECIES.mega_rayquaza, { squadBoss: true }), ['飞冲升天', '龙星群']);
assert.deepEqual(castMoveNames(SPECIES.lucario, { squadBoss: false }), []);
assert.deepEqual(castMoveNames(SPECIES.lucario, { squadBoss: true }), ['波导弹', '恶之波动']);
