/* check-gamelog.js — the game's console output on its way to the AI.
 *
 * The buffer in console-dock.js and the renderer in ai/loader.js are the two halves of "the AI
 * can see what the game actually did". Both are easy to get subtly wrong in ways nobody would
 * notice: a log that never clears leaks the previous run's errors into this one's advice, and a
 * game that was never run must never look like a game that ran cleanly.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'public', 'js');
let failures = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failures++; console.error('FAIL  ' + name + '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)); }
  else console.log('PASS  ' + name);
}
function checkTrue(name, got) { check(name, !!got, true); }
function checkHas(name, hay, needle) {
  const ok = String(hay).indexOf(needle) >= 0;
  if (!ok) { failures++; console.error('FAIL  ' + name + '\n        missing ' + JSON.stringify(needle)); }
  else console.log('PASS  ' + name);
}

/* console-dock.js is script-scope code that expects a page. Give it just enough of one: every
   $() lookup returns null, which every branch already guards for. */
function loadDock() {
  const sandbox = {
    $: () => null,
    window: { addEventListener: () => {} },
    document: { createElement: () => ({ classList: { add(){}, toggle(){} }, appendChild(){} }) },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    toast: () => {}, modal: () => {}, requestAnimationFrame: () => {}
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'console-dock.js'), 'utf8'), ctx);
  return {
    line: (lvl, txt) => vm.runInContext('conLine(' + JSON.stringify(lvl) + ',' + JSON.stringify(txt) + ')', ctx),
    clear: () => vm.runInContext('conClear()', ctx),
    run: () => vm.runInContext('noteGameRun()', ctx),
    recent: (n) => vm.runInContext('recentGameLog(' + (n === undefined ? '' : n) + ')', ctx),
    ran: () => vm.runInContext('gameHasRun', ctx),
    all: () => vm.runInContext('gameLog', ctx),
    cap: () => vm.runInContext('GAMELOG_MAX', ctx)
  };
}

console.log('--- the buffer ---');
{
  const d = loadDock();
  check('nothing has run yet', d.ran(), false);
  check('and there is nothing to report', d.recent(), []);

  d.run();
  d.line('log', 'Game started');
  d.line('error', 'star is not defined');
  check('a run is recorded', d.ran(), true);
  check('lines arrive in order with their level',
    d.recent(), [{ level: 'log', text: 'Game started', n: 1 }, { level: 'error', text: 'star is not defined', n: 1 }]);
}
{
  /* A console.log inside update() fires every frame. Stored one per line it would be the whole
     buffer within a second, pushing the actual error out of the window. */
  const d = loadDock(); d.run();
  d.line('error', 'boom');
  for (let i = 0; i < 500; i++) d.line('log', 'x: 40');
  const got = d.recent();
  check('a repeated line is counted, not stored 500 times', got.length, 2);
  check('with an honest count', got[1], { level: 'log', text: 'x: 40', n: 500 });
  check('and the error before it survives', got[0].text, 'boom');
}
{
  const d = loadDock(); d.run();
  for (let i = 0; i < 300; i++) d.line('log', 'line ' + i);       // all distinct: no deduping
  check('the buffer is capped', d.all().length, d.cap());
  check('it keeps the newest', d.all()[d.all().length - 1].text, 'line 299');
}
{
  /* An error at startup matters more than the sixtieth frame of ordinary logging, so it is
     carried forward even once it has scrolled out of the recent window. */
  const d = loadDock(); d.run();
  d.line('error', 'could not load: player');
  d.line('warn', 'audio is muted');
  for (let i = 0; i < 40; i++) d.line('log', 'tick ' + i);
  const got = d.recent(14);
  check('the window is the tail plus any problems it missed', got.length, 16);
  check('the startup error is still first', got[0].text, 'could not load: player');
  check('and the warning after it', got[1].text, 'audio is muted');
  check('the rest is the newest output', got[got.length - 1].text, 'tick 39');
}
{
  /* The AI must never know something the student's own console does not. */
  const d = loadDock(); d.run();
  d.line('error', 'from the previous run');
  d.clear();
  check('clearing the console clears what the AI sees', d.recent(), []);
  check('but the game is still known to have run', d.ran(), true);
}

console.log('\n--- the prompt ---');
{
  const ai = require(path.join(__dirname, '..', 'ai', 'loader.js'));
  const base = { lessonTitle: 'Values and Variables', gameCode: 'const CONFIG = {};' };

  const never = ai.buildPrompt('tutor', Object.assign({ gameRan: false, gameLog: [] }, base));
  checkTrue('the tutor prompt builds', !!never);
  checkHas('never run says so', never, 'have not run their game yet');

  const silent = ai.buildPrompt('tutor', Object.assign({ gameRan: true, gameLog: [] }, base));
  checkHas('ran-and-silent is a different sentence', silent, 'ran and printed nothing');
  check('the two are never confused',
    silent.indexOf('have not run their game yet') < 0, true);

  const noisy = ai.buildPrompt('coder', Object.assign({ gameRan: true, gameLog: [
    { level: 'error', text: 'Your create() stopped: star is not defined', n: 1 },
    { level: 'log', text: 'x: 40', n: 240 }
  ] }, base));
  checkHas('the error reaches the coder', noisy, '[error] Your create() stopped: star is not defined');
  checkHas('a repeat carries its count', noisy, '(repeated 240 times)');
  check('a single line is not annotated', noisy.indexOf('(repeated 1 times)') < 0, true);

  /* Nothing here comes from a trusted source, and a malformed entry must not 500 a lesson. */
  const junk = ai.buildPrompt('coder', Object.assign({ gameRan: true, gameLog: [{}] }, base));
  checkTrue('a malformed entry still renders', !!junk);
}

console.log(failures ? '\n' + failures + ' failed' : '\nall good');
process.exit(failures ? 1 : 0);
