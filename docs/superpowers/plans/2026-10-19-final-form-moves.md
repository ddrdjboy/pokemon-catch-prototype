# 最终形态与传说技能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 41 只终点宝可梦各写入 3 个技能（主力、覆盖、功能），图鉴能看到功能效果，现有普通战斗仍只用主力招。

**Architecture:** 技能表放在 `js/final-move-kits.js`，由 `js/data.js` 在合并物种之后套上。这样生成脚本重跑不会冲掉技能。`move` 始终等于主力攻击（不带 `effect`），`resolveTurn` 继续只读 `move`。超级裂空座的 `moves` 会换成这三格；裂隙头目施放技能时跳过带 `effect` 的招，不结算回复、加攻、加防。

**Tech Stack:** 原生 ES modules、现有 DOM 图鉴、Node 断言测试（`npm test`）

**Spec:** `docs/superpowers/specs/2026-10-19-final-form-moves-design.md`

---

### Task 1: 写入 41 只技能表

**Files:**
- Create: `js/final-move-kits.js`
- Modify: `js/data.js`（`SPECIES` 导出处）
- Modify: `js/battle.js`（`resolveSquadTurn`、`resolveSquadItemTurn` 里筛技能的两处）
- Modify: `tests/battle-catch.test.js`（裂空座技能断言）
- Test: `tests/final-move-kits.test.js`

- [ ] **Step 1: Write the failing test**

创建 `tests/final-move-kits.test.js`：

```js
import assert from 'node:assert/strict';
import { SPECIES } from '../js/data.js';

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
```

把 `package.json` 的 test 脚本改成：

```json
"test": "node tests/battle-catch.test.js && node tests/final-move-kits.test.js"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/final-move-kits.test.js`

Expected: FAIL，`mega_beedrill` 的 `moves` 不是 3 项（断言 `sp.moves?.length`）。

- [ ] **Step 3: Write the kit module and apply it**

创建 `js/final-move-kits.js`。把下面每行转成招式对象：前三项是攻击招 `{ name, power, type }`，第四项存在时是功能招 `{ name, power, type, effect }`。

```js
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
```

在 `js/data.js` 顶部增加：

```js
import { applyFinalMoveKits } from './final-move-kits.js';
```

把

```js
export const SPECIES = { ...GENERATED_SPECIES, ...REGION_SPECIES, ...BASE_SPECIES };
```

换成

```js
export const SPECIES = applyFinalMoveKits({ ...GENERATED_SPECIES, ...REGION_SPECIES, ...BASE_SPECIES });
```

在 `js/battle.js` 的 `resolveSquadTurn` 和 `resolveSquadItemTurn` 里，把这两行：

```js
const heavies = kit.filter((move) => !move.aoe);
const waves = kit.filter((move) => move.aoe);
```

都换成：

```js
const heavies = kit.filter((move) => !move.aoe && !move.effect);
const waves = kit.filter((move) => move.aoe && !move.effect);
```

不要在 `resolveTurn` 里改选招。普通战斗仍然只用 `SPECIES[id].move`。

在 `tests/battle-catch.test.js` 把裂空座这三行：

```js
assert(kit.length === 4 && kit.some((move) => move.aoe) && kit.every((move) => move.power >= 45), 'rayquaza has a heavy kit');
assert(Math.max(...kit.map((move) => move.power)) >= 140, 'signature move is much stronger');
```

以及后面的：

```js
assert(foeLogs.some((line) => line.text.includes('龙星群')), 'opens with 龙星群');
assert(foeLogs.filter((line) => line.text.includes('空气斩')).length >= 3, '空气斩 hits the standing squad');
const heavy = foeLogs.find((line) => line.text.includes('龙星群'));
```

换成：

```js
assert(kit.length === 3 && kit.every((move) => !move.aoe), 'rayquaza kit is three single-target moves');
assert(kit[2].effect === 'atk' && kit[2].power === 0, 'rayquaza utility is not a damaging move');
assert(Math.max(...kit.map((move) => move.power)) >= 140, 'signature move is much stronger');
```

```js
assert(foeLogs.some((line) => line.text.includes('飞冲升天')), 'opens with 飞冲升天');
assert(foeLogs.every((line) => !line.text.includes('空气斩')), '空气斩 is no longer cast');
assert(foeLogs.every((line) => !line.text.includes('龙之舞')), 'utility move is not cast');
const heavy = foeLogs.find((line) => line.text.includes('飞冲升天'));
```

`level 100 squad falls before the boss` 和 `level 140 squad beats rayquaza` 两句断言保持不变。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: `battle-catch.test.js` 以 `passed, 0 failed` 结束，随后 `final-move-kits.test.js` 无输出退出码 0。

- [ ] **Step 5: Commit**

```bash
git add js/final-move-kits.js js/data.js js/battle.js tests/final-move-kits.test.js tests/battle-catch.test.js package.json
git commit -m "$(cat <<'EOF'
Add three-move kits for final forms and legendaries.

EOF
)"
```

---

### Task 2: 图鉴显示功能效果

**Files:**
- Modify: `js/data.js`（`getDexDetail`）
- Modify: `js/game.js`（`renderDexDetail` 的招式列表）
- Modify: `tests/final-move-kits.test.js`

- [ ] **Step 1: Write the failing test**

在 `tests/final-move-kits.test.js` 顶部的 import 改为：

```js
import { SPECIES, getDexDetail } from '../js/data.js';
```

在文件末尾追加：

```js
const detail = getDexDetail('mega_charizard');
assert.equal(detail.moves.length, 3);
assert.equal(detail.moves[2].effect, 'atk');
assert.equal(detail.moves[0].effect, undefined);
assert.equal(getDexDetail('charmander').moves[0].effect, undefined);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/final-move-kits.test.js`

Expected: FAIL，`detail.moves[2].effect` 为 `undefined`。

- [ ] **Step 3: Pass effect through the dex and label it**

在 `js/data.js` 的 `getDexDetail` 里，把

```js
moves: moves.map((m) => ({ name: m.name, power: m.power, type: m.type })),
```

换成

```js
moves: moves.map((m) => ({
  name: m.name,
  power: m.power,
  type: m.type,
  ...(m.effect ? { effect: m.effect } : {}),
})),
```

在 `js/game.js` 的 `renderDexDetail` 里，把招式列表改成：功能招显示效果名，攻击招仍显示属性和威力。

```js
const effectLabel = { heal: '回复', atk: '加攻', def: '加防' };
const moveLines = detail.moves
  .map((m) => (
    m.effect
      ? `<li>${m.name}（${effectLabel[m.effect]}）</li>`
      : `<li>${m.name}（${typeLabel(m.type)} · 威力 ${m.power}）</li>`
  ))
  .join('');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: 两个测试文件都通过。

- [ ] **Step 5: Commit**

```bash
git add js/data.js js/game.js tests/final-move-kits.test.js
git commit -m "$(cat <<'EOF'
Show utility move effects in the Pokédex detail.

EOF
)"
```

---

## 不做

- 不改 `resolveTurn` 的选招
- 不结算回复、加攻、加防的数值
- 不改中间形态、初阶，也不改 `TYPE_CHART`
- 不改 `scripts/generate-content.mjs` 和 `scripts/generate-region.mjs`（技能由表覆盖，重跑生成脚本不会丢掉）
