# 灵堂禁选中 Design

**Date:** 2026-10-21  
**Repo:** `redfish`（`pokemon-catch-prototype`，灵堂所在工作区）  
**Status:** Approved approach A

## Problem

在灵堂（`#screen-maze`）里拖鼠标或长按会出现浏览器蓝色选区，干扰操作。摇杆 `.maze-stick` 已有 `user-select: none`，但迷宫视口与标题区未禁选。

## Goal

灵堂屏内不可拖选文字/节点；选图、商店、图鉴等其它界面保持默认可选。

## Approach

在 `css/game.css` 对 `#screen-maze` 及其后代设置：

```css
#screen-maze,
#screen-maze * {
  -webkit-user-select: none;
  user-select: none;
}
```

不改 JS，不加全局 `body` 禁选。

## Scope

| In | Out |
|----|-----|
| `#screen-maze` 整屏（标题、退出、视口、摇杆、toast） | 其它 `screen` / modal |
| 仅 CSS | 全局禁选、`selectstart` 拦截 |

## Verification

1. 进入灵堂，在地图与顶栏上拖选 → 无蓝色选区。  
2. 退出按钮、信息按钮、摇杆仍可点。  
3. 选图/商店等仍可拖选文字（对照）。

## Out of scope

- 同步到 `sole` / 其它未含灵堂的工作区  
- 整站 `user-select: none`
