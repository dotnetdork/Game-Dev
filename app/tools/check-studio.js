/* check-studio.js: the studio's pages, scripts and quests agree with each other (V2).

   The studio is plain scripts sharing globals (CLAUDE.md, constraint 1), so nothing checks at build
   time that a script finds the element it asks for, or that a quest names a part the game has.
   Each of those fails quietly in class: a panel that never opens, a beat that never finishes. This
   catches them without a browser (tools/check-playthrough.js is the one that plays it for real).

     1. every script and stylesheet a page loads exists;
     2. every element a studio script looks up by id is on the page that loads that script;
     3. the parts the quests may name (quests.js) are exactly the intern's parts (project.js), with
        the same settings;
     4. every event the game sends (starter/game.js) is one the quests know, and back;
     5. the dev panel is refused on a real deployment, and the kids' page has no reviewer buttons. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const quests = require('../quests');

const PUB = path.join(__dirname, '..', 'public');
const STUDIO = path.join(PUB, 'studio');
let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'ok    ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''));
  if (!ok) failed++;
}
const read = (p) => fs.readFileSync(p, 'utf8');

/* 1 and 2: pages, what they load, and the ids their scripts use */
const PAGES = { 'index.html': null, 'interview.html': null, 'login.html': null };
Object.keys(PAGES).forEach(function (page) {
  const html = read(path.join(PUB, page));
  PAGES[page] = html;
  const refs = [];
  html.replace(/<script[^>]+src="([^"]+)"/g, function (m, s) { refs.push(s); });
  html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g, function (m, s) { refs.push(s); });
  const missing = refs.filter(function (s) { return !/^https?:/.test(s) && !fs.existsSync(path.join(PUB, s.replace(/^\//, ''))); });
  check(page + ': every script and stylesheet it loads exists', missing.length === 0, missing.join(', ') || refs.length + ' files');
});

function idsIn(html) { const out = {}; html.replace(/\sid="([^"]+)"/g, function (m, id) { out[id] = true; }); return out; }
function lookups(src) {
  const out = {};
  src.replace(/\$\('([A-Za-z][\w-]*)'\)/g, function (m, id) { out[id] = true; });
  src.replace(/getElementById\('([A-Za-z][\w-]*)'\)/g, function (m, id) { out[id] = true; });
  return Object.keys(out);
}
const LOADED_BY = {};
['index.html', 'interview.html'].forEach(function (page) {
  PAGES[page].replace(/<script[^>]+src="\/studio\/([^"]+)"/g, function (m, f) { (LOADED_BY[f] = LOADED_BY[f] || []).push(page); });
});
Object.keys(LOADED_BY).forEach(function (f) {
  if (f === 'dev.js') return;                               // builds its own panel; its lookups are inside it
  const src = read(path.join(STUDIO, f));
  LOADED_BY[f].forEach(function (page) {
    const ids = idsIn(PAGES[page]);
    const missing = lookups(src).filter(function (id) { return !ids[id]; });
    check('studio/' + f + ': every element it looks up is on ' + page, missing.length === 0, missing.join(', ') || lookups(src).length + ' ids');
  });
});

/* 3: the parts */
const ctx = { localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} }, fetch: function () {} };
vm.createContext(ctx);
vm.runInContext(read(path.join(STUDIO, 'project.js')) + '\nthis.__parts = Project.internsParts();', ctx);
const parts = ctx.__parts, vocab = quests.VOCAB.PARTS;
const ids = parts.map(function (p) { return p.id; }).sort(), known = Object.keys(vocab).sort();
check('the parts quests may name are exactly the intern\'s parts', ids.join() === known.join(), 'project.js: ' + ids.join(', ') + ' / quests.js: ' + known.join(', '));
const noSetting = [];
parts.forEach(function (p) { (vocab[p.id] || []).forEach(function (k) { if (!(k in p)) noSetting.push(p.id + '.' + k); }); });
check('every setting a quest may name is on its part', noSetting.length === 0, noSetting.join(', ') || 'all present');

/* 4: the game's events */
const game = read(path.join(STUDIO, 'starter', 'game.js'));
const sent = {};
game.replace(/Studio\.event\('([a-z-]+)'\)/g, function (m, e) { sent[e] = true; });
const events = quests.VOCAB.EVENTS;
const unknown = Object.keys(sent).filter(function (e) { return events.indexOf(e) < 0; });
const never = events.filter(function (e) { return !sent[e]; });
check('every event the game sends is one the quests know', unknown.length === 0, unknown.join(', ') || Object.keys(sent).join(', '));
check('every event the quests wait on is one the game sends', never.length === 0, never.join(', ') || 'all sent');

/* 5: what a kid must never get */
const server = read(path.join(__dirname, '..', 'server.js'));
const guard = server.indexOf("app.get('/studio/dev.js'"), stat = server.indexOf("app.use(express.static(path.join(ROOT, 'public')))");
check('the dev panel is refused on a real deployment, before static files are served',
  guard > 0 && stat > guard && /auth\.isHosted\(\)\) return res\.status\(404\)/.test(server.slice(guard, guard + 200)));
check('the kids\' page has no reviewer controls', !/Skip ahead|Restart the day|revSkip/.test(PAGES['index.html']));

if (failed) { console.log('\n' + failed + ' check(s) failed'); process.exit(1); }
console.log('\nstudio: all checks passed');
