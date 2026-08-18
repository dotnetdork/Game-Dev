/* Config lives in .env (gitignored): API keys, which model each agent uses, ports, Ollama
   settings. Resolved against this file's folder rather than the working directory, so the
   server finds it whether it is started from app/ or from the repo root. Optional — real
   environment variables work on their own. */
try {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
} catch (e) { /* dotenv is optional */ }
// ============================================================
//  LEAGUE Game Dev - course backend
//  Runs the same on a plain server or inside GitHub Codespaces.
//  Serves the app (public/) and the authored course (content/),
//  and relays the AI agents. The student's project lives in the
//  BROWSER: code is sent along with a request for context, used
//  to build the prompt, and never stored or run on the server.
// ============================================================
const express = require('express');
const path = require('path');
const ai = require('./ai/loader');   // agent + skill prompts, authored as Markdown in ai/
const usage = require('./ai/usage'); // token + cost meter for paid providers
const tools = require('./ai/tools'); // read-only lookups an agent can call (Stage 4 Tier 2)

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ---- AI providers (keys stay server-side, never sent to the browser) ----
// Multiple agents (coder / tutor / quiz / grader) each get their own model, set in .env.
// A model spec is "<provider>:<model>", e.g. "ollama:qwen2.5-coder:7b",
// "openrouter:qwen/qwen-2.5-coder-7b", "anthropic:claude-3-5-sonnet-latest".
// No prefix => DEFAULT_PROVIDER is used. Everything works on local Ollama or on OpenRouter.
const DEFAULT_PROVIDER = process.env.AI_PROVIDER || 'ollama';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
// num_ctx is the WHOLE window: prompt + reply. The prompt now carries game.js, the other
// files, the lesson and recent turns, so 8192 was not enough — Ollama silently truncates the
// front of an over-long prompt, which drops the ops schema and produces malformed edits.
// 16384 fits a 7B model on a 16 GB GPU; lower it here if VRAM is tight.
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 16384);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 3072);
// Reasoning models (Qwen3.x and friends) think before answering. That thinking competes with
// num_predict, and on a short strict-JSON job it can eat the whole budget and return EMPTY
// content — the grader did exactly that. Every agent here wants a short structured answer, and
// a child is waiting, so thinking is off by default: measured 15s -> 1s on the grader with no
// loss of answer quality. Set OLLAMA_THINK=1 to turn it back on.
const OLLAMA_THINK = /^(1|true|yes|on)$/i.test(process.env.OLLAMA_THINK || '');

// ---- Tier 2: let an agent look things up instead of guessing ----
// Per-agent so it can be enabled where it pays (the coder) without slowing the tutor down.
// Off => Tier 1 behaviour exactly as before. Each tool round is another model call, so this
// trades latency for accuracy; the deterministic Tier 1 validators still run either way.
const AGENT_TOOLS = {
  coder:  /^(1|true|yes|on)$/i.test(process.env.CODER_TOOLS  || ''),
  tutor:  /^(1|true|yes|on)$/i.test(process.env.TUTOR_TOOLS  || ''),
  quiz:   /^(1|true|yes|on)$/i.test(process.env.QUIZ_TOOLS   || ''),
  grader: /^(1|true|yes|on)$/i.test(process.env.GRADER_TOOLS || '')
};
const MAX_TOOL_ROUNDS = Number(process.env.AI_TOOL_ROUNDS || 4);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const AGENT_MODELS = {
  coder:  process.env.CODER_MODEL  || '',   // edits the game code
  tutor:  process.env.TUTOR_MODEL  || '',   // explains / answers questions
  quiz:   process.env.QUIZ_MODEL   || '',   // (scaffold) writes questions
  grader: process.env.GRADER_MODEL || ''    // (scaffold) checks work
};
const KNOWN_PROVIDERS = ['ollama', 'openrouter', 'anthropic'];
// Fallback model per provider, used when an agent has no model set in .env.
const PROVIDER_DEFAULT_MODEL = { ollama: OLLAMA_MODEL, anthropic: ANTHROPIC_MODEL, openrouter: OPENROUTER_MODEL };
// Precedence: .env per-agent spec > the agent file's `model:` > default provider.
function resolveModel(agent) {
  let spec = AGENT_MODELS[agent] || '';
  if (!spec) spec = ai.agentModel(agent) || '';
  if (!spec) spec = DEFAULT_PROVIDER + ':' + (PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER] || '');
  const i = spec.indexOf(':');
  // `agent` rides along so the usage meter can attribute a call without threading an extra
  // argument through every layer.
  if (i > 0 && KNOWN_PROVIDERS.indexOf(spec.slice(0, i)) >= 0) return { provider: spec.slice(0, i), model: spec.slice(i + 1), agent: agent };
  return { provider: DEFAULT_PROVIDER, model: spec, agent: agent };
}

// ---- simple per-student rate limit ----
const RATE = { windowMs: 10 * 60 * 1000, max: 40 };
const hits = new Map();
function rateLimited(id) {
  const now = Date.now();
  if (hits.size > 500) hits.forEach(function (v, k) { if (now - v.start > RATE.windowMs) hits.delete(k); }); // drop stale entries
  const e = hits.get(id);
  if (!e || now - e.start > RATE.windowMs) { hits.set(id, { start: now, count: 1 }); return false; }
  e.count++; return e.count > RATE.max;
}

/* ---- security headers ----
   There were none of these at all, which left DOMPurify as the single line of defence on a page
   that renders both Markdown and model output into the DOM.

   A note on script-src, because the honest version matters more than a strict-looking policy that
   is a lie: the game runs in a `srcdoc` iframe built entirely from inline <script> blocks (the
   student's own files), and a srcdoc document inherits its parent's CSP whether or not it is
   sandboxed. So `script-src 'self'` here would block every student game in the app. Tightening it
   means moving the game frame to its own origin and giving that origin its own policy — a real
   change, planned, not done here. Everything else is locked down now:
     object-src 'none'     no plugins
     base-uri 'self'       injected markup cannot re-point every relative URL on the page
     form-action 'none'    nothing on this page submits anywhere
     frame-ancestors 'none' the app cannot be framed by someone else
   `frame-src blob: data:` is for the game and run-cell frames; `img-src`/`media-src` allow the
   data: URIs that run cells and the lesson widgets still produce. */
/* Every directive names the origin explicitly as well as `'self'`. A srcdoc document inherits its
   parent's CSP, and once the game frame is sandboxed (see SANDBOX_GAME in game-runner.js) its own
   origin is opaque — so in there `'self'` matches nothing and would block Phaser and every asset.
   Naming the host grants exactly the same server that `'self'` was meant to grant, and costs
   nothing while the sandbox is still off. */
function cspFor(req) {
  const origin = (req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.headers.host;
  return [
    "default-src 'self' " + origin,
    "script-src 'self' 'unsafe-inline' " + origin,   // see note above: srcdoc games are inline scripts
    "style-src 'self' 'unsafe-inline'",              // widgets and pages set style="" attributes
    "img-src 'self' data: blob: " + origin,
    "media-src 'self' data: blob: " + origin,
    "font-src 'self' " + origin,
    "connect-src 'self' " + origin,                  // Phaser's audio loader is XHR
    "frame-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ');
}

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', cspFor(req));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  next();
});

/* ---- static hosting ----
   /assets and /vendor are readable cross-origin on purpose. The game iframe is sandboxed without
   allow-same-origin, so from its point of view this server is a different origin: Phaser's audio
   loader uses XHR and would be refused, and a WebGL texture built from an image with no CORS
   grant taints the context. Both are public files — CC0 art and vendored libraries — so there is
   nothing here to protect, and the alternative was the megabyte of inlined base64 we just removed. */
const corsOpen = (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); };
app.use('/assets', express.static(path.join(ROOT, 'public', 'assets'), { setHeaders: corsOpen }));
app.use('/vendor', express.static(path.join(ROOT, 'public', 'vendor'), { setHeaders: corsOpen }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/content', express.static(path.join(ROOT, 'content'), { etag: false, lastModified: false, cacheControl: false })); // authored course: YAML structure + Markdown lessons (read-only)

/* ---- the course index, in one request ----
   Boot used to be: fetch course.yaml, then fetch all 47 lesson files, then parse the front-matter
   of each in the browser — 48 requests and 47 Markdown renders before the outline could appear,
   to show one lesson. This returns the structure and every lesson's front-matter together; bodies
   are fetched from /content/lessons/<id>.md when a lesson is actually opened.

   Uses the js-yaml that is already vendored for the browser rather than a second parser, so the
   server and the client can never disagree about what course.yaml says.

   Cached against the newest mtime under content/, because lessons are authored files that get
   edited while the server is running and a stale outline would be baffling. */
const yaml = require('./public/vendor/js-yaml/js-yaml.min.js');
const fs = require('fs');
const CONTENT = path.join(ROOT, 'content');
const LESSON_DIR = path.join(CONTENT, 'lessons');

let indexCache = null;

function newestMtime() {
  let newest = 0;
  const stat = (p) => { try { const m = fs.statSync(p).mtimeMs; if (m > newest) newest = m; } catch (e) {} };
  stat(path.join(CONTENT, 'course.yaml'));
  try { fs.readdirSync(LESSON_DIR).forEach((f) => stat(path.join(LESSON_DIR, f))); } catch (e) {}
  return newest;
}

/* The corpus is 47 files of four flat keys, so a full YAML parse per lesson is not needed — but
   using js-yaml on the front-matter block anyway means an author who adds a quoted colon or a
   list later gets the behaviour they expect instead of a silent mis-parse. */
function frontMatter(raw) {
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!m) return {};
  try { return yaml.load(m[1]) || {}; } catch (e) { return {}; }
}

function buildIndex() {
  const data = yaml.load(fs.readFileSync(path.join(CONTENT, 'course.yaml'), 'utf8')) || {};
  const modules = (data.modules || []).map((mod) => {
    const lessons = (mod.lessons || []).map((id) => {
      let meta = {};
      try { meta = frontMatter(fs.readFileSync(path.join(LESSON_DIR, id + '.md'), 'utf8')); }
      catch (e) { return { id: id, title: id, xp: 0, summary: '', ai: 'full', missing: true }; }
      return {
        id: id,
        title: meta.title || id,
        xp: meta.xp || 0,
        summary: meta.summary || '',
        ai: meta.ai || 'full'
      };
    });
    return { id: mod.id, name: mod.name, stars: mod.stars || 0, lessons: lessons };
  });
  return { id: data.id, name: data.name || 'Course', library: data.library || 'Phaser', modules: modules };
}

app.get('/api/lessons', (req, res) => {
  try {
    const stamp = newestMtime();
    if (!indexCache || indexCache.stamp !== stamp) indexCache = { stamp: stamp, body: buildIndex() };
    res.json(indexCache.body);
  } catch (e) {
    res.status(500).json({ error: 'Could not read the course content.' });
  }
});

// ---- which models are running (per agent) ----
app.get('/api/info', (req, res) => {
  const agents = {};
  ['coder', 'tutor', 'quiz', 'grader'].forEach(function (a) { const m = resolveModel(a); agents[a] = m.provider + ':' + m.model; });
  res.json({ agents: agents, provider: DEFAULT_PROVIDER, model: resolveModel('coder').model });
});

/* ---- what this session has spent ----
   Token counts are the provider's own, from the response to each call; the dollar figure is
   ours, from the price table in ai/usage.js. Counts reset when the server restarts. */
app.get('/api/usage', (req, res) => res.json(usage.summary()));
app.post('/api/usage/reset', (req, res) => { usage.reset(); res.json(usage.summary()); });

// ---- helpers ----
function extractJSON(s) {
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < 0 || b < a) return null;
  try { return unwrapDoubleJSON(JSON.parse(s.slice(a, b + 1))); } catch (e) { return null; }
}
/* After reading tool output a model sometimes answers with its JSON wrapped inside another
   JSON string, so `reply` arrives holding the whole object as text. Unwrap it once rather
   than showing a student a blob of JSON. */
const OP_FIELDS = ['reply', 'why', 'config', 'functions', 'create', 'update', 'newFile', 'editFile', 'replaceFile'];
function unwrapDoubleJSON(parsed) {
  if (!parsed || typeof parsed.reply !== 'string' || !/^\s*\{/.test(parsed.reply)) return parsed;
  try {
    const inner = JSON.parse(parsed.reply.slice(parsed.reply.indexOf('{'), parsed.reply.lastIndexOf('}') + 1));
    if (inner && OP_FIELDS.some(function (k) { return inner[k] !== undefined; })) return inner;
  } catch (e) { /* leave it alone */ }
  return parsed;
}
// The browser sends prior turns so follow-ups like "even faster" or "undo that" make sense.
// Never trusted as-is: roles, per-message length, turn count and total size are all capped here.
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = []; let budget = 3000;
  for (let i = raw.length - 1; i >= 0 && out.length < 12; i--) {
    const m = raw[i]; if (!m) continue;
    const role = m.role === 'assistant' ? 'assistant' : (m.role === 'user' ? 'user' : null);
    if (!role) continue;
    const content = String(m.content == null ? '' : m.content).slice(0, 1000);
    if (!content.trim()) continue;
    if (content.length > budget) break;                 // oldest turns fall off first
    budget -= content.length;
    out.unshift({ role: role, content: content });
  }
  return out;
}

// What the coder can see besides game.js: the lesson being worked on, the other project
// files, and the asset keys that actually exist. Without this it guesses, and a guessed
// asset key crashes the student's game.
function buildContextBlock(ctx) {
  let s = '';
  if (ctx.lessonTitle || ctx.lessonContext) {
    s += '\n\nWHAT THE STUDENT IS LEARNING RIGHT NOW';
    if (ctx.lessonTitle) s += ' — lesson: "' + ctx.lessonTitle + '"';
    s += '\n';
    if (ctx.lessonContext) s += '"""\n' + ctx.lessonContext + '\n"""\n';
    s += 'Stay close to what this lesson covers. If the student asks for something far beyond it, '
      + 'do the simplest version that works and mention that in "reply".';
  }
  if (ctx.assets && ctx.assets.length) {
    s += '\n\nASSETS THE STUDENT OWNS — these are the ONLY asset keys that exist:\n'
      + ctx.assets.map(function (a) { return '  ' + a.key + '  (' + a.type + ')'; }).join('\n')
      + '\nUse ONLY these keys. NEVER invent an asset key: a key that is not on this list fails to load and breaks the game. '
      + 'If the student wants art or a sound they do not own, say so in "reply" and tell them to buy it in the Store.';
  } else {
    s += '\n\nThe student owns no assets yet — do not reference any asset keys.';
  }
  if (ctx.files && ctx.files.length) {
    s += '\n\nOTHER FILES IN THIS PROJECT (game.js is already shown above — do not repeat it):\n'
      + ctx.files.map(function (f) { return '--- ' + f.name + ' ---\n' + f.code; }).join('\n');
  }
  return s;
}

// ---- asset-key validation (Stage 4 Tier 1, pulled forward) ----
// Telling a 7B model "these are the only keys that exist" is not enough — it still invents
// them, and a key that was never loaded fails silently and leaves the student with a broken
// game. So we check its answer instead of trusting it. Deterministic: works with any model.
//
// Where the key sits in each call. `add.text(x, y, 'hi')` is deliberately absent — its third
// argument is text to display, not a key.
const ASSET_USES = [
  { re: /\b(?:add|physics\.add|make)\.(?:sprite|image)\s*\(/g, arg: 2 },
  { re: /\b(?:add|make)\.tileSprite\s*\(/g, arg: 4 },
  { re: /\.create\s*\(/g, arg: 2 },                       // group.create(x, y, key)
  { re: /\bsound\.(?:play|add)\s*\(/g, arg: 0 },
  { re: /\.setTexture\s*\(/g, arg: 0 }
];
// A key can also be legitimately created at runtime rather than bought.
const ASSET_DEFS = [
  { re: /\bgenerateTexture\s*\(/g, arg: 0 },
  { re: /\bload\.(?:image|audio|spritesheet|atlas|bitmapFont)\s*\(/g, arg: 0 }
];
// Split a call's arguments at top level. Needed because arguments are real expressions —
// `Math.random() * (HEIGHT - 100)` has parens in it, which no flat regex survives.
function callArgs(text, open) {
  let depth = 0, start = open + 1, quote = null; const args = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push(text.slice(start, i)); return args; }
      continue;
    }
    if (c === ',' && depth === 1) { args.push(text.slice(start, i)); start = i + 1; }
  }
  return args;   // unbalanced (truncated reply) — treat as no usable args
}
function stringArg(s) { const m = String(s).trim().match(/^(['"])([^'"]*)\1$/); return m ? m[2] : null; }
function opsCode(ops) {
  const out = [];
  ['create', 'update', 'replaceFile'].forEach(function (k) { if (typeof ops[k] === 'string') out.push(ops[k]); });
  if (Array.isArray(ops.functions)) ops.functions.forEach(function (f) { if (typeof f === 'string') out.push(f); });
  if (ops.newFile && typeof ops.newFile.code === 'string') out.push(ops.newFile.code);
  return out.join('\n');
}
function matchAll(text, specs) {
  const found = {};
  specs.forEach(function (spec) {
    spec.re.lastIndex = 0; let m;
    while ((m = spec.re.exec(text))) {
      const key = stringArg(callArgs(text, m.index + m[0].length - 1)[spec.arg]);
      if (key) found[key] = true;      // a non-literal (variable) argument is unknowable, so skip it
    }
  });
  return found;
}
// Keys the proposed change uses that the student does not own and nothing defines.
function unknownAssetKeys(ops, gameCode, owned) {
  const code = opsCode(ops);
  if (!code.trim()) return [];
  const defined = matchAll(gameCode + '\n' + code, ASSET_DEFS);   // existing code counts
  const ownedSet = {};
  (owned || []).forEach(function (a) { ownedSet[a.key] = true; });
  return Object.keys(matchAll(code, ASSET_USES))
    .filter(function (k) { return !ownedSet[k] && !defined[k]; });
}
function assetApology(bad, owned) {
  const names = bad.map(function (k) { return '"' + k + '"'; }).join(' and ');
  const have = (owned || []).slice(0, 6).map(function (a) { return a.key; }).join(', ');
  return 'I wanted to use ' + names + ', but you don’t own ' + (bad.length > 1 ? 'those' : 'that') + ' yet, so I left your game alone. '
    + (have ? 'You can use: ' + have + '. ' : '')
    + 'Buy more art and sounds in the Store, or ask me for something using what you have.';
}

// ---- Phaser APIs that do not exist ----
// phaser-rules.md tells the model not to use these; it does anyway often enough to matter, and
// each one either crashes the scene or silently does nothing. Checked, not trusted.
const BAD_PHASER_APIS = [
  { re: /\.(cubicCurveTo|bezierCurveTo|quadraticCurveTo|arcTo|arc|ellipse|rect)\s*\(/g,
    why: 'is an HTML-canvas method and does not exist on Phaser Graphics',
    hint: 'use fillRect, fillRoundedRect, fillCircle, fillTriangle or beginPath/moveTo/lineTo/closePath/fillPath' },
  { re: /\bnew\s+Phaser\.Game\s*\(/g, label: 'new Phaser.Game',
    why: 'creates a second game', hint: 'main.js already starts the game — never create another' },
  { re: /\binput\.keyboard\.isDown\s*\(/g, label: 'input.keyboard.isDown()',
    why: 'does not exist', hint: 'read scene.cursors.<key>.isDown, or register the key with addKeys first' },
  { re: /\bload\.(?:image|audio|spritesheet)\s*\(\s*[^,)]+,\s*['"]https?:/g, label: 'loading a file from a URL',
    why: 'is not allowed here', hint: 'every picture and sound is already loaded by key — use an owned key' }
];
// `arc`/`rect`/`ellipse` are only wrong on a Graphics object; scene.add.rect/ellipse are real.
const GRAPHICS_ONLY = /^(arc|ellipse|rect)$/;
function apiHits(code) {
  const hits = {};
  BAD_PHASER_APIS.forEach(function (rule) {
    rule.re.lastIndex = 0; let m;
    while ((m = rule.re.exec(String(code)))) {
      if (m[1] && GRAPHICS_ONLY.test(m[1])) {
        const before = String(code).slice(Math.max(0, m.index - 40), m.index);
        if (!/graphics|\bg\b|gfx/i.test(before)) continue;      // scene.add.rect(...) is fine
      }
      const name = rule.label || m[1] || m[0].trim();
      hits[name] = hits[name] || { name: name, why: rule.why, hint: rule.hint, n: 0 };
      hits[name].n++;
    }
  });
  return hits;
}
/* Only what this change INTRODUCES. main.js legitimately contains `new Phaser.Game`, so a file
   sent back whole must not be condemned for what was already in it. */
function badPhaserApis(proposed, baseline) {
  const now = apiHits(proposed), was = apiHits(baseline || '');
  return Object.keys(now).filter(function (k) { return now[k].n > (was[k] ? was[k].n : 0); })
    .map(function (k) { return now[k]; });
}
// Per changed file, so each is compared against its own original.
function badApisIn(ops, gameCode, ctxFiles) {
  const out = [];
  if (ops.editFile && typeof ops.editFile.code === 'string') {
    const orig = (ctxFiles || []).filter(function (f) { return f.name === ops.editFile.name; })[0];
    badPhaserApis(ops.editFile.code, orig ? orig.code : '').forEach(function (b) { out.push(b); });
  }
  const gameOps = {};
  ['functions', 'create', 'update', 'replaceFile', 'newFile'].forEach(function (k) { if (ops[k] !== undefined) gameOps[k] = ops[k]; });
  if (Object.keys(gameOps).length) {
    badPhaserApis(opsCode(gameOps), ops.replaceFile ? gameCode : '').forEach(function (b) { out.push(b); });
  }
  const seen = {};
  return out.filter(function (b) { if (seen[b.name]) return false; seen[b.name] = 1; return true; });
}

// ---- keyboard keys must be registered before they are read ----
// `scene.keys.SHIFT.isDown` when only 'W,A,S,D' were registered throws on the very first frame
// and freezes the game. The model gets this right about half the time however plainly the rule
// is written, so it is checked rather than trusted.
function unregisteredKeys(code) {
  const registered = {}; let m, re;
  re = /addKeys\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = re.exec(code))) m[1].split(',').forEach(function (k) { registered[k.trim().toUpperCase()] = true; });
  re = /addKey\s*\(\s*(?:Phaser\.Input\.Keyboard\.KeyCodes\.([A-Za-z_]+)|['"]([^'"]+)['"])/g;
  while ((m = re.exec(code))) registered[String(m[1] || m[2]).trim().toUpperCase()] = true;
  const used = {};
  re = /\bkeys\.([A-Za-z_]\w*)\b/g;
  while ((m = re.exec(code))) used[m[1].toUpperCase()] = true;
  return Object.keys(used).filter(function (k) { return !registered[k]; });
}
function badKeysIn(ops, gameCode) {
  const bad = {};
  if (ops.editFile && typeof ops.editFile.code === 'string') {
    unregisteredKeys(ops.editFile.code).forEach(function (k) { bad[k] = true; });
  }
  const inGame = opsCode(ops).replace(ops.editFile && ops.editFile.code ? ops.editFile.code : ' ', '');
  if (inGame.trim()) unregisteredKeys(gameCode + '\n' + inGame).forEach(function (k) { bad[k] = true; });
  return Object.keys(bad);
}

// ---- "I added it!" with no ops is a lie the student acts on ----
// A reply is not a change: unless the JSON carries an op field, nothing happens to the game.
// Small models will happily claim success anyway, so the claim is checked against the ops.
const CLAIMS_A_CHANGE = /\b(i(?:'ve| have)? (?:added|changed|updated|set|made|created|implemented|fixed|adjusted)|now (?:sprints?|jumps?|runs?|moves?|has|can|will)|will now|you can now|is now)\b/i;
function claimsChangeWithoutOps(reply, ops) {
  return !Object.keys(ops || {}).length && CLAIMS_A_CHANGE.test(String(reply || ''));
}

// Lessons set `ai: guided` when the student is meant to make the design call themselves.
const GUIDED_RULES = '\n\nGUIDED MODE IS ON for this lesson — the student is supposed to decide what changes.\n'
  + '- If the request is vague ("make it cooler", "make it better", "add something", "surprise me"), change NOTHING. '
  + 'Reply with only {"reply":"..."} asking which specific thing to change, offering two or three concrete options.\n'
  + '- Only act when the request names what to change and roughly how ("make the player jump higher", "put a coin above the left platform").\n'
  + '- Make the smallest change that does it, and say in one short sentence what you changed.';

// Built-in fallbacks. Used only when ai/agents/*.md is missing or malformed, so a typo
// while authoring a prompt degrades to the previous behaviour instead of breaking the app.
function fallbackCoderSystem(gameCode, ctx) {
  return 'You are a coding assistant inside a kids game-dev course (ages 11-15). '
    + 'The student is building a 2D Phaser 3 game. game.js defines a CONFIG object and functions '
    + '(create, update, spawnObject, buildTextures, postStats, etc.); create() and update() both start with '
    + '`const scene = this;`. A separate main.js boots the game.\n\n'
    + 'CURRENT game.js:\n```javascript\n' + gameCode + '\n```\n\n'
    + 'Make the SMALLEST change that satisfies the request. PREFER ADDING over rewriting. '
    + 'Reply with ONLY one JSON object (no prose, no markdown, no code fences) using any of these OPTIONAL fields:\n'
    + '  "reply": a short friendly one-sentence message to the student.\n'
    + '  "config": an object of CONFIG numbers to add or change, e.g. {"shieldTime": 5, "fallSpeed": 120}.\n'
    + '  "functions": an array of COMPLETE new top-level functions to add, each a string.\n'
    + '  "create": a code snippet inserted at the END of create() (the scene is the variable "scene").\n'
    + '  "update": a code snippet inserted at the END of update() (use "scene").\n'
    + '  "newFile": {"name":"thing.js","code":"..."} ONLY if the student asks to create a new script/file.\n'
    + '  "replaceFile": the COMPLETE new game.js. Use ONLY when the student asks to remove, delete, or rewrite a large part.\n\n'
    + 'RULES:\n'
    + '- Normal "add ..." requests: use config / functions / create / update. Do NOT use replaceFile and do NOT resend the whole file.\n'
    + '- Use replaceFile ONLY when the student clearly asks to remove/delete/rewrite something.\n'
    + '- Put any new adjustable number in "config" so it appears in the settings panel.\n'
    + '- Use only Phaser 3 APIs and the patterns already in the file. Never write a new Phaser.Game.\n'
    + '- For drawing, use only real Phaser 3 Graphics methods (fillRect, fillRoundedRect, fillCircle, fillTriangle, beginPath/moveTo/lineTo/closePath/fillPath, generateTexture). Do NOT use HTML-canvas methods like cubicCurveTo, bezierCurveTo, or arcTo — they do not exist on Phaser Graphics and crash the game.\n'
    + '- If it is just a question, reply with only {"reply":"..."} and no other fields.\n'
    + '- Output nothing but the single JSON object.'
    + buildContextBlock(ctx || {})
    + ((ctx && ctx.aiMode === 'guided') ? GUIDED_RULES : '');
}
function fallbackTutorSystem(gameCode, context, ctx) {
  const c = ctx || {};
  return 'You are a friendly coding tutor for kids aged 11-15 in a game-dev course. '
    + 'Explain clearly and help them UNDERSTAND rather than doing their work for them. '
    + 'ALWAYS answer in the context of JavaScript and the Phaser game library — NEVER use Python or any other language. '
    + 'Keep answers to about 2-4 short sentences; include a tiny JavaScript snippet only if it truly helps; never dump large code.\n'
    + 'Earlier turns of this conversation are included — when the student says "that" or "it", they mean what you were just talking about.\n'
    + (c.lessonTitle ? '\nThey are on the lesson "' + c.lessonTitle + '".\n' : '')
    + (context ? '\nThe student is asking about this part of the lesson:\n"""\n' + context + '\n"""\n' : '')
    + (gameCode ? '\nCurrent game.js for reference:\n```javascript\n' + gameCode + '\n```' : '');
}
const FALLBACK_AGENT_SYSTEMS = {
  quiz: 'You write short comprehension questions for kids (11-15) learning to code. Output ONLY a JSON object.',
  grader: 'You check a student\'s answer or code change for a kids coding course. Output ONLY a JSON object with {"pass": true/false, "hint": "..."}.'
};
/* One turn with the model. Returns { content, assistant, toolCalls } — toolCalls is empty
   unless tools were offered and the model chose to use one. `msgs` is the running conversation
   (history, the new message, and any tool traffic already exchanged). */
async function chatOnce(spec, system, msgs, wantJSON, withTools) {
  const provider = spec.provider, model = spec.model;
  if (provider === 'anthropic') {
    if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    const body = { model: model, max_tokens: 4000, system: system, messages: msgs };
    if (withTools) body.tools = tools.anthropicSpecs();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('Anthropic HTTP ' + r.status);
    const d = await r.json();
    usage.record(spec.agent || 'unknown', provider, model, d);
    const blocks = d.content || [];
    return {
      content: blocks.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(''),
      assistant: { role: 'assistant', content: blocks },
      toolCalls: blocks.filter(function (b) { return b.type === 'tool_use'; })
        .map(function (b) { return { id: b.id, name: b.name, args: b.input || {} }; })
    };
  }
  if (provider === 'openrouter') {
    if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not set');
    const body = { model: model, messages: [{ role: 'system', content: system }].concat(msgs) };
    if (wantJSON && !withTools) body.response_format = { type: 'json_object' };   // json mode and tools conflict
    if (withTools) body.tools = tools.toolSpecs();
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('OpenRouter HTTP ' + r.status);
    const d = await r.json();
    usage.record(spec.agent || 'unknown', provider, model, d);
    const m = (d.choices && d.choices[0] && d.choices[0].message) || {};
    return {
      content: m.content || '',
      assistant: m,
      toolCalls: (m.tool_calls || []).map(function (c) {
        let a = {}; try { a = typeof c.function.arguments === 'string' ? JSON.parse(c.function.arguments || '{}') : (c.function.arguments || {}); } catch (e) {}
        return { id: c.id, name: c.function.name, args: a };
      })
    };
  }
  // default: local Ollama
  const body = { model: model, stream: false, options: { num_ctx: OLLAMA_NUM_CTX, num_predict: OLLAMA_NUM_PREDICT, temperature: 0.3 },
    messages: [{ role: 'system', content: system }].concat(msgs) };
  if (wantJSON && !withTools) body.format = 'json';       // Ollama ignores tool calls in strict json mode
  if (withTools) body.tools = tools.toolSpecs();
  if (!OLLAMA_THINK) body.think = false;
  let r = await fetch(OLLAMA_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok && body.think === false) { delete body.think; r = await fetch(OLLAMA_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  if (!r.ok) throw new Error('Ollama HTTP ' + r.status);
  const d = await r.json();
  const m = d.message || {};
  return {
    content: m.content || d.response || '',
    assistant: m,
    toolCalls: (m.tool_calls || []).map(function (c) { return { id: c.id, name: c.function.name, args: c.function.arguments || {} }; })
  };
}

/* The message that carries a tool's answer back to the model. */
function toolResultMessage(provider, call, result) {
  const text = JSON.stringify(result);
  if (provider === 'anthropic') {
    return { role: 'user', content: [{ type: 'tool_result', tool_use_id: call.id, content: text }] };
  }
  return { role: 'tool', tool_call_id: call.id, name: call.name, content: text };
}

async function callAI(spec, system, user, wantJSON, history, toolCtx) {
  const provider = spec.provider, model = spec.model;
  if (!model) throw new Error('No model set for ' + provider + ' — set it in .env');
  const msgs = (history || []).concat([{ role: 'user', content: user }]);

  if (!toolCtx) return (await chatOnce(spec, system, msgs, wantJSON, false)).content;

  // Two phases, because strict JSON mode and tool calling are mutually exclusive on Ollama:
  // asking for JSON suppresses tool calls entirely (the model invents a fake tool result
  // instead). So phase 1 lets it look things up with JSON mode OFF, and phase 2 asks for the
  // real answer with tools off and JSON back on, with the tool results in the conversation.
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const turn = await chatOnce(spec, system, msgs, false, true);
    if (!turn.toolCalls.length) {
      if (!wantJSON) return turn.content;     // plain-text agent: this is already the answer
      break;                                  // JSON agent: fall through and ask properly
    }
    msgs.push(turn.assistant);
    turn.toolCalls.forEach(function (call) {
      msgs.push(toolResultMessage(provider, call, tools.runTool(call.name, call.args, toolCtx)));
    });
  }
  return (await chatOnce(spec, system, msgs, wantJSON, false)).content;
}

// ---- the agent endpoint: relays the AI and returns a change for the browser to apply ----
//      The student's code lives in the browser and is sent with the request. The server
//      never stores or runs student code — it just talks to the model and returns "ops".
app.post('/api/ai', async (req, res) => {
  const id = (req.body && req.body.studentId) || req.ip || 'anon';
  if (rateLimited(id)) return res.status(429).json({ reply: 'Slow down a moment - you have hit the request limit. Try again shortly.' });
  const message = ((req.body && req.body.message) || '').toString().slice(0, 2000);
  if (!message) return res.status(400).json({ reply: 'Please type a message.' });
  const gameCode = ((req.body && req.body.code) || '').toString().slice(0, 100000);
  const context = ((req.body && req.body.context) || '').toString().slice(0, 4000);
  const history = sanitizeHistory(req.body && req.body.history);
  let agent = (req.body && req.body.agent) || 'coder';
  if (['coder', 'tutor', 'quiz', 'grader'].indexOf(agent) < 0) agent = 'coder';   // controller: keep to known agents
  const spec = resolveModel(agent);

  // Context the browser sends about where the student is and what exists in their project.
  const b = req.body || {};
  const ctx = {
    lessonTitle: (b.lessonTitle || '').toString().slice(0, 120),
    lessonContext: (b.lessonContext || '').toString().slice(0, 3000),
    aiMode: ['full', 'guided', 'off'].indexOf(b.aiMode) >= 0 ? b.aiMode : 'full',
    hasAssetList: Array.isArray(b.ownedAssets),   // only validate keys when the client actually told us what it owns
    assets: Array.isArray(b.ownedAssets) ? b.ownedAssets.slice(0, 300).map(function (a) {
      return { key: String((a && a.key) || '').slice(0, 60), type: String((a && a.type) || '').slice(0, 20) };
    }).filter(function (a) { return a.key; }) : [],
    // a lesson widget or the editor can ask for one extra skill for this request only
    extraSkills: b.skill ? [String(b.skill).slice(0, 40)] : [],
    fileName: String(b.fileName || '').slice(0, 60),
    lineNumber: String(b.lineNumber || '').slice(0, 8),
    line: String(b.line || '').slice(0, 400),
    snippet: String(b.snippet || '').slice(0, 2000),
    gameCode: gameCode,
    files: Array.isArray(b.files) ? b.files.slice(0, 30).map(function (f) {
      return { name: String((f && f.name) || '').slice(0, 60), code: String((f && f.code) || '').slice(0, 12000) };
    }).filter(function (f) { return f.name; }) : [],   // a file with no contents still tells the coder it exists
    // What the game printed the last time the student ran it, straight from the browser console
    // panel. `gameRan` separates "it printed nothing" from "they have not pressed Play yet",
    // which are opposite pieces of evidence and would otherwise look identical.
    gameRan: !!b.gameRan,
    gameLog: Array.isArray(b.gameLog) ? b.gameLog.slice(-30).map(function (l) {
      const level = ['log', 'warn', 'error'].indexOf(l && l.level) >= 0 ? l.level : 'log';
      const n = Math.max(1, Math.min(9999, parseInt((l && l.n) || 1, 10) || 1));
      return { level: level, text: String((l && l.text) || '').slice(0, 300), n: n };
    }).filter(function (l) { return l.text; }) : []
  };

  // Tier 2: when this agent has tools switched on, it may look things up instead of guessing.
  // ctx already carries the assets, files, game code and lesson this request is about.
  const agentTools = AGENT_TOOLS[agent] ? ctx : null;

  // TUTOR: plain-language explanation, no code edits.
  if (agent === 'tutor') {
    let raw;
    const tutorSystem = ai.buildPrompt('tutor', Object.assign({ gameCode: gameCode }, ctx)) || fallbackTutorSystem(gameCode, context, ctx);
    try { raw = await callAI(spec, tutorSystem, message, false, history, agentTools); }
    catch (e) { return res.status(502).json({ reply: 'The tutor is not reachable right now (' + e.message + ').' }); }
    return res.json({ reply: (raw || '').trim() || 'Hmm, I am not sure — try rephrasing.' });
  }

  // QUIZ / GRADER (scaffold): return whatever JSON the model produced.
  if (agent === 'quiz' || agent === 'grader') {
    let raw;
    const agentSystem = ai.buildPrompt(agent, ctx) || FALLBACK_AGENT_SYSTEMS[agent];
    try { raw = await callAI(spec, agentSystem, message, true, [], agentTools); }
    catch (e) { return res.status(502).json({ error: 'The ' + agent + ' agent is not reachable (' + e.message + ').' }); }
    return res.json({ result: extractJSON(raw) || {} });
  }

  // CODER (default): return ops the browser applies to game.js.
  const system = ai.buildPrompt('coder', Object.assign({ gameCode: gameCode }, ctx)) || fallbackCoderSystem(gameCode, ctx);
  function toOps(parsed) {
    const ops = {};
    ['config', 'functions', 'create', 'update', 'newFile', 'editFile', 'replaceFile'].forEach(function (k) {
      if (parsed[k] !== undefined && parsed[k] !== null) ops[k] = parsed[k];
    });
    return ops;
  }
  let raw;
  try { raw = await callAI(spec, system, message, true, history, agentTools); }
  catch (e) { return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' }); }
  let parsed = extractJSON(raw) || { reply: (raw || '').trim() || 'Done.' };
  let ops = toOps(parsed);

  // Claimed a change but sent nothing that makes one: ask again for the actual fields.
  if (claimsChangeWithoutOps(parsed.reply, ops)) {
    const retry = message + '\n\nIMPORTANT: your previous answer said you had made a change, but it contained no '
      + '"config", "functions", "create", "update", "editFile", "newFile" or "replaceFile" field, so NOTHING happened '
      + 'to the game and the student saw no difference. Send the change for real this time. Remember that logic living '
      + 'in another file (movement in player.js, coins in coins.js, platforms in world.js) is changed with "editFile", '
      + 'passing that whole file back with your edit made. If you genuinely cannot do it, say so plainly and ask for '
      + 'what you need instead of claiming it is done.';
    try { raw = await callAI(spec, system, retry, true, history, agentTools); }
    catch (e) { return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' }); }
    parsed = extractJSON(raw) || { reply: (raw || '').trim() || '' };
    ops = toOps(parsed);
    if (claimsChangeWithoutOps(parsed.reply, ops)) {
      return res.json({ reply: "I couldn't work out how to make that change — can you tell me a bit more about what you want to happen?", ops: null });
    }
  }

  // A Phaser API that does not exist: correct it once, then refuse rather than ship a crash.
  let badApis = badApisIn(ops, gameCode, ctx.files);
  if (badApis.length) {
    const list = badApis.map(function (b) { return '"' + b.name + '" (' + b.why + ' — ' + b.hint + ')'; }).join('; ');
    const retry = message + '\n\nIMPORTANT: your previous answer used ' + list
      + '. Redo the change using only APIs that exist, or if it cannot be done that way, change nothing and say so plainly.';
    try { raw = await callAI(spec, system, retry, true, history, agentTools); }
    catch (e) { return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' }); }
    parsed = extractJSON(raw) || { reply: '' };
    ops = toOps(parsed);
    badApis = badApisIn(ops, gameCode, ctx.files);
    if (badApis.length) {
      return res.json({ reply: "I couldn't do that without using something Phaser doesn't have, so I left your game alone. Try asking for it a slightly different way.", ops: null });
    }
  }

  // Reading a key that was never registered crashes on frame one: correct it once, then refuse.
  let badKeys = badKeysIn(ops, gameCode);
  if (badKeys.length) {
    const retry = message + '\n\nIMPORTANT: your previous answer read '
      + badKeys.map(function (k) { return 'scene.keys.' + k; }).join(' and ')
      + ', but those keys are never registered, so the game crashes on the first frame. '
      + 'For SHIFT use scene.cursors.shift.isDown (it already exists). For any other key, add it to the '
      + "addKeys('W,A,S,D') call in createPlayer first. Send the corrected change.";
    try { raw = await callAI(spec, system, retry, true, history, agentTools); }
    catch (e) { return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' }); }
    parsed = extractJSON(raw) || { reply: '' };
    ops = toOps(parsed);
    badKeys = badKeysIn(ops, gameCode);
    if (badKeys.length) {
      return res.json({ reply: "I couldn't get that working without breaking your controls, so I left your game alone. Try asking for it a slightly different way.", ops: null });
    }
  }

  // Check the answer instead of trusting it: one corrective retry, then refuse the change.
  if (ctx.hasAssetList) {
    // keys defined anywhere in the project count as real, not just those in game.js
    const allCode = gameCode + '\n' + ctx.files.map(function (f) { return f.code; }).join('\n');
    let bad = unknownAssetKeys(ops, allCode, ctx.assets);
    if (bad.length) {
      const retry = message + '\n\nIMPORTANT: your previous answer used the asset key(s) '
        + bad.map(function (k) { return '"' + k + '"'; }).join(', ')
        + ', which do not exist and would break the game. '
        + 'Redo it using ONLY the owned asset keys listed above, or — if this cannot be done with those — '
        + 'change nothing and reply with only {"reply":"..."} explaining which asset they would need to buy.';
      try { raw = await callAI(spec, system, retry, true, history, agentTools); }
      catch (e) { return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' }); }
      parsed = extractJSON(raw) || { reply: (raw || '').trim() || 'Done.' };
      ops = toOps(parsed);
      bad = unknownAssetKeys(ops, gameCode, ctx.assets);
      if (bad.length) return res.json({ reply: assetApology(bad, ctx.assets), ops: null });
    }
  }

  res.json({ reply: parsed.reply || 'Done.', why: parsed.why || '', ops: Object.keys(ops).length ? ops : null });
});

app.listen(PORT, () => {
  const c = resolveModel('coder'), t = resolveModel('tutor');
  console.log('Course agent on http://localhost:' + PORT + '  (coder: ' + c.provider + ':' + c.model + ' · tutor: ' + t.provider + ':' + t.model + ')');
});
