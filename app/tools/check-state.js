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
  /* This blob has no `v` at all, so it enters the walk at v0 — which makes it the regression test
     for the explicit `0:` no-op step in MIGRATIONS.progress. Without that step migrate() treats a
     missing step as "shape unchanged" and stamps straight to the target, carrying the oldest saves
     past the re-key below without running it. If someone deletes that step, this line fails. */
  check('...and its completed lessons, re-keyed to the lesson they were about',
    state.done, { 'what-an-engine-does': true });
  check('...and gains keys added since it was written', state.activities, {});
  check('nothing was quarantined', store.keys().filter(k => k.includes('.broken.')).length, 0);
}

console.log('\n--- progress from before the course was reordered ---');
{
  /* Every position-keyed shape at once. The point of the re-key is that a tick means "this student
     finished The Core Loop", not "this student finished whatever is fifth" — so each assertion below
     names the lesson, and would fail if a record had been left on its old seat. */
  const v1 = JSON.stringify({
    v: 1, xp: 2400, stars: 310,
    done: { '1.0': true, '4.3': true },
    activities: { '2.1': { q0: true, r1: true } },
    labs: { '2.1:c0': { code: '// mine', revealed: true } },
    practice: { '4.2:y0': { passed: true, snap: { 'game.js': '// before' } } },
    modDone: { '0': true, '2': true },
    badges: { 'Bug Hunter badge': { at: 1700000000000, lesson: '2.4' } },
    at: '3.0', weekXp: 40, weekStart: 1700000000000,
    published: [{ name: 'My Game', date: 1700000000000 }], unlocked: { 'coin-gold': true }
  });
  const { state, store, schema } = load({ leagueProgress: v1 });
  check('done is keyed by the lesson', state.done, { 'the-core-loop': true, 'ship-it': true });
  check('activities move with their lesson, inner keys untouched',
    state.activities, { 'decisions-and-repeats': { q0: true, r1: true } });
  // Only the half before the FIRST colon is a lesson; the widget key has to survive intact.
  check('a lab draft keeps its widget key', state.labs,
    { 'decisions-and-repeats:c0': { code: '// mine', revealed: true } });
  check('a practice snapshot keeps its widget key and its contents', state.practice,
    { 'juice:y0': { passed: true, snap: { 'game.js': '// before' } } });
  // modDone is what stops the star award firing a second time, so a wrong key here costs stars.
  check('modDone is keyed by the module', state.modDone, { engines: true, phaser: true });
  check('a badge points at the lesson that awarded it', state.badges['Bug Hunter badge'].lesson, 'reading-an-error');
  check('the resume point is a lesson', state.at, 'game-state');
  check('XP and stars are untouched', [state.xp, state.stars], [2400, 310]);
  check('everything not keyed by position is untouched',
    [state.weekXp, state.published[0].name, state.unlocked['coin-gold']], [40, 'My Game', true]);
  check('it is stamped to the current version', state.v, schema.progress);
  check('nothing was quarantined', store.keys().filter(k => k.includes('.broken.')).length, 0);
}

console.log('\n--- the re-key does not destroy what it does not recognise ---');
{
  /* A key the table has never heard of is far more likely a lesson added after the table was frozen
     than it is a mistake. Dropping it would delete a finished lesson to tidy a namespace. */
  const v1 = JSON.stringify({ v: 1, done: { '9.9': true, 'some-future-lesson': true }, at: 'juice' });
  const { state } = load({ leagueProgress: v1 });
  check('an unrecognised key survives under its own name',
    state.done, { '9.9': true, 'some-future-lesson': true });
  // `at` is looked up rather than transformed, so a value that is already a slug passes through.
  check('a resume point that is already a lesson id is left alone', state.at, 'juice');
}

console.log('\n--- the re-key is idempotent ---');
{
  /* Feed the migration its own output back in, labelled v1. It must be a no-op: a slug is not a key
     in the table, so a second pass changes nothing. This is what makes a failed write safe — the
     migration runs again on the next boot rather than mangling what it already converted. */
  const twice = JSON.stringify({
    v: 1,
    done: { 'the-core-loop': true }, activities: { 'juice': { q0: true } },
    labs: { 'juice:c0': { code: '// x' } }, modDone: { engines: true }, at: 'ship-it'
  });
  const { state } = load({ leagueProgress: twice });
  check('a second pass changes nothing',
    [state.done, state.activities, state.labs, state.modDone, state.at],
    [{ 'the-core-loop': true }, { 'juice': { q0: true } }, { 'juice:c0': { code: '// x' } },
     { engines: true }, 'ship-it']);
}

console.log('\n--- a project from before it had somewhere to write ---');
{
  /* design.md is the student's one-sheet. An existing project has to GAIN it, and a project that
     already has one must keep whatever the student wrote — a migration that overwrote it would
     destroy the only file in the project you cannot get back by reading the starter. */
  const v2 = JSON.stringify({ v: 2, files: { 'game.js': '// mine', 'config.js': '// cfg' }, order: ['game.js', 'config.js'], assets: [] });
  const { project, schema } = load({ leagueProject: v2 });
  checkTrue('an older project gains design.md', typeof project.files['design.md'] === 'string');
  check('...at the front of the file tree, where they will look for it', project.order[0], 'design.md');
  check('...and its own code is untouched', project.files['game.js'], '// mine');
  check('...and it is stamped to the current version', project.v, schema.project);

  const mine = JSON.stringify({ v: 2, files: { 'game.js': '// g', 'design.md': '# my idea\n\nA ghost game.' }, order: ['game.js', 'design.md'], assets: [] });
  const second = load({ leagueProject: mine });
  check('a design doc that already exists is never overwritten',
    second.project.files['design.md'], '# my idea\n\nA ghost game.');
  check('...and is not listed twice',
    second.project.order.filter(function (n) { return n === 'design.md'; }).length, 1);
}

console.log('\n--- notes are not code ---');
{
  /* Everything that walks the project used to assume every file was JavaScript: the game runner
     wraps each one in a <script>, the linter checks each one, the `parses:` practice rule parses
     each one. One helper answers "is this code?" so those cannot disagree — a file the runner skips
     but the checker parses would report a syntax error in a child's game idea. */
  const { store } = load({});
  const ctxCheck = (expr) => {
    const sandbox = { localStorage: makeStore({}), console: { warn(){}, log(){}, error(){} },
                      window: {}, document: { getElementById: () => null },
                      renderFooter(){}, saveState(){} };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(SRC, 'events.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(SRC, 'storage.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(SRC, 'starter-code.js'), 'utf8'), ctx);
    const src = fs.readFileSync(path.join(SRC, 'project.js'), 'utf8');
    const cut = src.indexOf('/* ---------- per-lesson activity ledger');
    vm.runInContext(src.slice(0, cut > 0 ? cut : src.length), ctx);
    return vm.runInContext(expr, ctx);
  };
  check('.js is code', ctxCheck("[isCodeFile('game.js'), isCodeFile('enemy.js')]"), [true, true]);
  check('.md is not', ctxCheck("[isCodeFile('design.md'), isCodeFile('notes.md')]"), [false, false]);
  check('a new project ships the design doc', ctxCheck("typeof project.files['design.md']"), 'string');
  check('...and the runner is never handed it',
    ctxCheck("codeFileNames().indexOf('design.md')"), -1);
  check('...while every starter script still is',
    ctxCheck("codeFileNames().sort()"),
    ['coins.js', 'config.js', 'game.js', 'main.js', 'player.js', 'world.js']);
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
