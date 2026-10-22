# 头目 UI：红眼改为容器红描边

日期：2026-10-21  
状态：已确认，待实现计划

## 问题

闪光与头目的 UI 通道不对等：

- **闪光**：全身色相偏移（地图 / 战斗 / 队伍卡均有）
- **头目**：战斗与捕捉叠两个红光点（`.boss-eyes`），地图仅靠文字 tag，**队伍主界面卡无任何标识**

红眼易被读成贴图错误；威胁感弱于闪光的稀有感。迷宫头目已用红描边（`.maze-entity.boss`），其余界面未对齐。

## 目标

1. 头目的主视觉信号统一为**容器红描边**（方案 A），全链路一致。
2. 删除战斗立绘与捕捉动画中的红眼。
3. 闪光继续用色相偏移；两者叠加时并行（变色 + 红框）。
4. 文字 tag「头目 / 闪光」保留，作确认，不当唯一识别。

## 非目标

- 不改头目数值、捕获率、售价、遭遇/roll 逻辑。
- 不改闪光色相参数与 tag 配色。
- 不做精灵剪影描边或独立 Boss 装饰框组件。
- 不重做迷宫（已有红描边，保持现状）。

## 视觉语言

| 项 | 规格 |
|----|------|
| 颜色 | `#ff6b6b`（与 `.maze-entity.boss` 一致） |
| 样式 | 默认可交互卡片用 `box-shadow: 0 0 0 2px #ff6b6b`（把 `outline` 留给 `:focus-visible`）；纯展示槽（战斗 `sprite-wrap`、已对齐迷宫的 marker）可用 `outline: 2px solid #ff6b6b` |
| 偏移 | outline 时 `outline-offset: 1px`；box-shadow 不需 offset |
| 圆角 | 跟随容器 |

**叠加**

- 仅闪光 → 色相，无红框
- 仅头目 → 正常色 + 红框
- 闪光头目 → 色相 + 红框

**删除**

- `.boss-eyes` 及相关 HTML / CSS / `catch.js` canvas 红眼绘制

## 各界面落点

| 界面 | 行为 |
|------|------|
| 战斗立绘 | `mon.boss` → `.sprite-wrap.boss` 红描边；去掉红眼 |
| 捕捉动画 | boss 时精灵周围画椭圆描边（`#ff6b6b`，线宽 `2`）；去掉红眼 |
| 地图 marker | `boss` 时加 `.marker.boss` 红描边；保留 tag |
| 队伍主界面卡 | `mon.boss` → `.party-card.boss` **整卡**红描边 |
| 出战 / 双打选卡 | 同队伍卡：`boss` class + 红描边；保留 tag |
| 迷宫 | 不动 |

## 边界情况

- **双打 / 小队（地图）**：`enc.boss` 为真 → marker 整卡红描边。
- **双打（战斗）**：每个 foe slot 按自身 `mon.boss` 独立加框。
- **训练家（地图）**：队内任意一只 `boss` → marker 红描边（与现有 any-boss tag 一致）。
- **训练家（战斗）**：仅当前出战且 `mon.boss` 的精灵加框。
- **已清除 marker**：可保留 boss class；继续靠 `.cleared` 的 `opacity: 0.35` 降权。
- **交互态**：`selected` / `in-battle` / `:hover` 与 boss 描边并存；boss 身份框常驻。
- **焦点环**：可聚焦的队伍卡 / marker 上头目用 `box-shadow`，`:focus-visible` 继续用 accent `outline`，两者同时可见。

## 实现面（预览）

- `css/game.css`：新增 `.sprite-wrap.boss` / `.marker.boss` / `.party-card.boss`；删除 `.boss-eyes`
- `js/game.js`：`renderSprite`、队伍 `buildCard`、地图 marker class
- `js/catch.js`：红眼 → 椭圆描边

## 验证

- 无头目：无红框、无红眼残留。
- 仅头目、仅闪光、闪光头目：信号符合叠加规则。
- 训练家混队、双打两槽、小队挑战：地图与战斗表现符合边界规则。
- 队伍卡（含 popover 打开）红描边不严重裁切错位。
- 迷宫头目外观与改前一致。
