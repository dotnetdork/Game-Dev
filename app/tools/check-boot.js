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

waitForServer('http://localhost:' + PORT + '/api/lessons', 40).then(function () {
  const pageErrors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', function (e) {
    // jsdom cannot lay out or paint; those complaints are about jsdom, not about the app.
    if (/not implemented|getContext|canvas/i.test(e.message || '')) return;
    pageErrors.push(e.message);
  });

  return JSDOM.fromURL('http://localhost:' + PORT + '/', {
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
        return fetch(new URL(url, 'http://localhost:' + PORT + '/').href, init);
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
  check('the project is schema-stamped', proj && proj.v === 1, 'v' + (proj && proj.v));
  check('progress is schema-stamped', st && st.v === 1, 'v' + (st && st.v));
  check('nothing was quarantined',
    Object.keys(win.localStorage).filter(function (k) { return k.indexOf('.broken.') > -1; }).length === 0);

  console.log('\n--- the heavy libraries stayed off the boot path ---');
  check('JSHint is not loaded at boot', typeof win.JSHINT === 'undefined');
  check('Prettier is not loaded at boot', typeof win.prettier === 'undefined');
  check('CodeMirror IS loaded at boot (lessons need it)', typeof win.CodeMirror === 'function');

  console.log('\n' + (failures ? failures + ' failing' : 'the app boots'));
  done(failures ? 1 : 0);
}).catch(function (e) {
  console.error('check-boot could not run: ' + e.message);
  if (serverErr) console.error(serverErr.slice(0, 800));
  done(1);
});
