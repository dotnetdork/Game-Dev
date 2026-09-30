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
const tel = require('./telemetry');  // what happened, to stdout, for tools/session-capture.js

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

/* Behind the Caddy reverse proxy on the League server, `req.ip` is the proxy's own address unless Express is told there is a
   hop in front of it — the same address for every student in the world. The login throttle keys on
   it, so without this one attacker's guessing would lock out every tester at once, which is worse
   than having no limit at all.
   `1`, not `true`: trust exactly the one proxy that is really there and take the address IT added.
   `true` would trust the whole X-Forwarded-For chain including whatever a client wrote into it. */
app.set('trust proxy', 1);

/* Providers, per-agent models and the tool switches live in ai/models.js — see the Phase 1
   note there. Destructured so the rest of this file reads as it always did. */
const models = require('./ai/models');
const { DEFAULT_PROVIDER, AGENT_TOOLS, resolveModel } = models;


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
   parent's CSP, and when the game frame is sandboxed (see the note above startGame in
   js/game-runner.js) its own origin is opaque — so in there `'self'` matches nothing and would
   block Phaser and every asset. Naming the host grants exactly the same server that `'self'` was
   meant to grant, and costs nothing when the frame is unsandboxed. */
function cspFor(req) {
  /* auth.origin(req), not a second derivation. This built the origin itself from x-forwarded-proto
     and a raw `host` header, which differs from auth.js's version in two ways that matter: it
     ignores PUBLIC_ORIGIN, and it does not take the first value when a proxy sends a comma-joined
     list. So a deployment that needed PUBLIC_ORIGIN to make OAuth work — the one case the override
     exists for — got a Content-Security-Policy naming a different origin from the one it actually
     serves itself on, which is a policy that blocks the app rather than protecting it. */
  const origin = auth.origin(req);
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
auth.mount(app, { limit: store.bump, store: store });

/* ---------- the browser has to know this is a real deployment ----------
   js/dev.js decides three things: whether the course is unlocked, whether the footer carries a
   button that wipes the student's account, and whether the Play tab carries one that throws away
   their code. It was deciding them from `location.hostname` — a laptop is localhost, everything
   else is a deployment — which is a reasonable guess and is still the fallback, but it is a guess
   made by the client about a fact the SERVER knows for certain.

   NODE_ENV=production (set by app/Dockerfile) marks a real deployment, so the server says so
   outright. Readable rather than HttpOnly because the point is for a script to
   read it, and it carries no secret — one bit that is already obvious from the URL.

   Set on every response so it cannot go stale, and BEFORE the static middleware for the same reason
   the gate above is: express.static answers and returns, so a header set after it never happens on
   the one response that matters — the HTML itself. A cookie set by the response that delivers the
   document is visible to that document's scripts, so dev.js sees it on the very first paint. */
app.use((req, res, next) => {
  /* auth.secureCookie(), not a second rule of its own. This asked whether the REQUEST arrived over
     TLS while auth.js asked whether the PROCESS is hosted, so on the same response the session
     cookie and this one could be marked differently — and this one is what tells the browser it is
     talking to a deployment at all. One answer, in the file that owns cookies. */
  res.append('Set-Cookie', 'league_hosted=' + (auth.isHosted() ? '1' : '0')
    + '; Path=/; SameSite=Lax; Max-Age=86400' + auth.secureCookie());
  next();
});

app.use(auth.requireAuth);

const corsOpen = (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); };
app.use('/assets', express.static(path.join(ROOT, 'public', 'assets'), { setHeaders: corsOpen }));
app.use('/vendor', express.static(path.join(ROOT, 'public', 'vendor'), { setHeaders: corsOpen }));
/* The studio's dev panel (docs/rework/v2-spec.md §3.5) is for whoever is building the course, on
   their own machine. It is not served to a real deployment at all, not merely hidden. */
app.get('/studio/dev.js', (req, res, next) => {
  if (auth.isHosted()) return res.status(404).end();
  next();
});
/* `no-cache` for the page and its scripts, for the reason given at /content below. Without it a
   browser kept the old studio/quest.js after a restart (Sept 30: a playtest ran yesterday's page
   against today's server), and after a deploy a class would too. Art and vendored libraries above
   keep the default: they change rarely, and nothing breaks when they're a version behind. */
app.use(express.static(path.join(ROOT, 'public'), { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
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

/* ---- the studio's quests (V2) ----
   Parsed and checked by quests.js, the same code tools/check-quests.js runs, so the browser only
   ever gets a course the checker passed. Re-read when a file changes, because quests are authored
   while the server runs. A course with problems is refused whole, with the problems listed:
   a half-valid course is how a kid ends up waiting on a beat that can never finish. */
const quests = require('./quests');
let questCache = null;
function questStamp() {
  let newest = 0;
  try { fs.readdirSync(path.join(CONTENT, 'quests')).forEach((f) => { const m = fs.statSync(path.join(CONTENT, 'quests', f)).mtimeMs; if (m > newest) newest = m; }); } catch (e) {}
  return newest;
}
app.get('/api/quests', (req, res) => {
  const stamp = questStamp();
  if (!questCache || questCache.stamp !== stamp) questCache = { stamp: stamp, body: quests.load() };
  const q = questCache.body;
  if (q.problems.length) return res.status(500).json({ error: 'The course has problems.', problems: q.problems });
  res.setHeader('Cache-Control', 'no-cache');
  // logging: a playtest's student logs are on (telemetry.js, STUDENT_LOGS), so the studio sends its side too
  res.json({ tickets: q.tickets, quests: q.quests, logging: tel.logging() });
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
  ['coder', 'tutor', 'lab-tutor', 'quiz', 'grader', 'design-coach', 'mentor', 'interviewer'].forEach(function (a) { const m = resolveModel(a); agents[a] = m.provider + ':' + m.model; });
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
/* NEITHER OF THESE WAS EVER OPEN, and an earlier version of this comment said they were.
   `app.use(auth.requireAuth)` above is global and runs before every route in this file; requireAuth
   401s any path under /api/ without a session. A review reported these two as unauthenticated, the
   claim was acted on without reading the middleware order, and the "fix" below was committed with a
   message describing a hole that did not exist.
   The explicit checks are kept — they cost nothing and they state the requirement at the place a
   reader looks for it, which matters for the two endpoints that expose what the relay has spent.
   The comment is corrected because a wrong note about a security property is worse than no note. */
app.get('/api/usage', (req, res) => {
  if (!auth.currentUser(req)) return res.status(401).json({ error: 'Not signed in.' });
  res.json(usage.summary());
});
app.post('/api/usage/reset', (req, res) => {
  if (!auth.currentUser(req)) return res.status(401).json({ error: 'Not signed in.' });
  usage.reset(); res.json(usage.summary());
});

/* ---- what the browser noticed ----
   The other half of telemetry.js. Everything worth knowing that happens in the page — a click that
   hit nothing, a game that threw on frame one, a quiz answer, a lesson opened and abandoned — is
   invisible to the server, which only ever hears about AI requests and saves.
   The browser batches these and posts them here; this turns them into the same stdout lines the
   server's own events use, so one capture file holds both halves of the session.
   IDENTITY IS STAMPED HERE, never taken from the body. A batch is a list of things that happened,
   not a claim about who they happened to. */
app.post('/api/events', (req, res) => {
  const me = auth.currentUser(req);
  if (!me) return res.status(401).json({ ok: false });
  const list = Array.isArray(req.body && req.body.events) ? req.body.events.slice(0, 50) : [];
  list.forEach(function (e) {
    if (!e || typeof e !== 'object') return;
    const ev = String(e.ev || 'client').slice(0, 40);
    const fields = {};
    Object.keys(e).forEach(function (k) { if (k !== 'ev' && k !== 'who') fields[k] = e[k]; });
    fields.who = me.email;
    tel.record(ev, fields);
  });
  /* 204 rather than a body: this is fire-and-forget from a sendBeacon that nothing is waiting on. */
  res.status(204).end();
});

/* ---- the agent endpoint ----
   It lives in routes/ai.js now; see the Phase 1 note there. Mounted the way auth is — it takes
   what it needs rather than reaching back into this file.

   MOUNTED HERE, NOT AT THE TOP. Express matches in the order things are registered, and
   `app.use(auth.requireAuth)` above is what puts /api/ai behind the sign-in. Mounting this before
   that line — which is where the extraction first put it — would leave the paid AI relay open to
   anyone with the URL, which is the exact thing auth.js exists to prevent. It goes where the
   handler already was: after the gate, beside the other API routes. */
require('./routes/ai').mount(app, { auth: auth, store: store });

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

/* Saving is a WARNING, not a refusal. A laptop with no store configured is the ordinary case and
   the app works perfectly without one — but a hosted deployment without one silently loses every
   student's work the moment they open it somewhere else, which is the exact thing the testers were
   promised would not happen. So it is said out loud on every boot. */
const storeProblem = store.problem();
if (storeProblem && process.env.NODE_ENV === 'production') {
  console.error('[league] WARNING: ' + storeProblem);
}

/* Always listens. On the app's first host (Vercel) this was skipped, because that platform imported
   the file and called the exported handler per request; that host and its shim (api/index.js) are
   gone. */
app.listen(PORT, () => {
  const c = resolveModel('coder'), t = resolveModel('tutor');
  console.log('Course agent on http://localhost:' + PORT + '  (coder: ' + c.provider + ':' + c.model + ' · tutor: ' + t.provider + ':' + t.model + ')'
    + (auth.enabled() ? '  · sign-in ON' : '')
    + '  · saves: ' + store.mode());
});
