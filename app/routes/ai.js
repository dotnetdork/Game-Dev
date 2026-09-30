/* routes/ai.js — the agent endpoint.
 *
 * Moved out of server.js whole, unedited, by the Phase 1 split in
 * docs/architecture-audit-2026-09-15.md. It was ~330 lines inside a 1300-line file and it is the
 * only route in the app with real logic in it: five agent branches, four corrective guards, and a
 * telemetry wrapper that exists because the handler leaves by eighteen different doors.
 *
 * Mounted the way auth does it — `mount(app, deps)` — so this file never reaches back into
 * server.js for anything. Everything it needs arrives in `deps`.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ai = require('../ai/loader');
const tools = require('../ai/tools');
const tel = require('../telemetry');
const models = require('../ai/models');
const provider = require('../ai/provider');
const guards = require('../ai/guards');
const cleanQuizQuestion = require('../ai/quiz-check').cleanQuizQuestion;
const cleanGrade = require('../ai/grade-check').cleanGrade;

/* Pulled off the modules above so the moved code reads exactly as it did in server.js. */
const { AGENT_TOOLS, resolveModel } = models;
const { TOTAL_BUDGET_MS, callAI } = provider;
const { extractJSON, sanitizeHistory, unknownAssetKeys, badApisIn, badKeysIn,
  claimsChangeWithoutOps, heldNote, builderNote, isEmptyAck } = guards;

/* ---------- the studio Builder's (V2) pure helpers ----------
   Module-level because they are pure functions and constants: nothing here holds a request's state
   (CLAUDE.md, "per-request state goes on the request"). The branch that uses them is BUILDER, below.

   The Builder is sent the kid's whole game.js and answers with find/replace edits, which the SERVER
   applies, compiles and checks before the browser sees anything. V1's coder sent whole files back
   and let the browser apply them (js/ops.js); that cost a 12k-character answer for a two-line
   change, and a truncated answer was a lost change. An edit list is small, and applying it here
   means every check runs against the exact code the kid will get. */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');
/* The browser gives up at 40s (studio/builder.js), so the server has to finish first, or its honest
   answer arrives at a page that has already stopped listening. 36s is one answer and one corrective
   retry on a hosted model with the game code in the prompt, with room to spare. */
const BUILDER_BUDGET_MS = 36000;
/* How much of game.js the prompt carries: all of it, in practice. The shape-drawn starter is already
   ~18k characters (about 5k tokens), and a Builder that cannot see the part of the file it needs to
   change can only guess at a `find`. */
const BUILDER_SHOWN = 32000;
const BUILDER_MAX = 60000;       // longer than this and it is not a game.js the Builder should edit

/* The same 8-hex-digit FNV-1a as studio/builder.js, over UTF-16 code units, so the browser can check
   that `base` is a hash of exactly the code it sent. Not security; a consistency check. */
function codeHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}
/* A part setting the Inspector could hold: true/false, a finite number, a short word, null, or a
   small list of number pairs (spots, pieces). Anything else is not plain data and is dropped. */
function plainValue(v, strMax) {
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.length <= (strMax || 40);
  if (Array.isArray(v)) {
    return v.length <= 12 && v.every(function (pair) {
      return Array.isArray(pair) && pair.length === 2
        && pair.every(function (n) { return typeof n === 'number' && Number.isFinite(n); });
    });
  }
  return false;
}
const SETTING_KEY = /^[A-Za-z][A-Za-z0-9]{0,23}$/;
const PART_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/* The parts the browser sent, cleaned for the prompt. Generous (40 parts, longer strings, longer
   lists) because this is only what the model is SHOWN; the ops it sends back are held to the
   stricter plainValue above. */
function cleanSentParts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).map(function (p) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id) return null;
    const out = {};
    const num = function (n) { return typeof n === 'number' && Number.isFinite(n); };
    Object.keys(p).slice(0, 30).forEach(function (k) {
      if (!SETTING_KEY.test(k)) return;
      const v = p[k];
      const shown = Array.isArray(v)
        ? v.length <= 40 && v.every(function (x) { return num(x) || (Array.isArray(x) && x.length <= 4 && x.every(num)); })
        : plainValue(v, 120);
      if (shown) out[k] = v;
    });
    out.id = String(p.id).slice(0, 40);
    return out;
  }).filter(Boolean);
}
/* The model's part ops, cleaned. Ids are checked against the parts that exist, growing as `add`s
   are accepted, so "add a slime, then set its speed" works in one answer. Removing the level or the
   player is refused: the starter code reads both unconditionally, so either one gone is a crash. */
function cleanPartOps(raw, sent) {
  const known = {};
  sent.forEach(function (p) { known[p.id] = true; });
  const ops = [], dropped = [];
  (Array.isArray(raw) ? raw : []).forEach(function (o) {
    if (ops.length >= 6) { dropped.push('more than 6 ops'); return; }
    if (!o || typeof o !== 'object') { dropped.push('not an op'); return; }
    if (o.op === 'set') {
      const id = String(o.id || ''), key = String(o.key || '');
      if (!known[id]) { dropped.push('set on unknown part "' + id.slice(0, 30) + '"'); return; }
      if (!SETTING_KEY.test(key) || key === 'id' || key === 'kind') { dropped.push('set of bad key "' + key.slice(0, 30) + '"'); return; }
      if (!plainValue(o.value)) { dropped.push('set ' + id + '.' + key + ' to a non-plain value'); return; }
      ops.push({ op: 'set', id: id, key: key, value: o.value });
    } else if (o.op === 'add') {
      const p = o.part;
      if (!p || typeof p !== 'object') { dropped.push('add with no part'); return; }
      const id = String(p.id || ''), name = typeof p.name === 'string' ? p.name.trim().slice(0, 30) : '';
      const kind = String(p.kind || '');
      if (!PART_ID.test(id) || id.length > 24) { dropped.push('add with bad id "' + id.slice(0, 30) + '"'); return; }
      if (known[id]) { dropped.push('add of "' + id + '", which already exists'); return; }
      if (!name) { dropped.push('add of "' + id + '" with no name'); return; }
      if (!PART_ID.test(kind) || kind.length > 20) { dropped.push('add of "' + id + '" with bad kind'); return; }
      const part = { id: id, name: name, kind: kind };
      Object.keys(p).slice(0, 20).forEach(function (k) {
        if (k === 'id' || k === 'name' || k === 'kind') return;
        if (SETTING_KEY.test(k) && plainValue(p[k])) part[k] = p[k];
        else dropped.push('field "' + k.slice(0, 24) + '" on new part "' + id + '"');
      });
      known[id] = true;
      ops.push({ op: 'add', part: part });
    } else if (o.op === 'remove') {
      const id = String(o.id || '');
      if (!known[id]) { dropped.push('remove of unknown part "' + id.slice(0, 30) + '"'); return; }
      const was = sent.filter(function (p) { return p.id === id; })[0];
      if (was && (was.kind === 'level' || was.kind === 'player')) { dropped.push('remove of the ' + was.kind); return; }
      delete known[id];
      ops.push({ op: 'remove', id: id });
    } else dropped.push('unknown op "' + String(o.op).slice(0, 20) + '"');
  });
  return { ops: ops, dropped: dropped };
}
/* Apply find/replace edits in order. Every `find` has to occur EXACTLY once in the code as it stands
   when that edit is applied: missing means the model misremembered the file, and twice means it
   cannot know which one it meant. Either way NONE of the edits are kept, because half a change is
   the likeliest way to break a game. */
function applyEdits(code, raw) {
  const list = Array.isArray(raw) ? raw.slice(0, 12) : [];
  let next = code; const bad = [];
  list.forEach(function (e, i) {
    const find = (e && typeof e.find === 'string') ? e.find.replace(/\r\n/g, '\n') : '';
    const repl = (e && typeof e.replace === 'string') ? e.replace.replace(/\r\n/g, '\n') : null;
    if (!find || repl === null) { bad.push({ i: i + 1, n: -1, find: find }); return; }
    const n = next.split(find).length - 1;
    if (n !== 1) { bad.push({ i: i + 1, n: n, find: find }); return; }
    const at = next.indexOf(find);
    next = next.slice(0, at) + repl + next.slice(at + find.length);
  });
  return { code: next, count: list.length, bad: bad,
    added: list.map(function (e) { return (e && typeof e.replace === 'string') ? e.replace : ''; }).join('\n') };
}
/* Compiles without running: class syntax, top-level const and arrow functions are all fine. */
function compileError(src) {
  try { new vm.Script(src, { filename: 'game.js' }); return ''; }
  catch (e) { return String(e.message || e); }
}
/* Picture and sound paths in the text an edit ADDS that are not really there under public/assets,
   and web addresses the code did not already have. The game frame fetches /assets/... by path, so
   an invented one is a missing texture at best. */
function badPaths(added, original) {
  const out = {};
  (added.match(/\/assets\/[A-Za-z0-9_\-./]+/g) || []).forEach(function (p) {
    const full = path.resolve(PUBLIC_DIR, '.' + p);
    let ok = full.indexOf(ASSETS_DIR + path.sep) === 0;
    if (ok) { try { ok = fs.statSync(full).isFile(); } catch (e) { ok = false; } }
    if (!ok) out[p] = true;
  });
  (added.match(/https?:\/\/[^\s'"`)]+/g) || []).forEach(function (u) { if (original.indexOf(u) < 0) out[u] = true; });
  return Object.keys(out);
}

/* Injected by mount(): auth and store, which this file must not require directly — the rate
   limiter keys on the session and counts in the store, and both belong to the app. */
let auth = null, store = null;

/* THE PROMPT, OR A LOUD FAILURE. There used to be a second set of prompts — 110 lines of string
   literals in server.js, used when an ai/agents/*.md was missing or malformed. Phase 3 deleted
   them, and the reasoning is worth keeping where the decision is:

   They had already drifted. The Markdown prompts grew slots for the lab, the design board, the
   grader's task and explain-a-line; the literals never did. So the "fallback" did not degrade
   gracefully to the previous behaviour — it quietly switched the child to a different, worse
   assistant that had never been tested and that nobody was watching, because nothing reported it.
   That is the same failure as the grader being handed no context at all: silent, invisible, and
   found by reading rather than by anything going wrong.

   The .md files are committed and tools/check-prompts.js asserts every one of the six builds
   complete on every `npm test`. If one is genuinely missing, a 500 naming the file is the honest
   answer and somebody fixes it in a minute. */
function promptFor(agent, vars, res) {
  const system = ai.buildPrompt(agent, vars);
  if (system) return system;
  console.error('[ai] no prompt for "' + agent + '" — ai/agents/' + agent + '.md is missing or malformed');
  res.status(500).json({
    reply: 'This assistant is not set up correctly right now, so I cannot answer. '
      + 'That is a problem at our end, not anything you did — please tell whoever is running the class.',
    error: 'missing prompt: ai/agents/' + agent + '.md'
  });
  return null;
}

function mount(app, deps) {
  auth = deps && deps.auth;
  store = deps && deps.store;
  if (!auth || !store) throw new Error('routes/ai.js: mount(app, { auth, store }) needs both');

  /* ---- per-student rate limit, on the paid relay ----
     Two things were wrong with this and both mattered on a public URL.

     It was keyed on `req.body.studentId` — a value the CALLER sends. Anyone past the sign-in could
     put a fresh random id on every request and never be counted at all, which made the limit a
     suggestion. It is keyed on the session now, which the server issued and signs, so a student gets
     one bucket whatever their browser claims to be.

     And it was a Map in this module. store.bump() owns the counter now — in-memory for one process,
     the KV store when there is one — see the note there, including why it fails open. */
  const RATE = { windowSec: 10 * 60, max: 40 };
  async function rateLimited(req) {
    const me = auth.currentUser(req);
    const id = (me && me.email) || req.ip || 'anon';
    return (await store.bump('ai:' + id, RATE.windowSec)) > RATE.max;
  }

  // ---- the agent endpoint: relays the AI and returns a change for the browser to apply ----
  //      The student's code lives in the browser and is sent with the request. The server
  //      never stores or runs student code — it just talks to the model and returns "ops".
  app.post('/api/ai', async (req, res) => {
    /* ONE WRAPPER ROUND res.json, RATHER THAN A LOG LINE AT EACH EXIT.
       This handler leaves by eighteen different doors: five successful replies (one per agent shape),
       four give-ups where a corrective guard refused the change, eight catch blocks, and the 429
       above. Instrumenting them one at a time is instrumenting seventeen of them and discovering the
       eighteenth on Sunday. Wrapping the one function they all call cannot miss one.
       `seen` is filled in as the request is parsed and read here at send time, which is why it is a
       mutable object rather than arguments. */
    const t0 = Date.now();
    const seen = { who: tel.who(auth, req), agent: '', lesson: '', where: '', q: '', tools: [], guards: [] };
    const sendJSON = res.json.bind(res);
    res.json = function (body) {
      tel.record('ask', {
        who: seen.who,
        agent: seen.agent,
        lesson: seen.lesson,
        where: seen.where,
        q: seen.q,
        ms: Date.now() - t0,
        status: res.statusCode,
        /* The difference that matters for the builder: a reply that changed the game, versus a reply
           that reads like it did and changed nothing. `ops: false` on a coder turn is the shape of
           the complaint that it "just says done". */
        /* The studio's Builder (V2) answers with `code` and `parts` instead of `ops`; either one
           non-empty is the same fact, "this turn changed the game". */
        ops: !!(body && (body.ops || body.code || (Array.isArray(body.parts) && body.parts.length))),
        /* And, when it changed nothing, whether the model MEANT to: `held` is the word it sets when
           it asked a question back, declined the practice exercise, or hit something it could not
           do. Absent on a coder turn that changed nothing is the real failure — the reply that
           reads like an answer and is not one. session-report.js splits the count by this. */
        held: (body && body.held) || undefined,
        replyLen: (body && typeof body.reply === 'string') ? body.reply.length : 0,
        tools: seen.tools.length ? seen.tools : undefined,
        guards: seen.guards.length ? seen.guards : undefined
      });
      return sendJSON(body);
    };
    /* A corrective guard fired. These are the builder's real failure modes and until now they left no
       trace whatsoever: the guard corrects the model silently, and if the second attempt is no better
       the child gets a friendly sentence and an unchanged game. "The builder just says done and
       nothing happens" is this, and `name` says which one. */
    const guard = function (name, detail, gaveUp) {
      seen.guards.push(name + (gaveUp ? ':gave-up' : ''));
      tel.record('guard', {
        who: seen.who, agent: seen.agent, lesson: seen.lesson,
        name: name, detail: detail || undefined, gaveUp: !!gaveUp, q: seen.q
      });
    };
    /* Passed to callAI so a tool lookup is attributed to the child who caused it. */
    const onTool = function (call, result) {
      seen.tools.push(call.name + (result && result.error ? '!' : ''));
      tel.record('tool', { who: seen.who, agent: seen.agent, name: call.name, args: call.args, error: (result && result.error) || undefined });
    };

    if (await rateLimited(req)) return res.status(429).json({ reply: 'Slow down a moment - you have hit the request limit. Try again shortly.' });
    const message = ((req.body && req.body.message) || '').toString().slice(0, 2000);
    if (!message) return res.status(400).json({ reply: 'Please type a message.' });
    const gameCode = ((req.body && req.body.code) || '').toString().slice(0, 100000);
    /* `req.body.context` is still sent by js/ai.js (askTutor's second argument) and is no longer
       read: the only thing that used it was fallbackTutorSystem, which Phase 3 deleted. The tutor's
       .md takes {{lessonContext}} instead, which the browser also sends and which is not truncated
       by a different limit. Left unparsed rather than silently re-plumbed — the client-side caller
       should be tidied in its own commit, the way `studentId` still needs to be. */
    const history = sanitizeHistory(req.body && req.body.history);
    let agent = (req.body && req.body.agent) || 'coder';
    if (['coder', 'tutor', 'lab-tutor', 'quiz', 'grader', 'design-coach', 'mentor', 'interviewer', 'builder'].indexOf(agent) < 0) agent = 'coder';   // controller: keep to known agents
    const spec = resolveModel(agent);
    /* The whole-request deadline every provider call measures itself against, stamped on this
       request's own spec so the retry chain cannot outlive it however many times it goes round — and
       so a second student pressing send cannot move it. See budgetLeft. */
    spec.deadline = t0 + TOTAL_BUDGET_MS;
    /* The agent AFTER that whitelist, not the one the browser asked for — the UI can switch agent
       without the student doing anything (opening Learn while in Build forces Tutor, see
       paintAIModeAvailability in course.js), and an unrecognised name silently becomes the coder. The
       log has to say which one actually answered or it will disagree with what the child saw. */
    seen.agent = agent;
    seen.q = message;

    // Context the browser sends about where the student is and what exists in their project.
    const b = req.body || {};
    const ctx = {
      lessonTitle: (b.lessonTitle || '').toString().slice(0, 120),
      lessonContext: (b.lessonContext || '').toString().slice(0, 3000),
      /* The lesson's practice exercise, sent separately because lessonContext is truncated long
         before it. ai/agents/coder.md's {{practiceTask}} is what the coder is told to do with it:
         recognise the exercise and decline to do it for them. */
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
      /* The studio's (V2) own context for the mentor: the question on screen, the parts and their
         settings, and what the mentor may change. One block, written by the browser for the prompt. */
      studio: (b.studio || '').toString().slice(0, 7000),
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

    /* Where the child was standing when they asked. `where` is the tab; the lesson title is what the
       report groups by, because "everyone got stuck on Physics and Collision" is the finding. */
    seen.lesson = ctx.lessonTitle || '';
    seen.where = ctx.where || '';

    /* The provider did not answer, on the coder's path. Four places used to say this in four
       identical lines — the first attempt and one per corrective retry — which is four chances for
       one of them to drift.
       The tutor, the coach and the quiz/grader keep their own wording below, and that is not an
       oversight to tidy away later: "the tutor is not reachable" tells a child which of the two
       assistants is missing, and the panel they are looking at is the one it names. The audit that
       prompted this commit called all seven identical; reading them, three were not. */
    const unreachable = function (e) {
      return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' });
    };

    // Tier 2: when this agent has tools switched on, it may look things up instead of guessing.
    // ctx already carries the assets, files, game code and lesson this request is about.
    const agentTools = AGENT_TOOLS[agent] ? ctx : null;

    /* TUTOR and LAB-TUTOR: plain-language explanation, no code edits.
       lab-tutor has to be named here. Every agent this chain does not recognise falls through to the
       CODER branch at the bottom — so the lab's tutor was being run on the coder's prompt, which is
       built entirely around game.js, and it answered a student staring at a canvas exercise with
       advice about their Phaser game being empty. Adding an agent means adding it to this list. */
    /* MENTOR: the studio's (V2) voice for whatever a kid types (ai/agents/mentor.md). A typed line can
       be an answer to the question on screen, a question, or a request to change the game, so the
       mentor answers in JSON: what to say, which on-screen answer the kid meant (if any), and the
       Inspector settings to change (if any). Only the shape is checked here; the browser checks each
       change against the settings that exist and applies it the way a tap would, so the AI can never
       set anything the kid couldn't. The JSON opens with `read`, the mentor's own reading of what the
       kid means and needs, written BEFORE its reply: a model that must answer first and decide after
       picks the wrong intent (the V1 review, 2026-09-29). It is never sent on to the browser. */
    if (agent === 'mentor') {
      let raw;
      const mentorSystem = promptFor('mentor', ctx, res);
      if (!mentorSystem) return;
      try {
        raw = await callAI(spec, mentorSystem, message, true, history, null, onTool);
        // the same one retry as the interviewer's, for the empty answer a model sometimes gives
        if (!String(raw || '').trim() && Date.now() < spec.deadline - 20000) raw = await callAI(spec, mentorSystem, message, true, history, null, onTool);
      }
      catch (e) { return res.status(502).json({ reply: 'The mentor is not reachable right now (' + e.message + ').' }); }
      const m = extractJSON(raw) || { reply: String(raw || '').trim() };
      const choose = Number.isInteger(m.choose) && m.choose >= 1 && m.choose <= 8 ? m.choose : null;
      const actions = Array.isArray(m.actions) ? m.actions.slice(0, 6).map(function (a) {
        const v = a && a.value;
        return { part: String((a && a.part) || '').slice(0, 24), key: String((a && a.key) || '').slice(0, 24),
          value: (typeof v === 'boolean' || typeof v === 'number' || v === null) ? v : String(v).slice(0, 40) };
      }).filter(function (a) { return a.part && a.key; }) : [];
      /* `build`: the kid asked for a change beyond the settings the mentor may touch, and this is the
         mentor's one-line brief for the Builder (the BUILDER branch below), which the browser hands to
         Builder.ask. A string or nothing; the Builder does its own checking of whatever comes of it. */
      const build = (typeof m.build === 'string' && m.build.trim()) ? m.build.trim().slice(0, 300) : null;
      /* `hero`: what the kid said their hero looks like, as the drawer's words ({ body, color, belly,
         eyes, eyeColor, extras }). Only the shape is checked here, a plain object of a sane size; the
         browser owns the drawer, so it owns the vocabulary and drops any word it does not know. */
      const h = m.hero;
      const hero = (h && typeof h === 'object' && !Array.isArray(h) && JSON.stringify(h).length <= 1500) ? h : null;
      /* `ticket`: a problem the kid reported that the course never planned, written up for the board
         (quest.js fileOwn): a title, the department that fixes it, what is wrong, how they'll know it's
         fixed. Short strings and a known department, or nothing; the browser files it only when it
         asked for one. */
      const tk = m.ticket, str = function (v, n) { return typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null; };
      const ticket = (tk && typeof tk === 'object' && str(tk.title, 70)) ? { title: str(tk.title, 70),
        department: ['engineering', 'art', 'audio', 'design'].indexOf(tk.department) >= 0 ? tk.department : null,
        detail: str(tk.detail, 200), done: str(tk.done, 160) } : null;
      return res.json({ reply: String(m.reply || '').trim().slice(0, 800) || 'Hmm, say that another way?', choose: choose, actions: actions,
        build: build, hero: hero, ticket: ticket });
    }

    /* INTERVIEWER: the studio director in the hiring interview (ai/agents/interviewer.md, V2). It leads
       a conversation and says what it learned. The browser keeps the goals and decides when a kid is
       hired, so everything here is only cleaned: a wrong type is dropped, never trusted.
       `loves` is the ladder (studio/interview.js says why): each {game, element, why, over} is short
       free text in the kid's words, capped here and checked again in the browser against what the kid
       actually typed. `fun` is the same list interview.js hears answers into (its FUN). */
    if (agent === 'interviewer') {
      let raw;
      const ivSystem = promptFor('interviewer', ctx, res);
      if (!ivSystem) return;
      /* Sonnet 5 sometimes answers with a thinking block and no text at all (2 samples in 6 on the
         same turn, 2026-09-28). That used to come back as "Tell me more?" with nothing learned, which
         the page took as a real answer. Now: one retry while there's time, else a 502, so the page
         says its scripted line instead (studio/interview.js, RESILIENCE). */
      try {
        raw = await callAI(spec, ivSystem, message, true, history, null, onTool);
        if (!String(raw || '').trim() && Date.now() < spec.deadline - 20000) raw = await callAI(spec, ivSystem, message, true, history, null, onTool);
      } catch (e) { return res.status(502).json({ reply: 'The director is not reachable right now (' + e.message + ').' }); }
      if (!String(raw || '').trim()) return res.status(502).json({ reply: 'The director gave an empty answer.' });
      const m = extractJSON(raw) || { reply: String(raw || '').trim() };
      const l = (m.learned && typeof m.learned === 'object') ? m.learned : {};
      const word = (v, n) => String(v || '').replace(/[^\p{L}\p{N} '’&:!.-]/gu, '').trim().slice(0, n);
      const phrase = (v, n) => (typeof v === 'string' ? v : '').replace(/[^\p{L}\p{N} '’&:!?.,()-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, n);
      const one = (v, list) => list.indexOf(v) >= 0 ? v : undefined;
      const FUN = ['explore', 'challenge', 'clever', 'social', 'make', 'story', 'collect', 'feel', 'progress', 'characters', 'funny', 'cozy'];
      const learned = {
        first: word(l.first, 20).split(' ')[0] || undefined,
        initial: (String(l.initial || '').match(/\p{L}/u) || [''])[0].toUpperCase() || undefined,
        games: Array.isArray(l.games) ? l.games.slice(0, 6).map(function (g) { return word(g, 30); }).filter(Boolean) : undefined,
        loves: Array.isArray(l.loves) ? l.loves.slice(0, 6).filter(function (x) { return x && typeof x === 'object' && !Array.isArray(x); }).map(function (x) {
          const e = { game: word(x.game, 30), element: phrase(x.element, 40), why: phrase(x.why, 80), over: phrase(x.over, 80) };
          Object.keys(e).forEach(function (k) { if (!e[k]) delete e[k]; });
          return e;
        }).filter(function (e) { return e.game || e.element; }) : undefined,
        notFan: (Array.isArray(l.notFan) ? l.notFan : typeof l.notFan === 'string' ? [l.notFan] : []).slice(0, 3).map(function (x) { return phrase(x, 50); }).filter(Boolean),
        wants: phrase(l.wants, 60) || undefined,
        fun: Array.isArray(l.fun) ? l.fun.filter(function (f) { return FUN.indexOf(f) >= 0; }).slice(0, FUN.length) : undefined,
        confidence: Number.isInteger(l.confidence) && l.confidence >= 1 && l.confidence <= 5 ? l.confidence : undefined,
        job: one(l.job, ['art', 'audio', 'design', 'engineering', 'everything']),
        jump: one(l.jump, ['floaty', 'snappy', 'same']),
        sound: one(l.sound, ['ding', 'thud']),
        tone: one(l.tone, ['keen', 'curious', 'silly', 'shy']),
        note: word(l.note, 32) || undefined
      };
      Object.keys(learned).forEach(function (k) { if (learned[k] === undefined || (Array.isArray(learned[k]) && !learned[k].length)) delete learned[k]; });
      return res.json({ reply: String(m.reply || '').trim().slice(0, 600) || 'Tell me more?', learned: learned,
        show: one(m.show, ['jumps', 'sounds', 'engine', 'words', 'coin']) || null, done: m.done === true });
    }

    if (agent === 'tutor' || agent === 'lab-tutor') {
      let raw;
      const tutorSystem = promptFor(agent, Object.assign({ gameCode: gameCode }, ctx), res);
      if (!tutorSystem) return;
      try { raw = await callAI(spec, tutorSystem, message, false, history, agentTools, onTool); }
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
      try { raw = await callAI(spec, coachSystem, message, false, history, agentTools, onTool); }
      catch (e) { return res.status(502).json({ reply: 'The coach is not reachable right now (' + e.message + ').' }); }
      return res.json({ reply: (raw || '').trim() || 'Hmm, I am not sure — tell me a bit more about your game.' });
    }

    // QUIZ / GRADER. Both are shown to a child as if they were correct, so neither is trusted:
    // the quiz's answer key is checked, and the grader's verdict is checked against its own hint.
    if (agent === 'quiz' || agent === 'grader') {
      let raw;
      const agentSystem = promptFor(agent, ctx, res);
      if (!agentSystem) return;
      try { raw = await callAI(spec, agentSystem, message, true, [], agentTools, onTool); }
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

    /* BUILDER: the studio's (V2) engineer (ai/agents/builder.md). The mentor hands it a request the
       Inspector cannot do ("make the coins spin"); it answers with find/replace edits to the kid's
       game.js and ops on the level's parts, and THIS branch applies the edits to the code it was sent,
       compiles the result and checks it before the browser ever sees it. The browser
       (studio/builder.js) then applies the returned code and part ops, and puts everything back if
       the game will not start.

       V1's corrective shape, ported: every detector runs, ONE correction lists everything that
       fired, ONE retry, every detector again, and then an honest give-up in plain words
       (builderNote in ai/guards.js). The coder branch below explains why it is one pass and not one
       retry per guard.

       Response: { reply, code, base, edits, parts, held }. `code` is the whole new file, or null when
       the code did not change; `base` is a hash of the code as sent, so the browser can tell the
       answer is about exactly what it has. */
    if (agent === 'builder') {
      spec.deadline = Math.min(spec.deadline, t0 + BUILDER_BUDGET_MS);
      const sentCode = (b.code === undefined || b.code === null) ? '' : String(b.code);
      const base = codeHash(sentCode);
      const nothing = function (status, reply) {
        return res.status(status).json({ reply: reply, code: null, base: base, edits: 0, parts: [], held: null });
      };
      if (!sentCode.trim()) return nothing(400, 'I didn’t get your game’s code, so I can’t change it. Try reloading the page.');
      if (sentCode.length > BUILDER_MAX) return nothing(413, 'Your game’s code has grown too big for me to edit safely, so I left it alone.');
      const code = sentCode.replace(/\r\n/g, '\n');
      const sentParts = cleanSentParts(b.parts);
      const kidSaid = String(b.kidSaid || '').trim().slice(0, 600);
      const shown = code.length > BUILDER_SHOWN
        ? code.slice(0, BUILDER_SHOWN) + '\n// … (the rest of the file is not shown: only edit what you can see above)'
        : code;
      const bSystem = promptFor('builder', Object.assign({}, ctx, { gameCode: shown, parts: sentParts }), res);
      if (!bSystem) return;
      const ask = (kidSaid && kidSaid !== message ? 'The kid typed: "' + kidSaid + '"\n' : '') + 'What to build: ' + message;
      const bUnreachable = function () {
        return nothing(502, 'The Builder isn’t answering right now, so nothing in your game changed. Try again in a minute.');
      };

      const clean = function (s) {
        return String(s || '').replace(/```[\s\S]*?```/g, '').trim().slice(0, 400);
      };
      /* One answer, judged: what it would change, and every guard it trips. */
      const judge = function (r) {
        const text = String(r || '').trim();
        /* Prose is the model talking and becomes the reply; a `{` that did not parse is a truncated
           answer, recorded the way the coder records it (parseAnswer, below) and never shown. */
        let p = extractJSON(text);
        if (!p) {
          if (text[0] === '{') guard('bad-json', text.length + ' chars, unparsable: ' + text.slice(0, 80));
          p = { reply: text[0] === '{' ? '' : text };
        }
        const said = clean(p.reply);
        const h = typeof p.held === 'string' ? p.held.trim().toLowerCase() : '';
        const held = ['question', 'blocked'].indexOf(h) >= 0 ? h : '';
        const applied = applyEdits(code, p.edits);
        const partsOut = cleanPartOps(p.parts, sentParts);
        const hits = [];
        if (applied.bad.length) {
          hits.push({ name: 'bad-find', detail: applied.bad.map(function (x) { return '#' + x.i + (x.n < 0 ? ' malformed' : ' found ' + x.n + 'x'); }).join(', '),
            retry: 'IMPORTANT: your edits could not be applied. ' + applied.bad.map(function (x) {
              if (x.n < 0) return 'Edit ' + x.i + ' is missing its "find" or "replace" text.';
              return 'Edit ' + x.i + '\'s "find" text ' + (x.n === 0 ? 'does not appear in the code' : 'appears ' + x.n + ' times')
                + ': ' + JSON.stringify(x.find.slice(0, 120)) + '.';
            }).join(' ') + ' Every "find" must be copied EXACTLY from THE CODE, spaces and line breaks included, and must appear exactly '
              + 'once: include more of the line to make it unique. Send your whole answer again, with every edit.' });
        }
        const changed = !applied.bad.length && applied.code !== code;
        const next = changed ? applied.code : code;
        if (changed) {
          const err = compileError(next);
          if (err) {
            hits.push({ name: 'bad-js', detail: err.slice(0, 200),
              retry: 'IMPORTANT: with your edits applied, the code does not compile: "' + err.slice(0, 200) + '". Check every bracket, '
                + 'brace and comma in your "replace" text, and that each edit replaces a whole piece of code, then send your whole answer again.' });
          }
          const apis = badApisIn({ replaceFile: next }, code, []);
          if (apis.length) {
            hits.push({ name: 'bad-api', detail: apis.map(function (x) { return x.name; }).join(', '),
              retry: 'IMPORTANT: your change used ' + apis.map(function (x) { return '"' + x.name + '" (' + x.why + ': ' + x.hint + ')'; }).join('; ')
                + '. Redo it using only Phaser methods that exist, or change nothing, set "held":"blocked" and say plainly what you can\'t do.' });
          }
          const keysBefore = badKeysIn({ create: code }, '');
          const keys = badKeysIn({ create: next }, '').filter(function (k) { return keysBefore.indexOf(k) < 0; });
          if (keys.length) {
            hits.push({ name: 'bad-key', detail: keys.join(', '),
              retry: 'IMPORTANT: your change reads ' + keys.map(function (k) { return 'keys.' + k; }).join(' and ')
                + ', but those keys are never registered, so the game crashes on the first frame. Add them to the addKeys(\'...\') list first.' });
          }
        }
        const paths = badPaths(applied.added + '\n' + partsOut.ops.map(function (o) { return JSON.stringify(o); }).join('\n'), code);
        if (paths.length) {
          hits.push({ name: 'bad-asset', detail: paths.join(', ').slice(0, 200),
            retry: 'IMPORTANT: your change uses ' + paths.map(function (x) { return '"' + x + '"'; }).join(', ')
              + ', which is not a file the studio has. Draw it with Phaser shapes instead (rectangle, circle, triangle, star, graphics), '
              + 'or use a picture the code already loads. Send your whole answer again.' });
        }
        const any = changed || partsOut.ops.length > 0;
        if (!any && !hits.length && !held && claimsChangeWithoutOps(said, {})) {
          hits.push({ name: 'no-ops', detail: said.slice(0, 200),
            retry: 'IMPORTANT: your reply said you changed the game, but "edits" and "parts" were empty (or nothing in them was usable), '
              + 'so NOTHING happened and the kid will see no difference. Send the change for real this time. If you cannot do it, '
              + 'send no edits, set "held", and say so plainly in "reply".' });
        }
        return { said: said, held: held, next: next, changed: changed, edits: changed ? applied.count : 0,
          parts: partsOut.ops, dropped: partsOut.dropped, hits: hits };
      };

      let raw;
      try { raw = await callAI(spec, bSystem, ask, true, history, AGENT_TOOLS.builder ? ctx : null, onTool); }
      catch (e) { return bUnreachable(); }
      let a = judge(raw);
      if (a.dropped.length) guard('bad-part', a.dropped.join('; ').slice(0, 300));
      if (a.hits.length) {
        a.hits.forEach(function (h) { guard(h.name, h.detail); });
        const first = a;
        const correction = ask + '\n\n' + a.hits.map(function (h) { return h.retry; }).join('\n\n');
        let retried = true;
        try { raw = await callAI(spec, bSystem, correction, true, history, AGENT_TOOLS.builder ? ctx : null, onTool); }
        catch (e) { retried = false; }
        /* Out of time or unreachable on the retry: the first answer's failures are the ones to report. */
        a = retried ? judge(raw) : first;
        if (retried && a.dropped.length) guard('bad-part', a.dropped.join('; ').slice(0, 300));
        if (a.hits.length) {
          a.hits.forEach(function (h) { guard(h.name, h.detail, true); });
          /* THE GIVE-UP, IN THE KID'S WORDS. One plain line saying the game is as it was, then the
             model's own words ONLY if it set `held`, which makes them an explanation of why not.
             Otherwise they describe the change it tried and we refused ("Press Play: the coins spin
             now!"), and printing that under "I left your game just as it was" is the lie this branch
             exists to stop. No regex can tell those apart reliably ("spin now" is not in
             CLAIMS_A_CHANGE); `held` can. This differs from the coder, whose words survive a give-up:
             a 10-year-old reading a contradiction is worse off than one reading one plain line. */
          const keep = a.held && a.said && !isEmptyAck(a.said) ? a.said : '';
          return res.json({ reply: builderNote(a.hits[0].name) + (keep ? ' ' + keep : ' Try asking for it a different way.'),
            code: null, base: base, edits: 0, parts: [], held: a.held || null });
        }
      }
      const any = a.changed || a.parts.length > 0;
      return res.json({
        reply: a.said,
        code: a.changed ? a.next : null,
        base: base,
        edits: a.edits,
        parts: a.parts,
        /* A model that sent a change AND said it was holding is believed about the change. */
        held: any ? null : (a.held || null)
      });
    }

    // CODER (default): return ops the browser applies to game.js.
    const system = promptFor('coder', Object.assign({ gameCode: gameCode }, ctx), res);
    if (!system) return;
    function toOps(parsed) {
      const ops = {};
      ['config', 'functions', 'create', 'update', 'newFile', 'editFile', 'replaceFile'].forEach(function (k) {
        if (parsed[k] !== undefined && parsed[k] !== null) ops[k] = parsed[k];
      });
      return ops;
    }
    /* ---------- what the student actually reads ----------
       THE APP USED TO TALK OVER THE MODEL. Seven places in this branch substituted a sentence of
       their own for the model's words: five of them said "Done." when nothing had changed, and the
       give-up path threw away `parsed.reply` entirely and printed one of four canned strings. The
       retry prompts below ask the model, in so many words, to "change nothing and say so plainly" —
       and when it did exactly that, the explanation it wrote was discarded and an eleven-year-old
       read "Try asking for it a slightly different way."

       One rule now, and these three helpers are all of it: the model's words reach the student, and
       the app only ever ADDS a status line. Nothing here invents a sentence except the one honest
       give-up in heldNote('no-ops'), which exists because a model that says nothing has left us
       nothing to pass on. */
    const HELD_WORDS = ['practice', 'question', 'blocked'];
    function heldOf(parsed) {
      const h = (parsed && typeof parsed.held === 'string') ? parsed.held.trim().toLowerCase() : '';
      return HELD_WORDS.indexOf(h) >= 0 ? h : '';
    }
    function parseAnswer(r) {
      const p = extractJSON(r);
      if (p) return p;
      const text = String(r || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
      /* Prose is a real answer — the model talking rather than filling in a form — so it becomes the
         reply. A blob that starts with `{` and did not parse is a TRUNCATED JSON object, and this
         branch used to show that blob to a child.
         RECORDED, because the alternative is the failure that has cost two afternoons: it becomes
         an empty reply, the student gets one honest sentence, and nothing anywhere says the model
         actually answered and was cut off mid-file. A change carrying a whole 12k file back is not
         far off the token ceiling, so this is a real outcome and not a theoretical one. */
      if (text && text[0] === '{') guard('bad-json', text.length + ' chars, unparsable: ' + text.slice(0, 80));
      return { reply: (text && text[0] !== '{') ? text : '' };
    }
    function words(parsed) {
      const p = parsed || {};
      if (typeof p.reply === 'string' && p.reply.trim()) return p.reply.trim();
      if (typeof p.why === 'string' && p.why.trim()) return p.why.trim();
      return '';
    }
    function replyFrom(parsed, ops) {
      const said = words(parsed);
      if (said) return said;
      /* Ops but no words. The browser derives "Changed speed to 300." from the ops themselves
         (js/ai.js describeEdit), which is better than anything this file could write — and a
         sentence from here would replace it, because it counts as the model having said something.
         So say nothing on purpose. */
      if (ops && Object.keys(ops).length) return '';
      return heldNote('no-ops');
    }

    let raw;
    try { raw = await callAI(spec, system, message, true, history, agentTools, onTool); }
    catch (e) { return unreachable(e); }
    let parsed = parseAnswer(raw);
    let ops = toOps(parsed);
    let held = heldOf(parsed);

    /* ---------- the four corrective guards, in ONE pass ----------
       Each one is a detector, a correction to send back, and — if the second attempt is wrong too —
       a short line telling the student what was held back. A table of four rather than four
       near-copies, which is how the third of them came to re-check against a narrower baseline than
       it first checked (see bad-asset below).

       THEY USED TO RUN IN SEQUENCE, one retry each. That was deliberate and it was too expensive:
       four guards × one retry, each retry itself up to MAX_TOOL_ROUNDS + 1 model calls, is
       twenty-five calls for one child's question, and the capture showed a single coder pass taking
       ten seconds against a 50s budget. Now: run every applicable detector, send ONE
       correction listing everything that fired, retry ONCE, re-run every detector. Worst case drops
       from five callAI to two.

       Nothing is lost by combining them, because only one combination can occur: no-ops needs
       EMPTY ops and the other three need code in ops, so no-ops never co-fires with anything. The
       one case the old loop recovered and this does not is a retry that fixes the API and then
       invents an unregistered key — that request now ends with the change held and the model's own
       explanation shown, rather than with a third and fourth model call.

       `retry` returns only the correction paragraph; the loop puts the student's message in front
       of it once, however many fired. */
    const allCode = function () {
      return gameCode + '\n' + ctx.files.map(function (f) { return f.code; }).join('\n');
    };
    const GUARDS = [
      {
        name: 'no-ops',
        find: function () { return claimsChangeWithoutOps(words(parsed), ops) ? ['claimed a change'] : []; },
        detail: function () { return words(parsed).slice(0, 200); },
        retry: function () {
          return 'IMPORTANT: your previous answer said you had made a change, but it contained no '
            + '"config", "functions", "create", "update", "editFile", "newFile" or "replaceFile" field, so NOTHING happened '
            + 'to the game and the student saw no difference. Send the change for real this time. Remember that logic living '
            + 'in another file (movement in player.js, coins in coins.js, platforms in world.js, and any file they added '
            + 'themselves) is changed with "editFile", passing that whole file back with your edit made. If you genuinely '
            + 'cannot do it, say so plainly in "reply", set "held", and ask for what you need instead of claiming it is done.';
        }
      },
      {
        // A Phaser API that does not exist: correct it once, then hold the change rather than ship a crash.
        name: 'bad-api',
        find: function () { return badApisIn(ops, gameCode, ctx.files); },
        detail: function (hits) { return hits.map(function (b) { return b.name; }).join(', '); },
        retry: function (hits) {
          const list = hits.map(function (b) { return '"' + b.name + '" (' + b.why + ' — ' + b.hint + ')'; }).join('; ');
          return 'IMPORTANT: your previous answer used ' + list
            + '. Redo the change using only APIs that exist. If it cannot be done that way, send no edit field, set '
            + '"held":"blocked", and use "reply" to tell the student what you tried, why Phaser will not do it, and the '
            + 'nearest thing you CAN build — they will read that reply exactly as you write it.';
        }
      },
      {
        // Reading a key that was never registered crashes on frame one: correct it once, then hold it.
        name: 'bad-key',
        find: function () { return badKeysIn(ops, gameCode); },
        detail: function (hits) { return hits.join(', '); },
        retry: function (hits) {
          return 'IMPORTANT: your previous answer read '
            + hits.map(function (k) { return 'scene.keys.' + k; }).join(' and ')
            + ', but those keys are never registered, so the game crashes on the first frame. '
            + 'For SHIFT use scene.cursors.shift.isDown (it already exists). For any other key, add it to the '
            + "addKeys('W,A,S,D') call in createPlayer first. Send the corrected change.";
        }
      },
      {
        /* Asset keys the student does not own. Silently skipped when the browser sent no asset list
           — there is nothing to check against, and treating "we were not told" as "they own
           nothing" would refuse every change that touches a sprite.

           ONE BEHAVIOUR CHANGE CAME IN WITH THE TABLE, AND IT WAS A BUG FIX. Both checks use the whole
           project. The first one always did; the re-check used game.js alone, so a key the model
           correctly moved into player.js on its second attempt was reported as invented and the
           child was told to go and buy an asset they already owned. Nothing about the duplicated
           shape made that visible — the two lines were forty lines apart and differed by one
           argument. */
        name: 'bad-asset',
        when: function () { return !!ctx.hasAssetList; },
        find: function () { return unknownAssetKeys(ops, allCode(), ctx.assets, ctx.assetSets); },
        detail: function (hits) { return hits.join(', '); },
        retry: function (hits) {
          return 'IMPORTANT: your previous answer used the asset key(s) '
            + hits.map(function (k) { return '"' + k + '"'; }).join(', ')
            + ', which do not exist and would break the game. '
            + 'Redo it using ONLY the owned asset keys listed above, or — if this cannot be done with those — '
            + 'send no edit field, set "held":"blocked", and use "reply" to name the asset they would need to buy.';
        }
      }
    ];

    /* Every detector that applies, against whatever is in `ops` right now. */
    const fired = function () {
      const out = [];
      GUARDS.forEach(function (g) {
        if (g.when && !g.when()) return;
        const hits = g.find();
        if (hits.length) out.push({ g: g, hits: hits });
      });
      return out;
    };
    /* THE ONE PLACE THE MODEL'S SELF-REPORT IS TRUSTED, and only to skip a retry.
       CLAIMS_A_CHANGE had to widen to catch "Done." and "There's an extra coin now", and a regex
       that wide also matches a perfectly good conversational reply that DESCRIBES the game ("your
       speed is now 200 — want 300?"). The model telling us it deliberately changed nothing is the
       missing piece of context: the event is still recorded, so the report can show how often this
       happens, but the request does not spend a second model call arriving back where it started. */
    const heldSkipsNoOps = function (list) {
      if (!held) return list;
      return list.filter(function (h) {
        if (h.g.name !== 'no-ops') return true;
        guard('no-ops', h.g.detail(h.hits));
        return false;
      });
    };

    const hits = heldSkipsNoOps(fired());
    if (hits.length) {
      hits.forEach(function (h) { guard(h.g.name, h.g.detail(h.hits)); });
      const correction = message + '\n\n' + hits.map(function (h) { return h.g.retry(h.hits); }).join('\n\n');
      try { raw = await callAI(spec, system, correction, true, history, agentTools, onTool); }
      catch (e) { return unreachable(e); }
      parsed = parseAnswer(raw);
      ops = toOps(parsed);
      held = heldOf(parsed);

      const still = heldSkipsNoOps(fired());
      if (still.length) {
        still.forEach(function (h) { guard(h.g.name, h.g.detail(h.hits), true); });
        ops = {};
        /* THE MODEL'S WORDS SURVIVE THIS. The old code returned a canned sentence here and dropped
           `parsed.reply` on the floor — including when the reply was the plain-English explanation
           the retry had just asked for. Now the app adds a line and keeps the explanation.
           Order matters: a model still insisting "I've added the dragon!" gets the correction FIRST,
           so the first thing a child reads is that nothing changed. */
        const notes = still.map(function (h) { return heldNote(h.g.name, h.hits, ctx.assets); }).filter(Boolean);
        /* An acknowledgement is not something the model said. "Done." after a correction would
           otherwise be printed underneath the sentence explaining that nothing is done. */
        const said = isEmptyAck(words(parsed)) ? '' : words(parsed);
        let text;
        if (still.some(function (h) { return h.g.name === 'no-ops'; })) {
          /* THE MODEL'S WORDS SURVIVE THIS ONE TOO, and they did not at first. Replacing them
             outright assumed a reply with no ops was worthless — but the widened CLAIMS_A_CHANGE
             also fires on a good conversational answer that merely describes the game ("the
             counter is now showing 130"), and a student asking a real follow-up was told the
             assistant could not work out what they meant. The app knows the game did not change;
             that is all it knows, so that is all it says. */
          text = said ? heldNote('no-ops-claimed') + '\n\n' + said : heldNote('no-ops');
        } else if (claimsChangeWithoutOps(said, {})) {
          text = notes.concat(said ? [said] : []).join('\n\n');
        } else {
          text = (said ? [said] : []).concat(notes).join('\n\n');
        }
        /* `held` stays whatever the MODEL declared, which is usually nothing: a change this app
           held back is not the model choosing to hold one, and the `guard` events above already
           record it with gaveUp. Conflating the two would hide real failures in the report. */
        return res.json({ reply: text, ops: null, held: held || undefined });
      }
    }

    res.json({
      reply: replyFrom(parsed, ops),
      why: parsed.why || '',
      ops: Object.keys(ops).length ? ops : null,
      held: Object.keys(ops).length ? undefined : (held || undefined)
    });
  });
}

module.exports = { mount: mount };
