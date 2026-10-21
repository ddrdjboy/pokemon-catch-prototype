# 灵堂禁选中 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 灵堂屏（`#screen-maze`）内拖鼠标/长按不再出现浏览器蓝色选区。

**Architecture:** 仅在 `css/game.css` 对 `#screen-maze` 及其后代加 `user-select: none`（含 `-webkit-`）。不改 JS、不加全局禁选。

**Tech Stack:** 静态 CSS（`redfish` 工作区）

**Spec:** `docs/superpowers/specs/2026-10-21-maze-disable-selection-design.md`

---

### Task 1: 灵堂屏 CSS 禁选

**Files:**
- Modify: `css/game.css`（在 `.maze-panel` 规则之前插入）

- [x] **Step 1: 插入禁选规则**

在 `css/game.css` 中 `.maze-panel {` 之前加入：

```css
/* Spirit hall: no drag-selection highlight while exploring */
#screen-maze,
#screen-maze * {
  -webkit-user-select: none;
  user-select: none;
}
```

- [x] **Step 2: 确认规则存在**

Run: `rg -n "screen-maze" css/game.css`

Expected: 能看到 `#screen-maze` 与 `user-select: none` 相邻几行。

- [ ] **Step 3: 手动验收**（需本地打开灵堂拖选确认）

1. 本地打开游戏，进入灵堂。  
2. 在迷宫视口与顶栏拖选 → 无蓝色选区。  
3. 退出 / 信息 / 摇杆仍可点。  
4. 选图或商店仍可拖选文字。

- [x] **Step 4: Commit**

```bash
git add css/game.css docs/superpowers/specs/2026-10-21-maze-disable-selection-design.md docs/superpowers/plans/2026-10-21-maze-disable-selection.md
git commit -m "$(cat <<'EOF'
fix: disable text selection on spirit hall screen

EOF
)"
```
