/* subset-icons.js — build a Material Design Icons subset containing only the icons we use.
 *
 * The vendored MDI set is 3.8 MB on disk and costs 733 KB over the wire (394 KB woff2 + 339 KB of
 * CSS defining seven thousand classes). The app uses about seventy icons. Vendoring the library
 * was the right call for a filtered school network; shipping all of it was not.
 *
 * Output (written next to the originals, which are left untouched):
 *   vendor/mdi/css/mdi-subset.css
 *   vendor/mdi/fonts/mdi-subset.woff2
 *
 * Run: node app/tools/subset-icons.js        (needs Python with fonttools and brotli:
 *                                             `python -m pip install fonttools brotli`)
 * Check: node app/tools/subset-icons.js --check   — fails if an icon is used but not in the subset
 *
 * The --check mode is the point of having this as a tool rather than a one-off. Adding an icon to
 * a lesson without rebuilding the subset would otherwise render an invisible box, and nobody would
 * notice until a child asked why the button was empty. `npm test` runs the check.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MDI = path.join(ROOT, 'public', 'vendor', 'mdi');
const FULL_CSS = path.join(MDI, 'css', 'materialdesignicons.min.css');
const FULL_FONT = path.join(MDI, 'fonts', 'materialdesignicons-webfont.woff2');
const OUT_CSS = path.join(MDI, 'css', 'mdi-subset.css');
const OUT_FONT = path.join(MDI, 'fonts', 'mdi-subset.woff2');

/* Where an icon name can appear. Class names are always written out in full — verified there is
   no `'mdi-' + name` anywhere — so a regex over the sources is exact, not a guess. */
function usedIcons() {
  const files = [path.join(ROOT, 'public', 'index.html')];
  const walk = (dir, re) => fs.readdirSync(dir).forEach(function (f) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) return;
    if (re.test(f)) files.push(p);
  });
  walk(path.join(ROOT, 'public', 'js'), /\.js$/);
  walk(path.join(ROOT, 'content', 'lessons'), /\.md$/);
  files.push(path.join(ROOT, 'public', 'styles.css'));

  const found = new Set();
  files.forEach(function (f) {
    const text = fs.readFileSync(f, 'utf8');
    const re = /\bmdi-([a-z0-9-]+)\b/g;
    let m;
    while ((m = re.exec(text)) !== null) found.add('mdi-' + m[1]);
  });
  return [...found].sort();
}
/* Modifier classes (mdi-set, mdi-24px, mdi-light, mdi-spin...) share the prefix but are not icons.
   They are separated by asking the codepoint table, not by matching their names: the first version
   of this filtered on a name prefix and quietly dropped `mdi-lightning-bolt` for starting with
   "light", which rendered the XP badge as an invisible box. Membership in the table is exact. */
function realIcons(names, map) { return names.filter(function (n) { return !!map[n]; }); }

/* MDI's minified CSS is one long `.mdi-name::before{content:"\FXXX"}` chain. */
function codepointMap() {
  const css = fs.readFileSync(FULL_CSS, 'utf8');
  const map = {};
  const re = /\.(mdi-[a-z0-9-]+)::?before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"/g;
  let m;
  while ((m = re.exec(css)) !== null) map[m[1]] = m[2].toUpperCase();
  return map;
}

const map = codepointMap();
const icons = realIcons(usedIcons(), map);

/* Read the codepoints the built font actually contains. The CSS saying `.mdi-x{content:"\F123"}`
   proves nothing if glyph F123 was never put in the font — that is exactly the failure that shows
   up as a blank square in the UI, and it is invisible to a check that only reads the CSS. */
function fontCodepoints() {
  const py = 'from fontTools.ttLib import TTFont;'
    + 'f=TTFont(' + JSON.stringify(OUT_FONT) + ');'
    + 'print(",".join("%04X"%c for c in f.getBestCmap().keys()))';
  return new Set(execFileSync(python(), ['-c', py]).toString().trim().split(',').filter(Boolean));
}
let _py = null;
function python() {
  if (_py) return _py;
  _py = 'python';
  try { execFileSync(_py, ['-c', 'import fontTools'], { stdio: 'ignore' }); } catch (e) { _py = 'python3'; }
  return _py;
}

if (process.argv.includes('--check')) {
  let bad = 0;
  if (!fs.existsSync(OUT_CSS) || !fs.existsSync(OUT_FONT)) {
    console.error('The icon subset has not been built. Run: node app/tools/subset-icons.js');
    process.exit(1);
  }
  const built = new Set((fs.readFileSync(OUT_CSS, 'utf8').match(/\.(mdi-[a-z0-9-]+)::before/g) || [])
    .map(function (s) { return s.slice(1).replace('::before', ''); }));
  const notBuilt = icons.filter(function (n) { return !built.has(n); });
  if (notBuilt.length) {
    bad = 1;
    console.error('Used but missing from the subset — these render as blank boxes:\n  '
      + notBuilt.join(', ') + '\nRebuild with: node app/tools/subset-icons.js');
  }
  let inFont;
  try { inFont = fontCodepoints(); } catch (e) { inFont = null; console.warn('(could not read the font; CSS checked only)'); }
  if (inFont) {
    const noGlyph = icons.filter(function (n) { return built.has(n) && !inFont.has(map[n]); });
    if (noGlyph.length) {
      bad = 1;
      console.error('In the CSS but with no glyph in the font — also blank boxes:\n  ' + noGlyph.join(', '));
    }
  }
  if (!bad) console.log('icons: all ' + icons.length + ' used icons are in the subset CSS and the font');
  process.exit(bad);
}

const points = icons.map(function (n) { return map[n]; });
const py = 'import sys;from fontTools import subset;'
  + 'subset.main([' + JSON.stringify(FULL_FONT) + ','
  + '"--unicodes=" + ' + JSON.stringify(points.join(',')) + ','
  + '"--flavor=woff2","--output-file=" + ' + JSON.stringify(OUT_FONT) + '])';

execFileSync(python(), ['-c', py], { stdio: 'inherit' });

/* Keep MDI's own class names and base rule so nothing in the app has to change — only the table
   of seven thousand codepoints shrinks to the ones we actually draw. */
/* The font URL carries a hash of the font's own bytes. Without it, adding an icon rebuilds the
   file at the same path and the browser keeps serving the old one from cache — which looks exactly
   like the icon being missing, and cost an hour the first time. */
const hash = require('crypto').createHash('sha1').update(fs.readFileSync(OUT_FONT)).digest('hex').slice(0, 8);

const css = '/* Generated by app/tools/subset-icons.js — do not edit.\n'
  + '   ' + icons.length + ' icons out of the full Material Design Icons set (Apache-2.0, v7.4.47).\n'
  + '   Rebuild after adding an icon; `npm test` fails if you forget. */\n'
  + '@font-face{font-family:"Material Design Icons";'
  + 'src:url("../fonts/mdi-subset.woff2?v=' + hash + '") format("woff2");'
  + 'font-weight:normal;font-style:normal;font-display:block}\n'
  + '.mdi:before,.mdi-set{display:inline-block;font:normal normal normal 24px/1 "Material Design Icons";'
  + 'font-size:inherit;text-rendering:auto;line-height:inherit;'
  + '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}\n'
  + icons.map(function (n) { return '.' + n + '::before{content:"\\' + map[n] + '"}'; }).join('\n') + '\n';
fs.writeFileSync(OUT_CSS, css);

const kb = (p) => Math.round(fs.statSync(p).size / 1024);
console.log('icons subset: ' + icons.length + ' icons');
console.log('  font  ' + kb(FULL_FONT) + ' KB -> ' + kb(OUT_FONT) + ' KB');
console.log('  css   ' + kb(FULL_CSS) + ' KB -> ' + kb(OUT_CSS) + ' KB');
