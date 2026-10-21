# 灵堂小地图 Design

**Date:** 2026-10-21  
**Repo:** `redfish`（`pokemon-catch-prototype`）  
**Status:** Approved approach A（Canvas 纯展示）

## Goal

在灵堂迷宫视口右上角显示整层缩略图，标出墙/地板、玩家与楼梯，方便找路；不可点击。

## Decisions

| 项 | 选择 |
|----|------|
| 实现 | `#maze-viewport` 内右上角 `<canvas id="maze-minimap">` |
| 内容 | 墙、地板、楼梯、玩家；**不**画游荡怪 / Boss |
| 交互 | `pointer-events: none`，纯展示 |
| 尺寸 | 约 104×104（桌面）；窄屏可略缩到 ~88 |
| 外观 | 半透明深底、细边框；墙深、地板浅、楼梯高亮、玩家亮点 |

## Behavior

1. 进入层 / `renderMaze()`：按 `mazeRun.grid` 重绘整张小地图，并画楼梯与玩家。  
2. 玩家移动（步进、寻路、摇杆）后：更新玩家点（可整画重绘，网格不大）。  
3. 层切换或退出：随 `renderMaze` / 关屏自然刷新或隐藏。  
4. 不挡摇杆、点地、顶栏按钮。

## Implementation sketch

- **HTML:** 在 `#maze-viewport` 内、toast 旁加 `<canvas id="maze-minimap" class="maze-minimap" width="104" height="104" aria-hidden="true">`。  
- **CSS:** `.maze-minimap` 绝对定位 `top/right`，`z-index` 低于 toast、高于 crosshair 即可；`pointer-events: none`。  
- **JS:** `paintMazeMinimap()` 读 `mazeRun.grid` / `player` / `stairs`；由 `renderMaze` 与移动后路径调用。可放在 `js/game.js`，若绘制逻辑超 ~40 行则抽到 `js/maze-minimap.js`。

## Colors (indicative)

- 背景：`rgba(10, 12, 18, 0.72)`  
- 墙：`#2a3340`  
- 地板：`#6b7c8f`  
- 楼梯：`#ffd54f`  
- 玩家：`#4fc3f7`

## Out of scope

- 点击小地图寻路  
- 迷雾 / 未探索遮罩  
- 游荡怪、Boss 图标  
- 当前主视口矩形框（首版不做）

## Verification

1. 进灵堂右上角可见小地图，轮廓与主地图一致。  
2. 走路时玩家点跟随；楼梯点固定在楼梯格。  
3. 拖选仍被 `#screen-maze` 禁选；摇杆与点地不受影响。  
4. `npm test` 通过。
