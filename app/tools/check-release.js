/* check-release.js — the switches that must be right before students use this.
 *
 * WHAT THIS CHECKS CHANGED WHEN DEV MODE STOPPED BEING A CONSTANT.
 *
 * It used to read `unlockAll: true` out of js/dev.js and fail while it was on, because the flag had
 * to be flipped back by hand before a deploy. That is a reminder with a safety net, and the net only
 * works if somebody runs it. Dev mode is now DERIVED — on when the app is served from a laptop, off
 * everywhere else — so the League server's build is a student's build because of where it is, and there is
 * no longer a constant that can be left in the wrong position.
 *
 * So this checks the derivation instead: that dev mode is still decided by the hostname, that a URL
 * cannot switch it on where it is off, and that the controls which destroy a student's work are
 * still marked as dev-only in the markup. Those are the three things that, if broken, would put a
 * reset-everything button in front of a class.
 *
 *   npm --prefix app run check:release
 *
 * Parsed as text rather than imported, because dev.js is browser JavaScript with no exports that
 * reads `location` at load.
 */
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const DEV_FILE = path.join(PUB, 'js', 'dev.js');
const INDEX_FILE = path.join(PUB, 'index.html');
const CSS_FILE = path.join(PUB, 'styles.css');

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

const dev = fs.readFileSync(DEV_FILE, 'utf8');
const html = fs.readFileSync(INDEX_FILE, 'utf8');
const css = fs.readFileSync(CSS_FILE, 'utf8');

/* Reads `name: true` / `name: false` out of the DEV object literal. Returns null when the switch is
   missing or is set to something that is not a plain boolean. */
function devFlag(name) {
  const m = dev.match(new RegExp('\\b' + name + '\\s*:\\s*(true|false)\\b'));
  return m ? m[1] === 'true' : null;
}

/* 1. Dev mode is derived, not written down. A literal `on: true` here would be exactly the failure
      mode this whole arrangement exists to remove. */
check('dev mode is derived from the hostname, not hard-coded',
  /\bon\s*:\s*devHost\(\)/.test(dev) && devFlag('on') === null,
  devFlag('on') === null ? 'DEV.on = devHost()' : 'DEV.on is hard-coded to ' + devFlag('on')
    + ' — it must be devHost(), or every deployment ships in dev mode');

check('lesson unlocking is derived too, so the course runs in order for students',
  /\bunlockAll\s*:\s*devHost\(\)/.test(dev) && devFlag('unlockAll') === null,
  devFlag('unlockAll') === null ? 'DEV.unlockAll = devHost()' : 'unlockAll is hard-coded to ' + devFlag('unlockAll'));

/* 2. devHost() must only ever answer yes for a machine, never for a deployment. Checked by running
      the function itself against a list of hostnames rather than by reading the regex, because the
      regex is the thing most likely to be edited into something too generous. */
let devHost = null;
try {
  const body = dev.match(/function devHost\(\)\s*\{[\s\S]*?\n\}/);
  if (body) {
    /* eslint-disable no-new-func */
    /* hostedCookie() is stubbed to "no answer" so this exercises the hostname fallback on its own;
       the cookie path is checked separately below. */
    devHost = new Function('location',
      'function hostedCookie(){return null;}\n' + body[0] + '\nreturn devHost();');
  }
} catch (e) { devHost = null; }

/* The server's answer has to beat the hostname, or a deployment that happens to be reached on an
   odd host name would unlock the course. */
check('the server’s answer decides it, not the hostname',
  /function hostedCookie\s*\(/.test(dev) && /if \(hosted !== null\) return !hosted;/.test(dev),
  'league_hosted is set on every response by server.js');

const LOCAL = ['localhost', '127.0.0.1', 'app.localhost', 'jays-laptop.local'];
const HOSTED = ['game-dev.apps.jointheleague.org', 'gamedev.jointheleague.org',
  'notlocalhost.com', 'localhost.evil.com', 'my-localhost-app.net'];
if (!devHost) {
  check('devHost() could be read out of js/dev.js', false, 'the function was not found — this check cannot run');
} else {
  const wrongLocal = LOCAL.filter(function (h) { return devHost({ hostname: h }) !== true; });
  const wrongHosted = HOSTED.filter(function (h) { return devHost({ hostname: h }) !== false; });
  check('dev mode is ON for a laptop', !wrongLocal.length, wrongLocal.length ? 'said no to: ' + wrongLocal.join(', ') : LOCAL.length + ' hostnames');
  check('dev mode is OFF for anything deployed', !wrongHosted.length,
    wrongHosted.length ? 'said YES to: ' + wrongHosted.join(', ') + ' — a student build would unlock the course'
      : HOSTED.length + ' hostnames, including ones with "localhost" inside them');
}

/* 3. A URL must not be able to switch dev things on. `?dev=1` on the deployed site would otherwise
      be a link a student could pass round that unlocks the course and hands them a reset button. */
check('a URL cannot switch dev mode ON where it is off',
  /if\s*\(\s*want\s*&&\s*!here\s*\)\s*return/.test(dev),
  'the guard in the override block is what stops ?dev=1 working on the League server');

/* 4. The controls that destroy a student's work are marked, and the marking defaults to hidden. */
const devOnly = (html.match(/data-dev-only/g) || []).length;
check('the destructive controls are marked dev-only', devOnly >= 2,
  devOnly + ' element(s) carry data-dev-only — expected the footer reset and the game reset');
check('reset-everything is marked dev-only',
  /id="resetAllBtn"[^>]*data-dev-only|data-dev-only[^>]*id="resetAllBtn"/.test(html),
  'the footer button that wipes the account');
check('reset-the-game is marked dev-only',
  /id="gameReset"[^>]*data-dev-only|data-dev-only[^>]*id="gameReset"/.test(html),
  'the transport button that throws away their code');
check('data-dev-only is hidden unless something says otherwise',
  /\[data-dev-only\]\s*\{\s*display:\s*none\s*!important/.test(css),
  'hidden is the default, so a control that forgets to ask stays out of a student build');

/* 5. The sandbox is not a dev switch — it is the isolation the game frame runs under. */
const sandboxGame = devFlag('sandboxGame');
check('DEV.sandboxGame is on, so student code cannot reach the app',
  sandboxGame === true,
  sandboxGame === null ? 'could not find it in js/dev.js' : 'sandboxGame = ' + sandboxGame
    + (sandboxGame === false ? ' — the game frame can read the parent page; set it to true' : ''));

console.log('\n' + (failures
  ? failures + ' check(s) failed — not ready for students'
  : 'release checks pass: a deployed build locks the course and hides the reset controls'));
process.exit(failures ? 1 : 0);
