/* check-assets.js — does the Store catalogue actually match what is on disk, and can a new student
 * still play the game they are given?
 *
 * The catalogue is generated (app/tools/import-kenney.js) from 3,246 files across nineteen packs,
 * and every way it can be wrong is quiet:
 *
 *   - a manifest entry whose PNG is not there renders as a broken card and, worse, fails to preload
 *     into the game with no error a child could act on
 *   - a file on disk that no entry mentions is dead weight in the repo
 *   - a bundle that lists a key which is not an asset sells a student something that does not exist
 *   - an asset whose `bundle` names no bundle can never be bought by anyone, at any price
 *   - and the one that matters most: if a key the STARTER GAME uses stops being free, every new
 *     student's first experience of the app is a game with missing textures
 *
 * That last check is the reason this file exists. The starter was moved onto the 1-bit pack, and
 * the three tiles it uses are free members of a 400-tile bundle nobody has bought — an arrangement
 * that works but is easy to break by accident from either side.
 *
 * Run: node app/tools/check-assets.js
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const ASSETS = path.join(PUBLIC, 'assets');

let fails = 0;
function fail(msg) { console.error('FAIL  ' + msg); fails++; }

/* The manifest is browser JS that assigns onto `window`, so it is loaded the way the browser would
   rather than parsed — that way this checks the real thing the app receives. */
global.window = {};
require(path.join(PUBLIC, 'assets-manifest.js'));
const assets = global.window.STORE_ASSETS || [];
const bundles = global.window.STORE_BUNDLES || [];
const packs = global.window.STORE_PACKS || [];

if (!assets.length) { fail('the manifest has no assets at all — run tools/import-kenney.js.'); process.exit(1); }

const byKey = {}; assets.forEach(function (a) { byKey[a.key] = a; });
const byBundle = {}; bundles.forEach(function (b) { byBundle[b.id] = b; });

/* ---- 1. every entry points at a file that exists ---- */
const referenced = new Set();
let missing = 0;
assets.forEach(function (a) {
  if (!a.file) { fail('asset "' + a.key + '" has no file path.'); return; }
  const p = path.join(PUBLIC, a.file);
  referenced.add(path.resolve(p));
  if (!fs.existsSync(p)) {
    if (missing < 8) fail('asset "' + a.key + '" points at ' + a.file + ', which is not on disk.');
    missing++;
  }
});
if (missing > 8) fail('...and ' + (missing - 8) + ' more assets whose file is missing.');

/* ---- 2. nothing on disk is unaccounted for ---- */
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(png|ogg|mp3|jpg)$/i.test(e.name)) out.push(path.resolve(p));
  });
  return out;
}
const orphans = walk(ASSETS, []).filter(function (p) { return !referenced.has(p); });
if (orphans.length) {
  fail(orphans.length + ' file(s) under public/assets are in no manifest entry — dead weight in the repo.');
  orphans.slice(0, 6).forEach(function (p) { console.error('        ' + path.relative(PUBLIC, p)); });
  console.error('      Re-run tools/import-kenney.js: it clears each pack folder before writing.');
}

/* ---- 3. bundles and their members agree, in both directions ---- */
bundles.forEach(function (b) {
  if (!Array.isArray(b.members) || !b.members.length) { fail('bundle "' + b.id + '" has no members.'); return; }
  if (b.count !== b.members.length) {
    fail('bundle "' + b.id + '" says ' + b.count + ' pieces but lists ' + b.members.length + '.');
  }
  const ghosts = b.members.filter(function (k) { return !byKey[k]; });
  if (ghosts.length) {
    fail('bundle "' + b.id + '" sells ' + ghosts.length + ' key(s) that are not assets, e.g. "' + ghosts[0] + '".');
  }
  (b.preview || []).forEach(function (f) {
    if (!fs.existsSync(path.join(PUBLIC, f))) fail('bundle "' + b.id + '" previews ' + f + ', which is not on disk.');
  });
  if (!b.preview || !b.preview.length) fail('bundle "' + b.id + '" has no preview pictures — its card would be blank.');
});
assets.forEach(function (a) {
  if (a.bundle && !byBundle[a.bundle]) {
    fail('asset "' + a.key + '" belongs to bundle "' + a.bundle + '", which does not exist — nobody could ever buy it.');
  }
});

/* ---- 4. the starter game can still run ----
   Read from the real starter source rather than a list kept here, so this cannot drift from it. */
const starterSrc = fs.readFileSync(path.join(PUBLIC, 'js', 'starter-code.js'), 'utf8');
/* Every string that is passed where Phaser expects a texture or sound key. */
const used = new Set();
[/(?:add|create)\.(?:sprite|image|text)?\s*\([^)]*?['"]([\w.-]+)['"]\s*\)/g,
 /\.create\([^,]+,[^,]+,\s*['"]([\w.-]+)['"]\s*\)/g,
 /sound\.play\(\s*['"]([\w.-]+)['"]\s*\)/g,
 /^const BLOCK = '([\w.-]+)'/gm].forEach(function (re) {
  /* Every one of these MUST carry /g. `exec` on a non-global regex ignores lastIndex and returns
     the same match forever, so a `while (exec())` loop over one never terminates. */
  let m; while ((m = re.exec(starterSrc))) used.add(m[1]);
});
/* `add.text` takes a string to DISPLAY, not a key, so anything with a space is not a key. */
const starterKeys = [...used].filter(function (k) { return !/\s/.test(k) && k.indexOf('.') < 0; });
if (!starterKeys.length) {
  fail('could not find any asset keys in starter-code.js — this check has stopped covering it.');
}
starterKeys.forEach(function (k) {
  const a = byKey[k];
  if (!a) fail('the starter game uses "' + k + '", which is not in the Store at all. Every new student would see a missing texture.');
  else if (!a.free) fail('the starter game uses "' + k + '", which is NOT free. A new student cannot play their own starter game.');
});

/* ---- 5. packs ---- */
const packIds = new Set(packs.map(function (p) { return p.id; }));
const strays = [...new Set(assets.map(function (a) { return a.pack; }))].filter(function (p) { return !packIds.has(p); });
if (strays.length) fail('assets claim pack(s) not in STORE_PACKS: ' + strays.join(', '));
packs.forEach(function (p) {
  const n = assets.filter(function (a) { return a.pack === p.id; }).length;
  if (n !== p.count) fail('pack "' + p.id + '" says ' + p.count + ' sprites but the catalogue holds ' + n + '.');
});

const free = assets.filter(function (a) { return a.free; });
console.log(assets.length + ' assets, ' + bundles.length + ' bundles, ' + packs.length + ' packs — '
  + free.length + ' free, ' + starterKeys.length + ' keys used by the starter game');
if (!fails) console.log('every asset is on disk, every bundle sells what it lists, and a new student can play');
else console.error(fails + ' problem(s) in the Store catalogue');
process.exit(fails ? 1 : 0);
