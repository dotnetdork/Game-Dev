/* check-boot.js — start the real server, load the real page in a headless browser, and assert the
 * app actually comes up.
 *
 * Every other check in this suite reads files. This one runs the app. It exists because the
 * checks that read files cannot catch the failures that actually happen: a script renamed but not
 * relinked, a function that moved file and left its caller behind, a load-order change that means
 * something is used before it exists. Those all look fine on disk and produce a blank page.
 *
 * jsdom is not Chrome. It has no layout and no canvas, so anything measuring pixels or drawing is
 * out of scope here — that is what the browser pass is for. What this proves is that the app
 * boots, fetches its course, renders a lesson, and builds its widgets without throwing.
 *
 * Run: node app/tools/check-boot.js
 */
const path = require('path');
const { spawn } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');

/* The same .env the server reads, and for the same reason it reads it: this check has to sign in,
   and when the testing door is configured the password it needs is in there. Without this the
   server would have a password and the test would present an empty one. */
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* dotenv is optional, exactly as in server.js */ }

const PORT = process.env.BOOT_TEST_PORT || 3996;
const ROOT = path.join(__dirname, '..');

let failures = 0;
function check(name, ok, detail) {
  if (ok) { console.log('PASS  ' + name + (detail ? '  — ' + detail : '')); }
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

function waitForServer(url, tries) {
  return fetch(url).catch(function () {
    if (tries <= 0) throw new Error('server did not start');
    return new Promise(function (r) { setTimeout(r, 200); }).then(function () { return waitForServer(url, tries - 1); });
  });
}

const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  env: Object.assign({}, process.env, { PORT: String(PORT), AI_PROVIDER: 'ollama' }),
  stdio: ['ignore', 'ignore', 'pipe']
});
let serverErr = '';
server.stderr.on('data', function (d) { serverErr += d; });

function done(code) { try { server.kill(); } catch (e) {} process.exit(code); }

/* ---- get past the front door ----
   The sign-in page is now the front door in every mode, including a local run with nothing
   configured — so this check has to sign in like a developer does, rather than assuming the app is
   simply open. It presses a provider button and keeps the cookie.

   That is a gain, not a tax: booting the app now also proves the local sign-in path works, which
   nothing else covered. If this ever returns no cookie, the failure below says so directly instead
   of showing up as thirteen unrelated 401s. */
let COOKIE = '';
function withAuth(init) {
  const i = Object.assign({}, init || {});
  i.headers = Object.assign({}, i.headers || {}, COOKIE ? { Cookie: COOKIE } : {});
  return i;
}
/* Whichever door this machine actually has. BYPASS — nothing configured — is the usual one, but a
   developer previewing what the testers will see has TESTER_PASSWORD set in their .env, and that
   turns BYPASS off. The check has to boot the app either way: a local sign-in setting should not
   decide whether the test suite passes.

   `/auth/me` says which doors exist, so it is asked rather than guessed at. */
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
        body: new URLSearchParams({
          username: 'checkboot',
          password: process.env.TESTER_PASSWORD || '',
          next: '/'
        }).toString()
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

waitForServer('http://localhost:' + PORT + '/api/lessons', 40).then(signIn).then(function () {
  const pageErrors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', function (e) {
    // jsdom cannot lay out or paint; those complaints are about jsdom, not about the app.
    if (/not implemented|getContext|canvas/i.test(e.message || '')) return;
    pageErrors.push(e.message);
  });

  const jar = new (require('jsdom').CookieJar)();
  if (COOKIE) { try { jar.setCookieSync(COOKIE + '; Path=/', 'http://localhost:' + PORT + '/'); } catch (e) {} }
  return JSDOM.fromURL('http://localhost:' + PORT + '/', {
    cookieJar: jar,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse: function (win) {
      /* Two things jsdom does not provide that the app legitimately needs. Both are gaps in the
         test environment, not in the app, so they are filled rather than worked around:

         1. fetch. Node has it globally, but a jsdom window is a separate realm and does not.
            Handing it Node's fetch means the page really does talk to the real server. */
      win.fetch = function (input, init) {
        const url = String(input && input.url ? input.url : input);
        return fetch(new URL(url, 'http://localhost:' + PORT + '/').href, withAuth(init));
      };
      /* 2. Layout. CodeMirror measures text by asking a Range for its rectangle, and jsdom has no
            layout engine at all, so every measurement is missing rather than wrong. Returning
            zeroes lets CodeMirror build its DOM; anything that depends on the SIZE of that DOM is
            simply not what this check is for. */
      const zero = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
      win.Range.prototype.getBoundingClientRect = function () { return Object.assign({}, zero); };
      win.Range.prototype.getClientRects = function () { const l = []; l.item = function () { return null; }; return l; };
      win.HTMLElement.prototype.scrollIntoView = function () {};
    }
  }).then(function (dom) {
    const win = dom.window;
    // Give the boot sequence its network round-trips: /api/lessons, then the first lesson body.
    return new Promise(function (r) { setTimeout(function () { r({ win: win, pageErrors: pageErrors }); }, 2500); });
  });
}).then(function (ctx) {
  const win = ctx.win, doc = win.document;
  const $ = function (s) { return doc.querySelector(s); };
  const $$ = function (s) { return doc.querySelectorAll(s); };

  console.log('--- the page itself ---');
  check('no uncaught errors during boot', ctx.pageErrors.length === 0, ctx.pageErrors.join(' | ') || 'clean');
  check('the three-column shell is present',
    !!$('.dock.left') && !!$('main.center') && !!$('.dock.right'));
  check('both docks and main are inside #editor',
    !!$('#editor .dock.left') && !!$('#editor main.center') && !!$('#editor .dock.right'));
  check('landmarks are present',
    !!$('header') && !!$('nav') && !!$('main') && !!$('footer') && !!$('.skiplink'));

  console.log('\n--- the course loaded ---');
  const rows = $$('#tree .lesson-row');
  check('the outline has lesson rows', rows.length > 0, rows.length + ' lessons');
  check('module headers are present', $$('#tree .sec-head').length > 0, $$('#tree .sec-head').length + ' modules');
  check('outline rows are real buttons with tree semantics',
    [].every.call(rows, function (r) { return r.tagName === 'BUTTON' && r.getAttribute('role') === 'treeitem'; }));
  check('every lesson row has a title',
    [].every.call(rows, function (r) { return (r.textContent || '').trim().length > 0; }));

  console.log('\n--- the first lesson rendered ---');
  const body = $('#lessonBody');
  check('the lesson has a heading', !!$('#lessonBody h1'), $('#lessonBody h1') && $('#lessonBody h1').textContent.trim());
  check('the lesson has content', !!$('.lesson-content') && $('.lesson-content').textContent.trim().length > 50);
  check('the progress strip is present', !!$('#lessonProgress'));
  check('the lesson body is not an error message',
    !/Could not load this lesson/.test(body ? body.textContent : ''));

  console.log('\n--- state ---');
  // `let project` / `let state` are lexical bindings at script scope, so they are not properties
  // of window. Ask the page to evaluate them instead of reaching for win.project.
  const peek = function (expr) { try { return win.eval(expr); } catch (e) { return undefined; } };
  const proj = peek('project'), st = peek('state');
  check('a project was created', !!proj && typeof proj.files === 'object',
    proj ? Object.keys(proj.files).length + ' files' : 'none');
  /* That it IS stamped, not what the number is. A bump is a normal event — pinning the version here
     turns every migration into a red suite and teaches people to edit the assertion. check-state.js
     is the one that proves migration actually works. */
  check('the project is schema-stamped', proj && typeof proj.v === 'number' && proj.v >= 1, 'v' + (proj && proj.v));
  check('progress is schema-stamped', st && typeof st.v === 'number' && st.v >= 1, 'v' + (st && st.v));
  check('nothing was quarantined',
    Object.keys(win.localStorage).filter(function (k) { return k.indexOf('.broken.') > -1; }).length === 0);

  /* A lesson's id is its progress key — state.done, activities, labs and practice all hang off it.
     So these two are not style checks. An empty id collapses every lesson without one into a single
     record (finish one, they all tick); a duplicate merges two lessons' ticks, answers and lab
     drafts; a ':' would break the "<lessonId>:<widgetKey>" format that labs and practice use; and
     '__proto__' would be swallowed by the prototype setter and read back truthy forever.
     Asserted here rather than in check-lessons because this reads the real course through the real
     server — so it catches a bad id the moment one is added to course.yaml. */
  const ids = peek('flat.map(function (f) { return f.id; })') || [];
  check('every lesson id is a usable storage key', ids.length > 0 && ids.every(function (id) {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
  }), ids.filter(function (id) { return !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id); }).join(', ') || ids.length + ' ids');
  check('every lesson id is unique', new Set(ids).size === ids.length,
    ids.length - new Set(ids).size + ' duplicated');

  console.log('\n--- the heavy libraries stayed off the boot path ---');
  check('JSHint is not loaded at boot', typeof win.JSHINT === 'undefined');
  check('Prettier is not loaded at boot', typeof win.prettier === 'undefined');
  check('CodeMirror IS loaded at boot (lessons need it)', typeof win.CodeMirror === 'function');

  /* The Help page lists who made every borrowed picture, and the whole point of building that list
     on the server from the lessons is that it cannot fall behind them. This is the assertion that
     makes that true rather than merely intended: gather the credits straight off disk and require
     the endpoint to account for every one. Add a figure with a new credit and forget something,
     and this fails instead of the course quietly under-attributing a picture it is showing. */
  console.log('\n--- the picture credits ---');
  const fs = require('fs');
  const LESSONS = path.join(ROOT, 'content', 'lessons');
  const flat = function (s) {
    return String(s).replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();
  };
  /* Only the lessons course.yaml actually lists, and only credits attached to a figure — the same
     two things the endpoint scans. A draft lesson sitting in the folder unlisted is shown to
     nobody, and a <cite> in prose is not a picture credit; counting either here would fail the
     build over a picture that is not under-attributed because it is not on screen at all. */
  const onDisk = new Set();
  return fetch('http://localhost:' + PORT + '/api/lessons', withAuth())
    .then(function (r) { return r.json(); })
    .then(function (index) {
      (index.modules || []).forEach(function (mod) {
        (mod.lessons || []).forEach(function (lesson) {
          let raw = '';
          try { raw = fs.readFileSync(path.join(LESSONS, lesson.id + '.md'), 'utf8'); } catch (e) { return; }
          const figs = /<figure\b[^>]*>([\s\S]*?)<\/figure>/g;
          let fig;
          while ((fig = figs.exec(raw))) {
            const cited = (fig[1] || '').match(/<cite\b[^>]*>([\s\S]*?)<\/cite>/);
            if (!cited) continue;
            const t = flat(cited[1]);
            if (t) onDisk.add(t);
          }
        });
      });
      return fetch('http://localhost:' + PORT + '/api/credits', withAuth());
    })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
    .then(function (data) {
      const served = new Set((data.credits || []).map(function (c) { return c.credit; }));
      const missing = Array.from(onDisk).filter(function (c) { return !served.has(c); });
      const extra = Array.from(served).filter(function (c) { return !onDisk.has(c); });
      check('the lessons have credits to serve', onDisk.size > 0, onDisk.size + ' distinct');
      check('every credit in the lessons is on the credits page', missing.length === 0,
        missing.length ? missing[0] : served.size + ' served');
      check('the credits page invents nothing', extra.length === 0, extra.length ? extra[0] : 'clean');
      check('every credit names at least one lesson and one picture',
        (data.credits || []).every(function (c) { return c.pictures > 0 && c.lessons.length > 0; }));
    })
    .catch(function (e) { check('the credits endpoint answers', false, e.message); })
    .then(function () {
      console.log('\n' + (failures ? failures + ' failing' : 'the app boots'));
      done(failures ? 1 : 0);
    });
}).catch(function (e) {
  console.error('check-boot could not run: ' + e.message);
  if (serverErr) console.error(serverErr.slice(0, 800));
  done(1);
});
