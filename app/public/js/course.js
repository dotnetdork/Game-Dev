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
function lessonUnlocked(idx) { return idx === 0 || !!state.done[flat[idx - 1].id]; }

/* ---------- outline ---------- */
const tree = $('tree'); let curIdx = 0;
function renderOutline() {
  tree.innerHTML = '';
  course.modules.forEach(function (m, mi) {
    const firstIdx = flat.findIndex(function (f) { return f.mi === mi; });
    const modLocked = !lessonUnlocked(firstIdx);
    const sec = document.createElement('div'); sec.className = 'sec';
    const head = document.createElement('div'); head.className = 'sec-head' + (modLocked ? ' locked' : '');
    head.innerHTML = '<span class="tri">' + (modLocked ? '▸' : '▾') + '</span><span class="mdi ' + (modLocked ? 'mdi-lock' : 'mdi-folder') + '"' + (modLocked ? '' : ' style="color:' + moduleAccent(mi) + '"') + '></span><span class="lbl">' + m.name + '</span>';
    if (modLocked) sec.classList.add('collapsed');
    head.addEventListener('click', function () {
      if (modLocked) { toast('Finish the previous module to unlock this one.'); return; }
      sec.classList.toggle('collapsed'); head.querySelector('.tri').textContent = sec.classList.contains('collapsed') ? '▸' : '▾';
    });
    const kids = document.createElement('div'); kids.className = 'kids';
    m.lessons.forEach(function (l, li) {
      const idx = flat.findIndex(function (f) { return f.mi === mi && f.li === li; });
      const locked = !lessonUnlocked(idx), done = !!state.done[mi + '.' + li];
      const icon = done ? 'mdi-check-circle' : (locked ? 'mdi-lock' : 'mdi-file-document-outline');
      const row = document.createElement('div');
      row.className = 'page' + (idx === curIdx ? ' active' : '') + (done ? ' done' : '') + (locked ? ' locked' : '');
      row.innerHTML = '<span class="mdi ' + icon + '"></span><span class="lbl">' + l.t + '</span>';
      row.addEventListener('click', function () { if (locked) { toast('Complete the previous lesson first.'); return; } selectLesson(idx); });
      kids.appendChild(row);
    });
    sec.appendChild(head); sec.appendChild(kids); tree.appendChild(sec);
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
  const hasChallenge = /language-challenge/.test(f.l.body || '');   // lessons with a minigame complete via winning it
  const completeBox = hasChallenge ? '' :
    '<div class="challenge"><div class="ch-h"><span class="mdi mdi-check-circle-outline"></span> Finish this lesson</div>'
    + '<div style="color:var(--muted);margin-bottom:6px;">Mark it complete to earn XP and unlock the next lesson.</div>'
    + '<button class="btn-primary" id="completeBtn"' + (done ? ' disabled' : '') + '><span class="mdi mdi-' + (done ? 'check' : 'arrow-right') + '"></span>' + (done ? 'Completed  (+' + f.l.xp + ' XP)' : 'Complete lesson  (+' + f.l.xp + ' XP)') + '</button></div>';
  return '<div class="lesson-hero"><div class="hero-inner"><h1>' + f.l.t + '</h1>'
    + (f.l.d ? '<p class="lead">' + f.l.d + '</p>' : '') + meta + '</div></div>'
    + '<div class="lesson-content">' + f.l.body + completeBox + '</div>';
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