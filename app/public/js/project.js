/* project.js — The student project itself: load/save, the Markdown sanitizer, XP/Stars state, and the applier that turns the AI's "ops" into edited code. Saving goes through storage.js, never localStorage directly. */
/* ================= app ================= */
/* $ and esc live in js/dom.js now — see the note there. */

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
/* studentId is gone. It was minted here, sent on every AI request by five call sites, and ignored
   by the server - which has keyed the rate limit on the signed session since the day somebody
   noticed that a value the CALLER chooses is a value the caller can change. Six lines of wire
   carrying nothing. The leagueStudentId already in a browser is harmless and is left alone; see the
   note in sync.js for why it was never synced. */

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
const SCHEMA = { project: 4, progress: 2 };

/* Did the student actually write in the old `design.md`, or is this the file as it shipped?
   Asked of the CONTENT rather than compared against a remembered copy of the starter, because the
   starter text would then have to be kept forever just to be diffed against. Every line of it was
   either a `#` heading or a `(prompt in brackets)`; anything else on a line of its own is theirs. */
function designMdWasWrittenIn(text) {
  return String(text || '').split('\n').some(function (l) {
    const s = l.trim();
    return !!s && s.charAt(0) !== '#' && s.charAt(0) !== '(';
  });
}

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
    /* v2 -> v3: a project gained `design.md`, the student's one-sheet, sitting next to the code.
       Kept as a no-op rather than deleted: migrate() treats a MISSING step as "the shape did not
       change" and stamps the blob straight to the target version, so removing this would carry a
       v2 save past v4 below without the file ever being cleaned out of it. */
    2: function (p) { return p; },
    /* v3 -> v4: and it goes again. The one-sheet became the Design tab — a real board with its own
       object model, in its own storage key, outside the project entirely. A markdown file in the
       file tree was the last trace of the version before that, and it was a confusing one: two
       places to write about your game, one of which nothing pointed at any more.
       The student's own words are NOT thrown away. If they wrote anything in it beyond the starter
       text it stays in the project as `design-notes.md`, because deleting somebody's writing to
       tidy up a file tree is not a trade this app gets to make on their behalf. */
    3: function (p) {
      const was = p.files['design.md'];
      delete p.files['design.md'];
      p.order = (p.order || []).filter(function (f) { return f !== 'design.md'; });
      if (designMdWasWrittenIn(was)) {
        p.files['design-notes.md'] = was;
        p.order.unshift('design-notes.md');
      }
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
function saveProject() { project.v = SCHEMA.project; Storage.writeJSON(PKEY, project); }
function fileNames() { const out = project.order.filter(function (n) { return project.files[n] !== undefined; }); Object.keys(project.files).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); return out; }
/* ---------- which files are code, and which are just writing ----------
   Every project file used to be JavaScript, and everything that walks the project assumed it: the
   game runner wraps each one in a <script>, the practice checker parses each one, the editor lints
   each one. A project can hold prose as well — the notes rescued from the old `design.md`, or an
   `.md` file a student adds themselves — so each of those places asks this first.
   Kept here rather than in each caller because "is this file code?" must have one answer. A file
   the runner skips but the linter checks would report syntax errors in a child's game idea. */
function isCodeFile(name) { return /\.js$/i.test(String(name || '')); }
function codeFileNames() { return fileNames().filter(isCodeFile); }
const CONFIG_FILE = 'config.js';
// Projects saved before the starter was split still keep CONFIG inside game.js.
function configFile() { return typeof project.files[CONFIG_FILE] === 'string' ? CONFIG_FILE : 'game.js'; }
/* Applying the AI’s ops, and the code-reading behind it, live in js/ops.js. */
/* XP, Stars, badges and the activity ledger live in js/progress.js — see the note there. */