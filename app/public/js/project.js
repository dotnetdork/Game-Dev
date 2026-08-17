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
const SCHEMA = { project: 1, progress: 1 };

function keepBroken(key, raw, why) {
  try {
    if (raw) Storage.write(key + '.broken.' + Date.now(), raw);
    console.warn('[league] ' + key + ': ' + why + ' — the old value was kept under ' + key + '.broken.*');
  } catch (e) { /* storage may be full; the warning above is the fallback */ }
}

/* Each entry migrates FROM its key TO the next version. Empty today by design: v1 is the first
   numbered shape, and the un-numbered blobs that came before it are handled by adopt() below. */
const MIGRATIONS = {
  project: {},
  progress: {}
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
  return { v: SCHEMA.project, files: files, order: STARTER_ORDER.slice() };
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
function saveProject() { project.v = SCHEMA.project; Storage.writeJSON(PKEY, project); }
function fileNames() { const out = project.order.filter(function (n) { return project.files[n] !== undefined; }); Object.keys(project.files).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); return out; }
const CONFIG_FILE = 'config.js';
// Projects saved before the starter was split still keep CONFIG inside game.js.
function configFile() { return typeof project.files[CONFIG_FILE] === 'string' ? CONFIG_FILE : 'game.js'; }
function validJS(code) { try { new Function(code); return true; } catch (e) { return false; } } // parse-check only, never runs

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
const DEFAULT_STATE = { v: SCHEMA.progress, xp: 0, stars: 250, done: {}, modDone: {}, unlocked: {}, published: [], activities: {} };
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
function markActivity(lessonId, key) {
  if (!lessonId || !key) return false;
  if (!state.activities) state.activities = {};
  if (!state.activities[lessonId]) state.activities[lessonId] = {};
  if (state.activities[lessonId][key]) return false;        // already recorded
  state.activities[lessonId][key] = true;
  saveState();
  return true;
}
function saveState() { Storage.writeJSON(SKEY, state); renderFooter(); }
function renderFooter() {
  const lvl = Math.floor(state.xp / 1000) + 1; const into = state.xp % 1000;
  $('xpVal').textContent = state.xp; $('starVal').textContent = state.stars; $('lvlVal').textContent = lvl;
  $('xpBar').style.width = (into / 1000 * 100) + '%';
}
