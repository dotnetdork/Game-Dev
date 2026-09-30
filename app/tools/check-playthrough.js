/* check-playthrough.js: plays the V2 studio for real, in a real browser (docs/rework/v2-spec.md §7).

   check-studio.js catches the wiring mistakes it can see without running anything. This is the one
   that plays: a Sunday from the sign-in page to the first ticket fixed, the way a kid would, keys held
   down in the actual game frame. Everything that broke in the first V2 build broke here, where no
   file-reading check could see it: a quest that never filed the floor ticket once the coins were fixed
   first, a physics world left paused after Stop, a tablet the director talked about but never showed.

     1. Sign up: a wrong code is refused and says so; today's code opens the interview, and the last
        kid's half-finished interview on this browser (a shared Chromebook) is not inherited.
     2. The interview, with the AI switched off (the director's scripted fallback, so this is the same
        every run): answers typed, the ladder climbed (a game, the part they love, why, and over what),
        the tablet tapped, a test that follows the talk, hired, the learner card complete.
     3. The studio greets them by first name, and the first day plays out of order: fall through the
        floor and grab a silent coin (noticed, not filed), tell the Mentor both in her own words, fix
        the coins first through the Clip's picker, describe a hero, type the game's name, and then the
        floor ticket is still there: read on its page, picked from it, the tile tapped in the Scene
        view and fixed. Then game.js, opened from the Project window: broken on purpose, saved, the
        error back with its line, and put back. Then the design doc: her hero is already in it, and a
        section typed there is kept and queued for the next build.
     4. Log in from a second browser: a wrong class code is refused and points at that box; both codes
        show the class list, the kid confirms it's them, and the studio resumes where they were, with
        her design doc.
     5. The interview again, with a stand-in AI (a page route answers /api/ai, so no model is needed):
        a "you're hired" before the why is refused, a game the kid never typed is not taken, the goal
        is done by the code once the card holds a game, a part and a why, and a director that doesn't
        answer in 12 s is replaced by the script. Its own browser, so it runs even if 3 or 4 failed.

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
    PORT: String(PORT), STATE_DIR: STATE, NODE_ENV: 'test', STUDIO_INTERVIEW: 'on',   // this test walks the interview
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
    // the one error made on purpose (the game.js check breaks the kid's code to see the line come back) isn't the page's
    p.on('pageerror', function (e) { if (!/notAThing/.test(e.message)) { errors.push(e.message); if (process.env.PLAYTHROUGH_STACKS) console.log('PAGE ERROR', e.stack); } });
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
    // a shared Chromebook: the last kid left in the middle of their interview
    await p.evaluate(function () { localStorage.setItem('studio.interview', JSON.stringify({ v: 2, who: 'k-someone-else@studio', first: 'Zed', initial: 'Q', turns: 3,
      games: ['Tetris'], loves: [{ game: 'Tetris', element: 'the speed', why: '', over: '' }], log: [{ role: 'assistant', content: 'So, Zed, what else do you play?' }] })); });
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
    /* What Maya types, by the question the page is asking (card.asking). "yes" to the hello is not a
       name; the contrast mentions building, so the first tablet test should be the engine, not the
       jumps that would come first by default (the tablet follows the talk). */
    const ANSWER = { hello: 'yes', name: 'Maya Rodriguez', 'games:game': 'RuneScape and Minecraft', 'games:element': 'the grind honestly',
      'games:why': 'because you can see yourself getting stronger', contrast: 'RuneScape lets you build a house and train any skill',
      notFan: 'Clash Royale, too much waiting for chests', wants: 'a spooky maze game with traps', confidence: 'maybe a 4', job: 'making the levels' };
    await idle();
    const first = await card();
    const seen = (await p.innerText('#talk')) + ' ' + (await p.innerText('#notes'));
    check('sign up: the last kid\'s half-finished interview on this browser is not inherited',
      !first.first && !!first.who && first.who !== 'k-someone-else@studio' && !/Zed|Tetris/.test(seen), JSON.stringify({ who: first.who, first: first.first }));
    let turns = 0;
    const shown = [];
    while (turns++ < 30 && !(await p.isVisible('#desk'))) {
      const c = await card();
      const tablet = c.showing && !(await p.$eval('#tablet', function (e) { return e.classList.contains('off'); }));
      if (tablet) {
        if (shown[shown.length - 1] !== c.showing) shown.push(c.showing);
        if (c.showing === 'jumps') await p.click('.pick[data-v="snappy"]');
        if (c.showing === 'sounds') await p.click('.pickit[data-v="ding"]');
        if (c.showing === 'engine') { await p.click('.mtop'); await p.waitForSelector('.minsp'); await p.waitForTimeout(600); await p.click('.minsp'); }
        if (c.showing === 'words') { await p.click('#screen .tile:has-text("collider")'); await p.click('#screen .tile:has-text("flarnish")'); await p.click('#wDone'); }
        if (c.showing === 'coin') await p.click('[data-s="ding"]');
      } else {
        await p.fill('#say', ANSWER[c.asking] || 'ok'); await p.press('#say', 'Enter');
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
    const l0 = (c.loves || [])[0] || {};
    check('the ladder: a game, the part they love, why, and over what', l0.game === 'RuneScape' && /grind/.test(l0.element) && /^you can see/.test(l0.why) && /any skill/.test(l0.over || ''), JSON.stringify(l0));
    check('the learner card has the rest of the talk', c.games.length === 2 && c.notFan.length === 1 && /maze/.test(c.wants) && c.fun.indexOf('progress') >= 0 && c.confidence === 4 && c.job === 'design',
      JSON.stringify({ games: c.games, notFan: c.notFan, wants: c.wants, fun: c.fun, confidence: c.confidence, job: c.job }));
    check('the tablet follows the talk (they mentioned building: the engine first)', shown[0] === 'engine' && shown[shown.length - 1] === 'coin', shown.join(' > '));
    const notes = await p.$$eval('#notes dt', function (x) { return x.map(function (e) { return e.textContent; }).join(' | '); });
    const loves = await p.$$eval('#notes dd', function (x) { return x.map(function (e) { return e.textContent; }).join(' | '); });
    check('the clipboard is in sections, in their words', notes === 'Name | Loves | Because | Not a fan of | Wants to make | Feels ready' && /the grind/.test(loves) && !/plays /.test(loves), notes + ' :: ' + loves);
    check('the saved profile has the new shape', !!c.profile && c.profile.who === first.who && c.profile.loves.length === 1 && !!c.profile.loves[0].why && c.profile.notFan.length === 1 && !!c.profile.wants
      && 'jump' in c.profile && 'note' in c.profile && !!c.profile.tried, JSON.stringify(c.profile).slice(0, 160));
    check('after two AI failures in a row it stays scripted', c.scripted === true && c.fails >= 2, 'fails ' + c.fails);
    check('nothing was let go', !Object.keys(c.moved || {}).length, Object.keys(c.moved || {}).join(', ') || 'none');

    /* 3. the studio, and the first day out of order */
    where = 'the studio';
    await p.click('#desk');
    await p.waitForURL(BASE + '/');
    // what the chat shows: the conversation, and the question card under it (a question waits there
    // until it is answered, then goes into the conversation)
    const log = function () { return p.evaluate(function () { return document.getElementById('log').textContent + ' ' + document.getElementById('qcard').textContent; }); };
    const waitLog = function (t, ms) { return p.waitForFunction(function (t) { return (document.getElementById('log').textContent + ' ' + document.getElementById('qcard').textContent).includes(t); }, t, { timeout: ms || 12000 }); };
    const task = function () { return p.$eval('#task', function (e) { return e.hidden ? '' : document.getElementById('taskText').textContent; }); };
    const opt = function (t) { return p.locator('#qcard .qopt', { hasText: t }).first().click(); };
    const options = function () { return p.$$eval('#qcard .qopt', function (x) { return x.map(function (e) { return e.textContent; }).join(' | '); }); };
    const row = function (t) { return p.locator('#tree button', { hasText: t }).first().click(); };
    const type = async function (t) { await p.waitForFunction(function () { return !document.getElementById('sendBtn').disabled; }, null, { timeout: 15000 }); await p.fill('#say', t); await p.press('#say', 'Enter'); };
    const state = function () { return p.evaluate(function () { var S = Quest.dev.state(); return { seen: S.seen || {}, tickets: S.tickets, where: Quest.dev.where() }; }); };
    const frame = function () { return p.locator('#gameFrame'); };
    const hold = async function (plan) { await frame().click({ position: { x: 20, y: 20 } }); for (const s of plan) { if (s[0] === 'wait') { await p.waitForTimeout(s[1]); continue; } await p.keyboard.down(s[0]); await p.waitForTimeout(s[1]); await p.keyboard.up(s[0]); } };
    const runJump = async function (ms) { await frame().click({ position: { x: 20, y: 20 } }); await p.keyboard.down('ArrowRight'); await p.waitForTimeout(700); await p.keyboard.down('Space'); await p.waitForTimeout(150); await p.keyboard.up('Space'); await p.waitForTimeout(ms); await p.keyboard.up('ArrowRight'); };
    await waitLog('Welcome to the studio');
    check('the studio greets them by first name', /Welcome to the studio, Maya/.test(await log()));
    await waitLog('Press Play');
    check('the welcome is one message, and what to do is a step row, not a bubble', await p.$$eval('#log .msg', function (x) { return x.length; }) === 1 && /Press Play up top/.test(await p.$eval('#log .step', function (e) { return e.textContent; })));
    check('one conversation, not a tab per character', !(await p.$('.ctab')) && await p.$eval('#dMentor .tabs', function (e) { return e.textContent.trim(); }) === 'Chat');
    check('the task line says what this step wants', await task() === 'Play the game and look for anything broken', await task());
    await p.waitForFunction(function () { return Runner.isReady(); }, null, { timeout: 20000 });
    where = 'the first day: finding bugs';
    await p.click('#bPlay');
    await hold([['ArrowRight', 1500], ['wait', 1200]]);
    await runJump(2800);
    let st = await state();
    check('playing, the studio notices what she ran into but files nothing: she has to say it', !!st.seen.floor && !!st.seen['silent-coins'] && !Object.keys(st.tickets).length, JSON.stringify(st.seen));
    check('and the chat doesn\'t narrate it (it is in the Console)', !/fell|no sound/i.test(await log()) && await p.$eval('#consoleList', function (e) { return e.children.length; }) > 0);
    await p.click('#bPause');
    check('Play, Pause and Stop are three buttons: Pause freezes the game, Play stays down', await p.evaluate(function () { return Runner.isPaused() && Runner.isPlaying(); }) && await p.getAttribute('#bPlay', 'aria-pressed') === 'true' && await p.isEnabled('#bStop'));
    await p.click('#bPlay');
    check('and Play carries on after a pause', await p.evaluate(function () { return !Runner.isPaused() && Runner.isPlaying(); }));
    await p.click('#bStop');
    check('Stop stops', await p.evaluate(function () { return !Runner.isPlaying(); }) && await p.isDisabled('#bStop'));
    await waitLog('What was broken?');
    where = 'the first day: the report';
    await p.waitForTimeout(600);
    check('an open question has no card: it is a line, and the box says what to type, with an example', await p.isHidden('#qcard') && /^Like “/.test(await p.getAttribute('#say', 'placeholder')), await p.getAttribute('#say', 'placeholder'));
    await type('the coins dont make any sound');
    await p.waitForFunction(function () { return !!Quest.dev.state().tickets['silent-coins']; }, null, { timeout: 9000 });
    await waitLog('What should have happened');
    check('a finding lands on the board as it is said: the Tickets dock opens with it', await p.isVisible('#ticketList') && await p.$$eval('#ticketList button.tk', function (x) { return x.length; }) === 1);
    check('then the other half of a bug report: what should have happened, with an example in the box', /^Like “it should/.test(await p.getAttribute('#say', 'placeholder')), await p.getAttribute('#say', 'placeholder'));
    await type('idk');
    await waitLog('how do you usually know you got it?');
    check('"idk" there is not the hint box: the Mentor leads her there with a question, and gives no answer', await p.isHidden('#hintBox') && !/should make a sound/.test(await log()));
    await shot(p, 'p01a-should-ask');
    await type('it should ding');
    await waitLog('What else did you notice?');
    check('her answer goes on the ticket', (await state()).tickets['silent-coins'].should === 'it should ding', JSON.stringify((await state()).tickets['silent-coins']));
    check('then the Mentor asks what else, as a person would: no magic phrase to finish', !/say “that’s all”/.test(await log()) && /^Something else/.test(await p.getAttribute('#say', 'placeholder')), await p.getAttribute('#say', 'placeholder'));
    await type('idk');
    await p.waitForFunction(function () { return !document.getElementById('hintBox').hidden; }, null, { timeout: 6000 });
    const hintSaid = await p.$eval('#hintText', function (e) { return e.textContent; });
    await shot(p, 'p01b-report-hint');
    check('"idk" on the report is a hint, where to look, never the answers: no card, no problem named', await p.isHidden('#qcard') && /Think back/.test(hintSaid) && !/floor|grey|lava|coin/i.test(hintSaid), hintSaid);
    // a feeling is asked about, never sorted into a ticket (Jay, Sept 30: "It should ask why its boring")
    where = 'the first day: digging into a feeling';
    await type('its boring');
    await waitLog('“Boring” how?');
    check('"its boring" files nothing: the Mentor asks what made it feel that way', Object.keys((await state()).tickets).length === 1);
    await shot(p, 'p01c-dig');
    await type('everything is grey');
    await p.waitForFunction(function () { return !!Quest.dev.state().tickets.greybox; }, null, { timeout: 9000 });
    check('what she says next is read with it, and the ticket keeps all of her words', (await state()).tickets.greybox.words === 'its boring. everything is grey', (await state()).tickets.greybox.words);
    // "what should have happened" is asked once; after that the Mentor says the other half itself
    await waitLog('Each thing should look different');
    const asks = ((await log()).match(/What should have happened/g) || []).length;
    check('the second finding is not asked "what should have happened" again: the Mentor says it, and the thanks is not the same line', asks === 1 && /Nice find|Spotted it|Yes! That’s/.test(await log()), asks + ' asks');
    check('and her typed "idk" earlier got a line in the chat, not only the hint box', /Here’s a hint|Try this hint|hint to get you going/.test(await log()));
    where = 'the first day: the report';
    await type('I fell through the floor');
    await p.waitForFunction(function () { return !!Quest.dev.state().tickets.floor; }, null, { timeout: 9000 });
    // "that's all" with one still unfound: are you sure? and where to look (Jay, Sept 30)
    await type('that’s all');
    await waitLog('Are you sure?');
    check('"that’s all" with a problem unfound: "Are you sure?", and a question about where to look, not what is wrong', /meant to be lava\. What happened when you walked into it\?/.test(await log()) && !(await state()).tickets['harmless-lava']);
    await shot(p, 'p01d-are-you-sure');
    await type('nothing');
    await p.waitForFunction(function () { return !!Quest.dev.state().tickets['harmless-lava']; }, null, { timeout: 9000 });
    check('"nothing", to what happened on the lava, is the finding: she filed it', (await state()).tickets['harmless-lava'].by === 'You');
    await type('that’s all');
    await waitLog('Type its number, or tell me', 12000);
    st = await state();
    check('what she said became tickets, in her words, and she found all four, so the team filed none', st.tickets.floor.words === 'I fell through the floor' && st.tickets['silent-coins'].words === 'the coins dont make any sound'
      && !/The team spotted/.test(await log()), JSON.stringify(st.tickets));
    check('and nothing stalled: the day moved on to picking a ticket, asked in the chat with no card', /What should we fix first/.test(await log()) && await p.isHidden('#qcard') && await p.isVisible('#sayForm'));
    const board = await p.$$eval('#ticketList button.tk', function (x) { return x.map(function (e) { return e.textContent; }); });
    check('the Tickets dock lists them as buttons, numbered, with a clear title and a status', board.length === 4
      && board.some(function (t) { return /^#\d.*Open.*The player falls through a floor tile$/.test(t); }), board.join(' | '));
    const before = await p.$eval('#log', function (e) { return e.textContent; });
    where = 'the first day: the coins first';
    await type('the coins one'); await waitLog('talking to the sound designer');
    check('a ticket is picked by saying it: "the coins one" starts the Audio ticket', await p.evaluate(function () { return Quest.dev.state().tickets['silent-coins'].status; }) === 'doing');
    check('the hand-over clears the chat: the Mentor\'s lines are gone, the sound designer\'s start', /What was broken/.test(before) && !/What was broken/.test(await p.$eval('#log', function (e) { return e.textContent; }))
      && await p.$eval('#dMentor', function (e) { return e.getAttribute('data-who'); }) === 'u');
    // not picking now, so a tap opens the page
    await p.click('#ticketList [data-key="ticket:floor"]');
    const tpage = await p.$eval('#ticketPage', function (e) { return e.hidden ? '(hidden)' : e.textContent; });
    check('a ticket opens its page: what is wrong, what she said, how she will know it is fixed', /What’s wrong.*drops right through.*You reported.*I fell through the floor.*Fixed when/.test(tpage), tpage.slice(0, 160));
    await p.click('#ticketPage .back');
    check('Back goes back to the board', await p.isVisible('#ticketList') && await p.isHidden('#ticketPage'));
    await p.waitForSelector('#tree [data-key="part:coins"].cue', { timeout: 9000 });
    check('the part to tap is lit in the Hierarchy, the way Play is', true);
    await row('Coins');
    await waitLog('Inspector shows the Coins’ components');
    check('picked, the cue moves to the setting to change, and the character says what the Inspector is', !(await p.$('#tree .cue')) && !!(await p.$('#inspBody .ofield[data-slot="sound"].cue')));
    await shot(p, 'p01c-cue-inspector');
    await p.click('#inspBody .ofield[data-slot="sound"] .opick');
    await p.locator('.opicker .popt', { hasText: 'Sparkly ding' }).click();
    check('the Clip is an object field, filled from the picker', await p.evaluate(function () { return Project.part('coins').sound; }) === 'ding');
    await waitLog('and listen');
    await p.click('#bPlay'); await runJump(3000);
    await waitLog('Hear that?', 9000);
    check('the coins are fixed, heard in play', true);
    await p.waitForSelector('#qcard .qopt', { timeout: 9000 }); await opt('So you know you got it'); await waitLog('make them bigger', 10000);
    where = 'the first day: play mode';
    await row('Coins');
    await p.$eval('#r-size', function (el) { el.value = 2.2; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await waitLog('Now press Stop.'); await p.click('#bStop'); await waitLog('They shrank back');
    check('a change made while playing is undone on Stop', await p.evaluate(function () { return Project.part('coins').size; }) === 1);
    await waitLog('What should we fix next', 9000);
    where = 'the first day: the floor, later';
    // the board before anything else (Jay, Sept 30: "its asking me all these things before I even finish the tickets")
    check('with tickets still open, the Mentor goes to the next one, not to her hero or her game\'s name', !/What’s yours\?|called\?/.test(await log()));
    check('the fixed ticket stays on the board, crossed out', await p.$eval('#ticketList [data-key="ticket:silent-coins"]', function (b) { return b.classList.contains('done') && /line-through/.test(getComputedStyle(b.querySelector('.tt')).textDecorationLine); }));
    const left = await p.$$eval('#ticketList button.tk', function (x) { return x.map(function (e) { return e.textContent; }).join(' | '); });
    check('the floor ticket is still on the board after the coins were fixed first', /Open.*falls through a floor tile/.test(left), left);
    check('the Mentor says every way to pick: its number, what it is about, or a tap and Fix this one', /Type its number, or tell me what it’s about\. Or tap a ticket/.test(await log()));
    // tapped on the board while the Mentor asks: that selects it, and Fix this one confirms (Jay, Sept 30)
    await p.click('#ticketList [data-key="ticket:floor"]');
    check('a tap alone opens its page and starts nothing', await p.isVisible('#ticketPage') && await p.evaluate(function () { return Quest.dev.state().tickets.floor.status; }) === 'open');
    await p.click('#ticketPage [data-key="fix"]');
    await waitLog('talking to the lead programmer'); await waitLog('Go ahead and click Floor tile');
    check('Fix this one on its page starts it', await p.evaluate(function () { return Quest.dev.state().tickets.floor.status; }) === 'doing');
    check('the greeting is followed by exactly what to click, and so is the task line', /Go ahead and click Floor tile in the Hierarchy/.test(await log()) && await task() === 'Click Floor tile in the Hierarchy' && await p.isVisible('#taskHint'), await task());
    await p.click('#taskHint');
    await p.waitForFunction(function () { return !document.getElementById('hintBox').hidden && /The Hierarchy is the list on the left/.test(document.getElementById('hintText').textContent); }, null, { timeout: 9000 });
    check('the hint opens under the task line, and is not a line in the chat', !/The Hierarchy is the list on the left/.test(await log()));
    check('the ticket\'s page shows it in progress, with the task and a hint', /In progress.*Your task now.*Click Floor tile in the Hierarchy.*Stuck\? Get a hint/.test(await p.$eval('#ticketPage', function (e) { return e.textContent; })));
    await p.click('#ticketPage .back');
    check('the Scene view arrives with the Hierarchy', await p.isVisible('#vtScene'));
    check('the Floor tile is lit in the Hierarchy', !!(await p.$('#tree [data-key="part:tile"].cue')));
    await p.click('#vtScene'); await p.click('#sceneSvg [data-part="tile"] .hit');
    check('the Scene view: tapping the tile picks it, as the Hierarchy does', await p.evaluate(function () { return Editor.selected(); }) === 'tile' && await p.isVisible('#inspBody'));
    await waitLog('This is the Inspector');
    check('picked, the lead programmer says what the Inspector is, and the Ground is lit to compare', !!(await p.$('#tree [data-key="part:ground"].cue')));
    await p.click('#inspBody .cbox'); await waitLog('walk across it');
    check('and a solid floor shows its collider there, in green', await p.$$eval('#sceneSvg [data-part="tile"] .gizmo', function (x) { return x.length; }) === 1);
    await p.click('#bPlay');
    check('Play shows the Game view', await p.evaluate(function () { return Views.current(); }) === 'game' && await p.isHidden('#sceneView'));
    await hold([['ArrowRight', 1400]]);
    await waitLog('It holds!', 9000);
    check('the floor is fixed later, walked across in play', true);
    await shot(p, 'p02-floor-fixed');
    await waitLog('what made the tile solid', 12000);   // settled on the next question, so the log-in below finds her here
    where = 'game.js';
    await p.click('#pf-scripts'); await p.click('[data-key="asset:game.js"]');
    await p.waitForSelector('#codeHost .CodeMirror-code .CodeMirror-line', { timeout: 9000 });   // not the hidden one CodeMirror measures with
    await shot(p, 'p03-code');
    check('game.js opens in its own tab, in a code editor', await p.evaluate(function () { return Views.current(); }) === 'code' && await p.isVisible('#vtCode'));
    const errAt = await p.evaluate(function () {
      var cm = document.querySelector('#codeHost .CodeMirror').CodeMirror, n = 0;
      for (var i = 0; i < cm.lineCount(); i++) if (/create\(\) \{/.test(cm.getLine(i))) { n = i + 1; break; }
      cm.replaceRange('    notAThing();\n', { line: n, ch: 0 });
      return n + 1;
    });
    await p.click('#codeSave');
    await p.waitForSelector('#codeErr:not([hidden])', { timeout: 12000 });
    const errText = await p.$eval('#codeErrText', function (e) { return e.textContent; });
    check('Save & run restarts the game with it, and an error comes back with its line in game.js', errText.indexOf('Line ' + errAt + ':') === 0 && /notAThing/.test(errText), errText);
    await p.click('#codeErrBack');
    await p.waitForFunction(function () { return Runner.isReady() && document.getElementById('codeErr').hidden; }, null, { timeout: 12000 });
    check('Put back what worked puts the code back', await p.evaluate(function () { return document.querySelector('#codeHost .CodeMirror').CodeMirror.getValue().indexOf('notAThing') < 0 && !/notAThing/.test(Project.get().code || ''); }));
    await p.click('#codeClose');
    check('closing game.js goes back to the Game view', await p.evaluate(function () { return Views.current(); }) === 'game' && await p.isHidden('#vtCode'));
    where = 'the design doc';
    check('the Design doc tab waits for the first design round', await p.isHidden('#vtDoc'));
    await p.evaluate(function () { Views.revealDoc(true); });   // the round that reveals it is design.js's
    await p.click('#vtDoc');
    await p.waitForSelector('.dsec[data-sec="hero"] textarea');
    check('every section starts "Not decided yet"', await p.$$eval('.dsec[data-state="empty"] .sw', function (l) { return l.length === 9 && l.every(function (e) { return e.textContent === 'Not decided yet'; }); }));
    await p.fill('.dsec[data-sec="idea"] textarea', 'A frog hops over lava to grab coins');
    await p.click('#vtDoc');   // out of the box: kept on blur
    const idea = await p.evaluate(function () { var d = Project.doc(); return { s: d.sections.idea, changed: d.changed, mark: document.querySelector('.dsec[data-sec="idea"]').getAttribute('data-state') }; });
    check('typing in a section keeps it, as decided, and queues it for the next build', idea.s.text === 'A frog hops over lava to grab coins' && idea.s.state === 'decided' && idea.s.by === 'kid'
      && idea.changed.indexOf('idea') >= 0 && idea.mark === 'decided', JSON.stringify(idea));
    await shot(p, 'p03b-doc');
    if (SHOTS) { await p.setViewportSize({ width: 1100, height: 720 }); await shot(p, 'p03c-doc-narrow'); await p.setViewportSize({ width: 1366, height: 720 }); }
    await p.click('#vtGame');
    where = 'a panel made big';
    await p.click('#dProject .maxb');
    const big = await p.evaluate(function () { var d = document.getElementById('dProject'), r = d.getBoundingClientRect(); return { max: d.classList.contains('max'), w: r.width, h: r.height, under: document.getElementById('dHier').inert, chat: document.getElementById('dMentor').inert }; });
    check('the Project window can be made big, with the Chat still beside it', big.max && big.w > 800 && big.h > 500 && big.under && !big.chat, JSON.stringify(big));
    await p.keyboard.press('Escape');
    check('Escape puts it back', await p.evaluate(function () { return !document.querySelector('.dock.max') && !document.getElementById('dHier').inert; }));
    const rows = await p.evaluate(function () { Chat.event('A test row', 'i-flag'); Chat.event('A test row', 'i-flag'); Chat.event('A test row', 'i-flag'); var r = document.querySelectorAll('#log .evt[data-text="A test row"]'); return r.length + ' ' + (r[0] && r[0].textContent); });
    check('the same event again is one row with a count, not spam', rows === '1 A test row×3', rows);
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
    check('log in: she is on the class list as Maya R.', await mine.count() === 1, await mine.innerText().catch(function () { return '(none)'; }));
    await mine.click(); await q.waitForSelector('#sYours:not([hidden])'); await q.click('#yes');
    await q.waitForURL(BASE + '/');
    check('log in: signed in as her', await q.evaluate(function () { return fetch('/auth/me').then(function (r) { return r.json(); }).then(function (j) { return j.name; }); }) === 'Maya R.');
    await q.waitForFunction(function () { return window.Quest && Quest.dev.where() !== '(no quest)'; }, null, { timeout: 15000 });
    const there = await q.evaluate(function () { return { at: Quest.dev.where(), floor: (Quest.dev.state().tickets.floor || {}).status }; });
    check('log in: the studio resumes where she was, on the other browser', there.at + ' / floor ' + there.floor === firstAt, JSON.stringify(there) + ', first browser at ' + firstAt);
    const doc2 = await q.evaluate(function () { return Project.doc().sections.idea.text; });
    check('log in: her design doc came with her', doc2 === 'A frog hops over lava to grab coins', doc2);
    await q.close();

    /* the hero, once the board is clear (first-day.yaml, its-yours). The shifts in between are the
       same as the two above, so the page jumps there. */
    where = 'the first day: her hero, after the board';
    await p.evaluate(function () {
      Object.keys(Quest.dev.state().tickets).forEach(function (id) { Quest.dev.state().tickets[id].status = 'done'; });
      Quest.dev.jump('first-day', Quest.dev.course().quests['first-day'].beats.map(function (b) { return b.id; }).indexOf('its-yours'));
    });
    await waitLog('The board is clear!', 9000);
    await waitLog('What’s yours?', 9000);
    await type('idk');
    await p.waitForSelector('#qcard.typed .qopt', { timeout: 6000 });
    await shot(p, 'p02b-hero-card');
    check('"idk" on a question with no wrong answer (her hero) brings ideas, with Something else and Skip, and the chat box steps aside', /A dragon/.test(await options()) && /Something else/.test(await options()) && await p.isVisible('#qSkip') && await p.isHidden('#sayForm'), await options());
    check('and her "idk" got a line in the chat before the ideas', /Here are some ideas|Pick one of these|a few to get you going/.test(await log()));
    await p.click('#qSkip');
    check('Skip puts the card away and the question stays open', await p.isHidden('#qcard') && await p.isVisible('#sayForm'));
    await type('uhh maybe like a frog');
    // the first lesson in telling an AI what you want (Jay, Sept 30): a guess, then "what do they look like?"
    await waitLog('I only know what you tell me', 12000);
    check('a frog becomes a frog-shaped hero (the script\'s own, with the AI off)', await p.evaluate(function () { var h = Project.part('player'); return h.look === 'hero' && h.shape && h.shape.body === 'wide'; }));
    check('the filler is not its name: "uhh maybe like a frog" is a frog', /Here’s your frog!/.test(await log()) && !/your uhh/i.test(await log()), (await log()).slice(-160));
    await type('purple with big eyes');
    await waitLog('Grab a coin.', 12000);
    check('what she describes is drawn with the rest: still a frog, now purple', await p.evaluate(function () { var h = Project.part('player').shape; return h.body === 'wide' && h.color === '#8e24aa'; }), JSON.stringify(await p.evaluate(function () { return Project.part('player').shape; })));
    check('the Mentor says describing got it closer only because the drawing changed', /closer I get/.test(await log()));
    check('her hero goes in the design doc, in her words, as a start', await p.evaluate(function () { var s = Project.doc().sections.hero; return s.text === 'frog' && s.state === 'started' && s.by === 'kid'; }));
    check('the game\'s name is not asked on the first day: it belongs to the design doc', !/called\?/.test(await log()));
    await runJump(3000); await waitLog('first star', 9000);

    /* A problem nobody planned (Jay, Sept 30: "It should be able to file and create tickets for
       different departments. It also just kinda shoots for the expected tickets"): filed in her words,
       given to a department, fixed in that department's shift, and closed only once it's tested. */
    where = 'a ticket she found herself';
    await p.evaluate(function () { delete Quest.dev.state().tickets['silent-coins']; delete Quest.dev.state().tickets['harmless-lava']; Quest.dev.jump('first-day', Quest.dev.course().quests['first-day'].beats.map(function (b) { return b.id; }).indexOf('report')); });
    await waitLog('What was broken?', 9000);
    // Jay's playthrough (Sept 30): "Nothing happen", to what happened with the dots, was dug at and kept as an idea
    await type('There are dots on the level when walk into dem');
    await waitLog('Those circles are coins', 9000);
    await type('Nothing happen');
    await p.waitForFunction(function () { return !!Quest.dev.state().tickets['silent-coins']; }, null, { timeout: 9000 });
    check('a dig that names the coins is about the coins: "Nothing happen" is the finding, in all her words', /dots.*Nothing happen/.test((await state()).tickets['silent-coins'].words), (await state()).tickets['silent-coins'].words);
    await type('it should ding');
    await p.waitForFunction(function () { return Quest.dev.state().tickets['silent-coins'].should === 'it should ding'; }, null, { timeout: 9000 });
    await type('the jump feels floaty');
    await waitLog('What happened with it?', 9000);
    await type('when I jump I float down really slowly');
    await p.waitForFunction(function () { return Object.keys(Quest.dev.state().own || {}).length === 1; }, null, { timeout: 9000 });
    const own = await p.evaluate(function () { var S = Quest.dev.state(), id = Object.keys(S.own)[0]; return { t: S.own[id], mine: S.tickets[id], id: id }; });
    check('a finding no ticket planned for is filed anyway, in her words, for a department', own.t.title === 'The jump feels floaty' && own.t.department === 'engineering' && own.mine && own.mine.status === 'open', JSON.stringify(own.t));
    await waitLog('It goes to Engineering', 9000);
    check('and the board shows it, with its department', /Engineering.*The jump feels floaty/.test(await p.$eval('#ticketList [data-key="ticket:' + own.id + '"]', function (e) { return e.textContent; })));
    await type('it should fall faster');
    await p.waitForFunction(function (id) { return !!Quest.dev.state().tickets[id].should; }, own.id, { timeout: 9000 });
    check('her half of the report goes on it too', (await p.evaluate(function (id) { return Quest.dev.state().tickets[id].should; }, own.id)) === 'it should fall faster');
    await type('theres a gap in the floor i walk near');
    await p.waitForFunction(function () { return !!Quest.dev.state().tickets['harmless-lava']; }, null, { timeout: 9000 });
    await waitLog('What should we fix first', 12000);
    await type('the jump one');
    await waitLog('I’m the lead programmer! You found this one yourself', 12000);
    check('picked, it is Engineering\'s shift: the lead programmer takes it', await p.$eval('#dMentor', function (e) { return e.getAttribute('data-who'); }) === 'p' && await task() === 'Fix it, then test it with Play', await task());
    await type('fixed');
    await waitLog('Nothing in the game has changed yet', 9000);
    await p.evaluate(function () { Editor.set('player', 'gravityScale', 1.6); });
    await type('fixed');
    await waitLog('Test it first!', 9000);
    check('"fixed" is not taken on its word: first a change, then a test with Play', await p.evaluate(function (id) { return Quest.dev.state().tickets[id].status; }, own.id) === 'doing');
    await p.click('#bPlay'); await p.waitForTimeout(800); await p.click('#bStop');
    await type('it’s fixed now');
    await waitLog('Ticket closed!', 9000);
    await p.waitForFunction(function (id) { return Quest.dev.state().tickets[id].status === 'done'; }, own.id, { timeout: 9000 });
    check('changed and tested, "fixed" closes it, crossed out on the board', await p.$eval('#ticketList [data-key="ticket:' + own.id + '"]', function (b) { return b.classList.contains('done'); }));
  } catch (e) {
    check('the playthrough got through ' + where, false, e.message.split('\n')[0]);
    await shot(p, 'pzz-failed').catch(function () {});
  }

  /* 5. the interview with a stand-in AI. Each thing the kid types gets a canned director's answer,
     some of them wrong on purpose, and the page has to keep the goals itself. */
  where = 'the interview with a stand-in AI';
  const s = await page();
  let hung = null, told = '';
  const STUB = {
    'Sam Kim': { learned: { first: 'Sam', initial: 'K' }, reply: 'Nice to meet you, Sam! What’s a game you really love?' },
    'runescape for sure': { learned: { games: ['RuneScape'], loves: [{ game: 'RuneScape' }] }, reply: 'Great answer. You’re hired!', show: 'jumps', done: true },
    'the grind': { learned: { loves: [{ game: 'RuneScape', element: 'the grind' }, { game: 'Fortnite', element: 'building', why: 'it is fast' }] }, reply: 'The grind! What makes it feel good?' },
    'you see yourself get stronger': { learned: { loves: [{ game: 'RuneScape', element: 'the grind', why: 'you see yourself get stronger' }] }, reply: 'So you can SEE yourself get stronger. Lots of games have levels. Why RuneScape’s?' },
    'any skill any order': 'hang'
  };
  await s.route('**/api/ai', async function (route) {
    const b = JSON.parse(route.request().postData() || '{}'); told = b.studio || '';
    const a = STUB[b.message];
    if (a === 'hang') { hung = route; return; }   // never answers: the page's own 12 s timeout has to notice
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({ show: null, done: false }, a || { reply: 'Tell me more?', learned: {} })) });
  });
  try {
    await s.goto(BASE + '/login.html');
    await s.waitForSelector('#sChoose:not([hidden])');
    await s.click('#goSignup'); await s.fill('#suCode', CODE); await s.click('#suGo');
    await s.waitForURL(/interview/);
    const sCard = function () { return s.evaluate(function () { return JSON.parse(localStorage.getItem('studio.interview') || '{}'); }); };
    const sIdle = function (ms) { return s.waitForFunction(function () { return !document.getElementById('sendBtn').disabled; }, null, { timeout: ms || 8000 }); };
    const sSay = async function (t, ms) { await sIdle(); await s.fill('#say', t); await s.press('#say', 'Enter'); await s.waitForFunction(function () { return document.getElementById('sendBtn').disabled; }, null, { timeout: 3000 }).catch(function () {}); await sIdle(ms); await s.waitForTimeout(200); };
    await sSay('Sam Kim');
    await sSay('runescape for sure');
    let c = await sCard();
    check('stand-in AI: a "you’re hired" before the why is refused, and no tablet mid-ladder', !c.hired && !(await s.isVisible('#desk')) && !c.showing && c.asking === 'games:element'
      && !/hired/i.test(await s.innerText('#words')), c.asking + ' / ' + (await s.innerText('#words')));
    await sSay('the grind');
    c = await sCard();
    check('stand-in AI: a game the kid never typed is not taken', c.loves.length === 1 && c.games.indexOf('Fortnite') < 0, JSON.stringify(c.loves));
    await sSay('you see yourself get stronger');
    check('stand-in AI: the director is told to ask why, on the rung the kid is on', /Ask WHY/.test(told) && /the grind/.test(told), told.split('\n').filter(function (x) { return /^NOW/.test(x); })[0] || '(no NOW line)');
    c = await sCard();
    check('stand-in AI: the games goal is done by the code once it holds a game, a part and a why', c.loves[0].why === 'you see yourself get stronger' && c.asking === 'contrast', c.asking);
    check('stand-in AI: the clipboard says why, in their words', /you see yourself get stronger/.test(await s.innerText('#notes')));
    const t0 = Date.now();
    await sSay('any skill any order', 20000);
    const took = Date.now() - t0;
    c = await sCard();
    check('stand-in AI: a director that doesn’t answer in 12 s is replaced by the script', took >= 11000 && took < 17000 && c.fails === 1 && !c.scripted && c.loves[0].over === 'any skill any order',
      Math.round(took / 1000) + ' s, fails ' + c.fails + ', over "' + c.loves[0].over + '"');
    await shot(s, 'p05-stand-in');
  } catch (e) {
    check('the playthrough got through ' + where, false, e.message.split('\n')[0]);
    await shot(s, 'pzz-stand-in-failed').catch(function () {});
  }
  if (hung) await hung.abort().catch(function () {});
  check('no page errors along the way', !errors.length, errors.slice(0, 3).join(' / ') || 'none');
  await browser.close();
  done(failed ? 1 : 0);
})().catch(function (e) { console.error(e); done(1); });
