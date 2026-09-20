/* check-sandbox.js — the code injected into a student's frame is valid code.
 *
 * js/sandbox-shims.js generates JavaScript as a STRING, to be embedded in a <script> tag inside a
 * srcdoc document. Nothing checks a string. `node --check` reads the generator, not what it
 * produces, and check-boot.js runs under jsdom, which does not execute iframes at all — so a
 * mismatched quote or a stray backslash in there is invisible to every existing check and breaks
 * EVERY GAME AND EVERY LAB AT ONCE, in a way that looks to a child like their own code failing.
 *
 * So: generate both configurations, strip the <script> wrapper, and hand the result to the parser.
 * Then assert that the pieces that drifted apart are present in both — the location on an error,
 * the console levels, the pause key — because "it parses" is not the same as "it still does the
 * job", and the drift this file exists to stop was never a syntax error.
 *
 * Run by `npm test`.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'public', 'js');

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

/* The shims are browser globals with no exports, so evaluate the file and pull the two builders
   out of the context — the same trick check-state.js uses on project.js. */
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(SRC, 'sandbox-shims.js'), 'utf8'), ctx);
const build = vm.runInContext('({ consoleShim: sandboxConsoleShim, pauseShim: sandboxPauseShim })', ctx);

/* Exactly the two configurations the app uses. If either caller changes its envelope, this is
   where the new one has to be written down too — which is the point. */
const CONFIGS = {
  game: build.consoleShim({
    post: '{__gamelog:true,level:lvl,text:txt}',
    onError: '{__gamelog:true,level:"error",text:String(msg),file:file,line:line,col:col}'
  }),
  lab: build.consoleShim({
    post: '{__cm:true,tok:"t7",log:{level:lvl,text:txt}}',
    onError: '{__cm:true,tok:"t7",err:String(msg),file:file,line:line,col:col}'
  }),
  /* The fallback path: no onError given, so errors go out through `post`. Nothing uses it today,
     and it is checked because a caller that forgets the second argument should get working code
     rather than a frame that dies on its first typo. */
  'console only': build.consoleShim({ post: '{__gamelog:true,level:lvl,text:txt}' })
};
const PAUSE = { game: build.pauseShim('__gamectl'), lab: build.pauseShim('__labctl') };

/* <script>…</script> off, so what is left is what the browser would actually parse. */
function bare(s) {
  return String(s).replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '').trim();
}

Object.keys(CONFIGS).forEach(function (name) {
  const code = bare(CONFIGS[name]);
  let ok = true, why = '';
  try { new vm.Script(code); } catch (e) { ok = false; why = e.message; }
  check('the ' + name + ' console shim is valid JavaScript', ok, ok ? code.length + ' chars' : why);
});
Object.keys(PAUSE).forEach(function (name) {
  let ok = true, why = '';
  try { new vm.Script(bare(PAUSE[name])); } catch (e) { ok = false; why = e.message; }
  check('the ' + name + ' pause shim is valid JavaScript', ok, ok ? 'parses' : why);
});

/* ---- and that it still does the job ---- */
const game = CONFIGS.game, lab = CONFIGS.lab;

check('both forward the file and line of an uncaught error',
  /file:file,line:line,col:col/.test(game) && /file:file,line:line,col:col/.test(lab),
  'this is the exact thing that drifted: the game carried the location and the lab did not');

check('both wrap the same five console levels',
  ['log', 'info', 'debug', 'warn', 'error'].every(function (l) {
    return game.indexOf('"' + l + '"') >= 0 && lab.indexOf('"' + l + '"') >= 0;
  }),
  'a student who types console.info should not silently see nothing');

check('both catch an unhandled promise rejection',
  /unhandledrejection/.test(game) && /unhandledrejection/.test(lab),
  'otherwise a failed async load is silent, which is the worst bug to meet at eleven');

check('each envelope reaches the consumer that reads it',
  /__gamelog/.test(game) && !/__cm/.test(game) && /__cm/.test(lab) && !/__gamelog/.test(lab),
  'console-dock.js reads __gamelog; the bench reads __cm');

/* The split the lab depends on: a THROWN error fails the attempt, a console.error does not. If the
   two ever share one envelope, a child debugging with console.error fails their own lab. */
check('a lab separates a thrown error from a printed one',
  /err:String\(msg\)/.test(lab) && /log:\{level:lvl/.test(lab),
  'err fails the attempt, log does not');

check('the two pause shims answer different keys',
  /__gamectl/.test(PAUSE.game) && /__labctl/.test(PAUSE.lab)
    && !/__labctl/.test(PAUSE.game) && !/__gamectl/.test(PAUSE.lab),
  'a message meant for a lab must not pause a game running behind it');

/* ---- the callers actually use them ---- */
const runner = fs.readFileSync(path.join(SRC, 'game-runner.js'), 'utf8');
const labjs = fs.readFileSync(path.join(SRC, 'lab.js'), 'utf8');
check('game-runner.js builds its shims from the shared file',
  /sandboxConsoleShim\(/.test(runner) && /sandboxPauseShim\(/.test(runner), 'both');
check('lab.js builds its shims from the shared file',
  /sandboxConsoleShim\(/.test(labjs) && /sandboxPauseShim\(/.test(labjs), 'both');
/* labDoc used to install a second window.onerror AFTER the shim, silently replacing it. Whichever
   is installed last wins, so there must be exactly one. */
check('lab.js does not install a second window.onerror over the shared one',
  (labjs.match(/window\.onerror\s*=/g) || []).length === 0,
  'the one in the shim is the only one');

console.log('\n' + (failures
  ? failures + ' check(s) failed — the code injected into a student\'s game is not sound'
  : 'the injected shims parse, and both frames report errors the same way'));
process.exit(failures ? 1 : 0);
