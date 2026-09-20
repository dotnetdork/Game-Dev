/* check-coder.js — what the Build helper actually SENDS to a child, checked end to end.
 *
 * Nothing in this suite posted to /api/ai. check-guards.js proves the detectors are right about a
 * string; check-boot.js proves the app comes up. Between them sat the whole coder branch — the
 * fallbacks, the corrective guards, the sentence that ends up in the chat bubble — and the one
 * failure every beta tester reported lived exactly there: the builder says "Done." and the game is
 * unchanged. A pure-function check cannot catch that, because "Done." was never the model's word.
 * It was this app's.
 *
 * So this one runs the real server against a FAKE provider. The fake is scripted: each scenario
 * hands it the exact replies a model would give, and the check reads what the student would see.
 * It also counts the calls, which is the other half of the story — a request that spends five model
 * calls to arrive at a canned sentence is a request that times out on Vercel before it arrives at
 * anything.
 *
 * Run: node app/tools/check-coder.js
 */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

/* Same reason check-boot.js reads it: this has to sign in, and when the testing door is configured
   the password it needs is in .env. */
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* dotenv is optional, exactly as in server.js */ }

const ROOT = path.join(__dirname, '..');
const PORT = process.env.CODER_TEST_PORT || 3997;

let failures = 0;
function check(name, ok, detail) {
  if (ok) { console.log('PASS  ' + name + (detail ? '  — ' + detail : '')); }
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

/* ---------- the fake provider ----------
   An Ollama endpoint that says whatever the scenario told it to say, in order.

   ALWAYS 200, even when it has run out of script. A non-2xx makes chatOnce retry the same request
   without `think` (provider.js), which would double the call count and quietly break the one thing
   this file measures. Running out is reported as `overran` instead.

   Each call records what the SERVER asked for, which is how the round-0 shortcut is proved: a body
   carrying `tools` is the lookup phase, a body carrying `format: 'json'` is the extra final call
   that the shortcut is supposed to make unnecessary.

   A scripted answer is either a string (the model's reply) or `{ tool: 'name' }`, which makes the
   fake ask for a lookup instead of answering — that is how the "ran out of rounds" failure is
   reproduced without a model. `tool_calls[].function.arguments` is an OBJECT on this path, which is
   what provider.js reads. */
let queue = [], calls = [], overran = 0;
const fake = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (d) { raw += d; });
  req.on('end', function () {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { /* recorded as a call either way */ }
    const msgs = body.messages || [];
    const lastText = JSON.stringify((msgs[msgs.length - 1] || {}).content || '');
    calls.push({
      tools: !!(body.tools && body.tools.length),
      json: body.format === 'json',
      /* Whether this call was TOLD it was the last one. The fps-counter bug was the absence of
         exactly this sentence. */
      toldToAnswer: /no more lookups/i.test(lastText)
    });
    let next = queue.shift();
    if (next === undefined) { overran++; next = '{"reply":"the fake ran out of scripted answers"}'; }
    const toolCalls = (next && next.tool)
      ? [{ id: 'c' + calls.length, function: { name: next.tool, arguments: { query: 'anything' } } }]
      : [];
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      model: body.model || 'fake',
      message: { role: 'assistant', content: toolCalls.length ? '' : next, tool_calls: toolCalls },
      done: true
    }));
  });
});

/* ---------- the real server, pointed at the fake ----------
   The spawn env beats .env — dotenv does not override what is already set — so these five decide
   the provider however this machine happens to be configured.
   stdout is CAPTURED rather than ignored, unlike check-boot: telemetry is `EVT ` JSON lines on
   stdout (telemetry.js), so the guard and ask events are assertable here too. */
let server = null, out = '', serverErr = '';
function startServer(fakePort) {
  server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      AI_PROVIDER: 'ollama',
      OLLAMA_URL: 'http://127.0.0.1:' + fakePort + '/api/chat',
      CODER_MODEL: 'ollama:fake',
      CODER_TOOLS: '1'
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

/* ---- get past the front door ---- (the same two doors check-boot.js handles, and for the same
   reason: a developer with TESTER_PASSWORD in .env has the local bypass switched off, and a local
   sign-in setting must not decide whether the suite passes) */
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
        body: new URLSearchParams({ username: 'checkcoder', password: process.env.TESTER_PASSWORD || '', next: '/' }).toString()
      }).then(function (r2) {
        COOKIE = readSession(r2);
        check('signed in through the testing door', !!COOKIE,
          COOKIE ? 'session cookie set' : 'no cookie — does TESTER_PASSWORD match the running server?');
      });
    }
    return fetch(base + '/auth/codeserver', { redirect: 'manual' }).then(function (r2) {
      COOKIE = readSession(r2);
      check('signed in through the local door', !!COOKIE,
        COOKIE ? 'session cookie set' : 'no cookie — is BYPASS off?');
    });
  });
}

/* A student's game, small on purpose: the prompt carries it and the guards compare against it. */
const GAME = [
  'const CONFIG = { speed: 200, jumpPower: 400 };',
  'function create() {',
  "  scene.player = scene.physics.add.sprite(100, 100, 'hero');",
  '}'
].join('\n');

function ask(message, extra) {
  return fetch('http://localhost:' + PORT + '/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: COOKIE },
    body: JSON.stringify(Object.assign({
      agent: 'coder', message: message, code: GAME,
      lessonTitle: 'Checking the builder',
      ownedAssets: [],          // an ARRAY, or the asset guard is skipped entirely
      files: []
    }, extra || {}))
  }).then(function (r) {
    return r.json().then(function (d) { d.__status = r.status; return d; });
  });
}
/* One scenario: script the fake, send one student message, hand back what came out and what it
   cost. `calls` is reset per scenario so "exactly two calls" means exactly two. */
function scenario(replies, message, extra) {
  queue = replies.slice(); calls = []; overran = 0;
  return ask(message, extra).then(function (d) {
    return { d: d, calls: calls.slice(), overran: overran };
  });
}

/* Telemetry for one question, straight off the server's stdout. */
function events(q) {
  return out.split('\n')
    .filter(function (l) { return l.indexOf('EVT ') === 0; })
    .map(function (l) { try { return JSON.parse(l.slice(4)); } catch (e) { return null; } })
    .filter(function (e) { return e && e.q === q; });
}

const BAD_API_OPS = 'const g = scene.add.graphics(); g.bezierCurveTo(1, 2, 3, 4, 5, 6);';

function run() {
  /* ---------- 1. "Done." twice ----------
     The reported failure, exactly. The model says the word, the app used to print it, and the game
     is untouched. Two things have to be true now: the student is told plainly that nothing changed,
     and the request cost two model calls rather than four. */
  return scenario(['{"reply":"Done."}', '{"reply":"Done."}'], 'make the player jump higher')
    .then(function (r) {
      console.log('\n--- "Done." with nothing behind it ---');
      const reply = String(r.d.reply || '');
      check('the student is not shown "Done."', reply.trim() !== 'Done.' && reply.length > 20, reply.slice(0, 70));
      check('the reply says nothing changed', /didn.t actually change anything/i.test(reply), reply.slice(0, 70));
      check('the game is left alone', r.d.ops === null, JSON.stringify(r.d.ops));
      check('it cost two model calls, not four', r.calls.length === 2, r.calls.length + ' calls');

      /* ---------- 2. it cannot be done, and the model says why ----------
         The retry prompt asks for exactly this answer. It used to be thrown away. */
      return scenario([
        '{"reply":"I made it curve!","create":' + JSON.stringify(BAD_API_OPS) + '}',
        '{"reply":"Phaser can\'t draw curves that way, but I can make it move in a straight line — want that?","held":"blocked"}'
      ], 'make the platform curve');
    })
    .then(function (r) {
      console.log('\n--- the model explains, and the explanation survives ---');
      check('the model\'s own words reach the student',
        r.d.reply === "Phaser can't draw curves that way, but I can make it move in a straight line — want that?",
        String(r.d.reply).slice(0, 80));
      check('nothing was applied', r.d.ops === null);
      check('the deliberate hold is reported', r.d.held === 'blocked', String(r.d.held));

      /* ---------- 3. it insists, and is held — with its reasoning kept ----------
         The give-up path. The app adds a line naming the API; it no longer replaces the answer. */
      return scenario([
        '{"reply":"Here is the curve you asked for.","create":' + JSON.stringify(BAD_API_OPS) + '}',
        '{"reply":"That is the only way I know to draw it.","create":' + JSON.stringify(BAD_API_OPS) + '}'
      ], 'draw a curved path');
    })
    .then(function (r) {
      console.log('\n--- held after one retry ---');
      const reply = String(r.d.reply || '');
      check('the model\'s explanation is still there', /only way I know/.test(reply), reply.slice(0, 60));
      check('the app names the API it refused', /bezierCurveTo/.test(reply), reply.slice(-80));
      check('nothing was applied', r.d.ops === null);
      check('one retry, not four', r.calls.length === 2, r.calls.length + ' calls');

      /* ---------- 3b. a real answer that trips the widened check ----------
         THE REGRESSION THIS PAIR EXISTS FOR. "the counter is now showing 130" is a good answer to a
         good question, and it matches CLAIMS_A_CHANGE by text alone. The model did not set `held`,
         so the guard fires and the retry happens — and the reply the student reads must still be
         the model's, with the app's correction in front of it, not instead of it. */
      return scenario([
        '{"reply":"The counter reads scene.game.loop.actualFps, which is now showing 130 because the cap is not applied yet."}',
        '{"reply":"The counter reads scene.game.loop.actualFps, which is now showing 130 because the cap is not applied yet."}'
      ], 'we capped the fps but the counter still shows 130');
    })
    .then(function (r) {
      console.log('\n--- a good answer the guard could not tell from a claim ---');
      check("the model's answer still reaches the student",
        /counter reads scene\.game\.loop\.actualFps/.test(String(r.d.reply)), String(r.d.reply).slice(-60));
      check('and the app says plainly that nothing changed',
        /nothing in your game actually changed/i.test(String(r.d.reply)), String(r.d.reply).slice(0, 60));
      check('the correction comes first',
        String(r.d.reply).indexOf('Heads up') === 0, String(r.d.reply).slice(0, 20));

      /* ---------- 4. plain prose ----------
         The model answered in English instead of JSON. That is a conversation, not a failure, and
         it must survive intact. */
      return scenario(['Which platform — the left one or the top?', 'Which platform — the left one or the top?'],
        'make it cooler');
    })
    .then(function (r) {
      console.log('\n--- an answer that was never JSON ---');
      check('prose reaches the student unchanged', r.d.reply === 'Which platform — the left one or the top?',
        String(r.d.reply).slice(0, 60));
      check('nothing was applied', r.d.ops === null);
      check('it did not go round again', r.calls.length <= 2, r.calls.length + ' calls');

      /* ---------- 5. a real change, described in the phrasing the guard now catches ----------
         "There's an extra coin now" is the prompt's own worked example. The widened check must not
         fire on it when the change is actually there — and this is also where the round-0 shortcut
         shows up: one call, with tools, and no second call asking the same thing again. */
      return scenario(['{"reply":"There\'s an extra coin now.","config":{"speed":300}}'], 'make it faster');
    })
    .then(function (r) {
      console.log('\n--- a change that describes itself ---');
      check('the change is applied', r.d.ops && r.d.ops.config && r.d.ops.config.speed === 300, JSON.stringify(r.d.ops));
      check('the reply is untouched', r.d.reply === "There's an extra coin now.", String(r.d.reply));
      check('one model call, not two', r.calls.length === 1, r.calls.length + ' calls');
      check('that call was the tools round', r.calls.length === 1 && r.calls[0].tools === true);
      check('no second call in JSON mode', !r.calls.some(function (c) { return c.json; }),
        'the round-0 answer was used instead of being asked for again');

      /* ---------- 6. a conversational reply that DESCRIBES the game ----------
         "your speed is now 200" trips the widened regex, and should: it is indistinguishable from a
         claim by text alone. `held` is the model saying it meant to change nothing, and it buys
         exactly one thing — skipping the retry. The event is still recorded. */
      return scenario(['{"reply":"Your speed is now 200 in config.js — want me to make it 300?","held":"question"}'],
        'how fast is my player');
    })
    .then(function (r) {
      console.log('\n--- a question back, not a claim ---');
      check('the question reaches the student verbatim',
        r.d.reply === 'Your speed is now 200 in config.js — want me to make it 300?', String(r.d.reply).slice(0, 70));
      check('nothing was applied', r.d.ops === null);
      check('the hold is reported', r.d.held === 'question', String(r.d.held));
      check('it did NOT spend a retry', r.calls.length === 1, r.calls.length + ' calls');

      /* ---------- 7. it used up every lookup and was still thinking ----------
         THE ONE A BETA TESTER HIT. Four rounds of tool calls exhaust the loop, so the final call
         happens because the rounds ran out rather than because the model finished — and it used to
         carry no sign of being the last word, so the model carried on narrating and the student
         read "I'll add the FPS counter…" and got no fps counter. */
      return scenario([
        { tool: 'search_phaser_docs' }, { tool: 'search_phaser_docs' },
        { tool: 'read_file' }, { tool: 'search_phaser_docs' },
        "Good, setOrigin exists on text objects. I'll add the FPS counter using create/update snippets in game.js.",
        '{"reply":"There is an fps counter in the top right now.","create":"scene.fpsText = scene.add.text(392, 8, \'\', { fontSize: \'12px\' }).setOrigin(1, 0);","update":"scene.fpsText.setText(Math.round(scene.game.loop.actualFps));"}'
      ], 'can you add an fps counter to the top right of the scene');
    })
    .then(function (r) {
      console.log('\n--- out of lookups, still mid-thought ---');
      check('the final call is told it IS the final call',
        r.calls.filter(function (c) { return c.toldToAnswer; }).length >= 1,
        r.calls.map(function (c, i) { return i + (c.toldToAnswer ? ':told' : ''); }).join(' '));
      check('the narration does not reach the student',
        !/I'll add the FPS counter/.test(String(r.d.reply)), String(r.d.reply).slice(0, 70));
      check('the change actually arrives', !!(r.d.ops && r.d.ops.create && r.d.ops.update),
        r.d.ops ? Object.keys(r.d.ops).join(',') : 'none');
      check('a promise with nothing behind it cost exactly one retry', r.calls.length === 6,
        r.calls.length + ' calls (4 lookups + the answer call + 1 retry)');

      /* ---------- 8. ops with no words ----------
         The browser writes "Changed speed to 300." from the ops themselves, which is better than
         anything the server could say. It used to send "Done." and lose that. */
      return scenario(['{"config":{"speed":300}}'], 'set the speed to 300');
    })
    .then(function (r) {
      console.log('\n--- a change the model did not describe ---');
      check('the change is applied', r.d.ops && r.d.ops.config && r.d.ops.config.speed === 300, JSON.stringify(r.d.ops));
      check('the server invents no sentence', r.d.reply === '', JSON.stringify(r.d.reply));

      /* The events the session report is built from. Read after everything, because stdout arrives
         on its own schedule. */
      return new Promise(function (res) { setTimeout(res, 300); });
    })
    .then(function () {
      console.log('\n--- what the session report will see ---');
      const held = events('how fast is my player');
      const asked = held.filter(function (e) { return e.ev === 'ask'; })[0];
      const guarded = held.filter(function (e) { return e.ev === 'guard'; });
      check('the ask event carries the reason nothing changed', !!asked && asked.held === 'question',
        asked ? String(asked.held) : 'no ask event');
      check('the skipped no-ops guard is still recorded',
        guarded.length === 1 && guarded[0].name === 'no-ops' && !guarded[0].gaveUp,
        guarded.map(function (e) { return e.name + (e.gaveUp ? ':gave-up' : ''); }).join(',') || 'none');
      const gaveUp = events('draw a curved path').filter(function (e) { return e.ev === 'guard' && e.gaveUp; });
      check('a held change is recorded as a give-up', gaveUp.length === 1 && gaveUp[0].name === 'bad-api',
        gaveUp.map(function (e) { return e.name; }).join(',') || 'none');
      const plain = events('make it faster').filter(function (e) { return e.ev === 'ask'; })[0];
      check('a turn that changed something reports no hold', !!plain && plain.ops === true && !plain.held,
        plain ? 'ops:' + plain.ops + ' held:' + plain.held : 'no ask event');
    });
}

/* A hung request would otherwise hang `npm test` with no explanation. */
const bail = setTimeout(function () {
  console.error('check-coder timed out after 90s');
  if (serverErr) console.error(serverErr.slice(0, 800));
  done(1);
}, 90000);

new Promise(function (r) { fake.listen(0, '127.0.0.1', function () { r(fake.address().port); }); })
  .then(function (fakePort) {
    startServer(fakePort);
    return waitForServer('http://localhost:' + PORT + '/api/lessons', 40);
  })
  .then(signIn)
  .then(run)
  .then(function () {
    clearTimeout(bail);
    console.log('\n' + (failures
      ? failures + ' check(s) failed — the builder is saying something it should not'
      : 'the builder tells the student the truth, and pays for one answer once'));
    done(failures ? 1 : 0);
  })
  .catch(function (e) {
    clearTimeout(bail);
    console.error('check-coder could not run: ' + e.message);
    if (serverErr) console.error(serverErr.slice(0, 800));
    done(1);
  });
