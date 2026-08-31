/* import-kenney.js — turn a folder of downloaded Kenney packs into the Store catalogue.
 *
 * Run: node app/tools/import-kenney.js [path-to-kenney-folder] [--dry]
 *
 * Reads the packs, copies the sprites into public/assets/<pack>/, and writes public/assets-manifest.js.
 * It is idempotent: run it again after dropping a new pack in and the catalogue rebuilds. Nothing
 * here is hand-maintained except the PACKS table below, which is the honest cost of the fact that
 * every Kenney pack is laid out differently.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT GETS IMPORTED, AND THE THREE THINGS THAT DO NOT
 *
 * Everything, on purpose. This is a shop, not a curated gallery — a child who wants a fish in their
 * platformer is allowed to have a fish in their platformer, and deciding on their behalf that it
 * "doesn't fit" is not this tool's job. So no sprite is dropped for looking wrong.
 *
 * Three things are dropped, and none of them is a judgement about style:
 *
 *   1. @2x copies. Packs that ship Default/ and Double/ (or Retina/) ship the SAME artwork twice at
 *      two sizes. Listing both would double the catalogue with items a student cannot tell apart in
 *      a grid. The 1x set is imported. To change that, flip PREFER below.
 *   2. Opaque duplicates. The 1-bit packs ship Tiles/Default (tile drawn on a solid background
 *      square) and Tiles/Transparent (the same tile, cut out). Only the transparent one can be put
 *      on top of anything, so that is the one imported.
 *   3. Preview.png and Sample_*.png. These are screenshots of a demo level that Kenney puts in the
 *      download to show what the pack looks like. They are pictures OF assets, not assets.
 *
 * Composite tilesheets are skipped wherever the individual tiles also exist, because they are the
 * same art a second time and Phaser cannot use one as a plain image anyway. The one exception is
 * kenney_1-bit-pack, which ships NOTHING but sheets — there, the sheets are the pack.
 *
 * ---------------------------------------------------------------------------------------------
 * WHY SOME THINGS ARE SOLD AS BUNDLES
 *
 * Two different reasons, and it matters not to confuse them.
 *
 *   mode 'frames' — a character is not one picture. `character_green` is nine files: idle, walk_a,
 *      walk_b, jump, duck, climb_a, climb_b, front, hit. Selling those separately would let a child
 *      spend everything they have on a walk_a and own a character that cannot stand still. So the
 *      nine are one purchase, grouped by stripping the pose off the end of the filename.
 *
 *   mode 'set' — some packs number their tiles `tile_0000.png` and ship no names. There is no
 *      honest way to call tile_0173 anything, and a Store full of tile_0173 is a Store nobody can
 *      search, including the Build agent. These packs are sold as one themed set — which is how a
 *      tile pack is meant to be used anyway — and every tile inside is usable by key once owned.
 *
 *   mode 'individual' — packs whose filenames are already words. `grassHillLeft`, `coinGold`,
 *      `doorKnob`. These are listed one by one AND, where the pack has clear themes, offered as a
 *      themed set as well, so a child can buy the one tile they need or the whole snow set.
 *
 * ---------------------------------------------------------------------------------------------
 * LICENCE
 *
 * Every pack here is Kenney, CC0. The licence text ships with each download; CREDITS.txt in the
 * assets folder is regenerated from the packs actually imported so it can never drift from them.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : 'C:\\Users\\jsausa\\Downloads\\kenney';
const DRY = process.argv.indexOf('--dry') >= 0;

const PUBLIC = path.join(__dirname, '..', 'public');
const OUT_DIR = path.join(PUBLIC, 'assets');
const MANIFEST = path.join(PUBLIC, 'assets-manifest.js');

/* Which resolution to take when a pack ships more than one. */
const PREFER = ['Default', 'PNG/Default', 'Tiles/Transparent'];

/* ---------------------------------------------------------------------------------------------
   THE PACKS

   `groups` are read in order. `src` is relative to the pack folder. `cat` is the Store category, or
   'auto' to let the filename decide (used where one folder holds terrain, coins and signs at once).
   `mode` is 'individual' | 'frames' | 'set'. `set` needs a `setName`.
   `theme` on an individual group additionally offers that folder as a themed bundle.

   `atlas` on a `set` group imports that pack's packed tilemap as a SPRITESHEET alongside the loose
   tiles. A 400-tile set is 400 `load.image()` calls and 400 requests on every Run; the same art as
   one sheet is a single request, and `this.add.image(x, y, 'sheet', 42)` is how these packs are
   meant to be used. Kenney's `_packed` variants have no gutter, so frameWidth/frameHeight alone
   describe them, and their frame count matches the loose-tile count exactly — checked below, so a
   pack whose sheet does not line up fails the run rather than shipping a silently wrong grid.

   `ns` NAMESPACES a group, and it is not optional where two folders of one pack use the same
   filenames. Several packs number their tiles from zero in EVERY sub-folder, so Tiles/Colored and
   Tiles/Monochrome both contain tile_0000.png, and all ten terrain themes contain slice01_01.png.
   Without `ns` those overwrite each other on the way out and share one Store key — 320 tiles
   arriving as 160, silently. The collision check at the bottom fails the run if a new pack needs
   an `ns` and has not been given one, so this cannot go unnoticed again.
--------------------------------------------------------------------------------------------- */
const PACKS = [
  { slug: '1bit', name: '1-Bit', style: '1-bit', dir: 'kenney_1-bit-pack', groups: [
    /* This pack ships only sheets, so here they ARE the assets. */
    { src: 'Tilesheet', cat: 'Tiles', mode: 'individual' }
  ] },
  { slug: '1bit-platformer', name: '1-Bit Platformer', style: '1-bit', dir: 'kenney_1-bit-platformer-pack', groups: [
    { src: 'Tiles/Transparent', cat: 'Tiles', mode: 'set', setName: '1-Bit Platformer tiles',
      atlas: { src: 'Tilemap/monochrome_tilemap_transparent_packed.png', w: 16, h: 16 } }
  ] },
  { slug: 'backgrounds', name: 'Background Elements', style: 'smooth', dir: 'kenney_background-elements-remastered', groups: [
    { src: 'Backgrounds', cat: 'Backgrounds', mode: 'individual' },
    { src: 'Backgrounds/Elements', cat: 'Backgrounds', mode: 'individual' },
    { src: 'PNG/Default', cat: 'auto', mode: 'individual' }
  ] },
  { slug: 'fish', name: 'Fish Pack', style: 'smooth', dir: 'kenney_fish-pack_2', groups: [
    { src: 'PNG/Default', cat: 'auto', mode: 'individual' }
  ] },
  { slug: 'medals', name: 'Medals', style: 'smooth', dir: 'kenney_medals', groups: [
    { src: 'PNG', cat: 'UI', mode: 'individual' }
  ] },
  { slug: 'micro-roguelike', name: 'Micro Roguelike', style: 'pixel', dir: 'kenney_micro-roguelike', groups: [
    { src: 'Tiles/Colored', ns: 'colour', cat: 'Tiles', mode: 'set', setName: 'Micro Roguelike tiles (colour)',
      atlas: { src: 'Tilemap/colored_tilemap_packed.png', w: 8, h: 8 } },
    { src: 'Tiles/Monochrome', ns: 'mono', cat: 'Tiles', mode: 'set', setName: 'Micro Roguelike tiles (mono)',
      atlas: { src: 'Tilemap/monochrome_tilemap_packed.png', w: 8, h: 8 } }
  ] },
  { slug: 'platformer', name: 'New Platformer', style: 'smooth', dir: 'kenney_new-platformer-pack-1.1', groups: [
    { src: 'Sprites/Characters/Default', cat: 'Characters', mode: 'frames' },
    { src: 'Sprites/Enemies/Default', cat: 'Enemies', mode: 'frames' },
    { src: 'Sprites/Tiles/Default', cat: 'auto', mode: 'individual' },
    { src: 'Sprites/Backgrounds/Default', cat: 'Backgrounds', mode: 'individual' },
    { src: 'Sounds', cat: 'Sounds', mode: 'individual', ext: '.ogg' }
  ] },
  { slug: 'pixel-platformer', name: 'Pixel Platformer', style: 'pixel', dir: 'kenney_pixel-platformer', groups: [
    { src: 'Tiles', cat: 'Tiles', mode: 'set', setName: 'Pixel Platformer tiles',
      atlas: { src: 'Tilemap/tilemap_packed.png', w: 18, h: 18 } },
    { src: 'Tiles/Backgrounds', ns: 'bg', cat: 'Backgrounds', mode: 'set', setName: 'Pixel Platformer backgrounds',
      atlas: { src: 'Tilemap/tilemap-backgrounds_packed.png', w: 24, h: 24 } },
    { src: 'Tiles/Characters', ns: 'chr', cat: 'Characters', mode: 'set', setName: 'Pixel Platformer characters',
      atlas: { src: 'Tilemap/tilemap-characters_packed.png', w: 24, h: 24 } }
  ] },
  { slug: 'pixel-farm', name: 'Pixel Platformer — Farm', style: 'pixel', dir: 'kenney_pixel-platformer-farm-expansion', groups: [
    { src: 'Tiles', cat: 'Tiles', mode: 'set', setName: 'Farm tiles',
      atlas: { src: 'Tilemap/tilemap_packed.png', w: 18, h: 18 } }
  ] },
  { slug: 'pixel-food', name: 'Pixel Platformer — Food', style: 'pixel', dir: 'kenney_pixel-platformer-food-expansion', groups: [
    { src: 'Tiles', cat: 'Tiles', mode: 'set', setName: 'Food tiles',
      atlas: { src: 'Tilemap/tilemap_packed.png', w: 18, h: 18 } }
  ] },
  { slug: 'pixel-industrial', name: 'Pixel Platformer — Industrial', style: 'pixel', dir: 'kenney_pixel-platformer-industrial-expansion', groups: [
    { src: 'Tiles', cat: 'Tiles', mode: 'set', setName: 'Industrial tiles',
      atlas: { src: 'Tilemap/tilemap_packed.png', w: 18, h: 18 } }
  ] },
  { slug: 'buildings', name: 'Buildings', style: 'smooth', dir: 'kenney_platformer-art-buildings', groups: [
    { src: 'Tiles', cat: 'auto', mode: 'individual' }
  ] },
  { slug: 'candy', name: 'Candy', style: 'smooth', dir: 'kenney_platformer-art-candy', groups: [
    { src: 'Tiles', cat: 'auto', mode: 'individual' }
  ] },
  { slug: 'aliens', name: 'Aliens & Enemies', style: 'smooth', dir: 'kenney_platformer-art-extended-enemies', groups: [
    { src: 'Alien sprites', cat: 'Characters', mode: 'frames' },
    { src: 'Enemy sprites', cat: 'Enemies', mode: 'frames' }
  ] },
  /* Ten terrain themes, each a complete set. Listed individually AND offered as ten themed sets —
     this is the pack where "I just need one snow tile" and "give me the whole snow world" are both
     things a student will want. */
  { slug: 'terrain', name: 'Terrain Themes', style: 'smooth', dir: 'kenney_platformer-art-extended-tileset', groups: [
    { src: 'PNG Cake', ns: 'cake', cat: 'Tiles', mode: 'individual', theme: 'Cake' },
    { src: 'PNG Castle', ns: 'castle', cat: 'Tiles', mode: 'individual', theme: 'Castle' },
    { src: 'PNG Choco', ns: 'choco', cat: 'Tiles', mode: 'individual', theme: 'Chocolate' },
    { src: 'PNG Dirt', ns: 'dirt', cat: 'Tiles', mode: 'individual', theme: 'Dirt' },
    { src: 'PNG Grass', ns: 'grass', cat: 'Tiles', mode: 'individual', theme: 'Grass' },
    { src: 'PNG Metal', ns: 'metal', cat: 'Tiles', mode: 'individual', theme: 'Metal' },
    { src: 'PNG Purple', ns: 'purple', cat: 'Tiles', mode: 'individual', theme: 'Purple' },
    { src: 'PNG Sand', ns: 'sand', cat: 'Tiles', mode: 'individual', theme: 'Sand' },
    { src: 'PNG Snow', ns: 'snow', cat: 'Tiles', mode: 'individual', theme: 'Snow' },
    { src: 'PNG Tundra', ns: 'tundra', cat: 'Tiles', mode: 'individual', theme: 'Tundra' }
  ] },
  { slug: 'mushrooms', name: 'Mushrooms', style: 'smooth', dir: 'kenney_platformer-art-mushrooms', groups: [
    { src: 'PNG', cat: 'auto', mode: 'individual' },
    { src: 'Backgrounds', cat: 'Backgrounds', mode: 'individual' }
  ] },
  { slug: 'winter', name: 'Winter', style: 'smooth', dir: 'kenney_platformer-art-winter', groups: [
    { src: 'Tiles', cat: 'auto', mode: 'individual' }
  ] },
  { slug: 'tiny-dungeon', name: 'Tiny Dungeon', style: 'pixel', dir: 'kenney_tiny-dungeon', groups: [
    { src: 'Tiles', cat: 'Tiles', mode: 'set', setName: 'Tiny Dungeon tiles',
      atlas: { src: 'Tilemap/tilemap_packed.png', w: 16, h: 16 } }
  ] }
];

/* ---- naming ---------------------------------------------------------------------------------
   Kenney files are camelCase, snake_case or both. A student reads the name in a grid, so it has to
   be words: `grassHillLeft` -> "Grass hill left", `character_green_walk_a` -> "Character green walk a". */
function words(base) {
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}
function pretty(base) {
  const w = words(base);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/* ---- which category, when the folder does not say ----
   Order matters: the first hit wins, so the specific words come before the general ones. */
const CAT_WORDS = [
  ['Backgrounds', /^background|^sky|^hill|cloud|^mountain|^forest|^desert|^castles$/i],
  ['Collectibles', /coin|gem|diamond|key\b|star|heart|cherry|apple|gold|treasure|chest|crystal|potion|flag/i],
  ['UI', /medal|badge|button|icon|arrow|cursor|check|cross|bar\b|panel|slider|hud/i],
  ['Enemies', /slime|snail|worm|bee\b|fly\b|frog|spider|bat\b|snake|ghost|fish|piranha|barnacle|ladybug|mouse|saw|spike|enemy|shark|crab|jelly/i],
  ['Characters', /^character|^alien|^player|^person/i]
];
function autoCat(base, fallback) {
  for (let i = 0; i < CAT_WORDS.length; i++) if (CAT_WORDS[i][1].test(base)) return CAT_WORDS[i][0];
  return fallback || 'Tiles';
}

/* ---- grouping animation frames ----
   Trailing tokens that describe a POSE or a FRAME rather than a thing. `character_green_walk_a`
   and `character_green_idle` are the same character; `fish_blue` and `fish_purple` are not. */
const POSE = new Set(('a b c d e f g h i j rest idle walk run jump fall climb duck front back side hit hurt '
  + 'attack bite swim down up dead death fly hang move stand still shoot sit crouch slide land charge talk '
  + 'wave cheer badge watch open closed active blink flat squashed spin ani leap normal').split(' '));
function frameGroup(base) {
  const parts = base.split('_');
  while (parts.length > 1) {
    const last = parts[parts.length - 1].replace(/\d+$/, '').toLowerCase();
    if (!POSE.has(last)) break;
    parts.pop();
  }
  return parts.join('_') || base;
}

/* ---- prices ----
   Deliberately reachable. A student earns Stars steadily, and a catalogue priced so that nothing is
   affordable until week six is a catalogue nobody opens twice. Bundles cost more than one sprite and
   far less than their contents, because that is the whole point of a bundle. */
function priceOne(type) { return type === 'audio' ? 30 : 40; }
function priceBundle(n) { return n <= 4 ? 60 : n <= 12 ? 90 : n <= 60 ? 150 : n <= 200 ? 220 : 300; }

/* The sprites a student starts with. EVERYTHING THE STARTER GAME TOUCHES MUST BE IN HERE, or a new
   student's first game opens with missing textures.

   These three are the 1-bit platformer's character, a solid block and a ring, and they are free
   even though they live inside a 400-tile bundle nobody has bought yet — assetOwned() checks the
   free flag before it checks the bundle, so a free member is usable on its own. The Store shows
   them as individual cards marked "Included" so the student can see the names they already have.

   The jump and coin sounds are not here because the Classic pack's `sfx-jump` and `sfx-coin` are
   already free, and they are carried forward from legacy-assets.json. */
const FREE = new Set([
  '1bit-platformer_tile_0340',   // the little character the starter game plays as
  '1bit-platformer_tile_0375',   // a solid block — the ground and the platforms
  '1bit-platformer_tile_0002'    // a ring — the thing you collect
]);

const HINT = {
  audio: function (k) { return "this.sound.play('" + k + "')"; },
  Backgrounds: function (k) { return "this.add.image(400, 300, '" + k + "').setDisplaySize(800, 600)"; },
  Characters: function (k) { return "this.add.sprite(400, 300, '" + k + "')"; },
  Enemies: function (k) { return "this.add.sprite(400, 300, '" + k + "')"; }
};
function hintFor(cat, type, key) {
  const f = type === 'audio' ? HINT.audio : (HINT[cat] || function (k) { return "this.add.image(x, y, '" + k + "')"; });
  return f(key);
}
const DESC = {
  Characters: 'A character sprite - use it as your player or an NPC.',
  Enemies: 'Something that moves and gets in the way.',
  Collectibles: 'A pickup - collect it for points, health, or power-ups.',
  Tiles: 'A building block - use it for ground, walls, and platforms.',
  Backgrounds: 'A full background image for behind your game.',
  UI: 'Part of a heads-up display - scores, buttons, and menus.',
  Sounds: 'A sound effect - play it when something happens in your game.'
};

/* ---- the assets that were already here ------------------------------------------------------
   The Store shipped with 265 sprites and sounds from Kenney packs that are NOT in the download
   folder — Platformer Art Deluxe, the UI pack, Digital Audio. They are carried forward verbatim
   from tools/legacy-assets.json, as a pack called "Classic", for two reasons:

     1. Dropping them would REMOVE assets from the shop, which is the opposite of the point.
     2. Every existing student project, the starter game and a good deal of lesson text refer to
        those keys by name — `player`, `grass`, `sky`, `coin-gold`, `sfx-jump`. Regenerating the
        catalogue without them would quietly break every game already saved in a browser.

   The snapshot is a file rather than a read of the current manifest, because the importer
   overwrites that manifest: reading it would work once and then lose them forever on the next run. */
const LEGACY = path.join(__dirname, 'legacy-assets.json');

/* Six pictures to show on a bundle card. SPREAD across the set, not the first six: a tile sheet
   almost always opens with blank or near-blank tiles, so `slice(0, 6)` produced cards that looked
   empty and sold nothing. Taking them at even intervals gives a fair impression of what is inside. */
function spread(list, n) {
  if (list.length <= n) return list.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor((i + 0.5) * list.length / n)]);
  return out;
}

/* --------------------------------------------------------------------------------------------- */
const assets = [], bundles = [], packsOut = [];
const seenKeys = new Set();

if (fs.existsSync(LEGACY)) {
  const old = JSON.parse(fs.readFileSync(LEGACY, 'utf8'));
  old.forEach(function (a) { seenKeys.add(a.key); assets.push(a); });
  packsOut.push({ id: 'classic', name: 'Classic', style: 'smooth', count: old.length });
  console.log('  ' + 'classic'.padEnd(18) + String(old.length).padStart(5) + ' sprites (carried forward)');
} else {
  console.error('WARNING  tools/legacy-assets.json is missing — the original 265 Store assets will be');
  console.error('         dropped, which breaks every saved project that used them.');
}
const copies = [];        // [from, to] — done in one pass at the end so --dry can skip it
let skipped = { preview: 0, atRes: 0, opaque: 0 };

function listPng(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(function (e) { return e.isFile() && e.name.toLowerCase().endsWith(ext || '.png'); })
    .map(function (e) { return e.name; })
    .filter(function (n) {
      /* Screenshots of a demo level, not assets. */
      if (/^(preview|sample)/i.test(n)) { skipped.preview++; return false; }
      return true;
    })
    .sort();
}

/* Two source files must never land on one key or one output path. When they do it is silent: the
   second copyFileSync overwrites the first, the second asset is dropped as a duplicate key, and the
   pack simply arrives smaller than it is. That is exactly what happened to micro-roguelike (320
   tiles imported as 160) and to the ten terrain themes (363 as 84). So it is a hard failure now,
   with the fix named in the message, rather than a number nobody thinks to check. */
const collisions = [];
const hardFails = [];
function fail(msg) { hardFails.push(msg); }
/* Width and height straight out of the PNG header — IHDR is always the first chunk, so the two
   32-bit big-endian numbers live at a fixed offset. Enough to check an atlas divides cleanly
   without pulling in an image library. */
function pngSize(p) {
  const b = fs.readFileSync(p).subarray(0, 24);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function addAsset(o) {
  if (seenKeys.has(o.key)) { collisions.push(o.key); return null; }
  seenKeys.add(o.key);
  assets.push(o);
  return o;
}

PACKS.forEach(function (pack) {
  const packDir = path.join(SRC, pack.dir);
  if (!fs.existsSync(packDir)) { console.error('MISSING  ' + pack.dir + ' — skipping this pack.'); return; }
  let packCount = 0;
  const themeBuckets = {};

  pack.groups.forEach(function (g) {
    const srcDir = path.join(packDir, g.src.replace(/\//g, path.sep));
    const files = listPng(srcDir, g.ext);
    if (!files.length) { console.error('EMPTY    ' + pack.dir + '/' + g.src); return; }
    const type = (g.ext === '.ogg') ? 'audio' : 'image';

    /* Files land in public/assets/<pack>/[<ns>/], which keeps `tile_0000.png` from six different
       packs — and from two folders of the SAME pack — off each other's toes. */
    const rel = 'assets/' + pack.slug + '/' + (g.ns ? g.ns + '/' : '');
    const outDir = path.join(OUT_DIR, pack.slug, g.ns || '');

    const made = files.map(function (fn) {
      const base = fn.replace(/\.(png|ogg)$/i, '');
      const key = pack.slug + '_' + (g.ns ? g.ns + '_' : '') + base;
      copies.push([path.join(srcDir, fn), path.join(outDir, fn)]);
      return { fn: fn, base: base, key: key, file: rel + fn, type: type };
    });

    if (g.mode === 'set') {
      /* One purchase, every tile in it. Named by the pack, because the tiles are not named at all. */
      const bid = 'set_' + pack.slug + '_' + g.src.replace(/[^\w]+/g, '-').toLowerCase();
      made.forEach(function (m) {
        const free = FREE.has(m.key);
        /* The pack name is used verbatim — running it through pretty() turned "1-Bit Platformer"
           into "1 Bit Platformer", so a student searching the Store for "1-bit" found nothing. */
        addAsset({ id: m.key, key: m.key, name: pack.name + ' ' + pretty(m.base), cat: g.cat,
          pack: pack.slug, style: pack.style, cost: 0, bundle: bid, free: free || undefined,
          hint: hintFor(g.cat, m.type, m.key), desc: DESC[g.cat], type: m.type, file: m.file });
        packCount++;
      });
      /* The same art as one spritesheet. This is what a student who owns the set should actually
         reach for: one request instead of four hundred, and it is how the pack was drawn. */
      let sheetKey = '';
      if (g.atlas) {
        const aSrc = path.join(packDir, g.atlas.src.replace(/\//g, path.sep));
        if (!fs.existsSync(aSrc)) {
          fail(pack.slug + ': atlas ' + g.atlas.src + ' does not exist.');
        } else {
          const dim = pngSize(aSrc);
          const cols = dim.w / g.atlas.w, rows = dim.h / g.atlas.h;
          /* If the sheet does not divide cleanly, or holds a different number of frames than there
             are loose tiles, then frame N is not tile N and every student using it would be off by
             an unknown amount. That is worth stopping the whole import for. */
          if (!Number.isInteger(cols) || !Number.isInteger(rows)) {
            fail(pack.slug + ': atlas ' + g.atlas.src + ' is ' + dim.w + 'x' + dim.h
              + ', which does not divide by ' + g.atlas.w + 'x' + g.atlas.h + '. Wrong file, or it has a gutter.');
          } else if (cols * rows !== made.length) {
            fail(pack.slug + ': atlas ' + g.atlas.src + ' holds ' + (cols * rows)
              + ' frames but the folder has ' + made.length + ' tiles — frame N would not be tile N.');
          } else {
            const aFn = path.basename(g.atlas.src);
            sheetKey = pack.slug + (g.ns ? '_' + g.ns : '') + '_sheet';
            copies.push([aSrc, path.join(outDir, aFn)]);
            addAsset({ id: sheetKey, key: sheetKey, name: g.setName + ' (one sheet)', cat: g.cat,
              pack: pack.slug, style: pack.style, cost: 0, bundle: bid,
              type: 'spritesheet', frameWidth: g.atlas.w, frameHeight: g.atlas.h, frames: cols * rows,
              file: rel + aFn,
              hint: "this.add.image(x, y, '" + sheetKey + "', 0)",
              desc: 'All ' + made.length + ' pictures on one sheet. The last number picks which one — '
                + '0 is the top-left, then it counts along each row. Loads far faster than adding them '
                + 'one at a time.' });
            packCount++;
          }
        }
      }
      bundles.push({ id: bid, name: g.setName, cat: g.cat, pack: pack.slug, style: pack.style,
        cost: priceBundle(made.length), count: made.length, sheet: sheetKey || undefined,
        desc: 'Every tile in this set — ' + made.length + ' of them. They are numbered, not named, so '
          + 'the way to use them is to look at the sheet and pick the one you want.',
        members: made.map(function (m) { return m.key; }),
        preview: spread(made, 6).map(function (m) { return m.file; }) });

    } else if (g.mode === 'frames') {
      /* Group by what is left after the pose is stripped off the end. */
      const byGroup = {};
      made.forEach(function (m) { (byGroup[frameGroup(m.base)] = byGroup[frameGroup(m.base)] || []).push(m); });
      Object.keys(byGroup).sort().forEach(function (gname) {
        const mem = byGroup[gname];
        /* A bundle of one is not a bundle — it is a single sprite wearing a costume, and it shows
           up in the Store as a card that says "1 picture of the same character". These appear
           whenever a pack uses a pose word POSE has never heard of, which will keep happening as
           packs are added, so the shape of the fix is "handle it" rather than "guess every word".
           Sold individually instead. */
        if (mem.length < 2) {
          const m = mem[0];
          addAsset({ id: m.key, key: m.key, name: pretty(m.base), cat: g.cat, pack: pack.slug,
            style: pack.style, cost: priceOne(m.type),
            hint: hintFor(g.cat, m.type, m.key), desc: DESC[g.cat], type: m.type, file: m.file });
          packCount++;
          return;
        }
        const bid = 'chr_' + pack.slug + '_' + gname;
        mem.forEach(function (m) {
          addAsset({ id: m.key, key: m.key, name: pretty(m.base), cat: g.cat, pack: pack.slug,
            style: pack.style, cost: 0, bundle: bid,
            hint: hintFor(g.cat, m.type, m.key), desc: DESC[g.cat], type: m.type, file: m.file });
          packCount++;
        });
        bundles.push({ id: bid, name: pretty(gname), cat: g.cat, pack: pack.slug, style: pack.style,
          cost: priceBundle(mem.length), count: mem.length,
          desc: mem.length + ' pictures of the same ' + (g.cat === 'Enemies' ? 'enemy' : 'character')
            + ' — ' + mem.map(function (m) { return words(m.base).split(' ').slice(-1)[0]; }).join(', ')
            + '. You need all of them to animate it, so they come together.',
          members: mem.map(function (m) { return m.key; }),
          preview: spread(mem, 6).map(function (m) { return m.file; }) });
      });

    } else {
      made.forEach(function (m) {
        const cat = g.cat === 'auto' ? autoCat(m.base, 'Tiles') : g.cat;
        const free = FREE.has(m.key);
        addAsset({ id: m.key, key: m.key, name: pretty(m.base), cat: cat, pack: pack.slug,
          style: pack.style, cost: free ? 0 : priceOne(m.type), free: free || undefined,
          hint: hintFor(cat, m.type, m.key), desc: DESC[cat], type: m.type, file: m.file });
        packCount++;
        if (g.theme) (themeBuckets[g.theme] = themeBuckets[g.theme] || []).push(m);
      });
    }
  });

  /* Themed sets sit alongside the individual tiles rather than replacing them: buy one snow tile,
     or buy snow. */
  Object.keys(themeBuckets).sort().forEach(function (theme) {
    const mem = themeBuckets[theme];
    bundles.push({ id: 'theme_' + pack.slug + '_' + theme.toLowerCase(), name: theme + ' terrain',
      cat: 'Tiles', pack: pack.slug, style: pack.style, cost: priceBundle(mem.length), count: mem.length,
      desc: 'The whole ' + theme.toLowerCase() + ' set — ' + mem.length + ' tiles that line up with '
        + 'each other, so you can build a world out of them without the edges looking wrong.',
      members: mem.map(function (m) { return m.key; }),
      preview: spread(mem, 6).map(function (m) { return m.file; }) });
  });

  packsOut.push({ id: pack.slug, name: pack.name, style: pack.style, count: packCount });
  console.log('  ' + pack.slug.padEnd(18) + String(packCount).padStart(5) + ' sprites');
});

/* ---- nothing is written until the collision checks pass ------------------------------------- */
const byDest = {};
copies.forEach(function (c) { (byDest[c[1]] = byDest[c[1]] || []).push(c[0]); });
const clashing = Object.keys(byDest).filter(function (d) { return byDest[d].length > 1; });
if (hardFails.length) {
  console.error('');
  console.error('FAILED: ' + hardFails.length + ' problem(s). Nothing was written.');
  hardFails.forEach(function (m) { console.error('  ' + m); });
  process.exit(1);
}
if (clashing.length || collisions.length) {
  console.error('');
  console.error('FAILED: ' + (clashing.length + collisions.length) + ' collision(s). Nothing was written.');
  clashing.slice(0, 8).forEach(function (d) {
    console.error('  two source files want ' + path.relative(PUBLIC, d) + ':');
    byDest[d].forEach(function (s) { console.error('      ' + path.relative(SRC, s)); });
  });
  [...new Set(collisions)].slice(0, 8).forEach(function (k) {
    console.error('  two assets want the Store key "' + k + '"');
  });
  console.error('');
  console.error('  Give one of the groups an `ns` in the PACKS table. That namespaces both the');
  console.error('  output folder and the Store key, which is what keeps two folders of tile_0000.png apart.');
  process.exit(1);
}

/* ---- write ---------------------------------------------------------------------------------- */
if (!DRY) {
  /* Clear each pack's folder first, so a rename or a dropped group cannot leave an orphan PNG
     behind that the manifest no longer mentions. Only the pack folders — the flat files at the top
     of assets/ are the Classic pack and are not this tool's to delete. */
  packsOut.forEach(function (p) {
    if (p.id === 'classic') return;
    const dir = path.join(OUT_DIR, p.id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });
  copies.forEach(function (c) {
    fs.mkdirSync(path.dirname(c[1]), { recursive: true });
    fs.copyFileSync(c[0], c[1]);
  });
  const head = '/* Auto-generated by app/tools/import-kenney.js — do not edit by hand.\n'
    + '   Kenney CC0 asset packs. Sprites live under public/assets/<pack>/ and are referenced by\n'
    + '   path, never inlined. Re-run the importer to rebuild this file. */\n';
  fs.writeFileSync(MANIFEST,
    head
    + 'window.STORE_PACKS = ' + JSON.stringify(packsOut) + ';\n'
    + 'window.STORE_BUNDLES = ' + JSON.stringify(bundles) + ';\n'
    + 'window.STORE_ASSETS = ' + JSON.stringify(assets) + ';\n');

  const credits = 'Art and audio: Kenney (kenney.nl), released under CC0 1.0 Universal.\n'
    + 'No attribution is required; it is here because saying where things came from is the right\n'
    + 'thing to do, and because students should see it done.\n\nPacks used:\n'
    + PACKS.map(function (p) { return '  - ' + p.name + '  (' + p.dir + ')'; }).join('\n') + '\n';
  fs.writeFileSync(path.join(OUT_DIR, 'CREDITS.txt'), credits);
}

const indiv = assets.filter(function (a) { return !a.bundle; }).length;
const inBundle = assets.length - indiv;
console.log('');
console.log(assets.length + ' sprites from ' + packsOut.length + ' packs');
console.log('  ' + indiv + ' sold individually, ' + inBundle + ' inside ' + bundles.length + ' bundles');
/* --bundles prints what got grouped with what. Worth looking at after touching POSE or frameGroup:
   a bad strip silently welds two different characters into one bundle, and the only symptom is a
   Store card with fourteen frames of what should have been two things. */
if (process.argv.indexOf('--bundles') >= 0) {
  bundles.forEach(function (b) {
    console.log('    ' + b.id.padEnd(34) + String(b.count).padStart(4) + '  ' + b.name);
  });
}
const byCat = {};
assets.forEach(function (a) { byCat[a.cat] = (byCat[a.cat] || 0) + 1; });
console.log('  ' + Object.keys(byCat).sort().map(function (c) { return c + ' ' + byCat[c]; }).join(', '));
if (DRY) console.log('\n--dry: nothing was copied and no manifest was written.');
