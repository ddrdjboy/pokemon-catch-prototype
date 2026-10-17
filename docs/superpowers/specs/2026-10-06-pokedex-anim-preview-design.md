# 图鉴详情帧动画预览设计

## 目标

对已有战斗帧条的物种（当前：炎兔儿、小火龙），在图鉴详情页提供「播放动画」：播一遍攻击帧后恢复静态图。

## 决策

| 项 | 选择 |
| --- | --- |
| 触发 | 手动点「播放动画」 |
| 播放 | 播一遍后恢复静态立绘 |
| 实现 | 复用 `battle-fx.js` 帧加载/播放 |

## 行为

- 仅当 `hasFighterFrames(id)` 时显示按钮。
- 播放中禁用按钮，防止连点。
- 关闭详情不要求打断；若播放中途 DOM 已卸，播放逻辑在 `finally` 里恢复即可。
- 预览不翻转朝向（与列表大图一致）。

## 落点

- `js/battle-fx.js`：抽出 `playFighterFrameStrip(img, speciesId)`；战斗攻击复用它
- `js/game.js`：详情渲染按钮并调用预览
- `css/game.css`：详情英雄区与按钮间距（如需）
- `tests/battle-catch.test.js`：覆盖 strip 播放时序（可用 mock loader）
