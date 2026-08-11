/* course.js — Authored course content: loads course.yaml + lessons/*.md, builds the outline, renders a lesson, and tracks the lesson's AI policy (full / guided / off). */
/* Course content is AUTHORED in /content: course.yaml (structure) + lessons/*.md
   (Markdown with YAML front-matter). Loaded read-only at boot; edit the files, not this code. */
let course = { id: 'course1', name: 'Course', library: 'Phaser', modules: [] };
let flat = [];
function buildFlat() {
  flat = [];
  course.modules.forEach(function (m, mi) { m.lessons.forEach(function (l, li) { flat.push({ mi: mi, li: li, id: mi + '.' + li, l: l, m: m }); }); });
}
function splitFrontMatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  let meta = {}; try { meta = jsyaml.load(m[1]) || {}; } catch (e) { meta = {}; }
  return { meta: meta, body: m[2] };
}
function loadCourse() {
  return fetch('content/course.yaml').then(function (r) { return r.text(); }).then(function (y) {
    const data = jsyaml.load(y) || {};
    course = { id: data.id, name: data.name || 'Course', library: data.library || 'Phaser', modules: [] };
    const jobs = [];
    (data.modules || []).forEach(function (mod) {
      const module = { name: mod.name, stars: mod.stars || 0, lessons: [] };
      course.modules.push(module);
      (mod.lessons || []).forEach(function (lessonId) {
        const lesson = { t: lessonId, xp: 0, d: '', body: '', ai: 'full' };
        module.lessons.push(lesson);
        jobs.push(fetch('content/lessons/' + lessonId + '.md').then(function (r) { return r.ok ? r.text() : ''; }).then(function (md) {
          const fm = splitFrontMatter(md || '');
          lesson.t = (fm.meta && fm.meta.title) || lessonId;
          lesson.xp = (fm.meta && fm.meta.xp) || 0;
          lesson.d = (fm.meta && fm.meta.summary) || '';
          lesson.ai = (fm.meta && fm.meta.ai) || 'full';
          lesson.body = mdToSafeHTML(fm.body || '');
        }).catch(function () { lesson.body = '<p>(Could not load this lesson.)</p>'; }));
      });
    });
    return Promise.all(jobs).then(buildFlat);
  });
}
// Guard the -1: an empty `lessons:` list in course.yaml would otherwise index flat[-2] and throw.
function lessonUnlocked(idx) { return idx <= 0 ? idx === 0 : !!(flat[idx - 1] && state.done[flat[idx - 1].id]); }

/* ---------- outline ----------
   Rows are real buttons in a tree, not divs with click listeners. Before this the panel had zero
   focusable elements and zero ARIA roles across every lesson and module, so a child using a
   keyboard or a screen reader could not reach a single lesson — not "with difficulty", at all. */
const tree = $('tree'); let curIdx = 0;
function renderOutline() {
  tree.innerHTML = '';
  tree.setAttribute('role', 'tree');
  tree.setAttribute('aria-label', 'Course outline');
  course.modules.forEach(function (m, mi) {
    const firstIdx = flat.findIndex(function (f) { return f.mi === mi; });
    const modLocked = !lessonUnlocked(firstIdx);
    const sec = document.createElement('div'); sec.className = 'sec';
    const head = document.createElement('button'); head.type = 'button';
    head.className = 'sec-head' + (modLocked ? ' locked' : '');
    head.setAttribute('role', 'treeitem');
    head.setAttribute('aria-expanded', modLocked ? 'false' : 'true');
    if (modLocked) head.setAttribute('aria-disabled', 'true');
    head.innerHTML = '<span class="tri" aria-hidden="true">' + (modLocked ? '▸' : '▾') + '</span><span class="mdi ' + (modLocked ? 'mdi-lock' : 'mdi-folder') + '" aria-hidden="true"' + (modLocked ? '' : ' style="color:' + moduleAccent(mi) + '"') + '></span><span class="lbl">' + esc(m.name) + '</span>';
    if (modLocked) sec.classList.add('collapsed');
    head.addEventListener('click', function () {
      if (modLocked) { toast('Finish the previous module to unlock this one.'); return; }
      const nowCollapsed = sec.classList.toggle('collapsed');
      head.querySelector('.tri').textContent = nowCollapsed ? '▸' : '▾';
      head.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
    });
    const kids = document.createElement('div'); kids.className = 'kids'; kids.setAttribute('role', 'group');
    m.lessons.forEach(function (l, li) {
      const idx = flat.findIndex(function (f) { return f.mi === mi && f.li === li; });
      const locked = !lessonUnlocked(idx), done = !!state.done[mi + '.' + li];
      const icon = done ? 'mdi-check-circle' : (locked ? 'mdi-lock' : 'mdi-file-document-outline');
      const row = document.createElement('button'); row.type = 'button';
      // `lesson-row`, not `page`: `.page` is the full-screen Store/Gallery layout rule, and it was
      // leaking height:100% and overflow:auto onto every row in this sidebar.
      row.className = 'lesson-row' + (idx === curIdx ? ' active' : '') + (done ? ' done' : '') + (locked ? ' locked' : '');
      row.setAttribute('role', 'treeitem');
      if (idx === curIdx) row.setAttribute('aria-current', 'true');
      if (locked) row.setAttribute('aria-disabled', 'true');
      row.innerHTML = '<span class="mdi ' + icon + '" aria-hidden="true"></span><span class="lbl">' + esc(l.t) + '</span>'
        + (done ? '<span class="sr-only"> (completed)</span>' : locked ? '<span class="sr-only"> (locked)</span>' : '');
      row.addEventListener('click', function () { if (locked) { toast('Complete the previous lesson first.'); return; } selectLesson(idx); });
      kids.appendChild(row);
    });
    sec.appendChild(head); sec.appendChild(kids); tree.appendChild(sec);
  });
  wireTreeKeys();
}

/* Roving tabindex: one stop for the whole tree, arrows to move within it. */
function wireTreeKeys() {
  const items = [].slice.call(tree.querySelectorAll('.sec-head, .lesson-row'));
  if (!items.length) return;
  const current = tree.querySelector('.lesson-row.active') || items[0];
  items.forEach(function (el) { el.tabIndex = el === current ? 0 : -1; });
  if (tree.__keysWired) return;
  tree.__keysWired = true;
  tree.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const list = [].slice.call(tree.querySelectorAll('.sec-head, .lesson-row'))
      .filter(function (el) { return el.offsetParent !== null; });
    const i = list.indexOf(document.activeElement);
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(list.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else next = list.length - 1;
    if (list[next]) { list.forEach(function (el) { el.tabIndex = -1; }); list[next].tabIndex = 0; list[next].focus(); e.preventDefault(); }
  });
}

/* ---------- lesson (rendered from authored Markdown) ---------- */
function lessonBodyHTML(f) {
  const done = !!state.done[f.id];
  const total = f.m.lessons.length;
  const meta = '<div class="lesson-meta">'
    + '<span class="lchip"><span class="mdi mdi-book-open-page-variant"></span>Lesson ' + (f.li + 1) + ' of ' + total + '</span>'
    + '<span class="lchip"><span class="mdi mdi-lightning-bolt"></span>+' + f.l.xp + ' XP</span>'
    + (done ? '<span class="lchip"><span class="mdi mdi-check-circle"></span>Completed</span>' : '')
    + '</div>';
  // No "Complete lesson" button: the lesson completes itself when the work is done. This strip
  // is what tells the student that completion is a thing and how close they are to it.
  const strip = '<div class="lesson-progress" id="lessonProgress" aria-live="polite"></div>';
  return '<div class="lesson-hero"><div class="hero-inner"><h1>' + f.l.t + '</h1>'
    + (f.l.d ? '<p class="lead">' + f.l.d + '</p>' : '') + meta + '</div></div>'
    + '<div class="lesson-content">' + f.l.body + strip + '</div>';
}

/* The strip under the lesson. Three states: how much is left, keep-reading, and the reward. */
function renderLessonProgress(f, dwellFrac) {
  const el = $('lessonProgress'); if (!el) return;
  const complete = !!state.done[f.id];
  if (complete) {
    el.className = 'lesson-progress done';
    el.innerHTML = '<span class="mdi mdi-check-circle"></span><b>Lesson complete</b>'
      + '<span class="lp-xp">+' + f.l.xp + ' XP</span>';
    return;
  }
  if (!lessonPlan.total) {
    const pct = Math.round((dwellFrac || 0) * 100);
    el.className = 'lesson-progress reading';
    el.innerHTML = '<span class="mdi mdi-book-open-page-variant"></span>'
      + '<span class="lp-label">Read to the end to finish this lesson</span>'
      + '<span class="lp-bar"><i style="width:' + pct + '%"></i></span>';
    return;
  }
  const n = activityProgress();
  el.className = 'lesson-progress';
  el.innerHTML = '<span class="mdi mdi-target"></span>'
    + '<span class="lp-label">' + n + ' of ' + lessonPlan.total + ' done</span>'
    + '<span class="lp-bar"><i style="width:' + Math.round(n / lessonPlan.total * 100) + '%"></i></span>'
    + '<span class="lp-xp">+' + f.l.xp + ' XP</span>';
}
let currentAIMode = 'full';   // the current lesson's coder policy: full | guided | off
let aiMode = 'coder';         // which agent the panel talks to: tutor | coder
let aiModels = {};            // per-agent model names from /api/info
let currentLessonText = '';   // plain text of the current lesson, used as tutor context
function applyAIMode(mode) {
  currentAIMode = mode || 'full';
  if (aiMode !== 'coder') return;   // in Tutor mode the lesson's coder policy doesn't gate the box
  const inp = $('aiText'), btn = $('aiSend');
  if (!inp || !btn) return;
  if (currentAIMode === 'off') { inp.disabled = true; btn.disabled = true; inp.placeholder = 'AI is off for this challenge — try it yourself!'; }
  else if (currentAIMode === 'guided') { inp.disabled = false; btn.disabled = false; inp.placeholder = 'Guided: tell the AI exactly what to change'; }
  else { inp.disabled = false; btn.disabled = false; inp.placeholder = 'Ask the AI to change your game...'; }
}
function setAIMode(mode) {
  aiMode = (mode === 'tutor') ? 'tutor' : 'coder';
  const tog = $('modeToggle');
  if (tog) {
    tog.innerHTML = '<span class="mdi ' + (aiMode === 'tutor' ? 'mdi-comment-text-outline' : 'mdi-code-tags') + '"></span>';
    tog.title = aiMode === 'tutor' ? 'Tutor mode (explains) — click to switch to Build' : 'Build mode (edits code) — click to switch to Tutor';
    tog.classList.toggle('tutor', aiMode === 'tutor'); tog.classList.toggle('coder', aiMode === 'coder');
  }
  const tag = $('aiModelTag'); if (tag) { const spec = aiModels[aiMode] || ''; tag.textContent = spec.replace(/^[^:]+:/, '') || '…'; tag.title = spec; }
  if (aiMode === 'tutor') { const inp = $('aiText'), btn = $('aiSend'); if (inp) { inp.disabled = false; inp.placeholder = 'Ask the tutor about this lesson...'; } if (btn) btn.disabled = false; }
  else { applyAIMode(currentAIMode); }
  if (typeof renderChat === 'function') renderChat(aiMode);
}