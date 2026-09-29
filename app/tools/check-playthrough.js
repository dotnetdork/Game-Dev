/* check-playthrough.js: plays the V2 studio for real, in a real browser (docs/rework/v2-spec.md §7).

   check-studio.js catches the wiring mistakes it can see without running anything. This is the one
   that plays: a Sunday from the sign-in page to the first ticket fixed, the way a kid would, keys held
   down in the actual game frame. Everything that broke in the first V2 build broke here, where no
   file-reading check could see it: a quest that never filed the floor ticket once the coins were fixed
   first, a physics world left paused after Stop, a tablet the director talked about but never showed.

     1. Sign up: a wrong code is refused and says so; today's code opens the interview.
     2. The interview, with the AI switched off (the director's scripted fallback, so this is the same
        every run): answers typed, the tablet tapped, hired, the learner card complete.
     3. The studio greets them by first name, and the first day plays out of order: fall through the
        floor, report the silent coins, fix the coins first, then the floor ticket is still there.
     4. Log in from a second browser: a wrong class code is refused and points at that box; both codes
        show the class list, the kid confirms it's them, and the studio resumes where they were.

   It runs its own server, on its own port, with its own save folder (deleted afterwards), and today's
   code and a class code of its own. So it never touches app/.data, and the AI is pointed at a port
   where nothing answers.

   It needs a browser: playwright-core (a devDependency, never shipped) drives the Edge or Chrome
   already on the machine. With neither, it says SKIPPED, loudly, and passes: a laptop without a
   browser shouldn't fail the suite, but nobody should read that as "played".
   `npm run playthrough` runs it on its own. PLAYTHROUGH_SHOTS=<folder> keeps screenshots. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PLAYTHROUGH_PORT || 3997);
const BASE = 'http://localhost:' + PORT;
const CODE = 'playthrough-code-7Q', CLASS = 'TESTCLASS9';
const SHOTS = process.env.PLAYTHROUGH_SHOTS || '';

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'ok    ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''));
  if (!ok) failed++;
}
function skip(why) { console.log('\nSKIPPED  the playthrough did not run: ' + why + '\n         Nothing was played. Install Edge or Chrome to run it.'); process.exit(0); }

let pw;
try { pw = require('playwright-core'); } catch (e) { skip('playwright-core is not installed (npm install in app/)'); }

const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-playthrough-'));
const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  cwd: ROOT,
  env: Object.assign({}, process.env, {
    PORT: String(PORT), STATE_DIR: STATE, NODE_ENV: 'test',
    TESTER_PASSWORD: CODE, CLASS_CODE: CLASS, SESSION_SECRET: require('crypto').randomBytes(32).toString('hex'),
    // no AI: the interview's scripted fallback runs, the same every time
    AI_PROVIDER: 'ollama', OLLAMA_URL: 'http://127.0.0.1:9/api/chat', TUTOR_MODEL: 'ollama:none', CODER_MODEL: 'ollama:none',
    ANTHROPIC_API_KEY: '', OPENROUTER_API_KEY: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GITHUB_CLIENT_ID: '',
    CODESERVER_CLIENT_ID: '', DEMO_LOGIN: '', KV_REST_API_URL: '', UPSTASH_REDIS_REST_URL: ''
  }),
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOut = '';
server.stdout.on('data', function (d) { serverOut += d; });
server.stderr.on('data', function (d) { serverOut += d; });
function done(code) {
  try { server.kill(); } catch (e) {}
  try { fs.rmSync(STATE, { recursive: true, force: true }); } catch (e) {}
  if (code) console.log('\n' + failed + ' check(s) failed' + (serverOut && failed ? '\n--- server said ---\n' + serverOut.slice(-1500) : ''));
  else console.log('\nplaythrough: all checks passed');
  process.exit(code);
}
async function up(tries) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(BASE + '/login.html'); if (r.ok) return true; } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  return false;
}

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await pw.chromium.launch({ channel: channel }); } catch (e) {}
  }
  return null;
}

(async function () {
  if (!(await up(80))) { check('the server starts', false, serverOut.split('\n').slice(-3).join(' ')); return done(1); }
  const browser = await launch();
  if (!browser) { try { server.kill(); } catch (e) {} skip('no Edge or Chrome found for playwright-core to drive'); }
  const errors = [];
  const shot = async function (p, n) { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  async function page() {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 720 } });
    const p = await ctx.newPage();
    p.on('pageerror', function (e) { errors.push(e.message); });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    return p;
  }
  let where = 'the start';
  const p = await page();
  try {
    /* 1. sign up */
    where = 'sign up';
    await p.goto(BASE + '/login.html');
    await p.waitForSelector('#sChoose:not([hidden])');
    await p.click('#goSignup'); await p.fill('#suCode', 'not-the-code'); await p.click('#suGo');
    await p.waitForSelector('#msg:not([hidden])');
    check('sign up: a wrong code is refused, and says so', /today’s code/.test(await p.$eval('#msg', function (e) { return e.textContent; })));
    await p.fill('#suCode', CODE.toLowerCase()); await p.click('#suGo');   // case never matters
    await p.waitForURL(/interview/);
    check('sign up: today\'s code opens the interview', true);

    /* 2. the interview */
    where = 'the interview';
    const card = function () { return p.evaluate(function () { return JSON.parse(localStorage.getItem('studio.interview') || '{}'); }); };
    const idle = function () { return p.waitForFunction(function () { return !document.getElementById('sendBtn').disabled || !!document.querySelector('#desk:not([hidden])'); }, null, { timeout: 20000 }); };
    const ANSWER = { name: 'Maya Rodriguez', games: 'Minecraft and Mario Kart', fun: 'I look for a secret way round', confidence: 'maybe a 4', job: 'making the levels' };
    await idle();
    let turns = 0;
    while (turns++ < 30 && !(await p.isVisible('#desk'))) {
      const c = await card();
      const tablet = c.showing && !(await p.$eval('#tablet', function (e) { return e.classList.contains('off'); }));
      if (tablet) {
        if (c.showing === 'jumps') await p.click('.pick[data-v="snappy"]');
        if (c.showing === 'sounds') await p.click('.pickit[data-v="ding"]');
        if (c.showing === 'engine') { await p.click('.mtop'); await p.waitForSelector('.minsp'); await p.waitForTimeout(600); await p.click('.minsp'); }
        if (c.showing === 'words') { await p.click('#screen .tile:has-text("collider")'); await p.click('#screen .tile:has-text("flarnish")'); await p.click('#wDone'); }
        if (c.showing === 'coin') await p.click('[data-s="ding"]');
      } else {
        const next = !c.first ? 'name' : !(c.games || []).length ? 'games' : !(c.fun || []).length && !(c.said || {}).fun ? 'fun' : !c.confidence ? 'confidence' : !c.job ? 'job' : null;
        await p.fill('#say', next ? ANSWER[next] : 'ok'); await p.press('#say', 'Enter');
      }
      await p.waitForFunction(function () { return document.getElementById('sendBtn').disabled; }, null, { timeout: 3000 }).catch(function () {});
      await idle();
      await p.waitForTimeout(300);   // a hire lands just after the words do (it saves the card first)
    }
    await shot(p, 'p01-hired');
    const c = await card();
    check('the interview hires them', await p.isVisible('#desk'), c.turns + ' turns');
    check('the name is first name and last initial', c.first === 'Maya' && c.initial === 'R', c.first + ' ' + c.initial);
    check('the tablet moments were all played', c.feelJump === 'snappy' && c.feelSound === 'ding' && c.snapshot.playTap === 'top' && c.snapshot.jumpTap === 'right'
      && c.snapshot.decoyTicked && c.coinFixed === 'ding', JSON.stringify(c.snapshot));
    check('the learner card has the talk too', c.games.length && c.fun.length && c.confidence === 4 && c.job === 'design',
      JSON.stringify({ games: c.games, fun: c.fun, confidence: c.confidence, job: c.job }));
    check('the director took notes', c.notes.length >= 5, c.notes.join('; '));
    check('nothing was let go', !Object.keys(c.moved || {}).length, Object.keys(c.moved || {}).join(', ') || 'none');

    /* 3. the studio, and the first day out of order */
    where = 'the studio';
    await p.click('#desk');
    await p.waitForURL(BASE + '/');
    const log = function () { return p.$eval('#log', function (e) { return e.innerText; }); };
    const waitLog = function (t, ms) { return p.waitForFunction(function (t) { return document.getElementById('log').innerText.includes(t); }, t, { timeout: ms || 12000 }); };
    const opt = function (t) { return p.locator('#qcard .qopt', { hasText: t }).first().click(); };
    const options = function () { return p.$$eval('#qcard .qopt', function (x) { return x.map(function (e) { return e.textContent; }).join(' | '); }); };
    const row = function (t) { return p.locator('#tree button', { hasText: t }).first().click(); };
    const frame = function () { return p.locator('#gameFrame'); };
    const hold = async function (plan) { await frame().click({ position: { x: 20, y: 20 } }); for (const s of plan) { if (s[0] === 'wait') { await p.waitForTimeout(s[1]); continue; } await p.keyboard.down(s[0]); await p.waitForTimeout(s[1]); await p.keyboard.up(s[0]); } };
    const runJump = async function (ms) { await frame().click({ position: { x: 20, y: 20 } }); await p.keyboard.down('ArrowRight'); await p.waitForTimeout(700); await p.keyboard.down('Space'); await p.waitForTimeout(150); await p.keyboard.up('Space'); await p.waitForTimeout(ms); await p.keyboard.up('ArrowRight'); };
    await waitLog('Welcome to the studio');
    check('the studio greets them by first name', /Welcome to the studio, Maya/.test(await log()));
    await p.waitForSelector('#qcard .qopt', { timeout: 15000 });
    await opt('Let’s see it'); await waitLog('Press Play');
    await p.waitForFunction(function () { return Runner.isReady(); }, null, { timeout: 20000 });
    where = 'the first day: finding bugs';
    await p.click('#bPlay');
    await hold([['ArrowRight', 1500], ['wait', 1200]]);
    await waitLog('fell right through');
    check('falling through the floor files a ticket, while playing', await p.evaluate(function () { return !!Quest.dev.state().tickets.floor; }));
    await runJump(2800);
    await waitLog('No sound at all');
    check('a silent coin files a second ticket', true);
    await p.click('#bPlay');
    await p.waitForSelector('#qcard .qopt');
    where = 'the first day: the coins first';
    await opt('Grabbing a coin makes no sound'); await waitLog('sound designer');
    await row('Coins'); await p.locator('#inspBody .swatch', { hasText: 'Sparkly ding' }).click();
    await waitLog('and listen');
    await p.click('#bPlay'); await runJump(3000);
    await waitLog('Hear that?', 9000);
    check('the coins are fixed, heard in play', true);
    await p.waitForSelector('#qcard .qopt', { timeout: 9000 }); await opt('So you know you got it'); await waitLog('make them bigger', 10000);
    where = 'the first day: play mode';
    await row('Coins');
    await p.$eval('#r-size', function (el) { el.value = 2.2; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await waitLog('Bigger! Now press Stop.'); await p.click('#bPlay'); await waitLog('They shrank back');
    check('a change made while playing is undone on Stop', await p.evaluate(function () { return Project.get().parts.filter(function (x) { return x.id === 'coins'; })[0].size; }) === 1);
    await p.waitForSelector('#qcard .qopt'); await opt('Ha, got it');
    await p.waitForSelector('#qcard .qopt'); await opt('A frog');
    await p.waitForFunction(function () { return /called/.test((document.getElementById('qText') || {}).textContent || ''); });
    await opt('Frog Lava Run'); await waitLog('Grab a coin.');
    await runJump(3000); await waitLog('first star', 9000);
    await p.waitForSelector('#qcard .qopt'); await opt('Let’s go');
    await p.waitForSelector('#qcard .qopt');
    where = 'the first day: the floor, later';
    check('the floor ticket is still on the board after the coins were fixed first', /fell through a floor tile/i.test(await options()), await options());
    await opt('I fell through a floor tile'); await waitLog('lead programmer');
    await row('Floor tile'); await p.click('#inspBody .cbox'); await waitLog('walk across it');
    await p.click('#bPlay'); await hold([['ArrowRight', 1400]]);
    await waitLog('It holds!', 9000);
    check('the floor is fixed later, walked across in play', true);
    await shot(p, 'p02-floor-fixed');
    const firstAt = await p.evaluate(function () { return Quest.dev.where() + ' / floor ' + Quest.dev.state().tickets.floor.status; });
    await p.waitForTimeout(2500);   // save.js sends it to the server

    /* 4. log in from another browser */
    where = 'log in';
    const q = await page();
    await q.goto(BASE + '/login.html');
    await q.click('#goLogin'); await q.fill('#liCode', CODE); await q.fill('#liClass', 'NOTIT'); await q.click('#liGo');
    await q.waitForSelector('#msg:not([hidden])');
    check('log in: a wrong class code is refused, and points at that box', /class code/.test(await q.$eval('#msg', function (e) { return e.textContent; }))
      && await q.evaluate(function () { return document.activeElement.id; }) === 'liClass');
    await q.fill('#liClass', 'test-class 9'); await q.click('#liGo');   // spaces and dashes never matter
    await q.waitForSelector('#sWho:not([hidden])');
    const mine = q.locator('.who', { hasText: 'Maya R.' });
    check('log in: she is on the class list as Maya R., with her game', await mine.count() === 1 && /Frog Lava Run/.test(await mine.innerText()), await mine.innerText().catch(function () { return '(none)'; }));
    await mine.click(); await q.waitForSelector('#sYours:not([hidden])'); await q.click('#yes');
    await q.waitForURL(BASE + '/');
    check('log in: signed in as her', await q.evaluate(function () { return fetch('/auth/me').then(function (r) { return r.json(); }).then(function (j) { return j.name; }); }) === 'Maya R.');
    await q.waitForFunction(function () { return window.Quest && Quest.dev.where() !== '(no quest)'; }, null, { timeout: 15000 });
    const there = await q.evaluate(function () { return { at: Quest.dev.where(), floor: (Quest.dev.state().tickets.floor || {}).status }; });
    check('log in: the studio resumes where she was, on the other browser', there.at + ' / floor ' + there.floor === firstAt, JSON.stringify(there) + ', first browser at ' + firstAt);
  } catch (e) {
    check('the playthrough got through ' + where, false, e.message.split('\n')[0]);
    await shot(p, 'pzz-failed').catch(function () {});
  }
  check('no page errors along the way', !errors.length, errors.slice(0, 3).join(' / ') || 'none');
  await browser.close();
  done(failed ? 1 : 0);
})().catch(function (e) { console.error(e); done(1); });
