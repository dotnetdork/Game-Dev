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
const { extractJSON, sanitizeHistory, unknownAssetKeys, assetApology, badApisIn, badKeysIn,
  claimsChangeWithoutOps } = guards;

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

     And it was a Map in this module, which on Vercel counts only the requests that happened to reach
     the same instance. store.bump() puts the counter in the KV store when there is one — see the note
     there, including why it fails open. */
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
        ops: !!(body && body.ops),
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
    if (['coder', 'tutor', 'lab-tutor', 'quiz', 'grader', 'design-coach'].indexOf(agent) < 0) agent = 'coder';   // controller: keep to known agents
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
    let raw;
    try { raw = await callAI(spec, system, message, true, history, agentTools, onTool); }
    catch (e) { return unreachable(e); }
    let parsed = extractJSON(raw) || { reply: (raw || '').trim() || 'Done.' };
    let ops = toOps(parsed);

    /* ---------- the four corrective guards ----------
       Each one was the same seventeen lines: detect, tell the model what it got wrong, ask once
       more, detect again, and if it is still wrong leave the game untouched and say something a
       child can act on. Only the detector, the correction and the apology ever differed, so they
       are a table of four and one loop rather than four near-copies — which is how the third of
       them came to re-check against a narrower baseline than it first checked (below).

       ORDER MATTERS AND IS PRESERVED. A guard runs against whatever the guard before it left in
       `ops`, so a retry provoked by a bad Phaser API is what the keyboard guard then inspects. One
       request can therefore spend four retries, and only the last failure reaches the student.

       `parse` is per-guard because the four fallbacks differ — '' for two of them, 'Done.' for
       another — and those differences are carried across verbatim rather than tidied into one.
       They look accidental; changing them is a behaviour change and this is not the commit for
       it. */
    const allCode = function () {
      return gameCode + '\n' + ctx.files.map(function (f) { return f.code; }).join('\n');
    };
    const GUARDS = [
      {
        name: 'no-ops',
        find: function () { return claimsChangeWithoutOps(parsed.reply, ops) ? ['claimed a change'] : []; },
        detail: function () { return (parsed.reply || '').slice(0, 200); },
        parse: function (r) { return extractJSON(r) || { reply: (r || '').trim() || '' }; },
        retry: function () {
          return message + '\n\nIMPORTANT: your previous answer said you had made a change, but it contained no '
            + '"config", "functions", "create", "update", "editFile", "newFile" or "replaceFile" field, so NOTHING happened '
            + 'to the game and the student saw no difference. Send the change for real this time. Remember that logic living '
            + 'in another file (movement in player.js, coins in coins.js, platforms in world.js) is changed with "editFile", '
            + 'passing that whole file back with your edit made. If you genuinely cannot do it, say so plainly and ask for '
            + 'what you need instead of claiming it is done.';
        },
        giveUp: function () { return "I couldn't work out how to make that change — can you tell me a bit more about what you want to happen?"; }
      },
      {
        // A Phaser API that does not exist: correct it once, then refuse rather than ship a crash.
        name: 'bad-api',
        find: function () { return badApisIn(ops, gameCode, ctx.files); },
        detail: function (hits) { return hits.map(function (b) { return b.name; }).join(', '); },
        parse: function (r) { return extractJSON(r) || { reply: '' }; },
        retry: function (hits) {
          const list = hits.map(function (b) { return '"' + b.name + '" (' + b.why + ' — ' + b.hint + ')'; }).join('; ');
          return message + '\n\nIMPORTANT: your previous answer used ' + list
            + '. Redo the change using only APIs that exist, or if it cannot be done that way, change nothing and say so plainly.';
        },
        giveUp: function () { return "I couldn't do that without using something Phaser doesn't have, so I left your game alone. Try asking for it a slightly different way."; }
      },
      {
        // Reading a key that was never registered crashes on frame one: correct it once, then refuse.
        name: 'bad-key',
        find: function () { return badKeysIn(ops, gameCode); },
        detail: function (hits) { return hits.join(', '); },
        parse: function (r) { return extractJSON(r) || { reply: '' }; },
        retry: function (hits) {
          return message + '\n\nIMPORTANT: your previous answer read '
            + hits.map(function (k) { return 'scene.keys.' + k; }).join(' and ')
            + ', but those keys are never registered, so the game crashes on the first frame. '
            + 'For SHIFT use scene.cursors.shift.isDown (it already exists). For any other key, add it to the '
            + "addKeys('W,A,S,D') call in createPlayer first. Send the corrected change.";
        },
        giveUp: function () { return "I couldn't get that working without breaking your controls, so I left your game alone. Try asking for it a slightly different way."; }
      },
      {
        /* Asset keys the student does not own. Silently skipped when the browser sent no asset list
           — there is nothing to check against, and treating "we were not told" as "they own
           nothing" would refuse every change that touches a sprite.

           ONE BEHAVIOUR CHANGE IN THIS COMMIT, AND IT IS A BUG FIX. Both checks now use the whole
           project. The first one always did; the re-check used game.js alone, so a key the model
           correctly moved into player.js on its second attempt was reported as invented and the
           child was told to go and buy an asset they already owned. Nothing about the duplicated
           shape made that visible — the two lines were forty lines apart and differed by one
           argument. */
        name: 'bad-asset',
        when: function () { return !!ctx.hasAssetList; },
        find: function () { return unknownAssetKeys(ops, allCode(), ctx.assets, ctx.assetSets); },
        detail: function (hits) { return hits.join(', '); },
        parse: function (r) { return extractJSON(r) || { reply: (r || '').trim() || 'Done.' }; },
        retry: function (hits) {
          return message + '\n\nIMPORTANT: your previous answer used the asset key(s) '
            + hits.map(function (k) { return '"' + k + '"'; }).join(', ')
            + ', which do not exist and would break the game. '
            + 'Redo it using ONLY the owned asset keys listed above, or — if this cannot be done with those — '
            + 'change nothing and reply with only {"reply":"..."} explaining which asset they would need to buy.';
        },
        giveUp: function (hits) { return assetApology(hits, ctx.assets); }
      }
    ];

    for (let i = 0; i < GUARDS.length; i++) {
      const g = GUARDS[i];
      if (g.when && !g.when()) continue;
      let hits = g.find();
      if (!hits.length) continue;

      guard(g.name, g.detail(hits));
      try { raw = await callAI(spec, system, g.retry(hits), true, history, agentTools, onTool); }
      catch (e) { return unreachable(e); }
      parsed = g.parse(raw);
      ops = toOps(parsed);

      hits = g.find();
      if (hits.length) {
        guard(g.name, g.detail(hits), true);
        return res.json({ reply: g.giveUp(hits), ops: null });
      }
    }

    res.json({ reply: parsed.reply || 'Done.', why: parsed.why || '', ops: Object.keys(ops).length ? ops : null });
  });
}

module.exports = { mount: mount };
