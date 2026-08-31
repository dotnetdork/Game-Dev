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

/* Boot used to fetch course.yaml and then all 47 lesson files, and render every one of them to
   HTML, before the outline could appear — 48 requests to show one lesson. /api/lessons returns the
   structure and every lesson's front-matter in one response; a body is fetched and rendered the
   first time that lesson is opened (see lessonBody below). */
function loadCourse() {
  return fetch('/api/lessons').then(function (r) {
    if (!r.ok) throw new Error('index ' + r.status);
    return r.json();
  }).then(function (data) {
    course = { id: data.id, name: data.name || 'Course', library: data.library || 'Phaser', modules: [] };
    (data.modules || []).forEach(function (mod) {
      const module = { name: mod.name, stars: mod.stars || 0, lessons: [] };
      course.modules.push(module);
      (mod.lessons || []).forEach(function (l) {
        // `id` is new: the body fetch needs the filename, which used to be implicit in load order.
        // `reward` is the badge this lesson's your-turn step awards, so the trophy case can list
        // every badge in the course rather than only the ones already earned.
        module.lessons.push({ id: l.id, t: l.title, xp: l.xp, d: l.summary, ai: l.ai, reward: l.reward || '', body: null });
      });
    });
    buildFlat();
  });
}

/* ---------- lesson bodies, fetched on demand ----------
   Cached on the lesson object, so re-opening one is instant and a student who loses the network
   mid-class can still move around what they have already read. */
function lessonBody(lesson) {
  if (lesson.body !== null) return Promise.resolve(lesson.body);
  // Absolute: the app is served from /lesson/<id> as well as /, and this must not resolve against
  // whichever one the student happens to be on. The <base> tag in index.html covers it too; this
  // is the one fetch important enough to not depend on that.
  return fetch('/content/lessons/' + lesson.id + '.md')
    .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(String(r.status))); })
    .then(function (md) {
      lesson.body = mdToSafeHTML(splitFrontMatter(md).body || '');
      return lesson.body;
    })
    .catch(function () {
      // Not cached: a lesson that failed because the network blinked should retry next time,
      // not be permanently replaced by an apology.
      return '<p>(Could not load this lesson. Check your connection and try again.)</p>';
    });
}
/* The next lesson is very likely the next thing they open, and it is a few KB. Fetching it once
   the current one is on screen means the click that matters never waits on the network. */
function prefetchNextLesson(idx) {
  const next = flat[idx + 1];
  if (next && next.l.body === null) lessonBody(next.l);
}
// Guard the -1: an empty `lessons:` list in course.yaml would otherwise index flat[-2] and throw.
// DEV.unlockAll opens every lesson for authoring and testing — see js/dev.js.
function lessonUnlocked(idx) {
  if (DEV.unlockAll) return true;
  return idx <= 0 ? idx === 0 : !!(flat[idx - 1] && state.done[flat[idx - 1].id]);
}

/* ---------- outline ----------
   Rows are real buttons in a tree, not divs with click listeners. Before this the panel had zero
   focusable elements and zero ARIA roles across every lesson and module, so a child using a
   keyboard or a screen reader could not reach a single lesson — not "with difficulty", at all. */
const tree = $('tree'); let curIdx = 0;

/* ---------- which modules are open ----------
   The whole tree is rebuilt from scratch on every lesson click. Only LOCKED modules used to be
   collapsed, so every unlocked one sprang back open on each rebuild — which is why clicking one
   lesson appeared to open all five, and why collapsing a module never stuck for more than a click.
   Remembered here instead: module index -> open. An entry only exists once the student has said
   something about that module, so the default below stays in charge until they do. */
const secOpen = {};
function moduleOfLesson(idx) { return flat[idx] ? flat[idx].mi : 0; }
/* Only the module being worked in. Five modules open at once is 22 rows in a 280px column with
   the current lesson somewhere in the middle of it. */
function moduleOpenByDefault(mi) { return mi === moduleOfLesson(curIdx); }
/* Called when the lesson changes: the module it lives in opens, so the active row is never hidden
   inside a collapsed section. Deliberately does not close anything the student opened themselves. */
function revealModuleFor(idx) { secOpen[moduleOfLesson(idx)] = true; }

function renderOutline() {
  tree.innerHTML = '';
  tree.setAttribute('role', 'tree');
  tree.setAttribute('aria-label', 'Course outline');
  course.modules.forEach(function (m, mi) {
    const firstIdx = flat.findIndex(function (f) { return f.mi === mi; });
    const modLocked = !lessonUnlocked(firstIdx);
    const open = !modLocked && (secOpen[mi] === undefined ? moduleOpenByDefault(mi) : !!secOpen[mi]);
    const sec = document.createElement('div'); sec.className = 'sec' + (open ? '' : ' collapsed');
    const head = document.createElement('button'); head.type = 'button';
    head.className = 'sec-head' + (modLocked ? ' locked' : '');
    head.setAttribute('role', 'treeitem');
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (modLocked) head.setAttribute('aria-disabled', 'true');
    head.innerHTML = '<span class="tri" aria-hidden="true">' + (open ? '▾' : '▸') + '</span><span class="mdi ' + (modLocked ? 'mdi-lock' : 'mdi-folder') + '" aria-hidden="true"' + (modLocked ? '' : ' style="color:' + moduleAccent(mi) + '"') + '></span><span class="lbl">' + esc(m.name) + '</span>';
    head.addEventListener('click', function () {
      if (modLocked) { toast('Finish the previous module to unlock this one.'); return; }
      const nowCollapsed = sec.classList.toggle('collapsed');
      secOpen[mi] = !nowCollapsed;                 // remembered, so the next rebuild honours it
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
  buildSectionNav();   // the open lesson keeps its section list across an outline rebuild
  wireTreeKeys();
}

/* ---------- the sections inside the lesson you are reading ----------
   The outline stopped at the lesson, so once a student was inside one there was no map at all: no
   sense of how many sections there were, which one they were in, how much was left, or — the part
   that actually matters — where the things they have to DO are. A lesson is about 2,500 pixels of
   scrolling, and the only way to find its quiz was to scroll until one appeared.

   So the open lesson expands into its own `##` headings, and a heading whose section contains a run
   cell, quiz, lab or practice step is marked. That dot is the honest answer to "what do I actually
   have to do in here", and it is why this lists sections rather than just being a table of
   contents. The current section highlights as you scroll.

   Only for the lesson being read, and only when there are at least two sections — a list of one is
   not a structure, and every lesson in the sidebar sprouting its own sub-tree would bury the course. */
/* The lesson's `##` headings, and only those.
   Quiz, Lab and Practice rows were tried here and taken back out: a lesson has one lab and one
   practice step, so listing them adds two rows that say what the block already says about itself
   when you reach it, and they doubled the length of the rail without telling you anything about
   what the lesson is ABOUT — which is the job a table of contents actually has. */
/* Recap is left out. Every lesson ends with one, it is a restatement of what the student has just
   read rather than a place to go, and it is the last thing on the page — so the row was a permanent
   final entry in every lesson's list that pointed at the bottom of the scrollbar. */
function navTargets() {
  const body = $('lessonBody');
  const root = body && body.querySelector('.lesson-content');
  if (!root) return [];
  return [].slice.call(root.querySelectorAll(':scope > h2'))
    .map(function (h) { return { el: h, label: h.textContent }; })
    .filter(function (t) { return !/^\s*recap\s*$/i.test(t.label); });
}
function scrollToSection(id) {
  const learn = $('view-learn'), target = document.getElementById(id);
  if (!learn || !target) return;
  if (typeof switchView === 'function') switchView('learn');
  const top = target.getBoundingClientRect().top - learn.getBoundingClientRect().top + learn.scrollTop - 16;
  try { learn.scrollTo({ top: top, behavior: 'smooth' }); } catch (e) { learn.scrollTop = top; }
}
function buildSectionNav() {
  const old = tree.querySelector('.sectionlist');
  if (old) old.remove();
  const row = tree.querySelector('.lesson-row.active');
  const targets = navTargets();
  if (!row || targets.length < 2) return;
  const list = document.createElement('div');
  list.className = 'sectionlist';
  list.setAttribute('role', 'group');
  targets.forEach(function (t, i) {
    if (!t.el.id) t.el.id = 'lsec' + i;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'section-row';
    b.setAttribute('role', 'treeitem');
    b.innerHTML = '<span class="mdi mdi-menu-right" aria-hidden="true"></span>'
      + '<span class="lbl">' + esc(t.label) + '</span>';
    b.addEventListener('click', function () { scrollToSection(t.el.id); });
    list.appendChild(b);
  });
  row.parentNode.insertBefore(list, row.nextSibling);
  spySections();
}
/* Which section is on screen. Reads on a rAF so a fast scroll costs one measurement a frame rather
   than one per scroll event. */
let spyQueued = false;
function spySections() {
  const list = tree.querySelector('.sectionlist');
  if (!list) return;
  const learn = $('view-learn');
  if (!learn) return;
  const top = learn.getBoundingClientRect().top;
  const targets = navTargets();
  let active = 0;
  targets.forEach(function (t, i) { if (t.el.getBoundingClientRect().top - top < 90) active = i; });
  [].slice.call(list.children).forEach(function (b, i) {
    b.classList.toggle('on', i === active);
    if (i === active) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
}
function wireSectionSpy() {
  const learn = $('view-learn');
  if (!learn || learn.__spyWired) return;
  learn.__spyWired = true;
  learn.addEventListener('scroll', function () {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function () { spyQueued = false; spySections(); });
  }, { passive: true });
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
function lessonBodyHTML(f, body) {
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
    + '<div class="lesson-content">' + body + strip + '</div>';
}

/* The strip under the lesson. Three states: how much is left, keep-reading, and the reward. */
function renderLessonProgress(f, dwellFrac, advanceSecs) {
  const el = $('lessonProgress'); if (!el) return;
  const complete = !!state.done[f.id];
  if (complete) {
    el.className = 'lesson-progress done';
    el.innerHTML = '<span class="mdi mdi-check-circle"></span><b>Lesson complete</b>'
      + '<span class="lp-xp">+' + f.l.xp + ' XP</span>';
    // Moving on is offered, with a way out. A page that navigates itself while a student is still
    // looking at what they just got right is a page that took the reward away from them.
    const next = flat[curIdx + 1];
    if (next && advanceSecs > 0) {
      const go = document.createElement('span'); go.className = 'lp-next';
      go.innerHTML = '<span class="lp-next-label">Next: ' + esc(next.l.t) + ' in <b>' + advanceSecs + 's</b></span>';
      const stay = document.createElement('button'); stay.type = 'button'; stay.className = 'btn btn-secondary lp-stay';
      stay.textContent = 'Stay here';
      stay.addEventListener('click', function () { cancelAdvance(); renderLessonProgress(f); });
      go.appendChild(stay); el.appendChild(go);
    }
    return;
  }
  if (!lessonPlan.total) {
    const pct = Math.round((dwellFrac || 0) * 100);
    el.className = 'lesson-progress reading';
    el.innerHTML = '<span class="mdi mdi-book-open-page-variant"></span>'
      + '<span class="lp-label">Read to the end to finish this lesson</span>'
      + '<span class="lp-bar"><i style="transform:scaleX(' + (pct / 100) + ')"></i></span>';
    return;
  }
  const n = activityProgress();
  el.className = 'lesson-progress';
  el.innerHTML = '<span class="mdi mdi-target"></span>'
    + '<span class="lp-label">' + n + ' of ' + lessonPlan.total + ' done</span>'
    + '<span class="lp-bar"><i style="transform:scaleX(' + (n / lessonPlan.total) + ')"></i></span>'
    + '<span class="lp-xp">+' + f.l.xp + ' XP</span>';
}
let currentAIMode = 'full';   // the current lesson's coder policy: full | guided | off
let aiMode = 'coder';         // which agent the panel talks to: tutor | coder
let aiModels = {};            // per-agent model names from /api/info
let currentLessonText = '';   // plain text of the current lesson, used as tutor context
/* The current lesson's practice task, set by renderYourTurnCells. Sent to the Build helper so it
   can tell "do my practice exercise for me" apart from every other request. Cleared per lesson —
   a stale task from the previous lesson would make Build refuse the wrong things. */
let currentPracticeTask = null;
/* Build is only useful where there is code on screen. On Learn the panel is the Tutor and the mode
   toggle is off — a student who asked Build to change something while reading got an edit they
   could not see, applied to a file they were not looking at. */
function paintAIModeAvailability(view) {
  const buildable = view !== 'learn';
  const tog = $('modeToggle');
  if (tog) {
    tog.disabled = !buildable;
    tog.title = buildable
      ? (aiMode === 'tutor' ? 'Tutor mode (explains) — click to switch to Build' : 'Build mode (edits code) — click to switch to Tutor')
      : 'Build edits your game\'s code — open the Code or Game tab to use it';
  }
  if (!buildable && aiMode === 'coder' && typeof setAIMode === 'function') setAIMode('tutor');
  else if (typeof paintAIBtn === 'function') paintAIBtn();
}

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
    // paintAIModeAvailability owns the title while Build is unavailable, so do not overwrite it.
    if (!tog.disabled) tog.title = aiMode === 'tutor' ? 'Tutor mode (explains) — click to switch to Build' : 'Build mode (edits code) — click to switch to Tutor';
    tog.classList.toggle('tutor', aiMode === 'tutor'); tog.classList.toggle('coder', aiMode === 'coder');
  }
  const tag = $('aiModelTag'); if (tag) { const spec = aiModels[aiMode] || ''; tag.textContent = spec.replace(/^[^:]+:/, '') || '…'; tag.title = spec; }
  if (aiMode === 'tutor') { const inp = $('aiText'), btn = $('aiSend'); if (inp) { inp.disabled = false; inp.placeholder = 'Ask the tutor about this lesson...'; } if (btn) btn.disabled = false; }
  else { applyAIMode(currentAIMode); }
  /* Each mode has its own current conversation, so switching modes swaps which thread is on
     screen rather than showing one mode's messages under the other's name. */
  if (typeof bindChat === 'function') bindChat(aiMode);
  if (typeof renderChat === 'function') renderChat(aiMode);
  if (typeof renderChatBar === 'function') renderChatBar();
}