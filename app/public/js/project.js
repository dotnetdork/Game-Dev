/* project.js — The student project itself: localStorage load/save, the Markdown sanitizer, XP/Stars state, and the applier that turns the AI's "ops" into edited code. */
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
let studentId = localStorage.getItem('leagueStudentId');
if (!studentId) { studentId = 'stu-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('leagueStudentId', studentId); }

/* ================= student project (lives in the browser only) =================
   Prebuilt games (above) are read-only templates served by the server. When a
   student opens one it is COPIED into this client-side project. All editing,
   saving, and running happen in the browser (localStorage) — nothing the student
   makes is written back to the server. */
const BOOT_CODE = `// ============================================================
//  main.js  -  Starts the game engine (Phaser).
//  You usually don't need to change much in here.
// ============================================================

const config = {
  type: Phaser.AUTO,             // let Phaser pick the best way to draw
  width: WIDTH,                  // game width  (from game.js)
  height: HEIGHT,                // game height (from game.js)
  parent: 'game',                // the box on the page to draw into
  backgroundColor: '#7ec0ee',    // sky blue, shown behind everything

  // Scale the game to fit its box, and keep it centered.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  // Gravity makes things fall. Bigger y = heavier (falls faster).
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 800 }, debug: false }
  },

  // Connect our functions from game.js to the engine.
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

// Start the game!
new Phaser.Game(config);
`;
const PKEY = 'leagueProject';
function defaultProject() { return { files: { 'game.js': STAR_CODE, 'main.js': BOOT_CODE }, order: ['game.js', 'main.js'] }; }
function loadProject() {
  try { const p = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (p && p.files && typeof p.files['game.js'] === 'string') { if (!Array.isArray(p.order)) p.order = Object.keys(p.files); return p; } } catch (e) {}
  return defaultProject();
}
let project = loadProject();
function saveProject() { localStorage.setItem(PKEY, JSON.stringify(project)); }
function fileNames() { const out = project.order.filter(function (n) { return project.files[n] !== undefined; }); Object.keys(project.files).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); return out; }
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
  if (ops.config && typeof ops.config === 'object') code = mergeConfig(code, ops.config);
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
  return ['functions', 'create', 'update', 'newFile', 'replaceFile'].some(function (k) {
    const v = ops[k];
    if (k === 'functions') return Array.isArray(v) && v.some(function (f) { return typeof f === 'string' && f.trim(); });
    if (k === 'newFile') return v && typeof v.code === 'string' && v.code.trim();
    return typeof v === 'string' && v.trim();
  });
}

const SKEY = 'leagueProgress';
function loadState() { try { return Object.assign({ xp: 0, stars: 250, done: {}, modDone: {}, unlocked: {}, published: [] }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return { xp: 0, stars: 250, done: {}, modDone: {}, unlocked: {}, published: [] }; } }
let state = loadState();
function saveState() { localStorage.setItem(SKEY, JSON.stringify(state)); renderFooter(); }
function renderFooter() {
  const lvl = Math.floor(state.xp / 1000) + 1; const into = state.xp % 1000;
  $('xpVal').textContent = state.xp; $('starVal').textContent = state.stars; $('lvlVal').textContent = lvl;
  $('xpBar').style.width = (into / 1000 * 100) + '%';
}
