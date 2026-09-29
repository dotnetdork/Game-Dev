/* check-release.js: the switches that must be right before students use the studio.

   WHAT CHANGED WITH V2. This used to read V1's js/dev.js and check that its dev mode was derived
   from the hostname, and that the footer's reset buttons were marked dev-only. The V2 studio has no
   dev mode to derive and no reset button in the page at all: everything that can wipe a kid's work
   lives in the dev panel (studio/dev.js), and the server does not serve that file to a deployment
   (server.js, next to the static hosting). So the question is no longer "is the switch in the right
   position" but "does a real deployment refuse the file", and that is asked of a real server rather
   than read out of the source.

     1. A server started as the League server starts it (NODE_ENV=production) tells the page it is
        hosted, and answers 404 for the dev panel even to a signed-in kid, while the rest of the
        studio loads. The same server on a laptop serves it, so the 404 is the rule and not a typo.
     2. The class list needs both codes: today's code alone (Sign Up) cannot list who is in the class.
     3. Read from the source: nothing but the dev panel can delete a save, the game frame is
        sandboxed without allow-same-origin, and the page survives the dev panel being absent.

     npm --prefix app run check:release

   It runs its own servers on their own ports with a save folder of their own (deleted afterwards),
   so it never touches app/.data or the AI. */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const CODE = 'release-check-code-4K', CLASS = 'RELEASE7';

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

function start(port, env) {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-release-'));
  const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(port), STATE_DIR: state,
      TESTER_PASSWORD: CODE, CLASS_CODE: CLASS, SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
      AI_PROVIDER: 'ollama', OLLAMA_URL: 'http://127.0.0.1:9/api/chat', TUTOR_MODEL: 'ollama:none', CODER_MODEL: 'ollama:none',
      ANTHROPIC_API_KEY: '', OPENROUTER_API_KEY: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GITHUB_CLIENT_ID: '',
      CODESERVER_CLIENT_ID: '', DEMO_LOGIN: '', KV_REST_API_URL: '', UPSTASH_REDIS_REST_URL: ''
    }, env),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  proc.stdout.on('data', function (d) { out += d; });
  proc.stderr.on('data', function (d) { out += d; });
  const base = 'http://localhost:' + port;
  return {
    base: base, out: function () { return out; },
    stop: function () { try { proc.kill(); } catch (e) {} try { fs.rmSync(state, { recursive: true, force: true }); } catch (e) {} },
    up: async function () {
      for (let i = 0; i < 80; i++) {
        try { const r = await fetch(base + '/login.html'); if (r.ok) return r; } catch (e) {}
        await new Promise(function (r) { setTimeout(r, 250); });
      }
      return null;
    }
  };
}

/* A tiny cookie jar: the names and values from Set-Cookie, sent back as one Cookie header. */
function jar() {
  const c = {};
  return {
    take: function (res) { (res.headers.getSetCookie ? res.headers.getSetCookie() : []).forEach(function (s) { const kv = s.split(';')[0], i = kv.indexOf('='); c[kv.slice(0, i)] = kv.slice(i + 1); }); return res; },
    get: function (n) { return c[n]; },
    header: function () { return Object.keys(c).map(function (k) { return k + '=' + c[k]; }).join('; '); }
  };
}
async function post(s, j, url, body) {
  return j.take(await fetch(s.base + url, { method: 'POST', headers: { 'content-type': 'application/json', origin: s.base, cookie: j.header() }, body: JSON.stringify(body), redirect: 'manual' }));
}
async function get(s, j, url) { return j.take(await fetch(s.base + url, { headers: { cookie: j.header() }, redirect: 'manual' })); }

async function signedUp(s) {
  const j = jar();
  await get(s, j, '/login.html');
  const p = await post(s, j, '/auth/studio/pass', { mode: 'signup', code: CODE });
  const n = await post(s, j, '/auth/studio/new', { first: 'Maya', initial: 'R' });   // the name is asked at sign-up while the interview is off (auth.js, INTERVIEW)
  return { j: j, ok: p.status === 200 && n.status === 200, detail: 'pass ' + p.status + ', new ' + n.status };
}

(async function () {
  /* 1 & 2: a deployment, started the way app/Dockerfile starts it */
  const hosted = start(Number(process.env.RELEASE_PORT || 3995), { NODE_ENV: 'production' });
  const local = start(Number(process.env.RELEASE_PORT || 3995) + 1, { NODE_ENV: 'test' });
  try {
    const hup = await hosted.up();
    check('a production server starts with the studio door configured', !!hup,
      hup ? '' : hosted.out().split('\n').filter(Boolean).slice(-2).join(' '));
    if (hup) {
      const k = await signedUp(hosted);
      check('a kid can sign up on it', k.ok, k.detail);
      check('it tells the page it is a real deployment', k.j.get('league_hosted') === '1', 'league_hosted=' + k.j.get('league_hosted'));
      const dev = await get(hosted, k.j, '/studio/dev.js');
      const quest = await get(hosted, k.j, '/studio/quest.js');
      check('the dev panel is not served to a deployment, even signed in', dev.status === 404, 'GET /studio/dev.js → ' + dev.status);
      check('the rest of the studio is', quest.status === 200, 'GET /studio/quest.js → ' + quest.status);
      const roster = await get(hosted, k.j, '/auth/studio/roster');
      check('today’s code alone cannot list the class', roster.status === 401, 'roster after Sign Up → ' + roster.status);
      const l = jar();
      const noClass = await post(hosted, l, '/auth/studio/pass', { mode: 'login', code: CODE, classCode: 'WRONG' });
      check('Log In refuses a wrong class code', noClass.status === 401, '→ ' + noClass.status);
    }
    const lup = await local.up();
    if (lup) {
      const k = await signedUp(local);
      const dev = await get(local, k.j, '/studio/dev.js');
      check('the same server on a laptop does serve it (so the 404 above is the rule, not a typo)', dev.status === 200, '→ ' + dev.status);
    } else check('a laptop server starts too', false, local.out().split('\n').filter(Boolean).slice(-2).join(' '));
  } finally { hosted.stop(); local.stop(); }

  /* 3: read from the source */
  const studio = path.join(PUB, 'studio');
  const files = fs.readdirSync(studio).filter(function (f) { return f.endsWith('.js'); });
  const deleters = files.filter(function (f) { return f !== 'dev.js' && /method\s*:\s*['"]DELETE['"]/.test(fs.readFileSync(path.join(studio, f), 'utf8')); });
  check('only the dev panel can delete a save', !deleters.length, deleters.length ? 'also in: ' + deleters.join(', ') : files.length + ' studio scripts read');
  const runner = fs.readFileSync(path.join(studio, 'runner.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  check('the game frame is sandboxed', /setAttribute\(\s*['"]sandbox['"]\s*,\s*['"]allow-scripts['"]\s*\)/.test(runner),
    'kid and AI code runs with an opaque origin (runner.js:3)');
  const sameOrigin = files.filter(function (f) { return /allow-same-origin/.test(fs.readFileSync(path.join(studio, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')); });
  check('nothing adds allow-same-origin to it', !sameOrigin.length, sameOrigin.length ? 'found in: ' + sameOrigin.join(', ') : '');
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  check('the page survives the dev panel being refused', /<script src="\/studio\/dev\.js" onerror="this\.remove\(\)"><\/script>/.test(html),
    'a deployment answers 404 for it');

  console.log('\n' + (failures ? failures + ' check(s) failed — not ready for students'
    : 'release checks pass: a deployment refuses the dev panel, the class list needs both codes, and the game frame is sandboxed'));
  process.exit(failures ? 1 : 0);
})();
