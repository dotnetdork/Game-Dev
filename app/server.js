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
const auth = require('./auth');      // Google sign-in, restricted to the school domain (off locally)
const store = require('./store');    // per-student saves, so work survives a different machine

const app = express();
/* 1mb rather than 256kb because /api/state carries a whole project, a progress ledger and a design
   board in one body, and store.js will accept up to 512KB of it. With the parser set lower, an
   oversized save was refused by Express with its own error before the handler could say anything
   useful about it. Every field of every other endpoint is sliced to a fixed length server-side, so
   the larger ceiling costs nothing. */
app.use(express.json({ limit: '1mb' }));
/* One form in the whole app — the temporary tester sign-in. A form POST rather than a fetch so it
   works with JavaScript off and the browser offers to remember the password; that needs the
   urlencoded parser, which is built into Express and costs nothing. */
app.use(express.urlencoded({ extended: false, limit: '4kb' }));

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

/* Behind Vercel's proxy, `req.ip` is the platform's own address unless Express is told there is a
   hop in front of it — the same address for every student in the world. The login throttle keys on
   it, so without this one attacker's guessing would lock out every tester at once, which is worse
   than having no limit at all.
   `1`, not `true`: trust exactly the one proxy that is really there and take the address IT added.
   `true` would trust the whole X-Forwarded-For chain including whatever a client wrote into it. */
app.set('trust proxy', 1);

// ---- AI providers (keys stay server-side, never sent to the browser) ----
// Multiple agents (coder / tutor / quiz / grader) each get their own model, set in .env.
// A model spec is "<provider>:<model>", e.g. "ollama:qwen2.5-coder:7b",
// "openrouter:qwen/qwen-2.5-coder-7b", "anthropic:claude-sonnet-5".
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
/* ON BY DEFAULT for the two agents that write or explain code, and the default changed deliberately.
   It used to be off everywhere, on the grounds that a tool round is another model call and the only
   thing to look up was a five-kilobyte cheat sheet covering twenty APIs. Both halves of that have
   changed: the lookup is now the complete Phaser reference, on disk, no network, and the cost of NOT
   looking things up is measurable.

   Measured, in fact. Asked four questions about the engine it is running, an agent with no tools
   said setTintFill "colors a sprite as a flat silhouette" (it is deprecated and does nothing in
   Phaser 4), invented a `restitution` parameter on setCollideWorldBounds that has never existed, and
   said Phaser.GameObjects.StencilReference was "made up" — it is a real class with ninety members.
   Three confidently wrong answers out of four, any of which written into a child's game is a crash
   or a silent no-op they cannot debug.

   A truthy env var still forces it on and an explicit 0 still forces it off; the change is only what
   happens when nobody has said. */
function agentTool(name, dflt) {
  const v = process.env[name];
  if (v === undefined || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(v);
}
const AGENT_TOOLS = {
  coder:  agentTool('CODER_TOOLS', true),
  tutor:  agentTool('TUTOR_TOOLS', true),
  'lab-tutor': agentTool('TUTOR_TOOLS', true),
  /* The quiz and grader agents mark work against an answer that is already in their prompt; there
     is nothing for them to look up, so they keep paying nothing for the option. */
  quiz:   agentTool('QUIZ_TOOLS', false),
  grader: agentTool('GRADER_TOOLS', false),
  /* The design coach rides on TUTOR_TOOLS: it is the tutor's job on a different tab, and there is
     nothing on a design board for a tool to look up — the board is already in the prompt. */
  'design-coach': agentTool('TUTOR_TOOLS', true)
};
const MAX_TOOL_ROUNDS = Number(process.env.AI_TOOL_ROUNDS || 4);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
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
  /* The lab bench's tutor is the tutor — same job, different context — so it rides on TUTOR_MODEL
     unless someone deliberately gives it one of its own. Without this it had no entry in
     AGENT_MODELS at all, fell through to DEFAULT_PROVIDER, and a course configured for Anthropic
     tried to reach a local Ollama that was not running: "The AI service is not reachable". */
  if (!spec && (agent === 'lab-tutor' || agent === 'design-coach')) spec = AGENT_MODELS.tutor || ai.agentModel('tutor') || '';
  if (!spec) spec = DEFAULT_PROVIDER + ':' + (PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER] || '');
  const i = spec.indexOf(':');
  // `agent` rides along so the usage meter can attribute a call without threading an extra
  // argument through every layer.
  if (i > 0 && KNOWN_PROVIDERS.indexOf(spec.slice(0, i)) >= 0) return { provider: spec.slice(0, i), model: spec.slice(i + 1), agent: agent };
  return { provider: DEFAULT_PROVIDER, model: spec, agent: agent };
}

/* ---- per-student rate limit, on the paid relay ----
   Two things were wrong with this and both mattered on a public URL.

   It was keyed on `req.body.studentId` — a value the CALLER sends. Anyone past the sign-in could
   put a fresh random id on every request and never be counted at all, which made the limit a
   suggestion. It is keyed on the session now, which the server issued and signs, so a student gets
   one bucket whatever their browser claims to be.

   And it was a Map in this module, which on Vercel counts only the requests that happened to reach
   the same instance. store.bump() puts the counter in the KV store when there is one — see the note
   there, including why it fails open. */
const RATE = { windowSec: 10 * 60, max: 40 };
async function rateLimited(req) {
  const me = auth.currentUser(req);
  const id = (me && me.email) || req.ip || 'anon';
  return (await store.bump('ai:' + id, RATE.windowSec)) > RATE.max;
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
    /* 'self', not 'none'. It was 'none' when the app had no forms at all, and that was the right
       answer then — nothing could be made to POST anywhere. The temporary tester sign-in is a real
       form POST (chosen so it works with JavaScript off and the browser offers to remember the
       password), and 'none' blocks a form from submitting ANYWHERE, its own origin included: the
       button silently did nothing. 'self' keeps the protection that matters — a script cannot make
       the page post credentials to somebody else's server — while letting our one form work. */
    "form-action 'self'",
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
/* ---- who is allowed in ----
   Off entirely unless GOOGLE_CLIENT_ID and friends are set, so `npm start` on a laptop is unchanged
   and no local workflow needs a Google account. On a public host it is what stops /api/ai being a
   free Claude proxy for whoever finds the URL. See auth.js for why it is a signed cookie and not a
   session store, and why the id_token's signature is not re-verified.

   Mounted BEFORE the static middleware on purpose: express.static answers and returns, so a gate
   installed after it would guard the API and hand out the whole course to anyone. */
auth.mount(app, { limit: store.bump });

/* ---------- the browser has to know this is a real deployment ----------
   js/dev.js decides three things: whether the course is unlocked, whether the footer carries a
   button that wipes the student's account, and whether the Play tab carries one that throws away
   their code. It was deciding them from `location.hostname` — a laptop is localhost, everything
   else is a deployment — which is a reasonable guess and is still the fallback, but it is a guess
   made by the client about a fact the SERVER knows for certain.

   `VERCEL` is set on every Vercel deployment and NODE_ENV covers anywhere else it runs for real, so
   the server says so outright. Readable rather than HttpOnly because the point is for a script to
   read it, and it carries no secret — one bit that is already obvious from the URL.

   Set on every response so it cannot go stale, and BEFORE the static middleware for the same reason
   the gate above is: express.static answers and returns, so a header set after it never happens on
   the one response that matters — the HTML itself. A cookie set by the response that delivers the
   document is visible to that document's scripts, so dev.js sees it on the very first paint. */
app.use((req, res, next) => {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.append('Set-Cookie', 'league_hosted=' + (auth.isHosted() ? '1' : '0')
    + '; Path=/; SameSite=Lax; Max-Age=86400' + secure);
  next();
});

app.use(auth.requireAuth);

const corsOpen = (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); };
app.use('/assets', express.static(path.join(ROOT, 'public', 'assets'), { setHeaders: corsOpen }));
app.use('/vendor', express.static(path.join(ROOT, 'public', 'vendor'), { setHeaders: corsOpen }));
app.use(express.static(path.join(ROOT, 'public')));
/* Authored course content: YAML, Markdown and the lesson diagrams (read-only).
   `no-cache` means "revalidate before reusing", not "do not store" — the ETag comes back with it,
   so an unchanged file still costs a 304 and no bytes.
   This previously turned OFF etag, lastModified AND cacheControl, which sounds like the strongest
   possible anti-caching setting and is the opposite: with no validator and no directive at all, a
   browser falls back to heuristic freshness and is entitled to keep serving what it has. The
   symptom was editing a lesson diagram, reloading, and being shown the old drawing — which is a
   bad way to author content that is meant to be edited while the server runs. */
app.use('/content', express.static(path.join(ROOT, 'content'), {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache')
}));

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

/* The badge a lesson's your-turn step awards. Authored inside the ```yourturn block as `reward:`,
   which is the only place that key appears in a lesson. Pulled out here because the app needs to
   show a student every badge in the course — the ones still to earn as much as the ones they have,
   since a trophy case with no empty slots is not much of an incentive. The file is already being
   read in full for its front-matter, so this costs one regex and no extra I/O. */
function rewardOf(raw) {
  const m = String(raw).match(/^reward:\s*(.+?)\s*$/m);
  if (!m) return '';
  return m[1].replace(/^(['"])([\s\S]*)\1$/, '$2').trim();   // unwrap a quoted value
}

function buildIndex() {
  const data = yaml.load(fs.readFileSync(path.join(CONTENT, 'course.yaml'), 'utf8')) || {};
  const modules = (data.modules || []).map((mod) => {
    const lessons = (mod.lessons || []).map((id) => {
      let meta = {}, reward = '';
      try {
        const raw = fs.readFileSync(path.join(LESSON_DIR, id + '.md'), 'utf8');
        meta = frontMatter(raw);
        reward = rewardOf(raw);
      }
      catch (e) { return { id: id, title: id, xp: 0, summary: '', ai: 'full', reward: '', checkpoint: false, missing: true }; }
      return {
        id: id,
        title: meta.title || id,
        xp: meta.xp || 0,
        summary: meta.summary || '',
        ai: meta.ai || 'full',
        reward: reward,
        /* A checkpoint is the lesson at the end of a module where the student works on their OWN
           game. It is carried in the index rather than read from the body because the outline draws
           it differently and the completion rule changes for it, and both of those happen before
           any body is fetched. See lessonActivityKeys in js/widgets.js. */
        checkpoint: meta.checkpoint === true
      };
    });
    return { id: mod.id, name: mod.name, stars: mod.stars || 0, lessons: lessons };
  });
  return { id: data.id, name: data.name || 'Course', library: data.library || 'Phaser', modules: modules };
}

/* ---- who made the pictures ----
   Derived from the lessons, never hand-kept. The <cite> beside a figure is already the credit, and
   check-lessons.js refuses a borrowed picture that has none — so a maintained list here would be a
   second copy of the same fact, free to drift from the first the next time a lesson gains a figure.

   Grouped by the credit line rather than by file, which sorts both shapes correctly on its own: a
   borrowed screenshot has a credit no other picture shares and gets its own row, while the seventy
   sprites of the course's own Kenney art share one line and collapse into a single row.

   This answers "who made what you can see", which is the question a reader has. It does not replace
   content/images/shots/CREDITS.md — that records where each file was fetched from, under which
   licence, and which five are a fair-use claim rather than a permission. Different question. */
const FIGURE_RE = /<figure\b[^>]*>([\s\S]*?)<\/figure>/g;
const CITE_RE = /<cite\b[^>]*>([\s\S]*?)<\/cite>/;
const MEDIA_SRC_RE = /<(?:img|source)\b[^>]+src\s*=\s*["']([^"']+)["']/g;

function plainText(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function buildCredits() {
  const index = buildIndex();
  const groups = new Map();       // credit line -> { credit, pictures:Set, lessons:[] }
  index.modules.forEach((mod) => {
    mod.lessons.forEach((lesson) => {
      let raw = '';
      try { raw = fs.readFileSync(path.join(LESSON_DIR, lesson.id + '.md'), 'utf8'); } catch (e) { return; }
      FIGURE_RE.lastIndex = 0;
      let fig;
      while ((fig = FIGURE_RE.exec(raw))) {
        const inner = fig[1] || '';
        const cited = inner.match(CITE_RE);
        if (!cited) continue;
        const credit = plainText(cited[1]);
        if (!credit) continue;
        if (!groups.has(credit)) groups.set(credit, { credit: credit, pictures: new Set(), lessons: [] });
        const g = groups.get(credit);
        MEDIA_SRC_RE.lastIndex = 0;
        let src;
        while ((src = MEDIA_SRC_RE.exec(inner))) g.pictures.add(src[1]);
        // A lesson that shows four Kenney sprites is still one place it appears.
        if (g.lessons.indexOf(lesson.title) < 0) g.lessons.push(lesson.title);
      }
    });
  });
  return {
    credits: Array.from(groups.values()).map((g) => ({
      credit: g.credit,
      pictures: g.pictures.size,
      lessons: g.lessons
    }))
  };
}

let creditsCache = null;
app.get('/api/credits', (req, res) => {
  try {
    const stamp = newestMtime();
    if (!creditsCache || creditsCache.stamp !== stamp) creditsCache = { stamp: stamp, body: buildCredits() };
    res.json(creditsCache.body);
  } catch (e) {
    res.status(500).json({ error: 'Could not read the course content.' });
  }
});

app.get('/api/lessons', (req, res) => {
  try {
    const stamp = newestMtime();
    if (!indexCache || indexCache.stamp !== stamp) indexCache = { stamp: stamp, body: buildIndex() };
    res.json(indexCache.body);
  } catch (e) {
    res.status(500).json({ error: 'Could not read the course content.' });
  }
});

/* ---- which models are running, and whether they can look anything up ----
   The models were the whole of this, and the lookups were the thing that silently broke. A tutor
   deployed with TUTOR_TOOLS=0 in its environment does not fail: it answers from memory, tells the
   student it has no way to read the Phaser docs, and is wrong roughly as often as it was before the
   docs existed. Nothing in the app shows that, so it went unnoticed on the deployed site while
   working perfectly on the laptop it was tested on.
   `tools` is the switches, `lookups` is whether the files behind them are actually readable from
   this process. Both have to be true for an agent to answer from the docs, and they fail for
   completely different reasons — an environment variable, and a missing file in the bundle. */
app.get('/api/info', (req, res) => {
  const agents = {};
  ['coder', 'tutor', 'lab-tutor', 'quiz', 'grader', 'design-coach'].forEach(function (a) { const m = resolveModel(a); agents[a] = m.provider + ':' + m.model; });
  res.json({
    agents: agents,
    provider: DEFAULT_PROVIDER,
    model: resolveModel('coder').model,
    tools: AGENT_TOOLS,
    lookups: tools.status()
  });
});

/* ---- the student's work, on the server ----
   Behind requireAuth, and the identity comes from the SESSION rather than from the request, so one
   student cannot read or overwrite another's save by asking for it. See store.js for why this
   exists at all: localStorage is per-browser, and the testers get more than one session.

   The blob is opaque to the server on purpose. The browser owns the shape; this is a copy of it. */
app.get('/api/state', async (req, res) => {
  if (!store.enabled()) return res.json({ store: false });
  const me = auth.currentUser(req);
  if (!me) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const rec = await store.read(me.email);
    /* `me` goes back so the browser can tell whether the work sitting in its localStorage belongs
       to whoever is signed in now. Two testers sharing a borrowed laptop is a real case — see the
       owner check in sync.js. */
    res.json({ store: true, me: me.email, at: (rec && rec.at) || 0, data: (rec && rec.data) || null });
  } catch (e) {
    /* A store that is down must not break the app — the browser carries on with localStorage and
       tries again next time. Reported as reachable-but-failed so the client can tell the two apart.
       `me` still goes back: it comes from the session cookie, not the store, and it is what lets the
       browser notice that the work sitting in it belongs to a different student. */
    res.json({ store: true, me: me.email, error: 'unreachable', at: 0, data: null });
  }
});
app.put('/api/state', async (req, res) => {
  if (!store.enabled()) return res.json({ store: false });
  const me = auth.currentUser(req);
  if (!me) return res.status(401).json({ error: 'Not signed in.' });
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'No data.' });
  /* WHOSE WORK THE BROWSER THINKS THIS IS, checked against whose session is actually presenting it.
     The browser keeps one student's work at a time and stamps it; if the two disagree, this upload
     is one child's game arriving under another child's name and it is refused rather than stored.

     It is a real race, not a hypothetical: a tab that has been signed out and back in as somebody
     else fires its unload-time save with the NEW cookie and the OLD student's data. The browser
     tries not to do that; this makes it impossible. */
  const claims = String((req.body && req.body.who) || '');
  if (claims && claims !== me.email) {
    return res.status(409).json({ error: 'That save belongs to a different sign-in.', me: me.email });
  }
  const at = Date.now();
  try {
    await store.write(me.email, { at: at, who: me.email, name: me.name || '', data: data });
    res.json({ ok: true, at: at });
  } catch (e) {
    if (e && e.tooBig) return res.status(413).json({ error: 'That save is too large to keep.' });
    res.status(502).json({ error: 'Could not save just now.' });
  }
});
/* Paired with "Reset everything" in the Help page. Without it, a reset would clear the browser and
   then the next load would adopt the server copy straight back. */
app.delete('/api/state', async (req, res) => {
  if (!store.enabled()) return res.json({ store: false });
  const me = auth.currentUser(req);
  if (!me) return res.status(401).json({ error: 'Not signed in.' });
  try { await store.clear(me.email); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ error: 'Could not clear just now.' }); }
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
  /* The one request the Build helper should NOT satisfy.
     Every other change a student asks for is theirs to ask for — that is what this helper is. But
     the practice exercise is the lesson's only check that the student can do the thing themselves,
     and its grader reads the file, so it cannot tell whose hands typed it. Writing this one edit
     hands over the badge and removes the only evidence either of them had. */
  if (ctx.practiceTask && (ctx.practiceTask.task || ctx.practiceTask.steps.length)) {
    s += '\n\nTHIS LESSON\'S PRACTICE EXERCISE — the student is meant to do this one themselves:\n';
    if (ctx.practiceTask.title) s += '  ' + ctx.practiceTask.title + '\n';
    if (ctx.practiceTask.task) s += '  ' + ctx.practiceTask.task + '\n';
    ctx.practiceTask.steps.forEach(function (st, i) { s += '  ' + (i + 1) + '. ' + st + '\n'; });
    s += 'If what they are asking for IS this exercise, do not make the edit. Return no edit field '
      + 'at all — just a "reply" that names the one step they are stuck on, says what to look for, '
      + 'and tells them the Tutor (the other mode of this panel) will talk it through. Be warm '
      + 'about it and be specific about the step; "do it yourself" on its own is useless to them.\n'
      + 'This applies ONLY to this exercise. Anything else they want in their game — art, enemies, '
      + 'a new mechanic, a bug they cannot find — you build as normal, including while this lesson '
      + 'is open. When it is close but not the same thing, build it.';
  }
  if ((ctx.assets && ctx.assets.length) || (ctx.assetSets && ctx.assetSets.length)) {
    s += '\n\nASSETS THE STUDENT OWNS — these are the ONLY asset keys that exist:\n'
      + ctx.assets.map(function (a) { return '  ' + a.key + '  (' + a.type + ')'; }).join('\n');
    /* Whole sets are described rather than listed. Naming all four hundred would crowd out the
       student's own code, and the numbering is regular enough to use from the description. */
    if (ctx.assetSets && ctx.assetSets.length) {
      s += '\n\nWHOLE SETS THEY OWN — every key in these ranges exists and is safe to use:\n'
        + ctx.assetSets.map(function (t) {
            const w = String(Math.max(0, t.count - 1));
            return '  ' + t.prefix + '0000 … ' + t.prefix + '0'.repeat(Math.max(0, 4 - w.length)) + w
              + '   (' + t.count + ' pictures — ' + t.name + ')';
          }).join('\n')
        + '\nThese are numbered, not named, so you cannot tell what a given one looks like. Do not guess '
        + 'that a particular number is a coin or a door. Use one only when the student names it, or when '
        + 'they ask you to try numbers so they can see which is which.';
    }
    s += '\nUse ONLY these keys. NEVER invent an asset key: a key that is not on this list fails to load and breaks the game. '
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
// `sets` are owned bundles as prefix+count: a key inside one of those ranges is owned even though
// it is not in the (capped) key list, which is what stops a 400-tile set being rejected from 301.
function unknownAssetKeys(ops, gameCode, owned, sets) {
  const code = opsCode(ops);
  if (!code.trim()) return [];
  const defined = matchAll(gameCode + '\n' + code, ASSET_DEFS);   // existing code counts
  const ownedSet = {};
  (owned || []).forEach(function (a) { ownedSet[a.key] = true; });
  const inSet = function (k) {
    return (sets || []).some(function (t) {
      if (k.indexOf(t.prefix) !== 0) return false;
      /* The tail has to be a number inside the set, so a prefix cannot wave through anything that
         merely starts with the same letters. */
      const tail = k.slice(t.prefix.length);
      return /^\d+$/.test(tail) && parseInt(tail, 10) < t.count;
    });
  };
  return Object.keys(matchAll(code, ASSET_USES))
    .filter(function (k) { return !ownedSet[k] && !defined[k] && !inSet(k); });
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
  const inGame = opsCode(ops).replace(ops.editFile && ops.editFile.code ? ops.editFile.code : '\0', '');
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
    + 'The student is building a 2D Phaser 4 game. game.js defines a CONFIG object and functions '
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
    + '- Use only Phaser 4 APIs and the patterns already in the file. Never write a new Phaser.Game.\n'
    + '- For drawing, use only real Phaser Graphics methods (fillRect, fillRoundedRect, fillCircle, fillTriangle, beginPath/moveTo/lineTo/closePath/fillPath, generateTexture). Do NOT use HTML-canvas methods like cubicCurveTo, bezierCurveTo, or arcTo — they do not exist on Phaser Graphics and crash the game.\n'
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

/* A quiz question is checked before a child sees it, the same way the coder's ops are.
   Lives in ai/quiz-check.js so it can be tested on its own — see tools/check-quiz.js. */
const cleanQuizQuestion = require('./ai/quiz-check').cleanQuizQuestion;
const cleanGrade = require('./ai/grade-check').cleanGrade;
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
  if (await rateLimited(req)) return res.status(429).json({ reply: 'Slow down a moment - you have hit the request limit. Try again shortly.' });
  const message = ((req.body && req.body.message) || '').toString().slice(0, 2000);
  if (!message) return res.status(400).json({ reply: 'Please type a message.' });
  const gameCode = ((req.body && req.body.code) || '').toString().slice(0, 100000);
  const context = ((req.body && req.body.context) || '').toString().slice(0, 4000);
  const history = sanitizeHistory(req.body && req.body.history);
  let agent = (req.body && req.body.agent) || 'coder';
  if (['coder', 'tutor', 'lab-tutor', 'quiz', 'grader', 'design-coach'].indexOf(agent) < 0) agent = 'coder';   // controller: keep to known agents
  const spec = resolveModel(agent);

  // Context the browser sends about where the student is and what exists in their project.
  const b = req.body || {};
  const ctx = {
    lessonTitle: (b.lessonTitle || '').toString().slice(0, 120),
    lessonContext: (b.lessonContext || '').toString().slice(0, 3000),
    /* The lesson's practice exercise, sent separately because lessonContext is truncated long
       before it. See buildContextBlock for what the coder is told to do with it. */
    practiceTask: (b.practiceTask && typeof b.practiceTask === 'object') ? {
      title: String(b.practiceTask.title || '').slice(0, 120),
      task: String(b.practiceTask.task || '').slice(0, 400),
      steps: Array.isArray(b.practiceTask.steps)
        ? b.practiceTask.steps.slice(0, 8).map(function (s) { return String(s || '').slice(0, 200); }).filter(Boolean)
        : []
    } : null,
    /* The lab bench's own context, for the lab-tutor agent. Kept separate from `code` and
       `lessonContext` on purpose: a lab is a canvas exercise with no relation to the student's
       game, and feeding it through the game-shaped slots is exactly how the tutor came to answer
       questions about game.js and Phaser to a student looking at neither. */
    lab: (b.lab && typeof b.lab === 'object') ? {
      title: String(b.lab.title || '').slice(0, 120),
      task: String(b.lab.task || '').slice(0, 400),
      goal: String(b.lab.goal || '').slice(0, 300),
      code: String(b.lab.code || '').slice(0, 6000),
      log: String(b.lab.log || '').slice(0, 1500)
    } : null,
    /* The design board, for the design-coach agent. Separate for the same reason the lab's context
       is: a different room with different furniture, and a prompt that reads `board` should not
       have to dig it out of the lesson context. */
    board: (b.board && typeof b.board === 'object') ? {
      title: String(b.board.title || '').slice(0, 120),
      lesson: String(b.board.lesson || '').slice(0, 120),
      /* Frame titles are capped but never rewritten, because the coach addresses a new sticky to a
         frame BY ITS TITLE — a title that came back different from the one it was shown is a
         sticky that lands nowhere. 24 frames and 12 stickies each is well past what a term's board
         holds; the caps are here so a pasted novel cannot become the prompt. */
      frames: Array.isArray(b.board.frames) ? b.board.frames.slice(0, 24).map(function (f) {
        return {
          title: String((f && f.title) || '').slice(0, 80),
          notes: Array.isArray(f && f.notes) ? f.notes.slice(0, 12)
            .map(function (x) { return String(x || '').slice(0, 300); })
            .filter(Boolean) : []
        };
      }).filter(function (f) { return f.title; }) : [],
      loose: Array.isArray(b.board.loose) ? b.board.loose.slice(0, 40)
        .map(function (x) { return String(x || '').slice(0, 300); }).filter(Boolean) : []
    } : null,
    /* Which screen the student is actually looking at. "Why isn't it working?" is three different
       questions on the Learn, Code and Game tabs, and both agents were answering it blind. */
    where: (b.where || '').toString().slice(0, 400),
    aiMode: ['full', 'guided', 'off'].indexOf(b.aiMode) >= 0 ? b.aiMode : 'full',
    hasAssetList: Array.isArray(b.ownedAssets),   // only validate keys when the client actually told us what it owns
    assets: Array.isArray(b.ownedAssets) ? b.ownedAssets.slice(0, 300).map(function (a) {
      return { key: String((a && a.key) || '').slice(0, 60), type: String((a && a.type) || '').slice(0, 20) };
    }).filter(function (a) { return a.key; }) : [],
    /* Owned bundles as `prefix × count`. The 300 cap above exists to keep the prompt sane, but the
       same list is what the answer is VALIDATED against — so without this a student who owns a
       400-tile set would have their own tiles rejected as invented from number 301 onwards. */
    assetSets: Array.isArray(b.ownedSets) ? b.ownedSets.slice(0, 40).map(function (s) {
      return {
        prefix: String((s && s.prefix) || '').slice(0, 60),
        count: Math.max(0, Math.min(9999, parseInt((s && s.count) || 0, 10) || 0)),
        name: String((s && s.name) || '').slice(0, 60)
      };
    }).filter(function (s) { return s.prefix.length >= 4; }) : [],
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
    }).filter(function (l) { return l.text; }) : [],
    /* What a practice step asked for, and what the student changed in response. `changedCode` is a
       diff rather than the whole project: the grader is judging one specific task, and handing it
       6000 lines to find a two-line change in is how it ends up judging the wrong thing. */
    taskTitle: String(b.taskTitle || '').slice(0, 200),
    taskSteps: Array.isArray(b.taskSteps)
      ? b.taskSteps.slice(0, 12).map(function (s) { return String(s || '').slice(0, 300); }).filter(Boolean)
      : [],
    changedCode: String(b.changedCode || '').slice(0, 6000)
  };

  // Tier 2: when this agent has tools switched on, it may look things up instead of guessing.
  // ctx already carries the assets, files, game code and lesson this request is about.
  const agentTools = AGENT_TOOLS[agent] ? ctx : null;

  /* TUTOR and LAB-TUTOR: plain-language explanation, no code edits.
     lab-tutor has to be named here. Every agent this chain does not recognise falls through to the
     CODER branch at the bottom — so the lab's tutor was being run on the coder's prompt, which is
     built entirely around game.js, and it answered a student staring at a canvas exercise with
     advice about their Phaser game being empty. Adding an agent means adding it to this list. */
  if (agent === 'tutor' || agent === 'lab-tutor') {
    let raw;
    const tutorSystem = ai.buildPrompt(agent, Object.assign({ gameCode: gameCode }, ctx))
      || (agent === 'tutor' ? fallbackTutorSystem(gameCode, context, ctx) : null);
    if (!tutorSystem) return res.status(500).json({ reply: 'The lab tutor prompt is missing (ai/agents/lab-tutor.md).' });
    try { raw = await callAI(spec, tutorSystem, message, false, history, agentTools); }
    catch (e) { return res.status(502).json({ reply: 'The tutor is not reachable right now (' + e.message + ').' }); }
    return res.json({ reply: (raw || '').trim() || 'Hmm, I am not sure — try rephrasing.' });
  }

  /* DESIGN-COACH: the Tutor, when the student is standing on the Design tab. Same shape as the
     tutor above — prose in, prose out — with the board in its context instead of a lesson's code.

     It used to return a wording for a box as well, as a trailing `SLOT:` line the browser applied
     to design.md. That went with the checkpoints: the board is the student's now, and an assistant
     that writes on it while they are looking at it is the assistant deciding what their game is.
     The coach asks; the student writes. */
  if (agent === 'design-coach') {
    let raw;
    const coachSystem = ai.buildPrompt('design-coach', ctx);
    if (!coachSystem) return res.status(500).json({ reply: 'The design coach prompt is missing (ai/agents/design-coach.md).' });
    try { raw = await callAI(spec, coachSystem, message, false, history, agentTools); }
    catch (e) { return res.status(502).json({ reply: 'The coach is not reachable right now (' + e.message + ').' }); }
    return res.json({ reply: (raw || '').trim() || 'Hmm, I am not sure — tell me a bit more about your game.' });
  }

  // QUIZ / GRADER. Both are shown to a child as if they were correct, so neither is trusted:
  // the quiz's answer key is checked, and the grader's verdict is checked against its own hint.
  if (agent === 'quiz' || agent === 'grader') {
    let raw;
    const agentSystem = ai.buildPrompt(agent, ctx) || FALLBACK_AGENT_SYSTEMS[agent];
    try { raw = await callAI(spec, agentSystem, message, true, [], agentTools); }
    catch (e) { return res.status(502).json({ error: 'The ' + agent + ' agent is not reachable (' + e.message + ').' }); }
    const parsedAgent = extractJSON(raw) || {};
    if (agent === 'quiz') {
      const q = cleanQuizQuestion(parsedAgent);
      // `{}` on purpose rather than an error: the browser already skips a question it cannot use,
      // and a silently absent bonus question is the correct outcome, not a failure to report.
      if (!q) console.warn('[ai] dropped a malformed quiz question: ' + JSON.stringify(parsedAgent).slice(0, 300));
      return res.json({ result: q || {} });
    }
    /* The grader is the one agent whose reply can tell a child their work is not good enough, so
       it gets the strictest treatment of the three: a real boolean verdict, a hint, and the two
       agreeing with each other. Anything else returns `{}`, which the browser reads as "I could
       not check this" and never as a fail. Refusing a student who did the work is the expensive
       mistake; letting one through is not. */
    const g = cleanGrade(parsedAgent);
    if (!g) console.warn('[ai] dropped a malformed grade: ' + JSON.stringify(parsedAgent).slice(0, 300));
    return res.json({ result: g || {} });
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
    let bad = unknownAssetKeys(ops, allCode, ctx.assets, ctx.assetSets);
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
      bad = unknownAssetKeys(ops, gameCode, ctx.assets, ctx.assetSets);
      if (bad.length) return res.json({ reply: assetApology(bad, ctx.assets), ops: null });
    }
  }

  res.json({ reply: parsed.reply || 'Done.', why: parsed.why || '', ops: Object.keys(ops).length ? ops : null });
});

/* ---- app routes reach the app ----
   The browser now has real addresses: /lesson/what-an-engine-does, /store, /help. Those paths mean
   something to js/router.js and nothing to the file system, so a reload or a pasted link would
   otherwise 404 on the very thing the routing exists to make shareable.
   Deliberately LAST, so it can only ever see what nothing else claimed: express.static above has
   already served every real file, and /api and /content have already answered. A path with a dot in
   its last segment is treated as a missing file and left to 404 honestly — returning index.html for
   a mistyped script name would turn a clear failure into a blank page and a confusing console. */
app.get(/^\/(?!api\/)(?!content\/).*$/, (req, res, next) => {
  /* ...EXCEPT under /docs/, where a dotted last segment is the normal case rather than a missing
     file. Every name in the Phaser reference is dotted — Phaser.Physics.Arcade.Sprite — so the
     "looks like a filename" rule 404'd every single API address the moment one was pasted or
     reloaded, which is the one thing giving them addresses was for. There are no real files under
     /docs, so nothing is being hidden by the exemption. */
  const isDocs = /^\/docs(\/|$)/.test(req.path);
  if (!isDocs && /\.[a-z0-9]+$/i.test(req.path.split('/').pop() || '')) return next();
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

/* A half-configured gate is worse than none: it looks locked and is not. Fail at boot, loudly,
   rather than serving the whole course to the internet because one variable was misspelt. */
const authProblem = auth.configProblem();
if (authProblem) {
  console.error('[league] ' + authProblem);
  console.error('[league] refusing to start — see DEPLOY.md.');
  process.exit(1);
}

/* Vercel imports this file and calls the exported handler per request; there is no port to listen
   on and calling listen() there would hold the function open. Locally there is no VERCEL variable
   and it starts a server exactly as it always has. */
/* Saving is a WARNING, not a refusal. A laptop with no store configured is the ordinary case and
   the app works perfectly without one — but a hosted deployment without one silently loses every
   student's work the moment they open it somewhere else, which is the exact thing the testers were
   promised would not happen. So it is said out loud on every boot. */
const storeProblem = store.problem();
if (storeProblem && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
  console.error('[league] WARNING: ' + storeProblem);
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const c = resolveModel('coder'), t = resolveModel('tutor');
    console.log('Course agent on http://localhost:' + PORT + '  (coder: ' + c.provider + ':' + c.model + ' · tutor: ' + t.provider + ':' + t.model + ')'
      + (auth.enabled() ? '  · sign-in ON' : '')
      + '  · saves: ' + store.mode());
  });
}

module.exports = app;
