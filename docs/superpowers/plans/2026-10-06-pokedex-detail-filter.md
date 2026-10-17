# 图鉴详情与属性筛选 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 图鉴列表增加属性芯片筛选；点击条目打开详情弹窗展示完整种族信息。

**Architecture:** `data.js` 扩展纯函数（过滤列表、属性枚举、详情投影）；`game.js` 维护筛选状态并渲染双层弹窗；HTML/CSS 增加芯片条与详情层。

**Tech Stack:** 原生 ES modules、现有 DOM UI、Node 断言测试

---

### Task 1: data helpers + tests

**Files:**
- Modify: `js/data.js`
- Modify: `tests/battle-catch.test.js`

- [ ] Extend `listDexEntries` with optional `{ type }`, add `listDexTypes`, `getDexDetail`
- [ ] Add tests for filter, types, detail fields, null id
- [ ] `npm test` passes

### Task 2: HTML/CSS

**Files:**
- Modify: `index.html`
- Modify: `css/game.css`

- [ ] Add `#dex-filters`, `#dex-detail-modal` markup
- [ ] Styles for chips, clickable rows, detail dialog (higher z-index)

### Task 3: game.js wiring

**Files:**
- Modify: `js/game.js`

- [ ] Import new helpers; `dexTypeFilter` state
- [ ] Render filters + filtered list; open/close detail
- [ ] Reset filter on `openDex`; close detail when closing dex

### Task 4: Verify

- [ ] `npm test`
- [ ] Commit feature
