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
    const src = bodyLines.join('\n').replace(/^\n+/, '');
    const tok = 'rc' + Math.random().toString(36).slice(2, 9);
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
    const ta = document.createElement('textarea'); ta.value = src; ta.spellcheck = false; ta.rows = Math.min(16, Math.max(3, src.split('\n').length));
    const bar = document.createElement('div'); bar.className = 'runbar';
    const btn = document.createElement('button'); btn.className = 'runbtn'; btn.innerHTML = '<span class="mdi mdi-play"></span>Run';
    const status = document.createElement('span'); status.className = 'run-status';
    const out = document.createElement('iframe'); out.className = 'runout'; out.setAttribute('sandbox', 'allow-scripts');
    function buildDoc(userCode) {
      const prefix = sliders.map(function (s) { return 'const ' + s.name + ' = ' + sEls[s.name].value + ';'; }).join('\n');
      const safe = (prefix + '\n' + userCode).replace(/<\/(script)/gi, '<\\/$1');
      return '<!doctype html><body style="margin:0;font:12.5px Consolas,monospace;color:#cfe0f2;background:#08121f;padding:8px"><pre id="o" style="margin:0;white-space:pre-wrap"></pre><scr' + 'ipt>var o=document.getElementById("o");function w(){o.textContent+=[].slice.call(arguments).join(" ")+"\\n";}console.log=w;console.info=w;console.warn=w;console.error=function(){o.textContent+="\\u26a0 "+[].slice.call(arguments).join(" ")+"\\n";};try{\n' + safe + '\n}catch(e){o.textContent+="\\u26a0 "+e.message+"\\n";}try{parent.postMessage({__runcell:true,tok:"' + tok + '",text:o.textContent},"*");}catch(e){}</scr' + 'ipt></body>';
    }
    function run() { out.style.display = 'block'; out.srcdoc = buildDoc(ta.value); }
    if (expect) {
      widgetHandlers[tok] = function (d) {
        if (!d.__runcell) return;
        const met = (d.text || '').indexOf(expect) >= 0;
        status.className = 'run-status ' + (met ? 'ok' : 'no'); status.textContent = met ? 'Goal met!' : 'Not yet — check the output.';
      };
    }
    btn.addEventListener('click', run);
    bar.appendChild(btn); bar.appendChild(status);
    cell.appendChild(ta); cell.appendChild(bar); cell.appendChild(out);
    pre.parentNode.replaceChild(cell, pre);
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
  root.querySelectorAll('pre > code.language-quiz').forEach(function (code) {
    let q; try { q = jsyaml.load(code.textContent) || {}; } catch (e) { q = {}; }
    const pre = code.parentNode;
    const cell = document.createElement('div'); cell.className = 'quizcell';
    const head = document.createElement('div'); head.className = 'quiz-h'; head.innerHTML = '<span class="mdi mdi-help-circle-outline"></span>'; head.appendChild(document.createTextNode(q.prompt || 'Quick check')); cell.appendChild(head);
    const body = document.createElement('div'); body.className = 'quiz-body'; cell.appendChild(body);
    const result = document.createElement('div'); result.className = 'quiz-result';
    const check = document.createElement('button'); check.className = 'quiz-check'; check.textContent = 'Check';
    const say = function (ok, msg) { result.className = 'quiz-result ' + (ok ? 'ok' : 'no'); result.textContent = msg; };
    const type = q.type || 'mcq';
    if (type === 'parsons') buildParsons(q, body, check, say);
    else if (type === 'fillblank') buildFill(q, body, check, say);
    else if (type === 'findbug') buildFindBug(q, body, check, say);
    else buildMCQ(q, body, check, say, type === 'predict');
    body.appendChild(check); cell.appendChild(result);
    pre.parentNode.replaceChild(cell, pre);
  });
}
function buildMCQ(q, body, check, say, isPredict) {
  if (isPredict && q.code) { const pc = document.createElement('pre'); pc.className = 'quiz-code'; pc.textContent = q.code; body.appendChild(pc); }
  const opts = q.options || []; const fb = q.feedback || []; let chosen = -1; const nm = 'q' + Math.random().toString(36).slice(2, 8); const rows = [];
  opts.forEach(function (opt, i) {
    const row = document.createElement('label'); row.className = 'mcq-opt'; rows.push(row);
    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = nm;
    radio.addEventListener('change', function () { chosen = i; });
    const span = document.createElement('span'); span.textContent = opt;
    row.appendChild(radio); row.appendChild(span); body.appendChild(row);
  });
  check.addEventListener('click', function () {
    if (chosen < 0) { say(false, 'Pick an answer first.'); return; }
    const ans = Number(q.answer); const ok = chosen === ans;
    rows.forEach(function (r, i) { r.classList.remove('correct', 'wrong'); if (i === ans) r.classList.add('correct'); else if (i === chosen) r.classList.add('wrong'); });
    if (ok) say(true, 'Correct!');
    else say(false, fb[chosen] ? 'Not quite — ' + fb[chosen] : (q.explain ? 'Not quite — ' + q.explain : 'Not quite — the highlighted answer is correct.'));
  });
}
function buildParsons(q, body, check, say) {
  const items = (q.lines || []).map(function (t) { return { text: t, distractor: false, why: '' }; })
    .concat((q.distractors || []).map(function (d) { return { text: (typeof d === 'string' ? d : d.text), distractor: true, why: (typeof d === 'string' ? '' : (d.why || '')) }; }));
  const correct = (q.lines || []); const hasDist = (q.distractors || []).length > 0;
  let order = shuffleOrder(items.length); const used = {}; items.forEach(function (_, i) { used[i] = true; }); let dragFrom = null;
  const list = document.createElement('div'); list.className = 'parsons';
  function draw() {
    list.innerHTML = '';
    order.forEach(function (idx, pos) {
      const it = items[idx];
      const row = document.createElement('div'); row.className = 'parsons-row' + (used[idx] ? '' : ' unused'); row.draggable = true;
      const handle = document.createElement('span'); handle.className = 'drag-handle'; handle.innerHTML = '<span class="mdi mdi-drag-horizontal-variant"></span>';
      row.appendChild(handle);
      if (hasDist) { const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'p-use'; cb.checked = used[idx]; cb.addEventListener('change', function () { used[idx] = cb.checked; row.classList.toggle('unused', !cb.checked); }); row.appendChild(cb); }
      const c = document.createElement('code'); c.textContent = it.text; row.appendChild(c);
      row.addEventListener('dragstart', function () { dragFrom = pos; row.classList.add('dragging'); });
      row.addEventListener('dragend', function () { row.classList.remove('dragging'); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('over'); });
      row.addEventListener('dragleave', function () { row.classList.remove('over'); });
      row.addEventListener('drop', function (e) { e.preventDefault(); row.classList.remove('over'); if (dragFrom === null || dragFrom === pos) { dragFrom = null; return; } const mv = order.splice(dragFrom, 1)[0]; order.splice(pos, 0, mv); dragFrom = null; draw(); });
      list.appendChild(row);
    });
  }
  draw(); body.appendChild(list);
  const hint = document.createElement('div'); hint.className = 'parsons-hint'; hint.textContent = hasDist ? 'Drag into order — and uncheck any lines that don’t belong.' : 'Drag the lines into the right order.'; body.appendChild(hint);
  check.addEventListener('click', function () {
    const kept = order.filter(function (idx) { return used[idx]; }).map(function (idx) { return items[idx]; });
    const badDist = kept.filter(function (it) { return it.distractor; });
    if (badDist.length) { say(false, badDist[0].why ? 'Not quite — ' + badDist[0].why : 'Not quite — one of the lines you kept doesn’t belong.'); return; }
    const texts = kept.map(function (it) { return it.text; });
    const ok = texts.length === correct.length && texts.every(function (t, i) { return t === correct[i]; });
    say(ok, ok ? 'Correct — nice ordering!' : 'Not yet — check the order (and which lines you kept).');
  });
}
function buildFill(q, body, check, say) {
  const tpl = String(q.code || q.template || ''); const parts = tpl.split('___');
  const wrap = document.createElement('div'); wrap.className = 'fill-code';
  const input = document.createElement('input'); input.type = 'text'; input.className = 'fill-input'; input.spellcheck = false; input.placeholder = '?';
  if (parts.length >= 2) { wrap.appendChild(document.createTextNode(parts[0])); wrap.appendChild(input); wrap.appendChild(document.createTextNode(parts.slice(1).join('___'))); }
  else { wrap.appendChild(input); }
  body.appendChild(wrap);
  const answers = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(function (a) { return String(a).trim(); });
  check.addEventListener('click', function () {
    const v = input.value.trim();
    const ok = answers.some(function (a) { return a === v || a.toLowerCase() === v.toLowerCase(); });
    say(ok, ok ? 'Correct!' : (q.explain ? 'Not quite — ' + q.explain : 'Not quite — try again.'));
  });
}
function buildFindBug(q, body, check, say) {
  const lines = q.code || q.lines || []; let chosen = -1; const rows = [];
  const wrap = document.createElement('div'); wrap.className = 'findbug';
  lines.forEach(function (ln, i) {
    const row = document.createElement('div'); row.className = 'fb-row'; rows.push(row);
    const num = document.createElement('span'); num.className = 'fb-num'; num.textContent = (i + 1);
    const c = document.createElement('code'); c.textContent = ln;
    row.appendChild(num); row.appendChild(c);
    row.addEventListener('click', function () { chosen = i; rows.forEach(function (r) { r.classList.remove('sel'); }); row.classList.add('sel'); });
    wrap.appendChild(row);
  });
  body.appendChild(wrap);
  check.addEventListener('click', function () {
    if (chosen < 0) { say(false, 'Click the line you think has the bug.'); return; }
    const ans = Number(q.answer); const ok = chosen === ans;
    rows.forEach(function (r, i) { r.classList.remove('correct', 'wrong'); if (i === ans) r.classList.add('correct'); else if (i === chosen) r.classList.add('wrong'); });
    say(ok, ok ? 'Correct — that’s the bug!' : (q.explain ? 'Not quite — ' + q.explain : 'Not quite — the highlighted line has the bug.'));
  });
}
/* ```challenge — an editable mini-game embedded in the lesson. YAML: task, code. The student's code
   calls win() when the goal is reached; that completes the lesson (replaces the "tick a box" button). */
function renderChallengeCells(root) {
  root.querySelectorAll('pre > code.language-challenge').forEach(function (code) {
    let c; try { c = jsyaml.load(code.textContent) || {}; } catch (e) { c = {}; }
    const pre = code.parentNode; const tok = 'cm' + Math.random().toString(36).slice(2, 9);
    const cell = document.createElement('div'); cell.className = 'challenge-mini';
    cell.innerHTML = '<div class="cm-h"><span class="mdi mdi-flag-checkered"></span>Challenge</div>';
    if (c.task) { const t = document.createElement('div'); t.className = 'cm-task'; t.textContent = c.task; cell.appendChild(t); }
    const ta = document.createElement('textarea'); ta.className = 'cm-code'; ta.value = c.code || ''; ta.spellcheck = false; ta.rows = Math.min(18, Math.max(4, (c.code || '').split('\n').length));
    const stage = document.createElement('iframe'); stage.className = 'cm-stage'; stage.setAttribute('sandbox', 'allow-scripts');
    const bar = document.createElement('div'); bar.className = 'cm-bar';
    const run = document.createElement('button'); run.className = 'cm-run'; run.innerHTML = '<span class="mdi mdi-play"></span>Run &amp; check';
    const status = document.createElement('div'); status.className = 'cm-status';
    function build(userCode) {
      const safe = userCode.replace(/<\/(script)/gi, '<\\/$1');
      return '<!doctype html><body style="margin:0;background:#08121f;display:flex;align-items:center;justify-content:center;height:100vh"><canvas id="c" width="300" height="200" style="background:#0d2137;border-radius:8px"></canvas><scr' + 'ipt>var canvas=document.getElementById("c"),ctx=canvas.getContext("2d"),__w=false;function win(){if(__w)return;__w=true;try{parent.postMessage({__cm:true,tok:"' + tok + '",win:true},"*");}catch(e){}}window.onerror=function(m){try{parent.postMessage({__cm:true,tok:"' + tok + '",err:String(m)},"*");}catch(e){}};try{\n' + safe + '\n}catch(e){window.onerror(e.message);}<\/scr' + 'ipt></body>';
    }
    widgetHandlers[tok] = function (d) {
      if (!d.__cm) return;
      if (d.win) { status.className = 'cm-status ok'; status.textContent = 'Challenge complete!'; if (flat[curIdx] && !state.done[flat[curIdx].id]) completeLesson(); }
      else if (d.err) { status.className = 'cm-status no'; status.textContent = 'Error: ' + d.err; }
    };
    run.addEventListener('click', function () { status.className = 'cm-status'; status.textContent = 'Running…'; stage.srcdoc = build(ta.value); });
    bar.appendChild(run); bar.appendChild(status);
    cell.appendChild(ta); cell.appendChild(stage); cell.appendChild(bar);
    pre.parentNode.replaceChild(cell, pre);
  });
}
const MODULE_HERO = ['#143561', '#2f2a6b', '#1f5b63', '#5b3320', '#1f6b45', '#6b2a52', '#26456b', '#4a6b26', '#6b5320', '#33305b'];
const MODULE_ACCENT = ['#3e8fd6', '#8b7cff', '#2fd0b6', '#f5820a', '#3ddc84', '#ff6b9d', '#59a5ff', '#a3d94a', '#f5b02e', '#7c9cff'];
function moduleHero(mi) { return MODULE_HERO[mi % MODULE_HERO.length]; }
function moduleAccent(mi) { return MODULE_ACCENT[mi % MODULE_ACCENT.length]; }
function selectLesson(idx) {
  curIdx = idx; const f = flat[idx];
  $('crumb').dataset.lesson = f.m.name + ': ' + f.l.t;
  $('lessonBody').innerHTML = lessonBodyHTML(f);
  $('lessonBody').style.setProperty('--mod', moduleHero(f.mi));
  currentLessonText = ($('lessonBody').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
  resetWidgetHandlers();   // the previous lesson's widget iframes are gone with the innerHTML
  renderRunCells($('lessonBody'));
  renderQuizCells($('lessonBody'));
  renderChallengeCells($('lessonBody'));
  applyAIMode(f.l.ai);
  const btn = $('completeBtn'); if (btn) btn.addEventListener('click', function () { completeLesson(); });
  renderOutline(); switchView('learn');
}
function completeLesson() {
  const f = flat[curIdx]; if (state.done[f.id]) return;
  state.done[f.id] = true; state.xp += f.l.xp; toast('Lesson complete!  +' + f.l.xp + ' XP');
  const allDone = course.modules[f.mi].lessons.every(function (l, li) { return state.done[f.mi + '.' + li]; });
  if (allDone && !state.modDone[f.mi]) { state.modDone[f.mi] = true; state.stars += course.modules[f.mi].stars; setTimeout(function () { toast('Module complete: ' + course.modules[f.mi].name + '!  +' + course.modules[f.mi].stars + ' ★'); }, 900); }
  saveState(); selectLesson(curIdx);
}
