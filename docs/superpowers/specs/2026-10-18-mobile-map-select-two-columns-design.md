# Mobile Web 选图：一行两张地图

日期：2026-10-18  
状态：已确认，待实现计划

## 问题

选图屏（`#screen-select` / `.map-cards`）在 mobile web（`max-width: 720px`）下被强制为单列：

```css
.map-cards {
  grid-template-columns: 1fr;
}
```

一行只能显示一张地图卡片，浏览效率低，不符合产品要求。

## 目标

1. Mobile web（宽度 ≤720px）选图网格**固定一行两张**。
2. 卡片图片高度、meta 字号与现有移动端样式保持不变（方案 A）。
3. 桌面端（>720px）布局不变：继续 `repeat(auto-fill, minmax(220px, 1fr))`。

## 非目标

- 不调整 `.map-card img` 高度或 `.meta` 排版。
- 不新增 JS 环境检测或 `mobileweb` 专用 class。
- 不改地图进入逻辑、锁定态或卡片内容。

## 方案

在 `css/game.css` 的 `@media (max-width: 720px)` 中，将：

```css
.map-cards {
  grid-template-columns: 1fr;
}
```

改为：

```css
.map-cards {
  grid-template-columns: repeat(2, 1fr);
}
```

`gap` 沿用现有值（12px，移动断点未覆盖时继承基础规则）。

## 验证

- 视口宽度 ≤720px：选图区每行恰好 2 张卡片。
- 视口宽度 >720px：列数行为与改前一致。
- 锁定/裂隙/双子/灵堂等卡片样式与点击进入逻辑不受影响。
