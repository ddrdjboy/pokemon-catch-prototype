import assert from 'node:assert/strict';
import {
  resolveItemsUiMode,
  itemsModalTitle,
  shouldDisableItemRow,
  canEnableUseItemButton,
  shouldCloseItemsModalOnBusy,
} from '../js/items-ui-mode.js';

console.log('items-ui-mode');

assert.equal(resolveItemsUiMode({ source: 'top', inBattle: true }), 'browse');
assert.equal(resolveItemsUiMode({ source: 'top', inBattle: false }), 'use');
assert.equal(resolveItemsUiMode({ source: 'use-btn', inBattle: true }), 'use');
assert.equal(resolveItemsUiMode({ source: 'use-btn', inBattle: false }), 'use');

assert.equal(itemsModalTitle('browse'), '道具（浏览）');
assert.equal(itemsModalTitle('use'), '道具');

assert.equal(shouldDisableItemRow({ mode: 'browse', usable: true }), true);
assert.equal(shouldDisableItemRow({ mode: 'browse', usable: false }), true);
assert.equal(shouldDisableItemRow({ mode: 'use', usable: true }), false);
assert.equal(shouldDisableItemRow({ mode: 'use', usable: false }), true);

assert.equal(
  canEnableUseItemButton({ busy: false, continueWait: false, anyUsable: true }),
  true,
);
assert.equal(
  canEnableUseItemButton({ busy: true, continueWait: false, anyUsable: true }),
  false,
);
assert.equal(
  canEnableUseItemButton({ busy: false, continueWait: true, anyUsable: true }),
  false,
);
assert.equal(
  canEnableUseItemButton({ busy: false, continueWait: false, anyUsable: false }),
  false,
);

assert.equal(shouldCloseItemsModalOnBusy('use'), true);
assert.equal(shouldCloseItemsModalOnBusy('browse'), false);

console.log('items-ui-mode ok');
