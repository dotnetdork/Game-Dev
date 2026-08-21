/* check-release.js — the switches that must be flipped before students use this.
 *
 * NOT part of `npm test`, on purpose. `js/dev.js` holds switches whose whole job is to be ON while
 * the app is being built — `unlockAll` opens every lesson so the course can be read and proof-read
 * without playing through 22 lessons first. A daily test run that fails because a development
 * switch is on teaches you to ignore the test run.
 *
 * So this is a separate gate, run deliberately:
 *
 *   npm --prefix app run check:release
 *
 * Run it before handing the app to a class, or wire it into a deploy step. The point is that
 * "did anyone flip that back?" stops being something a person has to remember and becomes
 * something that answers itself.
 *
 * Parsed out of the file as text rather than imported, because dev.js is browser JavaScript with
 * no exports and reads `location.search` at load.
 */
const fs = require('fs');
const path = require('path');

const DEV_FILE = path.join(__dirname, '..', 'public', 'js', 'dev.js');

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

const src = fs.readFileSync(DEV_FILE, 'utf8');

/* Reads `name: true` / `name: false` out of the DEV object literal. Returns null if the switch
   is missing or is set to something other than a plain boolean — either of which is a thing to
   look at rather than something to quietly pass. */
function devFlag(name) {
  const m = src.match(new RegExp('\\b' + name + '\\s*:\\s*(true|false)\\b'));
  return m ? m[1] === 'true' : null;
}

const unlockAll = devFlag('unlockAll');
const sandboxGame = devFlag('sandboxGame');

check('DEV.unlockAll is off, so the course runs in order',
  unlockAll === false,
  unlockAll === null ? 'could not find it in js/dev.js' : 'unlockAll = ' + unlockAll
    + (unlockAll ? ' — every lesson is open; set it to false in app/public/js/dev.js' : ''));

check('DEV.sandboxGame is on, so student code cannot reach the app',
  sandboxGame === true,
  sandboxGame === null ? 'could not find it in js/dev.js' : 'sandboxGame = ' + sandboxGame
    + (sandboxGame === false ? ' — the game frame can read the parent page; set it to true' : ''));

console.log('\n' + (failures
  ? failures + ' switch(es) still set for development — not ready for students'
  : 'release switches are set correctly'));
process.exit(failures ? 1 : 0);
