/* builder.js: the Builder, the studio's engineer. It changes the kid's real game when they ask for
   something the Inspector can't do ("make the coins spin", "add a slime that walks back and forth").

   WHO DOES WHAT. The mentor decides a request needs building and hands over a one-line brief; this
   file sends that brief, the kid's own words, their game.js and their parts to /api/ai as the
   `builder` agent (routes/ai.js, the BUILDER branch; the prompt is ai/agents/builder.md). The SERVER
   applies the model's find/replace edits, compiles the result and checks it, and answers with the
   whole new code and a cleaned list of part ops. This file applies them and watches the game start.
   It does no DOM or UI work of its own: whoever calls it shows the reply, and Builder.on() says what
   happened so the Console can show a row for it.

   FOUR PROMISES, because a class of 10-year-olds is on the other end:
   1. Never pretend. A timeout, a network error or a server error is said plainly, and the game is
      untouched. A reply with no change in it is reported as no change (ok: false).
   2. Never apply to a game that moved. The code sent is kept; if Project.get().code is different
      when the answer comes back (the kid, an undo, or another build changed it), nothing is applied
      and the kid is told why. Parts are allowed to have moved on: the Builder's code edits do not
      depend on a setting's value, and an op on a part that is gone is skipped.
   3. Never leave the game broken. Everything is saved into an undo entry first; if the rebuilt
      frame reports an error within SETTLE_MS of being ready, or is not ready within READY_MS, the
      entry is put back, the frame is rebuilt again, and the kid is told the change was undone.
   4. One build at a time. A second ask while one is running is turned away, not queued.

   The safety net only sees what happens while the game is STOPPED: update() does nothing until Play
   (starter/game.js), so a change that breaks only in Play mode shows up on the first Play instead.
   That case emits ('broke', text) once, so the caller can offer Builder.undo().

   Parts are changed the way the kid changes them: a `set` goes through Editor.set, the one change
   path, so Undo, the Inspector, the Hierarchy and the quest engine all see it. `add` and `remove`
   have no Editor path, so they edit Project.get().parts directly and repaint the Hierarchy.

   If the kid is in Play mode when a change arrives, the game is stopped first (Editor.togglePlay,
   which puts back what Play changed, Unity's rule, runner.js:17): the change is to the game, not to
   one test run of it.

   Needs, loaded before it: project.js, runner.js, ui.js, editor.js. State is per browser tab and
   nothing but `Builder` is global. */
var Builder = (function () {
  var TIMEOUT_MS = 40000;   // the server's own budget is shorter (routes/ai.js, BUILDER_BUDGET_MS)
  var READY_MS = 8000;      // a rebuilt frame that is not ready by then is treated as broken
  var SETTLE_MS = 3000;     // an error this soon after ready is the change's fault
  var MAX_UNDO = 20;

  var undos = [], listeners = [], busy = false, watch = null, armed = false;

  function on(fn) { listeners.push(fn); }
  function emit(name, detail) { listeners.forEach(function (fn) { try { fn(name, detail); } catch (e) { console.error(e); } }); }

  /* The frame's errors, routed to whichever build is being watched right now. After a build, the
     first Play is watched too (the safety-net note above). */
  Runner.on(function (name, text) {
    if (name === 'error' && watch) { watch(text); return; }
    if (name === 'error' && armed && Runner.isPlaying()) { armed = false; emit('broke', text); }
    if (name === 'stop') armed = false;
  });

  /* Same FNV-1a as codeHash in routes/ai.js, so `base` can be checked against the code sent. */
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function host() {
    var f = Runner.frame();
    return (f && f.parentNode) || document.getElementById('stage');
  }
  function result(ok, reply, extra) {
    var r = { ok: ok, reply: reply, changed: { code: false, parts: [] }, summary: '', held: null };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  function fail(reason, reply, extra) {
    emit('failed', reason);
    return result(false, reply, extra);
  }

  /* POST with a deadline. Resolves { status, j } or rejects with 'timeout' / the network error. */
  function post(body) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer;
    var timeout = new Promise(function (resolve, reject) {
      timer = setTimeout(function () { if (ctl) ctl.abort(); reject(new Error('timeout')); }, TIMEOUT_MS);
    });
    var req = fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; });
    });
    return Promise.race([req, timeout]).then(function (x) { clearTimeout(timer); return x; },
      function (e) { clearTimeout(timer); throw e; });
  }

  /* A few words for the Console row: what the build touched. */
  function summarize(codeChanged, edits, ops) {
    var bits = [];
    if (codeChanged) bits.push('code: ' + edits + (edits === 1 ? ' edit' : ' edits'));
    ops.forEach(function (o) {
      if (o.op === 'set') { var p = Project.part(o.id); bits.push((p ? p.name : o.id) + ' ' + o.key + ' = ' + JSON.stringify(o.value)); }
      if (o.op === 'add') bits.push('added ' + o.part.name);
      if (o.op === 'remove') bits.push('removed ' + o.id);
    });
    return bits.join(' · ');
  }

  function snapshot() {
    var st = Project.get();
    return { code: st.code, codeEdited: !!st.codeEdited, parts: Project.clone(st.parts) };
  }
  function repaint() {
    Editor.tree();
    var sel = Editor.selected && Editor.selected();
    if (sel) { if (Project.part(sel)) Editor.inspect(sel); else Editor.closeInspector(); }
  }
  function restore(entry) {
    var st = Project.get();
    st.code = entry.code; st.codeEdited = entry.codeEdited; st.parts = Project.clone(entry.parts);
    Project.save();
    repaint();
    return Runner.mount(host(), st.code, st.parts, UI.muted());
  }

  /* Rebuild the frame and watch it start. Resolves null when it came up clean, or a reason. */
  function verify() {
    var st = Project.get();
    return new Promise(function (resolve) {
      var done = false, readyTimer = null, settleTimer = null;
      function finish(reason) {
        if (done) return;
        done = true; watch = null;
        clearTimeout(readyTimer); clearTimeout(settleTimer);
        resolve(reason);
      }
      watch = function (text) { finish('the game hit an error: ' + String(text || '').slice(0, 200)); };
      readyTimer = setTimeout(function () { finish('the game did not start within ' + (READY_MS / 1000) + 's'); }, READY_MS);
      Runner.mount(host(), st.code, st.parts, UI.muted()).then(function () {
        clearTimeout(readyTimer);
        if (!done) settleTimer = setTimeout(function () { finish(null); }, SETTLE_MS);
      }, function (e) { finish('the game could not be rebuilt: ' + (e && e.message || e)); });
    });
  }

  /* Apply the server's answer. Returns the list of part ops that were actually applied. */
  function apply(res) {
    var st = Project.get(), applied = [];
    if (typeof res.code === 'string') { st.code = res.code; st.codeEdited = true; }
    (res.parts || []).forEach(function (o) {
      if (o.op === 'set') {
        if (!Project.part(o.id)) return;
        Editor.set(o.id, o.key, o.value);
        applied.push(o);
      } else if (o.op === 'add') {
        if (!o.part || Project.part(o.part.id)) return;
        st.parts.push(JSON.parse(JSON.stringify(o.part)));
        applied.push(o);
      } else if (o.op === 'remove') {
        if (!Project.part(o.id)) return;
        st.parts = st.parts.filter(function (p) { return p.id !== o.id; });
        applied.push(o);
      }
    });
    Project.save();
    repaint();
    return applied;
  }

  /* request: the mentor's brief. opts: { kidSaid, studio, where, history }. */
  function ask(request, opts) {
    opts = opts || {};
    request = String(request || '').trim();
    if (!request) return Promise.resolve(result(false, 'Tell me what you want to change and I’ll build it.'));
    if (busy) return Promise.resolve(result(false, 'I’m still building the last thing. Give me a moment.'));
    busy = true;
    emit('building', request);
    var sent = null;

    return Project.code().then(function (code) {
      sent = code;
      var st = Project.get();
      return post({
        agent: 'builder', message: request,
        kidSaid: opts.kidSaid ? String(opts.kidSaid) : '',
        studio: opts.studio ? String(opts.studio) : '',
        where: opts.where ? String(opts.where) : '',
        history: Array.isArray(opts.history) ? opts.history : [],
        code: code,
        parts: st.parts
      });
    }).then(function (x) {
      var j = x.j || {};
      if (x.status >= 400 || typeof j.reply !== 'string') {
        return fail('server ' + x.status, j.reply || 'Something went wrong on the studio’s side, so nothing in your game changed.');
      }
      var codeChanged = typeof j.code === 'string';
      var ops = Array.isArray(j.parts) ? j.parts : [];
      if (!codeChanged && !ops.length) {
        return fail(j.held ? 'held: ' + j.held : 'no change', j.reply || 'I didn’t change anything that time.', { held: j.held || null });
      }
      if (j.base !== hash(sent)) return fail('base mismatch', 'Something got mixed up on the way, so I didn’t change anything. Try asking again.');
      if (Project.get().code !== sent) {
        return fail('code changed meanwhile', 'Your game’s code changed while I was working, so I didn’t put my change in. Ask me again and I’ll build it on the new version.');
      }

      if (Runner.isPlaying()) Editor.togglePlay();   // see the header: the change is to the game, not this test run
      var entry = snapshot();
      undos.push(entry);
      if (undos.length > MAX_UNDO) undos.shift();
      var applied = apply(j);
      var summary = summarize(codeChanged, j.edits || 0, applied);

      return verify().then(function (reason) {
        if (!reason) {
          armed = true;
          emit('built', summary);
          return result(true, j.reply || 'I changed your game. Press Play to try it.',
            { changed: { code: codeChanged, parts: applied }, summary: summary });
        }
        undos.pop();
        return restore(entry).then(function () {
          emit('reverted', reason);
          return result(false, 'That change broke the game, so I put it back. Try asking for it a different way.', { summary: summary });
        }, function () {
          emit('reverted', reason);
          return result(false, 'That change broke the game, so I put it back. Try asking for it a different way.', { summary: summary });
        });
      });
    }, function (e) {
      if (e && e.message === 'timeout') return fail('timeout', 'That was taking too long, so I stopped. Nothing in your game changed. Try asking again.');
      if (sent === null) return fail('no code', 'I couldn’t read your game’s code, so nothing changed. Try reloading the page.');
      return fail('network', 'I couldn’t reach the studio’s server, so nothing in your game changed. Check the connection and try again.');
    }).then(function (r) { busy = false; return r; }, function (e) {
      busy = false;
      console.error(e);
      return fail('error', 'Something went wrong while I was building, so I stopped. If your game looks wrong, press Undo.');
    });
  }

  /* Put back the last build. Resolves true if there was one to put back. */
  function undo() {
    if (busy || !undos.length) return Promise.resolve(false);
    if (Runner.isPlaying()) Editor.togglePlay();
    var entry = undos.pop();
    armed = false;
    busy = true;
    return restore(entry).then(function () { busy = false; emit('reverted', 'undo'); return true; },
      function () { busy = false; emit('reverted', 'undo'); return true; });
  }

  return { ask: ask, undo: undo, on: on,
           canUndo: function () { return !busy && undos.length > 0; },
           busy: function () { return busy; } };
})();
