// Assembles a wireframe from its template: {{CSS}}, {{ICONS}} and {{LOGO}} are replaced with
// base.css, icons.svg and logo.txt (the League wordmark as a data URI), and {{SFX}} with the real
// sound files below as base64, so the output is one self-contained HTML file that opens from disk
// (or as an Artifact) with no server.
//   node docs/rework/wireframes/src/build.js 03-shift-silent-coins
// Edit the template, not the output: the output is overwritten.
const fs = require('fs'), path = require('path');
const name = process.argv[2] || '03-shift-silent-coins';
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
/* The shelf's sounds: Kenney CC0 files already committed for the app (app/public/assets/CREDITS.txt).
   Picked by name to keep each sound's mood, which the shift's "a buzz sounds like getting hurt"
   challenge depends on. ~25 KB of audio in all. */
const ASSETS = path.join(__dirname, '..', '..', '..', '..', 'app', 'public', 'assets');
const SFX = { ding: 'platformer/sfx_coin.ogg', boing: 'platformer/sfx_jump.ogg',
              thud: 'platformer/sfx_bump.ogg', buzz: 'sfx-error.ogg' };
const sfx = JSON.stringify(Object.fromEntries(Object.entries(SFX).map(([id, f]) =>
  [id, fs.readFileSync(path.join(ASSETS, f)).toString('base64')])));
const out = read(name + '.template.html')
  .replace('{{CSS}}', () => read('base.css'))
  .replace('{{ICONS}}', () => read('icons.svg'))
  .replace('{{LOGO}}', () => read('logo.txt').trim())
  .replace('{{SFX}}', () => sfx);
fs.writeFileSync(path.join(__dirname, '..', name + '.html'), out);
console.log('wrote docs/rework/wireframes/' + name + '.html');
