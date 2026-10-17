# 我的宝可梦：横滑三种样式 + 设置切换

日期：2026-10-17  
状态：已确认，待实现计划

## 问题

选图页右侧「我的宝可梦」当前为纵向大卡片列表，占用过多 UI。需要改成更紧凑的横向滚动，并同时提供 3 种视觉样式，让玩家可在设置里切换。

## 目标

1. 选图页队伍区改为固定高度横滑条，显著降低占用高度。
2. 卡片默认极简：立绘 + 名字 + 等级；出场用描边/角标区分。
3. 点击卡片弹出操作：左移 / 右移 / 收回或上场。
4. 三种样式全部实现，并通过设置入口切换，选择持久化到存档。

## 非目标

- 本轮不把「卖掉」放进弹层（保留后续扩展空间）。
- 不改对战/捕捉核心逻辑；`#pick-party` 仍用于选怪，可复用卡面样式，但不提供收回/上场。
- 不做拖拽排序。

## 数据模型

沿用现有 `state.party` 顺序：

- 索引 `0 .. ACTIVE_CAP-1`（前 6）= **出场**，可参战
- 索引 `ACTIVE_CAP ..` = **背包**，不可参战

新增存档字段：

```text
partyStyle: 'capsule' | 'tile' | 'split'   // 默认 'capsule'
```

与现有 `catchStyle` 一样：在 `hydrateState` 中校验，非法值回退默认；`save()` 随整份 state 写入 localStorage。重新开始（reset）回到默认 `capsule`。

## 操作语义

### 左移 / 右移

在 `movePartyMember` 之上增加**边界约束**：

- 左/右移只允许在同一分区内换序（出场区内，或背包区内）。
- **第 6 只（index === ACTIVE_CAP - 1）不能右移**——不能靠右移挤进背包。
- **背包第一只（index === ACTIVE_CAP）不能左移**——不能靠左移挤进出场。
- 分区内首只不能左移、末只不能右移（按钮禁用）。

### 收回

仅出场位显示。将目标从出场移入背包（index ≥ `ACTIVE_CAP`）：

- `recallToBag(party, uid)`：从当前 index 取出，插入到 party **末尾**。
- 其后成员前移填补；目标最终 index ≥ `ACTIVE_CAP`，不再属于 `activeParty`。
- **前置条件**：`party.length > ACTIVE_CAP` 且目标当前 index `< ACTIVE_CAP`。队伍总数 ≤ 6 时全体都算出场，无真正背包，「收回」按钮禁用。

### 上场

仅背包位显示。将目标补进出场：

- `sendToActive(party, uid)`：从背包取出，插入到 index `ACTIVE_CAP - 1`（成为新的第 6 只）。
- 原第 6 只及之后顺延（原第 6 进入背包）。
- **前置条件**：目标当前 index ≥ `ACTIVE_CAP`（因此必然 `party.length > ACTIVE_CAP`）。

### 弹层关闭

点空白处、点同一张卡再次、或操作成功后自动关闭。

## 三种视觉样式

根容器（如 `#screen-select .split-pane:last-child` 或 `#party-list` 的父级）设置：

```text
data-party-style="capsule" | "tile" | "split"
```

| ID | 名称 | 外观 |
|----|------|------|
| `capsule` | 胶囊条 | 矮横条卡片（约 56–64px 高），小立绘 + 名 + Lv，出场描边；弹层为贴卡小气泡 |
| `tile` | 精灵球瓷砖 | 方卡（约 72×88），立绘为主、等级角标、名字一行；弹层可居中小面板 |
| `split` | 双段横轨 | 卡面同 capsule；列表内用「出场」「背包」分段标题/分割线，两段各自横滑或同轨分段 |

三种样式共用同一套 DOM 结构与 JS 交互，仅 CSS（及 split 的分段渲染）不同。

## UI 结构

### 选图页队伍区

- 标题行保留：`我的宝可梦` + `n/99`
- 去掉长纵向 `pane-scroll` 占半屏；改为固定高度横滑区域
- Hint 改为简短说明：点卡可排序；前 6 出场；收回进背包，上场回前 6
- `#party-list` 改为横向 `overflow-x: auto`（split 样式下可为两段 list）

### 设置入口

- 顶部状态栏「商店」旁增加 **「显示」** 按钮
- 打开小面板，三项单选：胶囊条 / 精灵球瓷砖 / 双段横轨
- 选中即时套用 `partyStyle` 并 `save()`

### 卡片内容（管理态，非 selectable）

```text
[sprite]  name
          Lv.N   [出场角标可选]
```

点击 → 操作条/气泡：`左移` `右移` `收回|上场`

## 文件改动（预期）

| 文件 | 改动 |
|------|------|
| `js/data.js` | `recallToBag`、`sendToActive`；可选收紧 `movePartyMember` 或新增 `moveWithinZone` |
| `js/game.js` | 重写/精简 `renderParty` 管理态；弹层；`partyStyle` 读写；显示设置 UI |
| `css/game.css` | 横滑布局 + 三套 `data-party-style` 样式 + 弹层/设置面板 |
| `index.html` | 显示按钮、设置面板结构；队伍区 hint/结构微调 |
| `tests/battle-catch.test.js` | 覆盖 recall / sendToActive / 跨区禁止移动 |

## 边界与错误处理

- `party.length ≤ ACTIVE_CAP`：「收回」全部禁用（没有背包区）。
- `party.length > ACTIVE_CAP`：出场位可收回；第 6 只右移禁用；背包首只左移禁用。
- 背包为空时（仅当 length ≤ 6）：split 样式隐藏「背包」空段，避免占高。
- 非法 `partyStyle` 加载时回退 `capsule`。
- 本轮不改「卖掉」；原卖出口径若仍需要，后续再加回弹层。

## 测试要点

1. 前 6 内左/右移换序，第 6 右移按钮禁用。
2. 收回后目标不在 `activeParty`，且出现在背包区。
3. 上场后目标进入前 6；原满员时原第 6 进入背包。
4. 背包首只左移禁用；上场按钮可用。
5. 三种 `partyStyle` 切换后 DOM/`data-party-style` 与存档一致，刷新后保持。
6. `#pick-party` 仍可正常选出战。

## 实现顺序建议

1. data 层动作 + 单测  
2. 精简横滑卡 + 弹层交互（先 capsule）  
3. tile / split CSS 与 split 分段渲染  
4. 「显示」设置面板与持久化  
5. 文案、移动端间距、回归选怪屏  
