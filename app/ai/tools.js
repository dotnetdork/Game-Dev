// ============================================================
//  The tools an agent can call to look something up instead of
//  guessing: what the student owns, what a lesson says, what is
//  in one of their files, and what a Phaser API is actually called.
//
//  This table IS the MCP surface (Stage 5). Keep each tool a plain
//  function of (args, ctx) with a JSON-schema description, and the
//  MCP server becomes a thin wrapper rather than a rewrite.
//
//  Everything here is READ ONLY. Tools answer questions; the coder
//  still changes the game through the ops contract, which the
//  student reviews. Nothing in here can write to a student's project.
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LESSONS = path.join(ROOT, 'content', 'lessons');
const REFERENCE = path.join(__dirname, 'reference', 'phaser-api.md');
/* The full offline API — the same files the Docs tab serves, generated from Phaser's own doclets by
   tools/build-phaser-docs.js. See the note above searchPhaserApi. */
const API_DIR = path.join(ROOT, 'public', 'phaser-docs');

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const SAFE_FILE = /^[A-Za-z0-9_-]+\.js$/;

/* ---------- the full Phaser API, for the agents ----------
   The same generated files the Docs tab serves. Before this, an agent asking "what is the real name
   of the method that does X" had one place to look: a 5.5 KB hand-written cheat sheet covering the
   twenty or so APIs the course teaches. Anything outside that and it either guessed — which is how a
   wrong method name gets written into a child's game and crashes it — or went to the web, which is
   slow, is blocked on a school network, and answers about whichever Phaser version the page happened
   to describe.

   Now the exact version the student is running is on disk, twenty thousand symbols of it, and the
   answer is local and correct. The index is a megabyte; it is read once and kept.

   READ ONLY, like everything else in this file. */
let apiIndexCache = null, apiMetaCache = null;
const apiPageCache = {};
function apiMeta() {
  if (apiMetaCache !== null) return apiMetaCache || null;
  try { apiMetaCache = JSON.parse(fs.readFileSync(path.join(API_DIR, 'meta.json'), 'utf8')); }
  catch (e) { apiMetaCache = false; }
  return apiMetaCache || null;
}
function apiIndex() {
  if (apiIndexCache) return apiIndexCache;
  let text = '';
  try { text = fs.readFileSync(path.join(API_DIR, 'index.tsv'), 'utf8'); }
  catch (e) { apiIndexCache = []; return apiIndexCache; }
  apiIndexCache = text.split('\n').map(function (L) {
    const a = L.indexOf('\t'); if (a < 0) return null;
    const b = L.indexOf('\t', a + 1); if (b < 0) return null;
    const ln = L.slice(0, a);
    let cut = ln.lastIndexOf('#');
    const dot = ln.lastIndexOf('.');
    if (dot > cut) cut = dot;
    return { ln: ln, nm: cut >= 0 ? ln.slice(cut + 1) : ln, k: L.slice(a + 1, b), p: +L.slice(b + 1) };
  }).filter(Boolean);
  return apiIndexCache;
}
function apiPage(id) {
  if (apiPageCache[id]) return apiPageCache[id];
  try { apiPageCache[id] = JSON.parse(fs.readFileSync(path.join(API_DIR, 'pages', id + '.json'), 'utf8')); }
  catch (e) { apiPageCache[id] = null; }
  return apiPageCache[id];
}
/* One member, written out the way an agent needs to read it: the call, what each argument is, what
   comes back. Trimmed hard — a model does not need Phaser's three-paragraph essay on bloom, and
   twenty thousand symbols of untrimmed prose would fill the context window six times over. */
function apiMemberText(pg, m) {
  const args = (m.p || []).map(function (p) { return p.o ? '[' + p.n + ']' : p.n; }).join(', ');
  const sig = m.k === 'function' ? m.n + '(' + args + ')' : m.n;
  const lines = [pg.l + (m.s ? '.' : '#') + sig];
  if (m.x) lines.push(String(m.x).replace(/\s+/g, ' ').slice(0, 300));
  (m.p || []).forEach(function (p) {
    lines.push('  ' + p.n + (p.o ? ' (optional)' : '') + (p.t ? ' : ' + p.t.join('|') : '')
      + (p.d !== undefined ? ' = ' + p.d : '')
      + (p.x ? ' — ' + String(p.x).replace(/\s+/g, ' ').slice(0, 140) : ''));
  });
  if (m.r) lines.push('  returns ' + ((m.r.t || []).join('|') || '?')
    + (m.r.x ? ' — ' + String(m.r.x).replace(/\s+/g, ' ').slice(0, 140) : ''));
  if (m.eg && m.eg[0]) lines.push('  example: ' + String(m.eg[0]).replace(/\s+/g, ' ').slice(0, 220));
  return lines.join('\n');
}
/* Same ranking as the Docs search box, for the same reason — a query is a piece of an identifier,
   not a sentence. Kept deliberately simple so the two never disagree about what "best match" means. */
function searchPhaserApi(query, limit) {
  const idx = apiIndex();
  if (!idx.length) return [];
  const s = String(query || '').trim().toLowerCase();
  if (!s) return [];
  const words = s.split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
  const hits = [];
  const PAGE_KIND = { class: 1, namespace: 1, typedef: 1, interface: 1, mixin: 1 };
  for (let i = 0; i < idx.length; i++) {
    const e = idx[i];
    const nm = e.nm.toLowerCase();
    const ln = e.ln.toLowerCase();
    let score;
    /* AN EXACT FULL NAME WINS OUTRIGHT. Asking for "Phaser.Physics.Arcade.Sprite" used to return
       Sprite#w and Sprite#x: every member of the class contains the query in its own longname too,
       so they all tied at the substring score and the shortest name came first. The one thing the
       query named exactly has to beat the three hundred things merely inside it. */
    if (ln === s) score = 0;
    else if (nm === s) score = 1;
    else if (nm.indexOf(s) === 0) score = 2;
    else if (nm.indexOf(s) > 0) score = 3;
    else if (ln.indexOf(s) >= 0) score = 4;
    else {
      /* A plain-English query — "make something spin" — matches nothing as a substring, so fall
         back to its words. One short word is not a match: "make" alone pulled up Phaser.Scene#make
         for a question about rotation, which is a confident wrong answer and the exact thing this
         tool exists to stop. Two words, or one long one. */
      const hitWords = words.filter(function (w) { return nm.indexOf(w) >= 0; });
      const strong = hitWords.length >= 2 || (hitWords.length === 1 && hitWords[0].length >= 5);
      if (!strong) continue;
      score = 7 - Math.min(hitWords.length, 2);
    }
    /* A class before a property of it, when the score is otherwise equal. */
    hits.push({ e: e, s: score * 1000 + (PAGE_KIND[e.k] ? 0 : 100) + Math.min(nm.length, 99) });
    if (hits.length > 3000) break;
  }
  hits.sort(function (a, b) { return a.s - b.s; });
  const out = [];
  const seen = {};
  for (let i = 0; i < hits.length && out.length < (limit || 6); i++) {
    const e = hits[i].e;
    if (seen[e.ln]) continue;
    seen[e.ln] = 1;
    const pg = apiPage(e.p);
    if (!pg) continue;
    if (e.ln === pg.l) {
      out.push(pg.l + '  (' + pg.k + ')\n'
        + (pg.x ? String(pg.x).replace(/\s+/g, ' ').slice(0, 300) : '')
        + (pg.m && pg.m.length ? '\n  has ' + pg.m.length + ' members; search a name to see one' : ''));
      continue;
    }
    const m = (pg.m || []).filter(function (x) { return x.n === e.nm; })[0];
    if (m) out.push(apiMemberText(pg, m));
  }
  return out;
}

let catalogCache = null, bundleCache = null;
/* The Store catalogue. assets-manifest.js is a generated browser file, so it is RUN against a stand-in
   `window` rather than duplicated into a second source of truth.

   It used to be sliced out with `src.slice(indexOf('['), lastIndexOf(']'))`, which worked only while
   the file held exactly one array. It now assigns three (STORE_PACKS, STORE_BUNDLES, STORE_ASSETS),
   so that slice spanned all of them and JSON.parse threw — leaving the catalogue empty and
   search_store silently returning nothing at all. Evaluating it cannot drift like that. */
function loadManifest() {
  if (catalogCache) return;
  try {
    const src = fs.readFileSync(path.join(ROOT, 'public', 'assets-manifest.js'), 'utf8');
    const win = {};
    new Function('window', src)(win);          // no require cache, no global pollution
    catalogCache = win.STORE_ASSETS || [];
    bundleCache = win.STORE_BUNDLES || [];
  } catch (e) { catalogCache = []; bundleCache = []; }
}
function catalog() { loadManifest(); return catalogCache; }
function catalogBundles() { loadManifest(); return bundleCache; }

const TOOLS = [
  {
    name: 'list_owned_assets',
    description: "List the art and sound keys this student owns. These are the ONLY asset keys that exist for them — anything else fails to load and breaks the game. Call this before using any asset key you are not certain about.",
    parameters: { type: 'object', properties: {}, required: [] },
    run: function (args, ctx) {
      const owned = ctx.assets || [];
      if (!owned.length) return { owned: [], note: 'This student owns no assets yet.' };
      const meta = {};
      catalog().forEach(function (a) { meta[a.key] = a; });
      return { owned: owned.map(function (a) {
        const m = meta[a.key] || {};
        return { key: a.key, type: a.type, category: m.cat || '', usage: m.hint || '' };
      }) };
    }
  },
  {
    name: 'search_store',
    description: 'Search the Store for art or sounds the student does NOT own yet, so you can tell them what to buy. Never use a key from here in code — they do not own it.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'what to look for, e.g. "dragon" or "explosion"' } }, required: ['query'] },
    run: function (args, ctx) {
      const q = String(args.query || '').toLowerCase().trim();
      if (!q) return { matches: [] };
      const ownedKeys = {};
      (ctx.assets || []).forEach(function (a) { ownedKeys[a.key] = true; });
      const text = function (o) { return (o.key + ' ' + o.id + ' ' + o.name + ' ' + o.cat + ' ' + (o.desc || '')).toLowerCase(); };
      const out = [];
      /* Bundles first, and a bundle is reported INSTEAD of its members. Characters, enemies and the
         numbered tile sets are sold only as sets, so answering "buy platformer_character_green_idle"
         would send a student looking for a thing the Store has no button for. */
      catalogBundles().forEach(function (b) {
        if (out.length >= 12 || ownedKeys[b.id] || text(b).indexOf(q) < 0) return;
        out.push({ buy: b.id, name: b.name, category: b.cat, cost: b.cost, kind: 'set',
          pieces: b.count, note: 'Sold as one set of ' + b.count + ' pictures.' });
      });
      catalog().forEach(function (a) {
        if (out.length >= 12) return;
        if (ownedKeys[a.key] || a.free) return;
        if (a.bundle) return;                       // reachable only through its set, reported above
        if (text(a).indexOf(q) < 0) return;
        out.push({ buy: a.key, name: a.name, category: a.cat, cost: a.cost, kind: 'single' });
      });
      return { matches: out };
    }
  },
  {
    name: 'read_file',
    description: "Read one of the student's project files in full. Use this when you need to change code that lives outside game.js, or to check what a helper function actually does before calling it.",
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'file name, e.g. "player.js"' } }, required: ['name'] },
    run: function (args, ctx) {
      const name = String(args.name || '').trim();
      if (!SAFE_FILE.test(name)) return { error: 'Not a valid file name.' };
      if (name === 'game.js') return { name: name, code: ctx.gameCode || '' };
      const f = (ctx.files || []).filter(function (x) { return x.name === name; })[0];
      if (!f) return { error: 'No such file. The project has: ' + ['game.js'].concat((ctx.files || []).map(function (x) { return x.name; })).join(', ') };
      if (!f.code) return { error: 'That file exists but its contents were not sent with this request.' };
      return { name: name, code: f.code };
    }
  },
  {
    name: 'search_phaser_docs',
    description: 'Look up how to do something in Phaser 4 — the real method names, their arguments and what they return, for movement, collisions, keys, sound, tweens, drawing and everything else. Searches the course reference first and then the complete offline Phaser API that ships with this app. Use this instead of guessing an API, and instead of looking anything up on the web: the answer here is the exact version the student is running.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'what you want to do, e.g. "make something spin", or an exact name like "setVelocityX" or "Phaser.Physics.Arcade.Sprite"' }
      },
      required: ['query']
    },
    run: function (args) {
      const q = String(args.query || '').trim();
      const out = {};

      /* The curated reference first, and it is first on purpose. It is the handful of APIs this
         course actually teaches, written in the shape the student's own code already uses — so an
         answer from here is one they can paste and one they have seen before. The full API below is
         the fallback for everything else. */
      try {
        const doc = fs.readFileSync(REFERENCE, 'utf8');
        const words = q.toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
        const sections = doc.split(/\n(?=## )/).filter(function (s) { return s.indexOf('## ') === 0; });
        const scored = sections.map(function (s) {
          const hay = s.toLowerCase();
          return { s: s, score: words.reduce(function (n, w) { return n + (hay.indexOf(w) >= 0 ? 1 : 0); }, 0) };
        }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; });
        if (scored.length) out.course_reference = scored.slice(0, 3).map(function (x) { return x.s.trim(); });
      } catch (e) { /* the full API below can still answer */ }

      const api = searchPhaserApi(q, 6);
      if (api.length) out.phaser_api = api;

      if (!out.course_reference && !out.phaser_api) {
        return { results: [], note: 'Nothing matched in the course reference or the Phaser API. Do not invent a method name — stick to the patterns already in the student\'s code.' };
      }
      out.note = 'From the offline copy of Phaser ' + (apiMeta() ? apiMeta().version : '') + ' that this app ships. Do not look this up on the web; this is the version the student is running.';
      return out;
    }
  },
  {
    name: 'get_lesson',
    description: 'Read the text of a course lesson, to check what the student has actually been taught before using an idea they may not have met yet.',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'lesson id, e.g. "moving-with-velocity". Omit to get the current lesson.' } }, required: [] },
    run: function (args, ctx) {
      const id = String(args.id || '').trim();
      if (!id) return { title: ctx.lessonTitle || '(none)', text: ctx.lessonContext || 'No lesson text for this request.' };
      if (!SAFE_ID.test(id)) return { error: 'Not a valid lesson id.' };
      try {
        const raw = fs.readFileSync(path.join(LESSONS, id + '.md'), 'utf8');
        const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
        const title = m ? (m[1].match(/^title:\s*(.+)$/m) || [, id])[1].trim() : id;
        return { id: id, title: title, text: (m ? m[2] : raw).slice(0, 4000) };
      } catch (e) {
        return { error: 'No lesson called "' + id + '".' };
      }
    }
  }
];

const BY_NAME = {};
TOOLS.forEach(function (t) { BY_NAME[t.name] = t; });

/* Tool definitions in the shape Ollama and OpenRouter want (OpenAI style). */
function toolSpecs() {
  return TOOLS.map(function (t) {
    return { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } };
  });
}
/* Anthropic uses its own field names for the same thing. */
function anthropicSpecs() {
  return TOOLS.map(function (t) {
    return { name: t.name, description: t.description, input_schema: t.parameters };
  });
}
/* Run one tool. Never throws: a tool failure becomes a result the model can read and recover from. */
function runTool(name, args, ctx) {
  const t = BY_NAME[name];
  if (!t) return { error: 'No tool called "' + name + '". Available: ' + TOOLS.map(function (x) { return x.name; }).join(', ') };
  try { return t.run(args || {}, ctx || {}); }
  catch (e) { return { error: 'That lookup failed: ' + e.message }; }
}

module.exports = { TOOLS: TOOLS, toolSpecs: toolSpecs, anthropicSpecs: anthropicSpecs, runTool: runTool };
