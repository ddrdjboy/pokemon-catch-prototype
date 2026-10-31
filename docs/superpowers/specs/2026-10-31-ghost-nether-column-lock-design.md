# 幽灵冥界同列卡位设计

## 目标

把「幽灵冥界」阵型战的前后排锁定改成更接近魔力宝贝：我方近战打敌时，**同列前排存活则不能打该列后排**；远程/魔法无视卡位。仅改 `ghost_nether` 的 `formation` 规则，其它地图不变。

## 背景

现行规则（`legalFormationTargets` + `pierce`）：

- 前排任意存活 → 近战只能锁整排前排
- 前排全部清空后 → 后排全开
- 少数带 `pierce: true` 的招可锁全场

与魔力宝贝不一致：魔力宝贝是**同列**前排挡同列后排，不是整排清空才开后排；远程通常不受卡位。

本设计替换上述锁定模型。布局、门槛、助战、胜负、捕捉流程仍以 `2026-10-25-ghost-nether-design.md` 为准；本文只覆盖目标锁定与招式射程。

## 决策摘要

| 项 | 选择 |
| --- | --- |
| 卡位单位 | 敌方同列（`col` 0–4） |
| 近战（我方→敌） | 可锁全部存活前排；某列后排仅当同列前排已倒 |
| 远程 / 魔法 | 可锁任意存活敌 |
| 我方站位 | 仍单排；不做我方前后排、不做换位 |
| 敌方→我方 | 不变（我方无前后排） |
| 招式标记 | `range: 'melee' \| 'ranged'`；`pierce: true` 视为 ranged |
| 范围 | 仅 `battle.formation` / `ghost_nether` |

## 站位

敌方保持 5 列 × 2 排，前后同列对齐：

```
后排:  [小怪] [改·达克莱伊] [改·露奈雅拉] [改·克雷色利亚] [小怪]
前排:  [小怪] [小怪]       [小怪]       [小怪]         [小怪]
       col0   col1         col2         col3           col4
我方:  单排（玩家 + 4 助战），无 col 卡位角色
```

开战时每个敌槽必须带：

- `row: 'front' | 'back'`
- `col: 0..4`（前后排同下列相同）

`rollEncounter` / `syncEncounters` 生成 formation 时按数组下标写入 `col`（front[i]、back[i] → `col: i`）。

## 锁定规则

### `moveIsRanged(move)`

```
true  当 move.range === 'ranged' 或 move.pierce === true
false 其它伤害招（缺省视为 melee）
功能招（effect）不走敌方锁定
```

### `legalFormationTargets(foes, { ranged })`

1. 取 `hp > 0` 的敌。
2. 若 `ranged` → 返回全部存活。
3. 否则（近战）：
   - 加入所有 `row === 'front'` 的存活单位；
   - 对每个存活 `row === 'back'`：若同 `col` 不存在存活前排，则加入。

例：col2 前排仍活 → 近战不能锁露奈雅拉；打死 col2 前排后 → 近战可锁露奈雅拉；col1/col3 前排仍活则对应后排仍锁。

### 结算

`resolveFormationTurn`：

- 玩家与助战出手前，用当前招式算 `ranged = moveIsRanged(move)`，再取合法目标。
- 玩家点选的 `playerTargetIndex` 若已非法（前排中途倒下导致后排刚开/或仍锁），回退到合法列表：优先同列合法目标，否则合法中 HP 比例最低者。
- 助战 AI：在合法目标中选 HP 比例最低者。
- 敌方打我方：逻辑不变。

## 招式内容

全图鉴伤害招式通过 `js/move-range.js` 的 `MOVE_RANGE` 名表区分近战/远程；`speciesMoveList` 会盖上 `range`。

| 规则 | 做法 |
| --- | --- |
| 判定顺序 | 显式 `move.range` → `pierce: true` → 名表 `MOVE_RANGE` |
| 功能招 | `effect` 存在时 `moveRange` 返回 `null`，不参与卡位 |
| 兼容 | `pierce: true`（如穿影袭）视为 ranged |
| 边界约定 | 火焰牙 = melee；真空波、龙之怒 = ranged |

`aoe` 敌方全体技仍打我方全体；若将来有我方 `aoe` 打敌，对每个敌位各自套用上述锁定（或仅打合法目标集合）——本版若无我方敌向 AoE，可不实现。

## UI（仅阵型战）

- 选近战招：非法后排半透明不可点；可点全部存活前排 + 已开列后排。
- 选远程招：全部存活可点。
- 文案：「同列前排挡住后排」/「远程可穿位」（替换「清掉前排才能打后排」类提示）。
- 不改卡片布局与助战芯片结构。

## 数据落点

| 文件 | 变更 |
| --- | --- |
| `js/battle.js`（或 `battle-moves.js`） | `moveIsRanged`、`legalFormationTargets` 同列逻辑；`resolveFormationTurn` 传入 ranged |
| `js/data.js` / 遭遇生成 | formation 敌槽写 `col`；Boss/需远程招补 `range` |
| `js/game.js` | 阵型选目标高亮与提示按当前招式 ranged/melee |
| `tests/battle-catch.test.js` | 同列卡位、开列、远程穿位；删除/改写整排清空用例 |

## 非目标

- 我方前后排与换位
- 把阵型锁定推广到双子塔 / 1v1 / 裂隙 / 灵堂
- 完整魔力宝贝职业、怒气、合击、敏序修正
- 批量给全图鉴加 `range`

## 验收

1. 同列前排存活时，近战无法选中该列后排。
2. 打死该列前排后，近战可选中该列后排；其它列前排仍活则其它列后排仍不可近战选中。
3. 远程招可选中任意存活敌（含前排未清的后排）。
4. `pierce: true` 与 `range: 'ranged'` 行为一致。
5. 非 formation 战斗与既有测试不受影响；`npm test` 通过。

## 与旧规格关系

- 扩展 / 修正 `2026-10-25-ghost-nether-design.md` 中「锁定」一节。
- 旧文「前排清空后后排全部可被锁定」「pierce 无视前排」由本文同列 + ranged 模型取代。
