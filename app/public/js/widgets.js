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
/* The YAML inside a widget fence. A parse failure used to be swallowed silently and the widget
   built from an empty object — which renders a card with a heading, no question and no options,
   looking merely sparse rather than broken. Three quiz blocks and two your-turn steps shipped
   that way. It still degrades rather than throwing (one bad block must not take the lesson down)
   but it now says so, so the person authoring the lesson finds out while they are writing it.
   `npm test` catches the same thing ahead of time — see tools/check-lessons.js. */
function parseWidgetYaml(kind, text, key) {
  try {
    const v = jsyaml.load(text);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    console.warn('[league] ' + kind + ' ' + (key || '?') + ' is empty or is not a set of keys — it will render with nothing in it.');
    return {};
  } catch (e) {
    console.warn('[league] ' + kind + ' ' + (key || '?') + ' has YAML that does not parse, so it will render empty: '
      + String(e.message).split('\n')[0]
      + '\n  A value starting with ` or " or containing ": " has to be wrapped in quotes.');
    return {};
  }
}

/* The question itself. Authored as `question:`; the v1 course used `prompt:` and both are
   accepted, because a renamed key that only the renderer knows about is how all 44 quizzes in
   the course came to display the words "Quick check" instead of anything a student could answer.
   One place to read it from, so a third name can never quietly become a fifth bug. */
function quizPrompt(q) {
  const p = (q && (q.question || q.prompt));
  return typeof p === 'string' && p.trim() ? p.trim() : '';
}

/* ```quiz  (provisional syntax) — types: mcq | predict | parsons | fillblank | findbug. All checked locally. */
function renderQuizCells(root) {
  const codes = [].slice.call(root.querySelectorAll('pre > code.language-quiz'));
  const total = codes.length;
  codes.forEach(function (code, idx) {
    const pre = code.parentNode;
    const key = nextWidgetKey('q');
    const q = parseWidgetYaml('quiz', code.textContent, key);

    const cell = document.createElement('div'); cell.className = 'quizcell'; cell.setAttribute('role', 'group');

    // Header: the question is the strongest thing in the card, with its place in the lesson.
    const head = document.createElement('div'); head.className = 'quiz-h';
    const qText = document.createElement('div'); qText.className = 'quiz-q';
    qText.innerHTML = '<span class="mdi mdi-help-circle-outline"></span>';
    qText.appendChild(document.createTextNode(quizPrompt(q) || 'Quick check'));
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
  list.setAttribute('aria-label', quizPrompt(q) || 'Answer options');

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
  input.setAttribute('aria-label', quizPrompt(q) || 'Fill in the blank');
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
  wrap.setAttribute('role', 'radiogroup'); wrap.setAttribute('aria-label', quizPrompt(q) || 'Which line has the bug?');
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

/* ---------- launcher in the lesson, working surface in its own window ----------
   The lab used to live inside the lesson column, which is about 760px on a school Chromebook and
   424px on a smaller screen. Code beside a running game does not fit there, and a big editor
   embedded mid-lesson interrupts the reading either way. So the lesson keeps a card that says what
   the lab is and opens it; the lab itself takes the whole stage.

   Going somewhere and coming back is also the point, not a side effect: it marks the lab as a
   thing you do rather than more of the page you were reading, and returning marks it finished.

   The card is a launcher only — the editor and the frame are built when the lab opens and thrown
   away when it closes. Nothing is moved between the two, which avoids a whole class of bug (an
   iframe reloads when it changes parent, a CodeMirror instance needs measuring again), and it
   costs nothing because the code was always saved through the activity ledger anyway. */
let openLabRef = null;          // the lab on screen, or null
let labReturnFocus = null;      // what gets focus back when it closes
let labPendingAdvance = null;   // a lesson that finished while the bench was open

/* The document a lab runs in. Deliberately tiny: a 300x200 canvas, its 2D context, and win().
   No game engine and no owned artwork — which is what lets a lab appear in modules before Phaser
   is introduced, and lets tools/check-challenges.js run all 22 of them without a browser. A lab
   that runs a real Phaser game needs the harness startGame() builds AND a browser to check it in;
   see Stage 2 in .claude/plans/STAGES.md for why that is reserved for a handful of authored ones. */
/* console.log inside a lab used to go nowhere. That is a strange thing to withhold from a student
   in a lesson about reading errors — printing a value to see what it actually is IS the technique
   being taught. Every log, warning and error now travels out to the bench's own console.
   Runs before the student's code, so a log on the very first line is caught. */
function labConsoleShim(tok) {
  return '<' + 'script>(function(){'
    + 'function f(a){return [].slice.call(a).map(function(v){'
    + 'if(typeof v==="string")return v;try{return JSON.stringify(v);}catch(e){return String(v);}'
    + '}).join(" ");}'
    + 'function s(l,a){try{parent.postMessage({__cm:true,tok:"' + tok + '",log:{level:l,text:f(a)}},"*");}catch(e){}}'
    + 'var c=console;["log","info","debug","warn","error"].forEach(function(n){'
    + 'var o=c[n]?c[n].bind(c):function(){};'
    + 'c[n]=function(){o.apply(c,arguments);s(n==="warn"?"warn":(n==="error"?"error":"log"),arguments);};});'
    + '})();<' + '/script>';
}

/* A lab draws in a 300x200 coordinate space — that is the authored contract, every lab uses those
   literals, and tools/check-challenges.js stubs `canvas` as exactly that.
   The picture is much bigger than 300x200 on screen, so the canvas ELEMENT is three times that and
   the context is pre-scaled to match. Everything the student writes still uses 300x200, and the
   result is crisp at full size instead of a 300px bitmap smeared across 900px.
   `canvas` is handed over as a small stand-in reporting the logical size, so `canvas.width` is 300
   in the browser AND 300 in the offline checker. One truth in both places — a mismatch there is
   exactly the kind of gap that hid a blank lab for three commits. */
const LAB_W = 300, LAB_H = 200, LAB_SCALE = 3;

function labDoc(tok, userCode) {
  const safe = String(userCode).replace(/<\/(script)/gi, '<\\/$1');
  return '<!doctype html><body style="margin:0;background:#0d2137;overflow:hidden">'
    + '<canvas id="c" width="' + (LAB_W * LAB_SCALE) + '" height="' + (LAB_H * LAB_SCALE) + '"'
    + ' style="width:100%;height:100vh;display:block"></canvas>'
    + labConsoleShim(tok)
    + '<scr' + 'ipt>var __el=document.getElementById("c"),ctx=__el.getContext("2d");'
    + 'ctx.scale(' + LAB_SCALE + ',' + LAB_SCALE + ');'
    + 'var canvas={width:' + LAB_W + ',height:' + LAB_H + ',getContext:function(){return ctx;}};'
    + 'var __w=false;function win(){if(__w)return;__w=true;try{parent.postMessage({__cm:true,tok:"' + tok + '",win:true},"*");}catch(e){}}window.onerror=function(m){try{parent.postMessage({__cm:true,tok:"' + tok + '",err:String(m)},"*");}catch(e){}};try{\n' + safe + '\n}catch(e){window.onerror(e.message);}<\/scr' + 'ipt></body>';
}

/* ---------- the bench console ----------
   Same markup, classes and behaviour as the game console under the Play tab, so a student meets
   one console in this app rather than two that behave differently. Identical consecutive lines are
   counted rather than repeated, because a log inside an animation frame fires sixty times a second
   and would otherwise be the entire log. */
const LAB_LOG_MAX = 80;
let labLog = [];
/* Set when the student collapses the log themselves. Output opens the log — printing a value to
   see what it is is the whole technique, and a badge they have to notice and click is not seeing
   it. But once they have deliberately closed it, it stays closed for anything short of an error. */
let labConsoleShut = false;

function labConsoleClear() {
  labLog = [];
  const b = $('labConBody');
  if (b) b.innerHTML = '<div class="cl cl-empty">Anything your code prints appears here.</div>';
  labConsoleCount();
}
function labConsoleCount() {
  const el = $('labConCount'); if (!el) return;
  const box = $('labConsole');
  const collapsed = box && box.classList.contains('collapsed');
  const n = labLog.reduce(function (t, l) { return t + l.n; }, 0);
  el.textContent = (collapsed && n) ? n + (n === 1 ? ' line' : ' lines') : '';
}
function labConsoleOpen(open) {
  const box = $('labConsole'); if (!box) return;
  box.classList.toggle('collapsed', !open);
  labConsoleCount();
}
function labConsoleLine(level, text) {
  const lvl = ['log', 'warn', 'error'].indexOf(level) >= 0 ? level : 'log';
  const last = labLog[labLog.length - 1];
  if (last && last.level === lvl && last.text === text) {
    last.n++;
    if (last.el) last.el.textContent = text + '   (' + last.n + '×)';
  } else {
    const body = $('labConBody'); if (!body) return;
    const empty = body.querySelector('.cl-empty'); if (empty) empty.remove();
    const d = document.createElement('div');
    d.className = 'cl' + (lvl === 'error' ? ' err' : (lvl === 'warn' ? ' warn' : ''));
    d.textContent = text;                                  // whatever the student's code printed
    body.appendChild(d); body.scrollTop = body.scrollHeight;
    labLog.push({ level: lvl, text: text, n: 1, el: d });
    if (labLog.length > LAB_LOG_MAX) {
      const gone = labLog.shift();
      if (gone.el && gone.el.parentNode) gone.el.parentNode.removeChild(gone.el);
    }
  }
  // An error always opens the log; ordinary output opens it unless they closed it on purpose.
  if (lvl === 'error' || !labConsoleShut) labConsoleOpen(true);
  labConsoleCount();
}

function labSave(lab, patch) { saveLabState(lab.lessonId, lab.key, patch); }

/* What the card in the lesson says. Never "you have not started this" — a lab is not homework. */
function paintLabCard(lab) {
  const k = lab.card; if (!k) return;
  k.done.hidden = !lab.solved;
  if (lab.solved) {
    k.done.innerHTML = '<span class="mdi mdi-check-circle" aria-hidden="true"></span>'
      + (lab.revealed ? 'Working — you read the answer' : 'Fixed it!');
  }
  const label = lab.solved ? 'Open it again'
    : (lab.touched || lab.fails ? 'Carry on with the lab' : 'Start the lab');
  k.open.innerHTML = '<span class="mdi ' + (lab.solved ? 'mdi-flask-outline' : 'mdi-play') + '" aria-hidden="true"></span>' + label;
}

/* Running first, then an error, then solved — so re-running a lab that already works shows
   "Running…" and settles back to "Fixed it!" instead of looking like nothing happened. */
function paintLabStatus(lab) {
  const el = $('labStatus'); if (!el || openLabRef !== lab) return;
  if (lab.running) { el.className = 'lab-status'; el.textContent = 'Running…'; return; }
  /* The most common outcome for a lab that is still broken: it ran, it threw nothing, and it did
     not win. Saying so is the honest answer. Before this the status simply read "Running…" and
     stayed there, which reads as the app having hung rather than as the code not working yet. */
  if (lab.settled && !lab.solved) {
    el.className = 'lab-status no';
    el.textContent = 'It ran, but the goal is not met yet — read what it does and try again.';
    return;
  }
  if (lab.error) {
    // textContent, not innerHTML: this string is whatever the student's own code threw.
    el.className = 'lab-status no';
    el.textContent = 'Error: ' + lab.error;
    return;
  }
  if (lab.solved) {
    el.className = 'lab-status ok';
    el.innerHTML = '<span class="mdi mdi-check-circle" aria-hidden="true"></span>'
      + (lab.revealed ? 'Working — now you have seen why.' : 'Fixed it!');
    return;
  }
  el.className = 'lab-status'; el.textContent = '';
}

/* ---------- getting stuck ----------
   The same shape as the quiz retry rule the student already knows: a nudge after the first
   failure, the answer offered after several. Twenty minutes stuck is not perseverance, it is a
   child who has stopped learning and needs a door. */
function labShowHint(lab) {
  const ui = lab.ui; if (!ui || ui.hintEl || !lab.c.hint) return;
  const el = document.createElement('p'); el.className = 'ch-hint';
  el.innerHTML = '<span class="mdi mdi-lightbulb-on-outline" aria-hidden="true"></span><span>' + inlineMd(lab.c.hint) + '</span>';
  ui.brief.appendChild(el); ui.hintEl = el;
}
function labOfferSolution(lab) {
  const ui = lab.ui; if (!ui || ui.solveEl || !lab.c.solution) return;
  const wrap = document.createElement('div'); wrap.className = 'ch-solve';
  const p = document.createElement('p');
  p.textContent = 'Stuck on this one? You can put the working version in and read it instead.';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary';
  b.textContent = 'Show me the working version';
  b.addEventListener('click', function () {
    ui.write(lab.c.solution);
    lab.code = lab.c.solution; lab.revealed = true; lab.touched = true;
    labSave(lab, { revealed: true, code: lab.code });
    wrap.innerHTML = '<p class="ch-solve-done">Here it is. Read it, run it, and see what it does '
      + 'differently — that is the bit worth remembering.</p>';
  });
  wrap.appendChild(p); wrap.appendChild(b);
  ui.brief.appendChild(wrap); ui.solveEl = wrap;
}
function labFail(lab) {
  lab.fails++;
  if (lab.ui) lab.code = lab.ui.read();
  labSave(lab, { fails: lab.fails, code: lab.code });
  if (lab.fails >= LAB_HINT_AFTER) labShowHint(lab);
  if (lab.fails >= LAB_REVEAL_AFTER && !lab.revealed) labOfferSolution(lab);
}

/* The dialog claims to be modal, so it has to actually be modal — otherwise everything behind it
   is still reachable by Tab and still announced, and a student using the keyboard falls out of the
   bench into a lesson they cannot see. `inert` does this without a hand-written focus trap. */
function labIsolate(on) {
  ['.topbar', '#editor', '#page', '.statusbar'].forEach(function (sel) {
    const el = document.querySelector(sel);
    if (el && 'inert' in el) el.inert = on;
  });
}

function openLab(lab) {
  const view = $('labView'); if (!view) return;
  if (openLabRef) closeLab();
  openLabRef = lab;
  labReturnFocus = (lab.card && lab.card.open) || null;

  $('labTitle').textContent = lab.c.title || 'Lab';

  const brief = $('labBrief'); brief.innerHTML = '';
  if (lab.c.task) {
    const t = document.createElement('div'); t.className = 'ch-task';
    t.innerHTML = inlineMd(lab.c.task); brief.appendChild(t);
  }

  const screen = $('labScreen'); screen.innerHTML = '';
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');       // opaque origin: lab code cannot reach the app
  frame.setAttribute('title', 'Lab output');
  screen.appendChild(frame);

  labConsoleClear();
  labConsoleOpen(false);

  const host = $('labEditor'); host.innerHTML = '';
  let editor = null, ta = null;
  if (typeof CodeMirror === 'function') {
    /* The gutters are declared up front even though the addons that fill them arrive later —
       CodeMirror needs the gutter to exist before foldGutter or the lint markers can use it. Same
       reasoning as the Code tab's editor in js/editor.js. */
    editor = CodeMirror(host, {
      value: lab.code, mode: 'javascript', theme: 'material-darker',
      lineNumbers: true, tabSize: 2, indentUnit: 2, matchBrackets: true, autoCloseBrackets: true,
      gutters: ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      extraKeys: {
        'Ctrl-Enter': function () { labRun(); }, 'Cmd-Enter': function () { labRun(); },
        'Ctrl-Space': 'autocomplete',
        'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
        'Ctrl-F': 'findPersistent', 'Cmd-F': 'findPersistent'
      }
    });
    const cursor = $('labCursor');
    if (cursor) {
      const showPos = function (cm) {
        const p = cm.getCursor();
        cursor.textContent = 'Ln ' + (p.line + 1) + ', Col ' + (p.ch + 1);
      };
      editor.on('cursorActivity', showPos); showPos(editor);
    }
    // Suggest as you type, the same way the Code tab does.
    editor.on('inputRead', function (cm, e) {
      if (e.text && /[\w.]/.test(e.text[0]) && !cm.state.completionActive && CodeMirror.hint && CodeMirror.hint.anyword) {
        cm.showHint({ hint: CodeMirror.hint.anyword, completeSingle: false });
      }
    });
  } else {
    ta = document.createElement('textarea'); ta.className = 'ch-code';
    ta.spellcheck = false; ta.value = lab.code; host.appendChild(ta);
  }

  lab.ui = {
    frame: frame, brief: brief, editor: editor, hintEl: null, solveEl: null,
    read: function () { return editor ? editor.getValue() : ta.value; },
    write: function (v) { if (editor) editor.setValue(v); else ta.value = v; }
  };
  const keep = function () { lab.code = lab.ui.read(); lab.touched = true; labSave(lab, { code: lab.code }); };
  if (editor) editor.on('blur', keep); else ta.addEventListener('blur', keep);

  /* The linter, the folding, the search dialog and the hint addons are about 2 MB and do not load
     at boot (js/lazy.js). The bench opens immediately with a plain editor and upgrades in place
     when they arrive — a lab about reading an error deserves the same squiggles as the Code tab,
     but not at the cost of waiting for them. A failure here leaves a working editor, because being
     unable to lint is much better than being unable to type. */
  if (editor && typeof loadCodeTools === 'function') {
    loadCodeTools().then(function () {
      if (openLabRef !== lab || !lab.ui || lab.ui.editor !== editor) return;   // they left already
      editor.setOption('styleActiveLine', true);
      editor.setOption('foldGutter', true);
      if (typeof LINT_OPTS !== 'undefined') editor.setOption('lint', LINT_OPTS);
      editor.refresh();
    }).catch(function (e) {
      console.warn('[league] the lab editor is running without its extras:', e.message);
    });
  }

  // Anything already earned is on screen before the first run, not re-earned.
  if (lab.fails >= LAB_HINT_AFTER) labShowHint(lab);
  if (lab.fails >= LAB_REVEAL_AFTER && !lab.revealed) labOfferSolution(lab);

  view.hidden = false;
  labIsolate(true);
  updateFab();
  paintLabStatus(lab);
  // The editor gets focus: it is what the student came here to do, and the task is right above it.
  if (editor) { editor.refresh(); editor.focus(); } else if (ta) ta.focus();
}

function closeLab() {
  const lab = openLabRef; if (!lab) return;
  clearTimeout(lab.settleTimer);
  if (lab.ui) { lab.code = lab.ui.read(); labSave(lab, { code: lab.code }); }
  lab.ui = null; lab.running = false; lab.error = ''; lab.settled = false;
  openLabRef = null;

  $('labEditor').innerHTML = '';
  $('labScreen').innerHTML = '';        // drops the frame, which stops whatever it was running
  $('labBrief').innerHTML = '';
  labConsoleClear();
  labConsoleOpen(false);
  $('labView').hidden = true;
  labIsolate(false);
  updateFab();
  paintLabCard(lab);

  if (labReturnFocus) { try { labReturnFocus.focus(); } catch (e) {} }
  labReturnFocus = null;

  /* A lab can be the last thing a lesson needed. The move to the next lesson waits until the
     student is back looking at the lesson, rather than happening behind the bench. */
  if (labPendingAdvance) { const f = labPendingAdvance; labPendingAdvance = null; startAdvance(f); }
}

function labRun() {
  const lab = openLabRef; if (!lab || !lab.ui) return;
  /* When does a run count as failed? Not "did it win within 900ms" — one lab animates a ship
     across the screen and needs about 1.4 seconds, so that question marked a CORRECT answer as a
     failure. A run counts as failed when the student runs AGAIN without having won in between:
     honest, and it can never mislabel a slow success. A thrown error counts straight away. */
  if (lab.attemptOpen) labFail(lab);
  lab.attemptOpen = true;
  lab.running = true; lab.error = ''; lab.settled = false;
  lab.code = lab.ui.read(); lab.touched = true;
  labSave(lab, { code: lab.code });
  paintLabStatus(lab);
  // Each run starts with a clean log, so what is on screen belongs to the run being looked at.
  labConsoleClear();
  lab.ui.frame.srcdoc = labDoc(lab.tok, lab.code);

  /* Long enough that a slow-but-correct lab is never called unfinished — one of these animates a
     ship across the screen and takes about 1.4 seconds to win. This only changes what the status
     line says; whether a run counts as FAILED is still decided by the student running again. */
  clearTimeout(lab.settleTimer);
  lab.settleTimer = setTimeout(function () {
    if (openLabRef !== lab || !lab.running) return;
    lab.running = false; lab.settled = true;
    paintLabStatus(lab);
  }, 2200);
}

function labResetToStart() {
  const lab = openLabRef; if (!lab || !lab.ui) return;
  lab.ui.write(lab.startCode);
  lab.code = lab.startCode;
  clearTimeout(lab.settleTimer);
  lab.fails = 0; lab.revealed = false; lab.attemptOpen = false;
  lab.running = false; lab.error = ''; lab.settled = false; lab.touched = false;
  if (lab.ui.hintEl) { lab.ui.hintEl.remove(); lab.ui.hintEl = null; }
  if (lab.ui.solveEl) { lab.ui.solveEl.remove(); lab.ui.solveEl = null; }
  lab.ui.frame.removeAttribute('srcdoc');
  labConsoleClear();
  clearLabState(lab.lessonId, lab.key);
  paintLabStatus(lab);
  toast('Example reset.');
}

if ($('labRun')) $('labRun').addEventListener('click', labRun);
if ($('labReset')) $('labReset').addEventListener('click', labResetToStart);
if ($('labBack')) $('labBack').addEventListener('click', closeLab);
if ($('labConToggle')) $('labConToggle').addEventListener('click', function () {
  const opening = $('labConsole').classList.contains('collapsed');
  labConsoleShut = !opening;              // closing it by hand is a preference, and it sticks
  labConsoleOpen(opening);
});
if ($('labConClear')) $('labConClear').addEventListener('click', labConsoleClear);
labConsoleClear();
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && openLabRef) { closeLab(); e.preventDefault(); }
});

function renderChallengeCells(root) {
  root.querySelectorAll('pre > code.language-challenge').forEach(function (code) {
    const pre = code.parentNode;
    const key = nextWidgetKey('c'), tok = widgetToken(key);
    const c = parseWidgetYaml('challenge', code.textContent, key);
    const lessonId = lessonWidgetId;
    const saved = labState(lessonId, key) || {};
    const startCode = c.code || '';

    /* Everything about this lab in one object, so the card in the lesson and the full-window
       bench are two views of the same thing and cannot drift apart. */
    const lab = {
      c: c, key: key, tok: tok, lessonId: lessonId,
      startCode: startCode,
      code: typeof saved.code === 'string' ? saved.code : startCode,
      fails: saved.fails || 0,
      revealed: !!saved.revealed,
      solved: activityDone(lessonId, key),
      touched: typeof saved.code === 'string' && saved.code !== startCode,
      running: false, error: '', attemptOpen: false,
      ui: null, card: null
    };

    /* Classes are ch-*, not cm-*: the lesson root carries CodeMirror's `cm-s-material-darker`
       theme class, and a widget naming its own parts cm-anything is one rename from colliding. */
    const cell = document.createElement('div'); cell.className = 'challenge-mini';

    const head = document.createElement('div'); head.className = 'ch-head';
    head.innerHTML = '<span class="mdi mdi-flask-outline" aria-hidden="true"></span>'
      + '<span class="ch-title">' + esc(c.title || 'Lab') + '</span>';
    cell.appendChild(head);

    const bodyEl = document.createElement('div'); bodyEl.className = 'ch-body'; cell.appendChild(bodyEl);

    /* Said once, here, where the student is deciding whether to click. It used to be repeated in
       the bench's own header too, which was one reminder too many — the bench is titled "Lab" and
       has Reset in plain sight, so it does not need telling twice. */
    const note = document.createElement('p'); note.className = 'ch-note';
    note.innerHTML = '<span class="mdi mdi-information-outline" aria-hidden="true"></span>'
      + '<span>The course’s example, not your game — break it as much as you like.</span>';
    bodyEl.appendChild(note);

    if (c.task) { const t = document.createElement('div'); t.className = 'ch-task'; t.innerHTML = inlineMd(c.task); bodyEl.appendChild(t); }

    const bar = document.createElement('div'); bar.className = 'ch-foot ch-launch';
    const done = document.createElement('span'); done.className = 'ch-solved'; done.hidden = true;
    const open = document.createElement('button'); open.type = 'button';
    open.className = 'btn btn-primary-role ch-open';
    bar.appendChild(done); bar.appendChild(open);
    cell.appendChild(bar);

    lab.card = { done: done, open: open };
    paintLabCard(lab);
    open.addEventListener('click', function () { openLab(lab); });

    /* One handler per lab, registered once. It updates the lab's own state either way, so the
       card is correct whether or not the bench happens to be open when the message arrives. */
    widgetHandlers[tok] = function (d) {
      if (!d.__cm) return;
      // Only the bench has a console, so a log arriving for a lab that is not open is dropped.
      if (d.log) { if (openLabRef === lab) labConsoleLine(d.log.level, String(d.log.text || '')); return; }
      if (d.win) {
        clearTimeout(lab.settleTimer);
        lab.attemptOpen = false; lab.running = false; lab.error = ''; lab.settled = false;
        lab.solved = true;
        if (lab.ui) lab.code = lab.ui.read();
        labSave(lab, { code: lab.code });
        paintLabStatus(lab); paintLabCard(lab);
        resolveActivity(lab.key);
      } else if (d.err) {
        clearTimeout(lab.settleTimer);
        lab.attemptOpen = false; lab.running = false; lab.settled = false;
        lab.error = String(d.err).slice(0, 300);
        // In the log as well as on the status line: the status line is the verdict, the log is the
        // record, and a student comparing two runs needs the record.
        if (openLabRef === lab) labConsoleLine('error', lab.error);
        labFail(lab);
        paintLabStatus(lab); paintLabCard(lab);
      }
    };

    pre.parentNode.replaceChild(cell, pre);
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
    const pre = code.parentNode;
    const key = nextWidgetKey('y');
    const c = parseWidgetYaml('yourturn', code.textContent, key);
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
    /* The reward line. It used to promise a badge that nothing in the app awarded, stored or
       displayed — the promise is kept now, and once it is kept the line says so rather than
       still telling a student about something they already have. */
    let rewardEl = null;
    function paintReward() {
      if (!rewardEl || !c.reward) return;
      const earned = hasBadge(c.reward);
      rewardEl.className = 'yt-reward' + (earned ? ' earned' : '');
      rewardEl.innerHTML = earned
        ? '<span class="mdi mdi-medal" aria-hidden="true"></span>Earned: <b>' + esc(c.reward) + '</b>'
        : '<span class="mdi mdi-lock-open-variant-outline" aria-hidden="true"></span>'
          + 'Doing this unlocks <b>' + esc(c.reward) + '</b> — you cannot buy it with Stars.';
    }
    if (c.reward) {
      rewardEl = document.createElement('p');
      body.appendChild(rewardEl);
      paintReward();
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
    mark.addEventListener('click', function () {
      settle();
      /* The badge before the activity: resolveActivity can complete the lesson, which starts the
         countdown to the next one, and the student should have been told what they earned before
         anything starts moving them along. */
      if (c.reward && awardBadge(c.reward, lessonId)) {
        paintReward();
        toast('Badge earned: ' + c.reward);
      }
      resolveActivity(key);
    });

    foot.appendChild(openCode); foot.appendChild(status); foot.appendChild(mark);
    cell.appendChild(foot);
    pre.parentNode.replaceChild(cell, pre);
  });
}

/* A clip of a real game loops on its own, which is right for showing what a mechanic feels like and
   wrong for a student who has asked their machine for less movement. Autoplay is an attribute, so it
   cannot be undone in CSS: the clip is stopped here and given controls, so it is still watchable by
   choice rather than simply gone. */
function calmClips(root) {
  if (!root || !window.matchMedia) return;
  let quiet = false;
  try { quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return; }
  if (!quiet) return;
  root.querySelectorAll('figure.clip video').forEach(function (v) {
    v.autoplay = false; v.loop = false; v.controls = true;
    try { v.pause(); } catch (e) {}
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
  /* Changing lesson tears down every widget in the old one, including the handler the open bench
     is talking to. Close it first rather than leaving it on screen wired to a lesson that is gone. */
  if (openLabRef) closeLab();
  labPendingAdvance = null;
  curIdx = idx; const f = flat[idx];
  revealModuleFor(idx);        // the module this lesson lives in opens; nothing else is touched
  // At a narrow width the outline is floating over the lesson. Picking one is the end of that job,
  // so it gets out of the way rather than sitting on top of what was just opened.
  if (typeof floatOpen !== 'undefined' && floatOpen === 'left') closeFloating();
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
  /* Start at the top. #view-learn is the thing that scrolls (the document itself never does), and
     nothing reset it — so reading to the bottom of a long lesson and clicking the next one landed
     the student part-way down it, past the title, with no clue they had missed anything. */
  const learn = $('view-learn'); if (learn) learn.scrollTop = 0;
  $('lessonBody').style.setProperty('--mod', moduleHero(f.mi));
  currentLessonText = ($('lessonBody').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
  resetWidgetHandlers();   // the previous lesson's widget iframes are gone with the innerHTML
  beginLessonWidgets(f.id);
  renderRunCells($('lessonBody'));
  renderQuizCells($('lessonBody'));
  renderChallengeCells($('lessonBody'));
  renderYourTurnCells($('lessonBody'));
  calmClips($('lessonBody'));
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
  /* Offer the next lesson — but not while the bench is open. Solving a lab can be the last thing
     a lesson needed, and moving the lesson on underneath the student takes the reward away from
     them before they have seen it. closeLab() picks this up when they come back. */
  on(EV.LESSON_DONE, function (d) {
    if (openLabRef) { labPendingAdvance = d.lesson; return; }
    startAdvance(d.lesson);
  });
  on(EV.PROGRESS_CHANGED, function () { renderFooter(); });               // XP bar, stars, level
}
wireLessonEvents();
