# 战斗「使用道具」按钮与顶栏浏览模式

Date: 2026-10-31  
Status: approved for implementation

## Goal

普通战斗下方行动栏在逃跑前提供 **「使用道具」**；战斗中顶栏「道具」只能浏览持有列表，不能使用。场外顶栏道具流程保持不变。

## Decisions (from brainstorming)

- Approach: 复用统一 `#items-modal`，用 `itemsUiMode: 'browse' | 'use'` 分流。
- 战斗中真正使用道具只能走下方 `#btn-use-item`（及编队战「使用道具」）。
- 顶栏 `#btn-items` 战斗中打开 browse：列表可见，行全部禁用。
- 文案：底栏 / 编队为「使用道具」；顶栏仍为「道具」。
- 基于 **main 系战斗 UI**（`#battle-actions` + `#items-modal`）实现；不在旧「攻击|道具|逃跑」三键布局上打补丁。

## Entry points

| 入口 | 位置 | 文案 | 战斗中 | 场外 |
|------|------|------|--------|------|
| `#btn-items` | 顶栏（商店旁） | 道具 | 打开弹窗 **browse** | 打开弹窗 **use**（选道具→选宠） |
| `#btn-use-item` | `#battle-actions`，在 `#btn-flee-battle` 之前 | 使用道具 | 打开弹窗 **use** | 隐藏 / 不存在于非战斗屏 |
| 编队战 `data-cmd="item"` | 编队指令栏 | 使用道具 | 与底栏 use 同规则 | — |

## Modal modes

`openItemsUi({ mode })` 设置 `itemsUiMode`；关闭弹窗后清空。

| 模式 | 谁打开 | 标题 | 列表行为 |
|------|--------|------|----------|
| `browse` | 顶栏且战斗中 | `道具（浏览）` | 只列持有量 `>0`；**全部 disabled**，点击无效；无目标选择步 |
| `use` | `#btn-use-item` / 编队「使用道具」；或场外顶栏 | `道具` | 场外：可用行 → 选宠；战斗：`ownedItemUsableInBattle` 可点 → `onUseItem`（自动目标、耗一回合） |

「战斗中」= `#screen-battle` 或 `#screen-formation-battle` 可见（含双子 / 编队战）。顶栏在这两种屏上都走 browse。

Busy / 「继续」等待中：顶栏仍可开 browse；use 入口禁用且不打开 use 弹窗。`setBattleActionBusy(true)`（或等价忙碌）时：若当前弹窗为 **use** 则关闭；若为 **browse** 则保持打开。

## Button enable rules

| 按钮 | 规则 |
|------|------|
| `#btn-items` | **始终可点**（含战斗忙碌，用于 browse）。不再因「当前不能用道具」禁用。 |
| `#btn-use-item` | 位于 `#screen-battle` 的 `#battle-actions` 内（非战斗屏随整屏隐藏）。`!battleBusy && !continueResolver` 且至少一个 `ownedItemUsableInBattle` 时启用；否则禁用但仍可见。忙碌时禁用并关闭 use 弹窗。 |
| 编队 `data-cmd="item"` | 文案「使用道具」；启用规则对齐可行动 + 有可用道具（编队忙碌时禁用）。 |

双人对战：使用道具仍清除本回合已下玩家指令，走现有 dual item turn 语义。

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `index.html` | `#btn-use-item`；编队按钮文案 |
| `css/game.css` | 必要时微调 browse 禁用行 / 行动栏按钮（优先复用现有样式） |
| `js/game.js` | `itemsUiMode`、`openItemsUi`、`renderItemsModalList` 分支、`updateUseItemButton`、busy/chrome 接线 |
| tests | browse 不可用；use 可走 `onUseItem`；场外顶栏仍 use |

道具效果、`autoTargetForItem`、`applyItem`、回合结算函数不改语义。

## Out of scope

- 道具种类 / 效果 / 自动选目标公式
- 恢复旧 `#item-panel` 或队伍区 `#btn-party-items`
- 道具详情页、战斗中手动选目标
- 无关战斗表现（伤害数字等）

## Testing

- 战斗中顶栏打开 → `itemsUiMode === 'browse'`，行 disabled，调用使用不会触发 `onUseItem`。
- `#btn-use-item` 在有可用道具且可行动时 enabled；点击后可 `onUseItem`。
- 无可用目标或 busy 时 `#btn-use-item` disabled；顶栏仍可 browse。
- 场外顶栏：选道具 → 选宠 → `applyItem`，不耗回合。
- 现有道具 / 战斗相关测试仍通过。

## Success criteria

1. 普通战斗下方行动栏，逃跑前可见「使用道具」。
2. 战斗中顶栏「道具」只能看持有列表，不能使用。
3. 战斗中「使用道具」可选可用道具并耗一回合。
4. 无可用目标 / 忙碌时「使用道具」禁用；顶栏仍可浏览。
5. 场外顶栏道具流程不变。
6. 编队战指令文案为「使用道具」，规则一致。
7. `npm test` 通过。

## Implementation prerequisite

当前工作区若仍停留在旧战斗布局分支，实施前先同步到含 `#items-modal` 与 `#battle-actions` 的 main 系代码，再按本 spec 改。
