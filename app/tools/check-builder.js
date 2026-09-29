/* check-builder.js — the studio's Builder (V2), checked end to end against a fake model.
 *
 * The Builder is the one AI in the studio that changes a kid's real code, in front of a class, with
 * nobody reading a diff first. So the two halves of it are checked here, in the shape
 * check-coder.js uses for V1's coder:
 *
 *   THE SERVER (routes/ai.js, the BUILDER branch). The real server, spawned, pointed at a fake
 *   Ollama that says exactly what each scenario scripts. What comes back is what the browser would
 *   apply: a good edit applies and compiles; a find that is missing or ambiguous costs ONE retry and
 *   then an honest hold; a syntax break, an invented Phaser API, an unregistered key or an invented
 *   picture is refused; part ops are cleaned; a claim with nothing behind it is not a change; `base`
 *   is always the hash of the code that was sent. And the mentor passes `build` and `hero` through.
 *
 *   THE BROWSER (studio/builder.js), in jsdom, with Project, Runner, Editor and UI stubbed: a good
 *   answer is applied and the game remounted; an answer about code that changed meanwhile is not
 *   applied; a frame that errors after the change is put back; Undo puts a build back. jsdom does
 *   not run the real game frame (CLAUDE.md), so the stubbed Runner plays the frame's part: it says
 *   'ready', or says 'error', or says nothing at all.
 *
 * The counts matter as much as the answers: a request that spends three model calls is a request
 * that runs out of its budget before the kid sees anything.
 *
 * Run: node app/tools/check-builder.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/* Same reason check-coder.js reads it: this has to sign in, and when the testing door is configured
   the password it needs is in .env. */
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* dotenv is optional, exactly as in server.js */ }

const ROOT = path.join(__dirname, '..');
const PORT = process.env.BUILDER_TEST_PORT || 3996;

let failures = 0;
function check(name, ok, detail) {
  if (ok) { console.log('PASS  ' + name + (detail ? '  — ' + detail : '')); }
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

/* The same hash as routes/ai.js codeHash and studio/builder.js hash, written out a third time on
   purpose: if either of the other two drifts, this one is the witness. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}

/* ---------- the fake provider ----------
   Ollama-shaped, scripted, ALWAYS 200 (a non-2xx makes provider.js retry without `think`, which
   would double the call count this file measures). Running out of script is `overran`. */
let queue = [], calls = [], overran = 0;
const fake = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (d) { raw += d; });
  req.on('end', function () {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { /* recorded as a call either way */ }
    const msgs = body.messages || [];
    calls.push({
      tools: !!(body.tools && body.tools.length),
      system: String((msgs[0] || {}).content || ''),
      last: String((msgs[msgs.length - 1] || {}).content || '')
    });
    let next = queue.shift();
    if (next === undefined) { overran++; next = '{"reply":"the fake ran out of scripted answers","edits":[],"parts":[]}'; }
    if (typeof next !== 'string') next = JSON.stringify(next);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: body.model || 'fake', message: { role: 'assistant', content: next }, done: true }));
  });
});

let server = null, out = '', serverErr = '';
function startServer(fakePort) {
  server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      AI_PROVIDER: 'ollama',
      OLLAMA_URL: 'http://127.0.0.1:' + fakePort + '/api/chat',
      CODER_MODEL: 'ollama:fake',      // the Builder rides on the coder's model (ai/models.js)
      TUTOR_MODEL: 'ollama:fake',      // and the mentor on the tutor's
      CLASS_CODE: process.env.CLASS_CODE || 'CHECKBUILDER'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', function (d) { out += d; });
  server.stderr.on('data', function (d) { serverErr += d; });
}
function done(code) {
  try { server && server.kill(); } catch (e) {}
  try { fake.close(); } catch (e) {}
  process.exit(code);
}
function waitForServer(url, tries) {
  return fetch(url).catch(function () {
    if (tries <= 0) throw new Error('server did not start');
    return new Promise(function (r) { setTimeout(r, 200); }).then(function () { return waitForServer(url, tries - 1); });
  });
}

/* ---- get past the front door ---- (check-coder.js does the same, for the same reason) */
let COOKIE = '';
function readSession(r) {
  const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')];
  return (raw || []).filter(Boolean).map(function (c) { return String(c).split(';')[0]; })
    .filter(function (c) { return c.indexOf('league_session=') === 0; })[0] || '';
}
function signIn() {
  const base = 'http://localhost:' + PORT;
  return fetch(base + '/auth/me').then(function (r) { return r.json(); }).then(function (me) {
    if (me && me.testers) {
      return fetch(base + '/auth/testers', {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: 'checkbuilder', password: process.env.TESTER_PASSWORD || '', next: '/' }).toString()
      }).then(function (r2) {
        COOKIE = readSession(r2);
        check('signed in through the testing door', !!COOKIE,
          COOKIE ? 'session cookie set' : 'no cookie — does TESTER_PASSWORD match the running server?');
      });
    }
    return fetch(base + '/auth/codeserver', { redirect: 'manual' }).then(function (r2) {
      COOKIE = readSession(r2);
      check('signed in through the local door', !!COOKIE, COOKIE ? 'session cookie set' : 'no cookie — is BYPASS off?');
    });
  });
}

/* A kid's game, in V2's shape (one class-based scene talking to the Studio bridge), small on purpose.
   `this.made` appears twice, which is what the ambiguous-find scenario leans on. */
const GAME = [
  'class Level extends Phaser.Scene {',
  "  constructor() { super('Level'); }",
  '  create() {',
  '    this.made = {};',
  '    Studio.parts.forEach(p => this.build(p));',
  "    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,SPACE');",
  '  }',
  '  build(p) {',
  "    if (p.kind === 'coin') this.made[p.id] = p.spots.map(([x, y]) => this.makeCoin(p, x, y));",
  '  }',
  '  makeCoin(p, x, y) {',
  '    const coin = this.add.circle(x, y, 15 * p.size, 0xc4c4c4);',
  '    this.physics.add.existing(coin, true);',
  '    return coin;',
  '  }',
  '  update() {',
  '    if (!Studio.playing) return;',
  "    Studio.event('tick');",
  '  }',
  '}',
  "new Phaser.Game({ type: Phaser.AUTO, width: 960, height: 540, scene: [Level] });"
].join('\n');
const PARTS = [
  { id: 'level', name: 'Level 1', kind: 'level', gravity: 1200, look: null },
  { id: 'player', name: 'Player', kind: 'player', x: 96, y: 420, speed: 240, jump: 600, look: null },
  { id: 'coins', name: 'Coins', kind: 'coin', spots: [[480, 400], [832, 400]], size: 1, look: null, sound: null }
];

function ask(message, extra) {
  return fetch('http://localhost:' + PORT + '/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: COOKIE },
    body: JSON.stringify(Object.assign({ agent: 'builder', message: message, code: GAME, parts: PARTS,
      kidSaid: message, studio: 'Stopped. Coins selected.' }, extra || {}))
  }).then(function (r) { return r.json().then(function (d) { d.__status = r.status; return d; }); });
}
function scenario(replies, message, extra) {
  queue = replies.slice(); calls = []; overran = 0;
  return ask(message, extra).then(function (d) { return { d: d, calls: calls.slice(), overran: overran }; });
}
function events(q) {
  return out.split('\n')
    .filter(function (l) { return l.indexOf('EVT ') === 0; })
    .map(function (l) { try { return JSON.parse(l.slice(4)); } catch (e) { return null; } })
    .filter(function (e) { return e && e.q === q; });
}

const SPIN = { find: '    return coin;',
  replace: '    this.tweens.add({ targets: coin, angle: 360, duration: 60000 / (p.spin ?? 90), repeat: -1 });\n    return coin;' };
function answer(reply, edits, parts, held) {
  return JSON.stringify({ reply: reply, edits: edits || [], parts: parts || [], held: held || null });
}

function runServerChecks() {
  /* ---------- 1. a good edit ---------- */
  return scenario([answer('Press Play: the coins spin now. Their Spin speed is in the Inspector.', [SPIN],
    [{ op: 'set', id: 'coins', key: 'spin', value: 90 }])], 'make the coins spin')
    .then(function (r) {
      console.log('\n--- a good edit ---');
      const d = r.d;
      check('the edit is applied to the code', typeof d.code === 'string' && d.code.indexOf('p.spin ?? 90') > 0, typeof d.code);
      check('and nothing else in the file moved', typeof d.code === 'string' && d.code.replace(SPIN.replace, SPIN.find) === GAME);
      check('the result compiles', (function () { try { new (require('vm').Script)(d.code); return true; } catch (e) { return false; } })());
      check('base is the hash of the code that was sent', d.base === hash(GAME), d.base + ' vs ' + hash(GAME));
      check('edits counts the edits', d.edits === 1, String(d.edits));
      check('the part op comes back', JSON.stringify(d.parts) === JSON.stringify([{ op: 'set', id: 'coins', key: 'spin', value: 90 }]), JSON.stringify(d.parts));
      check('the reply is the model\'s', /coins spin now/.test(d.reply), d.reply);
      check('not held', d.held === null, String(d.held));
      check('one model call', r.calls.length === 1, r.calls.length + ' calls');
      check('with no tools offered', r.calls.length === 1 && !r.calls[0].tools);
      check('the prompt carries the code and the parts', r.calls.length === 1
        && r.calls[0].system.indexOf("this.add.circle(x, y, 15 * p.size") > 0 && r.calls[0].system.indexOf('"id":"coins"') > 0);

      /* ---------- 2. a find that is missing, twice ---------- */
      return scenario([
        answer('The coins spin now!', [{ find: 'const coin = this.add.circle(x, y, 20);', replace: 'x' }]),
        answer('The coins spin now!', [{ find: 'const coin = this.add.circle(x, y, 20);', replace: 'x' }])
      ], 'make the coins wobble');
    })
    .then(function (r) {
      console.log('\n--- a missing find, held after one retry ---');
      check('one retry, then it stops', r.calls.length === 2, r.calls.length + ' calls');
      check('the retry names the find that failed', r.calls.length === 2 && /does not appear in the code/.test(r.calls[1].last));
      check('nothing is changed', r.d.code === null && r.d.parts.length === 0 && r.d.edits === 0);
      check('the kid is told plainly', /couldn’t find the right spot/.test(r.d.reply), r.d.reply);
      check('and is not told it worked', !/spin now/.test(r.d.reply), r.d.reply);
      check('base is still sent', r.d.base === hash(GAME));

      /* ---------- 3. an ambiguous find, fixed on the retry ---------- */
      return scenario([
        answer('Done', [{ find: 'this.made', replace: 'this.madeThings' }]),
        answer('Press Play: the coins are bigger.', [{ find: '15 * p.size', replace: '20 * p.size' }])
      ], 'make the coins bigger in code');
    })
    .then(function (r) {
      console.log('\n--- an ambiguous find, corrected ---');
      check('the retry says it appeared twice', r.calls.length === 2 && /appears 2 times/.test(r.calls[1].last), r.calls.length + ' calls');
      check('the corrected edit is applied', typeof r.d.code === 'string' && r.d.code.indexOf('20 * p.size') > 0);

      /* ---------- 4. a syntax break ---------- */
      const BREAK = { find: '    return coin;', replace: '    return coin;\n  }}}' };
      return scenario([answer('Spinning!', [BREAK]), answer('Spinning!', [BREAK])], 'make them spin faster');
    })
    .then(function (r) {
      console.log('\n--- an edit that would not compile ---');
      check('refused', r.d.code === null, typeof r.d.code);
      check('after one retry', r.calls.length === 2, r.calls.length + ' calls');
      check('the retry quotes the compile error', r.calls.length === 2 && /does not compile/.test(r.calls[1].last));
      check('the kid hears it would have stopped the game', /stop your game from running/.test(r.d.reply), r.d.reply);

      /* ---------- 5. an invented picture, and then a real one ---------- */
      const FAKE_ART = { find: '    return coin;', replace: "    coin.art = '/assets/platformer/dragon_made_up.png';\n    return coin;" };
      return scenario([answer('A dragon coin!', [FAKE_ART]), answer('A dragon coin!', [FAKE_ART])], 'make the coins dragons');
    })
    .then(function (r) {
      console.log('\n--- an invented asset path ---');
      check('refused', r.d.code === null, typeof r.d.code);
      check('the kid hears the studio has no such file', /picture or sound file/.test(r.d.reply), r.d.reply);
      const REAL = fs.existsSync(path.join(ROOT, 'public', 'assets', 'platformer', 'coin_gold.png'));
      if (!REAL) { console.log('NOTE  skipping the real-path check: coin_gold.png is not on disk'); return null; }
      return scenario([answer('Gold!', [{ find: '    return coin;', replace: "    coin.art = '/assets/platformer/coin_gold.png';\n    return coin;" }])], 'use the gold picture');
    })
    .then(function (r) {
      if (r) check('a path that is really on disk is allowed', typeof r.d.code === 'string' && r.calls.length === 1, r.calls.length + ' calls');

      /* ---------- 6. an unregistered key, and an invented Phaser API ---------- */
      const KEY = { find: "    Studio.event('tick');", replace: "    if (this.keys.SHIFT.isDown) Studio.event('dash');\n    Studio.event('tick');" };
      return scenario([answer('Hold Shift to dash.', [KEY]), answer('Hold Shift to dash.', [KEY])], 'add a dash on shift');
    })
    .then(function (r) {
      console.log('\n--- a key that is never registered ---');
      check('refused', r.d.code === null && r.calls.length === 2, r.calls.length + ' calls');
      check('the retry names the key', r.calls.length === 2 && /keys\.SHIFT/.test(r.calls[1].last));
      const CURVE = { find: '    return coin;', replace: '    const g = this.add.graphics(); g.bezierCurveTo(1, 2, 3, 4, 5, 6);\n    return coin;' };
      return scenario([answer('Curvy!', [CURVE]), answer('Curvy!', [CURVE])], 'draw a curve');
    })
    .then(function (r) {
      console.log('\n--- a Phaser API that does not exist ---');
      check('refused', r.d.code === null && r.calls.length === 2, r.calls.length + ' calls');
      check('the kid is not handed a method name', !/bezierCurveTo/.test(r.d.reply), r.d.reply);

      /* ---------- 7. part ops, cleaned ---------- */
      return scenario([answer('Press Play: there is a slime now.', [], [
        { op: 'set', id: 'ghost', key: 'speed', value: 3 },                       // unknown part
        { op: 'set', id: 'coins', key: 'spin', value: { fast: true } },           // not plain
        { op: 'set', id: 'coins', key: 'kind', value: 'enemy' },                  // may not change kind
        { op: 'set', id: 'coins', key: 'spots', value: [[100, 200], [300, 400]] }, // plain pairs: kept
        { op: 'add', part: { id: 'Slime 1', name: 'Slime', kind: 'enemy' } },     // bad id
        { op: 'add', part: { id: 'slime-1', name: 'Slime', kind: 'enemy', x: 600, speed: 80, brain: { a: 1 } } },
        { op: 'remove', id: 'player' },                                          // never the player
        { op: 'set', id: 'slime-1', key: 'distance', value: 120 }                // on the part just added
      ])], 'add a slime');
    })
    .then(function (r) {
      console.log('\n--- part ops, cleaned ---');
      const want = [
        { op: 'set', id: 'coins', key: 'spots', value: [[100, 200], [300, 400]] },
        { op: 'add', part: { id: 'slime-1', name: 'Slime', kind: 'enemy', x: 600, speed: 80 } },
        { op: 'set', id: 'slime-1', key: 'distance', value: 120 }
      ];
      check('only the good ops survive, in order', JSON.stringify(r.d.parts) === JSON.stringify(want), JSON.stringify(r.d.parts));
      check('the code is untouched, and says so', r.d.code === null && r.d.edits === 0);
      check('no retry for a cleaned op', r.calls.length === 1, r.calls.length + ' calls');

      /* ---------- 8. a claim with nothing behind it ---------- */
      return scenario([answer('Done! The hero can double jump now.'), answer('I’ve added a double jump.')], 'let the hero double jump');
    })
    .then(function (r) {
      console.log('\n--- a claim with no edits ---');
      check('one retry', r.calls.length === 2, r.calls.length + ' calls');
      check('nothing changed', r.d.code === null && r.d.parts.length === 0);
      check('the claim does not reach the kid', !/double jump/.test(r.d.reply), r.d.reply);
      check('and the kid hears that nothing was sent', /didn’t manage to send a change/.test(r.d.reply), r.d.reply);

      /* ---------- 9. a question back is not a claim ---------- */
      return scenario([answer('Should the slime walk on the ground or fly?', [], [], 'question')], 'add a monster');
    })
    .then(function (r) {
      console.log('\n--- a question back ---');
      check('the question reaches the kid verbatim', r.d.reply === 'Should the slime walk on the ground or fly?', r.d.reply);
      check('held is reported', r.d.held === 'question', String(r.d.held));
      check('no retry', r.calls.length === 1, r.calls.length + ' calls');
      check('base and a null code', r.d.base === hash(GAME) && r.d.code === null);

      /* ---------- 10. Windows line endings in, base of what was sent ---------- */
      const CRLF = GAME.replace(/\n/g, '\r\n');
      return scenario([answer('Bigger coins.', [{ find: '15 * p.size', replace: '18 * p.size' }])], 'bigger coins', { code: CRLF })
        .then(function (r2) { r2.crlf = CRLF; return r2; });
    })
    .then(function (r) {
      console.log('\n--- CRLF code ---');
      check('base is the hash of the code exactly as sent', r.d.base === hash(r.crlf), r.d.base);
      check('the edit still applies', typeof r.d.code === 'string' && r.d.code.indexOf('18 * p.size') > 0);

      /* ---------- 11. the mentor passes `build` and `hero` through ---------- */
      return scenario([JSON.stringify({ reply: 'I’ll get the Builder on it.', choose: null, actions: [],
        build: '  Make the coins spin slowly, with a Spin setting.  ',
        hero: { body: 'dragon', color: 'green', belly: 'yellow', eyes: 'big', eyeColor: 'blue', extras: [{ kind: 'wings', color: 'red' }] } })],
      'make the coins spin', { agent: 'mentor' });
    })
    .then(function (r) {
      console.log('\n--- the mentor ---');
      check('build is passed through, trimmed', r.d.build === 'Make the coins spin slowly, with a Spin setting.', JSON.stringify(r.d.build));
      check('a hero object is passed through', !!r.d.hero && r.d.hero.body === 'dragon' && r.d.hero.extras[0].kind === 'wings', JSON.stringify(r.d.hero));
      return scenario([JSON.stringify({ reply: 'Hi!', choose: null, actions: [], hero: { body: 'x'.repeat(2000) } })],
        'my hero is huge', { agent: 'mentor' });
    })
    .then(function (r) {
      check('an oversized hero becomes null', r.d.hero === null, JSON.stringify(r.d.hero).slice(0, 40));
      check('and no build is null', r.d.build === null, JSON.stringify(r.d.build));
      return new Promise(function (res) { setTimeout(res, 300); });
    })
    .then(function () {
      console.log('\n--- what the session report will see ---');
      const gave = events('make the coins wobble').filter(function (e) { return e.ev === 'guard'; });
      check('a missing find is recorded, then recorded as a give-up',
        gave.length === 2 && gave[0].name === 'bad-find' && !gave[0].gaveUp && gave[1].gaveUp && gave[0].agent === 'builder',
        gave.map(function (e) { return e.name + (e.gaveUp ? ':gave-up' : ''); }).join(','));
      const asked = events('make the coins spin').filter(function (e) { return e.ev === 'ask' && e.agent === 'builder'; })[0];
      check('a builder turn that changed the game reports ops', !!asked && asked.ops === true, asked ? 'ops:' + asked.ops : 'no ask event');
      const cleaned = events('add a slime').filter(function (e) { return e.ev === 'guard' && e.name === 'bad-part'; });
      check('dropped part ops are recorded', cleaned.length === 1, cleaned.length ? cleaned[0].detail.slice(0, 80) : 'none');
    });
}

/* ---------- builder.js in jsdom ----------
   Real timers, so this half takes a few seconds: every good build waits out the 3s settle window. */
function runBrowserChecks() {
  let JSDOM;
  try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('NOTE  jsdom is not installed; skipping the builder.js checks'); return Promise.resolve(); }
  console.log('\n--- studio/builder.js, in jsdom ---');
  const dom = new JSDOM('<!doctype html><div id="stage"></div>', { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  /* The stubs. `w.T` is the test's handle on them: what the frame will do next, what was called. */
  w.eval([
    'var T = { frame: "ready", mounts: 0, sets: [], trees: 0, reply: null, status: 200, playing: false, stopped: 0 };',
    'var state = { code: "CODE-A", codeEdited: false, parts: [{ id: "level", kind: "level" }, { id: "coins", kind: "coin", size: 1 }] };',
    'var Project = { get: function () { return state; }, code: function () { return Promise.resolve(state.code); },',
    '  part: function (id) { return state.parts.filter(function (p) { return p.id === id; })[0] || null; },',
    '  clone: function (x) { return JSON.parse(JSON.stringify(x)); }, save: function () {} };',
    'var runnerFns = [];',
    'var Runner = { on: function (fn) { runnerFns.push(fn); }, frame: function () { return null; }, isPlaying: function () { return T.playing; },',
    '  mount: function (host, code, parts) { T.mounts++; T.lastMount = code;',
    '    return new Promise(function (res) {',
    '      if (T.frame === "ready") setTimeout(res, 20);',
    '      if (T.frame === "error") setTimeout(function () { res(); setTimeout(function () { runnerFns.forEach(function (f) { f("error", "boom"); }); }, 50); }, 20);',
    '      if (T.next) { T.frame = T.next; T.next = null; }',
    '    }); } };',
    'var Editor = { set: function (id, k, v) { T.sets.push([id, k, v]); Project.part(id)[k] = v; }, tree: function () { T.trees++; },',
    '  selected: function () { return null; }, inspect: function () {}, closeInspector: function () {}, togglePlay: function () { T.stopped++; T.playing = false; } };',
    'var UI = { muted: function () { return true; } };',
    'function fetch(url, opts) { T.body = JSON.parse(opts.body); var r = typeof T.reply === "function" ? T.reply(T.body) : T.reply;',
    '  return Promise.resolve({ status: T.status, json: function () { return Promise.resolve(r); } }); }'
  ].join('\n'));
  w.eval(fs.readFileSync(path.join(ROOT, 'public', 'studio', 'builder.js'), 'utf8'));
  const T = w.T, events = [];
  w.Builder.on(function (n, d) { events.push(n + (d ? ':' + d : '')); });
  const good = function (body) {
    return { reply: 'Press Play: the coins spin now.', code: body.code + '+SPIN', base: hash(body.code), edits: 1,
      parts: [{ op: 'set', id: 'coins', key: 'spin', value: 90 }, { op: 'add', part: { id: 'slime-1', name: 'Slime', kind: 'enemy' } }], held: null };
  };

  T.reply = good; T.playing = true;
  return w.Builder.ask('make the coins spin', { kidSaid: 'make the coins spin plz' }).then(function (r) {
    const st = w.Project.get();
    check('a good answer is applied', r.ok === true && st.code === 'CODE-A+SPIN' && st.codeEdited === true, JSON.stringify(r).slice(0, 120));
    check('the request carries the brief, the kid\'s words, the code and the parts',
      T.body.agent === 'builder' && T.body.message === 'make the coins spin' && T.body.kidSaid === 'make the coins spin plz'
      && T.body.code === 'CODE-A' && Array.isArray(T.body.parts));
    check('a set goes through Editor.set', T.sets.length === 1 && T.sets[0].join() === 'coins,spin,90', JSON.stringify(T.sets));
    check('an add lands in the parts and repaints the Hierarchy', !!w.Project.part('slime-1') && T.trees > 0);
    check('Play is stopped before the change goes in', T.stopped === 1);
    check('the game is remounted with the new code', T.mounts === 1 && T.lastMount === 'CODE-A+SPIN');
    check('it says building, then built', events.join('|') === 'building:make the coins spin|built:' + r.summary, events.join('|'));
    check('the change can be undone', w.Builder.canUndo() === true);

    /* The code changes while the Builder is thinking. */
    events.length = 0;
    T.reply = function (body) { w.Project.get().code = 'KID-EDITED'; return good(body); };
    return w.Builder.ask('make them faster');
  }).then(function (r) {
    check('an answer about code that changed meanwhile is not applied', r.ok === false && w.Project.get().code === 'KID-EDITED', r.reply);
    check('and says so', /changed while I was working/.test(r.reply), r.reply);

    /* A change the frame chokes on. */
    events.length = 0;
    w.Project.get().code = 'CODE-B';
    T.reply = good; T.frame = 'error'; T.next = 'ready';
    const partsBefore = JSON.stringify(w.Project.get().parts);
    return w.Builder.ask('make it explode').then(function (r) { r.partsBefore = partsBefore; return r; });
  }).then(function (r) {
    const st = w.Project.get();
    check('a change that errors is put back', r.ok === false && st.code === 'CODE-B' && JSON.stringify(st.parts) === r.partsBefore, st.code);
    check('and the kid is told honestly', /broke the game, so I put it back/.test(r.reply), r.reply);
    check('and the game is remounted on the old code', T.lastMount === 'CODE-B');
    check('it says reverted', events.some(function (e) { return e.indexOf('reverted:') === 0; }), events.join('|'));

    /* A server that refuses. */
    events.length = 0;
    T.status = 502; T.reply = { reply: 'The Builder isn’t answering right now, so nothing in your game changed.', code: null, parts: [] };
    return w.Builder.ask('make it rain');
  }).then(function (r) {
    check('a server error is reported, not pretended', r.ok === false && /isn’t answering/.test(r.reply) && w.Project.get().code === 'CODE-B', r.reply);
    check('it says failed', events.some(function (e) { return e.indexOf('failed:') === 0; }), events.join('|'));

    /* Undo puts the first build back. */
    T.status = 200;
    w.Project.get().code = 'CODE-A+SPIN';
    return w.Builder.undo();
  }).then(function (did) {
    check('Undo puts the last build back', did === true && w.Project.get().code === 'CODE-A' && !w.Project.part('slime-1'), w.Project.get().code);
    check('and there is nothing left to undo', w.Builder.canUndo() === false);
  });
}

/* A hung request would otherwise hang `npm test` with no explanation. */
const bail = setTimeout(function () {
  console.error('check-builder timed out after 120s');
  if (serverErr) console.error(serverErr.slice(0, 800));
  done(1);
}, 120000);

new Promise(function (r) { fake.listen(0, '127.0.0.1', function () { r(fake.address().port); }); })
  .then(function (fakePort) {
    startServer(fakePort);
    return waitForServer('http://localhost:' + PORT + '/api/lessons', 40);
  })
  .then(signIn)
  .then(runServerChecks)
  .then(runBrowserChecks)
  .then(function () {
    clearTimeout(bail);
    console.log('\n' + (failures
      ? failures + ' check(s) failed — the Builder could change a kid\'s game in a way it should not'
      : 'the Builder changes the game only when the change is real, and puts it back when it is not'));
    done(failures ? 1 : 0);
  })
  .catch(function (e) {
    clearTimeout(bail);
    console.error('check-builder could not run: ' + e.message + '\n' + (e.stack || ''));
    if (serverErr) console.error(serverErr.slice(0, 800));
    done(1);
  });
