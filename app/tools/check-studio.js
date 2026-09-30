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
     5. the dev panel is refused on a real deployment, and the kids' page has no reviewer buttons;
     7. schema.js (the Inspector's list) has every setting and component the quests may name, and
        every sprite it lists is one the game's code draws;
     6. the interview is drawn in the studio's own colours (Jay, 2026-09-28: it didn't match), and the
        Studio Director's identity colour is only on the director (never a button or a focus ring). */
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

/* 7: the schema, the quests and the game's pictures agree */
vm.runInContext(read(path.join(STUDIO, 'schema.js')) + '\nthis.__schema = Schema;', ctx);
const schema = ctx.__schema, notInSchema = [];
parts.forEach(function (p) {
  const r = schema.rules(p);
  (vocab[p.id] || []).forEach(function (k) { if (!r[k] && k !== 'shape') notInSchema.push(p.id + '.' + k); });   // shape is the hero drawer's, set by the AI or a typed description
});
check('every setting a quest may name is one the Inspector has (schema.js)', notInSchema.length === 0, notInSchema.join(', ') || 'all in the schema');
const gates = schema.GATES.slice().sort().join(), comps = quests.VOCAB.COMPONENTS.slice().sort().join();
check('the components a quest may allow are exactly the schema\'s gates', gates === comps, 'schema: ' + gates + ' / quests.js: ' + comps);
const gameSrc = read(path.join(STUDIO, 'starter', 'game.js'));
const undrawn = Object.keys(schema.SPRITES).filter(function (k) {
  if (k === 'hero') return !/generateTexture\('hero'/.test(gameSrc);
  const kind = schema.SPRITES[k][1], has = new RegExp('^\\s*' + k + ':\\s*\\[', 'm').test(gameSrc);
  return !has || ((kind === 'floor' || kind === 'lava') && !new RegExp('^\\s*' + k + '_fill:\\s*\\[', 'm').test(gameSrc));
});
check('every sprite the Inspector offers is drawn by the game\'s code (and a floor\'s fill below it)', undrawn.length === 0, undrawn.join(', ') || Object.keys(schema.SPRITES).length + ' sprites');

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
const guard = server.indexOf("app.get('/studio/dev.js'"), stat = server.indexOf("app.use(express.static(path.join(ROOT, 'public')");
check('the dev panel is refused on a real deployment, before static files are served',
  guard > 0 && stat > guard && /auth\.isHosted\(\)\) return res\.status\(404\)/.test(server.slice(guard, guard + 200)));
check('the kids\' page has no reviewer controls', !/Skip ahead|Restart the day|revSkip/.test(PAGES['index.html']));

/* 6: the interview's colours. There is no shared stylesheet (each page is its own plain CSS), so the
   interview repeats the studio's tokens; this is what keeps the copy from drifting back to a look of
   its own. And the director's yellow may only sit on the director: the lanyard, the bubble and its
   tail, the name and the avatar. */
const tokens = function (css) { const out = {}; (css.match(/:root\s*\{([^}]*)\}/) || ['', ''])[1].replace(/--([\w-]+):\s*([^;]+);/g, function (m, k, v) { out[k] = v.trim().toLowerCase(); }); return out; };
const ivCss = read(path.join(STUDIO, 'interview.css')), studioTok = tokens(read(path.join(STUDIO, 'studio.css'))), ivTok = tokens(ivCss);
const SHARED = ['ground', 'frame', 'panel', 'panel-2', 'hover', 'select', 'line-soft', 'ink', 'ink-2', 'ink-3', 'kid-bubble', 'accent', 'accent-ink', 'focus'];
const drift = SHARED.filter(function (k) { return ivTok[k] !== studioTok[k]; });
check('the interview uses the studio\'s colour tokens', drift.length === 0, drift.map(function (k) { return '--' + k + ' ' + ivTok[k] + ' vs ' + studioTok[k]; }).join(', ') || SHARED.length + ' tokens agree');
const DIRECTOR_ONLY = ['.lany', '.bubble', '.bubble::before', '.who b', '.face'];
const misused = [];
ivCss.replace(/([^{}]+)\{([^}]*)\}/g, function (m, sel, body) {
  if (!/var\(--director\)/.test(body)) return;
  sel.split(',').map(function (x) { return x.trim(); }).forEach(function (x) { if (DIRECTOR_ONLY.indexOf(x) < 0) misused.push(x); });
});
check('the director\'s colour is only on the director (never a button or focus ring)', misused.length === 0 && ivTok.director === '#f7d154', misused.join(', ') || 'lanyard, bubble, name, avatar');

if (failed) { console.log('\n' + failed + ' check(s) failed'); process.exit(1); }
console.log('\nstudio: all checks passed');
