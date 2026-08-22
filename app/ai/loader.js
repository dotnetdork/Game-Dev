// ============================================================
//  Loads the agent + skill prompts from the Markdown files next
//  to this one, so how the AI teaches is content a teacher edits
//  rather than string literals in server.js.
//
//  Files are re-read when they change on disk (no restart), and if
//  one is missing or malformed the caller falls back to the built-in
//  prompt — a typo in a lesson-authoring file must never 500.
//
//  Deliberately dependency-free: the front-matter here is a handful
//  of simple keys, so a ~30-line parser beats adding a YAML library
//  to a server that otherwise needs only express + dotenv.
//  Supported front-matter is documented in AUTHORING.md.
// ============================================================
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const cache = new Map();      // file path -> { mtimeMs, doc }
const warned = new Set();     // warn once per problem, not once per request

function warn(msg) {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn('[ai] ' + msg + ' — falling back to the built-in prompt');
}

// "value"  |  'value'  |  bare value with an optional trailing # comment
function scalar(raw) {
  const s = String(raw).trim();
  const quoted = s.match(/^(['"])([\s\S]*?)\1/);
  if (quoted) return quoted[2];
  return s.replace(/\s+#.*$/, '').trim();
}

function parseFrontMatter(src) {
  const meta = {};
  let listKey = null;
  src.split(/\r?\n/).forEach(function (line) {
    if (!line.trim() || /^\s*#/.test(line)) return;
    const item = line.match(/^\s*-\s+(.*)$/);            // block list item
    if (item && listKey) { meta[listKey].push(scalar(item[1])); return; }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) return;
    listKey = null;
    const key = kv[1];
    const raw = kv[2].replace(/\s+#.*$/, '').trim();
    if (raw === '') { meta[key] = []; listKey = key; return; }   // a block list may follow
    const inline = raw.match(/^\[(.*)\]$/);                      // [a, b, c]
    if (inline) {
      meta[key] = inline[1].split(',').map(function (s) { return scalar(s); }).filter(Boolean);
      return;
    }
    meta[key] = scalar(raw);
  });
  return meta;
}

function parseDoc(text) {
  const m = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text.trim() };
  return { meta: parseFrontMatter(m[1]), body: m[2].trim() };
}

function readDoc(file) {
  let st;
  try { st = fs.statSync(file); } catch (e) { warn('missing ' + path.relative(DIR, file)); return null; }
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.doc;         // unchanged since last read
  let doc;
  try { doc = parseDoc(fs.readFileSync(file, 'utf8')); }
  catch (e) { warn('could not read ' + path.relative(DIR, file) + ': ' + e.message); return null; }
  if (!doc.body) { warn(path.relative(DIR, file) + ' has no body'); return null; }
  cache.set(file, { mtimeMs: st.mtimeMs, doc: doc });
  return doc;
}

// ---- rendering the values the prompts ask for ----
function renderAssets(assets) {
  if (!assets || !assets.length) return '(none yet — do not use any asset keys)';
  return assets.map(function (a) { return '  ' + a.key + '  (' + a.type + ')'; }).join('\n');
}
function renderFiles(files) {
  if (!files || !files.length) return '(none — game.js is the only file)';
  return files.map(function (f) {
    // A file whose contents did not fit is still listed: the coder must know it exists.
    if (!f.code) return '--- ' + f.name + ' ---\n(this file exists but is not shown here — ask the student to tell you what is in it before editing it)';
    return '--- ' + f.name + ' ---\n' + f.code;
  }).join('\n');
}
/* The game's own console output. Two "nothing" cases mean opposite things and must never
   look the same: a game that ran silently is probably fine, a game that was never run tells
   you the student has not tried it yet. */
/* The steps a practice task listed. Numbered, because the grader is being asked whether the goal
   was met and the steps are the clearest statement of what the goal was. */
function renderSteps(steps) {
  if (!steps || !steps.length) return '(no steps were listed)';
  return steps.map(function (s, i) { return '  ' + (i + 1) + '. ' + s; }).join('\n');
}
function renderGameLog(lines, ran) {
  if (!ran) return '(they have not run their game yet, so there is no output to go on)';
  if (!lines || !lines.length) return '(the game ran and printed nothing — no errors)';
  return lines.map(function (l) {
    return '[' + l.level + '] ' + l.text + (l.n > 1 ? '   (repeated ' + l.n + ' times)' : '');
  }).join('\n');
}
function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, function (m, key) {
    const v = vars[key];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

/* Build an agent's system prompt: the agent body, plus each skill it lists, with
   {{placeholders}} filled in. Returns null when anything is missing so the caller
   can fall back. `ctx` carries the request's lesson / assets / files / aiMode. */
// Skill names reach here from front-matter and from the request body, so they are never
// interpolated into a path without this check.
function safeName(name) { return /^[a-z0-9][a-z0-9-]*$/i.test(String(name)) ? String(name) : null; }

function buildPrompt(agent, ctx) {
  const c = ctx || {};
  if (!safeName(agent)) return null;
  const doc = readDoc(path.join(DIR, 'agents', agent + '.md'));
  if (!doc) return null;
  const parts = [doc.body];
  // The agent's own skills first, then any the request asked for — later text wins, so a
  // per-request skill can override the agent's default stance (explain-a-line vs socratic).
  const names = (doc.meta.skills || []).concat(Array.isArray(c.extraSkills) ? c.extraSkills : []);
  names.forEach(function (raw) {
    const name = safeName(raw);
    if (!name) { warn('ignoring unsafe skill name ' + JSON.stringify(raw)); return; }
    const skill = readDoc(path.join(DIR, 'skills', name + '.md'));
    if (!skill) return;                                          // warned already; skip it
    const only = skill.meta.when_ai_mode;                        // e.g. guided-mode.md
    if (only && only !== (c.aiMode || 'full')) return;
    parts.push(skill.body);
  });
  return fill(parts.join('\n\n'), {
    gameCode: c.gameCode || '',
    lessonTitle: c.lessonTitle || '(not in a lesson)',
    lessonContext: c.lessonContext || '(no lesson text)',
    ownedAssets: renderAssets(c.assets),
    files: renderFiles(c.files),
    aiMode: c.aiMode || 'full',
    gameLog: renderGameLog(c.gameLog, c.gameRan),
    fileName: c.fileName || 'game.js',
    lineNumber: c.lineNumber || '',
    line: c.line || '',
    snippet: c.snippet || '',
    /* The grader's slots. Without these it had no placeholders at all, which meant fill() had
       nothing to substitute and the whole context the server assembles was built and then thrown
       away — the agent was judging a student's work having been told neither the task nor what
       they changed. An unknown placeholder becomes '' silently (see fill), so a missing slot is
       not an error anyone would notice; that is exactly how this went unspotted. */
    taskTitle: c.taskTitle || '(no task given)',
    taskSteps: renderSteps(c.taskSteps),
    changedCode: c.changedCode || '(nothing appears to have changed)'
  });
}

/* Optional `model:` in an agent's front-matter. Lower priority than .env. */
function agentModel(agent) {
  const doc = readDoc(path.join(DIR, 'agents', agent + '.md'));
  return (doc && doc.meta && doc.meta.model) ? String(doc.meta.model) : '';
}

module.exports = { buildPrompt: buildPrompt, agentModel: agentModel };
