/** @typedef {'browse' | 'use'} ItemsUiMode */
/** @typedef {'top' | 'use-btn'} ItemsUiSource */

/**
 * @param {{ source: ItemsUiSource, inBattle: boolean }} opts
 * @returns {ItemsUiMode}
 */
export function resolveItemsUiMode({ source, inBattle }) {
  if (source === 'top' && inBattle) return 'browse';
  return 'use';
}

/** @param {ItemsUiMode} mode */
export function itemsModalTitle(mode) {
  return mode === 'browse' ? '道具（浏览）' : '道具';
}

/**
 * @param {{ mode: ItemsUiMode, usable: boolean }} opts
 */
export function shouldDisableItemRow({ mode, usable }) {
  if (mode === 'browse') return true;
  return !usable;
}

/**
 * @param {{ busy: boolean, continueWait: boolean, anyUsable: boolean }} opts
 */
export function canEnableUseItemButton({ busy, continueWait, anyUsable }) {
  return !busy && !continueWait && !!anyUsable;
}

/** @param {ItemsUiMode | null | undefined} mode */
export function shouldCloseItemsModalOnBusy(mode) {
  return mode === 'use';
}
