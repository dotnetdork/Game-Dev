/* widgets.js — In-lesson widgets: runnable cells, the five quiz types, and challenge minigames. Each runs in its own sandboxed iframe and reports back by token. */
/* Lesson widgets (run cells, challenge minigames) each run in their own sandboxed iframe and
   post results back by token. ONE delegating listener serves them all: a cell registers a
   handler under its token, and re-rendering a lesson clears the registry — otherwise every
   lesson render would leave another permanent window listener behind. */
const widgetHandlers = {};
window.addEventListener('message', function (e) {
  const d = e && e.data; if (!d || !d.tok) return;
  const fn = widgetHandlers[d.tok]; if (fn) fn(d);
});
function resetWidgetHandlers() { Object.keys(widgetHandlers).forEach(function (k) { delete widgetHandlers[k]; }); }

/* ---------- stable widget keys ----------
   Widgets used to identify themselves with Math.random(), which meant nothing about a lesson
   could be remembered: a new id every render. Keys are now the widget's position in the lesson
   by kind — q0, q1, r0, c0 — which is the same on every render and after a reload, so the
   activity ledger in project.js has something durable to hang answers on. */
let lessonWidgetId = '';
let widgetSeq = { q: 0, r: 0, c: 0, y: 0 };
let goalRunKeys = [];        // run cells that declare @expect — the only ones that can be "finished"
function beginLessonWidgets(lessonId) { lessonWidgetId = lessonId || ''; widgetSeq = { q: 0, r: 0, c: 0, y: 0 }; goalRunKeys = []; }
function nextWidgetKey(kind) { return kind + (widgetSeq[kind]++); }
function widgetToken(key) { return (lessonWidgetId || 'l') + ':' + key; }

/* ```run — editable JS cell. Directives (as // @lines): @goal: <text>, @expect: <substring>, @slider: name min max step value */
function renderRunCells(root) {
  root.querySelectorAll('pre > code.language-run').forEach(function (code) {
    const pre = code.parentNode; const raw = code.textContent;
    let goal = '', expect = ''; const sliders = []; const bodyLines = [];
    raw.split('\n').forEach(function (ln) {
      let m;
      if (m = ln.match(/^\s*\/\/\s*@goal:\s*(.+)$/)) goal = m[1].trim();
      else if (m = ln.match(/^\s*\/\/\s*@expect:\s*(.+)$/)) expect = m[1].trim();
      else if (m = ln.match(/^\s*\/\/\s*@slider:\s*([A-Za-z_$][\w$]*)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/)) sliders.push({ name: m[1], min: +m[2], max: +m[3], step: +m[4], value: +m[5] });
      else bodyLines.push(ln);
    });
    // Trailing blank lines too, not just leading: a fence's closing newline was showing up as an
    // extra empty line in the editor, which is most of the "gap under the code".
    const src = bodyLines.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '');
    const key = nextWidgetKey('r'), tok = widgetToken(key);
    const cell = document.createElement('div'); cell.className = 'runcell';
    if (goal) { const g = document.createElement('div'); g.className = 'run-goal'; g.innerHTML = '<span class="mdi mdi-target"></span>'; g.appendChild(document.createTextNode(goal)); cell.appendChild(g); }
    const sEls = {};
    if (sliders.length) {
      const sw = document.createElement('div'); sw.className = 'run-sliders';
      sliders.forEach(function (s) {
        const row = document.createElement('label'); row.className = 'run-slider';
        const nm = document.createElement('span'); nm.className = 'rs-name'; nm.textContent = s.name + ' = ';
        const val = document.createElement('b'); val.textContent = s.value; nm.appendChild(val);
        const inp = document.createElement('input'); inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = s.value;
        inp.addEventListener('input', function () { val.textContent = inp.value; run(); });
        sEls[s.name] = inp; row.appendChild(nm); row.appendChild(inp); sw.appendChild(row);
      });
      cell.appendChild(sw);
    }
    /* A real editor rather than a <textarea>: the run cell is where a lesson first shows a child
       actual JavaScript, and it was the one code surface with no colouring at all. It also sizes
       itself to the code, which is what removes the empty box under a one-line example. */
    const host = document.createElement('div'); host.className = 'run-editor';
    const ta = document.createElement('textarea'); ta.value = src; ta.spellcheck = false;
    let editor = null;
    if (typeof CodeMirror === 'function') {
      editor = CodeMirror(host, {
        value: src, mode: 'javascript', theme: 'material-darker',
        tabSize: 2, indentUnit: 2, matchBrackets: true, autoCloseBrackets: true,
        viewportMargin: Infinity
      });
    } else { ta.rows = Math.max(1, src.split('\n').length); host.appendChild(ta); }
    const readCode = function () { return editor ? editor.getValue() : ta.value; };

    const bar = document.createElement('div'); bar.className = 'runbar';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'runbtn'; btn.innerHTML = '<span class="mdi mdi-play"></span>Run';
    const status = document.createElement('span'); status.className = 'run-status';
    /* The iframe is here to RUN the code safely, not to show it. A run cell only ever produces
       console text, and that text already comes back over postMessage — so it is rendered in the
       page, where it fits its content exactly. Sizing an iframe to its contents means guessing a
       height for a box that scrolls independently, and the guess was wrong whenever the output
       wrapped or the panel was resized. The sandbox stays, at zero size. */
    const out = document.createElement('iframe'); out.className = 'runsandbox'; out.setAttribute('sandbox', 'allow-scripts');
    out.setAttribute('title', 'Code sandbox'); out.setAttribute('aria-hidden', 'true');
    const outText = document.createElement('pre'); outText.className = 'runout'; outText.setAttribute('aria-live', 'polite');
    function buildDoc(userCode) {
      const prefix = sliders.map(function (s) { return 'const ' + s.name + ' = ' + sEls[s.name].value + ';'; }).join('\n');
      const safe = (prefix + '\n' + userCode).replace(/<\/(script)/gi, '<\\/$1');
      // The document reports its own height back so the output box can fit the output instead of
      // reserving a fixed 120px and leaving a hole under a single line of text.
      return '<!doctype html><body><pre id="o"></pre><scr' + 'ipt>var o=document.getElementById("o");function w(){o.textContent+=[].slice.call(arguments).join(" ")+"\\n";}console.log=w;console.info=w;console.warn=w;console.error=function(){o.textContent+="\\u26a0 "+[].slice.call(arguments).join(" ")+"\\n";};try{\n' + safe + '\n}catch(e){o.textContent+="\\u26a0 "+e.message+"\\n";}try{parent.postMessage({__runcell:true,tok:"' + tok + '",text:o.textContent},"*");}catch(e){}</scr' + 'ipt></body>';
    }
    function run() { out.srcdoc = buildDoc(readCode()); }

    if (expect) {
      // A goal-checked run cell counts toward finishing the lesson; one without a goal cannot,
      // because neither the student nor the app can tell whether anything was achieved.
      goalRunKeys.push(key);
      if (activityDone(lessonWidgetId, key)) { status.className = 'run-status ok'; status.textContent = 'Goal met!'; }
    }
    widgetHandlers[tok] = function (d) {
      if (!d.__runcell) return;
      // textContent, never innerHTML: this string is whatever the student's code printed.
      outText.textContent = (d.text || '').replace(/\n+$/, '');
      if (!expect) return;
      const met = (d.text || '').indexOf(expect) >= 0;
      status.className = 'run-status ' + (met ? 'ok' : 'no'); status.textContent = met ? 'Goal met!' : 'Not yet — check the output.';
      if (met) resolveActivity(key);
    };

    /* A cell whose whole point is "drag this and watch the number change" should not also make you
       press Run. Sliders re-run on input, so the button is noise — and the cell starts already
       run, so there is something to watch change. */
    const liveSliders = sliders.length > 0 && !expect;
    if (!liveSliders) { btn.addEventListener('click', run); bar.appendChild(btn); }
    bar.appendChild(status);
    cell.appendChild(host); if (!liveSliders) cell.appendChild(bar);
    cell.appendChild(outText); cell.appendChild(out);
    pre.parentNode.replaceChild(cell, pre);
    if (editor) editor.refresh();       // only now does it have a box to measure
    if (liveSliders) run();
  });
}
function shuffleOrder(n) {
  let a = []; for (let i = 0; i < n; i++) a.push(i);
  if (n < 2) return a;
  let tries = 0;
  do { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } tries++; }
  while (a.every(function (v, i) { return v === i; }) && tries < 12);
  return a;
}
/* ```quiz  (provisional syntax) — types: mcq | predict | parsons | fillblank | findbug. All checked locally. */
function renderQuizCells(root) {
  const codes = [].slice.call(root.querySelectorAll('pre > code.language-quiz'));
  const total = codes.length;
  codes.forEach(function (code, idx) {
    let q; try { q = jsyaml.load(code.textContent) || {}; } catch (e) { q = {}; }
    const pre = code.parentNode;
    const key = nextWidgetKey('q');

    const cell = document.createElement('div'); cell.className = 'quizcell'; cell.setAttribute('role', 'group');

    // Header: the question is the strongest thing in the card, with its place in the lesson.
    const head = document.createElement('div'); head.className = 'quiz-h';
    const qText = document.createElement('div'); qText.className = 'quiz-q';
    qText.innerHTML = '<span class="mdi mdi-help-circle-outline"></span>';
    qText.appendChild(document.createTextNode(q.prompt || 'Quick check'));
    head.appendChild(qText);
    const badge = document.createElement('span'); badge.className = 'quiz-count';
    badge.textContent = total > 1 ? (idx + 1) + ' of ' + total : '';
    if (total > 1) head.appendChild(badge);
    cell.appendChild(head);

    const body = document.createElement('div'); body.className = 'quiz-body'; cell.appendChild(body);

    // Footer: verdict on the left, the action on the right. Both live INSIDE .quiz-body so one
    // formatting context owns the card — the old split put the button in the flex column and the
    // result outside it, which is where the dead space under Check came from.
    const foot = document.createElement('div'); foot.className = 'quiz-foot';
    const result = document.createElement('div'); result.className = 'quiz-result';
    result.setAttribute('aria-live', 'polite');
    const check = document.createElement('button'); check.type = 'button'; check.className = 'btn btn-secondary quiz-check'; check.textContent = 'Check';

    const ctx = { q: q, key: key, cell: cell, head: head, body: body, check: check, attempts: 0, resolved: false };
    ctx.say = function (kind, msg) { result.className = 'quiz-result' + (kind ? ' ' + kind : ''); result.textContent = msg || ''; };

    const type = q.type || 'mcq';
    if (type === 'parsons') buildParsons(q, body, ctx);
    else if (type === 'fillblank') buildFill(q, body, ctx);
    else if (type === 'findbug') buildFindBug(q, body, ctx);
    else buildMCQ(q, body, ctx, type === 'predict');

    foot.appendChild(result); foot.appendChild(check);
    body.appendChild(foot);
    pre.parentNode.replaceChild(cell, pre);

    if (activityDone(lessonWidgetId, key)) markQuizDone(ctx, true);
  });
}

/* ---------- one retry model for all five quiz types ----------
   They used to disagree: mcq/predict/findbug revealed the answer on the FIRST wrong attempt and
   ended there, while fillblank/parsons allowed unlimited tries and never revealed. Same-looking
   card, opposite rules, so a child could not tell what guessing costs — and being shown the
   answer the instant you are wrong, with no second try, is the shape of feeling stupid.
   Now: first wrong explains and invites another go; second wrong teaches the answer. */
function quizVerdict(ctx, correct, wrongHint, reveal) {
  if (ctx.resolved) return;
  if (correct) { ctx.say('ok', 'Correct!'); markQuizDone(ctx); return; }
  ctx.attempts++;
  if (ctx.attempts < 2) {
    ctx.say('no', wrongHint || 'Not quite — take another look.');
    ctx.check.textContent = 'Try again';
    return;
  }
  if (typeof reveal === 'function') reveal();
  ctx.say('no', ctx.q.explain ? "Here's the answer — " + ctx.q.explain : 'Here is the answer, highlighted above.');
  markQuizDone(ctx);
}

/* Resolved for good: lock the card, tick the header, and record it so the lesson can complete
   and so the answer survives a reload. */
function markQuizDone(ctx, restoring) {
  ctx.resolved = true;
  ctx.check.disabled = true;
  ctx.check.textContent = 'Answered';
  ctx.cell.classList.add('answered');
  if (!ctx.head.querySelector('.quiz-tick')) {
    const tick = document.createElement('span'); tick.className = 'quiz-tick mdi mdi-check-circle';
    tick.title = 'Answered';
    ctx.head.appendChild(tick);
  }
  if (restoring) { ctx.say('', ''); if (typeof ctx.restore === 'function') ctx.restore(); return; }
  resolveActivity(ctx.key);
}
function buildMCQ(q, body, ctx, isPredict) {
  if (isPredict && q.code) { const pc = document.createElement('pre'); pc.className = 'quiz-code'; pc.textContent = q.code; body.appendChild(pc); }
  const opts = q.options || [], fb = q.feedback || [], rows = [];
  let chosen = -1;

  const list = document.createElement('div'); list.className = 'mcq-list';
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-label', q.prompt || 'Answer options');

  opts.forEach(function (opt, i) {
    // A real button, not a label wrapping a radio: the whole row is the target, and it is
    // reachable and pressable from the keyboard without any extra work.
    const row = document.createElement('button'); row.type = 'button'; row.className = 'mcq-opt';
    row.setAttribute('role', 'radio'); row.setAttribute('aria-checked', 'false');
    const text = document.createElement('span'); text.className = 'mcq-text'; text.textContent = opt;
    const num = document.createElement('span'); num.className = 'mcq-num'; num.textContent = String(i + 1);
    row.appendChild(text); row.appendChild(num);
    row.addEventListener('click', function () { if (!ctx.resolved) select(i); });
    rows.push(row); list.appendChild(row);
  });
  body.appendChild(list);

  function select(i) {
    chosen = i;
    rows.forEach(function (r, n) { r.classList.toggle('sel', n === i); r.setAttribute('aria-checked', n === i ? 'true' : 'false'); });
    ctx.say('', '');
  }
  // Number keys pick an answer, Enter checks it — the shortcut the badge is advertising.
  ctx.cell.addEventListener('keydown', function (e) {
    if (ctx.resolved || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= rows.length) { select(n - 1); rows[n - 1].focus(); e.preventDefault(); }
    else if (e.key === 'Enter' && document.activeElement !== ctx.check && chosen >= 0) { ctx.check.click(); e.preventDefault(); }
  });

  /* The content authors per-option feedback that only ever appeared as one line at the bottom of
     the card. It belongs against the option it explains. */
  function explainRow(i) {
    const row = rows[i]; if (!row || row.querySelector('.mcq-why') || !fb[i]) return;
    const why = document.createElement('span'); why.className = 'mcq-why'; why.textContent = fb[i];
    row.querySelector('.mcq-text').appendChild(why);
  }
  const answer = Number(q.answer);
  ctx.restore = function () { rows.forEach(function (r, i) { r.disabled = true; if (i === answer) r.classList.add('correct'); }); };

  ctx.check.addEventListener('click', function () {
    if (ctx.resolved) return;
    if (chosen < 0) { ctx.say('no', 'Pick an answer first.'); return; }
    const ok = chosen === answer;
    if (ok) { rows[chosen].classList.remove('sel'); rows[chosen].classList.add('correct'); }
    else { rows[chosen].classList.add('wrong'); rows[chosen].classList.remove('sel'); explainRow(chosen); }
    quizVerdict(ctx, ok, fb[chosen] || 'Not quite — read that one again.', function () {
      rows[answer].classList.add('correct');
    });
    if (ctx.resolved) rows.forEach(function (r) { r.disabled = true; });
  });
}
function buildParsons(q, body, ctx) {
  const items = (q.lines || []).map(function (t) { return { text: t, distractor: false, why: '' }; })
    .concat((q.distractors || []).map(function (d) { return { text: (typeof d === 'string' ? d : d.text), distractor: true, why: (typeof d === 'string' ? '' : (d.why || '')) }; }));
  const correct = (q.lines || []); const hasDist = (q.distractors || []).length > 0;
  let order = shuffleOrder(items.length); const used = {}; items.forEach(function (_, i) { used[i] = true; }); let dragFrom = null;
  let focusPos = 0;
  const list = document.createElement('div'); list.className = 'parsons';
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Put the lines in order');
  const live = document.createElement('div'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');

  /* Reordering was mouse-only: draggable plus three drag listeners and nothing else, so five
     lessons were simply unreachable without a mouse. Alt+Up/Down moves the focused line and
     announces where it landed. */
  function move(from, to) {
    if (to < 0 || to >= order.length) return;
    const mv = order.splice(from, 1)[0]; order.splice(to, 0, mv);
    focusPos = to; draw();
    const row = list.children[to]; if (row) row.focus();
    live.textContent = 'Moved to position ' + (to + 1) + ' of ' + order.length;
  }
  function draw() {
    list.innerHTML = '';
    order.forEach(function (idx, pos) {
      const it = items[idx];
      const row = document.createElement('div'); row.className = 'parsons-row' + (used[idx] ? '' : ' unused');
      row.draggable = !ctx.resolved;
      row.tabIndex = pos === focusPos ? 0 : -1;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.setAttribute('aria-label', it.text + ', position ' + (pos + 1) + ' of ' + order.length);
      // The position number is the answer, so it leads the row instead of hiding behind a handle.
      const num = document.createElement('span'); num.className = 'p-pos'; num.textContent = String(pos + 1);
      row.appendChild(num);
      // Prose steps get prose type; code lines get the monospace + colouring they deserve.
      const isCode = typeof looksLikeCode === 'function' && looksLikeCode(it.text);
      const c = document.createElement(isCode ? 'code' : 'span');
      c.className = 'p-text'; c.textContent = it.text;
      if (isCode && typeof paintCode === 'function') paintCode(c);
      row.appendChild(c);

      /* Buttons, not drag-only. This shipped as draggable + three drag listeners, which asks a
         child on a Chromebook touchscreen to do a precise drag; these work by tapping. */
      const tools = document.createElement('span'); tools.className = 'p-tools';
      [['up', 'mdi-chevron-up', 'Move up', -1], ['down', 'mdi-chevron-down', 'Move down', 1]].forEach(function (b) {
        const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'p-move';
        mb.innerHTML = '<span class="mdi ' + b[1] + '"></span>';
        mb.title = b[2]; mb.setAttribute('aria-label', b[2] + ': ' + it.text);
        mb.disabled = ctx.resolved || (b[3] < 0 ? pos === 0 : pos === order.length - 1);
        mb.addEventListener('click', function (e) { e.stopPropagation(); move(pos, pos + b[3]); });
        tools.appendChild(mb);
      });
      if (hasDist) {
        const drop = document.createElement('button'); drop.type = 'button'; drop.className = 'p-use';
        drop.setAttribute('aria-pressed', used[idx] ? 'false' : 'true');
        drop.title = used[idx] ? 'This line does not belong — leave it out' : 'Put this line back in';
        drop.innerHTML = '<span class="mdi ' + (used[idx] ? 'mdi-close' : 'mdi-plus') + '"></span>';
        drop.disabled = ctx.resolved;
        drop.addEventListener('click', function (e) { e.stopPropagation(); used[idx] = !used[idx]; draw(); const r = list.children[pos]; if (r) r.focus(); });
        tools.appendChild(drop);
      }
      row.appendChild(tools);
      row.addEventListener('focus', function () { focusPos = pos; });
      row.addEventListener('keydown', function (e) {
        if (ctx.resolved) return;
        if (e.altKey && e.key === 'ArrowUp') { move(pos, pos - 1); e.preventDefault(); }
        else if (e.altKey && e.key === 'ArrowDown') { move(pos, pos + 1); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { const p = list.children[pos - 1]; if (p) { focusPos = pos - 1; p.tabIndex = 0; p.focus(); } e.preventDefault(); }
        else if (e.key === 'ArrowDown') { const n = list.children[pos + 1]; if (n) { focusPos = pos + 1; n.tabIndex = 0; n.focus(); } e.preventDefault(); }
        else if (hasDist && (e.key === ' ' || e.key === 'Enter')) { used[idx] = !used[idx]; draw(); const r = list.children[pos]; if (r) r.focus(); live.textContent = used[idx] ? 'Line kept' : 'Line left out'; e.preventDefault(); }
      });
      row.addEventListener('dragstart', function () { dragFrom = pos; row.classList.add('dragging'); });
      row.addEventListener('dragend', function () { row.classList.remove('dragging'); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('over'); });
      row.addEventListener('dragleave', function () { row.classList.remove('over'); });
      row.addEventListener('drop', function (e) { e.preventDefault(); row.classList.remove('over'); if (dragFrom === null || dragFrom === pos) { dragFrom = null; return; } const mv = order.splice(dragFrom, 1)[0]; order.splice(pos, 0, mv); dragFrom = null; draw(); });
      list.appendChild(row);
    });
  }
  draw(); body.appendChild(list); body.appendChild(live);
  const hint = document.createElement('div'); hint.className = 'parsons-hint';
  hint.textContent = (hasDist ? 'Put the lines in order with the arrows, and use ✕ to leave out any that don’t belong. ' : 'Put the lines in the right order using the arrows (or drag them). ')
    + 'Keyboard: ↑ ↓ to move between lines, Alt + ↑ ↓ to reorder.';
  body.appendChild(hint);

  ctx.restore = function () { draw(); };
  ctx.check.addEventListener('click', function () {
    if (ctx.resolved) return;
    const kept = order.filter(function (idx) { return used[idx]; }).map(function (idx) { return items[idx]; });
    const badDist = kept.filter(function (it) { return it.distractor; });
    const texts = kept.map(function (it) { return it.text; });
    const ok = !badDist.length && texts.length === correct.length && texts.every(function (t, i) { return t === correct[i]; });
    const hintMsg = badDist.length
      ? (badDist[0].why ? 'Not quite — ' + badDist[0].why : 'Not quite — one of the lines you kept doesn’t belong.')
      : 'Not yet — check the order (and which lines you kept).';
    quizVerdict(ctx, ok, hintMsg, function () {
      order = items.map(function (_, i) { return i; }).filter(function (i) { return !items[i].distractor; });
      items.forEach(function (it, i) { used[i] = !it.distractor; });
      draw();
    });
    if (ctx.resolved) draw();
  });
}
function buildFill(q, body, ctx) {
  const tpl = String(q.code || q.template || ''); const parts = tpl.split('___');
  // A prose template ("We write our game in ___") should not be dressed as a code block.
  const isCode = typeof looksLikeCode === 'function' && looksLikeCode(tpl);
  const wrap = document.createElement('div'); wrap.className = 'fill-code' + (isCode ? '' : ' prose');
  const input = document.createElement('input'); input.type = 'text'; input.className = 'fill-input'; input.spellcheck = false; input.placeholder = 'type your answer';
  input.setAttribute('aria-label', q.prompt || 'Fill in the blank');
  if (parts.length >= 2) { wrap.appendChild(document.createTextNode(parts[0])); wrap.appendChild(input); wrap.appendChild(document.createTextNode(parts.slice(1).join('___'))); }
  else { wrap.appendChild(input); }
  body.appendChild(wrap);
  // Grow with what's typed, so the answer isn't cramped in a fixed 130px slot.
  const sizeInput = function () { input.style.width = Math.max(120, Math.min(340, (input.value.length || 12) * 8.6 + 26)) + 'px'; };
  input.addEventListener('input', sizeInput); sizeInput();
  const answers = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(function (a) { return String(a).trim(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !ctx.resolved) { ctx.check.click(); e.preventDefault(); } });

  ctx.restore = function () { input.value = answers[0] || ''; sizeInput(); input.disabled = true; input.classList.add('correct'); };
  ctx.check.addEventListener('click', function () {
    if (ctx.resolved) return;
    const v = input.value.trim();
    if (!v) { ctx.say('no', 'Type your answer in the box first.'); return; }
    const ok = answers.some(function (a) { return a === v || a.toLowerCase() === v.toLowerCase(); });
    input.classList.toggle('correct', ok); input.classList.toggle('wrong', !ok);
    quizVerdict(ctx, ok, q.explain ? 'Not quite — ' + q.explain : 'Not quite — check the spelling and try again.', function () {
      input.value = answers[0] || ''; sizeInput(); input.classList.remove('wrong'); input.classList.add('correct');
    });
    if (ctx.resolved) input.disabled = true;
  });
}
function buildFindBug(q, body, ctx) {
  const lines = q.code || q.lines || []; let chosen = -1; const rows = [];
  const wrap = document.createElement('div'); wrap.className = 'findbug';
  wrap.setAttribute('role', 'radiogroup'); wrap.setAttribute('aria-label', q.prompt || 'Which line has the bug?');
  // Say what to do. The card showed a block of code and a Check button and left the child to
  // infer that the lines were clickable at all.
  const lead = document.createElement('div'); lead.className = 'fb-lead';
  lead.textContent = 'Click the line you think has the bug.';
  wrap.appendChild(lead);
  lines.forEach(function (ln, i) {
    // A button, so the line is reachable and pressable without a mouse.
    const row = document.createElement('button'); row.type = 'button'; row.className = 'fb-row'; rows.push(row);
    row.setAttribute('role', 'radio'); row.setAttribute('aria-checked', 'false');
    row.setAttribute('aria-label', 'Line ' + (i + 1) + ': ' + ln);
    const num = document.createElement('span'); num.className = 'fb-num'; num.textContent = (i + 1);
    const c = document.createElement('code'); c.textContent = ln;
    if (typeof paintCode === 'function') paintCode(c);
    row.appendChild(num); row.appendChild(c);
    row.addEventListener('click', function () {
      if (ctx.resolved) return;
      chosen = i;
      rows.forEach(function (r, n) { r.classList.toggle('sel', n === i); r.setAttribute('aria-checked', n === i ? 'true' : 'false'); });
      ctx.say('', '');
    });
    wrap.appendChild(row);
  });
  body.appendChild(wrap);
  const answer = Number(q.answer);
  ctx.restore = function () { rows.forEach(function (r, i) { r.disabled = true; if (i === answer) r.classList.add('correct'); }); };

  ctx.check.addEventListener('click', function () {
    if (ctx.resolved) return;
    if (chosen < 0) { ctx.say('no', 'Pick the line you think has the bug.'); return; }
    const ok = chosen === answer;
    if (ok) { rows[chosen].classList.remove('sel'); rows[chosen].classList.add('correct'); }
    else { rows[chosen].classList.add('wrong'); rows[chosen].classList.remove('sel'); }
    quizVerdict(ctx, ok, q.explain ? 'Not quite — ' + q.explain : 'Not quite — look at that line again.', function () {
      rows[answer].classList.add('correct');
    });
    if (ctx.resolved) rows.forEach(function (r) { r.disabled = true; });
  });
}
/* Inline Markdown for the short authored strings in a lab or a "your turn" step — `code` and
   **bold**, nothing else. Written by hand rather than run through marked() because these are
   single lines, not documents: marked would wrap each one in a <p> and fight the list styling.
   Escaped FIRST, so authored text can never inject markup. */
function inlineMd(text) {
  return esc(String(text == null ? '' : text))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

/* ```challenge — the lesson LAB: the course's own game, broken on purpose, sitting inside the
   lesson for the student to fix.

   The important thing about a lab is whose it is. It is NOT the student's game — that lives in the
   Code tab and nothing here ever touches it. This is the course's example, on a bench, and it says
   so: its own header, a note that it can be reset at any time, and a reset button in plain sight.

   Layout: the CODE comes first and the running game sits under it. You read the thing you are
   about to change, then watch what it does — and after pressing Run your eye does not have to
   travel back up past the output to reach the editor again.

   Authored as YAML in a ```challenge fence:
     title:     what the bench is called
     task:      what is wrong / what to do, in a sentence
     hint:      shown after the first failed run
     code:      the broken starting code
     solution:  the working version, offered once they are properly stuck
   Only `code` is required.

   The student's code calls win() when the goal is met, which resolves the activity and can
   complete the lesson. */
const LAB_HINT_AFTER = 1;     // failed runs before the hint appears
const LAB_REVEAL_AFTER = 4;   // failed runs before the worked answer is offered

function renderChallengeCells(root) {
  root.querySelectorAll('pre > code.language-challenge').forEach(function (code) {
    let c; try { c = jsyaml.load(code.textContent) || {}; } catch (e) { c = {}; }
    const pre = code.parentNode;
    const key = nextWidgetKey('c'), tok = widgetToken(key);
    const lessonId = lessonWidgetId;
    const saved = labState(lessonId, key) || {};
    const startCode = c.code || '';
    const solved = activityDone(lessonId, key);
    let fails = saved.fails || 0;
    let revealed = !!saved.revealed;

    /* Classes are ch-*, not cm-*: the lesson root carries CodeMirror's `cm-s-material-darker`
       theme class, and a widget naming its own parts cm-anything is one rename from colliding. */
    const cell = document.createElement('div'); cell.className = 'challenge-mini';

    const head = document.createElement('div'); head.className = 'ch-head';
    head.innerHTML = '<span class="mdi mdi-flask-outline" aria-hidden="true"></span>'
      + '<span class="ch-title">' + esc(c.title || 'Lab') + '</span>';
    const reset = document.createElement('button'); reset.type = 'button';
    reset.className = 'btn btn-secondary ch-reset';
    reset.innerHTML = '<span class="mdi mdi-restore" aria-hidden="true"></span>Reset';
    reset.title = 'Put the example back the way it started';
    head.appendChild(reset);
    cell.appendChild(head);

    const bodyEl = document.createElement('div'); bodyEl.className = 'ch-body'; cell.appendChild(bodyEl);

    /* Says whose this is, every time, so the student never has to remember. */
    const note = document.createElement('p'); note.className = 'ch-note';
    note.innerHTML = '<span class="mdi mdi-information-outline" aria-hidden="true"></span>'
      + '<span>This is the course’s example, not your game. Break it as much as you like — Reset puts it back.</span>';
    bodyEl.appendChild(note);

    if (c.task) { const t = document.createElement('div'); t.className = 'ch-task'; t.innerHTML = inlineMd(c.task); bodyEl.appendChild(t); }

    const host = document.createElement('div'); host.className = 'ch-editor';
    const ta = document.createElement('textarea'); ta.spellcheck = false;
    let editor = null;

    const stage = document.createElement('iframe'); stage.className = 'ch-stage'; stage.setAttribute('sandbox', 'allow-scripts');
    stage.setAttribute('title', 'Lab output');

    bodyEl.appendChild(host);       // code first
    bodyEl.appendChild(stage);      // then what it does

    const bar = document.createElement('div'); bar.className = 'ch-foot';
    const status = document.createElement('div'); status.className = 'ch-status'; status.setAttribute('aria-live', 'polite');
    const run = document.createElement('button'); run.type = 'button'; run.className = 'btn btn-primary-role ch-run';
    run.innerHTML = '<span class="mdi mdi-play"></span>Run';
    bar.appendChild(status); bar.appendChild(run);
    cell.appendChild(bar);

    function readCode() { return editor ? editor.getValue() : ta.value; }
    function writeCode(v) { if (editor) editor.setValue(v); else ta.value = v; }

    function build(userCode) {
      const safe = userCode.replace(/<\/(script)/gi, '<\\/$1');
      return '<!doctype html><body style="margin:0;background:#08121f;display:flex;align-items:center;justify-content:center;height:100vh"><canvas id="c" width="300" height="200" style="background:#0d2137;border-radius:8px"></canvas><scr' + 'ipt>var canvas=document.getElementById("c"),ctx=canvas.getContext("2d"),__w=false;function win(){if(__w)return;__w=true;try{parent.postMessage({__cm:true,tok:"' + tok + '",win:true},"*");}catch(e){}}window.onerror=function(m){try{parent.postMessage({__cm:true,tok:"' + tok + '",err:String(m)},"*");}catch(e){}};try{\n' + safe + '\n}catch(e){window.onerror(e.message);}<\/scr' + 'ipt></body>';
    }

    /* ---------- getting stuck ----------
       Same shape as the quiz retry rule the student already knows: a nudge after the first failure,
       and the answer offered after several. Twenty minutes stuck is not perseverance, it is a child
       who has stopped learning and needs a door. */
    let hintEl = null;
    function showHint() {
      if (hintEl || !c.hint) return;
      hintEl = document.createElement('p'); hintEl.className = 'ch-hint';
      hintEl.innerHTML = '<span class="mdi mdi-lightbulb-on-outline" aria-hidden="true"></span><span>' + inlineMd(c.hint) + '</span>';
      bodyEl.insertBefore(hintEl, host);
    }
    let solveEl = null;
    function offerSolution() {
      if (solveEl || !c.solution) return;
      solveEl = document.createElement('div'); solveEl.className = 'ch-solve';
      const p = document.createElement('p');
      p.textContent = 'Stuck on this one? You can put the working version in and read it instead.';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary';
      b.textContent = 'Show me the working version';
      b.addEventListener('click', function () {
        writeCode(c.solution);
        revealed = true;
        saveLabState(lessonId, key, { revealed: true, code: c.solution });
        solveEl.innerHTML = '<p class="ch-solve-done">Here it is. Read it, run it, and see what it does '
          + 'differently — that is the bit worth remembering.</p>';
      });
      solveEl.appendChild(p); solveEl.appendChild(b);
      bodyEl.insertBefore(solveEl, host);
    }
    function afterFail() {
      fails++;
      saveLabState(lessonId, key, { fails: fails, code: readCode() });
      if (fails >= LAB_HINT_AFTER) showHint();
      if (fails >= LAB_REVEAL_AFTER && !revealed) offerSolution();
    }

    function markSolved() {
      status.className = 'ch-status ok';
      status.innerHTML = '<span class="mdi mdi-check-circle"></span>'
        + (revealed ? 'Working — now you have seen why.' : 'Fixed it!');
    }
    if (solved) markSolved();

    widgetHandlers[tok] = function (d) {
      if (!d.__cm) return;
      if (d.win) { attemptOpen = false; markSolved(); saveLabState(lessonId, key, { code: readCode() }); resolveActivity(key); }
      else if (d.err) { attemptOpen = false; status.className = 'ch-status no'; status.textContent = 'Error: ' + d.err; afterFail(); }
    };

    /* When does a run count as failed?
       Not "did it win within 900ms" — this lab animates a ship across the screen and needs about
       1.4 seconds, so that question marked a CORRECT answer as a failure. A run counts as failed
       when the student runs AGAIN without having won in between: honest, and it can never mislabel
       a slow success. A thrown error is counted straight away, since that one is not ambiguous. */
    let attemptOpen = false;
    run.addEventListener('click', function () {
      if (attemptOpen) afterFail();
      attemptOpen = true;
      status.className = 'ch-status'; status.textContent = 'Running…';
      saveLabState(lessonId, key, { code: readCode() });
      stage.srcdoc = build(readCode());
    });

    reset.addEventListener('click', function () {
      writeCode(startCode);
      fails = 0; revealed = false; attemptOpen = false;
      if (hintEl) { hintEl.remove(); hintEl = null; }
      if (solveEl) { solveEl.remove(); solveEl = null; }
      status.className = 'ch-status'; status.textContent = '';
      stage.removeAttribute('srcdoc');
      clearLabState(lessonId, key);
      toast('Example reset.');
    });

    pre.parentNode.replaceChild(cell, pre);

    /* Built after replaceChild: CodeMirror mounts into a detached node otherwise and renders as an
       empty frame. */
    const initial = typeof saved.code === 'string' ? saved.code : startCode;
    if (typeof CodeMirror === 'function') {
      editor = CodeMirror(host, {
        value: initial, mode: 'javascript', theme: 'material-darker',
        lineNumbers: true, tabSize: 2, indentUnit: 2, matchBrackets: true,
        autoCloseBrackets: true, viewportMargin: Infinity
      });
      editor.on('blur', function () { saveLabState(lessonId, key, { code: readCode() }); });
      editor.refresh();
    } else {
      ta.className = 'ch-code'; ta.value = initial; host.appendChild(ta);
      ta.addEventListener('blur', function () { saveLabState(lessonId, key, { code: readCode() }); });
    }
    if (fails >= LAB_HINT_AFTER) showHint();
    if (fails >= LAB_REVEAL_AFTER && !revealed) offerSolution();
  });
}

/* ```yourturn — the bridge from the lab to the student's own game.
   A lab teaches a technique on the course's example. This asks them to do the same thing in the
   game that is actually theirs, by hand. That order — worked example, then independent practice —
   is the point: copying the lab's code across would move the technique without teaching it.

   YAML: title, task, steps (a list), and optionally `reward` naming an unlockable.
   Checking is manual for now — the student says when they have done it. Stage 5 replaces that with
   a verifier that reads their project, at which point only this function changes. */
function renderYourTurnCells(root) {
  root.querySelectorAll('pre > code.language-yourturn').forEach(function (code) {
    let c; try { c = jsyaml.load(code.textContent) || {}; } catch (e) { c = {}; }
    const pre = code.parentNode;
    const key = nextWidgetKey('y');
    const lessonId = lessonWidgetId;
    const done = activityDone(lessonId, key);

    const cell = document.createElement('div'); cell.className = 'yourturn';
    const head = document.createElement('div'); head.className = 'yt-head';
    head.innerHTML = '<span class="mdi mdi-rocket-launch-outline" aria-hidden="true"></span>'
      + '<span class="yt-title">' + esc(c.title || 'Your turn') + '</span>';
    cell.appendChild(head);

    const body = document.createElement('div'); body.className = 'yt-body';
    if (c.task) { const t = document.createElement('p'); t.className = 'yt-task'; t.innerHTML = inlineMd(c.task); body.appendChild(t); }
    if (Array.isArray(c.steps) && c.steps.length) {
      const ol = document.createElement('ol'); ol.className = 'yt-steps';
      // inlineMd, not textContent: steps name real functions like `update`, and the backticks were
      // showing up literally on screen.
      c.steps.forEach(function (s) { const li = document.createElement('li'); li.innerHTML = inlineMd(s); ol.appendChild(li); });
      body.appendChild(ol);
    }
    if (c.reward) {
      const r = document.createElement('p'); r.className = 'yt-reward';
      r.innerHTML = '<span class="mdi mdi-lock-open-variant-outline" aria-hidden="true"></span>'
        + 'Doing this unlocks <b>' + esc(c.reward) + '</b> — you cannot buy it with Stars.';
      body.appendChild(r);
    }
    cell.appendChild(body);

    const foot = document.createElement('div'); foot.className = 'yt-foot';
    const openCode = document.createElement('button'); openCode.type = 'button';
    openCode.className = 'btn btn-secondary';
    openCode.innerHTML = '<span class="mdi mdi-code-tags" aria-hidden="true"></span>Open my game';
    openCode.addEventListener('click', function () { switchView('code'); });
    const status = document.createElement('span'); status.className = 'yt-status'; status.setAttribute('aria-live', 'polite');
    const mark = document.createElement('button'); mark.type = 'button';
    mark.className = 'btn btn-primary-role yt-done';
    mark.innerHTML = '<span class="mdi mdi-check" aria-hidden="true"></span>I’ve done this';

    function settle() {
      status.className = 'yt-status ok';
      status.innerHTML = '<span class="mdi mdi-check-circle" aria-hidden="true"></span>Done in your game';
      mark.disabled = true; mark.hidden = true;
    }
    if (done) settle();
    mark.addEventListener('click', function () { settle(); resolveActivity(key); });

    foot.appendChild(openCode); foot.appendChild(status); foot.appendChild(mark);
    cell.appendChild(foot);
    pre.parentNode.replaceChild(cell, pre);
  });
}

const MODULE_HERO = ['#143561', '#2f2a6b', '#1f5b63', '#5b3320', '#1f6b45', '#6b2a52', '#26456b', '#4a6b26', '#6b5320', '#33305b'];
const MODULE_ACCENT = ['#3e8fd6', '#8b7cff', '#2fd0b6', '#f5820a', '#3ddc84', '#ff6b9d', '#59a5ff', '#a3d94a', '#f5b02e', '#7c9cff'];
function moduleHero(mi) { return MODULE_HERO[mi % MODULE_HERO.length]; }
function moduleAccent(mi) { return MODULE_ACCENT[mi % MODULE_ACCENT.length]; }
/* Lesson bodies are fetched on demand now, so this has two halves: the part that must happen
   immediately (the outline highlight and the tab switch — a click has to feel answered) and the
   part that needs the body. `token` guards against a student clicking three lessons quickly: only
   the newest request is allowed to paint, so a slow earlier fetch cannot land on top of it. */
let lessonToken = 0;
function selectLesson(idx) {
  curIdx = idx; const f = flat[idx];
  const token = ++lessonToken;
  $('crumb').dataset.lesson = f.m.name + ': ' + f.l.t;
  cancelAdvance();
  renderOutline(); switchView('learn');
  lessonBody(f.l).then(function (html) {
    if (token !== lessonToken) return;   // they moved on; this is a stale answer
    paintLesson2(f, html);
  });
}
function paintLesson2(f, html) {
  $('lessonBody').innerHTML = lessonBodyHTML(f, html);
  $('lessonBody').style.setProperty('--mod', moduleHero(f.mi));
  currentLessonText = ($('lessonBody').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
  resetWidgetHandlers();   // the previous lesson's widget iframes are gone with the innerHTML
  beginLessonWidgets(f.id);
  renderRunCells($('lessonBody'));
  renderQuizCells($('lessonBody'));
  renderChallengeCells($('lessonBody'));
  renderYourTurnCells($('lessonBody'));
  paintLesson($('lessonBody'));
  applyAIMode(f.l.ai);
  startLessonProgress(f);
  prefetchNextLesson(curIdx);
}

/* ---------- finishing a lesson ----------
   There is no "Complete lesson" button any more. A lesson finishes when its work is finished:
   every quiz answered, every goal-checked run cell met, every challenge won. A lesson with none
   of those to offer finishes once the student has actually reached the end of it and stayed a
   while. The button was always clickable from the moment the page loaded, which taught a child
   in lesson one that the questions were decoration. */
let lessonPlan = { keys: [], total: 0, dwellTimer: null, dwellSeen: false };
const DWELL_MS = 20000;

function lessonActivityKeys() {
  const keys = [];
  for (let i = 0; i < widgetSeq.q; i++) keys.push('q' + i);
  for (let i = 0; i < widgetSeq.c; i++) keys.push('c' + i);
  for (let i = 0; i < widgetSeq.y; i++) keys.push('y' + i);
  // only run cells with an @expect goal can be "finished"; the rest are for tinkering
  goalRunKeys.forEach(function (k) { keys.push(k); });
  return keys;
}
function startLessonProgress(f) {
  cancelAdvance();
  clearInterval(lessonPlan.dwellTimer);
  lessonPlan = { keys: lessonActivityKeys(), total: 0, dwellTimer: null, dwellSeen: false };
  lessonPlan.total = lessonPlan.keys.length;
  renderLessonProgress(f);
  if (!lessonPlan.total && !state.done[f.id]) watchDwell(f);
}
function activityProgress() {
  const done = lessonActivities(flat[curIdx] ? flat[curIdx].id : '');
  let n = 0; lessonPlan.keys.forEach(function (k) { if (done[k]) n++; });
  return n;
}
/* Called by every widget the moment its work is genuinely finished. */
function resolveActivity(key) {
  const f = flat[curIdx]; if (!f) return;
  markActivity(f.id, key);
  renderLessonProgress(f);
  if (lessonPlan.total && activityProgress() >= lessonPlan.total) completeLesson();
}
/* Reading lessons: finish on reaching the end and staying there. The timer only runs while the
   tab is actually visible, so parking the lesson in a background tab does not count. */
function watchDwell(f) {
  const content = $('lessonBody').querySelector('.lesson-content');
  if (!content) return;
  const end = document.createElement('div'); end.className = 'lesson-end-sentinel';
  content.appendChild(end);
  let elapsed = 0, last = 0;
  // The tick outlives a lesson switch by up to half a second, and would otherwise write this
  // lesson's reading progress into the next lesson's strip.
  const stillHere = function () { return flat[curIdx] === f; };
  /* Measured directly rather than with an IntersectionObserver. IO callbacks are delivered as
     part of the rendering steps, so a client that isn't painting never gets one — and with the
     Complete button gone, a reading lesson whose observer stays silent can never be finished at
     all. A rect read on a timer that is already running has no such dependency. */
  const atEnd = function () {
    const r = end.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || 0);
  };
  const tick = function () {
    if (!stillHere()) return;
    const seen = atEnd();
    if (seen !== lessonPlan.dwellSeen) { lessonPlan.dwellSeen = seen; if (!seen) last = 0; }
    if (document.visibilityState !== 'visible' || !seen) { last = 0; return; }
    const now = Date.now(); if (last) elapsed += now - last; last = now;
    if (elapsed >= DWELL_MS) { clearInterval(lessonPlan.dwellTimer); completeLesson(); return; }
    renderLessonProgress(f, Math.min(1, elapsed / DWELL_MS));
  };
  lessonPlan.dwellTimer = setInterval(tick, 500);
}
/* ---------- moving on ----------
   After a lesson lands, the next one comes to the student rather than making them go find it in
   the sidebar. It is announced and cancellable: silently navigating away from what someone just
   earned is worse than making them click. */
let advanceTimer = null;
const ADVANCE_MS = 3000;
function cancelAdvance() { clearInterval(advanceTimer); advanceTimer = null; }
function startAdvance(f) {
  cancelAdvance();
  const nextIdx = curIdx + 1;
  if (!flat[nextIdx]) return;                 // last lesson in the course — nowhere to go
  /* Measured against the clock, not by counting ticks: setInterval is throttled in a background
     or unpainted tab, and a countdown that says 4s while 13s have passed is just wrong. */
  let elapsed = 0, last = 0;
  renderLessonProgress(f, 0, Math.ceil(ADVANCE_MS / 1000));
  advanceTimer = setInterval(function () {
    if (flat[curIdx] !== f) { cancelAdvance(); return; }        // they navigated themselves
    if (document.visibilityState !== 'visible') { last = 0; return; }   // not behind their back
    const now = Date.now(); if (last) elapsed += now - last; last = now;
    if (elapsed >= ADVANCE_MS) { cancelAdvance(); selectLesson(nextIdx); return; }
    renderLessonProgress(f, 0, Math.ceil((ADVANCE_MS - elapsed) / 1000));
  }, 250);
}

function completeLesson() {
  const f = flat[curIdx]; if (!f || state.done[f.id]) return;
  clearInterval(lessonPlan.dwellTimer);
  state.done[f.id] = true; state.xp += f.l.xp; toast('Lesson complete!  +' + f.l.xp + ' XP');
  const allDone = course.modules[f.mi].lessons.every(function (l, li) { return state.done[f.mi + '.' + li]; });
  if (allDone && !state.modDone[f.mi]) { state.modDone[f.mi] = true; state.stars += course.modules[f.mi].stars; setTimeout(function () { toast('Module complete: ' + course.modules[f.mi].name + '!  +' + course.modules[f.mi].stars + ' ★'); }, 900); }
  saveState();
  /* Announce it and stop caring who is listening. Everything that has to react to a finished
     lesson — the outline tick, the progress strip, the countdown to the next one — subscribes in
     wireLessonEvents() below instead of being named here.

     Note what this function no longer does: call selectLesson(). That used to rebuild the lesson
     from scratch and wipe every answer and run-cell edit at the exact moment the student earned
     the reward. Nothing here touches the screen at all now. */
  emit(EV.LESSON_DONE, { id: f.id, xp: f.l.xp, moduleIndex: f.mi, lesson: f });
  if (allDone && state.modDone[f.mi]) emit(EV.MODULE_DONE, { moduleIndex: f.mi, stars: course.modules[f.mi].stars });
}

/* Who reacts to a finished lesson. Registered once, at load, so the list of consequences is
   readable in one place rather than scattered through whatever function happened to trigger it. */
function wireLessonEvents() {
  on(EV.LESSON_DONE, function (d) { renderLessonProgress(d.lesson); });   // the reward, in place
  on(EV.LESSON_DONE, function () { renderOutline(); });                   // tick the row, unlock the next
  on(EV.LESSON_DONE, function (d) { startAdvance(d.lesson); });           // offer the next lesson
  on(EV.PROGRESS_CHANGED, function () { renderFooter(); });               // XP bar, stars, level
}
wireLessonEvents();
