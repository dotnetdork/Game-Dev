/* quiz.js — the in-lesson questions, and the one retry model behind all five types.
 *
 * Moved out of widgets.js by the Phase 4 split in docs/architecture-audit-2026-09-15.md.
 *
 * Five shapes of question — multiple choice, predict, Parsons (drag the lines into order), fill in
 * the blank, find the bug — and every one of them resolves through quizVerdict(). That single
 * chokepoint is the reason a child gets the same deal whichever kind they meet: one explanation on
 * the first wrong answer, the answer itself on the second, and never a dead end. It is also what
 * made the session log possible, since one emit covers all five.
 *
 * Depends on blockHeader/blockSide/blockAction and inlineMd, which stay in widgets.js: they are
 * shared with labs, run cells and your-turn steps, and belong to the lesson rather than to quizzes.
 */
/* Authored lab titles read "Lab — the world that will not tick". The label carries "Lab" now, so
   the prefix would say it twice. Stripped here rather than edited across 22 files — the same
   approach as badge names losing their trailing "badge". */
function blockTitleOf(raw, kind) {
  let s = String(raw == null ? '' : raw).trim();
  s = s.replace(new RegExp('^' + kind + '\\s*(?:[\\u2014\\u2013:-]\\s*)?', 'i'), '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
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

    /* Which types need a button at all.
       Picking an option IS the answer, so for those the Check button was a second click that
       carried no information — you had already told it what you thought. Typing in a box and
       putting lines in order are different: there is no moment a program can call "the answer",
       because a half-typed word and a half-ordered list both look like an attempt. Those two keep
       a Check, and it goes in the header with every other block's action. */
    const type = q.type || 'mcq';
    const needsCheck = (type === 'parsons' || type === 'fillblank');
    const check = needsCheck ? blockAction('Check', '', 'secondary') : null;

    // Header: the question is the strongest thing in the card, with its place in the lesson.
    const head = blockHeader('Quiz', quizPrompt(q) || 'Quick check',
      total > 1 ? (idx + 1) + ' of ' + total : '', check);
    cell.appendChild(head);

    const body = document.createElement('div'); body.className = 'quiz-body'; cell.appendChild(body);

    const result = document.createElement('div'); result.className = 'quiz-result';
    result.setAttribute('aria-live', 'polite');

    const ctx = { q: q, key: key, cell: cell, head: head, body: body, check: check, attempts: 0, resolved: false };
    ctx.say = function (kind, msg) { result.className = 'quiz-result' + (kind ? ' ' + kind : ''); result.textContent = msg || ''; };

    if (type === 'parsons') buildParsons(q, body, ctx);
    else if (type === 'fillblank') buildFill(q, body, ctx);
    else if (type === 'findbug') buildFindBug(q, body, ctx);
    else buildMCQ(q, body, ctx, type === 'predict');

    body.appendChild(result);
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
/* `inline` says the card has already explained itself ON THE OPTION the student picked, so the line
   at the foot would be saying it twice.

   That is what it was doing. A wrong answer put the reason inside the option AND repeated it word
   for word underneath; a right answer got a green tick on the row and then "✓ Correct!" below, which
   is the tick again in words. Neither line carried anything the row did not already say, and the
   space under a question is the one place a child looks for something they have not read yet.

   What survives for an inline card is the reveal: after two wrong tries the whole-question `explain`
   goes there, because that is the one sentence that belongs to the question rather than to any one
   option. */
function quizVerdict(ctx, correct, wrongHint, reveal, inline) {
  if (ctx.resolved) return;
  /* Every quiz type funnels through here, and only real answers do — restoring a saved answer on
     reload goes straight to markQuizDone, so a reload cannot log yesterday's answers as today's.
     Which distractor catches people is a fact about the lesson, not about the child. */
  emit(EV.QUIZ_ANSWERED, {
    lesson: (flat[curIdx] && flat[curIdx].id) || '',
    key: ctx.key, kind: (ctx.q && ctx.q.type) || '',
    correct: !!correct, attempts: ctx.attempts + 1
  });
  if (correct) { if (!inline) ctx.say('ok', 'Correct!'); markQuizDone(ctx); return; }
  ctx.attempts++;
  if (ctx.attempts < 2) {
    if (!inline) ctx.say('no', wrongHint || 'Not quite — take another look.');
    if (ctx.check) ctx.check.textContent = 'Try again';
    return;
  }
  if (typeof reveal === 'function') reveal();
  if (inline) { if (ctx.q.explain) ctx.say('no', ctx.q.explain); }
  else ctx.say('no', ctx.q.explain ? "Here's the answer — " + ctx.q.explain : 'Here is the answer, highlighted above.');
  markQuizDone(ctx);
}

/* Resolved for good: lock the card, tick the header, and record it so the lesson can complete
   and so the answer survives a reload.
   ctx.check is null for the types where clicking an option checks it, so every touch of it is
   guarded — the whole point of those is that there is no button. */
function markQuizDone(ctx, restoring) {
  ctx.resolved = true;
  if (ctx.check) { ctx.check.disabled = true; ctx.check.textContent = 'Answered'; }
  ctx.cell.classList.add('answered');
  if (!ctx.head.querySelector('.block-tick')) {
    const tick = document.createElement('span'); tick.className = 'block-tick mdi mdi-check-circle';
    tick.title = 'Answered';
    blockSide(ctx.head).appendChild(tick);
  }
  if (restoring) { ctx.say('', ''); if (typeof ctx.restore === 'function') ctx.restore(); return; }
  resolveActivity(ctx.key);
}
function buildMCQ(q, body, ctx, isPredict) {
  if (isPredict && q.code) { const pc = document.createElement('pre'); pc.className = 'quiz-code'; pc.textContent = q.code; body.appendChild(pc); }
  /* The options are shuffled, so `right` is where the authored answer LANDED rather than what the
     author wrote. Per-option feedback rides along in the same order — it is indexed by option, so
     reordering one without the other would explain the wrong answer. */
  const opts0 = q.options || [], fb0 = q.feedback || [];
  const order = seededOrder(opts0.length, seedFrom(widgetToken(ctx.key)));
  const opts = order.map(function (i) { return opts0[i]; });
  const fb = order.map(function (i) { return fb0[i]; });
  const rows = [];
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
    row.addEventListener('click', function () { if (!ctx.resolved && !row.disabled) answer(i); });
    rows.push(row); list.appendChild(row);
  });
  body.appendChild(list);

  /* Picking IS answering. There is no select-then-confirm step: the click marks the row and checks
     it in the same motion. A wrong row is then disabled, so the two tries a student gets are two
     DIFFERENT answers rather than the same one twice. */
  function answer(i) {
    chosen = i;
    rows.forEach(function (r, n) { r.setAttribute('aria-checked', n === i ? 'true' : 'false'); });
    grade();
  }
  // Number keys answer directly, for the same reason the mouse does.
  ctx.cell.addEventListener('keydown', function (e) {
    if (ctx.resolved || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= rows.length && !rows[n - 1].disabled) { rows[n - 1].focus(); answer(n - 1); e.preventDefault(); }
  });

  /* The content authors per-option feedback that only ever appeared as one line at the bottom of
     the card. It belongs against the option it explains — INCLUDING the right one. Every correct
     option in this course is written "Right. It is a design decision you will change many times",
     so the sentence that says why the answer is right was already there and was only ever shown
     when the student got it wrong twice. A child who picks the right one first time is the one most
     able to use it. */
  function explainRow(i) {
    const row = rows[i]; if (!row || row.querySelector('.mcq-why') || !fb[i]) return;
    const why = document.createElement('span'); why.className = 'mcq-why'; why.textContent = fb[i];
    row.querySelector('.mcq-text').appendChild(why);
  }
  /* An authored answer outside the option list would shuffle to -1, which no click can ever equal —
     a question where every answer is wrong and nothing on screen says so. Say it out loud and fall
     back to the first option, because a wrong-but-answerable question costs a moment and an
     unanswerable one blocks the lesson from ever completing. */
  let right = order.indexOf(Number(q.answer));
  if (right < 0) {
    console.warn('[league] quiz ' + ctx.key + ' has answer: ' + q.answer + ' but only '
      + opts0.length + ' options, so no answer could ever be right. Falling back to the first one.');
    right = order.indexOf(0);
  }
  ctx.restore = function () {
    rows.forEach(function (r, i) { r.disabled = true; if (i === right) r.classList.add('correct'); });
    explainRow(right);                 // a reload shows what the card showed when it was answered
  };

  function grade() {
    if (ctx.resolved || chosen < 0) return;
    const ok = chosen === right;
    rows[chosen].classList.add(ok ? 'correct' : 'wrong');
    if (!ok) rows[chosen].disabled = true;
    explainRow(chosen);                // why, on the option itself, right or wrong
    quizVerdict(ctx, ok, fb[chosen] || 'Not quite — read that one again.', function () {
      rows[right].classList.add('correct');
      explainRow(right);
    }, true);
    if (ctx.resolved) rows.forEach(function (r) { r.disabled = true; });
  }
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
  lead.textContent = 'Click the line you think has the bug — that answers it.';
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
    // Clicking a line answers it, the same as picking an option in a multiple choice question —
    // which is what this is, with the code as the options.
    row.addEventListener('click', function () { if (!ctx.resolved && !row.disabled) grade(i); });
    wrap.appendChild(row);
  });
  body.appendChild(wrap);
  const right = Number(q.answer);
  ctx.restore = function () { rows.forEach(function (r, i) { r.disabled = true; if (i === right) r.classList.add('correct'); }); };

  function grade(i) {
    chosen = i;
    rows.forEach(function (r, n) { r.setAttribute('aria-checked', n === i ? 'true' : 'false'); });
    const ok = chosen === right;
    if (ok) { rows[chosen].classList.add('correct'); }
    else { rows[chosen].classList.add('wrong'); rows[chosen].disabled = true; }
    quizVerdict(ctx, ok, q.explain ? 'Not quite — ' + q.explain : 'Not quite — look at that line again.', function () {
      rows[right].classList.add('correct');
    });
    if (ctx.resolved) rows.forEach(function (r) { r.disabled = true; });
  }
}
