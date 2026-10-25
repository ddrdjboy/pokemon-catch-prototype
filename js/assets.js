/**
 * Unified static asset URLs (cache-bust + pokemon thumb mapping).
 */

export const ASSET_VER = 'nether16';

/** @param {string} path */
export function assetUrl(path) {
  if (!path) return path;
  return `${path}?v=${ASSET_VER}`;
}

/**
 * Map a full pokemon sprite path to its 64×64 thumb.
 * Non-pokemon paths and already-thumb paths are returned unchanged.
 * @param {string} fullPath
 */
export function pokemonThumbPath(fullPath) {
  if (!fullPath || typeof fullPath !== 'string') return fullPath;
  if (fullPath.startsWith('assets/pokemon/thumbs/')) return fullPath;
  if (!fullPath.startsWith('assets/pokemon/')) return fullPath;
  const name = fullPath.slice('assets/pokemon/'.length);
  if (!name || name.includes('/')) return fullPath;
  return `assets/pokemon/thumbs/${name}`;
}

/**
 * @param {string} fullPath
 * @param {'thumb' | 'full'} [size='full']
 */
export function pokemonUrl(fullPath, size = 'full') {
  const path = size === 'thumb' ? pokemonThumbPath(fullPath) : fullPath;
  return assetUrl(path);
}

/**
 * Fire-and-forget browser image warm. Safe no-op outside browsers.
 * @param {string[]} urls absolute or relative URLs (already versioned OK)
 * @returns {Promise<void>}
 */
export function preloadImages(urls) {
  if (typeof Image === 'undefined') return Promise.resolve();
  const list = [...new Set((urls || []).filter(Boolean))];
  return Promise.all(
    list.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  ).then(() => {});
}
