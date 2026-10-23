import {
  ASSET_VER,
  assetUrl,
  pokemonThumbPath,
  pokemonUrl,
} from '../js/assets.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(typeof ASSET_VER === 'string' && ASSET_VER.length > 0, 'ASSET_VER is a non-empty string');

assert(
  assetUrl('assets/pokemon/pikachu.png') === `assets/pokemon/pikachu.png?v=${ASSET_VER}`,
  'assetUrl appends ?v=ASSET_VER',
);
assert(
  assetUrl('assets/maps/cave.png') === `assets/maps/cave.png?v=${ASSET_VER}`,
  'assetUrl works for maps',
);
assert(
  assetUrl('assets/fx/fighters/pikachu/frame_0.png') === `assets/fx/fighters/pikachu/frame_0.png?v=${ASSET_VER}`,
  'assetUrl works for fighter frames',
);

assert(
  pokemonThumbPath('assets/pokemon/pikachu.png') === 'assets/pokemon/thumbs/pikachu.png',
  'pokemonThumbPath maps full sprite to thumbs/',
);
assert(
  pokemonThumbPath('assets/pokemon/mega_rayquaza.png') === 'assets/pokemon/thumbs/mega_rayquaza.png',
  'pokemonThumbPath keeps filename',
);
assert(
  pokemonThumbPath('assets/balls/poke.png') === 'assets/balls/poke.png',
  'pokemonThumbPath leaves non-pokemon paths unchanged',
);
assert(
  pokemonThumbPath('assets/pokemon/thumbs/pikachu.png') === 'assets/pokemon/thumbs/pikachu.png',
  'pokemonThumbPath is idempotent for already-thumb paths',
);

assert(
  pokemonUrl('assets/pokemon/pikachu.png', 'full') === `assets/pokemon/pikachu.png?v=${ASSET_VER}`,
  'pokemonUrl full uses original path',
);
assert(
  pokemonUrl('assets/pokemon/pikachu.png', 'thumb') === `assets/pokemon/thumbs/pikachu.png?v=${ASSET_VER}`,
  'pokemonUrl thumb uses thumbs path',
);
assert(
  pokemonUrl('assets/balls/poke.png', 'thumb') === `assets/balls/poke.png?v=${ASSET_VER}`,
  'pokemonUrl thumb falls back to full path for non-pokemon',
);
assert(
  pokemonUrl('assets/pokemon/pikachu.png') === `assets/pokemon/pikachu.png?v=${ASSET_VER}`,
  'pokemonUrl defaults to full',
);

console.log('assets.test.js: OK');
