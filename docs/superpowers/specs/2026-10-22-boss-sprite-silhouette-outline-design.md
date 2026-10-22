# 头目 UI：立绘剪影红描边

日期：2026-10-22  
状态：已确认，实现中

## 问题

上一版头目信号是**容器红框**（按钮 / `sprite-wrap` outline）。产品期望是给**立绘像素外形**描红边。

## 目标

1. 头目主视觉 = 精灵透明剪影外一圈 `#ff6b6b` 描边（约 1–2px）。
2. 去掉战斗 / 地图 / 队伍上的容器红框（含 `.party-card.boss` box-shadow 叠层）。
3. 捕捉改为剪影描边，不再用椭圆环。
4. 闪光仍用色相；闪光头目 = 色相 + 红剪影边（红边不被染色）。
5. 「头目」文字 tag 保留。

## 方案

- DOM：`filter: drop-shadow(±npx … #ff6b6b)` 多层贴在 `<img>` 上（CSS 变量复用）。
- 队伍卡：`.sprite-frame` 在 boss 时 `overflow: visible`，避免裁切描边。
- 捕捉：离屏 canvas 填红剪影，按 8 向偏移绘制，再画本体。
- 迷宫：`.maze-entity.boss` 从容器 outline 改为同一套 img `drop-shadow`。

## 非目标

- 不改头目数值 / 捕获率 / 遭遇逻辑。
- 不重做独立 Boss 框组件。
