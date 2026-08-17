/* strip-manifest-uris.js — one-shot: drop the base64 `uri` field from assets-manifest.js.
 *
 * Every one of the 265 entries carries BOTH a base64 data URI and a `file` path, and the file is
 * really on disk under public/assets/. The base64 copy was 933 KB of the manifest's 983 KB — a
 * megabyte of duplication downloaded on every single page load, including by a student who only
 * opens a lesson and reads it.
 *
 * The reason it was inlined at all was almost certainly the game iframe, but that iframe is
 * `srcdoc` with no sandbox attribute, so it shares the parent's origin — it already loads Phaser
 * from /vendor/phaser/phaser.min.js by path. Plain URLs work there.
 *
 * Run: node app/tools/strip-manifest-uris.js
 * Idempotent: running it again on an already-stripped manifest is a no-op.
 */
const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '..', 'public');
const file = path.join(pub, 'assets-manifest.js');

global.window = {};
require(file);
const arr = global.window.STORE_ASSETS;
if (!Array.isArray(arr)) { console.error('No STORE_ASSETS array found.'); process.exit(1); }

/* Refuse to strip anything we cannot serve from disk instead — losing an asset silently would
   show up as a blank sprite in a child's game days later. */
const missing = arr.filter(function (a) { return !a.file || !fs.existsSync(path.join(pub, a.file)); });
if (missing.length) {
  console.error('Refusing to strip: ' + missing.length + ' entries have no file on disk, e.g. '
    + missing.slice(0, 5).map(function (a) { return a.id; }).join(', '));
  process.exit(1);
}

const before = fs.statSync(file).size;
const stripped = arr.map(function (a) { const c = Object.assign({}, a); delete c.uri; return c; });

const header = '/* Auto-generated: Kenney CC0 assets. Sources: Platformer Art Deluxe, UI Pack, '
  + 'Digital Audio, Interface Sounds. License: CC0.\n'
  + '   Assets are referenced by their `file` path under public/assets/, not inlined — see\n'
  + '   app/tools/strip-manifest-uris.js for why. */\n';
fs.writeFileSync(file, header + 'window.STORE_ASSETS = ' + JSON.stringify(stripped) + ';\n');

const after = fs.statSync(file).size;
console.log('assets-manifest.js: ' + Math.round(before / 1024) + ' KB -> ' + Math.round(after / 1024) + ' KB'
  + '  (' + arr.length + ' entries, ' + arr.filter(function (a) { return a.type === 'audio'; }).length + ' audio)');
