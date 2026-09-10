/* project.js — The student project itself: load/save, the Markdown sanitizer, XP/Stars state, and the applier that turns the AI's "ops" into edited code. Saving goes through storage.js, never localStorage directly. */
/* ================= app ================= */
const $ = function (id) { return document.getElementById(id); };

/* Every Markdown -> HTML conversion goes through here. marked's output is assigned to
   innerHTML, and AI replies are Markdown written by a model, so something like
   <img src=x onerror=...> in a reply would otherwise execute script in the app's origin.
   DOMPurify strips that and leaves normal lesson/chat formatting alone. If DOMPurify is
   somehow missing we show escaped text rather than inject unchecked HTML. */
function mdToSafeHTML(src) {
  const text = String(src == null ? '' : src);
  if (typeof DOMPurify === 'undefined' || typeof marked === 'undefined') return esc(text);
  return DOMPurify.sanitize(marked.parse(text));
}
let studentId = Storage.read('leagueStudentId');
if (!studentId) { studentId = 'stu-' + Math.random().toString(36).slice(2, 10); Storage.write('leagueStudentId', studentId); }

/* ================= student project (lives in the browser only) =================
   Prebuilt games (above) are read-only templates served by the server. When a
   student opens one it is COPIED into this client-side project. All editing,
   saving, and running happen in the browser (localStorage) — nothing the student
   makes is written back to the server. */
const PKEY = 'leagueProject';

/* ---------- saved-state versioning ----------
   Both saved blobs used to be written as bare JSON with no version on them, and read back with a
   guess at their shape. That is fine until the shape changes once — and the thing in this blob is
   a game a child built and cares about. Anything that reaches a server has to be migratable.

   Rules, for both project and progress:
     - every write stamps the current version
     - a lower version is walked forward through MIGRATIONS, one step at a time
     - a version from the FUTURE (an older build reading a newer save) is left alone, not
       overwritten — the student is probably on two machines, and the newer one still has it
     - anything unreadable is quarantined under its key + '.broken.<timestamp>' rather than
       replaced, so nothing is ever silently destroyed
   `keepBroken` is the important one. Losing a save to a parse error is recoverable; losing it
   because we cheerfully wrote a fresh default over the top of it is not. */
const SCHEMA = { project: 3, progress: 2 };

function keepBroken(key, raw, why) {
  try {
    if (raw) Storage.write(key + '.broken.' + Date.now(), raw);
    console.warn('[league] ' + key + ': ' + why + ' — the old value was kept under ' + key + '.broken.*');
  } catch (e) { /* storage may be full; the warning above is the fallback */ }
}

/* ---------- re-keying progress from a seat number to a lesson ----------
   Every progress record used to hang off '<moduleIndex>.<lessonIndex>' — the id buildFlat() makes
   up in course.js. That is not an identity, it is a seat number. Insert a module at position 2 and
   seventeen lessons move down one seat while every tick, answer, lab draft and practice snapshot
   stays behind on the old seat: a student who finished The Core Loop finds that tick sitting on
   whatever landed at 1.0 instead, and nothing anywhere records which lesson they actually did.

   The key is the lesson's id from course.yaml now — the kebab-case slug that is already in the URL
   and already in `state.at`. It cannot be reordered, because it is not a position.

   The table below is the 22 lessons of the course as it stood BEFORE the reorder, in that order,
   and it is FROZEN. This migration has to answer "what was sitting in seat 3.1 when this save was
   written", and after the reorder course.yaml can no longer answer that. Do not update it when the
   course changes — being out of date with the live course is the entire point of it. */
const V1_COURSE = [
  ['engines',      ['what-an-engine-does', 'physics-and-collision', 'what-a-game-is-made-of', 'from-project-to-playable']],
  ['mechanics',    ['the-core-loop', 'feedback', 'difficulty-and-flow', 'risk-and-reward', 'progression']],
  ['phaser',       ['values-and-variables', 'decisions-and-repeats', 'scenes-create-update', 'input-movement-collision', 'reading-an-error']],
  ['architecture', ['game-state', 'entities-and-components', 'events-not-tangles', 'data-out-of-code']],
  ['assets',       ['sprites-and-animation', 'sound-design', 'juice', 'ship-it']]
];
const V1_LESSON = {};      // '1.0' -> 'the-core-loop'
const V1_MODULE = {};      // '1'   -> 'mechanics'
V1_COURSE.forEach(function (m, mi) {
  V1_MODULE[String(mi)] = m[0];
  m[1].forEach(function (slug, li) { V1_LESSON[mi + '.' + li] = slug; });
});

/* Re-key an object through a function.
   A key the function does not recognise KEEPS ITS NAME rather than being dropped: an unrecognised
   key is far more likely a lesson added after the table above was frozen than it is a mistake, and
   deleting a child's finished lesson to tidy up a namespace is not a trade this code gets to make.
   On a collision the FIRST value wins — two records claiming one lesson means the table is wrong,
   and quietly overwriting the earlier of them would destroy the one they actually earned. */
function rekeyed(obj, fn) {
  const out = {};
  Object.keys(obj || {}).forEach(function (k) {
    const nk = fn(k);
    if (!Object.prototype.hasOwnProperty.call(out, nk)) out[nk] = obj[k];
  });
  return out;
}
/* labs and practice are keyed '<lessonId>:<widgetKey>' (labKey, below). Only the half before the
   FIRST colon is a lesson; 'the-core-loop:c0' has to keep its ':c0'. */
function rekeyedPrefix(obj, fn) {
  return rekeyed(obj, function (k) {
    const i = k.indexOf(':');
    return i < 0 ? fn(k) : fn(k.slice(0, i)) + k.slice(i);
  });
}

/* Each entry migrates FROM its key TO the next version. The un-numbered blobs that came before v1
   are handled by adopt() in loadProject(). */
const MIGRATIONS = {
  project: {
    /* v1 -> v2: a project gained an ASSET LIST.
       Owning a picture and loading it used to be the same thing: every owned asset was injected
       into the game frame and load.image()d on every single Run. That was fine at 265 assets when
       nobody owned many. The Store now sells 400-tile sets, so it is 400 requests before create()
       runs, on a school network.
       So the two are separate now — `assets` is what this project LOADS, curated in the content
       browser. Filling it needs `state.unlocked`, which does not exist yet at this point in the
       boot (state is built further down this file), so it is left null here and materialised by
       ensureProjectAssets() on first use. Null means "everything owned", which is exactly the old
       behaviour — an existing student's game cannot break by opening it. */
    1: function (p) { p.assets = null; return p; },
    /* v2 -> v3: a project gained a place to write in.
       design.md is the student's one-sheet — the game they are going to make, next to the code of
       the game they were given. Added rather than replaced: if a project somehow already has the
       file, whatever is in it is the student's writing and this must not touch it.
       It goes to the FRONT of `order` because that is where they will look for it, and order is
       only the file tree — load order skips it entirely (see isCodeFile). */
    2: function (p) {
      if (typeof p.files['design.md'] !== 'string') p.files['design.md'] = STARTER['design.md'];
      if (p.order.indexOf('design.md') < 0) p.order.unshift('design.md');
      return p;
    }
  },
  progress: {
    /* v0 -> v1: nothing changes in the shape. But the step has to EXIST.
       migrate() treats a missing step as "the shape did not change" and stamps the blob straight to
       the target version — so without this, a save from before versioning (no `v` at all, therefore
       v0) would jump past the v1 -> v2 re-key below without running it. Silently, and for exactly
       the oldest saves, which are the ones with the most in them. */
    0: function (s) { return s; },
    /* v1 -> v2: progress is keyed by the lesson, not by where the lesson sits.
       See the note above V1_COURSE for why, and why that table must never be updated. */
    1: function (s) {
      const lesson = function (id) { return V1_LESSON[id] || id; };
      s.done = rekeyed(s.done, lesson);                       // '1.0'    -> 'the-core-loop'
      s.activities = rekeyed(s.activities, lesson);           // '1.0'    -> { q0: true }
      s.labs = rekeyedPrefix(s.labs, lesson);                 // '1.0:c0' -> 'the-core-loop:c0'
      s.practice = rekeyedPrefix(s.practice, lesson);         // '1.0:y0' -> 'the-core-loop:y0'
      s.modDone = rekeyed(s.modDone, function (mi) {          // '1'      -> 'mechanics'
        return V1_MODULE[String(mi)] || String(mi);
      });
      /* A badge records which lesson awarded it. The trophy case reads the lesson's title out of
         the course rather than this field, so nothing on screen changes — but a stored value that
         says '3.2' once 3.2 is a different lesson is simply false. */
      Object.keys(s.badges || {}).forEach(function (n) {
        const b = s.badges[n];
        if (b && V1_LESSON[b.lesson]) b.lesson = V1_LESSON[b.lesson];
      });
      /* `at` has held the slug since the router existed (rememberPlace, js/router.js). A save older
         than the router has a position there; map that rather than sending the student to lesson
         one. Looked up rather than transformed, so a value that is ALREADY a slug is not in the
         table and passes through untouched. */
      if (V1_LESSON[s.at]) s.at = V1_LESSON[s.at];
      return s;
    }
  }
};

function migrate(kind, data) {
  let v = typeof data.v === 'number' ? data.v : 0;
  const target = SCHEMA[kind];
  if (v > target) return { data: data, status: 'future' };
  while (v < target) {
    const step = MIGRATIONS[kind][v];
    if (!step) { data.v = target; break; }   // no step recorded: the shape did not change
    data = step(data); v = data.v = v + 1;
  }
  return { data: data, status: 'ok' };
}

function defaultProject() {
  const files = {};
  STARTER_ORDER.forEach(function (n) { files[n] = STARTER[n]; });
  /* A new project starts with the free assets in it — the three 1-bit tiles the starter game is
     built from, plus the classic player/grass/sky/coin and the two sounds. `window.STORE_ASSETS` is
     safe to read here: assets-manifest.js is the first script on the page. */
  const free = (window.STORE_ASSETS || []).filter(function (a) { return a.free; }).map(function (a) { return a.key; });
  return { v: SCHEMA.project, files: files, order: STARTER_ORDER.slice(), assets: free };
}
function loadProject() {
  const raw = Storage.read(PKEY);
  if (!raw) return defaultProject();
  let p;
  try { p = JSON.parse(raw); } catch (e) { keepBroken(PKEY, raw, 'could not be read'); return defaultProject(); }
  // adopt(): a pre-versioning save is recognised by its shape and stamped as v1 rather than
  // discarded. Every existing student is in this branch exactly once.
  if (!p || !p.files || typeof p.files['game.js'] !== 'string') {
    keepBroken(PKEY, raw, 'was not a project we recognise');
    return defaultProject();
  }
  if (!Array.isArray(p.order)) p.order = Object.keys(p.files);
  const r = migrate('project', p);
  if (r.status === 'future') console.warn('[league] project was saved by a newer version of the app; leaving it untouched.');
  return r.data;
}
let project = loadProject();
/* Every route into the student's files ends here — the editor's save, an applied AI op, a new or
   deleted file — which makes it the one honest place to tell an open build checkpoint that its
   objectives might have just been met. zoneTick debounces and does nothing when no checkpoint is
   open; see the header above it in zone.js. */
function saveProject() {
  project.v = SCHEMA.project;
  Storage.writeJSON(PKEY, project);
  if (typeof zoneTick === 'function') zoneTick();
}
function fileNames() { const out = project.order.filter(function (n) { return project.files[n] !== undefined; }); Object.keys(project.files).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); return out; }
/* ---------- which files are code, and which are just writing ----------
   Every project file used to be JavaScript, and everything that walks the project assumed it: the
   game runner wraps each one in a <script>, the practice checker parses each one, the editor lints
   each one. `design.md` is prose — the student's one-sheet, sitting next to the code the way a
   design doc does in a real project — so each of those places asks this first.
   Kept here rather than in each caller because "is this file code?" must have one answer. A file
   the runner skips but the linter checks would report syntax errors in a child's game idea. */
function isCodeFile(name) { return /\.js$/i.test(String(name || '')); }
function codeFileNames() { return fileNames().filter(isCodeFile); }
const CONFIG_FILE = 'config.js';
// Projects saved before the starter was split still keep CONFIG inside game.js.
function configFile() { return typeof project.files[CONFIG_FILE] === 'string' ? CONFIG_FILE : 'game.js'; }
/* ---------- does this code look structurally whole? ----------
   This used to be `try { new Function(code); return true } catch { return false }`, which reads
   like the obvious answer and **never worked in the browser at all**.

   The app's own Content Security Policy sets `script-src 'self' 'unsafe-inline'` with no
   'unsafe-eval' (server.js), and `new Function` is eval. So every call threw EvalError, the catch
   swallowed it, and validJS returned false for every input it was ever given — including code that
   was perfectly fine. Two features quietly depended on it:
     - ai.js:97  marked every proposed AI change as "broken code"
     - ai.js:311 gated applying a CONFIG-only tweak, so those were never applied
   Nothing looked broken from the outside, which is why it lasted. It only surfaced when a practice
   rule started reporting a syntax error in a file that plainly had none.

   So: a scanner instead of an evaluator. It walks the source skipping comments, strings and
   template literals, and checks that (), [] and {} balance and that no string or block comment is
   left open. That is not a parser and does not pretend to be — it will not notice `let 1x = 2`.
   It does catch the errors that actually happen: an unclosed brace, a missing bracket, a quote
   left open. Those are what a student produces and what a model truncating its output produces.

   Deliberately conservative about what it calls broken, because a false "your game is broken"
   blocks a student who has done nothing wrong. */
function validJS(code) {
  const s = String(code == null ? '' : code);
  const want = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { const nl = s.indexOf('\n', i); if (nl < 0) break; i = nl + 1; continue; }
    if (c === '/' && n === '*') { const e = s.indexOf('*/', i + 2); if (e < 0) return false; i = e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      let closed = false;
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue; }
        if (s[i] === q) { closed = true; i++; break; }
        // A plain quote does not survive a newline; a template literal does.
        if (q !== '`' && s[i] === '\n') break;
        i++;
      }
      if (!closed) return false;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') { stack.push(c); i++; continue; }
    if (c === ')' || c === ']' || c === '}') { if (stack.pop() !== want[c]) return false; i++; continue; }
    i++;
  }
  return stack.length === 0;
}

/* read the CONFIG object's numeric keys (client-side) */
function parseConfig(code) {
  const cfg = {}; const m = code.match(/CONFIG\s*=\s*\{([\s\S]*?)\}/);
  if (m) { const re = /([A-Za-z_$][\w$]*)\s*:\s*(-?[0-9.]+)/g; let mm; while ((mm = re.exec(m[1]))) cfg[mm[1]] = Number(mm[2]); }
  return cfg;
}

/* ----- surgical-edit helpers: apply the AI's ops to game.js without a full rewrite ----- */

/* Index of the closing brace of a function's body, or -1 if it can't be found cleanly.
   Skips strings, template literals and comments — a `{` inside "Coins: {0}" or a commented-out
   block used to throw the brace count off and splice code into the wrong place. */
function fnBodyEnd(code, fnName) {
  const sig = code.search(new RegExp('function\\s+' + fnName.replace(/[^\w$]/g, '') + '\\s*\\('));
  if (sig < 0) return -1;
  const open = code.indexOf('{', sig);
  if (open < 0) return -1;
  let depth = 0, quote = null;
  for (let i = open; i < code.length; i++) {
    const c = code[i], next = code[i + 1];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && next === '/') { const nl = code.indexOf('\n', i); if (nl < 0) return -1; i = nl; continue; }
    if (c === '/' && next === '*') { const end = code.indexOf('*/', i + 2); if (end < 0) return -1; i = end + 1; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;                                   // unbalanced — refuse rather than guess
}
function insertIntoFn(code, fnName, snippet) {
  const end = fnBodyEnd(code, fnName);
  if (end < 0) return null;                    // caller turns this into "I couldn't make that change"
  return code.slice(0, end) + '  ' + snippet.replace(/\n/g, '\n  ') + '\n' + code.slice(end);
}

/* Line diff (LCS) so the student can see what an AI edit would change before accepting it. */
function lineDiff(before, after) {
  const A = String(before).split('\n'), B = String(after).split('\n');
  const n = A.length, m = B.length;
  if (n * m > 4000000) return null;            // implausibly large; skip the preview
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { rows.push({ t: ' ', text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ t: '-', text: A[i] }); i++; }
    else { rows.push({ t: '+', text: B[j] }); j++; }
  }
  while (i < n) rows.push({ t: '-', text: A[i++] });
  while (j < m) rows.push({ t: '+', text: B[j++] });
  return rows;
}
/* Only the changed parts, with a few lines of context — nobody reads 140 unchanged lines. */
function diffHunks(rows, context) {
  const pad = context === undefined ? 2 : context;
  const keep = rows.map(function () { return false; });
  rows.forEach(function (r, idx) {
    if (r.t === ' ') return;
    for (let k = Math.max(0, idx - pad); k <= Math.min(rows.length - 1, idx + pad); k++) keep[k] = true;
  });
  const out = []; let skipped = false;
  rows.forEach(function (r, idx) {
    if (keep[idx]) { if (skipped) { out.push({ t: '…', text: '' }); skipped = false; } out.push(r); }
    else skipped = true;
  });
  return out;
}
function countChanges(rows) {
  let added = 0, removed = 0;
  rows.forEach(function (r) { if (r.t === '+') added++; else if (r.t === '-') removed++; });
  return { added: added, removed: removed };
}
function mergeConfig(code, obj) {
  const m = code.match(/CONFIG\s*=\s*\{([\s\S]*?)\}/); if (!m) return code;
  let body = m[1];
  Object.keys(obj).forEach(function (k) {
    const re = new RegExp('(\\b' + k + '\\s*:\\s*)(-?[0-9.]+)');
    if (re.test(body)) body = body.replace(re, '$1' + obj[k]);
    else { const t = body.replace(/\s+$/, ''); body = t + (t.endsWith(',') || t.endsWith('{') ? '' : ',') + ' ' + k + ': ' + obj[k] + ' '; }
  });
  return code.replace(/CONFIG\s*=\s*\{[\s\S]*?\}/, 'CONFIG = {' + body + '}');
}
/* Returns the edited code, or null if any op could not be applied cleanly. Refusing beats
   splicing a snippet into the wrong place and handing the student a broken game. */
function applyOps(code, ops) {
  if (typeof ops.replaceFile === 'string' && ops.replaceFile.trim()) return ops.replaceFile;
  if (Array.isArray(ops.functions)) ops.functions.forEach(function (f) { if (typeof f === 'string' && f.trim()) code += '\n\n' + f.trim() + '\n'; });
  if (typeof ops.create === 'string' && ops.create.trim()) {
    code = insertIntoFn(code, 'create', ops.create.trim());
    if (code === null) return null;
  }
  if (typeof ops.update === 'string' && ops.update.trim()) {
    code = insertIntoFn(code, 'update', ops.update.trim());
    if (code === null) return null;
  }
  return code;
}
/* A change the student should read before it lands: anything beyond CONFIG numbers.
   Tweaking jumpPower is a slider; adding a function is a change to their program. */
function opsChangeCode(ops) {
  return ['functions', 'create', 'update', 'newFile', 'editFile', 'replaceFile'].some(function (k) {
    const v = ops[k];
    if (k === 'functions') return Array.isArray(v) && v.some(function (f) { return typeof f === 'string' && f.trim(); });
    if (k === 'newFile' || k === 'editFile') return v && typeof v.code === 'string' && v.code.trim();
    return typeof v === 'string' && v.trim();
  });
}

/* Does a rewritten file still declare everything the old one did? Guards against a model that
   describes a file instead of reproducing it, which would silently delete working code. */
function topLevelNames(code) {
  return (String(code).match(/^(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/gm) || [])
    .map(function (d) { return d.split(/\s+/)[1]; });
}
function keepsTopLevelFunctions(before, after) {
  const had = topLevelNames(before), has = topLevelNames(after);
  return had.every(function (n) { return has.indexOf(n) >= 0; });
}

/* Every file a set of ops would touch, as {name, before, after}. The game is split across
   several files now, so a change to how the player moves lands in player.js, not game.js.
   Returns null if any part could not be applied cleanly. */
function opsToChanges(ops) {
  const changes = [];
  const push = function (name, after) {
    const before = project.files[name] === undefined ? '' : project.files[name];
    if (after !== before) changes.push({ name: name, before: before, after: after });
  };
  // game.js: the surgical ops
  const gameOps = {};
  ['functions', 'create', 'update', 'replaceFile'].forEach(function (k) { if (ops[k] !== undefined) gameOps[k] = ops[k]; });
  if (Object.keys(gameOps).length) {
    const after = applyOps(project.files['game.js'] || '', gameOps);
    if (after === null) return null;
    push('game.js', after);
  }
  // any other existing file, sent back whole
  if (ops.editFile && typeof ops.editFile.name === 'string' && typeof ops.editFile.code === 'string') {
    const nm = ops.editFile.name.trim();
    if (/^[A-Za-z0-9_-]+\.js$/.test(nm) && project.files[nm] !== undefined) {
      // Rewriting a whole file must not quietly lose what was in it. A model that summarises
      // the file instead of copying it out ("// the rest of player.js here") would delete the
      // student's functions and break the game, so refuse rather than show that as a change.
      if (!keepsTopLevelFunctions(project.files[nm], ops.editFile.code)) return null;
      push(nm, ops.editFile.code);
    }
  }
  // a brand new file
  if (ops.newFile && typeof ops.newFile.name === 'string' && typeof ops.newFile.code === 'string') {
    let nm = ops.newFile.name.trim(); if (!/\.js$/.test(nm)) nm += '.js';
    if (/^[A-Za-z0-9_-]+\.js$/.test(nm)) push(nm, ops.newFile.code);
  }
  return changes;
}

const SKEY = 'leagueProgress';
/* `labs` is separate from `activities` on purpose. `activities` answers "is this done?" and is
   read with !!, so putting a draft in there would mark an unfinished lab as complete. This holds
   the working state of a lab instead — the code as they left it, whether they have committed to a
   guess, how many runs have failed — keyed "<lessonId>:<widgetKey>". A 50-minute class gets
   interrupted; coming back to an empty editor is how you lose a 12-year-old.
   The lesson half of that key is the lesson's id from course.yaml — a slug, never a position. See
   the note above V1_COURSE. */
/* `badges` is new, and it is not a cosmetic addition. Every one of the 22 lessons ends with a
   your-turn step whose card says "Doing this unlocks the <X> badge", and until now nothing anywhere
   awarded, stored or displayed one. The app made a specific promise to a child twenty-two times and
   kept it zero times.
   Shape: badge name -> { at: <when>, lesson: "<lesson id>" }. Keyed by name because the question a
   student asks is "have I got the Bug Hunter badge", not "what did the twelfth lesson give me".
   No schema bump needed: loadState() merges DEFAULT_STATE first, so an older save gains the key
   with an empty object — which is exactly the case check-state.js already covers. */
/* `at` is the lesson id the student was last on, for the case the URL cannot answer — they opened
   a bookmark of "/" or typed the bare address. Before it existed, every arrival started at lesson 1
   regardless of how far through the course they were. See js/router.js. */
/* `chats` is a STRIPPED snapshot of the assistant's conversations — see persistChats in js/ai.js.
   The live threads keep their proposal internals in memory; what is written here is text and
   outcomes only, because a saved diff is both large and unsafe to re-apply against code that has
   changed since. */
const DEFAULT_STATE = { v: SCHEMA.progress, xp: 0, stars: 400, done: {}, modDone: {}, unlocked: {}, published: [], activities: {}, labs: {}, badges: {}, practice: {}, at: '', weekXp: 0, weekStart: 0, chats: { threads: [], current: {} } };
function loadState() {
  const raw = Storage.read(SKEY);
  if (!raw) return Object.assign({}, DEFAULT_STATE);
  let s;
  try { s = JSON.parse(raw); } catch (e) { keepBroken(SKEY, raw, 'could not be read'); return Object.assign({}, DEFAULT_STATE); }
  if (!s || typeof s !== 'object' || Array.isArray(s)) { keepBroken(SKEY, raw, 'was not progress we recognise'); return Object.assign({}, DEFAULT_STATE); }
  const r = migrate('progress', s);
  if (r.status === 'future') console.warn('[league] progress was saved by a newer version of the app; leaving it untouched.');
  // Object.assign order matters: defaults first so a key added in a later release appears, saved
  // values second so nothing the student earned is overwritten by a default.
  return Object.assign({}, DEFAULT_STATE, r.data);
}
let state = loadState();

/* ---------- per-lesson activity ledger ----------
   Which in-lesson activities the student has resolved, keyed lesson id -> widget key
   ("q0", "r1", "c0"). Widget keys come from document order, not Math.random(), so an answer
   survives navigating away, completing the lesson, and closing the browser. This is what
   completion is gated on — a 50-minute class period gets interrupted, and re-answering four
   questions to re-earn something you already earned is how you lose an 11-year-old. */
function lessonActivities(lessonId) {
  return (state.activities && state.activities[lessonId]) || {};
}
function activityDone(lessonId, key) { return !!lessonActivities(lessonId)[key]; }

/* ---------- lab working state ---------- */
function labKey(lessonId, key) { return (lessonId || 'l') + ':' + key; }
function labState(lessonId, key) {
  if (!state.labs) state.labs = {};                       // progress saved before labs existed
  return state.labs[labKey(lessonId, key)] || null;
}
function saveLabState(lessonId, key, patch) {
  if (!state.labs) state.labs = {};
  const k = labKey(lessonId, key);
  state.labs[k] = Object.assign({ code: null, guessed: false, fails: 0, revealed: false, hintsUsed: 0, tutorOffered: false }, state.labs[k], patch);
  saveState();
  return state.labs[k];
}
function clearLabState(lessonId, key) {
  if (state.labs) delete state.labs[labKey(lessonId, key)];
  saveState();
}

/* ---------- practice state ----------
   A practice step asks the student to change their OWN game, so unlike a quiz there is no answer
   to compare against — only a before and an after. `snap` is their project as it stood when they
   first opened the step, which is what makes "did anything actually change?" answerable at all.

   No schema bump: this is a new key with an empty default, and loadState() merges DEFAULT_STATE
   before the saved values, so an older save simply gains it. Same reasoning as badges above — a
   migration is for a shape that CHANGED, and nothing here did. */
function practiceKey(lessonId, key) { return (lessonId || 'l') + ':' + key; }
function practiceState(lessonId, key) {
  if (!state.practice) state.practice = {};
  return state.practice[practiceKey(lessonId, key)] || null;
}
function savePracticeState(lessonId, key, patch) {
  if (!state.practice) state.practice = {};
  const k = practiceKey(lessonId, key);
  state.practice[k] = Object.assign(
    { snap: null, tries: 0, helped: false, passed: false }, state.practice[k], patch);
  saveState();
  return state.practice[k];
}
/* Taken once, when the step is first RENDERED — that is, when the student first sees the task —
   and never overwritten afterwards.

   Both halves of that matter. Taking it later, on the first press of Check, seems tidier and is
   wrong: the ordinary way to do a practice step is to read it, go to the Code tab, do the work, and
   then press Check. Snapshot at that press and "before" already contains their work, so
   `changed_at_least` sees nothing changed and fails the student who did it properly.
   Never overwriting matters for the opposite reason: re-rendering on every visit would keep moving
   "before" forward, and work done in an earlier session would stop counting. */
function practiceSnapshot(lessonId, key) {
  const p = practiceState(lessonId, key);
  if (p && p.snap) return p.snap;
  const snap = {};
  fileNames().forEach(function (n) { snap[n] = project.files[n]; });
  return savePracticeState(lessonId, key, { snap: snap }).snap;
}

/* ---------- checking a practice step by reading the student's code ----------
   Deterministic where a program can be certain, which is most of the time. This runs in the
   browser, costs nothing, works with no network, and cannot be argued with — the AI is only asked
   about the tasks where "did they do it?" is a genuine judgement.

   Every rule is one key in a `check:` list in the lesson. Unknown rule names FAIL LOUDLY rather
   than passing quietly: a typo in a rule name that silently means "yes" would hand out badges for
   nothing, which is the exact failure this whole feature exists to remove. */
function practiceRuleResult(rule, snap) {
  const files = project.files;
  const readFile = function (name) { return typeof files[name] === 'string' ? files[name] : ''; };
  /* Two "everything" readings, because the project is no longer all code.
     allCode is for the rules that reason about PROGRAM structure — a function existing, a call
     inside update(), whether the thing still parses. Handing those a page of English produces
     nonsense: a sentence with the word "const" in it would register as a declaration.
     allFiles is for `contains` and `matches` with no `file:`, which AUTHORING.md documents as
     searching the whole project — and the student's notes are part of their project. A checkpoint
     that asks "have they written their core loop down" needs to be able to find it. */
  const allCode = function () { return codeFileNames().map(readFile).join('\n'); };
  const allFiles = function () { return fileNames().map(readFile).join('\n'); };

  /* ---------- no baseline means nothing has changed yet ----------
     Five of the rules below ask "is this DIFFERENT from when you started", and each one reads its
     before out of `snap`. Handed no snapshot they each fall back to an empty string, and an empty
     string makes EVERYTHING look like the student's work: every CONFIG number differs from a
     number that was never recorded, every function in the starter counts as newly added, every
     file counts as edited.

     That is not hypothetical. A checkpoint door asks whether each objective is done in order to
     draw its ticks, and it has no snapshot to ask with — so every build checkpoint greeted the
     student with "3 of 4 already done" and three green ticks before they had opened it once.

     The honest reading of "different from when you started" with no record of the start is "no".
     Listed by name rather than caught by a default so that a new comparison rule shows up here as
     an omission instead of quietly inheriting the bug. */
  if (!snap && (rule.config_changed || rule.function_added || rule.file_changed || rule.new_file
      || typeof rule.changed_at_least === 'number')) {
    return { ok: false, why: 'you have not started this one yet' };
  }

  if (rule.contains) {
    const f = rule.contains.file, t = String(rule.contains.text || '');
    const hay = f ? readFile(f) : allFiles();
    return { ok: hay.indexOf(t) >= 0, why: 'nothing in ' + (f || 'your game') + ' contains "' + t + '" yet' };
  }
  if (rule.matches) {
    const f = rule.matches.file, src = String(rule.matches.regex || '');
    let re; try { re = new RegExp(src, 'm'); } catch (e) { return { ok: false, bad: 'the `matches:` pattern is not a valid regular expression: ' + src }; }
    return { ok: re.test(f ? readFile(f) : allFiles()), why: 'nothing in ' + (f || 'your game') + ' matches that pattern yet' };
  }
  if (rule.config_changed) {
    const keys = Array.isArray(rule.config_changed) ? rule.config_changed : [rule.config_changed];
    const cf = configFile();
    const before = parseConfig(String((snap && snap[cf]) || '')), after = parseConfig(readFile(cf));
    const moved = keys.filter(function (k) { return before[k] !== after[k]; });
    return { ok: moved.length > 0, why: keys.join(' or ') + ' is still the number it started at' };
  }
  if (rule.function_added) {
    const had = topLevelNames(String((snap && Object.keys(snap).filter(isCodeFile).map(function (n) { return snap[n]; }).join('\n')) || ''));
    const has = topLevelNames(allCode());
    /* `function_added: true` means ANY new top-level name, rather than one in particular. A
       building zone's objective is "write a function for your mechanic" — the whole point is that
       the student chooses what it is called, so there is no name to demand. Naming one is still
       right where the task names it. */
    if (rule.function_added === true) {
      const added = has.filter(function (n) { return had.indexOf(n) < 0; });
      return { ok: added.length > 0, why: 'there is no new function in your game yet' };
    }
    const name = String(rule.function_added);
    return { ok: has.indexOf(name) >= 0 && had.indexOf(name) < 0,
      why: 'there is no new function called ' + name + ' yet' };
  }
  /* They have put a game in the Gallery. The last objective of the last zone in the course, and the
     only check in the set that reads progress rather than code — because publishing is the one
     thing a student does that leaves no trace in their files. */
  if (rule.published) {
    const n = (state && Array.isArray(state.published)) ? state.published.length : 0;
    return { ok: n > 0, why: 'nothing has been published to the Gallery yet' };
  }
  /* One named file is different from how it started. `changed_at_least` counts the whole project,
     which cannot tell "they wired it into game.js" from "they typed a lot into config.js" — and for
     a build objective that distinction is the objective. */
  if (rule.file_changed) {
    const n = String(rule.file_changed);
    const before = (snap && typeof snap[n] === 'string') ? snap[n] : '';
    return { ok: readFile(n) !== before, why: n + ' has not changed yet' };
  }
  if (rule.function_kept) {
    const name = String(rule.function_kept);
    return { ok: topLevelNames(allCode()).indexOf(name) >= 0, why: name + ' is gone from your game' };
  }
  if (rule.called_in_update) {
    /* Inside update(), not merely present in the file. fnBodyEnd skips strings and comments, so a
       call that is commented out does not count — which is the difference between "I wrote it" and
       "it runs". */
    const name = String(rule.called_in_update);
    const hit = codeFileNames().some(function (n) {
      const code = readFile(n);
      const end = fnBodyEnd(code, 'update');
      if (end < 0) return false;
      const open = code.indexOf('{', code.search(/function\s+update\s*\(/));
      if (open < 0 || open >= end) return false;
      return code.slice(open, end).indexOf(name) >= 0;
    });
    return { ok: hit, why: name + ' is not being called inside update() yet' };
  }
  if (rule.new_file) {
    const before = snap ? Object.keys(snap) : [];
    const added = fileNames().filter(function (n) { return before.indexOf(n) < 0; });
    return { ok: added.length > 0, why: 'no new file has been added to your project yet' };
  }
  if (typeof rule.changed_at_least === 'number') {
    let n = 0;
    fileNames().forEach(function (name) {
      const before = (snap && typeof snap[name] === 'string') ? snap[name] : '';
      const rows = lineDiff(before, readFile(name));
      if (rows) { const c = countChanges(rows); n += c.added + c.removed; }
    });
    return { ok: n >= rule.changed_at_least,
      why: 'only ' + n + ' line(s) of your game have changed so far' };
  }
  if (rule.parses) {
    // Code files only. design.md is prose and never parses as JavaScript, so without this every
    // `parses: true` rule in the course would fail for every student, permanently.
    const broken = codeFileNames().filter(function (n) { return !validJS(readFile(n)); });
    return { ok: broken.length === 0, why: broken.length ? broken[0] + ' has a syntax error in it' : '' };
  }
  const named = Object.keys(rule).filter(function (k) { return k !== 'hint'; });
  return { ok: false, bad: 'unknown check rule ' + JSON.stringify(named) + ' — see AUTHORING.md' };
}

/* What changed since the snapshot, as a diff, for the grader to read.
   A diff rather than the whole project on purpose: the grader is judging one specific task, and
   handing a model six thousand lines to find a two-line change in is how it ends up confidently
   judging the wrong code. Per file, only the changed lines with a little context. */
function practiceDiff(snap) {
  const out = [];
  fileNames().forEach(function (name) {
    const before = (snap && typeof snap[name] === 'string') ? snap[name] : '';
    const after = typeof project.files[name] === 'string' ? project.files[name] : '';
    if (before === after) return;
    const rows = lineDiff(before, after);
    if (!rows) { out.push('--- ' + name + ' --- (too large to diff)'); return; }
    const body = diffHunks(rows, 2)
      .map(function (r) { return (r.t === '…' ? '…' : r.t + ' ' + r.text); }).join('\n');
    out.push('--- ' + name + ' ---\n' + body);
  });
  return out.join('\n\n').slice(0, 6000);
}

/* Runs every rule and returns the first failure's hint, because a student given four things wrong
   at once fixes none of them. `bad` is an authoring error, kept separate from a student's work not
   being done yet: one is our bug and one is theirs, and telling them apart matters. */
function checkPracticeRules(rules, snap) {
  if (!Array.isArray(rules) || !rules.length) return { pass: null, hint: '', authoring: [] };
  const authoring = [];
  let firstFail = null;
  rules.forEach(function (rule) {
    if (!rule || typeof rule !== 'object') { authoring.push('a `check:` entry is not a set of keys'); return; }
    const r = practiceRuleResult(rule, snap);
    if (r.bad) { authoring.push(r.bad); return; }
    if (!r.ok && !firstFail) firstFail = { hint: rule.hint || r.why };
  });
  if (authoring.length) return { pass: null, hint: '', authoring: authoring };
  return { pass: !firstFail, hint: firstFail ? firstFail.hint : '', authoring: [] };
}
/* ---------- badges ----------
   Earned by doing the technique in your OWN game — a badge records that you did something.
   Awarding is idempotent: a student who re-opens a finished lesson does not earn it twice and does
   not get told about it again. */
function hasBadge(name) { return !!(state.badges && state.badges[name]); }
function badgeCount() { return state.badges ? Object.keys(state.badges).length : 0; }
function awardBadge(name, lessonId) {
  const n = String(name == null ? '' : name).trim();
  if (!n) return false;
  if (!state.badges) state.badges = {};
  if (state.badges[n]) return false;                 // already earned
  state.badges[n] = { at: Date.now(), lesson: lessonId || '' };
  saveState();
  emit(EV.BADGE_EARNED, { name: n, lesson: lessonId || '' });
  return true;
}

/* ---------- XP, total and this week ----------
   The weekly board needs a weekly number. It did not have one: it ranked the student by their
   ALL-TIME xp against everyone else's weekly figures, so anyone a few lessons in topped the weekly
   board permanently — which is the exact "one child is always first, one is always last" shape a
   resetting board exists to avoid.
   Monday-based, and it rolls over lazily: the first read or award in a new week zeroes the counter.
   No timer has to run, and a laptop that was shut all week catches up the moment it opens. */
function weekStamp(when) {
  const t = new Date(when || Date.now());
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));   // back to Monday
  return t.getTime();
}
function weekXp() {
  const w = weekStamp();
  if (state.weekStart !== w) { state.weekStart = w; state.weekXp = 0; saveState(); }
  return state.weekXp || 0;
}
/* The one place XP is added. Both callers used to do `state.xp += n` and neither could have known
   about the weekly total, which is how it came to be missing. */
function awardXp(n) {
  const amt = Number(n) || 0;
  if (!amt) return;
  weekXp();                                   // rolls the week over first, if it needs it
  state.xp += amt;
  state.weekXp = (state.weekXp || 0) + amt;
  saveState();
}

/* ---------- where Stars come from ----------
   Stars used to arrive in exactly one place: the end of a module, 120-160 at a time, 830 over the
   whole course. Measured against a Store where a character set costs 130, that is a shop a student
   visits six times in fifteen hours. So the currency now pays out for the work as it happens:

     lesson finished      30     every content lesson; the steady income
     checkpoint finished  60     instead of the lesson's 30 - it is the lesson about THEIR game
     practice passed      20     the "your turn": the one task that touches their own project
     lab solved           10     only when they solved it - reading the answer still finishes the
                                 lab, it just does not pay

   plus the module bonus, which stays. About 3,000 over the course from a 400 start, against a
   catalogue where the biggest 400-tile set is 1,000. Every number is here and nowhere else, so the
   economy can be tuned in one place and the toasts stay honest. */
const STARS = { lesson: 30, checkpoint: 60, practice: 20, lab: 10 };
function awardStars(n) {
  const amt = Number(n) || 0;
  if (!amt) return;
  state.stars = (state.stars || 0) + amt;
  saveState();
}

function markActivity(lessonId, key) {
  if (!lessonId || !key) return false;
  if (!state.activities) state.activities = {};
  if (!state.activities[lessonId]) state.activities[lessonId] = {};
  if (state.activities[lessonId][key]) return false;        // already recorded
  state.activities[lessonId][key] = true;
  saveState();
  return true;
}
/* saveState used to call renderFooter() directly, which meant this file — which knows about
   storage and XP arithmetic — also had to know that a footer exists. It announces instead; the
   footer subscribes. */
function saveState() { Storage.writeJSON(SKEY, state); emit(EV.PROGRESS_CHANGED, { xp: state.xp, stars: state.stars }); }
function renderFooter() {
  const lvl = Math.floor(state.xp / 1000) + 1; const into = state.xp % 1000;
  $('xpVal').textContent = state.xp; $('starVal').textContent = state.stars; $('lvlVal').textContent = lvl;
  const bv = $('badgeVal'); if (bv) bv.textContent = badgeCount();
  // scaleX rather than width: the bar is full-width and squashed, so growing it costs no reflow
  // in the status bar. See .progress > div in styles.css.
  $('xpBar').style.transform = 'scaleX(' + (into / 1000) + ')';
}
