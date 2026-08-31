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
  // storage.js first: project.js reads and writes through it, not through localStorage.
  vm.runInContext(fs.readFileSync(path.join(SRC, 'events.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'storage.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'starter-code.js'), 'utf8'), ctx);
  // project.js's tail touches DOM helpers we don't have; only the storage half is under test.
  const src = fs.readFileSync(path.join(SRC, 'project.js'), 'utf8');
  const cut = src.indexOf('/* ---------- per-lesson activity ledger');
  vm.runInContext(src.slice(0, cut > 0 ? cut : src.length), ctx);
  // `let project` / `let state` are lexical bindings, so they are not properties of the context.
  // Pull them out by evaluating an expression inside it.
  /* SCHEMA comes out with them. These assertions are about the plumbing — that a new save is
     stamped, and that an old one is migrated up to whatever the current version is — not about
     what today's number happens to be. Hardcoding `1` meant the first schema bump failed the suite
     for no reason, which trains people to edit the check rather than read it. */
  const got = vm.runInContext('({ project: project, state: state, schema: SCHEMA })', ctx);
  return { project: got.project, state: got.state, schema: got.schema, store: store };
}

console.log('--- fresh install ---');
{
  const { project, state, schema } = load({});
  check('new project is stamped at the current version', project.v, schema.project);
  check('new progress is stamped at the current version', state.v, schema.progress);
  checkTrue('new project has the starter files', typeof project.files['game.js'] === 'string');
}

console.log('\n--- an existing save from before versioning ---');
{
  const legacy = JSON.stringify({ files: { 'game.js': '// mine', 'config.js': '// cfg' }, order: ['game.js', 'config.js'] });
  const legacyProgress = JSON.stringify({ xp: 900, stars: 12, done: { '0.0': true } });
  const { project, state, store, schema } = load({ leagueProject: legacy, leagueProgress: legacyProgress });
  check('un-numbered project is adopted, not replaced', project.files['game.js'], '// mine');
  check('...and stamped to the current version', project.v, schema.project);
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

console.log('\n--- storage the browser refuses to use ---');
{
  // Some school-managed browsers expose localStorage and then throw on every call. The app has to
  // stay usable: work in memory, and say so, rather than fail to start.
  const dead = { getItem: () => { throw new Error('blocked'); },
                 setItem: () => { throw new Error('blocked'); },
                 removeItem: () => { throw new Error('blocked'); } };
  const sandbox = { localStorage: dead, console: { warn(){}, log(){}, error(){} },
                    window: {}, document: { getElementById: () => null },
                    renderFooter(){}, saveState(){} };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'events.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'storage.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'starter-code.js'), 'utf8'), ctx);
  const src = fs.readFileSync(path.join(SRC, 'project.js'), 'utf8');
  const cut = src.indexOf('/* ---------- per-lesson activity ledger');
  let threw = null;
  try { vm.runInContext(src.slice(0, cut > 0 ? cut : src.length), ctx); } catch (e) { threw = e.message; }
  check('the app still starts when storage is blocked', threw, null);
  const got = vm.runInContext('({ project: project, persistent: Storage.persistent })', ctx);
  checkTrue('...with a working project', typeof got.project.files['game.js'] === 'string');
  check('...and it knows saving will not stick', got.persistent, false);
  const roundTrip = vm.runInContext("Storage.write('k','v'), Storage.read('k')", ctx);
  check('...and still remembers things for this session', roundTrip, 'v');
}

console.log('\n--- storage that is full ---');
{
  // setItem throwing used to reach nobody, so a student kept working on a game that had silently
  // stopped saving. It must report, and it must not delete anything to make room.
  let allow = true;
  const map = {};
  const full = { getItem: (k) => (k in map ? map[k] : null),
                 setItem: (k, v) => { if (!allow && k !== '__league_probe__') { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } map[k] = String(v); },
                 removeItem: (k) => { delete map[k]; } };
  const sandbox = { localStorage: full, console: { warn(){}, log(){}, error(){} },
                    window: {}, document: { getElementById: () => null },
                    renderFooter(){}, saveState(){} };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'events.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'storage.js'), 'utf8'), ctx);
  vm.runInContext("Storage.write('keepme','precious')", ctx);
  vm.runInContext('var reported = 0; onStorageFailure(function(){ reported++; });', ctx);
  allow = false;
  const ok = vm.runInContext("Storage.write('leagueProject','{}')", ctx);
  check('a full disk reports the write failed', ok, false);
  check('...and tells the app once', vm.runInContext('reported', ctx), 1);
  check('...and destroys nothing to make room', vm.runInContext("Storage.read('keepme')", ctx), 'precious');
  check('...and still serves the value this session', vm.runInContext("Storage.read('leagueProject')", ctx), '{}');
}

console.log('\n' + (failures ? failures + ' failing' : 'all state checks pass'));
process.exit(failures ? 1 : 0);
