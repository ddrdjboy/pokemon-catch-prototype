# Twin Towers 2v2 Implementation Plan

> Implemented in-session after design approval.

**Goal:** Add 双子塔 map with four Lv.200 dual-boss fights and true 2v2 combat.

**Architecture:** Content in `data.js` (`dual` encounters + twin key gate); combat in `resolveDualTurn`; UI pick-two / dual slots / catch-one in `game.js`.

**Tech Stack:** Vanilla JS modules, existing battle/catch loop, node test runner.

## Tasks

- [x] Design spec
- [x] Species + map + twin key data
- [x] `resolveDualTurn` + tests
- [x] Game flow / dual UI / shop key
- [x] Assets (8 sprites + map art)
- [x] `npm test` green
