/* check-state.js — the saved-state migration rules, exercised without a browser.
 *
 * project.js is plain script-scope code with no exports, so this evaluates it against a small
 * localStorage stand-in. That is deliberate: the alternative is trusting migrations that only run
 * on a student's machine, once, on data we can't get back.
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

/* A localStorage that behaves like the real one where it matters: string values, and a `length`
   we can inspect to prove nothing was destroyed. */
function makeStore(seed) {
  const map = Object.assign({}, seed || {});
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    keys: () => Object.keys(map),
    raw: map
  };
}

function load(seed) {
  const store = makeStore(seed);
  const sandbox = {
    localStorage: store,
    console: { warn: () => {}, log: () => {}, error: () => {} },
    window: {}, document: { getElementById: () => null },
    renderFooter: () => {}, saveState: () => {}
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'starter-code.js'), 'utf8'), ctx);
  // project.js's tail touches DOM helpers we don't have; only the storage half is under test.
  const src = fs.readFileSync(path.join(SRC, 'project.js'), 'utf8');
  const cut = src.indexOf('/* ---------- per-lesson activity ledger');
  vm.runInContext(src.slice(0, cut > 0 ? cut : src.length), ctx);
  // `let project` / `let state` are lexical bindings, so they are not properties of the context.
  // Pull them out by evaluating an expression inside it.
  const got = vm.runInContext('({ project: project, state: state })', ctx);
  return { project: got.project, state: got.state, store: store };
}

console.log('--- fresh install ---');
{
  const { project, state } = load({});
  check('new project is stamped v1', project.v, 1);
  check('new progress is stamped v1', state.v, 1);
  checkTrue('new project has the starter files', typeof project.files['game.js'] === 'string');
}

console.log('\n--- an existing save from before versioning ---');
{
  const legacy = JSON.stringify({ files: { 'game.js': '// mine', 'config.js': '// cfg' }, order: ['game.js', 'config.js'] });
  const legacyProgress = JSON.stringify({ xp: 900, stars: 12, done: { '0.0': true } });
  const { project, state, store } = load({ leagueProject: legacy, leagueProgress: legacyProgress });
  check('un-numbered project is adopted, not replaced', project.files['game.js'], '// mine');
  check('...and stamped to the current version', project.v, 1);
  check('un-numbered progress keeps its XP', state.xp, 900);
  check('...and its completed lessons', state.done, { '0.0': true });
  check('...and gains keys added since it was written', state.activities, {});
  check('nothing was quarantined', store.keys().filter(k => k.includes('.broken.')).length, 0);
}

console.log('\n--- a save from a NEWER build than this one ---');
{
  const future = JSON.stringify({ v: 99, files: { 'game.js': '// from tomorrow' }, order: ['game.js'] });
  const { project, state } = load({ leagueProject: future });
  check('a future project is left alone, not downgraded', project.v, 99);
  check('...and its contents survive', project.files['game.js'], '// from tomorrow');
}

console.log('\n--- corrupt data ---');
{
  const { project, state, store } = load({ leagueProject: '{not json', leagueProgress: '[1,2,3]' });
  checkTrue('a corrupt project falls back to the starter', typeof project.files['game.js'] === 'string');
  check('...and the unreadable bytes are kept, never overwritten',
    store.keys().filter(k => k.startsWith('leagueProject.broken.')).length, 1);
  check('progress of the wrong shape is also quarantined',
    store.keys().filter(k => k.startsWith('leagueProgress.broken.')).length, 1);
  check('...and progress falls back to defaults', state.xp, 0);
}

console.log('\n--- a save that is JSON but not a project ---');
{
  const { project, state, store } = load({ leagueProject: JSON.stringify({ hello: 'world' }) });
  checkTrue('unrecognised shape falls back', typeof project.files['game.js'] === 'string');
  check('...and is quarantined', store.keys().filter(k => k.startsWith('leagueProject.broken.')).length, 1);
}

console.log('\n' + (failures ? failures + ' failing' : 'all state checks pass'));
process.exit(failures ? 1 : 0);
